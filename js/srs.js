        const SRS_RATING = Object.freeze({ Again: 1, Hard: 2, Good: 3, Easy: 4 });

        function ensureSrsCard(wordId) {
            if (!PROGRESS.srs[wordId]) {
                PROGRESS.srs[wordId] = { next: 0, last: 0, ivl: 0, success: 0, errors: 0, ease: 2.5 };
            }
            const card = PROGRESS.srs[wordId];
            if (typeof card.ease !== 'number' || !Number.isFinite(card.ease)) card.ease = 2.5;
            card.ivl = Math.max(0, Number(card.ivl || 0));
            card.success = Math.max(0, Number(card.success || 0));
            card.errors = Math.max(0, Number(card.errors || 0));
            return card;
        }

        function reviewSrsCard(wordId, rating, now = Date.now()) {
            const card = ensureSrsCard(wordId);
            card.last = now;

            if (rating === SRS_RATING.Again) {
                card.errors += 1;
                card.success = 0;
                card.ease = Math.max(1.3, card.ease - 0.2);
                card.ivl = 0;
            } else if (rating === SRS_RATING.Hard) {
                card.errors += 1;
                card.ease = Math.max(1.3, card.ease - 0.15);
                card.ivl = Math.max(1, Math.round((card.ivl || 1) * 0.8));
            } else if (rating === SRS_RATING.Easy) {
                card.success += 1;
                card.ease = Math.min(3.2, card.ease + 0.1);
                if (card.ivl === 0) card.ivl = 2;
                else if (card.ivl === 1) card.ivl = 4;
                else card.ivl = Math.round(card.ivl * card.ease * 1.15);
            } else {
                card.success += 1;
                if (card.ivl === 0) card.ivl = 1;
                else if (card.ivl === 1) card.ivl = 3;
                else card.ivl = Math.round(card.ivl * card.ease);
            }

            card.ivl = Math.max(0, Math.min(card.ivl, 365));
            card.next = now + (card.ivl * 86400000);
            return card;
        }

        function getLearningSnapshot() {
            const now = Date.now();
            const words = WORDS || [];
            const due = words.filter(w => PROGRESS.srs[w.id] && PROGRESS.srs[w.id].next <= now && PROGRESS.srs[w.id].ivl > 0);
            const fresh = words.filter(w => !PROGRESS.srs[w.id] || PROGRESS.srs[w.id].ivl === 0);
            const weak = words.filter(w => {
                const card = PROGRESS.srs[w.id];
                return card && (card.errors > card.success || card.ease <= 1.8);
            });
            return { due, fresh, weak, total: words.length };
        }

        function updateTodayUI() {}

        const SHOW_PRACTICE_IPA = false;
        let practiceState = { words: [], idx: 0, score: 0, mode: '' };
        function startFlashcards() {
            const pool = practiceCategory === 'all' ? WORDS : WORDS.filter(w => w.cat === practiceCategory);
            const now = Date.now();
            // Получаем ВСЕ просроченные (сортируем от самых старых)
            let due = pool.filter(w => PROGRESS.srs[w.id] && PROGRESS.srs[w.id].next <= now && PROGRESS.srs[w.id].ivl > 0)
                .sort((a, b) => PROGRESS.srs[a.id].next - PROGRESS.srs[b.id].next);
            let unknown = shuffle(pool.filter(w => !PROGRESS.srs[w.id] || PROGRESS.srs[w.id].ivl === 0));

            const targetSessionSize = 25; // Увеличим размер сессии для удобства

            let initialWords = due.slice(0, targetSessionSize);
            // Добавляем новые/ошибочные слова только если просроченных недостаточно
            if (initialWords.length < targetSessionSize) {
                initialWords.push(...unknown.slice(0, targetSessionSize - initialWords.length));
            }

            // Если итоговая очередь слишком мала, прерываем
            if (initialWords.length < 3) {
                return alert('Вам пока нечего повторять в этой категории! Возвращайтесь позже.');
            }

            // Deduplicate just in case
            initialWords = Array.from(new Set(initialWords.map(w => w.id))).map(id => initialWords.find(w => w.id === id));

            practiceState = {
                words: initialWords,
                queue: [...initialWords],
                learnedInSession: new Set(),
                mistakesInSession: new Set(),
                seenInSession: new Set(),
                score: 0,
                mode: 'flashcards',
                attempts: 0
            };
            showFlashcard();
        }

        let flashcardKeydownHandler = null;

        function showFlashcard() {
            const modal = document.getElementById('practice-modal');
            const isAlreadyOpen = !modal.classList.contains('hidden');
            if (!isAlreadyOpen) {
                history.pushState({ modalOpen: true }, '');
            }

            const content = document.getElementById('practice-content');
            content.innerHTML = '';

            const MAX_ATTEMPTS = practiceState.words.length * 3;
            if (practiceState.queue.length === 0 || practiceState.attempts >= MAX_ATTEMPTS) {
                // practiceState.score already holds the correct count of words marked 'easy' on the first try
                showResults();
                return;
            }

            const w = practiceState.queue[0];
            const total = practiceState.words.length;
            const learned = practiceState.learnedInSession.size;
            const progress = Math.round((learned / total) * 100);

            const header = document.createElement('div');
            header.className = 'app-header relative flex items-center justify-center px-16 py-4 border-b border-slate-100 bg-white shrink-0 z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg text-center w-full truncate';
            hTitle.textContent = `Карточки ${learned}/${total}`;
            const close = document.createElement('button');
            close.id = 'srs-close-btn';
            close.className = 'hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(hTitle, close);

            const body = document.createElement('div');
            body.className = 'p-6 flex flex-col items-center';

            const flip = document.createElement('div');
            flip.className = 'flip-card w-full max-w-[300px]';
            flip.id = 'flip-card';
            const inner = document.createElement('div');
            inner.className = 'flip-card-inner bg-white border border-emerald-100 rounded-3xl';

            const front = document.createElement('div');
            front.className = 'flip-card-front flex flex-col justify-center items-center p-8 text-center';
            const fTop = document.createElement('div');
            fTop.className = 'text-emerald-600 text-sm tracking-widest mb-4';
            fTop.textContent = 'ЛЕЗГИНСКИЙ';
            const fWord = document.createElement('div');
            fWord.className = 'text-5xl font-bold text-emerald-900 lezgin-text';
            fWord.textContent = w.lz;
            front.append(fTop, fWord);
            if (SHOW_PRACTICE_IPA && w.ipa) {
                const ipa = document.createElement('div');
                ipa.className = 'mt-2 text-emerald-700 opacity-70 text-base ipa-text';
                ipa.textContent = w.ipa;
                front.appendChild(ipa);
            }

            const back = document.createElement('div');
            back.className = 'flip-card-back flex flex-col justify-center items-center p-8 bg-emerald-50 text-center rounded-3xl border border-emerald-100';
            const bTop = document.createElement('div');
            bTop.className = 'text-emerald-600 text-sm tracking-widest mb-4';
            bTop.textContent = 'ПЕРЕВОД';
            const bWord = document.createElement('div');
            bWord.className = 'text-4xl font-semibold text-emerald-900';
            bWord.textContent = w.ru;
            back.append(bTop, bWord);
            if (w.ex) {
                const ex = document.createElement('div');
                ex.className = 'mt-4 text-base text-slate-600 italic';
                ex.textContent = w.ex;
                back.appendChild(ex);
            }

            inner.append(front, back);
            flip.appendChild(inner);
            flip.addEventListener('click', () => flip.classList.toggle('flipped'));

            const actions = document.createElement('div');
            actions.className = 'flex gap-2 mt-8 w-full max-w-[300px]';

            const createBtn = (cls, icon, txt, mode) => {
                const b = document.createElement('button');
                b.className = `flex-1 py-4 font-bold rounded-2xl text-xs uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${cls}`;
                b.innerHTML = `<i class="fa-solid ${icon} text-xl"></i><span>${txt}</span>`;
                b.addEventListener('click', () => markCard(mode));
                return b;
            };

            actions.append(
                createBtn('border-2 border-red-100 text-red-600', 'fa-times', 'Не знаю', 'wrong'),
                createBtn('border-2 border-amber-100 text-amber-600', 'fa-rotate-right', 'Повторить', 'hard'),
                createBtn('bg-emerald-600 text-white', 'fa-check', 'Изучено', 'easy')
            );

            const progWrap = document.createElement('div');
            progWrap.className = 'w-full max-w-[300px] mt-8 text-center';
            const progBg = document.createElement('div');
            progBg.className = 'h-1 bg-emerald-100 rounded-full overflow-hidden';
            const progBar = document.createElement('div');
            progBar.className = 'h-1 bg-emerald-600 transition-all';
            progBar.style.width = `${progress}%`;
            progBg.appendChild(progBar);
            const queueInfo = document.createElement('div');
            queueInfo.className = 'text-xs text-slate-400 mt-2 font-medium';
            queueInfo.textContent = `Слов в очереди: ${practiceState.queue.length}`;
            progWrap.append(progBg, queueInfo);

            body.append(flip, actions, progWrap);
            content.append(header, body);

            modal.classList.remove('hidden');
            modal.classList.add('flex');

            if (flashcardKeydownHandler) {
                document.removeEventListener('keydown', flashcardKeydownHandler);
            }
            flashcardKeydownHandler = (e) => {
                if (e.key === 'Escape') {
                    endPractice();
                    return;
                }
                const isFlashcard = document.getElementById('flip-card');
                if (isFlashcard) {
                    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); document.getElementById('flip-card')?.classList.toggle('flipped'); }
                    if (e.key === '1') markCard('wrong');
                    if (e.key === '2') markCard('hard');
                    if (e.key === '3') markCard('easy');
                }
            };
            document.addEventListener('keydown', flashcardKeydownHandler);
        }
        function markCard(status) {
            const w = practiceState.queue.shift();
            if (!w) {
                showResults();
                return;
            }

            practiceState.attempts = (practiceState.attempts || 0) + 1;
            const isFirstSeen = !practiceState.seenInSession.has(w.id);
            practiceState.seenInSession.add(w.id);

            if (status === 'easy') {
                vibrateSuccess();
                practiceState.learnedInSession.add(w.id);
                reviewSrsCard(w.id, isFirstSeen ? SRS_RATING.Easy : SRS_RATING.Good);
                if (isFirstSeen) practiceState.score++;
                if (!PROGRESS.learned.includes(w.id)) PROGRESS.learned.push(w.id);
            } else if (status === 'hard') {
                practiceState.mistakesInSession.add(w.id);
                practiceState.queue.push(w);
                reviewSrsCard(w.id, SRS_RATING.Hard);
            } else {
                vibrateError();
                practiceState.mistakesInSession.add(w.id);
                practiceState.queue.push(w);
                reviewSrsCard(w.id, SRS_RATING.Again);
                const idx = PROGRESS.learned.indexOf(w.id);
                if (idx > -1) PROGRESS.learned.splice(idx, 1);
            }

            saveProgress();
            updateTodayUI();
            showFlashcard();
        }
        function startQuiz() {
            const pool = practiceCategory === 'all' ? WORDS : WORDS.filter(w => w.cat === practiceCategory);

            practiceState = {
                words: shuffle([...pool]).slice(0, 10),
                idx: 0,
                score: 0,
                mode: 'quiz'
            };
            showQuizQuestion();
        }
        function showQuizQuestion() {
            const modal = document.getElementById('practice-modal');
            const isAlreadyOpen = !modal.classList.contains('hidden');
            if (!isAlreadyOpen) {
                history.pushState({ modalOpen: true }, '');
            }

            const modal_el = document.getElementById('practice-modal'); // Keep original variable binding
            const content = document.getElementById('practice-content');
            const w = practiceState.words[practiceState.idx];
            content.innerHTML = ''; // Очищаем контент

            const progress = Math.round((practiceState.idx / practiceState.words.length) * 100);
            const allRu = WORDS.map(x => x.ru);
            let opts = [w.ru];
            while (opts.length < 4) {
                const r = allRu[Math.floor(Math.random() * allRu.length)];
                if (!opts.includes(r)) opts.push(r);
            }
            shuffle(opts);

            const header = document.createElement('div');
            header.className = 'app-header relative flex items-center justify-center px-16 py-4 border-b border-slate-100 bg-white shrink-0 z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg text-center w-full truncate';
            hTitle.textContent = `Тест ${practiceState.idx + 1}/${practiceState.words.length}`;
            const close = document.createElement('button');
            close.id = 'srs-close-btn-quiz';
            close.className = 'hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(hTitle, close);

            const body = document.createElement('div');
            body.className = 'p-6';
            const qWrap = document.createElement('div');
            qWrap.className = 'text-center mb-8';
            const qTop = document.createElement('div');
            qTop.className = 'text-sm text-emerald-600 tracking-widest';
            qTop.textContent = 'ЧТО ЗНАЧИТ';
            const qWord = document.createElement('div');
            qWord.className = 'text-[42px] font-bold text-emerald-900 lezgin-text mt-3';
            qWord.textContent = w.lz;
            qWrap.append(qTop, qWord);

            const optsWrap = document.createElement('div');
            optsWrap.className = 'space-y-3';
            opts.forEach(opt => {
                const b = document.createElement('button');
                b.className = 'quiz-btn w-full text-left px-5 py-4 border border-slate-200 active:border-emerald-300 rounded-3xl flex items-center justify-between transition-colors';
                const span = document.createElement('span');
                span.className = 'font-medium';
                span.textContent = opt;
                const icon = document.createElement('i');
                icon.className = 'fa-solid fa-chevron-right text-emerald-300';
                b.appendChild(span);
                b.appendChild(icon);
                b.addEventListener('click', () => checkAnswer(opt, w.ru, b));
                optsWrap.appendChild(b);
            });

            const progWrap = document.createElement('div');
            progWrap.className = 'mt-8';
            const progBg = document.createElement('div');
            progBg.className = 'h-1 bg-emerald-100 rounded-full overflow-hidden';
            const progBar = document.createElement('div');
            progBar.className = 'h-1 bg-emerald-600 transition-all';
            progBar.style.width = `${progress}%`;
            progBg.appendChild(progBar);
            progWrap.appendChild(progBg);

            body.append(qWrap, optsWrap, progWrap);
            content.append(header, body);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        function checkAnswer(selected, correct, btn) {
            btn.parentElement.classList.add('pointer-events-none');
            const allBtns = btn.parentElement.querySelectorAll('button');
            allBtns.forEach(b => b.disabled = true);

            if (selected === correct) {
                vibrateSuccess();
                practiceState.score++;
                btn.classList.add('!border-emerald-500', '!bg-emerald-50', 'text-emerald-700');

                const word = practiceState.words[practiceState.idx];
                reviewSrsCard(word.id, SRS_RATING.Good);
                if (!PROGRESS.learned.includes(word.id)) {
                    PROGRESS.learned.push(word.id);
                }
            } else {
                vibrateError();
                btn.classList.add('!border-red-300', '!bg-red-50', 'text-red-600');
                allBtns.forEach(b => {
                    if (b.textContent.trim() === correct) {
                        b.classList.add('!border-emerald-500', '!bg-emerald-50', 'text-emerald-700');
                    }
                });

                const word = practiceState.words[practiceState.idx];
                reviewSrsCard(word.id, SRS_RATING.Again);
                const learnedIdx = PROGRESS.learned.indexOf(word.id);
                if (learnedIdx > -1) PROGRESS.learned.splice(learnedIdx, 1);
            }

            saveProgress();
            updateTodayUI();

            setTimeout(() => {
                practiceState.idx++;
                if (practiceState.idx >= practiceState.words.length) {
                    showResults();
                } else {
                    showQuizQuestion();
                }
            }, 1500);
        }
        function createCelebrationParticle() {
            const emojis = ['🎉', '✨', '🌟', '🏆', '👏', '🥳', '💯'];
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            const el = document.createElement('div');
            el.className = 'fixed pointer-events-none text-3xl select-none z-[9999]';
            el.textContent = emoji;

            const startX = Math.random() * 100;
            el.style.left = `${startX}%`;
            el.style.bottom = `-50px`;
            el.style.opacity = '1';

            const duration = 2 + Math.random() * 2;
            const delay = Math.random() * 0.5;
            const size = 20 + Math.random() * 25;

            el.style.fontSize = `${size}px`;
            el.style.transition = `transform ${duration}s cubic-bezier(0.1, 0.8, 0.3, 1), opacity ${duration}s ease-out`;
            el.style.transitionDelay = `${delay}s`;

            document.body.appendChild(el);

            requestAnimationFrame(() => {
                const endY = window.innerHeight + 100;
                const endXMove = (Math.random() - 0.5) * 200;
                el.style.transform = `translate(${endXMove}px, -${endY}px) rotate(${Math.random() * 360}deg)`;
                el.style.opacity = '0';
            });

            setTimeout(() => {
                el.remove();
            }, (duration + delay) * 1000 + 100);
        }

        function showResults() {
            vibrateComplete();
            const modal = document.getElementById('practice-modal');
            const content = document.getElementById('practice-content');
            content.innerHTML = '';

            const total = practiceState.words.length;
            const pct = Math.round((practiceState.score / total) * 100);

            PROGRESS.stats.quizzes++;
            PROGRESS.stats.scoreSum += pct;
            saveProgress();

            const resWrap = document.createElement('div');
            resWrap.className = 'app-header px-8 pt-10 pb-8 text-center flex flex-col items-center justify-center animate-fade-in';

            if (pct === 100) {
                const cupWrap = document.createElement('div');
                cupWrap.className = 'w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-200/50 shadow-md relative';
                cupWrap.innerHTML = '<i class="fa-solid fa-trophy text-5xl text-amber-500 animate-pulse"></i><span class="absolute -top-1 -right-1 text-2xl">🎉</span>';

                const title = document.createElement('h2');
                title.className = 'text-2xl font-extrabold text-emerald-850 tracking-tight leading-tight';
                title.textContent = 'Отличная работа!';

                const sub = document.createElement('p');
                sub.className = 'text-slate-500 text-sm mt-2 mb-6 max-w-[280px]';
                sub.textContent = 'Вы блестяще справились со всеми заданиями на 100%! Лезгинский язык гордится вами!';

                resWrap.append(cupWrap, title, sub);

                for (let i = 0; i < 35; i++) {
                    createCelebrationParticle();
                }
            } else {
                const scoreCircle = document.createElement('div');
                scoreCircle.className = `w-24 h-24 rounded-full flex items-center justify-center mb-6 border font-bold text-3xl shadow-sm ${pct >= 70 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`;
                scoreCircle.textContent = `${pct}%`;

                const title = document.createElement('h2');
                title.className = 'text-xl font-extrabold text-slate-800 tracking-tight leading-tight';
                title.textContent = pct >= 70 ? 'Хороший результат!' : 'Продолжайте учиться!';

                const sub = document.createElement('p');
                sub.className = 'text-slate-500 text-sm mt-2 mb-6 max-w-[280px]';
                sub.textContent = pct >= 70 ? 'Отличный шаг к уверенному владению языком. Повторите ещё раз, чтобы закрепить результат!' : 'Ничего страшного! Ошибки — это часть обучения. Попробуйте ещё раз!';

                resWrap.append(scoreCircle, title, sub);
            }

            const info = document.createElement('div');
            info.className = 'text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100/60 px-4 py-1.5 rounded-full';
            info.textContent = `Результат: ${practiceState.score} из ${total}`;

            const actions = document.createElement('div');
            actions.className = 'mt-9 flex gap-3 w-full';
            const close = document.createElement('button');
            close.className = 'flex-1 py-4 border border-slate-200 active:bg-slate-50 font-semibold rounded-3xl text-sm transition-colors';
            close.textContent = 'Закрыть';
            close.addEventListener('click', endPractice);
            const again = document.createElement('button');
            again.className = 'flex-1 py-4 bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-3xl text-sm transition-colors shadow-md shadow-emerald-100';
            again.textContent = 'Ещё раз';
            again.addEventListener('click', restartPractice);
            actions.append(close, again);

            resWrap.append(info, actions);
            content.appendChild(resWrap);
        }
        function restartPractice() {
            if (practiceState.mode === 'flashcards') startFlashcards();
            else if (practiceState.mode === 'pairs') startPairs();
            else if (practiceState.mode === 'oddWord') startOddWord();
            else if (practiceState.mode === 'grammar') startGrammarExercises(GRAMMAR.find(u => u.id === practiceState.unitId) || GRAMMAR[0]);
            else startQuiz();
        }

        function endPractice() {
            const modal = document.getElementById('practice-modal');
            if (modal && !modal.classList.contains('hidden')) {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
                if (flashcardKeydownHandler) {
                    document.removeEventListener('keydown', flashcardKeydownHandler);
                    flashcardKeydownHandler = null;
                }
                renderWords(); // Refresh dictionary list
                if (!isClosingProgrammatically && history.state && history.state.modalOpen) {
                    history.back();
                }
            }
        }
        function startPairs() {
            const pool = practiceCategory === 'all' ? WORDS : WORDS.filter(w => w.cat === practiceCategory);

            const selectedWords = shuffle([...pool]).slice(0, 5);

            practiceState = {
                words: selectedWords,
                leftItems: shuffle(selectedWords.map(w => ({ id: w.id, text: w.lz, type: 'lz' }))),
                rightItems: shuffle(selectedWords.map(w => ({ id: w.id, text: w.ru, type: 'ru' }))),
                selectedLeft: null,
                selectedRight: null,
                matchedIds: [],
                score: 0,
                mode: 'pairs'
            };
            showPairsGame();
        }
        function showPairsGame() {
            const modal = document.getElementById('practice-modal');
            const isAlreadyOpen = !modal.classList.contains('hidden');
            if (!isAlreadyOpen) {
                history.pushState({ modalOpen: true }, '');
            }

            const content = document.getElementById('practice-content');
            content.innerHTML = '';

            const progress = Math.round((practiceState.matchedIds.length / practiceState.words.length) * 100);

            const header = document.createElement('div');
            header.className = 'app-header relative flex items-center justify-center px-16 py-4 border-b border-slate-100 bg-white shrink-0 z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg text-center w-full truncate';
            hTitle.textContent = `Пары ${practiceState.matchedIds.length}/${practiceState.words.length}`;
            const close = document.createElement('button');
            close.id = 'srs-close-btn-pairs';
            close.className = 'hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(hTitle, close);

            const body = document.createElement('div');
            body.className = 'p-6 flex flex-col h-full';

            const grid = document.createElement('div');
            grid.className = 'flex gap-4 flex-1';

            const createCol = (items, side, selId) => {
                const col = document.createElement('div');
                col.className = 'flex-1 flex flex-col gap-3';
                items.forEach(item => {
                    const b = document.createElement('button');
                    b.className = 'flex-1 min-h-[56px] px-3 py-2 border-2 rounded-2xl text-sm transition-all break-words';
                    b.id = `pair-${side}-${item.id}`;
                    b.textContent = item.text;
                    if (practiceState.matchedIds.includes(item.id)) {
                        b.classList.add('opacity-0', 'pointer-events-none');
                    } else if (selId === item.id) {
                        b.classList.add('border-emerald-500', 'bg-emerald-50');
                    } else {
                        b.classList.add('border-slate-200', 'bg-white');
                    }
                    b.addEventListener('click', () => selectPairItem(side, item.id));
                    col.appendChild(b);
                });
                return col;
            };

            grid.appendChild(createCol(practiceState.leftItems, 'left', practiceState.selectedLeft));
            grid.appendChild(createCol(practiceState.rightItems, 'right', practiceState.selectedRight));

            const progWrap = document.createElement('div');
            progWrap.className = 'mt-8 mb-2';
            const progBg = document.createElement('div');
            progBg.className = 'h-1 bg-emerald-100 rounded-full overflow-hidden';
            const progBar = document.createElement('div');
            progBar.className = 'h-1 bg-emerald-600 transition-all';
            progBar.style.width = `${progress}%`;
            progBg.appendChild(progBar);
            progWrap.appendChild(progBg);

            body.append(grid, progWrap);
            content.append(header, body);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        function selectPairItem(side, id) {
            const leftTrigger = `pair-left-${id}`;
            const rightTrigger = `pair-right-${id}`;

            if (side === 'left') {
                if (practiceState.selectedLeft === id) practiceState.selectedLeft = null;
                else practiceState.selectedLeft = id;
            } else {
                if (practiceState.selectedRight === id) practiceState.selectedRight = null;
                else practiceState.selectedRight = id;
            }

            showPairsGame();

            if (practiceState.selectedLeft && practiceState.selectedRight) {
                const leftBtn = document.getElementById('pair-left-' + practiceState.selectedLeft);
                const rightBtn = document.getElementById('pair-right-' + practiceState.selectedRight);
                const isMatch = practiceState.selectedLeft === practiceState.selectedRight;

                if (isMatch) {
                    leftBtn.classList.replace('border-emerald-500', 'border-green-500');
                    leftBtn.classList.add('bg-green-100', 'text-green-800');
                    rightBtn.classList.replace('border-emerald-500', 'border-green-500');
                    rightBtn.classList.add('bg-green-100', 'text-green-800');

                    practiceState.score++;
                    const matchedId = practiceState.selectedLeft;

                    if (!PROGRESS.learned.includes(matchedId)) {
                        PROGRESS.learned.push(matchedId);
                    }

                    practiceState.selectedLeft = null;
                    practiceState.selectedRight = null;

                    // Плавное исчезновение через 0.5 секунды
                    setTimeout(() => {
                        leftBtn.classList.add('opacity-0', 'transition-opacity', 'duration-500', 'ease-out');
                        rightBtn.classList.add('opacity-0', 'transition-opacity', 'duration-500', 'ease-out');
                    }, 500);

                    // Перерисовка игры после окончания анимации исчезновения (1 секунда суммарно)
                    setTimeout(() => {
                        practiceState.matchedIds.push(matchedId);

                        reviewSrsCard(matchedId, SRS_RATING.Good);

                        saveProgress();

                        if (practiceState.matchedIds.length === practiceState.words.length) {
                            showResults();
                        } else {
                            showPairsGame();
                        }
                    }, 1000);
                } else {
                    vibrateError();
                    leftBtn.classList.replace('border-emerald-500', 'border-red-500');
                    leftBtn.classList.replace('bg-emerald-50', 'bg-red-50');
                    leftBtn.classList.replace('text-emerald-700', 'text-red-700');
                    rightBtn.classList.replace('border-emerald-500', 'border-red-500');
                    rightBtn.classList.replace('bg-emerald-50', 'bg-red-50');
                    rightBtn.classList.replace('text-emerald-700', 'text-red-700');

                    leftBtn.style.animation = 'shake 0.4s';
                    rightBtn.style.animation = 'shake 0.4s';
                    reviewSrsCard(practiceState.selectedLeft, SRS_RATING.Hard);
                    reviewSrsCard(practiceState.selectedRight, SRS_RATING.Hard);
                    saveProgress();
                    updateTodayUI();

                    practiceState.selectedLeft = null;
                    practiceState.selectedRight = null;

                    setTimeout(() => {
                        showPairsGame();
                    }, 500);
                }
            }
        }
        function startOddWord() {
            const allCats = [...new Set(WORDS.map(w => w.cat))]; // Используем WORDS

            practiceState = {
                questions: [],
                idx: 0,
                score: 0,
                mode: 'oddWord'
            };

            for (let i = 0; i < 10; i++) {
                let targetCat = practiceCategory === 'all' ? allCats[Math.floor(Math.random() * allCats.length)] : practiceCategory; // Используем state
                let targetWords = WORDS.filter(w => w.cat === targetCat); // Используем WORDS

                if (targetWords.length < 3) {
                    const validCats = allCats.filter(c => WORDS.filter(w => w.cat === c).length >= 3); // Используем WORDS
                    targetCat = validCats[Math.floor(Math.random() * validCats.length)]; // Используем WORDS
                    targetWords = WORDS.filter(w => w.cat === targetCat); // Используем WORDS
                }

                const correctWords = shuffle([...targetWords]).slice(0, 3);
                const otherCats = allCats.filter(c => c !== targetCat);
                const oddCat = otherCats[Math.floor(Math.random() * otherCats.length)];
                const oddWord = shuffle(WORDS.filter(w => w.cat === oddCat))[0];

                const options = shuffle([...correctWords, oddWord]);

                practiceState.questions.push({
                    options: options,
                    oddWordId: oddWord.id,
                    cat: targetCat
                });
            }

            showOddWordQuestion();
        }
        function showOddWordQuestion() {
            const modal = document.getElementById('practice-modal');
            const isAlreadyOpen = !modal.classList.contains('hidden');
            if (!isAlreadyOpen) {
                history.pushState({ modalOpen: true }, '');
            }

            const content = document.getElementById('practice-content');
            const q = practiceState.questions[practiceState.idx];
            content.innerHTML = '';

            const progress = Math.round((practiceState.idx / practiceState.questions.length) * 100);

            const header = document.createElement('div');
            header.className = 'app-header relative flex items-center justify-center px-16 py-4 border-b border-slate-100 bg-white shrink-0 z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg text-center w-full truncate';
            hTitle.textContent = `Лишнее слово ${practiceState.idx + 1}/${practiceState.questions.length}`;
            const close = document.createElement('button');
            close.id = 'srs-close-btn-odd';
            close.className = 'hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(hTitle, close);

            const body = document.createElement('div');
            body.className = 'p-6';
            const qWrap = document.createElement('div');
            qWrap.className = 'grid grid-cols-1 gap-3';
            q.options.forEach(opt => {
                const b = document.createElement('button');
                b.className = 'odd-btn w-full text-left px-5 py-4 border-2 border-slate-100 rounded-3xl flex items-center justify-between transition-all bg-white';
                b.dataset.id = opt.id;

                const textWrap = document.createElement('div');
                const lzDiv = document.createElement('div');
                lzDiv.className = 'font-bold lezgin-text text-xl text-emerald-900';
                lzDiv.textContent = opt.lz;
                const ruDiv = document.createElement('div');
                ruDiv.className = 'text-sm text-slate-400 mt-0.5';
                ruDiv.textContent = opt.ru;
                textWrap.appendChild(lzDiv);
                textWrap.appendChild(ruDiv);

                const icon = document.createElement('i');
                icon.className = 'fa-regular fa-circle text-slate-200 text-xl';

                b.appendChild(textWrap);
                b.appendChild(icon);
                b.addEventListener('click', () => checkOddWord(opt.id, b));
                qWrap.appendChild(b);
            });

            const progWrap = document.createElement('div');
            progWrap.className = 'mt-10';
            const progBg = document.createElement('div');
            progBg.className = 'h-1 bg-emerald-100 rounded-full overflow-hidden';
            const progBar = document.createElement('div');
            progBar.className = 'h-1 bg-emerald-600 transition-all';
            progBar.style.width = `${progress}%`;
            progBg.appendChild(progBar);
            progWrap.appendChild(progBg);

            body.append(qWrap, progWrap);
            content.append(header, body);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        function checkOddWord(selectedId, btn) {
            btn.parentElement.classList.add('pointer-events-none');
            const q = practiceState.questions[practiceState.idx];
            const allBtns = btn.parentElement.querySelectorAll('button');
            allBtns.forEach(b => b.disabled = true);

            if (selectedId === q.oddWordId) {
                practiceState.score++;
                btn.classList.add('!border-emerald-500', '!bg-emerald-50');
                btn.querySelector('i').className = 'fa-solid fa-check-circle text-emerald-500 text-xl';

                const word = WORDS.find(w => w.id === selectedId);
                if (word) {
                    reviewSrsCard(word.id, SRS_RATING.Good);
                    if (!PROGRESS.learned.includes(word.id)) {
                        PROGRESS.learned.push(word.id);
                    }
                }
            } else {
                vibrateError();
                reviewSrsCard(selectedId, SRS_RATING.Hard);
                btn.classList.add('!border-red-300', '!bg-red-50');
                btn.querySelector('i').className = 'fa-solid fa-times-circle text-red-400 text-xl';

                allBtns.forEach(b => {
                    if (b.dataset.id === q.oddWordId) {
                        b.classList.add('!border-emerald-500', '!bg-emerald-50');
                        b.querySelector('i').className = 'fa-solid fa-check-circle text-emerald-500 text-xl';
                    }
                });
            }

            saveProgress();
            updateTodayUI();

            setTimeout(() => {
                practiceState.idx++;
                if (practiceState.idx >= practiceState.questions.length) {
                    practiceState.words = practiceState.questions;
                    showResults();
                } else {
                    showOddWordQuestion();
                }
            }, 1500);
        }

        function addToPractice(wordId) {
            const word = WORDS.find(w => w.id === wordId); // Используем WORDS
            if (!word) return;

            let unknown = WORDS.filter(w => w.id !== wordId && !PROGRESS.learned.includes(w.id)); // Используем WORDS, PROGRESS.learned
            if (unknown.length < 9) {
                // Fill up with already learned words if necessary
                const learned = shuffle(WORDS.filter(w => w.id !== wordId && PROGRESS.learned.includes(w.id))); // Используем WORDS, PROGRESS.learned
                unknown.push(...learned.slice(0, 9 - unknown.length));
            }

            const others = shuffle(unknown).slice(0, 9);
            const initialWords = [word, ...others];

            practiceState = {
                words: initialWords,
                queue: [...initialWords],
                learnedInSession: new Set(),
                mistakesInSession: new Set(),
                seenInSession: new Set(),
                score: 0,
                mode: 'flashcards',
                attempts: 0,
                totalMistakes: 0
            };
            showFlashcard();
        }
