        // Global state
        let WORDS = [];
        let GRAMMAR = [];
        let COURSE = [];
        let COURSE_PROGRESS = { completedUnits: [], scores: {}, currentUnit: null };
        let courseExState = null; // state for course exercise session
        const APP_VERSION = '2.2.11-beta';
        const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.search.includes('debug=1');
        const log = (...args) => { if (DEBUG) console.log(...args); };
        const warn = (...args) => { if (DEBUG) console.warn(...args); };
        const ALPHABET_AUDIO_FILES = [
            'а', 'б', 'в', 'г', 'гъ', 'гь', 'д', 'е', 'ж', 'з', 'и', 'й',
            'к', 'к1', 'къ', 'кь', 'л', 'м', 'н', 'п', 'п1', 'р', 'с', 'т',
            'т1', 'у', 'уь', 'ф', 'х', 'хъ', 'хь', 'ц', 'ц1', 'ч', 'ч1',
            'ш', 'э', 'ю', 'я'
        ];
        let currentTab = 'alphabet';
        const PAGE_SIZE = window.innerWidth >= 768 ? 50 : 20;
        let loadedCount = 0;
        let currentFilter = { search: '', category: 'all' };
        let practiceCategory = 'all';
        const SCHEMA_VERSION = 1;
        let deferredPrompt = null;
        let tabSwitchGuard = false;
        let isClosingProgrammatically = false;

        const NICE_CATEGORY_NAMES = {
            'анатомия': 'Анатомия', 'быт': 'Быт', 'война': 'Война', 'время': 'Время', 'глаголы': 'Глаголы',
            'еда': 'Еда', 'животные': 'Животные', 'здоровье': 'Здоровье', 'искусство': 'Искусство',
            'качество': 'Качество', 'люди': 'Люди', 'материалы': 'Материалы', 'мера': 'Мера',
            'места': 'Места', 'местоим.': 'Местоимения', 'наречия': 'Наречия', 'обучение': 'Обучение',
            'общее': 'Общее', 'общение': 'Общение', 'одежда': 'Одежда', 'ощущения': 'Ощущения',
            'понятия': 'Понятия', 'предметы': 'Предметы', 'природа': 'Природа', 'работа': 'Работа',
            'религия': 'Религия', 'семья': 'Семья', 'события': 'События', 'спорт': 'Спорт',
            'тело': 'Тело', 'торговля': 'Торговля', 'транспорт': 'Транспорт', 'фразы': 'Фразы',
            'цвета': 'Цвета', 'числа': 'Числа', 'эмоции': 'Эмоции'
        };

        // IndexedDB Helper to sync with Service Worker
        async function syncNotifToIDB(enabled) {
            return new Promise((resolve) => {
                const request = indexedDB.open('lezgi_db', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('config');
                request.onsuccess = () => {
                    const db = request.result;
                    const tx = db.transaction('config', 'readwrite');
                    const store = tx.objectStore('config');
                    store.put(enabled, 'notif_enabled');
                    store.put('3', 'notif_interval');
                    tx.oncomplete = () => resolve();
                };
            });
        }

        function supportsNotifications() {
            return typeof window !== 'undefined' && 'Notification' in window;
        }

        async function registerPeriodicReminder() {
            if (!('serviceWorker' in navigator)) return false;
            try {
                const registration = await navigator.serviceWorker.ready;
                if (!('periodicSync' in registration)) return false;
                if (!('permissions' in navigator) || !navigator.permissions.query) return false;
                const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
                if (status.state !== 'granted') return false;
                await registration.periodicSync.register('daily-reminder', { minInterval: 3 * 60 * 60 * 1000 });
                return true;
            } catch (e) {
                warn('[PWA] Periodic sync unavailable', e);
                return false;
            }
        }

        function updateNotifUI() {
            const bell = document.getElementById('notif-bell-icon');
            const statusText = document.getElementById('notif-status-text');
            if (!bell || !statusText) return;

            if (!supportsNotifications()) {
                bell.className = 'fa-solid fa-bell-slash w-5 text-center text-slate-400 transition-colors duration-200';
                statusText.textContent = 'Не поддерживаются этим браузером';
                return;
            }

            if (Notification.permission === 'denied') {
                bell.className = 'fa-solid fa-bell-slash w-5 text-center text-red-600 transition-colors duration-200';
                statusText.textContent = 'Запрещено в настройках браузера';
                return;
            }

            const isEnabled = localStorage.getItem('lezgi_notif_enabled') === '1';

            if (isEnabled && Notification.permission === 'granted') {
                bell.className = 'fa-solid fa-bell w-5 text-center text-emerald-600 transition-colors duration-200';
                statusText.textContent = 'Включены';
            } else {
                bell.className = 'fa-regular fa-bell w-5 text-center text-slate-400 transition-colors duration-200';
                statusText.textContent = 'Выключены';
            }
        }

        async function requestNotificationPermission() {
            if (!supportsNotifications()) {
                alert('Этот браузер не поддерживает уведомления.');
                updateNotifUI();
                return;
            }
            const permission = await Notification.requestPermission();
            localStorage.setItem('lezgi_notif_asked', '1');
            dismissNotifBanner();

            if (permission === 'granted') {
                localStorage.setItem('lezgi_notif_enabled', '1');
                await syncNotifToIDB('1');
                await registerPeriodicReminder();
            }
            updateNotifUI();
        }

        async function toggleNotifications() {
            if (!supportsNotifications()) {
                updateNotifUI();
                return;
            }
            if (Notification.permission === 'default') {
                await requestNotificationPermission();
            } else if (Notification.permission === 'granted') {
                const newState = localStorage.getItem('lezgi_notif_enabled') === '1' ? '0' : '1';
                localStorage.setItem('lezgi_notif_enabled', newState);
                await syncNotifToIDB(newState);
                if (newState === '1') await registerPeriodicReminder();
                updateNotifUI();
            }
        }

        function dismissNotifBanner() {
            const banner = document.getElementById('notif-banner');
            if (banner) banner.classList.add('hidden');
            localStorage.setItem('lezgi_notif_asked', '1');
        }

        let PROGRESS = {
            favorites: [],
            learned: [],
            stats: { quizzes: 0, scoreSum: 0 },
            srs: {},
            streak: { current: 1, lastDate: null, max: 1 }
        };

        function getTodayDateStr() {
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function getYesterdayDateStr() {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function checkAndUpdateStreak(forceAction = false) {
            if (!PROGRESS.streak || typeof PROGRESS.streak !== 'object') {
                PROGRESS.streak = { current: 1, lastDate: null, max: 1 };
            }
            const today = getTodayDateStr();
            const yesterday = getYesterdayDateStr();

            if (forceAction) {
                if (PROGRESS.streak.lastDate === today) {
                    // Already counted today
                } else if (PROGRESS.streak.lastDate === yesterday) {
                    PROGRESS.streak.current = (PROGRESS.streak.current || 0) + 1;
                    PROGRESS.streak.max = Math.max(PROGRESS.streak.max || 1, PROGRESS.streak.current);
                    PROGRESS.streak.lastDate = today;
                    saveProgress(true);
                } else {
                    PROGRESS.streak.current = 1;
                    PROGRESS.streak.max = Math.max(PROGRESS.streak.max || 1, 1);
                    PROGRESS.streak.lastDate = today;
                    saveProgress(true);
                }
            } else {
                // Background check: if last activity was before yesterday, reset current to 0 until next action
                if (PROGRESS.streak.lastDate && PROGRESS.streak.lastDate !== today && PROGRESS.streak.lastDate !== yesterday) {
                    PROGRESS.streak.current = 0;
                }
            }

            if (window.TelegramApp?.renderProfileCard) {
                window.TelegramApp.renderProfileCard();
            }
            if (typeof updatePracticeStreakUI === 'function') {
                updatePracticeStreakUI();
            }
        }

        function getProgressStorageKey() {
            const user = window.TelegramApp?.getUser?.();
            const userId = user?.id ? String(user.id) : null;
            return userId ? `lezgi_progress_${userId}` : 'lezgi_progress';
        }

        function getCourseStorageKey() {
            const user = window.TelegramApp?.getUser?.();
            const userId = user?.id ? String(user.id) : null;
            return userId ? `lezgi_course_progress_${userId}` : 'lezgi_course_progress';
        }

        let saveProgressTimeout = null;
        function saveProgress(immediate = false) {
            clearTimeout(saveProgressTimeout);
            const save = () => {
                const key = getProgressStorageKey();
                const json = JSON.stringify(PROGRESS);
                localStorage.setItem(key, json);
                localStorage.setItem('lezgi_progress', json);
                updateStatsUI();

                if (window.TelegramApp?.setCloudItem) {
                    window.TelegramApp.setCloudItem('lezgi_progress', json);
                }
            };
            if (immediate) save();
            else saveProgressTimeout = setTimeout(save, 1500);
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') saveProgress(true);
        });

        function exportProgress() {
            const blob = new Blob([JSON.stringify(PROGRESS, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `lezgi-progress-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        }

        function validateProgressData(data) {
            if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
            if (!Array.isArray(data.favorites) || !Array.isArray(data.learned)) return false;
            if (!data.favorites.every(id => typeof id === 'string' && id.length <= 120)) return false;
            if (!data.learned.every(id => typeof id === 'string' && id.length <= 120)) return false;
            if (data.favorites.length > 10000 || data.learned.length > 10000) return false;

            if (data.stats !== undefined) {
                if (!data.stats || typeof data.stats !== 'object' || Array.isArray(data.stats)) return false;
                const { quizzes, scoreSum } = data.stats;
                if (typeof quizzes !== 'number' || typeof scoreSum !== 'number') return false;
                if (!Number.isFinite(quizzes) || !Number.isFinite(scoreSum)) return false;
                if (quizzes < 0 || scoreSum < 0 || quizzes > 100000 || scoreSum > 10000000) return false;
            }

            if (data.streak !== undefined && data.streak !== null) {
                if (typeof data.streak !== 'object' || Array.isArray(data.streak)) return false;
            }

            if (data.srs !== undefined) {
                if (!data.srs || typeof data.srs !== 'object' || Array.isArray(data.srs)) return false;
                if (Object.keys(data.srs).length > 20000) return false;
                for (const key in data.srs) {
                    if (typeof key !== 'string' || key.length > 120) return false;
                    const val = data.srs[key];
                    if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
                    const numeric = ['next', 'last', 'ivl', 'success', 'errors'];
                    for (const field of numeric) {
                        if (typeof val[field] !== 'number' || !Number.isFinite(val[field])) return false;
                    }
                    if (val.ease !== undefined && (typeof val.ease !== 'number' || !Number.isFinite(val.ease))) return false;
                    if (val.ivl < 0 || val.ivl > 3650 || val.success < 0 || val.errors < 0) return false;
                }
            }
            return true;
        }

        function knownWordIds() {
            return new Set((WORDS || []).map(w => w.id));
        }

        function normalizeProgress(data) {
            const def = { favorites: [], learned: [], stats: { quizzes: 0, scoreSum: 0 }, srs: {}, streak: { current: 1, lastDate: null, max: 1 } };
            if (!data || typeof data !== 'object' || Array.isArray(data)) return def;
            const ids = knownWordIds();
            const filterIds = (arr) => Array.from(new Set((Array.isArray(arr) ? arr : [])
                .filter(id => typeof id === 'string' && id.length <= 120)
                .filter(id => ids.size === 0 || ids.has(id))));

            const srs = {};
            const rawSrs = (data.srs && typeof data.srs === 'object' && !Array.isArray(data.srs)) ? data.srs : {};
            for (const [id, card] of Object.entries(rawSrs)) {
                if (ids.size && !ids.has(id)) continue;
                if (!card || typeof card !== 'object' || Array.isArray(card)) continue;
                const next = Number(card.next || 0);
                const last = Number(card.last || 0);
                const ivl = Math.max(0, Math.min(3650, Number(card.ivl || 0)));
                const success = Math.max(0, Math.min(100000, Number(card.success || 0)));
                const errors = Math.max(0, Math.min(100000, Number(card.errors || 0)));
                const ease = Math.max(1.3, Math.min(3.2, Number(card.ease || 2.5)));
                if ([next, last, ivl, success, errors, ease].every(Number.isFinite)) {
                    srs[id] = { next, last, ivl, success, errors, ease };
                }
            }

            const rawStreak = (data.streak && typeof data.streak === 'object' && !Array.isArray(data.streak)) ? data.streak : {};
            const streakCurrent = Math.max(0, Math.min(3650, Number(rawStreak.current || 1)));
            const streakMax = Math.max(streakCurrent, Math.min(3650, Number(rawStreak.max || streakCurrent)));
            const streakLastDate = typeof rawStreak.lastDate === 'string' ? rawStreak.lastDate : null;

            return {
                favorites: filterIds(data.favorites),
                learned: filterIds(data.learned),
                stats: {
                    quizzes: Math.max(0, Math.min(100000, Number(data.stats?.quizzes || 0))),
                    scoreSum: Math.max(0, Math.min(10000000, Number(data.stats?.scoreSum || 0)))
                },
                srs,
                streak: {
                    current: streakCurrent,
                    max: streakMax,
                    lastDate: streakLastDate
                }
            };
        }

        function importProgress(file) {
            if (!file) return;
            if (file.size > 512 * 1024) {
                alert('Файл прогресса слишком большой. Максимум — 512 КБ.');
                return;
            }
            
            const doImport = () => {
                const reader = new FileReader();
                reader.onload = e => {
                    try {
                        const data = JSON.parse(e.target.result);
                        if (!validateProgressData(data)) throw new Error('invalid progress schema');
                        PROGRESS = normalizeProgress(data);
                        saveProgress(true);
                        alert('Прогресс успешно импортирован и проверен.');
                        location.reload();
                    } catch (err) {
                        alert('Ошибка: неверный файл прогресса или неподдерживаемая схема.');
                    }
                };
                reader.onerror = () => alert('Не удалось прочитать файл прогресса.');
                reader.readAsText(file);
            };

            if (window.TelegramApp && window.TelegramApp.showConfirm) {
                window.TelegramApp.showConfirm('Вы уверены? Текущий прогресс будет полностью заменен данными из файла.', (res) => {
                    if (res) doImport();
                });
            } else {
                if (confirm('Вы уверены? Текущий прогресс будет полностью заменен данными из файла.')) {
                    doImport();
                }
            }
        }

        function loadProgress() {
            const key = getProgressStorageKey();
            let saved = localStorage.getItem(key);

            // Automatic migration for Telegram profile
            if (!saved && key !== 'lezgi_progress') {
                const legacy = localStorage.getItem('lezgi_progress');
                if (legacy) {
                    saved = legacy;
                    localStorage.setItem(key, legacy);
                }
            }

            if (saved) {
                try {
                    PROGRESS = normalizeProgress(JSON.parse(saved));
                } catch (e) { warn('Error loading progress', e); }
            }
            if (!PROGRESS) PROGRESS = normalizeProgress(null);
            updateStatsUI();

            // Background sync with Telegram CloudStorage
            if (window.TelegramApp?.getCloudItem) {
                window.TelegramApp.getCloudItem('lezgi_progress').then((cloudData) => {
                    if (cloudData) {
                        try {
                            const parsed = JSON.parse(cloudData);
                            if (validateProgressData(parsed)) {
                                const normalizedCloud = normalizeProgress(parsed);
                                const cloudCount = (normalizedCloud.learned?.length || 0) + (normalizedCloud.favorites?.length || 0) + (normalizedCloud.stats?.quizzes || 0);
                                const localCount = (PROGRESS.learned?.length || 0) + (PROGRESS.favorites?.length || 0) + (PROGRESS.stats?.quizzes || 0);

                                if (cloudCount >= localCount) {
                                    PROGRESS = normalizedCloud;
                                    localStorage.setItem(key, JSON.stringify(PROGRESS));
                                    localStorage.setItem('lezgi_progress', JSON.stringify(PROGRESS));
                                    updateStatsUI();
                                    if (typeof renderWords === 'function') renderWords(true);
                                } else {
                                    window.TelegramApp.setCloudItem('lezgi_progress', JSON.stringify(PROGRESS));
                                }
                            }
                        } catch (err) {
                            warn('[Telegram CloudStorage] Parse progress error:', err);
                        }
                    } else if (PROGRESS && (PROGRESS.learned.length > 0 || PROGRESS.favorites.length > 0 || PROGRESS.stats.quizzes > 0)) {
                        window.TelegramApp.setCloudItem('lezgi_progress', JSON.stringify(PROGRESS));
                    }
                });
            }
        }

        function updateStatsUI() {
            const learnedEl = document.getElementById('stats-learned');
            const inProgressEl = document.getElementById('stats-in-progress');
            const notStartedEl = document.getElementById('stats-not-started');

            const favsEl = document.getElementById('stats-favs');
            const quizEl = document.getElementById('stats-quizzes');
            const avgScoreEl = document.getElementById('stats-avg-score');

            let learnedCount = 0;
            let inProgressCount = 0;
            let notStartedCount = 0;

            if (WORDS && WORDS.length > 0) {
                WORDS.forEach(w => {
                    const srs = PROGRESS.srs[w.id];
                    if (!srs || srs.ivl === 0) {
                        notStartedCount++;
                    } else if (srs.ivl >= 3) {
                        learnedCount++;
                    } else {
                        inProgressCount++;
                    }
                });
            }

            if (learnedEl) learnedEl.textContent = learnedCount;
            if (inProgressEl) inProgressEl.textContent = inProgressCount;
            if (notStartedEl) notStartedEl.textContent = notStartedCount;

            if (favsEl) favsEl.textContent = PROGRESS.favorites.length;
            if (quizEl) quizEl.textContent = PROGRESS.stats.quizzes;

            if (avgScoreEl) {
                if (PROGRESS.stats.quizzes > 0) {
                    const avg = (PROGRESS.stats.scoreSum / PROGRESS.stats.quizzes).toFixed(1);
                    avgScoreEl.textContent = avg;
                } else {
                    avgScoreEl.textContent = '—';
                }
            }
            updateTodayUI();
            if (typeof updatePracticeStreakUI === 'function') {
                updatePracticeStreakUI();
            }
        }

        function getLeaderboardData() {
            const user = window.TelegramApp?.getUser?.();
            const userName = user ? ([user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Вы') : 'Вы';
            const userPhoto = user?.photo_url || null;
            const userWords = PROGRESS.learned?.length || 0;
            const userStreak = PROGRESS.streak?.current || 1;
            const userScore = PROGRESS.stats?.scoreSum || 0;

            const baseList = [
                { id: '1', name: 'Руслан Рамазанов', username: 'ruslan_lezgi', words: Math.max(340, userWords + 50), streak: 28, score: 3400, avatar: 'Р' },
                { id: '2', name: 'Фатима М.', username: 'fatima_k', words: Math.max(265, userWords + 25), streak: 21, score: 2650, avatar: 'Ф' },
                { id: '3', name: 'Мурад Ахмедов', username: 'murad_ah', words: Math.max(190, userWords + 12), streak: 16, score: 1920, avatar: 'М' },
                { id: '4', name: 'Амина С.', username: 'amina_lez', words: Math.max(140, userWords + 6), streak: 12, score: 1450, avatar: 'А' },
                { id: '5', name: 'Камиль Гаджиев', username: 'kamil_g', words: Math.max(95, userWords + 2), streak: 9, score: 980, avatar: 'К' },
                { id: '6', name: 'Заира Исмаилова', username: 'zaira_i', words: Math.max(70, Math.floor(userWords * 0.85)), streak: 7, score: 720, avatar: 'З' },
                { id: '7', name: 'Имран Б.', username: 'imran_b', words: Math.max(50, Math.floor(userWords * 0.65)), streak: 5, score: 510, avatar: 'И' },
                { id: '8', name: 'Саида М.', username: 'saida_m', words: Math.max(35, Math.floor(userWords * 0.45)), streak: 4, score: 360, avatar: 'С' },
                { id: '9', name: 'Эльдар К.', username: 'eldar_k', words: Math.max(25, Math.floor(userWords * 0.3)), streak: 2, score: 240, avatar: 'Э' },
                { id: '10', name: 'Тагир Л.', username: 'tagir_l', words: Math.max(15, Math.floor(userWords * 0.15)), streak: 1, score: 130, avatar: 'Т' },
            ];

            const currentUserItem = {
                id: 'me',
                isMe: true,
                name: userName,
                username: user?.username ? `@${user.username}` : (user?.id ? `ID: ${user.id}` : 'Локальный игрок'),
                words: userWords,
                streak: userStreak,
                score: userScore,
                photo: userPhoto,
                avatar: (userName || 'В').charAt(0).toUpperCase()
            };

            return { baseList, currentUserItem };
        }
