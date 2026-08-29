// Telegram Web App Integration for LezgiMez
(function () {
    const tg = window.Telegram?.WebApp;

    const TelegramApp = {
        isInsideTelegram: Boolean(tg && (tg.initData || window.location.hash.includes('tgWebAppData'))),
        tg: tg || null,

        init() {
            if (!tg) return;

            try {
                tg.ready();
                if (typeof tg.expand === 'function') {
                    try { tg.expand(); } catch (e) {}
                }
                // STRICT REQUIREMENT: The app MUST open in full-screen Mini App mode when supported. 
                if (typeof tg.requestFullscreen === 'function') {
                    try { tg.requestFullscreen(); } catch (e) {}
                }
                if (typeof tg.enableClosingConfirmation === 'function') {
                    try { tg.enableClosingConfirmation(); } catch (e) {}
                }
                
                // Set safe-area insets dynamically
                const updateInsets = () => {
                    let safeTop = tg.contentSafeAreaInset?.top;
                    if (safeTop === undefined) safeTop = tg.safeAreaInset?.top;
                    if (safeTop === undefined) safeTop = 0;
                    document.documentElement.style.setProperty('--tg-safe-area-inset-top', safeTop + 'px');
                };

                updateInsets();
                try { tg.onEvent?.('safeAreaChanged', updateInsets); } catch (e) {}
                try { tg.onEvent?.('contentSafeAreaChanged', updateInsets); } catch (e) {}

                this.syncTheme();
                try { tg.onEvent?.('themeChanged', () => this.syncTheme()); } catch (e) {}
                
                this.setupHaptics();
                this.setupAlerts();
                this.setupBackButton();
                this.checkIncomingDuel();
            } catch (e) {
                console.warn('[Telegram WebApp] Init warning:', e);
            }
        },

        setupBackButton() {
            if (!tg || !tg.BackButton) return;
            
            const handleBackAction = () => {
                try {
                    // 1. Word / Alphabet / Theory modal
                    const modal = document.getElementById('word-modal');
                    if (modal && !modal.classList.contains('hidden')) {
                        if (typeof window.closeModal === 'function') {
                            window.closeModal();
                        } else {
                            const closeBtn = document.getElementById('modal-close-btn') || document.getElementById('modal-close-btn-grammar') || document.getElementById('modal-close-btn-letter');
                            if (closeBtn) closeBtn.click();
                        }
                        this.updateBackButton?.();
                        return;
                    }
                    
                    // 2. Practice modal (SRS Flashcards, Quiz, Pairs, Odd Word, Grammar exercises)
                    const srsView = document.getElementById('practice-modal');
                    if (srsView && !srsView.classList.contains('hidden')) {
                        if (typeof window.endPractice === 'function') {
                            window.endPractice();
                        } else {
                            const btn = document.getElementById('srs-close-btn') || document.getElementById('srs-close-btn-quiz') || document.getElementById('srs-close-btn-pairs') || document.getElementById('srs-close-btn-odd') || document.getElementById('course-ex-close-btn');
                            if (btn) btn.click();
                        }
                        this.updateBackButton?.();
                        return;
                    }
                    
                    // 3. Course Unit View (Lesson / Theory in Course tab)
                    const courseUnitView = document.getElementById('course-unit-view');
                    if (courseUnitView && !courseUnitView.classList.contains('hidden')) {
                        if (typeof window.showCourseMainView === 'function') {
                            window.showCourseMainView();
                        } else {
                            const btn = document.getElementById('course-unit-back-btn');
                            if (btn) btn.click();
                        }
                        this.updateBackButton?.();
                        return;
                    }

                    // 4. Grammar List View (in Practice tab)
                    const grammarView = document.getElementById('practice-grammar-view');
                    if (grammarView && !grammarView.classList.contains('hidden')) {
                        if (typeof window.hideGrammarList === 'function') {
                            window.hideGrammarList();
                        } else {
                            const btn = document.getElementById('grammar-back-btn');
                            if (btn) btn.click();
                        }
                        this.updateBackButton?.();
                        return;
                    }

                    // 5. Duel modals
                    const duelModal = document.getElementById('duel-modal');
                    if (duelModal && !duelModal.classList.contains('hidden')) {
                        if (typeof window.closeDuelModal === 'function') window.closeDuelModal();
                        this.updateBackButton?.();
                        return;
                    }
                    const duelMenuModal = document.getElementById('duel-menu-modal');
                    if (duelMenuModal && !duelMenuModal.classList.contains('hidden')) {
                        if (typeof window.closeDuelMenuModal === 'function') window.closeDuelMenuModal();
                        this.updateBackButton?.();
                        return;
                    }
                    const duelIncomingModal = document.getElementById('duel-incoming-modal');
                    if (duelIncomingModal && !duelIncomingModal.classList.contains('hidden')) {
                        if (typeof window.closeIncomingDuelModal === 'function') window.closeIncomingDuelModal();
                        this.updateBackButton?.();
                        return;
                    }

                    // 6. Feedback modal
                    const feedbackModal = document.getElementById('feedback-modal');
                    if (feedbackModal && !feedbackModal.classList.contains('hidden')) {
                        if (typeof window.closeFeedbackModal === 'function') window.closeFeedbackModal();
                        this.updateBackButton?.();
                        return;
                    }
                } catch (err) {
                    console.warn('[Telegram BackButton] Action handler error:', err);
                }
            };

            // Listen for native back button clicks (support both onClick and onEvent)
            try {
                if (typeof tg.BackButton.onClick === 'function') {
                    tg.BackButton.onClick(handleBackAction);
                } else if (typeof tg.onEvent === 'function') {
                    tg.onEvent('backButtonClicked', handleBackAction);
                }
            } catch (e) {
                console.warn('[Telegram BackButton] Listener setup warning:', e);
            }
            
            // Automatic show/hide based on open sub-views and modals
            const updateBackButtonState = () => {
                try {
                    const modal = document.getElementById('word-modal');
                    const srsView = document.getElementById('practice-modal');
                    const courseUnitView = document.getElementById('course-unit-view');
                    const grammarView = document.getElementById('practice-grammar-view');
                    const duelModal = document.getElementById('duel-modal');
                    const duelMenuModal = document.getElementById('duel-menu-modal');
                    const duelIncomingModal = document.getElementById('duel-incoming-modal');
                    const feedbackModal = document.getElementById('feedback-modal');
                    
                    const isSubViewOpen = 
                        (modal && !modal.classList.contains('hidden')) || 
                        (srsView && !srsView.classList.contains('hidden')) || 
                        (courseUnitView && !courseUnitView.classList.contains('hidden')) ||
                        (grammarView && !grammarView.classList.contains('hidden')) ||
                        (duelModal && !duelModal.classList.contains('hidden')) ||
                        (duelMenuModal && !duelMenuModal.classList.contains('hidden')) ||
                        (duelIncomingModal && !duelIncomingModal.classList.contains('hidden')) ||
                        (feedbackModal && !feedbackModal.classList.contains('hidden'));
                    
                    if (isSubViewOpen) {
                        tg.BackButton?.show?.();
                    } else {
                        tg.BackButton?.hide?.();
                    }
                } catch (e) {
                    console.warn('[Telegram BackButton] updateBackButtonState error:', e);
                }
            };
            
            this.updateBackButton = updateBackButtonState;
            window.updateTelegramBackButton = updateBackButtonState;
            
            const observer = new MutationObserver(() => {
                updateBackButtonState();
            });
            
            const observeElements = () => {
                const modal = document.getElementById('word-modal');
                const srsView = document.getElementById('practice-modal');
                const courseUnitView = document.getElementById('course-unit-view');
                const grammarView = document.getElementById('practice-grammar-view');
                const feedbackModal = document.getElementById('feedback-modal');
                
                if (modal) observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
                if (srsView) observer.observe(srsView, { attributes: true, attributeFilter: ['class'] });
                if (courseUnitView) observer.observe(courseUnitView, { attributes: true, attributeFilter: ['class'] });
                if (grammarView) observer.observe(grammarView, { attributes: true, attributeFilter: ['class'] });
                if (feedbackModal) observer.observe(feedbackModal, { attributes: true, attributeFilter: ['class'] });
                
                updateBackButtonState();
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', observeElements);
            } else {
                observeElements();
            }
        },

        syncTheme() {
            if (!tg) return;
            try {
                const isDark = tg.colorScheme === 'dark' || (tg.themeParams?.bg_color && this.isDarkHex(tg.themeParams.bg_color));
                const theme = isDark ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', theme);
                if (typeof updateThemeUI === 'function') {
                    updateThemeUI();
                }
                if (typeof tg.setHeaderColor === 'function') {
                    tg.setHeaderColor('#059669');
                }
                if (typeof tg.setBackgroundColor === 'function') {
                    tg.setBackgroundColor(isDark ? '#121212' : '#f8fafc');
                }
            } catch (e) {}
        },

        isDarkHex(hex) {
            if (!hex || typeof hex !== 'string') return false;
            const c = hex.replace('#', '');
            if (c.length !== 6) return false;
            const r = parseInt(c.substring(0, 2), 16);
            const g = parseInt(c.substring(2, 4), 16);
            const b = parseInt(c.substring(4, 6), 16);
            return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
        },

        haptic(type = 'light') {
            if (!tg?.HapticFeedback) return;
            try {
                if (type === 'light' || type === 'medium' || type === 'heavy' || type === 'rigid' || type === 'soft') {
                    tg.HapticFeedback.impactOccurred(type);
                } else if (type === 'success' || type === 'warning' || type === 'error') {
                    tg.HapticFeedback.notificationOccurred(type);
                } else if (type === 'selection') {
                    tg.HapticFeedback.selectionChanged();
                }
            } catch (e) {}
        },
        
        setupHaptics() {
            // Enable iOS WebKit :active pseudo-class on all touched elements
            document.addEventListener('touchstart', () => {}, { passive: true });

            document.addEventListener('click', (e) => {
                // Ignore clicks on elements that have their own strong vibration logic
                const ignoreHaptic = e.target.closest('.no-haptic, .srs-btn');
                if (ignoreHaptic) return;
                
                // Add light haptic feedback to all clickable elements
                const isClickable = e.target.closest('button, a, .tab-btn, .action-btn, .clickable, input[type="radio"], input[type="checkbox"], select, .letter-card, .word-card, .odd-btn, .puzzle-chip, .custom-dropdown');
                if (isClickable) {
                    this.haptic('light');
                }
            });
        },
        
        setupAlerts() {
            const originalAlert = window.alert;
            window.alert = function(msg) {
                // By-passing Telegram's native showAlert because it seems to freeze or fail silently on some clients
                originalAlert(msg);
            };
        },
        
        showConfirm(message, callback) {
            if (tg && tg.showConfirm) {
                tg.showConfirm(message, callback);
            } else {
                const res = confirm(message);
                if (callback) callback(res);
            }
        },

        showBackButton(onClickCallback) {
            if (!tg?.BackButton) return;
            try {
                tg.BackButton.show();
                if (typeof onClickCallback === 'function') {
                    tg.BackButton.onClick(onClickCallback);
                }
            } catch (e) {}
        },

        hideBackButton() {
            if (!tg?.BackButton) return;
            try {
                tg.BackButton.hide();
            } catch (e) {}
        },

        getUser() {
            return tg?.initDataUnsafe?.user || null;
        },

        getCloudItem(key) {
            return new Promise((resolve) => {
                if (!tg?.CloudStorage?.getItem) {
                    return resolve(null);
                }
                let resolved = false;
                const timer = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        resolve(null);
                    }
                }, 2000);
                try {
                    tg.CloudStorage.getItem(key, (err, val) => {
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(timer);
                        if (err) {
                            console.warn('[Telegram CloudStorage] getItem error for ' + key, err);
                            resolve(null);
                        } else {
                            resolve(val || null);
                        }
                    });
                } catch (e) {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(timer);
                    console.warn('[Telegram CloudStorage] getItem exception:', e);
                    resolve(null);
                }
            });
        },

        setCloudItem(key, value) {
            return new Promise((resolve) => {
                if (!tg?.CloudStorage?.setItem) {
                    return resolve(false);
                }
                let resolved = false;
                const timer = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        resolve(false);
                    }
                }, 2500);
                try {
                    // Telegram CloudStorage value limit is 4096 characters per key
                    if (typeof value === 'string' && value.length > 4096) {
                        console.warn('[Telegram CloudStorage] Value exceeds 4096 char limit (' + value.length + ' chars)');
                    }
                    tg.CloudStorage.setItem(key, value, (err, success) => {
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(timer);
                        if (err) {
                            console.warn('[Telegram CloudStorage] setItem error for ' + key, err);
                            resolve(false);
                        } else {
                            resolve(Boolean(success));
                        }
                    });
                } catch (e) {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(timer);
                    console.warn('[Telegram CloudStorage] setItem exception:', e);
                    resolve(false);
                }
            });
        },

        openTelegramLink(url) {
            if (!url) return;
            try {
                if (tg && typeof tg.openTelegramLink === 'function' && url.includes('t.me/')) {
                    tg.openTelegramLink(url);
                } else if (tg && typeof tg.openLink === 'function' && !url.includes('t.me/')) {
                    tg.openLink(url);
                } else {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            } catch (e) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        },

        encodeDuelChallenge(data) {
            try {
                const compact = {
                    n: (data.name || 'Друг').slice(0, 30),
                    p: data.photo ? data.photo.slice(0, 150) : '',
                    c: Number(data.correct) || 0,
                    m: Number(data.mistakes) || 0,
                    l: Number(data.livesLeft) || 0,
                    w: Array.isArray(data.wordIds) ? data.wordIds.slice(0, 20) : []
                };
                const json = JSON.stringify(compact);
                const b64 = btoa(unescape(encodeURIComponent(json)))
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');
                return b64;
            } catch (e) {
                console.error('[Duel] Error encoding challenge:', e);
                return '';
            }
        },

        decodeDuelChallenge(str) {
            try {
                if (!str || typeof str !== 'string') return null;
                let clean = str.trim();
                if (clean.startsWith('duel_')) clean = clean.slice(5);
                clean = clean.replace(/-/g, '+').replace(/_/g, '/');
                while (clean.length % 4) clean += '=';
                const json = decodeURIComponent(escape(atob(clean)));
                const compact = JSON.parse(json);
                return {
                    name: compact.n || 'Друг',
                    photo: compact.p || '',
                    correct: compact.c || 0,
                    mistakes: compact.m || 0,
                    livesLeft: compact.l || 0,
                    wordIds: compact.w || []
                };
            } catch (e) {
                console.error('[Duel] Error decoding challenge:', e);
                return null;
            }
        },

        createDuelShareLink(challengeData) {
            const code = this.encodeDuelChallenge(challengeData);
            if (!code) return 'https://t.me/LezgiMez';
            return `https://t.me/LezgiMez/app?startapp=duel_${code}`;
        },

        shareFriendChallenge(challengeData) {
            const link = this.createDuelShareLink(challengeData);
            const name = challengeData.name || 'Твой друг';
            const correct = challengeData.correct || 0;
            const mistakes = challengeData.mistakes || 0;
            const lives = challengeData.livesLeft || 0;

            const text = `⚔️ ${name} вызывает тебя на «Дуэль слов» в приложении LezgiMez!\n\n` +
                `🎯 Результат вызова:\n` +
                `✅ Ответил правильно: ${correct} слов\n` +
                `❌ Допустил ошибок: ${mistakes} (из 3 жизней)\n` +
                `❤️ Осталось жизней: ${lives}/3\n\n` +
                `Сможешь сделать меньше ошибок и победить? Жми на ссылку и сразись! 🏆`;

            this.shareUrl(text, link);
        },

        shareChallengeReply(myStats, friendName, won) {
            const outcome = won ? '🏆 Я победил в твоей дуэли!' : '⚔️ Я принял твой вызов в дуэли слов!';
            const text = `${outcome}\n\n` +
                `👤 Против: ${friendName}\n` +
                `✅ Мой результат: ${myStats.correct} правильных слов\n` +
                `❌ Ошибок: ${myStats.mistakes} / 3\n` +
                `❤️ Осталось жизней: ${myStats.livesLeft}/3\n\n` +
                `Сыграем ещё раз в LezgiMez? ⚔️`;
            this.shareUrl(text, 'https://t.me/LezgiMez');
        },

        checkIncomingDuel() {
            let duelParam = null;
            if (tg?.initDataUnsafe?.start_param && tg.initDataUnsafe.start_param.startsWith('duel_')) {
                duelParam = tg.initDataUnsafe.start_param;
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                const queryDuel = urlParams.get('duel') || urlParams.get('startapp');
                if (queryDuel) duelParam = queryDuel;
            }

            if (duelParam) {
                const challenge = this.decodeDuelChallenge(duelParam);
                if (challenge && challenge.wordIds && challenge.wordIds.length > 0) {
                    setTimeout(() => {
                        if (typeof window.showIncomingDuelModal === 'function') {
                            window.showIncomingDuelModal(challenge);
                        }
                    }, 500);
                }
            }
        },

        shareUrl(text, url = 'https://t.me/LezgiMez') {
            const fullUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text || '')}`;
            this.openTelegramLink(fullUrl);
        },

        shareDuel(correct, mistakes, livesLeft = 0) {
            const correctNum = Number(correct) || 0;
            const mistakesNum = Number(mistakes) || 0;
            const wordWord = correctNum === 1 ? 'слово' : (correctNum >= 2 && correctNum <= 4 ? 'слова' : 'слов');
            const mistakeWord = mistakesNum === 1 ? 'ошибку' : (mistakesNum >= 2 && mistakesNum <= 4 ? 'ошибки' : 'ошибок');
            
            const text = `⚔️ Я сыграл в «Дуэль слов» в LezgiMez!\n\n` +
                `✅ Правильно: ${correctNum} ${wordWord}\n` +
                `❌ Допустил: ${mistakesNum} ${mistakeWord} (из 3 жизней)\n` +
                `❤️ Осталось жизней: ${livesLeft}/3\n\n` +
                `Сможешь допустить меньше ошибок? Присоединяйся к дуэли! 🏆`;
            this.shareUrl(text, 'https://t.me/LezgiMez');
        },

        shareLeaderboard(rank, words) {
            const text = `🏆 Я занимаю ${rank}-е место в таблице лидеров LezgiMez (${words} выученных слов)! Присоединяйся к изучению лезгинского языка!`;
            this.shareUrl(text, 'https://t.me/LezgiMez');
        },

        openBotReminders() {
            this.openTelegramLink('https://t.me/LezgiMez?start=reminder');
        },

        openSupportChat(context = '') {
            const link = context ? `https://t.me/LezgiMez` : `https://t.me/LezgiMez`;
            this.openTelegramLink(link);
        },

        renderProfileCard() {
            const avatarEl = document.getElementById('tg-user-avatar');
            const nameEl = document.getElementById('tg-user-name');
            const badgeEl = document.getElementById('tg-user-badge');
            const subEl = document.getElementById('tg-user-sub');
            const statusEl = document.getElementById('tg-sync-status');

            if (!nameEl) return;

            const user = this.getUser();
            if (user) {
                const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Пользователь Telegram';
                nameEl.textContent = fullName;
                avatarEl?.classList.remove('hidden');
                if (subEl) {
                    subEl.textContent = user.username ? `@${user.username}` : `ID: ${user.id}`;
                }
                if (badgeEl) {
                    badgeEl.textContent = 'TG';
                    badgeEl.className = 'px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full flex-shrink-0';
                }
                if (statusEl) {
                    statusEl.classList.remove('hidden');
                    statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span><span class="text-xs font-medium text-emerald-600 truncate">Синхронизировано</span>';
                }
                if (avatarEl) {
                    if (user.photo_url) {
                        avatarEl.innerHTML = `<img src="${user.photo_url}" alt="${fullName}" class="w-full h-full object-cover rounded-2xl" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-user\\'></i>'">`;
                    } else {
                        const initial = (user.first_name || user.username || 'T').charAt(0).toUpperCase();
                        avatarEl.innerHTML = `<span>${initial}</span>`;
                    }
                }
            } else {
                nameEl.textContent = 'Локальный профиль';
                if (subEl) {
                    subEl.textContent = 'В этом браузере';
                }
                if (badgeEl) {
                    badgeEl.textContent = 'Web';
                    badgeEl.className = 'px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full flex-shrink-0';
                }
                if (statusEl) {
                    statusEl.classList.add('hidden');
                }
                if (avatarEl) {
                    avatarEl.classList.add('hidden');
                }
            }
        }
    };

    window.TelegramApp = TelegramApp;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            TelegramApp.init();
            TelegramApp.renderProfileCard();
        });
    } else {
        TelegramApp.init();
        TelegramApp.renderProfileCard();
    }
})();
