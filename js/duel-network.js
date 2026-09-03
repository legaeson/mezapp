/**
 * LezgiMez - Real-time Multiplayer Duel Network
 * Uses WebRTC DataChannel via PeerJS for ultra-low latency direct P2P connection,
 * with zero server setup, room codes, Telegram invite deep linking, and smart online matchmaking.
 */

(function () {
    'use strict';

    const PEER_PREFIX = 'lzg-duel-';
    const MATCH_LOBBY_PREFIX = 'lzg-match-';

    const RIVAL_NAMES = [
        { name: 'Мурад М.', photo: '' },
        { name: 'Самира К.', photo: '' },
        { name: 'Аслан И.', photo: '' },
        { name: 'Фатима Р.', photo: '' },
        { name: 'Эльдар Г.', photo: '' },
        { name: 'Заира С.', photo: '' },
        { name: 'Шамиль А.', photo: '' },
        { name: 'Камилла Д.', photo: '' },
        { name: 'Магомед Б.', photo: '' },
        { name: 'Диана М.', photo: '' }
    ];

    class DuelNetworkManager {
        constructor() {
            this.peer = null;
            this.conn = null;
            this.role = null; // 'host' | 'guest' | 'simulated'
            this.roomCode = null;
            this.opponent = null; // { name, avatar, lives, score, status }
            this.isConnected = false;
            this.simulatedTimer = null;
            this.matchmakingTimeout = null;

            // Callbacks
            this.onReady = null;
            this.onOpponentAnswer = null;
            this.onRoundSync = null;
            this.onOpponentLeft = null;
            this.onRematchRequested = null;
            this.onRematchAccepted = null;
        }

        generateRoomCode() {
            // 4-digit readable numeric code
            return String(Math.floor(1000 + Math.random() * 9000));
        }

        getMyPlayerInfo() {
            const tgUser = window.TelegramApp?.getUser?.();
            const name = tgUser 
                ? ([tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Игрок')
                : (localStorage.getItem('lezgimez_player_name') || 'Игрок');
            const avatar = tgUser?.photo_url || (name.charAt(0).toUpperCase());
            return { name, avatar, isPhoto: Boolean(tgUser?.photo_url) };
        }

        cleanup() {
            if (this.simulatedTimer) {
                clearTimeout(this.simulatedTimer);
                this.simulatedTimer = null;
            }
            if (this.matchmakingTimeout) {
                clearTimeout(this.matchmakingTimeout);
                this.matchmakingTimeout = null;
            }
            if (this.conn) {
                try { this.conn.close(); } catch (e) {}
                this.conn = null;
            }
            if (this.peer) {
                try { this.peer.destroy(); } catch (e) {}
                this.peer = null;
            }
            this.role = null;
            this.roomCode = null;
            this.opponent = null;
            this.isConnected = false;
        }

        ensurePeerJs(callback) {
            if (typeof Peer !== 'undefined') {
                callback();
                return;
            }
            // Load local peerjs.min.js or fallback to CDN
            const script = document.createElement('script');
            script.src = './js/peerjs.min.js';
            script.onload = () => callback();
            script.onerror = () => {
                const cdn = document.createElement('script');
                cdn.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
                cdn.onload = () => callback();
                cdn.onerror = () => {
                    console.error('[DuelNetwork] Failed to load PeerJS');
                    alert('Не удалось загрузить сетевой модуль. Проверьте интернет-соединение.');
                };
                document.head.appendChild(cdn);
            };
            document.head.appendChild(script);
        }

        /**
         * Host creates a room and waits for a friend to join
         */
        createRoom(roomCode, onWaiting, onJoined, onError) {
            this.cleanup();
            this.role = 'host';
            this.roomCode = roomCode || this.generateRoomCode();
            const peerId = PEER_PREFIX + this.roomCode;

            this.ensurePeerJs(() => {
                try {
                    this.peer = new Peer(peerId, {
                        debug: 1,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:stun1.l.google.com:19302' }
                            ]
                        }
                    });

                    this.peer.on('open', () => {
                        if (typeof onWaiting === 'function') onWaiting(this.roomCode);
                    });

                    this.peer.on('connection', (conn) => {
                        this.conn = conn;
                        this.setupConnectionHandlers(onJoined);
                    });

                    this.peer.on('error', (err) => {
                        console.error('[DuelNetwork] Host Peer error:', err);
                        if (err.type === 'unavailable-id') {
                            // Room already exists, retry with new code
                            this.createRoom(this.generateRoomCode(), onWaiting, onJoined, onError);
                        } else {
                            if (typeof onError === 'function') onError(err);
                        }
                    });
                } catch (e) {
                    console.error('[DuelNetwork] createRoom exception:', e);
                    if (typeof onError === 'function') onError(e);
                }
            });
        }

        /**
         * Guest joins a room by room code
         */
        joinRoom(roomCode, onConnecting, onJoined, onError) {
            this.cleanup();
            this.role = 'guest';
            this.roomCode = String(roomCode).trim();
            const targetPeerId = PEER_PREFIX + this.roomCode;
            let retryCount = 0;

            this.ensurePeerJs(() => {
                try {
                    if (typeof onConnecting === 'function') onConnecting();

                    this.peer = new Peer({
                        debug: 1,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:stun1.l.google.com:19302' }
                            ]
                        }
                    });

                    const attemptConnect = () => {
                        if (this.isConnected) return;
                        if (this.conn) {
                            try { this.conn.close(); } catch (e) {}
                            this.conn = null;
                        }
                        const conn = this.peer.connect(targetPeerId, {
                            reliable: true
                        });
                        this.conn = conn;
                        this.setupConnectionHandlers(onJoined);
                    };

                    this.peer.on('open', () => {
                        attemptConnect();
                    });

                    this.peer.on('error', (err) => {
                        console.error('[DuelNetwork] Guest Peer error:', err);
                        if (this.isConnected) return;
                        if ((err.type === 'peer-unavailable' || (err.message && err.message.includes('Could not connect'))) && retryCount < 3) {
                            retryCount++;
                            console.log(`[DuelNetwork] Retrying connection to ${targetPeerId} (attempt ${retryCount}/3)...`);
                            setTimeout(() => {
                                attemptConnect();
                            }, 1200);
                            return;
                        }
                        if (typeof onError === 'function') onError(err);
                    });
                } catch (e) {
                    console.error('[DuelNetwork] joinRoom exception:', e);
                    if (typeof onError === 'function') onError(e);
                }
            });
        }

        /**
         * Matchmaking: search for online opponent or fall back to smart rival
         */
        startMatchmaking(onSearching, onMatched, onError) {
            this.cleanup();
            if (typeof onSearching === 'function') onSearching();

            const myInfo = this.getMyPlayerInfo();
            const queueSlot = Math.floor(Math.random() * 3); // 0, 1 or 2
            const queuePeerId = MATCH_LOBBY_PREFIX + queueSlot;

            this.ensurePeerJs(() => {
                let matched = false;

                // Fallback timeout to simulated online player after 6.5s
                this.matchmakingTimeout = setTimeout(() => {
                    if (!matched) {
                        matched = true;
                        this.startSimulatedMatch(onMatched);
                    }
                }, 6500);

                try {
                    this.peer = new Peer({
                        debug: 1,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:stun1.l.google.com:19302' }
                            ]
                        }
                    });

                    this.peer.on('open', () => {
                        // First attempt to connect to current queue slot
                        const conn = this.peer.connect(queuePeerId, { reliable: true });
                        this.conn = conn;

                        let connectedToHost = false;

                        conn.on('open', () => {
                            if (matched) return;
                            matched = true;
                            clearTimeout(this.matchmakingTimeout);
                            this.role = 'guest';
                            this.setupConnectionHandlers(onMatched);
                        });

                        setTimeout(() => {
                            if (!connectedToHost && !matched) {
                                // If nobody was in slot, become the host of this slot
                                try { conn.close(); } catch (e) {}
                                try { this.peer.destroy(); } catch (e) {}

                                this.peer = new Peer(queuePeerId, {
                                    debug: 1,
                                    config: {
                                        iceServers: [
                                            { urls: 'stun:stun.l.google.com:19302' },
                                            { urls: 'stun:stun1.l.google.com:19302' }
                                        ]
                                    }
                                });

                                this.peer.on('connection', (incomingConn) => {
                                    if (matched) return;
                                    matched = true;
                                    clearTimeout(this.matchmakingTimeout);
                                    this.role = 'host';
                                    this.conn = incomingConn;
                                    this.setupConnectionHandlers(onMatched);
                                });

                                this.peer.on('error', () => {
                                    // If slot error, let timeout handle simulated player
                                });
                            }
                        }, 2500);
                    });

                    this.peer.on('error', () => {
                        // Let fallback timeout start simulated match
                    });
                } catch (e) {
                    if (!matched) {
                        matched = true;
                        this.startSimulatedMatch(onMatched);
                    }
                }
            });
        }

        startSimulatedMatch(onMatched) {
            this.cleanup();
            this.role = 'simulated';
            this.isConnected = true;

            const rivalData = RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)];
            this.opponent = {
                name: rivalData.name,
                avatar: rivalData.photo || rivalData.name.charAt(0),
                isPhoto: Boolean(rivalData.photo),
                lives: 3,
                score: 0,
                status: 'Думает...'
            };

            if (typeof onMatched === 'function') {
                onMatched({
                    opponent: this.opponent,
                    role: this.role,
                    roomCode: 'ONLINE'
                });
            }
        }

        setupConnectionHandlers(onConnectedCallback) {
            if (!this.conn) return;

            const myInfo = this.getMyPlayerInfo();
            let notified = false;

            const notifyConnected = () => {
                if (notified) return;
                notified = true;
                if (typeof onConnectedCallback === 'function') {
                    onConnectedCallback({
                        opponent: this.opponent || { name: 'Соперник', avatar: 'С' },
                        role: this.role,
                        roomCode: this.roomCode
                    });
                }
            };

            const sendHandshake = () => {
                this.isConnected = true;
                this.send({
                    type: 'HANDSHAKE',
                    player: myInfo,
                    role: this.role
                });
            };

            if (this.conn.open) {
                sendHandshake();
            } else {
                this.conn.on('open', sendHandshake);
            }

            this.conn.on('data', (data) => {
                this.handleIncomingMessage(data, notifyConnected);
            });

            const currentConn = this.conn;

            this.conn.on('close', () => {
                if (this.conn !== currentConn) return;
                if (!this.isConnected) return;
                this.isConnected = false;
                if (typeof this.onOpponentLeft === 'function') {
                    this.onOpponentLeft();
                }
            });

            this.conn.on('error', (err) => {
                console.warn('[DuelNetwork] Connection error:', err);
            });
        }

        handleIncomingMessage(msg, onConnectedCallback) {
            if (!msg || !msg.type) return;

            switch (msg.type) {
                case 'HANDSHAKE': {
                    this.opponent = {
                        name: msg.player?.name || 'Друг',
                        avatar: msg.player?.avatar || 'Д',
                        isPhoto: Boolean(msg.player?.isPhoto),
                        lives: 3,
                        score: 0,
                        status: 'Готов'
                    };

                    this.send({
                        type: 'HANDSHAKE_ACK',
                        player: this.getMyPlayerInfo()
                    });

                    if (typeof onConnectedCallback === 'function') {
                        onConnectedCallback();
                    }
                    break;
                }

                case 'HANDSHAKE_ACK': {
                    if (msg.player) {
                        this.opponent = {
                            name: msg.player.name || 'Друг',
                            avatar: msg.player.avatar || 'Д',
                            isPhoto: Boolean(msg.player.isPhoto),
                            lives: 3,
                            score: 0,
                            status: 'Готов'
                        };
                    }
                    if (typeof onConnectedCallback === 'function') {
                        onConnectedCallback();
                    }
                    break;
                }

                case 'SYNC_WORDS': {
                    if (typeof this.onRoundSync === 'function') {
                        this.onRoundSync(msg.wordIds);
                    }
                    break;
                }

                case 'ANSWER': {
                    if (typeof this.onOpponentAnswer === 'function') {
                        this.onOpponentAnswer(msg);
                    }
                    break;
                }

                case 'REMATCH_OFFER': {
                    if (typeof this.onRematchRequested === 'function') {
                        this.onRematchRequested();
                    }
                    break;
                }

                case 'REMATCH_ACCEPT': {
                    if (typeof this.onRematchAccepted === 'function') {
                        this.onRematchAccepted(msg.wordIds);
                    }
                    break;
                }
            }
        }

        send(data) {
            if (this.role === 'simulated') return;
            if (this.conn && this.conn.open) {
                try {
                    this.conn.send(data);
                } catch (e) {
                    console.error('[DuelNetwork] Send error:', e);
                }
            } else if (this.conn) {
                this.conn.once('open', () => {
                    try {
                        this.conn.send(data);
                    } catch (e) {}
                });
            }
        }

        /**
         * Host broadcasts the synchronized word pool for this duel
         */
        syncWords(wordIds) {
            if (this.role === 'host') {
                this.send({
                    type: 'SYNC_WORDS',
                    wordIds: wordIds
                });
            }
        }

        /**
         * Sends player's answer status in real time
         */
        broadcastAnswer(roundIndex, isCorrect, livesLeft, score) {
            this.send({
                type: 'ANSWER',
                round: roundIndex,
                isCorrect: isCorrect,
                livesLeft: livesLeft,
                score: score
            });

            // If simulated opponent, schedule their response
            if (this.role === 'simulated') {
                this.scheduleSimulatedOpponentAnswer(roundIndex);
            }
        }

        /**
         * Simulates a live human opponent answering with human delay and realistic accuracy
         */
        scheduleSimulatedOpponentAnswer(roundIndex) {
            if (this.simulatedTimer) {
                clearTimeout(this.simulatedTimer);
            }

            // Natural delay: 2.2s to 5.2s
            const delay = 2200 + Math.random() * 3000;

            this.simulatedTimer = setTimeout(() => {
                if (!this.opponent || this.opponent.lives <= 0) return;

                // 82% accuracy
                const isCorrect = Math.random() < 0.82;
                if (isCorrect) {
                    this.opponent.score++;
                    this.opponent.status = 'Верно ✅';
                } else {
                    this.opponent.lives = Math.max(0, this.opponent.lives - 1);
                    this.opponent.status = 'Ошибка ❌';
                }

                if (typeof this.onOpponentAnswer === 'function') {
                    this.onOpponentAnswer({
                        round: roundIndex,
                        isCorrect: isCorrect,
                        livesLeft: this.opponent.lives,
                        score: this.opponent.score
                    });
                }
            }, delay);
        }

        /**
         * Proposes a rematch to the opponent
         */
        offerRematch() {
            if (this.role === 'simulated') {
                // Simulated rival accepts after 1.5 seconds
                setTimeout(() => {
                    if (typeof this.onRematchAccepted === 'function') {
                        this.onRematchAccepted(null);
                    }
                }, 1200);
                return;
            }
            this.send({ type: 'REMATCH_OFFER' });
        }

        /**
         * Accepts rematch offer
         */
        acceptRematch(newWordIds) {
            if (this.role === 'simulated') return;
            this.send({
                type: 'REMATCH_ACCEPT',
                wordIds: newWordIds
            });
        }
    }

    window.DuelNetwork = new DuelNetworkManager();
})();
