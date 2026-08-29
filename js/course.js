        // ==================== COURSE ENGINE ====================

        function loadCourseProgress() {
            try {
                const key = (typeof getCourseStorageKey === 'function') ? getCourseStorageKey() : 'lezgi_course_progress';
                let saved = localStorage.getItem(key);

                // Automatic migration for Telegram profile
                if (!saved && key !== 'lezgi_course_progress') {
                    const legacy = localStorage.getItem('lezgi_course_progress');
                    if (legacy) {
                        saved = legacy;
                        localStorage.setItem(key, legacy);
                    }
                }

                if (saved) {
                    const data = JSON.parse(saved);
                    COURSE_PROGRESS = {
                        completedUnits: Array.isArray(data.completedUnits) ? data.completedUnits : [],
                        scores: (data.scores && typeof data.scores === 'object') ? data.scores : {},
                        currentUnit: data.currentUnit || null
                    };
                }

                // Background sync with Telegram CloudStorage
                if (window.TelegramApp?.getCloudItem) {
                    window.TelegramApp.getCloudItem('lezgi_course_progress').then((cloudData) => {
                        if (cloudData) {
                            try {
                                const parsed = JSON.parse(cloudData);
                                if (parsed && typeof parsed === 'object') {
                                    const cloudCompleted = Array.isArray(parsed.completedUnits) ? parsed.completedUnits.length : 0;
                                    const localCompleted = COURSE_PROGRESS.completedUnits.length;
                                    if (cloudCompleted >= localCompleted) {
                                        COURSE_PROGRESS = {
                                            completedUnits: Array.isArray(parsed.completedUnits) ? parsed.completedUnits : [],
                                            scores: (parsed.scores && typeof parsed.scores === 'object') ? parsed.scores : {},
                                            currentUnit: parsed.currentUnit || null
                                        };
                                        localStorage.setItem(key, JSON.stringify(COURSE_PROGRESS));
                                        localStorage.setItem('lezgi_course_progress', JSON.stringify(COURSE_PROGRESS));
                                        if (typeof renderCourseScreen === 'function') renderCourseScreen();
                                    } else {
                                        window.TelegramApp.setCloudItem('lezgi_course_progress', JSON.stringify(COURSE_PROGRESS));
                                    }
                                }
                            } catch (e) {
                                warn('[Telegram CloudStorage] Parse course progress error:', e);
                            }
                        } else if (COURSE_PROGRESS.completedUnits.length > 0) {
                            window.TelegramApp.setCloudItem('lezgi_course_progress', JSON.stringify(COURSE_PROGRESS));
                        }
                    });
                }
            } catch (e) { warn('Error loading course progress', e); }
        }

        function saveCourseProgress() {
            const key = (typeof getCourseStorageKey === 'function') ? getCourseStorageKey() : 'lezgi_course_progress';
            const json = JSON.stringify(COURSE_PROGRESS);
            localStorage.setItem(key, json);
            localStorage.setItem('lezgi_course_progress', json);
            if (window.TelegramApp?.setCloudItem) {
                window.TelegramApp.setCloudItem('lezgi_course_progress', json);
            }
        }

        function isUnitUnlocked(unitId) {
            return true;
        }

        function showCourseMainView() {
            document.getElementById('course-main-view').classList.remove('hidden');
            document.getElementById('course-unit-view').classList.add('hidden');
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
        }

        function renderCourseScreen() {
            const grid = document.getElementById('course-modules-grid');
            const statsEl = document.getElementById('course-stats');
            if (!grid) return;

            if (!COURSE || COURSE.length === 0) {
                if (statsEl) statsEl.textContent = 'Курс загружается...';
                grid.innerHTML = '<div class="text-center py-12 text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl mb-3"></i><p>Загрузка курса...</p></div>';
                return;
            }

            let totalUnits = 0, completedUnits = 0;
            COURSE.forEach(m => {
                totalUnits += m.units.length;
                m.units.forEach(u => { if (COURSE_PROGRESS.completedUnits.includes(u.id)) completedUnits++; });
            });
            if (statsEl) statsEl.textContent = `${completedUnits} из ${totalUnits} юнитов пройдено`;

            grid.innerHTML = '';
            COURSE.forEach(mod => {
                const modWrap = document.createElement('div');

                // Module header
                const modHeader = document.createElement('div');
                modHeader.className = 'flex items-center gap-3 mb-3';
                const modBadge = document.createElement('span');
                modBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full text-white';
                modBadge.style.backgroundColor = mod.cefrColor || '#10b981';
                modBadge.textContent = mod.level;
                const modTitle = document.createElement('h2');
                modTitle.className = 'text-xl font-extrabold text-slate-800 tracking-tight';
                modTitle.textContent = mod.title;
                modHeader.append(modBadge, modTitle);

                const modDesc = document.createElement('p');
                modDesc.className = 'text-sm text-slate-500 mb-4';
                modDesc.textContent = mod.description || '';

                // Units grid
                const unitsGrid = document.createElement('div');
                unitsGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3';

                mod.units.forEach((unit, idx) => {
                    const unlocked = isUnitUnlocked(unit.id);
                    const completed = COURSE_PROGRESS.completedUnits.includes(unit.id);
                    const score = COURSE_PROGRESS.scores[unit.id];

                    const card = document.createElement('div');
                    card.className = `bg-white border rounded-3xl p-4 flex gap-3 items-center transition-all shadow-sm ${unlocked ? 'cursor-pointer hover:shadow-md active:scale-[0.98] border-slate-100' : 'opacity-50 border-slate-100 cursor-not-allowed'}`;

                    const numCircle = document.createElement('div');
                    numCircle.className = `w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center font-bold text-sm ${completed ? 'bg-emerald-100 text-emerald-700' : unlocked ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-300'}`;
                    numCircle.innerHTML = completed ? '<i class="fa-solid fa-check"></i>' : unlocked ? `${idx + 1}` : '<i class="fa-solid fa-lock text-xs"></i>';

                    const info = document.createElement('div');
                    info.className = 'flex-1 min-w-0';
                    const title = document.createElement('div');
                    title.className = `font-bold text-sm ${unlocked ? 'text-slate-800' : 'text-slate-400'}`;
                    title.textContent = unit.title;
                    const sub = document.createElement('div');
                    sub.className = 'text-xs text-slate-400 mt-0.5';
                    // sub.textContent = completed ? `✓ Пройден${score !== undefined ? ` • ${score}%` : ''}` : `${unit.exercises.length} заданий`;
                    sub.textContent = 'Грамматика';
                    info.append(title, sub);

                    if (unlocked) {
                        const chevron = document.createElement('i');
                        chevron.className = 'fa-solid fa-chevron-right text-emerald-300 text-xs';
                        card.append(numCircle, info, chevron);
                        card.addEventListener('click', () => openCourseUnit(unit));
                    } else {
                        card.append(numCircle, info);
                    }

                    unitsGrid.appendChild(card);
                });

                modWrap.append(modHeader, modDesc, unitsGrid);
                grid.appendChild(modWrap);
            });

            staggerCards(grid);
        }

        function openCourseUnit(unit) {
            document.getElementById('course-main-view').classList.add('hidden');
            document.getElementById('course-unit-view').classList.remove('hidden');

            const content = document.getElementById('course-unit-content');
            content.innerHTML = '';

            // Unit title
            const titleWrap = document.createElement('div');
            titleWrap.className = 'mb-6';
            const h = document.createElement('h1');
            h.className = 'text-3xl font-bold tracking-tighter text-emerald-900';
            h.textContent = unit.title;
            // const sub = document.createElement('p');
            // sub.className = 'text-sm text-slate-500 mt-1';
            // sub.textContent = `${unit.exercises.length} заданий`;
            titleWrap.append(h); //, sub);

            // Theory section
            const theoryWrap = document.createElement('div');
            theoryWrap.className = 'bg-white border border-slate-100 rounded-3xl p-6 mb-6 shadow-sm grammar-content';
            theoryWrap.innerHTML = renderCourseTheoryMd(unit.theory || '');
            // Start button (Temporarily hidden based on user request to leave only grammar)
            /*
            const startBtn = document.createElement('button');
            startBtn.className = 'w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-3xl text-base transition-colors shadow-md shadow-emerald-100 flex items-center justify-center gap-2';
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Начать упражнения';
            startBtn.addEventListener('click', () => startCourseExercises(unit));
            */

            const completed = COURSE_PROGRESS.completedUnits.includes(unit.id);
            if (completed) {
                const againWrap = document.createElement('div');
                againWrap.className = 'flex gap-3 mt-0';
                const scoreInfo = document.createElement('div');
                scoreInfo.className = 'text-center text-sm text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 mb-4';
                const sc = COURSE_PROGRESS.scores[unit.id];
                scoreInfo.innerHTML = `<i class="fa-solid fa-check-circle mr-1"></i> Пройден${sc !== undefined ? ` — ${sc}%` : ''}`;
                content.append(titleWrap, scoreInfo, theoryWrap);
            } else {
                content.append(titleWrap, theoryWrap);
            }

            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
        }

        function renderCourseTheoryMd(md) {
            if (typeof simpleMarkdown === 'function') {
                return simpleMarkdown(md);
            }
            return `<p class="grammar-p">${md}</p>`;
        }

        // ==================== COURSE EXERCISE ENGINE ====================

        function startCourseExercises(unit) {
            let exercises = [...unit.exercises].filter(e => e.type !== 'listening');
            
            // Add translation exercises based on flashcards
            const vocab = exercises.filter(e => e.type === 'flashcard' && e.lz && e.ru);
            if (vocab.length > 0) {
                // Add 1 random Ru -> Lz
                const shuffled1 = [...vocab].sort(() => 0.5 - Math.random());
                shuffled1.slice(0, 1).forEach(v => {
                    exercises.push({
                        type: 'translate',
                        from: 'ru',
                        text: v.ru,
                        answer: v.lz
                    });
                });
                
                // Add 2 random Lz -> Ru (Reverse translate as requested)
                const shuffled2 = [...vocab].sort(() => 0.5 - Math.random());
                shuffled2.slice(0, 2).forEach(v => {
                    exercises.push({
                        type: 'translate',
                        from: 'lz',
                        text: v.lz,
                        answer: v.ru
                    });
                });
            }

            const scoreableCount = exercises.filter(e => e.type !== 'flashcard' && !(e.type === 'listening' && (!e.options || e.options.length === 0) && !e.question)).length;
            courseExState = {
                unit: unit,
                exercises: exercises,
                idx: 0,
                score: 0,
                total: scoreableCount > 0 ? scoreableCount : exercises.length,
                answers: []
            };
            showCourseExercise();
        }

        function showCourseExercise() {
            if (!courseExState || courseExState.idx >= courseExState.exercises.length) {
                showCourseResults();
                return;
            }

            const modal = document.getElementById('practice-modal');
            const isAlreadyOpen = !modal.classList.contains('hidden');
            if (!isAlreadyOpen) {
                history.pushState({ modalOpen: true }, '');
            }

            const content = document.getElementById('practice-content');
            content.innerHTML = '';
            content.classList.add('flex', 'flex-col');

            const ex = courseExState.exercises[courseExState.idx];
            const progress = Math.round((courseExState.idx / courseExState.total) * 100);

            // Header
            const header = document.createElement('div');
            header.className = 'app-header relative flex items-center justify-center px-16 py-4 border-b border-slate-100 bg-white shrink-0 z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg text-center w-full truncate';
            hTitle.textContent = `${courseExState.idx + 1} / ${courseExState.total}`;
            header.append(hTitle);

            const close = document.createElement('button');
            close.id = 'course-ex-close-btn';
            close.className = 'hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(close);

            // Progress bar
            const progWrap = document.createElement('div');
            progWrap.className = 'px-5 pt-3 bg-white';
            const progBg = document.createElement('div');
            progBg.className = 'h-2 bg-emerald-100 rounded-full overflow-hidden';
            const progBar = document.createElement('div');
            progBar.className = 'h-2 bg-emerald-500 rounded-full transition-all duration-500';
            progBar.style.width = `${progress}%`;
            progBg.appendChild(progBar);
            progWrap.appendChild(progBg);

            content.append(header, progWrap);

            // Render exercise by type
            const body = document.createElement('div');
            body.className = 'p-6 animate-fade-in';

            switch (ex.type) {
                case 'flashcard': renderCourseFlashcard(body, ex); break;
                case 'minPairs': renderCourseMinPairs(body, ex); break;
                case 'match': renderCourseMatch(body, ex); break;
                case 'buildSentence': renderCourseBuildSentence(body, ex); break;
                case 'fillGap': renderCourseFillGap(body, ex); break;
                case 'translate': renderCourseTranslate(body, ex); break;
                case 'dialog': renderCourseDialog(body, ex); break;
                case 'quiz': renderCourseQuiz(body, ex); break;
                case 'classifying': renderCourseClassifying(body, ex); break;
                case 'listening': renderCourseQuiz(body, ex); break;
                case 'qa': renderCourseQA(body, ex); break;
                default: renderCourseQuiz(body, ex); break;
            }

            content.appendChild(body);

            // Report button at the bottom
            const footer = document.createElement('div');
            footer.className = 'pb-10 pt-4 flex justify-center mt-auto w-full';

            const reportBtn = document.createElement('button');
            reportBtn.className = 'py-3.5 px-5 bg-rose-50 active:bg-rose-100 text-rose-600 font-bold rounded-3xl flex items-center justify-center gap-x-2 text-sm border border-rose-100/50 transition-colors shadow-sm';
            reportBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Сообщить об ошибке';
            reportBtn.title = 'Сообщить об ошибке в задании';
            reportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showCourseReportForm(courseExState.unit, ex);
            });
            footer.appendChild(reportBtn);

            content.appendChild(footer);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function showCourseReportForm(unit, ex) {
            const modal = document.getElementById('word-modal');
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.className = 'px-6 pt-6 pb-6 text-center flex-1 flex flex-col min-h-0';

            const iconWrap = document.createElement('div');
            iconWrap.className = 'mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4 flex-shrink-0';
            iconWrap.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-emerald-600 text-2xl"></i>';

            const h3 = document.createElement('h3');
            h3.className = 'font-bold text-xl mb-1 text-slate-800';
            h3.textContent = 'Сообщить об ошибке';

            const p = document.createElement('p');
            p.className = 'text-sm text-slate-500 mb-3';
            p.textContent = `В курсе «${unit.title}»`;

            const privacyNote = document.createElement('p');
            privacyNote.className = 'text-[11px] leading-relaxed text-slate-400 bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-3 text-left';
            privacyNote.textContent = 'Когда вы отправляете исправление, текст сообщения передаётся администратору проекта для проверки. Не отправляйте личные данные.';

            const hintBox = document.createElement('div');
            hintBox.className = 'text-left mb-3 bg-slate-50 border border-slate-100 rounded-2xl p-3';
            hintBox.innerHTML = `
                <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Пример описания:</p>
                <p class="text-xs text-slate-500 leading-relaxed mb-2">
                    «В задании на перевод правильный ответ не принимается, хотя он корректен...»
                </p>
                <p class="text-xs text-slate-400 mb-2">Или выберите быстрый вариант:</p>
                <div class="flex flex-wrap gap-1.5" id="course-hint-chips"></div>
            `;

            const form = document.createElement('form');
            form.className = 'flex flex-col flex-1 min-h-0';

            const textarea = document.createElement('textarea');
            textarea.className = 'w-full flex-1 p-3 border border-slate-200 rounded-2xl bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all';
            textarea.placeholder = 'Опишите что не так и как должно быть правильно...';
            textarea.required = true;
            textarea.style.minHeight = '90px';

            form.appendChild(textarea);
            wrap.append(iconWrap, h3, p, privacyNote, hintBox, form);

            const chips = [
                { label: '❌ Ошибка в задании', text: 'Ошибка в задании: ' },
                { label: '✏️ Опечатка', text: 'Опечатка в тексте: ' },
                { label: '🔊 Проблема с аудио', text: 'Проблема с аудио: ' }
            ];

            setTimeout(() => {
                const chipsContainer = document.getElementById('course-hint-chips');
                if (!chipsContainer) return;
                chips.forEach(chip => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'text-[11px] px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-xl active:bg-emerald-50 active:border-emerald-200 active:text-emerald-700 transition-colors';
                    btn.textContent = chip.label;
                    btn.addEventListener('click', () => {
                        textarea.value = chip.text;
                        textarea.focus();
                        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                    });
                    chipsContainer.appendChild(btn);
                });
            }, 0);

            const footer = document.createElement('div');
            footer.className = 'border-t p-4 flex gap-3 bg-white';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'flex-1 py-3 bg-slate-100 active:bg-slate-200 text-slate-600 font-semibold rounded-3xl text-sm transition-colors';
            cancelBtn.textContent = 'Отмена';
            cancelBtn.addEventListener('click', () => closeModal());

            const sendBtn = document.createElement('button');
            sendBtn.className = 'flex-1 py-3 bg-emerald-500 active:bg-emerald-600 text-white font-semibold rounded-3xl text-sm transition-colors flex justify-center items-center gap-2';
            sendBtn.innerHTML = '<span>Отправить</span>';

            sendBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const text = textarea.value.trim();
                if (!text) {
                    textarea.focus();
                    return;
                }
                if (text.length > 1000) {
                    alert('Описание слишком длинное. Максимум — 1000 символов.');
                    return;
                }

                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Отправка...</span>';
                sendBtn.classList.add('opacity-70');

                const payload = {
                    wordId: 'COURSE_ISSUE',
                    word: String('Курс: ' + unit.title).slice(0, 120),
                    translation: String('Задание: ' + JSON.stringify(ex)).slice(0, 180),
                    message: text,
                    appVersion: APP_VERSION,
                    createdAt: new Date().toISOString()
                };

                try {
                    const endpoints = ['/api/report-word.php', '/api/report-word', '/.netlify/functions/report-word'];
                    let sent = false;
                    for (const endpoint of endpoints) {
                        try {
                            const response = await fetch(endpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            if (response.ok) {
                                sent = true;
                                break;
                            }
                        } catch (endpointError) {
                            warn('[Course Report] endpoint failed', endpoint, endpointError);
                        }
                    }

                    if (!sent) throw new Error('All endpoints failed');
                    
                    closeModal();

                } catch (err) {
                    warn('[Course Report] failed', err);
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = '<span>Отправить</span>';
                    sendBtn.classList.remove('opacity-70');
                    setTimeout(() => alert('Не удалось отправить сообщение. Попробуйте позже.'), 10);
                }
            });

            footer.append(cancelBtn, sendBtn);
            content.append(wrap, footer);
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function courseLevenshtein(a, b) {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;
            const matrix = [];
            for (let i = 0; i <= b.length; i++) matrix[i] = [i];
            for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) === a.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1,
                            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                        );
                    }
                }
            }
            return matrix[b.length][a.length];
        }

        function courseCheckAnswer(user, acceptListStr) {
            const sanitize = str => str.trim().toLowerCase().replace(/[.!?,;:]/g, '').replace(/\s+/g, ' ').replace(/[1ӏl]/g, 'i').replace(/Ӏ/gi, 'i');
            const sanitizedUser = sanitize(user);
            
            let acceptList = [];
            acceptListStr.forEach(orig => {
                orig.split(/[/|]/).forEach(part => {
                    acceptList.push({ original: part.trim(), sanitized: sanitize(part) });
                });
            });

            for (let valid of acceptList) {
                if (valid.sanitized === sanitizedUser) return { correct: true, typo: false, match: valid.original };
            }
            for (let valid of acceptList) {
                if (valid.sanitized.length >= 4) {
                    const limit = valid.sanitized.length >= 8 ? 2 : 1;
                    const dist = courseLevenshtein(sanitizedUser, valid.sanitized);
                    if (dist <= limit) return { correct: true, typo: true, match: valid.original };
                }
            }
            return { correct: false, typo: false };
        }

        function courseShowContinueBtn(container, isCorrect) {
            if (container.querySelector('.course-continue-btn')) return;
            
            Array.from(container.querySelectorAll('button')).forEach(b => {
                if (b.textContent.trim() === 'Проверить') {
                    b.classList.add('hidden');
                }
            });

            const btnWrap = document.createElement('div');
            btnWrap.className = 'mt-6 w-full animate-fade-in course-continue-btn';
            const btn = document.createElement('button');
            btn.className = 'w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-3xl text-base transition-colors shadow-md shadow-emerald-100';
            btn.textContent = 'Продолжить';
            btn.addEventListener('click', () => courseNextExercise(isCorrect));
            btnWrap.appendChild(btn);
            container.appendChild(btnWrap);
            setTimeout(() => btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        }

        function courseNextExercise(correct) {
            if (correct) {
                courseExState.score++;
                vibrateSuccess();
            } else {
                vibrateError();
            }
            courseExState.idx++;
            setTimeout(() => showCourseExercise(), 400);
        }

        // ---- FLASHCARD ----
        function renderCourseFlashcard(body, ex) {
            const card = document.createElement('div');
            card.className = 'text-center';

            const label = document.createElement('div');
            label.className = 'text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4';
            label.textContent = 'Запомни';

            const word = document.createElement('div');
            word.className = 'text-4xl font-extrabold text-emerald-900 mb-3';
            word.textContent = ex.lz;

            const trans = document.createElement('div');
            trans.className = 'text-2xl text-slate-600 font-semibold mb-4';
            trans.textContent = ex.ru;

            card.append(label, word, trans);

            if (ex.ex) {
                const example = document.createElement('div');
                example.className = 'text-sm text-slate-500 italic bg-slate-50 rounded-2xl px-4 py-3 mb-4';
                example.textContent = ex.ex;
                card.appendChild(example);
            }

            const btn = document.createElement('button');
            btn.className = 'w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-3xl text-base mt-6 transition-colors';
            btn.textContent = 'Понятно →';
            btn.addEventListener('click', () => courseNextExercise(null));

            card.appendChild(btn);
            body.appendChild(card);
        }

        // ---- MIN PAIRS ----
        function renderCourseMinPairs(body, ex) {
            const wrap = document.createElement('div');
            wrap.className = 'text-center';

            const prompt = document.createElement('div');
            prompt.className = 'text-lg font-bold text-slate-800 mb-6';
            prompt.textContent = ex.prompt || 'Выбери правильное слово';

            const optionsWrap = document.createElement('div');
            optionsWrap.className = 'flex gap-4 justify-center mb-4';

            const words = [ex.word1, ex.word2];
            let answered = false;
            words.forEach((w, i) => {
                const btn = document.createElement('button');
                btn.className = 'flex-1 py-6 px-4 bg-white border-2 border-slate-200 rounded-3xl text-2xl font-bold text-slate-800 hover:border-emerald-300 active:scale-95 transition-all';
                btn.textContent = w;
                btn.addEventListener('click', () => {
                    if (answered) return;
                    answered = true;
                    const correct = i === ex.correctIdx;
                    btn.className = `flex-1 py-6 px-4 rounded-3xl text-2xl font-bold border-2 transition-all ${correct ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-red-300 text-red-700 animate-shake'}`;
                    if (!correct) {
                        const correctBtn = optionsWrap.children[ex.correctIdx];
                        correctBtn.className = 'flex-1 py-6 px-4 rounded-3xl text-2xl font-bold border-2 bg-emerald-50 border-emerald-500 text-emerald-700 transition-all';
                    }
                    if (ex.hint) {
                        const hint = document.createElement('div');
                        hint.className = `text-sm mt-4 px-4 py-3 rounded-2xl ${correct ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`;
                        hint.textContent = ex.hint;
                        wrap.appendChild(hint);
                    }
                    courseShowContinueBtn(wrap, correct);
                });
                optionsWrap.appendChild(btn);
            });

            wrap.append(prompt, optionsWrap);
            body.appendChild(wrap);
        }

        // ---- MATCH PAIRS ----
        function renderCourseMatch(body, ex) {
            const wrap = document.createElement('div');

            const prompt = document.createElement('div');
            prompt.className = 'text-lg font-bold text-slate-800 mb-4';
            prompt.textContent = 'Соедини пары';

            const pairs = ex.pairs;
            const leftItems = shuffle(pairs.map((p, i) => ({ text: p[0], idx: i })));
            const rightItems = shuffle(pairs.map((p, i) => ({ text: p[1], idx: i })));
            let selectedLeft = null;
            let matchedCount = 0;
            let errors = 0;

            const grid = document.createElement('div');
            grid.className = 'flex gap-3';

            const leftCol = document.createElement('div');
            leftCol.className = 'flex-1 flex flex-col gap-2';
            const rightCol = document.createElement('div');
            rightCol.className = 'flex-1 flex flex-col gap-2';

            function checkMatch(leftIdx, rightIdx, rightBtnEl) {
                if (leftIdx === rightIdx) {
                    matchedCount++;
                    // Mark both as matched
                    leftCol.querySelectorAll('[data-idx]').forEach(el => {
                        if (parseInt(el.dataset.idx) === leftIdx) {
                            el.className = 'py-3 px-3 rounded-2xl text-sm font-semibold bg-emerald-50 border-2 border-emerald-300 text-emerald-700 transition-all pointer-events-none';
                        }
                    });
                    rightBtnEl.className = 'py-3 px-3 rounded-2xl text-sm font-semibold bg-emerald-50 border-2 border-emerald-300 text-emerald-700 transition-all pointer-events-none';
                    vibrateSuccess();
                    if (matchedCount >= pairs.length) {
                        courseShowContinueBtn(wrap, errors === 0);
                    }
                    selectedLeft = null;
                } else {
                    errors++;
                    vibrateError();
                    
                    let leftBtnEl = null;
                    leftCol.querySelectorAll('[data-idx]').forEach(el => {
                        if (parseInt(el.dataset.idx) === leftIdx) leftBtnEl = el;
                    });
                    
                    if (leftBtnEl) {
                        leftBtnEl.className = 'py-3 px-3 rounded-2xl text-sm font-semibold bg-red-50 border-2 border-red-400 text-red-700 transition-all animate-shake pointer-events-none';
                    }
                    rightBtnEl.className = 'py-3 px-3 rounded-2xl text-sm font-semibold bg-red-50 border-2 border-red-400 text-red-700 transition-all animate-shake pointer-events-none';
                    
                    grid.style.pointerEvents = 'none';

                    setTimeout(() => {
                        grid.style.pointerEvents = 'auto';
                        if (leftBtnEl) {
                            leftBtnEl.className = 'py-3 px-3 rounded-2xl text-sm font-semibold bg-white border-2 border-slate-200 text-slate-800 hover:border-emerald-300 active:scale-95 transition-all text-left';
                        }
                        rightBtnEl.className = 'py-3 px-3 rounded-2xl text-sm font-semibold bg-white border-2 border-slate-200 text-slate-800 hover:border-emerald-300 active:scale-95 transition-all text-left';
                        selectedLeft = null;
                    }, 500);
                }
            }

            leftItems.forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'py-3 px-3 rounded-2xl text-sm font-semibold bg-white border-2 border-slate-200 text-slate-800 hover:border-emerald-300 active:scale-95 transition-all text-left';
                btn.textContent = item.text;
                btn.dataset.idx = item.idx;
                btn.addEventListener('click', () => {
                    if (btn.classList.contains('pointer-events-none')) return;
                    selectedLeft = item.idx;
                    leftCol.querySelectorAll('[data-idx]').forEach(el => {
                        if (!el.classList.contains('pointer-events-none')) {
                            el.classList.remove('border-emerald-500', 'bg-emerald-50');
                            el.classList.add('border-slate-200', 'bg-white');
                        }
                    });
                    btn.classList.remove('border-slate-200', 'bg-white');
                    btn.classList.add('border-emerald-500', 'bg-emerald-50');
                });
                leftCol.appendChild(btn);
            });

            rightItems.forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'py-3 px-3 rounded-2xl text-sm font-semibold bg-white border-2 border-slate-200 text-slate-800 hover:border-emerald-300 active:scale-95 transition-all text-left';
                btn.textContent = item.text;
                btn.dataset.idx = item.idx;
                btn.addEventListener('click', () => {
                    if (btn.classList.contains('pointer-events-none')) return;
                    if (selectedLeft === null) return;
                    checkMatch(selectedLeft, item.idx, btn);
                });
                rightCol.appendChild(btn);
            });

            grid.append(leftCol, rightCol);
            wrap.append(prompt, grid);
            body.appendChild(wrap);
        }

        // ---- BUILD SENTENCE ----
        function renderCourseBuildSentence(body, ex) {
            const wrap = document.createElement('div');

            const prompt = document.createElement('div');
            prompt.className = 'text-lg font-bold text-slate-800 mb-2';
            prompt.textContent = 'Собери предложение';

            if (ex.translation) {
                const trans = document.createElement('div');
                trans.className = 'text-sm text-slate-500 mb-4';
                trans.textContent = `Перевод: ${ex.translation}`;
                wrap.appendChild(trans);
            }

            const targetArea = document.createElement('div');
            targetArea.className = 'min-h-[56px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-3 mb-4 flex flex-wrap gap-2 items-center';
            targetArea.id = 'build-target';

            const wordsPool = document.createElement('div');
            wordsPool.className = 'flex flex-wrap gap-2 mb-6';

            const shuffledWords = shuffle([...ex.words]);
            const selected = [];

            function updateTarget() {
                targetArea.innerHTML = '';
                if (selected.length === 0) {
                    targetArea.innerHTML = '<span class="text-slate-300 text-sm">Нажми на слова ниже</span>';
                    return;
                }
                selected.forEach((w, i) => {
                    const chip = document.createElement('button');
                    chip.className = 'px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-xl text-sm font-semibold hover:bg-red-100 hover:text-red-600 transition-colors';
                    chip.textContent = w;
                    chip.addEventListener('click', () => {
                        selected.splice(i, 1);
                        updateTarget();
                        renderPool();
                    });
                    targetArea.appendChild(chip);
                });
            }

            function renderPool() {
                wordsPool.innerHTML = '';
                shuffledWords.forEach(w => {
                    const usedCount = selected.filter(s => s === w).length;
                    const totalCount = shuffledWords.filter(s => s === w).length;
                    const available = usedCount < totalCount;

                    // Count how many times this specific index word is used
                    const btn = document.createElement('button');
                    btn.className = `px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${available ? 'bg-white border-2 border-slate-200 text-slate-800 hover:border-emerald-300 active:scale-95' : 'invisible pointer-events-none'}`;
                    btn.textContent = w;
                    if (available) {
                        btn.addEventListener('click', () => {
                            selected.push(w);
                            updateTarget();
                            renderPool();
                        });
                    }
                    wordsPool.appendChild(btn);
                });
            }

            const checkBtn = document.createElement('button');
            checkBtn.className = 'w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-3xl text-base transition-colors';
            checkBtn.textContent = 'Проверить';
            checkBtn.addEventListener('click', () => {
                const answer = selected.join(' ');
                const correct = answer === ex.correct;
                if (correct) {
                    targetArea.className = 'min-h-[56px] bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-3 mb-4 flex flex-wrap gap-2 items-center';
                } else {
                    targetArea.className = 'min-h-[56px] bg-red-50 border-2 border-red-300 rounded-2xl p-3 mb-4 flex flex-wrap gap-2 items-center animate-shake';
                    const correctAnswer = document.createElement('div');
                    correctAnswer.className = 'text-sm text-emerald-700 bg-emerald-50 rounded-2xl px-4 py-3 mt-2';
                    correctAnswer.textContent = `Правильно: ${ex.correct}`;
                    wrap.appendChild(correctAnswer);
                }
                checkBtn.disabled = true;
                courseShowContinueBtn(wrap, correct);
            });

            updateTarget();
            renderPool();

            wrap.prepend(prompt);
            wrap.append(targetArea, wordsPool, checkBtn);
            body.appendChild(wrap);
        }

        // ---- FILL GAP ----
        function renderCourseFillGap(body, ex) {
            const wrap = document.createElement('div');

            const prompt = document.createElement('div');
            prompt.className = 'text-lg font-bold text-slate-800 mb-2';
            prompt.textContent = 'Заполни пропуск';

            const sentence = document.createElement('div');
            sentence.className = 'text-xl font-semibold text-slate-700 bg-slate-50 rounded-2xl px-5 py-4 mb-2 text-center';
            sentence.textContent = ex.sentence;

            if (ex.translation) {
                const trans = document.createElement('div');
                trans.className = 'text-sm text-slate-400 mb-4 text-center';
                trans.textContent = ex.translation;
                wrap.appendChild(trans);
            }

            const optionsWrap = document.createElement('div');
            optionsWrap.className = 'flex flex-col gap-2 mt-4';
            let answered = false;

            ex.options.forEach((opt, i) => {
                const btn = document.createElement('button');
                btn.className = 'w-full py-3.5 px-5 bg-white border-2 border-slate-200 rounded-2xl text-base font-semibold text-slate-800 hover:border-emerald-300 active:scale-[0.98] transition-all text-left';
                btn.textContent = opt;
                btn.addEventListener('click', () => {
                    if (answered) return;
                    answered = true;
                    const correct = i === ex.correct;
                    btn.className = `w-full py-3.5 px-5 rounded-2xl text-base font-semibold border-2 transition-all text-left ${correct ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-red-300 text-red-700 animate-shake'}`;
                    if (!correct) {
                        const correctBtn = optionsWrap.children[ex.correct];
                        correctBtn.className = 'w-full py-3.5 px-5 rounded-2xl text-base font-semibold border-2 bg-emerald-50 border-emerald-500 text-emerald-700 transition-all text-left';
                    }
                    // Show filled sentence
                    sentence.textContent = ex.sentence.replace('___', ex.options[ex.correct]);
                    courseShowContinueBtn(wrap, correct);
                });
                optionsWrap.appendChild(btn);
            });

            wrap.prepend(prompt);
            wrap.append(sentence);
            // If translation was added, reorder
            const nodes = [...wrap.childNodes];
            wrap.innerHTML = '';
            nodes.forEach(n => wrap.appendChild(n));
            wrap.appendChild(optionsWrap);
            body.appendChild(wrap);
        }

        // ---- TRANSLATE ----
        function renderCourseTranslate(body, ex) {
            const wrap = document.createElement('div');

            const prompt = document.createElement('div');
            prompt.className = 'text-lg font-bold text-slate-800 mb-2';
            prompt.textContent = ex.from === 'lz' ? 'Переведи на русский' : 'Переведи на лезгинский';

            const textCard = document.createElement('div');
            textCard.className = 'text-xl font-semibold text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4 mb-4 text-center';
            textCard.textContent = ex.text;

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Введи перевод...';
            input.className = 'w-full px-5 py-4 bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-2xl text-base outline-none transition-all mb-4';
            input.autocomplete = 'off';

            const checkBtn = document.createElement('button');
            checkBtn.className = 'w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-3xl text-base transition-colors';
            checkBtn.textContent = 'Проверить';

            let answered = false;
            const doCheck = () => {
                if (answered) return;
                answered = true;
                
                const result = courseCheckAnswer(input.value, ex.accept || [ex.answer]);
                const correct = result.correct;

                input.disabled = true;
                if (correct) {
                    input.className = 'w-full px-5 py-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-base outline-none text-emerald-700 font-semibold';
                    if (result.typo) {
                        const typoMsg = document.createElement('div');
                        typoMsg.className = 'text-sm text-emerald-700 bg-emerald-100 rounded-2xl px-4 py-3 mt-2';
                        typoMsg.innerHTML = `<strong>Почти правильно! Опечатка:</strong><br>Правильный ответ: ${escapeHtml(result.match)}`;
                        wrap.appendChild(typoMsg);
                    }
                } else {
                    input.className = 'w-full px-5 py-4 bg-red-50 border-2 border-red-300 rounded-2xl text-base outline-none text-red-700';
                    const correctAnswer = document.createElement('div');
                    correctAnswer.className = 'text-sm text-emerald-700 bg-emerald-50 rounded-2xl px-4 py-3 mt-2';
                    correctAnswer.textContent = `Правильный ответ: ${ex.answer}`;
                    wrap.appendChild(correctAnswer);
                }
                checkBtn.disabled = true;
                courseShowContinueBtn(wrap, correct);
            };

            checkBtn.addEventListener('click', doCheck);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCheck(); });

            wrap.append(prompt, textCard, input, checkBtn);
            body.appendChild(wrap);
            setTimeout(() => input.focus(), 100);
        }

        // ---- QA ----
        function renderCourseQA(body, ex) {
            const wrap = document.createElement('div');

            const textCard = document.createElement('div');
            textCard.className = 'text-xl font-semibold text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4 mb-4 text-center';
            textCard.textContent = ex.question;

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Ответ...';
            input.className = 'w-full px-5 py-4 bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-2xl text-base outline-none transition-all mb-4';
            input.autocomplete = 'off';

            const checkBtn = document.createElement('button');
            checkBtn.className = 'w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-3xl text-base transition-colors';
            checkBtn.textContent = 'Проверить';

            let answered = false;
            const doCheck = () => {
                if (answered) return;
                answered = true;
                
                const result = courseCheckAnswer(input.value, [ex.answer]);
                const correct = result.correct;

                input.disabled = true;
                if (correct) {
                    input.className = 'w-full px-5 py-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-base outline-none text-emerald-700 font-semibold';
                    if (result.typo) {
                        const typoMsg = document.createElement('div');
                        typoMsg.className = 'text-sm text-emerald-700 bg-emerald-100 rounded-2xl px-4 py-3 mt-2';
                        typoMsg.innerHTML = `<strong>Почти правильно! Опечатка:</strong><br>Правильный ответ: ${escapeHtml(result.match)}`;
                        wrap.appendChild(typoMsg);
                    }
                } else {
                    input.className = 'w-full px-5 py-4 bg-red-50 border-2 border-red-300 rounded-2xl text-base outline-none text-red-700';
                    const correctAnswer = document.createElement('div');
                    correctAnswer.className = 'text-sm text-emerald-700 bg-emerald-50 rounded-2xl px-4 py-3 mt-2';
                    correctAnswer.textContent = `Правильный ответ: ${ex.answer}`;
                    wrap.appendChild(correctAnswer);
                }
                checkBtn.disabled = true;
                courseShowContinueBtn(wrap, correct);
            };

            checkBtn.addEventListener('click', doCheck);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCheck(); });

            wrap.append(textCard, input, checkBtn);
            body.appendChild(wrap);
            setTimeout(() => input.focus(), 100);
        }


        // ---- DIALOG ----
        function renderCourseDialog(body, ex) {
            const wrap = document.createElement('div');

            const prompt = document.createElement('div');
            prompt.className = 'text-lg font-bold text-slate-800 mb-4';
            prompt.textContent = ex.title || 'Мини-диалог';

            const chatWrap = document.createElement('div');
            chatWrap.className = 'space-y-3 mb-4';

            let lineIdx = 0;
            let dialogErrors = 0;

            function renderNextLine() {
                if (lineIdx >= ex.lines.length) {
                    courseShowContinueBtn(wrap, dialogErrors === 0);
                    return;
                }

                const line = ex.lines[lineIdx];

                if (!line.options) {
                    // Static line
                    const bubble = document.createElement('div');
                    bubble.className = `max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium animate-fade-in ${line.speaker === 'А' || line.speaker === 'Хозяин' ? 'bg-slate-100 text-slate-800 self-start' : 'bg-emerald-50 text-emerald-800 self-end ml-auto'}`;
                    const speakerTag = document.createElement('div');
                    speakerTag.className = 'text-xs text-slate-400 font-bold mb-1';
                    speakerTag.textContent = line.speaker;
                    bubble.prepend(speakerTag);
                    const textEl = document.createElement('div');
                    textEl.textContent = line.text;
                    bubble.appendChild(textEl);
                    chatWrap.appendChild(bubble);
                    lineIdx++;
                    setTimeout(renderNextLine, 500);
                } else {
                    // Choice line
                    const choiceWrap = document.createElement('div');
                    choiceWrap.className = 'animate-fade-in';
                    const choiceLabel = document.createElement('div');
                    choiceLabel.className = 'text-xs text-emerald-600 font-bold mb-2';
                    choiceLabel.textContent = 'Выбери ответ:';
                    choiceWrap.appendChild(choiceLabel);

                    let choiceAnswered = false;
                    line.options.forEach((opt, i) => {
                        const btn = document.createElement('button');
                        btn.className = 'w-full py-3 px-4 bg-white border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 hover:border-emerald-300 active:scale-[0.98] transition-all text-left mb-2';
                        btn.textContent = opt;
                        btn.addEventListener('click', () => {
                            if (choiceAnswered) return;
                            choiceAnswered = true;
                            const correct = i === line.correct;
                            btn.className = `w-full py-3 px-4 rounded-2xl text-sm font-semibold border-2 transition-all text-left mb-2 ${correct ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-red-300 text-red-700'}`;
                            if (!correct) {
                                dialogErrors++;
                                choiceWrap.children[line.correct + 1].className = 'w-full py-3 px-4 rounded-2xl text-sm font-semibold border-2 bg-emerald-50 border-emerald-500 text-emerald-700 transition-all text-left mb-2';
                            }
                            // Add the correct answer as a bubble
                            const bubble = document.createElement('div');
                            bubble.className = 'max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium bg-emerald-50 text-emerald-800 ml-auto animate-fade-in';
                            const speakerTag = document.createElement('div');
                            speakerTag.className = 'text-xs text-slate-400 font-bold mb-1';
                            speakerTag.textContent = line.speaker || 'Б';
                            bubble.prepend(speakerTag);
                            const textEl = document.createElement('div');
                            textEl.textContent = line.options[line.correct];
                            bubble.appendChild(textEl);

                            setTimeout(() => {
                                choiceWrap.remove();
                                chatWrap.appendChild(bubble);
                                lineIdx++;
                                setTimeout(renderNextLine, 500);
                            }, 800);
                        });
                        choiceWrap.appendChild(btn);
                    });
                    chatWrap.appendChild(choiceWrap);
                }
            }

            wrap.append(prompt, chatWrap);
            body.appendChild(wrap);
            renderNextLine();
        }

        // ---- QUIZ ----
        function renderCourseQuiz(body, ex) {
            const wrap = document.createElement('div');

            const isInfoOnly = (!ex.options || ex.options.length === 0) && !ex.question;

            const prompt = document.createElement('div');
            prompt.className = 'text-lg font-bold text-slate-800 mb-4';
            prompt.textContent = ex.question || ex.prompt || (isInfoOnly ? 'Прослушайте аудио' : 'Выберите правильный ответ');

            const optionsWrap = document.createElement('div');
            optionsWrap.className = 'flex flex-col gap-2';
            let answered = false;

            const rawOptions = ex.options || [ex.correct || 'Далее'];
            const options = Array.isArray(rawOptions) ? rawOptions : Object.values(rawOptions);
            const correctIdx = typeof ex.correct === 'number' ? ex.correct : options.indexOf(ex.correct || options[0]);

            options.forEach((opt, i) => {
                const isOnlyContinue = options.length === 1 && (opt === 'Далее' || isInfoOnly);
                const btn = document.createElement('button');
                btn.className = 'w-full py-3.5 px-5 bg-white border-2 border-slate-200 rounded-2xl text-base font-semibold text-slate-800 hover:border-emerald-300 active:scale-[0.98] transition-all text-left';
                if (isOnlyContinue) {
                    btn.className = 'w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-3xl text-base transition-colors shadow-md shadow-emerald-100 mt-4 text-center';
                }
                btn.textContent = opt;
                btn.addEventListener('click', () => {
                    if (answered) return;
                    answered = true;

                    if (isOnlyContinue) {
                        courseNextExercise(null);
                        return;
                    }

                    const correct = i === correctIdx;
                    btn.className = `w-full py-3.5 px-5 rounded-2xl text-base font-semibold border-2 transition-all text-left ${correct ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-red-300 text-red-700 animate-shake'}`;
                    if (!correct) {
                        optionsWrap.children[correctIdx].className = 'w-full py-3.5 px-5 rounded-2xl text-base font-semibold border-2 bg-emerald-50 border-emerald-500 text-emerald-700 transition-all text-left';
                    }
                    if (ex.explanation) {
                        const expl = document.createElement('div');
                        expl.className = `text-sm mt-4 px-4 py-3 rounded-2xl ${correct ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`;
                        expl.textContent = ex.explanation;
                        wrap.appendChild(expl);
                    }
                    courseShowContinueBtn(wrap, correct);
                });
                optionsWrap.appendChild(btn);
            });

            wrap.append(prompt);
            
            if (ex.audioUrl) {
                const playBtnWrap = document.createElement('div');
                playBtnWrap.className = 'flex justify-center mb-8 mt-4';
                const playBtn = document.createElement('button');
                playBtn.className = 'w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center text-4xl hover:bg-emerald-600 transition-transform active:scale-95 shadow-lg shadow-emerald-200';
                playBtn.innerHTML = '<i class="fa-solid fa-volume-up relative -left-0.5"></i>';
                playBtn.addEventListener('click', () => {
                    if (typeof speakWord === 'function') {
                        const path = ex.audioUrl.startsWith('alphabet/') 
                            ? `audio/${ex.audioUrl}` 
                            : `assets/audio/${ex.audioUrl}`;
                        speakWord(ex.lz || ex.ru || null, path);
                    }
                });
                playBtnWrap.appendChild(playBtn);
                
                if (ex.audioUrl === 'placeholder.mp3') {
                    const ttsWarning = document.createElement('div');
                    ttsWarning.className = 'text-xs text-amber-600 mt-2 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 font-medium text-center';
                    ttsWarning.textContent = '🔊 Автоматическая озвучка (может быть неточной)';
                    playBtnWrap.className = 'flex flex-col items-center mb-8 mt-4';
                    playBtnWrap.appendChild(ttsWarning);
                }
                
                wrap.append(playBtnWrap);
            }

            if (isInfoOnly && (ex.lz || ex.ru)) {
                const textWrap = document.createElement('div');
                textWrap.className = 'bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center mb-8 mt-2 animate-fade-in';
                if (ex.lz) {
                    const lzText = document.createElement('div');
                    lzText.className = 'text-2xl font-extrabold text-emerald-700 mb-2';
                    lzText.textContent = ex.lz;
                    textWrap.appendChild(lzText);
                }
                if (ex.ru) {
                    const ruText = document.createElement('div');
                    ruText.className = 'text-base text-slate-600 font-medium';
                    ruText.textContent = ex.ru;
                    textWrap.appendChild(ruText);
                }
                wrap.append(textWrap);
            }

            wrap.append(optionsWrap);
            body.appendChild(wrap);
        }

        // ---- CLASSIFYING ----
        function renderCourseClassifying(body, ex) {
            const wrap = document.createElement('div');
            wrap.className = 'flex flex-col h-full justify-between';

            const topSection = document.createElement('div');
            
            const prompt = document.createElement('div');
            prompt.className = 'text-lg font-bold text-slate-800 mb-6 text-center px-4';
            prompt.textContent = ex.prompt || 'К какой категории относится?';
            topSection.appendChild(prompt);

            const shuffledItems = shuffle([...ex.items]);
            let currentIndex = 0;
            let madeMistake = false;

            const itemContainer = document.createElement('div');
            itemContainer.className = 'flex justify-center items-center py-8 mb-6 px-4';
            topSection.appendChild(itemContainer);

            wrap.appendChild(topSection);

            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'flex flex-col gap-3 pb-4 px-4';
            wrap.appendChild(buttonsContainer);

            function renderCurrentItem() {
                itemContainer.innerHTML = '';
                buttonsContainer.innerHTML = '';

                if (currentIndex >= shuffledItems.length) {
                    const doneMsg = document.createElement('div');
                    doneMsg.className = 'text-2xl font-bold text-emerald-600 animate-bounce text-center';
                    doneMsg.textContent = 'Отлично!';
                    itemContainer.appendChild(doneMsg);
                    courseShowContinueBtn(wrap, !madeMistake);
                    return;
                }

                const item = shuffledItems[currentIndex];

                const card = document.createElement('div');
                card.className = 'px-8 py-10 bg-white border-2 border-slate-200 rounded-3xl text-2xl font-bold text-slate-800 shadow-sm text-center w-full max-w-sm';
                card.textContent = item.text;
                itemContainer.appendChild(card);

                ex.categories.forEach((cat, ci) => {
                    const btn = document.createElement('button');
                    btn.className = 'w-full py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-700 active:scale-95 transition-all shadow-sm';
                    btn.textContent = cat;
                    btn.addEventListener('click', () => {
                        const allBtns = buttonsContainer.querySelectorAll('button');
                        allBtns.forEach(b => b.disabled = true);

                        if (item.category === ci) {
                            btn.className = 'w-full py-4 bg-emerald-500 border-2 border-emerald-600 rounded-2xl text-base font-bold text-white transition-all shadow-sm';
                            card.className = 'px-8 py-10 bg-emerald-50 border-2 border-emerald-300 rounded-3xl text-2xl font-bold text-emerald-700 shadow-sm transition-all scale-105 text-center w-full max-w-sm';
                            
                            setTimeout(() => {
                                currentIndex++;
                                renderCurrentItem();
                            }, 600);
                        } else {
                            madeMistake = true;
                            btn.className = 'w-full py-4 bg-red-500 border-2 border-red-600 rounded-2xl text-base font-bold text-white animate-shake transition-all shadow-sm';
                            card.className = 'px-8 py-10 bg-red-50 border-2 border-red-300 rounded-3xl text-2xl font-bold text-red-700 shadow-sm transition-all text-center w-full max-w-sm animate-shake';
                            
                            setTimeout(() => {
                                allBtns.forEach(b => b.disabled = false);
                                btn.className = 'w-full py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-700 active:scale-95 transition-all shadow-sm';
                                card.className = 'px-8 py-10 bg-white border-2 border-slate-200 rounded-3xl text-2xl font-bold text-slate-800 shadow-sm text-center w-full max-w-sm';
                            }, 800);
                        }
                    });
                    buttonsContainer.appendChild(btn);
                });
                
                const progressText = document.createElement('div');
                progressText.className = 'text-sm font-semibold text-slate-400 text-center mt-4 mb-2';
                progressText.textContent = `${currentIndex + 1} / ${shuffledItems.length}`;
                buttonsContainer.appendChild(progressText);
            }

            renderCurrentItem();
            body.appendChild(wrap);
        }

        // ==================== COURSE RESULTS ====================

        function showCourseResults() {
            vibrateComplete();
            const modal = document.getElementById('practice-modal');
            const content = document.getElementById('practice-content');
            content.innerHTML = '';

            const total = courseExState.total;
            const score = courseExState.score;
            const pct = Math.round((score / total) * 100);
            const unitId = courseExState.unit.id;

            // Save progress only if score is at least 70%
            if (pct >= 70) {
                if (!COURSE_PROGRESS.completedUnits.includes(unitId)) {
                    COURSE_PROGRESS.completedUnits.push(unitId);
                }
            }
            COURSE_PROGRESS.scores[unitId] = Math.max(pct, COURSE_PROGRESS.scores[unitId] || 0);
            saveCourseProgress();

            const resWrap = document.createElement('div');
            resWrap.className = 'px-8 pt-10 pb-8 text-center flex flex-col items-center justify-center animate-fade-in';

            if (pct === 100) {
                const cupWrap = document.createElement('div');
                cupWrap.className = 'w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-200/50 shadow-md relative';
                cupWrap.innerHTML = '<i class="fa-solid fa-trophy text-5xl text-amber-500 animate-pulse"></i><span class="absolute -top-1 -right-1 text-2xl">🎉</span>';

                const title = document.createElement('h2');
                title.className = 'text-2xl font-extrabold text-emerald-850 tracking-tight leading-tight';
                title.textContent = 'Отличная работа!';

                const sub = document.createElement('p');
                sub.className = 'text-slate-500 text-sm mt-2 mb-6 max-w-[280px]';
                sub.textContent = 'Все задания выполнены на 100%! Юнит пройден!';

                resWrap.append(cupWrap, title, sub);
                for (let i = 0; i < 35; i++) createCelebrationParticle();
            } else if (pct >= 70) {
                const scoreCircle = document.createElement('div');
                scoreCircle.className = 'w-24 h-24 rounded-full flex items-center justify-center mb-6 border font-bold text-3xl shadow-sm bg-emerald-50 border-emerald-200 text-emerald-700';
                scoreCircle.textContent = `${pct}%`;

                const title = document.createElement('h2');
                title.className = 'text-xl font-extrabold text-slate-800 tracking-tight leading-tight';
                title.textContent = 'Юнит пройден!';

                const sub = document.createElement('p');
                sub.className = 'text-slate-500 text-sm mt-2 mb-6 max-w-[280px]';
                sub.textContent = 'Хороший результат! Следующий юнит разблокирован.';

                resWrap.append(scoreCircle, title, sub);
            } else {
                const scoreCircle = document.createElement('div');
                scoreCircle.className = 'w-24 h-24 rounded-full flex items-center justify-center mb-6 border font-bold text-3xl shadow-sm bg-slate-50 border-slate-200 text-slate-700';
                scoreCircle.textContent = `${pct}%`;

                const title = document.createElement('h2');
                title.className = 'text-xl font-extrabold text-slate-800 tracking-tight leading-tight';
                title.textContent = 'Продолжайте учиться!';

                const sub = document.createElement('p');
                sub.className = 'text-slate-500 text-sm mt-2 mb-6 max-w-[280px]';
                sub.textContent = 'Попробуйте ещё раз, чтобы набрать 70% и открыть следующий юнит!';

                resWrap.append(scoreCircle, title, sub);
            }

            const info = document.createElement('div');
            info.className = 'text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100/60 px-4 py-1.5 rounded-full';
            info.textContent = `Результат: ${score} из ${total}`;

            const actions = document.createElement('div');
            actions.className = 'mt-9 flex flex-col gap-3 w-full';

            const allUnits = COURSE.flatMap(m => m.units);
            const currentIdx = allUnits.findIndex(u => u.id === unitId);
            const nextUnit = (currentIdx !== -1 && currentIdx < allUnits.length - 1) ? allUnits[currentIdx + 1] : null;

            if (nextUnit && (pct >= 70 || isUnitUnlocked(nextUnit.id))) {
                const nextBtn = document.createElement('button');
                nextBtn.className = 'w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-3xl text-sm transition-colors shadow-md shadow-emerald-100';
                nextBtn.textContent = 'Продолжить';
                nextBtn.addEventListener('click', () => {
                    endPractice();
                    openCourseUnit(nextUnit);
                });
                actions.append(nextBtn);
            }

            const secondaryActions = document.createElement('div');
            secondaryActions.className = 'flex gap-3 w-full';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'flex-1 py-4 border border-slate-200 active:bg-slate-50 font-semibold rounded-3xl text-sm transition-colors';
            closeBtn.textContent = 'К курсу';
            closeBtn.addEventListener('click', () => {
                endPractice();
                renderCourseScreen();
            });

            const againBtn = document.createElement('button');
            if (nextUnit) {
                againBtn.className = 'flex-1 py-4 border border-emerald-200 active:bg-emerald-50 text-emerald-700 font-semibold rounded-3xl text-sm transition-colors';
            } else {
                againBtn.className = 'flex-1 py-4 bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-3xl text-sm transition-colors shadow-md shadow-emerald-100';
            }
            againBtn.textContent = 'Ещё раз';
            againBtn.addEventListener('click', () => {
                startCourseExercises(courseExState.unit);
            });

            secondaryActions.append(closeBtn, againBtn);
            actions.append(secondaryActions);
            resWrap.append(info, actions);
            content.appendChild(resWrap);
        }

