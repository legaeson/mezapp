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
                // STRICT REQUIREMENT: The app MUST open in full-screen Mini App mode. 
                // Do NOT remove requestFullscreen(). It is required for the modern UI.
                if (typeof tg.requestFullscreen === 'function') {
                    tg.requestFullscreen();
                } else if (typeof tg.expand === 'function') {
                    tg.expand();
                }
                if (typeof tg.enableClosingConfirmation === 'function') {
                    tg.enableClosingConfirmation();
                }
                
                // Add fallback padding for overlapping header
                const updateInsets = () => {
                    let safeTop = tg.contentSafeAreaInset?.top;
                    if (safeTop === undefined) safeTop = tg.safeAreaInset?.top;
                    if (safeTop === undefined) safeTop = 44; // standard iOS fallback
                    document.documentElement.style.setProperty('--tg-safe-area-inset-top', safeTop + 'px');
                };

                updateInsets();
                tg.onEvent?.('safeAreaChanged', updateInsets);
                tg.onEvent?.('contentSafeAreaChanged', updateInsets);

                this.syncTheme();
                tg.onEvent?.('themeChanged', () => this.syncTheme());
                
                this.setupHaptics();
                this.setupAlerts();
                this.setupBackButton();
            } catch (e) {
                console.warn('[Telegram WebApp] Init warning:', e);
            }
        },

        setupBackButton() {
            if (!tg || !tg.BackButton) return;
            
            const handleBackAction = () => {
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
                const modal = document.getElementById('word-modal');
                const srsView = document.getElementById('practice-modal');
                const courseUnitView = document.getElementById('course-unit-view');
                const grammarView = document.getElementById('practice-grammar-view');
                
                const isSubViewOpen = 
                    (modal && !modal.classList.contains('hidden')) || 
                    (srsView && !srsView.classList.contains('hidden')) || 
                    (courseUnitView && !courseUnitView.classList.contains('hidden')) ||
                    (grammarView && !grammarView.classList.contains('hidden'));
                
                if (isSubViewOpen) {
                    tg.BackButton.show();
                } else {
                    tg.BackButton.hide();
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
                
                if (modal) observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
                if (srsView) observer.observe(srsView, { attributes: true, attributeFilter: ['class'] });
                if (courseUnitView) observer.observe(courseUnitView, { attributes: true, attributeFilter: ['class'] });
                
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
                if (isDark) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                }
                if (typeof tg.setHeaderColor === 'function') {
                    tg.setHeaderColor('#059669');
                }
                if (typeof tg.setBackgroundColor === 'function') {
                    tg.setBackgroundColor(isDark ? '#1e1e1e' : '#f8fafc');
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
                try {
                    tg.CloudStorage.getItem(key, (err, val) => {
                        if (err) {
                            console.warn('[Telegram CloudStorage] getItem error for ' + key, err);
                            resolve(null);
                        } else {
                            resolve(val || null);
                        }
                    });
                } catch (e) {
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
                try {
                    // Telegram CloudStorage value limit is 4096 characters per key
                    if (typeof value === 'string' && value.length > 4096) {
                        console.warn('[Telegram CloudStorage] Value exceeds 4096 char limit (' + value.length + ' chars)');
                    }
                    tg.CloudStorage.setItem(key, value, (err, success) => {
                        if (err) {
                            console.warn('[Telegram CloudStorage] setItem error for ' + key, err);
                            resolve(false);
                        } else {
                            resolve(Boolean(success));
                        }
                    });
                } catch (e) {
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

        shareUrl(text, url = 'https://t.me/LezgiMez') {
            const fullUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text || '')}`;
            this.openTelegramLink(fullUrl);
        },

        shareDuel(score, total) {
            const text = `⚔️ Я набрал ${score} очков в Дуэли слов LezgiMez! Сможешь превзойти мой результат? 🏆`;
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
            const streakEl = document.getElementById('tg-user-streak');

            const streakCount = window.PROGRESS?.streak?.current || 1;
            if (streakEl) {
                streakEl.textContent = `${streakCount} ${streakCount === 1 ? 'день' : (streakCount >= 2 && streakCount <= 4 ? 'дня' : 'дней')}`;
            }

            if (!nameEl) return;

            const user = this.getUser();
            if (user) {
                const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Пользователь Telegram';
                nameEl.textContent = fullName;
                if (subEl) {
                    subEl.textContent = user.username ? `@${user.username}` : `ID: ${user.id}`;
                }
                if (badgeEl) {
                    badgeEl.textContent = 'Telegram';
                    badgeEl.className = 'px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full';
                }
                if (statusEl) {
                    statusEl.textContent = 'Прогресс привязан к профилю';
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
                    badgeEl.className = 'px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-full';
                }
                if (statusEl) {
                    statusEl.textContent = 'Для привязки откройте в Telegram';
                }
                if (avatarEl) {
                    avatarEl.innerHTML = '<i class="fa-solid fa-user text-emerald-600"></i>';
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
