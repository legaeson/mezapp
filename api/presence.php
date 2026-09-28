<?php
// LezgiMez - High-Performance Protected Room Relay & Matchmaking Engine v3.0
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$baseTmp  = sys_get_temp_dir() . '/lezgimez_duel';
$roomsDir = $baseTmp . '/rooms';
$rateDir  = $baseTmp . '/ratelimit';

foreach ([$baseTmp, $roomsDir, $rateDir] as $dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
}

$presenceFile = $baseTmp . '/presence_cache.json';
$matchFile    = $baseTmp . '/match_cache.json';

$presenceTtl = 30;  // seconds
$roomTtl     = 300; // 5 minutes inactivity
$matchTtl    = 15;  // 15 seconds queue timeout

$now = time();
$clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
$clientIp = (string)preg_replace('/[^0-9a-fA-F:.]/', '', (string)$clientIp);

// -------------------------------------------------------------
// Safe Atomic Storage Engine (Prevents 0-byte corruptions)
// -------------------------------------------------------------
function atomicFileModify(string $filePath, callable $modifier, int $timeoutMs = 1500): mixed {
    $fp = @fopen($filePath, 'c+');
    if (!$fp) return false;

    $startTime = microtime(true);
    $locked = false;
    while ((microtime(true) - $startTime) * 1000 < $timeoutMs) {
        if (@flock($fp, LOCK_EX | LOCK_NB)) {
            $locked = true;
            break;
        }
        usleep(10000); // 10ms backoff
    }

    if (!$locked) {
        @fclose($fp);
        return false;
    }

    $raw = stream_get_contents($fp);
    $data = [];
    if ($raw !== false && $raw !== '') {
        $parsed = json_decode($raw, true);
        if (is_array($parsed)) $data = $parsed;
    }

    $result = $modifier($data);

    if ($data === null) {
        @flock($fp, LOCK_UN);
        @fclose($fp);
        @unlink($filePath);
        return $result;
    }

    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE);
    rewind($fp);
    fwrite($fp, $encoded);
    ftruncate($fp, strlen($encoded));
    fflush($fp);
    @flock($fp, LOCK_UN);
    @fclose($fp);

    return $result;
}

// -------------------------------------------------------------
// Rate Limiter (Protects against DoS / Room Exhaustion)
// -------------------------------------------------------------
function isRateLimited(string $rateDir, string $ip, string $action, int $limit, int $period = 60): bool {
    $hash = md5($ip . '_' . $action);
    $file = $rateDir . '/rate_' . $hash . '.json';
    return (bool)atomicFileModify($file, function (&$data) use ($limit, $period) {
        $now = time();
        if (!is_array($data) || ($now - ($data['t'] ?? 0)) > $period) {
            $data = ['t' => $now, 'c' => 1];
            return false; // not limited
        }
        $data['c'] = ($data['c'] ?? 0) + 1;
        return ($data['c'] > $limit);
    });
}

// -------------------------------------------------------------
// Request Parsing & Strict Sanitization
// -------------------------------------------------------------
$rawInput = @file_get_contents('php://input');
$payload = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $rawInput) {
    if (strlen($rawInput) > 65536) {
        http_response_code(413);
        echo json_encode(['ok' => false, 'error' => 'Payload too large']);
        exit;
    }
    $decoded = json_decode($rawInput, true);
    if (is_array($decoded)) $payload = $decoded;
} else {
    $payload = $_GET;
}

$action    = isset($payload['action']) ? (string)$payload['action'] : 'presence';
$clientId  = isset($payload['id']) ? substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$payload['id']), 0, 48) : null;
$roomCode  = isset($payload['roomCode']) ? substr(strtoupper(preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$payload['roomCode'])), 0, 16) : null;
$sinceId   = isset($payload['since']) ? max(0, (int)$payload['since']) : 0;
$searching = !empty($payload['searching']);
$bye       = !empty($payload['bye']);

// Safe player info parser
$playerInfo = null;
if (isset($payload['player']) && is_array($payload['player'])) {
    $rawName = (string)($payload['player']['name'] ?? 'Игрок');
    $rawAvatar = (string)($payload['player']['avatar'] ?? 'И');
    $isPhoto = !empty($payload['player']['isPhoto']);
    // Filter malicious URLs (only allow safe https/http or text/emoji)
    if ($isPhoto && !preg_match('/^https?:\/\//i', $rawAvatar)) {
        $isPhoto = false;
        $rawAvatar = 'И';
    }
    $playerInfo = [
        'name'    => htmlspecialchars(mb_substr(trim(strip_tags($rawName)), 0, 32), ENT_QUOTES, 'UTF-8'),
        'avatar'  => htmlspecialchars(mb_substr(trim(strip_tags($rawAvatar)), 0, 200), ENT_QUOTES, 'UTF-8'),
        'isPhoto' => $isPhoto
    ];
}

// Strictly validated gameplay events (Clients CANNOT inject OPPONENT_LEFT or GUEST_JOINED)
$eventData = null;
if (isset($payload['data']) && is_array($payload['data'])) {
    $allowedClientTypes = ['ANSWER', 'SYNC_WORDS', 'REMATCH_OFFER', 'REMATCH_ACCEPT'];
    $type = (string)($payload['data']['type'] ?? '');
    if (in_array($type, $allowedClientTypes, true)) {
        $eventData = $payload['data'];
        // Anti-cheat validation on ANSWER
        if ($type === 'ANSWER') {
            $eventData['round']     = max(0, (int)($eventData['round'] ?? 0));
            $eventData['isCorrect'] = (bool)($eventData['isCorrect'] ?? false);
            $eventData['livesLeft'] = max(0, min(3, (int)($eventData['livesLeft'] ?? 3)));
            $eventData['score']     = max(0, (int)($eventData['score'] ?? 0));
        }
    }
}

// -------------------------------------------------------------
// 1. DEDICATED PRESENCE ROUTE (Only touched when needed!)
// -------------------------------------------------------------
if ($action === 'presence' || empty($action)) {
    $pState = ['online' => 1, 'searching' => 0];
    atomicFileModify($presenceFile, function (&$data) use ($now, $presenceTtl, $clientId, $searching, $bye, &$pState) {
        if (!is_array($data)) $data = [];
        foreach ($data as $id => $info) {
            if (!isset($info['t']) || ($now - $info['t']) > $presenceTtl) {
                unset($data[$id]);
            }
        }
        if ($bye && $clientId) {
            unset($data[$clientId]);
        } elseif ($clientId) {
            $data[$clientId] = ['t' => $now, 's' => $searching ? 1 : 0];
        }

        $searchingCount = 0;
        foreach ($data as $info) {
            if (!empty($info['s'])) $searchingCount++;
        }
        $pState['online'] = max(1, count($data));
        $pState['searching'] = $searchingCount;
        return true;
    });

    echo json_encode([
        'ok'        => true,
        'online'    => $pState['online'],
        'searching' => $pState['searching'],
        'timestamp' => $now
    ]);
    exit;
}

// -------------------------------------------------------------
// 2. ISOLATED SHARDED ROOMS (Zero presence file locking!)
// -------------------------------------------------------------
if (in_array($action, ['room_create', 'room_join', 'room_poll', 'room_send', 'room_leave'], true)) {
    if (!$clientId) {
        echo json_encode(['ok' => false, 'error' => 'Missing client ID']);
        exit;
    }

    if ($action === 'room_create') {
        if (isRateLimited($rateDir, $clientIp, 'room_create', 10, 60)) {
            echo json_encode(['ok' => false, 'error' => 'Слишком много комнат. Попробуйте через минуту.']);
            exit;
        }

        if (!$roomCode) {
            $roomCode = (string)mt_rand(1000, 9999);
            for ($i = 0; $i < 10; $i++) {
                if (!file_exists($roomsDir . '/room_' . $roomCode . '.json')) break;
                $roomCode = (string)mt_rand(1000, 9999);
            }
        }

        $rFile = $roomsDir . '/room_' . $roomCode . '.json';
        $created = atomicFileModify($rFile, function (&$room) use ($roomCode, $clientId, $playerInfo, $now) {
            $room = [
                'code'       => $roomCode,
                'created'    => $now,
                'lastActive' => $now,
                'seq'        => 0, // Monotonic Sequence Counter!
                'host'       => [
                    'id'       => $clientId,
                    'player'   => $playerInfo ?: ['name' => 'Хост', 'avatar' => 'Х', 'isPhoto' => false],
                    'lastPing' => $now
                ],
                'guest'      => null,
                'events'     => []
            ];
            return true;
        });

        echo json_encode(['ok' => (bool)$created, 'roomCode' => $roomCode, 'role' => 'host']);
        exit;
    }

    $rFile = $roomsDir . '/room_' . $roomCode . '.json';

    if ($action === 'room_join') {
        if (!$roomCode || !file_exists($rFile)) {
            echo json_encode(['ok' => false, 'error' => 'Комната не найдена. Проверьте код.']);
            exit;
        }

        $res = atomicFileModify($rFile, function (&$room) use ($clientId, $playerInfo, $now, $roomCode) {
            if (!$room) return ['ok' => false, 'error' => 'Комната не найдена'];
            $room['lastActive'] = $now;

            if ($room['host']['id'] === $clientId) {
                return [
                    'ok'       => true,
                    'roomCode' => $roomCode,
                    'role'     => 'host',
                    'opponent' => $room['guest'] ? $room['guest']['player'] : null
                ];
            }

            if ($room['guest'] !== null && $room['guest']['id'] !== $clientId) {
                return ['ok' => false, 'error' => 'Комната уже заполнена.'];
            }

            $room['guest'] = [
                'id'       => $clientId,
                'player'   => $playerInfo ?: ['name' => 'Гость', 'avatar' => 'Г', 'isPhoto' => false],
                'lastPing' => $now
            ];

            // Atomic monotonic increment
            $room['seq'] = ($room['seq'] ?? 0) + 1;
            $eventId = $room['seq'];
            $room['events'][] = [
                'id'     => $eventId,
                'sender' => $clientId,
                'data'   => ['type' => 'GUEST_JOINED', 'player' => $room['guest']['player']],
                't'      => $now
            ];

            return [
                'ok'       => true,
                'roomCode' => $roomCode,
                'role'     => 'guest',
                'opponent' => $room['host']['player']
            ];
        });

        echo json_encode($res ?: ['ok' => false, 'error' => 'Ошибка входа']);
        exit;
    }

    if ($action === 'room_poll') {
        if (!$roomCode || !file_exists($rFile)) {
            echo json_encode(['ok' => false, 'error' => 'Комната не найдена']);
            exit;
        }

        $res = atomicFileModify($rFile, function (&$room) use ($clientId, $sinceId, $now) {
            if (!$room) return ['ok' => false, 'error' => 'Комната не найдена'];
            $room['lastActive'] = $now;

            $isHost = ($room['host']['id'] === $clientId);
            $opponent = null;
            $opponentPing = $now;

            if ($isHost) {
                $room['host']['lastPing'] = $now;
                $opponent = $room['guest'] ? $room['guest']['player'] : null;
                if ($room['guest']) $opponentPing = $room['guest']['lastPing'] ?? $now;
            } else {
                if ($room['guest']) $room['guest']['lastPing'] = $now;
                $opponent = $room['host']['player'] ?? null;
                if ($room['host']) $opponentPing = $room['host']['lastPing'] ?? $now;
            }

            $newEvents = [];
            $maxId = $sinceId;
            foreach ($room['events'] as $ev) {
                if ($ev['id'] > $sinceId) {
                    if ($ev['id'] > $maxId) $maxId = $ev['id'];
                    if ($ev['sender'] !== $clientId) {
                        $newEvents[] = $ev;
                    }
                }
            }

            // Mobile-tolerant timeout: 35 seconds (avoids false disconnect during app switch / incoming call)
            $opponentLeft = false;
            $opponentExists = $isHost ? !empty($room['guest']) : true;
            if ($opponentExists && ($now - $opponentPing) > 35) {
                $opponentLeft = true;
            }

            return [
                'ok'           => true,
                'opponent'     => $opponent,
                'events'       => $newEvents,
                'lastId'       => $maxId,
                'opponentLeft' => $opponentLeft
            ];
        });

        echo json_encode($res ?: ['ok' => false, 'error' => 'Ошибка опроса']);
        exit;
    }

    if ($action === 'room_send') {
        if (!$roomCode || !file_exists($rFile) || !$eventData) {
            echo json_encode(['ok' => false, 'error' => 'Некорректные параметры']);
            exit;
        }

        $res = atomicFileModify($rFile, function (&$room) use ($clientId, $eventData, $now) {
            if (!$room) return ['ok' => false, 'error' => 'Комната не найдена'];
            $room['lastActive'] = $now;

            if ($room['host']['id'] === $clientId) {
                $room['host']['lastPing'] = $now;
            } elseif ($room['guest'] && $room['guest']['id'] === $clientId) {
                $room['guest']['lastPing'] = $now;
            }

            // Monotonic Sequence Increment!
            $room['seq'] = ($room['seq'] ?? 0) + 1;
            $nextId = $room['seq'];

            $room['events'][] = [
                'id'     => $nextId,
                'sender' => $clientId,
                'data'   => $eventData,
                't'      => $now
            ];

            // Keep buffer bounded without mutating sequence IDs
            if (count($room['events']) > 50) {
                $room['events'] = array_slice($room['events'], -30);
            }

            return ['ok' => true, 'eventId' => $nextId];
        });

        echo json_encode($res ?: ['ok' => false, 'error' => 'Ошибка отправки']);
        exit;
    }

    if ($action === 'room_leave') {
        if ($roomCode && file_exists($rFile)) {
            atomicFileModify($rFile, function (&$room) use ($clientId, $now) {
                if (!$room) return true;
                $room['seq'] = ($room['seq'] ?? 0) + 1;
                $room['events'][] = [
                    'id'     => $room['seq'],
                    'sender' => $clientId,
                    'data'   => ['type' => 'OPPONENT_LEFT'],
                    't'      => $now
                ];
                // Immediate deletion if host leaves an empty room
                if ($room['host']['id'] === $clientId && !$room['guest']) {
                    $room = null;
                }
                return true;
            });
        }
        echo json_encode(['ok' => true]);
        exit;
    }
}

// -------------------------------------------------------------
// 3. ATOMIC MATCHMAKING (Protected Against Dropped Packets)
// -------------------------------------------------------------
if (in_array($action, ['match_join', 'match_poll', 'match_cancel'], true)) {
    if (!$clientId) {
        echo json_encode(['ok' => false, 'error' => 'Missing client ID']);
        exit;
    }

    $response = atomicFileModify($matchFile, function (&$state) use ($action, $clientId, $playerInfo, $now, $matchTtl, $roomsDir) {
        if (!is_array($state)) $state = ['queue' => [], 'matches' => []];

        // Clean stale queue (>15s) and stale matches (>45s)
        foreach ($state['queue'] as $qId => $qData) {
            if (!isset($qData['t']) || ($now - $qData['t']) > $matchTtl) unset($state['queue'][$qId]);
        }
        foreach ($state['matches'] as $mId => $mData) {
            if (!isset($mData['t']) || ($now - $mData['t']) > 45) unset($state['matches'][$mId]);
        }

        if ($action === 'match_cancel') {
            unset($state['queue'][$clientId]);
            if (isset($state['matches'][$clientId])) {
                $mCode = $state['matches'][$clientId]['roomCode'] ?? null;
                if ($mCode) {
                    $rFile = $roomsDir . '/room_' . $mCode . '.json';
                    // Write OPPONENT_LEFT into room so other player is notified immediately
                    if (file_exists($rFile)) {
                        atomicFileModify($rFile, function (&$room) use ($clientId, $now) {
                            if (!$room) return true;
                            $room['seq'] = ($room['seq'] ?? 0) + 1;
                            $room['events'][] = [
                                'id'     => $room['seq'],
                                'sender' => $clientId,
                                'data'   => ['type' => 'OPPONENT_LEFT'],
                                't'      => $now
                            ];
                            return true;
                        });
                    }
                }
                unset($state['matches'][$clientId]);
            }
            return ['ok' => true, 'cancelled' => true];
        }

        // Return match safely without immediate deletion (safe against packet loss)
        if (isset($state['matches'][$clientId])) {
            $m = $state['matches'][$clientId];
            if (!empty($m['acked'])) {
                unset($state['matches'][$clientId]);
            } else {
                $state['matches'][$clientId]['acked'] = true;
            }
            unset($state['queue'][$clientId]);
            return [
                'ok'       => true,
                'matched'  => true,
                'role'     => $m['role'],
                'roomCode' => $m['roomCode'],
                'opponent' => $m['opponent']
            ];
        }

        if ($action === 'match_poll') {
            return [
                'ok'      => true,
                'matched' => false,
                'waiting' => isset($state['queue'][$clientId])
            ];
        }

        if ($action === 'match_join') {
            $opponentId = null;
            $opponentData = null;
            foreach ($state['queue'] as $otherId => $otherData) {
                if ($otherId !== $clientId) {
                    $opponentId = $otherId;
                    $opponentData = $otherData;
                    break;
                }
            }

            if ($opponentId && $opponentData) {
                unset($state['queue'][$opponentId]);
                unset($state['queue'][$clientId]);

                $matchedRoomCode = 'M' . mt_rand(10000, 99999);
                $myInfo = $playerInfo ?: ['name' => 'Игрок', 'avatar' => 'И', 'isPhoto' => false];
                $oppInfo = $opponentData['player'] ?: ['name' => 'Соперник', 'avatar' => 'С', 'isPhoto' => false];

                $rFile = $roomsDir . '/room_' . $matchedRoomCode . '.json';
                $roomData = [
                    'code'       => $matchedRoomCode,
                    'created'    => $now,
                    'lastActive' => $now,
                    'seq'        => 1,
                    'host'       => ['id' => $opponentId, 'player' => $oppInfo, 'lastPing' => $now],
                    'guest'      => ['id' => $clientId, 'player' => $myInfo, 'lastPing' => $now],
                    'events'     => [
                        [
                            'id'     => 1,
                            'sender' => $clientId,
                            'data'   => ['type' => 'GUEST_JOINED', 'player' => $myInfo],
                            't'      => $now
                        ]
                    ]
                ];
                file_put_contents($rFile, json_encode($roomData, JSON_UNESCAPED_UNICODE), LOCK_EX);

                $state['matches'][$opponentId] = [
                    'roomCode' => $matchedRoomCode,
                    'role'     => 'host',
                    'opponent' => $myInfo,
                    't'        => $now,
                    'acked'    => false
                ];

                return [
                    'ok'       => true,
                    'matched'  => true,
                    'role'     => 'guest',
                    'roomCode' => $matchedRoomCode,
                    'opponent' => $oppInfo
                ];
            }

            $state['queue'][$clientId] = [
                'id'     => $clientId,
                'player' => $playerInfo ?: ['name' => 'Игрок', 'avatar' => 'И', 'isPhoto' => false],
                't'      => $now
            ];

            return ['ok' => true, 'matched' => false, 'waiting' => true];
        }

        return ['ok' => false];
    });

    echo json_encode($response ?: ['ok' => false, 'error' => 'Ошибка подбора']);
    exit;
}

echo json_encode(['ok' => false, 'error' => 'Неизвестное действие']);
