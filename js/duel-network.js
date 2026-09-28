/**
 * LezgiMez - Real-time Multiplayer Duel Network
 * High-reliability Server Room Relay engine hosted on https://caucasilan.alte.ca
 * Guarantees instant room joins (e.g. #4700), deterministic matchmaking,
 * cross-device synchronization, and zero cellular/NAT/CGNAT firewall blockage.
 */

(function () {
    'use strict';

    const API_ENDPOINT = '/api/presence.php';
    const MATCHMAKING_TIMEOUT_MS = 12000;

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
            this.role = null; // 'host' | 'guest' | 'simulated'
            this.roomCode = null;
            this.opponent = null; // { name, avatar, lives, score, status }
            this.isConnected = false;
            this.lastEventId = 0;
            this.roomPollTimer = null;
            this.matchPollTimer = null;
            this.matchmakingTimeout = null;
            this.simulatedTimer = null;
            this.lastSyncedWords = null;
            this.joinedNotified = false;
            this.onJoinedCallback = null;

            // Callbacks
            this.onReady = null;
            this.onOpponentAnswer = null;
            this._onRoundSync = null;
            this.onOpponentLeft = null;
            this.onRematchRequested = null;
            this.onRematchAccepted = null;

            // Network reliability & Anti-desync
            this.isPolling = false;
            this.isMatchPolling = false;
            this.processedEventIds = new Set();
            this.pendingSendQueue = [];
            this.isSending = false;
            this.hasRematchOffer = false;
            this.pendingRematchWords = null;

            this.setupLifecycleHandlers();
        }

        get onRoundSync() {
            return this._onRoundSync;
        }

        set onRoundSync(fn) {
            this._onRoundSync = fn;
            if (typeof fn === 'function' && Array.isArray(this.lastSyncedWords) && this.lastSyncedWords.length > 0) {
                try { fn(this.lastSyncedWords); } catch (e) {}
            }
        }

        generateRoomCode() {
            // 4-digit readable numeric code
            return String(Math.floor(1000 + Math.random() * 9000));
        }

        getClientId() {
            return window.OnlinePresence?._clientId || ('u_' + Math.random().toString(36).slice(2, 10));
        }

        getMyPlayerInfo() {
            const tgUser = window.TelegramApp?.getUser?.();
            const name = tgUser 
                ? ([tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Игрок')
                : (localStorage.getItem('lezgimez_player_name') || 'Игрок');
            const avatar = tgUser?.photo_url || (name.charAt(0).toUpperCase());
            return { name, avatar, isPhoto: Boolean(tgUser?.photo_url) };
        }

        setupLifecycleHandlers() {
            if (typeof window === 'undefined') return;
            const handleLeave = () => {
                if (this.roomCode && this.isConnected && this.role !== 'simulated') {
                    this.sendRoomLeave();
                }
            };
            window.addEventListener('beforeunload', handleLeave);
            window.addEventListener('pagehide', handleLeave);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    if (this.roomCode && this.isConnected && this.role !== 'simulated') {
                        this.pollImmediate();
                    }
                }
            });
        }

        cleanup() {
            if (this.roomCode && this.role !== 'simulated') {
                this.sendRoomLeave();
            }
            this.cancelServerMatch();

            if (typeof window !== 'undefined' && window.OnlinePresence) {
                window.OnlinePresence.setSearching(false);
            }
            if (this.simulatedTimer) {
                clearTimeout(this.simulatedTimer);
                this.simulatedTimer = null;
            }
            if (this.matchmakingTimeout) {
                clearTimeout(this.matchmakingTimeout);
                this.matchmakingTimeout = null;
            }
            if (this.matchPollTimer) {
                clearInterval(this.matchPollTimer);
                this.matchPollTimer = null;
            }
            if (this.roomPollTimer) {
                clearInterval(this.roomPollTimer);
                this.roomPollTimer = null;
            }

            this.role = null;
            this.roomCode = null;
            this.opponent = null;
            this.isConnected = false;
            this.lastEventId = 0;
            this.lastSyncedWords = null;
            this.joinedNotified = false;
            this.onJoinedCallback = null;
            this.isPolling = false;
            this.isMatchPolling = false;
            this.processedEventIds.clear();
            this.pendingSendQueue = [];
            this.isSending = false;
            this.hasRematchOffer = false;
            this.pendingRematchWords = null;
        }

        cancelServerMatch() {
            const clientId = this.getClientId();
            if (!clientId) return;
            try {
                const payload = JSON.stringify({ action: 'match_cancel', id: clientId });
                if (navigator.sendBeacon) {
                    const blob = new Blob([payload], { type: 'application/json' });
                    navigator.sendBeacon(API_ENDPOINT, blob);
                } else {
                    fetch(API_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: payload,
                        keepalive: true
                    }).catch(() => {});
                }
            } catch (e) {}
        }

        sendRoomLeave() {
            const clientId = this.getClientId();
            const roomCode = this.roomCode;
            if (!clientId || !roomCode) return;
            try {
                const payload = JSON.stringify({ action: 'room_leave', roomCode, id: clientId });
                if (navigator.sendBeacon) {
                    const blob = new Blob([payload], { type: 'application/json' });
                    navigator.sendBeacon(API_ENDPOINT, blob);
                } else {
                    fetch(API_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: payload,
                        keepalive: true
                    }).catch(() => {});
                }
            } catch (e) {}
        }

        /**
         * Host creates a room with code (e.g. 4700) and waits for a friend
         */
        async createRoom(roomCode, onWaiting, onJoined, onError) {
            this.cleanup();
            this.role = 'host';
            this.roomCode = String(roomCode || this.generateRoomCode()).trim().toUpperCase();
            this.onJoinedCallback = onJoined;
            const clientId = this.getClientId();
            const myInfo = this.getMyPlayerInfo();

            try {
                const res = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'room_create',
                        roomCode: this.roomCode,
                        id: clientId,
                        player: myInfo
                    })
                });

                if (!res.ok) throw new Error('HTTP error ' + res.status);
                const data = await res.json();

                if (!data.ok) {
                    if (typeof onError === 'function') onError(data.error || 'Ошибка создания комнаты');
                    return;
                }

                if (typeof onWaiting === 'function') {
                    onWaiting(this.roomCode);
                }

                // Start polling room to see when friend joins
                this.startRoomPolling();
            } catch (err) {
                console.error('[DuelNetwork] createRoom error:', err);
                if (typeof onError === 'function') onError(err);
            }
        }

        /**
         * Guest joins room by 4-digit code (e.g. 4700)
         */
        async joinRoom(roomCode, onConnecting, onJoined, onError) {
            this.cleanup();
            this.role = 'guest';
            this.roomCode = String(roomCode).trim().toUpperCase();
            this.onJoinedCallback = onJoined;
            const clientId = this.getClientId();
            const myInfo = this.getMyPlayerInfo();

            if (typeof onConnecting === 'function') {
                onConnecting();
            }

            try {
                const res = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'room_join',
                        roomCode: this.roomCode,
                        id: clientId,
                        player: myInfo
                    })
                });

                if (!res.ok) throw new Error('HTTP error ' + res.status);
                const data = await res.json();

                if (!data.ok) {
                    if (typeof onError === 'function') onError(data.error || 'Комната не найдена');
                    return;
                }

                this.opponent = {
                    name: data.opponent?.name || 'Друг',
                    avatar: data.opponent?.avatar || 'Д',
                    isPhoto: Boolean(data.opponent?.isPhoto),
                    lives: 3,
                    score: 0,
                    status: 'В сети'
                };
                this.isConnected = true;
                this.joinedNotified = true;

                // Start room polling
                this.startRoomPolling();

                if (typeof onJoined === 'function') {
                    onJoined({
                        opponent: this.opponent,
                        role: 'guest',
                        roomCode: this.roomCode
                    });
                }
            } catch (err) {
                console.error('[DuelNetwork] joinRoom error:', err);
                if (typeof onError === 'function') onError(err);
            }
        }

        /**
         * Random matchmaking: deterministic server coordinator pairs players instantly
         */
        async startMatchmaking(onSearching, onMatched, onNoMatch, onError) {
            this.cleanup();
            if (typeof window !== 'undefined' && window.OnlinePresence) {
                window.OnlinePresence.setSearching(true);
            }
            if (typeof onSearching === 'function') {
                onSearching('Ищем свободного игрока в сети...');
            }

            const clientId = this.getClientId();
            const myInfo = this.getMyPlayerInfo();
            let matched = false;

            const handleMatchedSuccess = (roomCode, role, opponentInfo) => {
                if (matched) return;
                matched = true;
                if (this.matchPollTimer) {
                    clearInterval(this.matchPollTimer);
                    this.matchPollTimer = null;
                }
                if (this.matchmakingTimeout) {
                    clearTimeout(this.matchmakingTimeout);
                    this.matchmakingTimeout = null;
                }
                if (typeof window !== 'undefined' && window.OnlinePresence) {
                    window.OnlinePresence.setSearching(false);
                }

                this.role = role;
                this.roomCode = roomCode;
                this.opponent = {
                    name: opponentInfo?.name || 'Соперник',
                    avatar: opponentInfo?.avatar || 'С',
                    isPhoto: Boolean(opponentInfo?.isPhoto),
                    lives: 3,
                    score: 0,
                    status: 'В сети'
                };
                this.isConnected = true;
                this.joinedNotified = true;

                if (typeof onSearching === 'function') {
                    onSearching(`Соперник найден: ${this.opponent.name}! Начало дуэли...`);
                }

                // Start polling room events
                this.startRoomPolling();

                if (typeof onMatched === 'function') {
                    onMatched({
                        opponent: this.opponent,
                        role: this.role,
                        roomCode: this.roomCode
                    });
                }
            };

            // Timeout fallback: honest option to wait or play with AI
            this.matchmakingTimeout = setTimeout(() => {
                if (!matched) {
                    if (typeof onNoMatch === 'function') {
                        onNoMatch({
                            keepWaiting: (statusMsg) => {
                                if (typeof onSearching === 'function') {
                                    onSearching(statusMsg || 'Ожидание подключения соперника...');
                                }
                                this.matchmakingTimeout = setTimeout(() => {
                                    if (!matched && typeof onNoMatch === 'function') {
                                        onNoMatch({
                                            keepWaiting: () => {},
                                            playAi: () => {
                                                this.cleanup();
                                                this.startSimulatedMatch(onMatched);
                                            }
                                        });
                                    }
                                }, MATCHMAKING_TIMEOUT_MS);
                            },
                            playAi: () => {
                                this.cleanup();
                                this.startSimulatedMatch(onMatched);
                            }
                        });
                    } else {
                        this.startSimulatedMatch(onMatched);
                    }
                }
            }, MATCHMAKING_TIMEOUT_MS);

            try {
                const res = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'match_join',
                        id: clientId,
                        player: myInfo
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data && data.matched && data.roomCode) {
                        handleMatchedSuccess(data.roomCode, data.role || 'guest', data.opponent);
                        return;
                    }
                }

                // Not matched yet -> poll every 600ms with in-flight guard
                this.matchPollTimer = setInterval(async () => {
                    if (matched || this.isMatchPolling) {
                        if (matched) clearInterval(this.matchPollTimer);
                        return;
                    }
                    this.isMatchPolling = true;
                    try {
                        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                        const timeoutId = controller ? setTimeout(() => controller.abort(), 3000) : null;
                        const pollRes = await fetch(API_ENDPOINT, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'match_poll',
                                id: clientId
                            }),
                            signal: controller ? controller.signal : undefined
                        });
                        if (timeoutId) clearTimeout(timeoutId);
                        if (pollRes.ok) {
                            const pollData = await pollRes.json();
                            if (pollData && pollData.matched && pollData.roomCode) {
                                handleMatchedSuccess(pollData.roomCode, pollData.role || 'host', pollData.opponent);
                            }
                        }
                    } catch (e) {
                    } finally {
                        this.isMatchPolling = false;
                    }
                }, 600);

            } catch (err) {
                console.error('[DuelNetwork] Matchmaking error:', err);
                if (!matched) {
                    if (typeof onNoMatch === 'function') {
                        onNoMatch({
                            keepWaiting: () => {},
                            playAi: () => this.startSimulatedMatch(onMatched)
                        });
                    } else if (typeof onError === 'function') {
                        onError(err);
                    }
                }
            }
        }

        /**
         * Immediate poll on tab activation / visibility change
         */
        async pollImmediate() {
            if (!this.roomCode || this.isPolling) return;
            this.isPolling = true;
            const clientId = this.getClientId();
            try {
                const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                const timeoutId = controller ? setTimeout(() => controller.abort(), 2800) : null;
                const res = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'room_poll',
                        roomCode: this.roomCode,
                        id: clientId,
                        since: this.lastEventId
                    }),
                    signal: controller ? controller.signal : undefined
                });
                if (timeoutId) clearTimeout(timeoutId);
                if (res.ok) {
                    const data = await res.json();
                    this.processPollData(data);
                }
            } catch (e) {
            } finally {
                this.isPolling = false;
            }
        }

        /**
         * Room polling loop: lightweight HTTP poll every 500ms with in-flight guard & deduplication
         */
        startRoomPolling() {
            if (this.roomPollTimer) clearInterval(this.roomPollTimer);
            const clientId = this.getClientId();

            this.roomPollTimer = setInterval(async () => {
                if (!this.roomCode) {
                    clearInterval(this.roomPollTimer);
                    return;
                }
                if (this.isPolling) return;
                this.isPolling = true;

                try {
                    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                    const timeoutId = controller ? setTimeout(() => controller.abort(), 2800) : null;

                    const res = await fetch(API_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'room_poll',
                            roomCode: this.roomCode,
                            id: clientId,
                            since: this.lastEventId
                        }),
                        signal: controller ? controller.signal : undefined
                    });
                    if (timeoutId) clearTimeout(timeoutId);

                    if (res.ok) {
                        const data = await res.json();
                        this.processPollData(data);
                    }
                } catch (e) {
                } finally {
                    this.isPolling = false;
                }
            }, 500);
        }

        processPollData(data) {
            if (!data || !data.ok) return;

            if (data.lastId && data.lastId > this.lastEventId) {
                this.lastEventId = data.lastId;
            }

            // If host was waiting and guest joined
            if (this.role === 'host' && data.opponent && !this.joinedNotified) {
                this.opponent = {
                    name: data.opponent.name || 'Друг',
                    avatar: data.opponent.avatar || 'Д',
                    isPhoto: Boolean(data.opponent.isPhoto),
                    lives: 3,
                    score: 0,
                    status: 'В сети'
                };
                this.isConnected = true;
                this.joinedNotified = true;

                if (typeof this.onJoinedCallback === 'function') {
                    this.onJoinedCallback({
                        opponent: this.opponent,
                        role: 'host',
                        roomCode: this.roomCode
                    });
                }
            }

            // Process incoming events with deduplication
            if (Array.isArray(data.events)) {
                for (const ev of data.events) {
                    if (ev.id) {
                        if (this.processedEventIds.has(ev.id)) continue;
                        this.processedEventIds.add(ev.id);
                    }
                    if (ev.data) {
                        this.handleIncomingMessage(ev.data);
                    }
                }
            }

            // Opponent left
            if (data.opponentLeft && this.isConnected) {
                this.isConnected = false;
                if (typeof this.onOpponentLeft === 'function') {
                    this.onOpponentLeft();
                }
            }
        }

        handleIncomingMessage(msg) {
            if (!msg || !msg.type) return;

            switch (msg.type) {
                case 'GUEST_JOINED': {
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
                    if (this.onJoinedCallback && !this.joinedNotified) {
                        this.joinedNotified = true;
                        this.isConnected = true;
                        this.onJoinedCallback({
                            opponent: this.opponent,
                            role: this.role,
                            roomCode: this.roomCode
                        });
                    }
                    break;
                }

                case 'SYNC_WORDS': {
                    this.lastSyncedWords = msg.wordIds;
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
                    this.hasRematchOffer = true;
                    this.pendingRematchWords = msg.wordIds || null;
                    if (typeof this.onRematchRequested === 'function') {
                        this.onRematchRequested();
                    }
                    break;
                }

                case 'REMATCH_ACCEPT': {
                    this.hasRematchOffer = false;
                    this.pendingRematchWords = null;
                    this.lastEventId = 0;
                    this.processedEventIds.clear();
                    if (typeof this.onRematchAccepted === 'function') {
                        this.onRematchAccepted(msg.wordIds);
                    }
                    break;
                }

                case 'OPPONENT_LEFT': {
                    if (typeof this.onOpponentLeft === 'function') {
                        this.onOpponentLeft();
                    }
                    break;
                }
            }
        }

        /**
         * Sends message to the room through server relay with retry queue
         */
        send(data) {
            if (this.role === 'simulated') return;
            if (!this.roomCode) return;

            this.pendingSendQueue.push(data);
            this.flushSendQueue();
        }

        async flushSendQueue() {
            if (this.isSending || this.pendingSendQueue.length === 0) return;
            this.isSending = true;

            const clientId = this.getClientId();
            while (this.pendingSendQueue.length > 0) {
                const item = this.pendingSendQueue[0];
                let sent = false;

                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                        const timeoutId = controller ? setTimeout(() => controller.abort(), 2800) : null;

                        const res = await fetch(API_ENDPOINT, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'room_send',
                                roomCode: this.roomCode,
                                id: clientId,
                                data: item
                            }),
                            signal: controller ? controller.signal : undefined
                        });
                        if (timeoutId) clearTimeout(timeoutId);

                        if (res.ok) {
                            const respData = await res.json();
                            if (respData && respData.ok) {
                                sent = true;
                                break;
                            }
                        }
                    } catch (err) {
                        console.warn('[DuelNetwork] send retry error:', err);
                    }
                    await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
                }

                this.pendingSendQueue.shift();
                if (!sent) {
                    console.warn('[DuelNetwork] packet failed after 3 retries:', item);
                }
            }

            this.isSending = false;
        }

        /**
         * Host synchronizes the word pool for this duel
         */
        syncWords(wordIds) {
            this.lastSyncedWords = wordIds;
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

            if (this.role === 'simulated') {
                this.scheduleSimulatedOpponentAnswer(roundIndex);
            }
        }

        /**
         * Local simulated bot mode
         */
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
                status: 'ИИ-соперник',
                isSimulated: true
            };

            if (typeof onMatched === 'function') {
                onMatched({
                    opponent: this.opponent,
                    role: this.role,
                    roomCode: 'AI',
                    isSimulated: true
                });
            }
        }

        scheduleSimulatedOpponentAnswer(roundIndex) {
            if (this.simulatedTimer) {
                clearTimeout(this.simulatedTimer);
            }

            const delay = 1800 + Math.random() * Math.random() * 4200;

            this.simulatedTimer = setTimeout(() => {
                if (!this.opponent || this.opponent.lives <= 0) return;

                const accuracy = 0.70 + Math.random() * 0.18;
                const isCorrect = Math.random() < accuracy;
                if (isCorrect) {
                    this.opponent.score++;
                    this.opponent.status = 'Ответил верно ✅';
                } else {
                    this.opponent.lives = Math.max(0, this.opponent.lives - 1);
                    this.opponent.status = 'Допустил ошибку ❌';
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

        offerRematch() {
            if (this.role === 'simulated') {
                setTimeout(() => {
                    if (typeof this.onRematchAccepted === 'function') {
                        this.onRematchAccepted(null);
                    }
                }, 1200);
                return;
            }
            let wordIds = null;
            if (this.role === 'host' && typeof WORDS !== 'undefined' && Array.isArray(WORDS) && typeof shuffle === 'function') {
                wordIds = shuffle([...WORDS]).slice(0, 20).map(w => w.id);
            }
            this.send({ type: 'REMATCH_OFFER', wordIds: wordIds });
        }

        acceptRematch(newWordIds) {
            if (this.role === 'simulated') {
                if (typeof this.onRematchAccepted === 'function') {
                    this.onRematchAccepted(null);
                }
                return;
            }
            this.hasRematchOffer = false;
            this.lastEventId = 0;
            this.processedEventIds.clear();
            const finalWordIds = this.pendingRematchWords || newWordIds || null;
            this.pendingRematchWords = null;
            this.send({
                type: 'REMATCH_ACCEPT',
                wordIds: finalWordIds
            });
        }

        getOnlineStats() {
            return {
                online: OnlinePresence.getCount(),
                searching: OnlinePresence.getSearching()
            };
        }
    }

    /**
     * Real Online Presence Tracker
     */
    const OnlinePresence = {
        _clientId: null,
        _count: 1,
        _searching: 0,
        _isSearching: false,
        _serverActive: false,
        _localTabs: new Map(),
        _bc: null,
        _heartbeatTimer: null,

        init() {
            try {
                this._clientId = sessionStorage.getItem('lzg_presence_id');
                if (!this._clientId) {
                    this._clientId = 'u_' + Math.random().toString(36).slice(2, 10);
                    sessionStorage.setItem('lzg_presence_id', this._clientId);
                }
            } catch (e) {
                this._clientId = 'u_' + Math.random().toString(36).slice(2, 10);
            }

            this.setupBroadcastChannel();
            this.sendHeartbeat();

            if (!this._heartbeatTimer) {
                this._heartbeatTimer = setInterval(() => {
                    this.sendHeartbeat();
                }, 5500);
            }

            if (typeof window !== 'undefined') {
                window.addEventListener('beforeunload', () => this.sendBye());
                window.addEventListener('focus', () => this.sendHeartbeat());
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') this.sendHeartbeat();
                });
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => this.updateUI(), { once: true });
                }
            }
        },

        setupBroadcastChannel() {
            if (typeof BroadcastChannel === 'undefined') return;
            try {
                this._bc = new BroadcastChannel('lezgi_presence_channel');
                this._bc.onmessage = (e) => {
                    const msg = e.data;
                    if (!msg || !msg.id || msg.id === this._clientId) return;

                    if (msg.type === 'bye') {
                        this._localTabs.delete(msg.id);
                        this.recalcLocal();
                        return;
                    }

                    if (msg.type === 'ping') {
                        this._localTabs.set(msg.id, {
                            time: Date.now(),
                            searching: Boolean(msg.searching)
                        });
                        this.recalcLocal();
                    }
                };
            } catch (e) {}
        },

        setSearching(val) {
            this._isSearching = Boolean(val);
            this.sendHeartbeat();
        },

        async sendHeartbeat() {
            const now = Date.now();

            if (this._bc) {
                try {
                    this._bc.postMessage({
                        type: 'ping',
                        id: this._clientId,
                        searching: this._isSearching,
                        time: now
                    });
                } catch (e) {}
            }

            for (const [id, data] of this._localTabs.entries()) {
                if (now - data.time > 12000) {
                    this._localTabs.delete(id);
                }
            }

            try {
                const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                const timeoutId = controller ? setTimeout(() => controller.abort(), 2000) : null;

                const res = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: this._clientId,
                        searching: this._isSearching ? 1 : 0
                    }),
                    signal: controller ? controller.signal : undefined
                });

                if (timeoutId) clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data && data.ok) {
                        this._serverActive = true;
                        this._count = Math.max(1, Number(data.online) || 1);
                        this._searching = Math.max(0, Number(data.searching) || 0);
                        this.updateUI();
                        return;
                    }
                }
            } catch (err) {}

            this._serverActive = false;
            this.recalcLocal();
        },

        sendBye() {
            if (this._bc) {
                try {
                    this._bc.postMessage({ type: 'bye', id: this._clientId });
                } catch (e) {}
            }

            try {
                const payload = JSON.stringify({ action: 'presence', id: this._clientId, bye: 1 });
                if (navigator.sendBeacon) {
                    const blob = new Blob([payload], { type: 'application/json' });
                    navigator.sendBeacon(API_ENDPOINT, blob);
                }
            } catch (e) {}
        },

        recalcLocal() {
            if (this._serverActive) return;

            let localCount = 1;
            let searchingCount = this._isSearching ? 1 : 0;

            for (const info of this._localTabs.values()) {
                localCount++;
                if (info.searching) searchingCount++;
            }

            this._count = localCount;
            this._searching = searchingCount;
            this.updateUI();
        },

        getCount() {
            return Math.max(1, this._count || 1);
        },

        getSearching() {
            return Math.max(0, this._searching || 0);
        },

        updateUI() {
            const count = this.getCount();
            const searching = this.getSearching();

            const countPlural = typeof pluralize === 'function'
                ? pluralize(count, 'игрок онлайн', 'игрока онлайн', 'игроков онлайн')
                : `${count} онлайн`;
            const inNetworkPlural = count === 1 ? '1 в сети (вы)' : `${count} в сети`;
            const headerPlural = count === 1 ? '1 онлайн (вы)' : `${count} онлайн`;
            const searchingPlural = searching === 0
                ? '0 в поиске'
                : (typeof pluralize === 'function'
                    ? pluralize(searching, 'ищет пару', 'ищут пару', 'ищут пару')
                    : `${searching} в поиске`);

            document.querySelectorAll('.duel-online-count-text').forEach(el => {
                el.textContent = inNetworkPlural;
            });
            document.querySelectorAll('.duel-online-badge-text').forEach(el => {
                el.textContent = count === 1 ? '1 игрок в сети (вы)' : countPlural;
            });
            document.querySelectorAll('.duel-online-header-text').forEach(el => {
                el.textContent = headerPlural;
            });
            document.querySelectorAll('.duel-online-searching-text').forEach(el => {
                el.textContent = searchingPlural;
            });
            document.querySelectorAll('.duel-online-count-number').forEach(el => {
                el.textContent = String(count);
            });
            document.querySelectorAll('.duel-online-searching-number').forEach(el => {
                el.textContent = String(searching);
            });
        }
    };

    OnlinePresence.init();

    window.OnlinePresence = OnlinePresence;
    window.DuelNetwork = new DuelNetworkManager();
})();
