        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
        });

        function installApp() {
            if (!deferredPrompt) {
                showInstallInstructions();
                return;
            }
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choice) => {
                if (choice.outcome === 'accepted') {
                    log('[PWA] Installed');
                }
                deferredPrompt = null;
            });
        }

        function showInstallInstructions() {
            const modal = document.getElementById('word-modal');
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.className = 'px-6 pt-6 pb-8 text-center';

            const iconWrap = document.createElement('div');
            iconWrap.className = 'mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4';
            iconWrap.innerHTML = '<i class="fa-solid fa-mobile-alt text-emerald-600 text-3xl"></i>';

            const h3 = document.createElement('h3');
            h3.className = 'font-bold text-xl mb-2';
            h3.textContent = 'Установка';

            const p = document.createElement('p');
            p.className = 'text-sm text-slate-600 mb-6';
            p.textContent = 'Чтобы установить приложение на телефон:';

            const steps = document.createElement('div');
            steps.className = 'text-left bg-slate-50 rounded-2xl p-4 text-sm space-y-3';

            const createStep = (num, text) => {
                const div = document.createElement('div');
                div.className = 'flex gap-3';
                const n = document.createElement('div');
                n.className = 'font-mono text-emerald-600 w-5';
                n.textContent = num;
                const t = document.createElement('div');
                t.textContent = text;
                div.append(n, t);
                return div;
            };

            steps.append(
                createStep('1', 'Нажмите «Поделиться» внизу браузера'),
                createStep('2', 'Выберите «На экран «Домой»»'),
                createStep('3', 'Подтвердите установку')
            );

            wrap.append(iconWrap, h3, p, steps);

            const footer = document.createElement('div');
            footer.className = 'border-t p-4';
            const okBtn = document.createElement('button');
            okBtn.className = 'w-full py-3 bg-slate-100 active:bg-slate-200 font-semibold rounded-3xl text-sm';
            okBtn.textContent = 'Понятно';
            okBtn.addEventListener('click', closeModal);
            footer.appendChild(okBtn);

            content.append(wrap, footer);
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }


        function checkForUpdates() {
            const icon = document.getElementById('update-check-icon');
            const status = document.getElementById('update-status');
            if (!icon || !status) return;

            // Start spinning
            icon.classList.add('fa-spin');
            status.textContent = 'Проверка...';

            if (!navigator.onLine) {
                setTimeout(() => {
                    status.textContent = 'Оффлайн';
                    icon.classList.remove('fa-spin');
                }, 800);
                return;
            }

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistration().then(registration => {
                    if (registration) {
                        registration.update().then(() => {
                            log('[PWA] Manual update check completed');
                            setTimeout(() => {
                                if (registration.installing) {
                                    status.textContent = 'Загрузка...';
                                } else if (registration.waiting) {
                                    status.textContent = 'Есть обновление!';
                                    icon.classList.remove('fa-spin');
                                } else {
                                    status.textContent = 'Обновлено';
                                    icon.classList.remove('fa-spin');
                                }
                            }, 1000);
                        }).catch(err => {
                            warn('[PWA] SW update check failed', err);
                            status.textContent = 'Ошибка';
                            icon.classList.remove('fa-spin');
                        });
                    } else {
                        status.textContent = 'Ошибка PWA';
                        icon.classList.remove('fa-spin');
                    }
                }).catch(() => {
                    status.textContent = 'Ошибка';
                    icon.classList.remove('fa-spin');
                });
            } else {
                status.textContent = 'Не подд.';
                icon.classList.remove('fa-spin');
            }
        }



        function registerSW() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js')
                    .then(async (registration) => {
                        log('[PWA] Service Worker registered');

                        if (supportsNotifications() && Notification.permission === 'granted' && localStorage.getItem('lezgi_notif_enabled') === '1') {
                            await registerPeriodicReminder();
                        }
                    })
                    .catch(err => warn('[PWA] SW registration failed', err));
            }

            const offlineBanner = document.getElementById('offline-banner');
            window.addEventListener('online', () => offlineBanner?.classList.add('hidden'));
            window.addEventListener('offline', () => offlineBanner?.classList.remove('hidden'));
            if (!navigator.onLine) offlineBanner?.classList.remove('hidden');
        }

        // Embedded dictionary (full offline support)


        function showFatalLoadError(message) {
            const loadingEl = document.getElementById('words-loading');
            const grid = document.getElementById('words-grid');
            const box = document.createElement('div');
            box.className = 'col-span-full p-5 rounded-3xl bg-red-50 border border-red-100 text-red-700 text-sm leading-relaxed';
            box.textContent = message;
            if (loadingEl) {
                loadingEl.innerHTML = '';
                loadingEl.appendChild(box.cloneNode(true));
                loadingEl.classList.remove('hidden');
                loadingEl.style.display = 'block';
            }
            if (grid) {
                grid.innerHTML = '';
                grid.appendChild(box);
            }
        }

        async function loadJsonAsset(url, label) {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
            try {
                const res = await fetch(url, { 
                    cache: 'no-cache',
                    signal: controller ? controller.signal : undefined
                });
                if (timer) clearTimeout(timer);
                if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
                return await res.json();
            } catch (err) {
                if (timer) clearTimeout(timer);
                throw err;
            }
        }

        async function loadWords() {
            const loadingEl = document.getElementById('words-loading');
            try {
                WORDS = await loadJsonAsset('words.json', 'Словарь');
                rebuildSearchIndex();
                if (loadingEl) loadingEl.style.display = 'none';
            } catch (e) {
                warn('[LezgiMez] Could not load words.json', e);
                showFatalLoadError('Не удалось загрузить словарь. Проверьте подключение или очистите кэш приложения.');
                return false;
            }

            buildCategoryOptions();
            refreshCategoryCounters();
            syncSelectedCategoryUI();
            updatePracticeAvailability();
            updateVocabStats();
            renderAlphabet();
            renderWords();
            initSearchBehavior();
            updateStatsUI();
            return true;
        }

        function hideLoader() {
            const loader = document.getElementById('app-loader');
            document.body.classList.remove('loading');
            if (!loader) return;
            loader.style.pointerEvents = 'none';
            loader.classList.add('fade-out');
            setTimeout(() => {
                try {
                    loader.style.display = 'none';
                    loader.remove();
                } catch (e) {}
            }, 350);
        }

        function preloadAudioInBackground() {
            if (!Array.isArray(ALPHABET_AUDIO_FILES) || ALPHABET_AUDIO_FILES.length === 0) return;
            // Preload 2 files concurrently in the background so it never saturates the network
            let index = 0;
            const queueNext = () => {
                if (index >= ALPHABET_AUDIO_FILES.length) return;
                const letter = ALPHABET_AUDIO_FILES[index++];
                const soundFile = letter.toLowerCase();
                const audioPath = `audio/alphabet/${soundFile}.mp3`;
                const versionedUrl = getVersionedAudioUrl(audioPath);
                if (PRELOADED_AUDIO[versionedUrl]) {
                    queueNext();
                    return;
                }
                fetch(versionedUrl)
                    .then(res => res.ok ? res.blob() : null)
                    .then(blob => {
                        if (blob) PRELOADED_AUDIO[versionedUrl] = URL.createObjectURL(blob);
                    })
                    .catch(() => {})
                    .finally(() => {
                        setTimeout(queueNext, 100);
                    });
            };

            // Start 2 background download workers
            setTimeout(() => {
                queueNext();
                queueNext();
            }, 1000);
        }

        async function startPreloading() {
            const loaderStatus = document.getElementById('loader-status');
            const loaderProgress = document.getElementById('loader-progress-fill');
            const loaderPercent = document.getElementById('loader-percent');
            const loaderStep1 = document.getElementById('loader-step-words');
            const loaderStep2 = document.getElementById('loader-step-grammar');
            const loaderStep3 = document.getElementById('loader-step-audio');

            const assets = [
                { type: 'json', key: 'words', url: 'words.json', label: 'База слов' },
                { type: 'json', key: 'grammar', url: 'grammar.json', label: 'Грамматика' },
                { type: 'json', key: 'course', url: 'course.json', label: 'Курс' }
            ];

            const total = assets.length;
            let loadedCount = 0;
            let preloadedFinished = false;

            const updateProgress = () => {
                if (preloadedFinished) return;
                loadedCount++;
                const percentage = Math.round((loadedCount / total) * 100);
                if (loaderProgress) loaderProgress.style.width = `${percentage}%`;
                if (loaderPercent) loaderPercent.textContent = `${percentage}%`;
            };

            const loadAsset = async (asset) => {
                if (preloadedFinished) return;
                const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
                try {
                    if (asset.key === 'words') {
                        if (loaderStep1) loaderStep1.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-emerald-500 mr-3 text-base"></i>Загрузка слов...';
                        const res = await fetch(asset.url, { signal: controller ? controller.signal : undefined });
                        if (timeoutId) clearTimeout(timeoutId);
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        WORDS = await res.json();
                        if (loaderStep1) loaderStep1.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-500 mr-3 text-base"></i>Словарь и перевод загружены';
                        const loadingEl = document.getElementById('words-loading');
                        if (loadingEl) loadingEl.style.display = 'none';
                    } else if (asset.key === 'grammar') {
                        if (loaderStep2) loaderStep2.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-emerald-500 mr-3 text-base"></i>Загрузка грамматики...';
                        const res = await fetch(asset.url, { signal: controller ? controller.signal : undefined });
                        if (timeoutId) clearTimeout(timeoutId);
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        GRAMMAR = await res.json();
                        if (loaderStep2) loaderStep2.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-500 mr-3 text-base"></i>Грамматический справочник загружен';
                    } else if (asset.key === 'course') {
                        const res = await fetch(asset.url, { signal: controller ? controller.signal : undefined });
                        if (timeoutId) clearTimeout(timeoutId);
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        const courseData = await res.json();
                        COURSE = courseData.modules || [];
                        log(`[LezgiMez] Loaded ${COURSE.length} course modules`);
                    }
                } catch (e) {
                    if (timeoutId) clearTimeout(timeoutId);
                    warn(`[Preloader] Failed to load asset: ${asset.url}`, e);
                    if (asset.key === 'words') {
                        if (loaderStep1) loaderStep1.innerHTML = '<i class="fa-solid fa-circle-exclamation text-amber-500 mr-3 text-base"></i>Словарь (локальный режим)';
                    } else if (asset.key === 'grammar') {
                        if (loaderStep2) loaderStep2.innerHTML = '<i class="fa-solid fa-circle-exclamation text-amber-500 mr-3 text-base"></i>Грамматика (локальный режим)';
                    }
                } finally {
                    updateProgress();
                }
            };

            if (loaderStep3) loaderStep3.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-500 mr-3 text-base"></i>Озвучка готова';

            const enterApp = () => {
                if (preloadedFinished) return;
                preloadedFinished = true;

                try {
                    if (!WORDS || !Array.isArray(WORDS) || WORDS.length === 0) {
                        // Attempt fallback to cached/embedded WORDS if available
                        if (typeof window.EMBEDDED_WORDS !== 'undefined' && Array.isArray(window.EMBEDDED_WORDS)) {
                            WORDS = window.EMBEDDED_WORDS;
                        }
                    }

                    if (!WORDS || WORDS.length === 0) {
                        showFatalLoadError('Не удалось загрузить словарь. Проверьте подключение или очистите кэш приложения.');
                    } else {
                        if (!Array.isArray(GRAMMAR)) GRAMMAR = [];
                        if (!Array.isArray(COURSE)) COURSE = [];

                        try { rebuildSearchIndex(); } catch (e) { warn(e); }
                        try { buildCategoryOptions(); } catch (e) { warn(e); }
                        try { refreshCategoryCounters(); } catch (e) { warn(e); }
                        try { syncSelectedCategoryUI(); } catch (e) { warn(e); }
                        try { updatePracticeAvailability(); } catch (e) { warn(e); }
                        try { updateVocabStats(); } catch (e) { warn(e); }
                        try { renderAlphabet(); } catch (e) { warn(e); }
                        try { renderWords(); } catch (e) { warn(e); }
                        try { initSearchBehavior(); } catch (e) { warn(e); }
                        try { updateStatsUI(); } catch (e) { warn(e); }
                        try { loadCourseProgress(); } catch (e) { warn(e); }
                        try { renderCourseScreen(); } catch (e) { warn(e); }

                        const alphabetCountEl = document.getElementById('alphabet-count');
                        if (alphabetCountEl) alphabetCountEl.textContent = ALPHABET.length;

                        const practiceGrammarView = document.getElementById('practice-grammar-view');
                        if (practiceGrammarView && !practiceGrammarView.classList.contains('hidden')) {
                            try { renderGrammar(); } catch (e) { warn(e); }
                        }
                    }
                } catch (err) {
                    console.error('[LezgiMez] Error entering app:', err);
                } finally {
                    hideLoader();
                    preloadAudioInBackground();
                }
            };

            const startTime = Date.now();

            // Hard safety timeout: Ensure the app ALWAYS opens within 2.7s even if network stalls
            const safetyTimer = setTimeout(() => {
                enterApp();
            }, 2700);

            // Run assets preloading in parallel
            try {
                await Promise.all(assets.map(asset => loadAsset(asset)));
            } catch (err) {
                warn('[Preloader] Batch error:', err);
            }

            if (preloadedFinished) return;

            // Минимальное время показа экрана загрузки (быстрее на 500мс: 1.3 сек)
            const elapsed = Date.now() - startTime;
            const minDuration = 1300;
            const remainingDelay = Math.max(100, minDuration - elapsed);

            setTimeout(() => {
                if (preloadedFinished) return;
                clearTimeout(safetyTimer);

                if (loaderStatus) loaderStatus.textContent = 'Готово к запуску!';
                if (loaderProgress) loaderProgress.style.width = '100%';
                if (loaderPercent) loaderPercent.textContent = '100%';

                setTimeout(() => {
                    enterApp();
                }, 150);
            }, remainingDelay);
        }



        // Init everything
        function init() {
            // Prevent desktop zooming
            document.addEventListener('wheel', function(e) {
                if (e.ctrlKey) {
                    e.preventDefault();
                }
            }, { passive: false });

            document.addEventListener('keydown', function(e) {
                if (e.ctrlKey && (e.key === '=' || e.key === '-' || e.key === '0' || e.key === '+' || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract')) {
                    e.preventDefault();
                }
            });

            registerSW();
            initGrammarSearchBehavior();

            // Tabs
            document.querySelectorAll('[data-tab]').forEach(btn => {
                btn.addEventListener('click', () => switchTab(btn.dataset.tab));
            });
            document.getElementById('prac-mode-course')?.addEventListener('click', () => switchTab('course'));


            // Search
            const sc = document.getElementById('search-clear');
            if (sc) sc.addEventListener('click', () => {
                const i = document.getElementById('search-input');
                i.value = '';
                i.dispatchEvent(new Event('input'));
            });

            // Dropdowns
            document.getElementById('category-filter-trigger')?.addEventListener('click', () => toggleDropdown('category-filter-wrapper'));
            document.getElementById('practice-category-trigger')?.addEventListener('click', () => toggleDropdown('practice-category-wrapper'));

            // Practice modes
            document.getElementById('prac-mode-grammar')?.addEventListener('click', showGrammarList);
            document.getElementById('grammar-back-btn')?.addEventListener('click', hideGrammarList);
            document.getElementById('prac-mode-alphabet')?.addEventListener('click', () => typeof showAlphabetPracticeView === 'function' && showAlphabetPracticeView());
            document.getElementById('alphabet-practice-back-btn')?.addEventListener('click', () => typeof hideAlphabetPracticeView === 'function' && hideAlphabetPracticeView());
            document.getElementById('prac-mode-review')?.addEventListener('click', () => typeof startSrsReview === 'function' && startSrsReview());
            document.getElementById('course-unit-back-btn')?.addEventListener('click', showCourseMainView);

            // Duel Mode Select & Modals (Under Development)
            document.getElementById('prac-mode-duel')?.addEventListener('click', () => {
                if (typeof window.showCustomAlert === 'function') {
                    window.showCustomAlert('Режим в разработке', 'Режим «Дуэль» сейчас находится в разработке. Совсем скоро здесь появится возможность играть и соревноваться с друзьями!');
                } else {
                    alert('Режим «Дуэль» сейчас находится в разработке.');
                }
            });
            document.getElementById('duel-menu-close-btn')?.addEventListener('click', () => typeof closeDuelMenuModal === 'function' && closeDuelMenuModal());
            document.getElementById('duel-menu-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'duel-menu-modal' && typeof closeDuelMenuModal === 'function') closeDuelMenuModal();
            });

            // 1. Online Random Matchmaking
            document.getElementById('duel-btn-online-match')?.addEventListener('click', () => {
                if (typeof openDuelMatchmakingModal === 'function') openDuelMatchmakingModal();
                window.DuelNetwork?.startMatchmaking(
                    (customStatus) => {
                        const statusEl = document.getElementById('duel-matchmaking-status');
                        if (statusEl) statusEl.textContent = customStatus || 'Ищем свободного игрока в сети...';
                    },
                    (matchInfo) => {
                        if (typeof closeDuelMatchmakingModal === 'function') closeDuelMatchmakingModal();
                        if (typeof startDuelGame === 'function') {
                            startDuelGame('online_live', {
                                opponent: matchInfo.opponent,
                                isHost: matchInfo.role === 'host',
                                isSimulated: Boolean(matchInfo.isSimulated)
                            });
                        }
                    },
                    (handlers) => {
                        // Real honest handler: no opponent found in the network!
                        const titleEl = document.getElementById('duel-matchmaking-title');
                        const statusEl = document.getElementById('duel-matchmaking-status');
                        const iconEl = document.getElementById('duel-matchmaking-center-icon');
                        const timerWrap = document.getElementById('duel-matchmaking-timer-wrap');
                        const searchingActions = document.getElementById('duel-matchmaking-searching-actions');
                        const notFoundActions = document.getElementById('duel-matchmaking-not-found-actions');

                        if (titleEl) titleEl.textContent = 'Соперник не найден';
                        if (statusEl) statusEl.textContent = 'В сети пока нет игроков в поиске. Вы можете сыграть с ИИ-ботом или продолжить ожидание.';
                        if (iconEl) {
                            iconEl.className = 'w-18 h-18 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-3xl z-10 shadow-sm';
                            iconEl.innerHTML = '<i class="fa-solid fa-user-slash text-2xl"></i>';
                        }
                        if (timerWrap) timerWrap.classList.add('hidden');
                        if (searchingActions) searchingActions.classList.add('hidden');
                        if (notFoundActions) notFoundActions.classList.remove('hidden');

                        // Action 1: User explicitly chooses to play with AI
                        const playAiBtn = document.getElementById('duel-match-play-ai-btn');
                        if (playAiBtn) {
                            playAiBtn.onclick = () => {
                                if (typeof closeDuelMatchmakingModal === 'function') closeDuelMatchmakingModal();
                                handlers?.playAi?.();
                            };
                        }

                        // Action 2: User chooses to keep waiting in the room
                        const keepWaitingBtn = document.getElementById('duel-match-keep-waiting-btn');
                        if (keepWaitingBtn) {
                            keepWaitingBtn.onclick = () => {
                                if (titleEl) titleEl.textContent = 'Ожидание соперника...';
                                if (statusEl) statusEl.textContent = 'Вы находитесь в очереди. Как только реальный игрок нажмёт поиск, игра начнётся!';
                                if (iconEl) {
                                    iconEl.className = 'w-18 h-18 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl z-10 shadow-sm';
                                    iconEl.innerHTML = '<i class="fa-solid fa-hourglass-half text-2xl animate-pulse"></i>';
                                }
                                if (searchingActions) searchingActions.classList.remove('hidden');
                                if (notFoundActions) notFoundActions.classList.add('hidden');
                                handlers?.keepWaiting?.('Ожидание подключения соперника...');
                            };
                        }
                    },
                    (err) => {
                        console.error('[Duel] Matchmaking error:', err);
                        if (typeof closeDuelMatchmakingModal === 'function') closeDuelMatchmakingModal(true);
                        alert('Ошибка сетевого подключения. Попробуйте ещё раз.');
                    }
                );
            });

            document.getElementById('duel-matchmaking-cancel-btn')?.addEventListener('click', () => {
                if (typeof closeDuelMatchmakingModal === 'function') closeDuelMatchmakingModal(true);
            });
            document.getElementById('duel-match-not-found-close-btn')?.addEventListener('click', () => {
                if (typeof closeDuelMatchmakingModal === 'function') closeDuelMatchmakingModal(true);
            });
            document.getElementById('duel-matchmaking-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'duel-matchmaking-modal' && typeof closeDuelMatchmakingModal === 'function') closeDuelMatchmakingModal(true);
            });

            // 2. Create room & invite friend
            document.getElementById('duel-btn-create-room')?.addEventListener('click', () => {
                window.DuelNetwork?.createRoom(
                    null,
                    (roomCode) => {
                        if (typeof openDuelLobbyModal === 'function') openDuelLobbyModal(roomCode);
                    },
                    (joinInfo) => {
                        if (typeof closeDuelLobbyModal === 'function') closeDuelLobbyModal(false);
                        if (typeof startDuelGame === 'function') {
                            startDuelGame('online_live', { opponent: joinInfo.opponent, isHost: true });
                        }
                    },
                    (err) => {
                        console.error('[Duel] Create room error:', err);
                        alert('Не удалось создать комнату. Проверьте интернет-соединение.');
                    }
                );
            });
            document.getElementById('duel-lobby-close-btn')?.addEventListener('click', () => {
                if (typeof closeDuelLobbyModal === 'function') closeDuelLobbyModal(true);
            });
            document.getElementById('duel-lobby-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'duel-lobby-modal' && typeof closeDuelLobbyModal === 'function') closeDuelLobbyModal(true);
            });
            document.getElementById('duel-lobby-tg-btn')?.addEventListener('click', () => {
                const code = window.DuelNetwork?.roomCode;
                if (code) {
                    window.TelegramApp?.shareRoomInvite?.(code);
                }
            });
            document.getElementById('duel-lobby-copy-btn')?.addEventListener('click', () => {
                const code = window.DuelNetwork?.roomCode;
                if (code) {
                    const link = window.TelegramApp?.createRoomInviteLink?.(code) || (window.location.origin + window.location.pathname + '?room=' + code);
                    const text = `⚔️ Онлайн-дуэль в LezgiMez!\nКод комнаты: ${code}\nСсылка: ${link}`;
                    if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(text).then(() => {
                            const copyText = document.getElementById('duel-lobby-copy-text');
                            if (copyText) {
                                const orig = copyText.textContent;
                                copyText.textContent = 'Скопировано! ✅';
                                setTimeout(() => copyText.textContent = orig, 2000);
                            }
                        }).catch(() => {});
                    }
                }
            });

            // 3. Join by room code
            document.getElementById('duel-btn-join-code')?.addEventListener('click', () => {
                if (typeof openDuelJoinModal === 'function') openDuelJoinModal();
            });
            document.getElementById('duel-join-close-btn')?.addEventListener('click', () => {
                if (typeof closeDuelJoinModal === 'function') closeDuelJoinModal();
            });
            document.getElementById('duel-join-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'duel-join-modal' && typeof closeDuelJoinModal === 'function') closeDuelJoinModal();
            });
            document.getElementById('duel-join-submit-btn')?.addEventListener('click', () => {
                const input = document.getElementById('duel-join-input');
                const err = document.getElementById('duel-join-error');
                const code = (input?.value || '').trim().toUpperCase();
                if (!code || code.length < 3) {
                    if (err) {
                        err.textContent = 'Пожалуйста, введите код комнаты';
                        err.classList.remove('hidden');
                    }
                    return;
                }
                if (err) err.classList.add('hidden');

                const submitBtn = document.getElementById('duel-join-submit-btn');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Подключение...</span>';
                }

                window.DuelNetwork?.joinRoom(
                    code,
                    () => {},
                    (joinInfo) => {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = '<i class="fa-solid fa-play text-sm"></i> <span>Присоединиться к дуэли</span>';
                        }
                        if (typeof closeDuelJoinModal === 'function') closeDuelJoinModal();
                        if (typeof startDuelGame === 'function') {
                            startDuelGame('online_live', { opponent: joinInfo.opponent, isHost: false });
                        }
                    },
                    (error) => {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = '<i class="fa-solid fa-play text-sm"></i> <span>Присоединиться к дуэли</span>';
                        }
                        if (err) {
                            err.textContent = 'Не удалось найти комнату ' + code + '. Проверьте код.';
                            err.classList.remove('hidden');
                        }
                    }
                );
            });

            // 4. Other duel modes
            document.getElementById('duel-btn-pass-play')?.addEventListener('click', () => typeof startDuelGame === 'function' && startDuelGame('pass_play'));
            // duel-btn-bot launches time_attack as a solo fallback (unchanged)
            document.getElementById('duel-btn-bot')?.addEventListener('click', () => typeof startDuelGame === 'function' && startDuelGame('time_attack'));

            // Incoming challenge modal buttons
            document.getElementById('duel-incoming-close-btn')?.addEventListener('click', () => typeof closeIncomingDuelModal === 'function' && closeIncomingDuelModal());
            document.getElementById('duel-incoming-decline-btn')?.addEventListener('click', () => typeof closeIncomingDuelModal === 'function' && closeIncomingDuelModal());
            document.getElementById('duel-incoming-accept-btn')?.addEventListener('click', () => {
                const challenge = typeof window.pendingChallenge === 'function' ? window.pendingChallenge() : null;
                if (!challenge) return;

                if (challenge.isLiveRoom && challenge.roomCode) {
                    if (typeof closeIncomingDuelModal === 'function') closeIncomingDuelModal();
                    window.DuelNetwork?.joinRoom(
                        challenge.roomCode,
                        () => {},
                        (joinInfo) => {
                            if (typeof startDuelGame === 'function') {
                                startDuelGame('online_live', { opponent: joinInfo.opponent, isHost: false });
                            }
                        },
                        (err) => {
                            alert('Комната недоступна или игра уже началась.');
                        }
                    );
                } else {
                    if (typeof startDuelGame === 'function') startDuelGame('friend_play', challenge);
                }
            });
            document.getElementById('duel-incoming-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'duel-incoming-modal' && typeof closeIncomingDuelModal === 'function') closeIncomingDuelModal();
            });

            // Duel arena and result buttons
            document.getElementById('duel-close-btn')?.addEventListener('click', () => {
                if (window.lastDuelResult?.mode === 'online_live') {
                    window.DuelNetwork?.cleanup();
                }
                if (typeof closeDuelModal === 'function') closeDuelModal();
            });
            const handleOnlineRematch = () => {
                const rematchText = document.getElementById('duel-rematch-btn-text');
                if (window.DuelNetwork?.hasRematchOffer) {
                    if (rematchText) rematchText.textContent = 'Принятие реванша...';
                    let fallbackWordIds = null;
                    if (typeof WORDS !== 'undefined' && Array.isArray(WORDS) && typeof shuffle === 'function') {
                        fallbackWordIds = shuffle([...WORDS]).slice(0, 20).map(w => w.id);
                    }
                    window.DuelNetwork?.acceptRematch(fallbackWordIds);
                } else {
                    if (rematchText) rematchText.textContent = 'Ожидание соперника...';
                    window.DuelNetwork?.offerRematch();
                }
            };

            document.getElementById('duel-retry-btn')?.addEventListener('click', () => {
                const mode = window.lastDuelResult?.mode || 'time_attack';
                if (mode === 'online_live') {
                    handleOnlineRematch();
                } else if (mode === 'srs_review') {
                    if (typeof startSrsReview === 'function') startSrsReview();
                } else {
                    const challenge = mode === 'friend_play' && typeof window.pendingChallenge === 'function' ? window.pendingChallenge() : null;
                    if (typeof startDuelGame === 'function') startDuelGame(mode, challenge);
                }
            });
            document.getElementById('duel-finish-btn')?.addEventListener('click', () => {
                if (typeof closeDuelModal === 'function') closeDuelModal();
            });
            document.getElementById('duel-rematch-btn')?.addEventListener('click', () => {
                handleOnlineRematch();
            });
            document.getElementById('duel-challenge-btn')?.addEventListener('click', () => {
                if (window.lastDuelResult && typeof window.TelegramApp?.shareFriendChallenge === 'function') {
                    window.TelegramApp.shareFriendChallenge(window.lastDuelResult);
                } else {
                    window.TelegramApp?.shareUrl?.('⚔️ Вызываю тебя на «Дуэль слов» в приложении LezgiMez! У каждого по 3 жизни. Попробуй победить меня! 🏆');
                }
            });
            document.getElementById('duel-reply-friend-btn')?.addEventListener('click', () => {
                const res = window.lastDuelResult;
                if (res && typeof window.TelegramApp?.shareChallengeReply === 'function') {
                    const won = res.mistakes < res.rivalMistakes || (res.mistakes === res.rivalMistakes && res.correct >= res.rivalCorrect);
                    window.TelegramApp.shareChallengeReply(res, res.rivalName, won);
                }
            });
            document.getElementById('duel-share-btn')?.addEventListener('click', () => {
                const correct = document.getElementById('duel-final-correct')?.textContent || '0';
                const mistakesRaw = document.getElementById('duel-final-mistakes')?.textContent || '0';
                const mistakes = mistakesRaw.split('/')[0].trim() || '0';
                const lives = window.lastDuelResult?.livesLeft ?? 0;
                window.TelegramApp?.shareDuel?.(correct, mistakes, lives);
            });
            document.getElementById('duel-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'duel-modal' && typeof closeDuelModal === 'function') closeDuelModal();
            });

            // Feedback & Reminders buttons
            document.getElementById('tg-reminders-card')?.addEventListener('click', () => window.TelegramApp?.openBotReminders?.());
            document.getElementById('open-support-btn')?.addEventListener('click', () => window.TelegramApp?.openSupportChat?.());
            document.getElementById('open-propose-btn')?.addEventListener('click', () => typeof openFeedbackModal === 'function' && openFeedbackModal('Предложить слово / идею'));
            document.getElementById('feedback-close-btn')?.addEventListener('click', () => typeof closeFeedbackModal === 'function' && closeFeedbackModal());
            document.getElementById('feedback-send-btn')?.addEventListener('click', () => typeof sendFeedbackMessage === 'function' && sendFeedbackMessage());
            document.getElementById('feedback-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'feedback-modal' && typeof closeFeedbackModal === 'function') closeFeedbackModal();
            });

            document.getElementById('prac-mode-flashcards')?.addEventListener('click', startFlashcards);
            document.getElementById('prac-mode-review')?.addEventListener('click', () => typeof startSrsReview === 'function' && startSrsReview());
            document.getElementById('prac-mode-pairs')?.addEventListener('click', startPairs);
            document.getElementById('prac-mode-odd')?.addEventListener('click', startOddWord);
            document.getElementById('prac-mode-srs')?.addEventListener('click', startFlashcards); // SRS mode also uses flashcards

                        // Setup modals backdrops & click containment
            setupModalBackdrops();
            document.addEventListener('click', (e) => {
                const trigger = e.target.closest('button, [role="button"], a, input, textarea, select');
                if (trigger) lastDialogTrigger = trigger;
            }, true);

            // Notif banner
            document.getElementById('notif-banner-actions')?.addEventListener('click', (e) => {
                const a = e.target.dataset.action;
                if (a === 'enable') requestNotificationPermission();
                if (a === 'dismiss') dismissNotifBanner();
            });
            // Settings & actions
            document.getElementById('add-to-home-btn')?.addEventListener('click', showInstallInstructions);
            document.getElementById('theme-toggle-card')?.addEventListener('click', toggleTheme);

            const latinToggle = document.getElementById('latin-mode-toggle');
            if (latinToggle) {
                latinToggle.checked = typeof isLatinEnabled === 'function' && isLatinEnabled();
                latinToggle.addEventListener('change', (e) => {
                    if (typeof setLatinEnabled === 'function') {
                        setLatinEnabled(e.target.checked);
                    }
                });
            }

            // Initial data load and UI render
            initTheme();
            loadProgress();
            checkAndUpdateStreak(false);
            if (typeof updatePracticeStreakUI === 'function') updatePracticeStreakUI();
            window.TelegramApp?.renderProfileCard?.();
            startPreloading();

            initKeyboard();
            document.addEventListener('touchstart', () => {}, { passive: true });
            const alphabetCountEl = document.getElementById('alphabet-count');
            if (alphabetCountEl) alphabetCountEl.textContent = ALPHABET.length; // Динамически устанавливаем количество букв

            // Handle initial tab and hash changes
            const hash = window.location.hash.replace('#', '');
            if (VALID_TABS.includes(hash)) switchTab(hash);
            else switchTab('alphabet');


                    window.addEventListener('popstate', (e) => {
            isClosingProgrammatically = true;
            
            const wordModal = document.getElementById('word-modal');
            if (wordModal && !wordModal.classList.contains('hidden')) {
                closeModal();
            }
            
            const practiceModal = document.getElementById('practice-modal');
            if (practiceModal && !practiceModal.classList.contains('hidden')) {
                endPractice();
            }
            
            isClosingProgrammatically = false;
        });

        window.addEventListener('hashchange', () => {
                if (tabSwitchGuard) return;
                const h = window.location.hash.replace('#', '');
                if (h && VALID_TABS.includes(h)) switchTab(h);
            });
        }

                // Setup modals backdrops, isolation & ghost click prevention
        function setupModalBackdrops() {
            function bindBackdrop(modalId, closeFn) {
                const modal = document.getElementById(modalId);
                if (!modal) return;

                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        e.stopPropagation();
                        e.preventDefault();
                        if (typeof window.activateGhostClickShield === 'function') {
                            window.activateGhostClickShield(350);
                        }
                        if (typeof closeFn === 'function') closeFn();
                    }
                });

                const card = modal.querySelector('.modal, .duel-modal-wrapper, .practice-modal-wrapper') || modal.firstElementChild;
                if (card) {
                    card.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                }
            }

            bindBackdrop('word-modal', () => typeof closeModal === 'function' && closeModal());
            bindBackdrop('practice-modal', () => typeof endPractice === 'function' && endPractice());
            bindBackdrop('leaderboard-modal', () => typeof closeLeaderboardModal === 'function' && closeLeaderboardModal());
            bindBackdrop('duel-menu-modal', () => typeof closeDuelMenuModal === 'function' && closeDuelMenuModal());
            bindBackdrop('duel-lobby-modal', () => typeof closeDuelLobbyModal === 'function' && closeDuelLobbyModal());
            bindBackdrop('duel-join-modal', () => typeof closeDuelJoinModal === 'function' && closeDuelJoinModal());
            bindBackdrop('duel-matchmaking-modal', () => typeof closeDuelMatchmakingModal === 'function' && closeDuelMatchmakingModal(true));
            bindBackdrop('duel-incoming-modal', () => typeof closeIncomingDuelModal === 'function' && closeIncomingDuelModal());
            bindBackdrop('duel-modal', () => typeof closeDuelModal === 'function' && closeDuelModal());
            bindBackdrop('feedback-modal', () => typeof closeFeedbackModal === 'function' && closeFeedbackModal());

            // Close buttons shield activation
            const closeButtons = [
                { id: 'leaderboard-close-btn', fn: () => typeof closeLeaderboardModal === 'function' && closeLeaderboardModal() },
                { id: 'duel-menu-close-btn', fn: () => typeof closeDuelMenuModal === 'function' && closeDuelMenuModal() },
                { id: 'duel-lobby-close-btn', fn: () => typeof closeDuelLobbyModal === 'function' && closeDuelLobbyModal() },
                { id: 'duel-join-close-btn', fn: () => typeof closeDuelJoinModal === 'function' && closeDuelJoinModal() },
                { id: 'duel-incoming-close-btn', fn: () => typeof closeIncomingDuelModal === 'function' && closeIncomingDuelModal() },
                { id: 'feedback-close-btn', fn: () => typeof closeFeedbackModal === 'function' && closeFeedbackModal() }
            ];

            closeButtons.forEach(({ id, fn }) => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (typeof window.activateGhostClickShield === 'function') {
                            window.activateGhostClickShield(350);
                        }
                        fn();
                    });
                }
            });

            // Leaderboard tabs
            document.getElementById('leaderboard-tab-words')?.addEventListener('click', () => {
                if (typeof renderLeaderboard === 'function') renderLeaderboard('words');
            });
            document.getElementById('leaderboard-tab-streak')?.addEventListener('click', () => {
                if (typeof renderLeaderboard === 'function') renderLeaderboard('streak');
            });
        }

        // Keyboard shortcuts
        function initKeyboard() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (typeof window.handleEscapeKey === 'function') {
                        if (window.handleEscapeKey(e)) return;
                    }
                    const wordModal = document.getElementById('word-modal');
                    const practiceModal = document.getElementById('practice-modal');
                    if (isElementVisible(wordModal)) {
                        e.preventDefault();
                        closeModal();
                        return;
                    }
                    if (isElementVisible(practiceModal)) {
                        e.preventDefault();
                        endPractice();
                        return;
                    }
                }

                if ((e.metaKey || e.ctrlKey) && e.key === '/') {
                    e.preventDefault();
                    switchTab('vocabulary');
                    setTimeout(() => document.getElementById('search-input')?.focus(), 300);
                }
            });
        }


        // ==================== END COURSE ENGINE ====================




                // One-time listener to unlock iOS speech synthesis and audio HTML element
        function unlockIosAudio() {
            if (typeof speechSynthesis !== 'undefined') {
                try {
                    const utterance = new SpeechSynthesisUtterance('');
                    speechSynthesis.speak(utterance);
                } catch(e) {}
            }
            if (typeof AUDIO_PLAYER !== 'undefined' && AUDIO_PLAYER) {
                AUDIO_PLAYER.play().then(() => {
                    AUDIO_PLAYER.pause();
                }).catch(() => {});
            }
            document.removeEventListener('touchstart', unlockIosAudio);
            document.removeEventListener('click', unlockIosAudio);
        }
        document.addEventListener('touchstart', unlockIosAudio);
        document.addEventListener('click', unlockIosAudio);

        document.addEventListener('DOMContentLoaded', init);
    