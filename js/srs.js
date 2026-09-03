        const SRS_RATING = Object.freeze({ Again: 1, Hard: 2, Good: 3, Easy: 4 });

        function capitalizeWord(str) {
            if (!str || typeof str !== 'string') return '';
            const t = str.trim();
            if (!t) return '';
            return t.charAt(0).toUpperCase() + t.slice(1);
        }

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
            const hasNextCard = practiceState.queue.length > 1;
            const total = practiceState.words.length;
            const learned = practiceState.learnedInSession.size;
            const progress = Math.round((learned / total) * 100);

            const badgeHtml = w.cat ? `<span class="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">${w.cat}</span>` : `<span class="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">Слово</span>`;
            const tr = w.lz_lat || (typeof transliterateLezgin === 'function' ? transliterateLezgin(w.lz) : '');
            let metaHtml = '';
            if (SHOW_PRACTICE_IPA && w.ipa && tr) {
                metaHtml = `<p class="flashcard-text-sub font-medium text-slate-400 mt-2">${tr} <span class="opacity-50 mx-1">•</span> <span class="ipa-text">[${w.ipa}]</span></p>`;
            } else if (SHOW_PRACTICE_IPA && w.ipa) {
                metaHtml = `<p class="flashcard-text-sub font-medium text-slate-400 ipa-text mt-2">[${w.ipa}]</p>`;
            } else if (tr) {
                metaHtml = `<p class="flashcard-text-sub font-medium text-slate-400 mt-2">${tr}</p>`;
            }
            const formatExampleHTML = (exStr) => {
                if (!exStr) return '';
                return exStr.split('//').map(s => s.trim()).filter(Boolean).map(item => {
                    const parts = item.split('|').map(s => s.trim()).filter(Boolean);
                    const lz = parts[0] || '';
                    const ru = parts[1] || '';
                    return ru ? `<b>${lz}</b> <span class="text-slate-400 font-normal">— ${ru}</span>` : `<b>${lz}</b>`;
                }).join('<br>');
            };
            const exHtml = w.ex ? `<div class="mt-3 text-xs sm:text-sm font-medium text-slate-700 leading-relaxed break-words bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100/40 text-left">${formatExampleHTML(w.ex)}</div>` : '';

            content.innerHTML = `
<div class="flex flex-col h-full w-full max-w-md practice-card-container mx-auto px-5 py-4 justify-between font-sans relative overflow-hidden" style="height: 100%;">
  <!-- Верхняя панель и прогресс -->
  <div class="space-y-2.5 pt-1 shrink-0">
    <div class="flex items-center justify-between">
      <button id="srs-close-btn" class="hidden md:flex w-9 h-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 active:scale-95">✕</button>
      <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Лезгинский язык</span>
      <span class="text-sm font-bold text-slate-700">${learned} / ${total}</span>
    </div>
    <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
      <div class="h-full bg-emerald-500 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
    </div>
  </div>

  <!-- Карточка слова -->
  <div class="relative w-full flex items-center justify-center flex-1 min-h-0 py-4">
    <div id="flip-card" class="flip-card swipe-card-wrapper w-full h-full relative z-10">
      
      <!-- Индикаторы свайпа (минималистичный стиль) -->
      <div id="swipe-badge-easy" class="swipe-badge swipe-badge-easy">
        <i class="fa-solid fa-check text-[11px]"></i><span>Помню</span>
      </div>
      <div id="swipe-badge-wrong" class="swipe-badge swipe-badge-wrong">
        <i class="fa-solid fa-xmark text-[11px]"></i><span>Не помню</span>
      </div>
      <div id="swipe-badge-hard" class="swipe-badge swipe-badge-hard">
        <i class="fa-solid fa-arrows-up-down text-[10px]"></i><span>Сложно</span>
      </div>

      <div class="flip-card-inner relative w-full h-full transition-transform duration-500 transform-style-preserve-3d rounded-3xl">

        <!-- Front: grid с 3 зонами одинаковой высоты -->
        <div class="flip-card-front absolute inset-0 w-full h-full backface-hidden bg-white rounded-3xl border border-slate-100 relative"
             style="display: grid; grid-template-rows: 79px 1fr 44px; padding: 0 1.5rem;">
          <!-- Зона 1: бейдж категории (слева) и кнопка жалобы (справа) -->
          <div class="flex items-center justify-between pt-4">
            ${badgeHtml}
            <button class="srs-report-btn z-30" title="Сообщить об ошибке">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </button>
          </div>
          <!-- Зона 2: слово по центру -->
          <div class="flex flex-col items-center justify-center text-center pointer-events-none select-none">
            <h1 class="flashcard-text-main font-extrabold text-slate-900 tracking-tight lezgin-text break-words leading-tight">${w.lz}</h1>
            ${metaHtml ? `<div class="mt-1.5">${metaHtml}</div>` : ''}
          </div>
          <!-- Зона 3: подсказка нажатия -->
          <div class="flex items-center justify-center pb-3 text-slate-400/80 dark:text-slate-500 text-xs select-none">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/60 dark:bg-white/5 font-medium"><i class="fa-solid fa-rotate text-[10px]"></i> Нажмите, чтобы перевернуть</span>
          </div>
        </div>

        <!-- Back: та же сетка -->
        <div class="flip-card-back absolute inset-0 w-full h-full backface-hidden bg-emerald-50 rounded-3xl border border-emerald-100 relative"
             style="display: grid; grid-template-rows: 79px 1fr 44px; padding: 0 1.5rem;">
          <!-- Зона 1: бейдж "Перевод" (слева) и кнопка жалобы (справа) -->
          <div class="flex items-center justify-between pt-4">
            <span class="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">Перевод</span>
            <button class="srs-report-btn z-30" title="Сообщить об ошибке">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </button>
          </div>
          <!-- Зона 2: перевод строго в том же месте что и слово -->
          <div class="flex flex-col items-center justify-center text-center pointer-events-none select-none">
            <h1 class="flashcard-text-main font-extrabold text-emerald-900 tracking-tight break-words leading-tight">${w.ru}</h1>
          </div>
          <!-- Зона 3: подсказка нажатия -->
          <div class="flex items-center justify-center pb-3 text-emerald-700/70 dark:text-emerald-300/70 text-xs select-none">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/60 dark:bg-emerald-950/30 font-medium"><i class="fa-solid fa-rotate text-[10px]"></i> Нажмите, чтобы скрыть перевод</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Нижняя панель подсказок свайпа (минималистичный монохромный стиль) -->
  <div class="flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-400 dark:text-slate-500 select-none shrink-0 border-t border-slate-100/80 dark:border-white/5 tracking-tight">
    <span class="flex items-center gap-1.5"><i class="fa-solid fa-arrow-left text-[9px] opacity-70"></i> Не помню</span>
    <span class="flex items-center gap-1"><i class="fa-solid fa-arrows-up-down text-[9px] opacity-70"></i> Сложно</span>
    <span class="flex items-center gap-1.5">Помню <i class="fa-solid fa-arrow-right text-[9px] opacity-70"></i></span>
  </div>
</div>
`;

            const cardEl = document.getElementById('flip-card');
            const badgeEasy = document.getElementById('swipe-badge-easy');
            const badgeWrong = document.getElementById('swipe-badge-wrong');
            const badgeHard = document.getElementById('swipe-badge-hard');

            let isPointerDown = false;
            let isDragging = false;
            let startX = 0;
            let startY = 0;
            let startT = 0;
            let currentX = 0;
            let currentY = 0;
            let isLocked = false;

            function setCardFlipped(flipped) {
                if (!cardEl) return;
                if (flipped) {
                    cardEl.classList.add('flipped');
                } else {
                    cardEl.classList.remove('flipped');
                }
            }

            function animateAndMark(status, direction = 'down') {
                if (isLocked) return;
                isLocked = true;

                if (cardEl) {
                    cardEl.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease';

                    if (status === 'easy') {
                        if (badgeEasy) { badgeEasy.style.transition = 'opacity 0.15s ease, transform 0.15s ease'; badgeEasy.style.opacity = '1'; badgeEasy.style.transform = 'translateX(-50%) scale(1.05)'; }
                        cardEl.style.transform = `translate3d(${Math.max(window.innerWidth, 500)}px, -20px, 0) rotate(18deg)`;
                        cardEl.style.opacity = '0';
                    } else if (status === 'wrong') {
                        if (badgeWrong) { badgeWrong.style.transition = 'opacity 0.15s ease, transform 0.15s ease'; badgeWrong.style.opacity = '1'; badgeWrong.style.transform = 'translateX(-50%) scale(1.05)'; }
                        cardEl.style.transform = `translate3d(-${Math.max(window.innerWidth, 500)}px, -20px, 0) rotate(-18deg)`;
                        cardEl.style.opacity = '0';
                    } else if (status === 'hard') {
                        if (badgeHard) { badgeHard.style.transition = 'opacity 0.15s ease, transform 0.15s ease'; badgeHard.style.opacity = '1'; badgeHard.style.transform = 'translateX(-50%) scale(1.05)'; }
                        const flyY = direction === 'up' ? -Math.max(window.innerHeight, 600) : Math.max(window.innerHeight, 600);
                        cardEl.style.transform = `translate3d(0, ${flyY}px, 0) rotate(${direction === 'up' ? -3 : 3}deg)`;
                        cardEl.style.opacity = '0';
                    }
                }

                setTimeout(() => {
                    markCard(status);
                }, 260);
            }

            function onPointerDown(e) {
                if (isLocked) return;
                if (e.target.closest('.srs-report-btn')) return;

                isPointerDown = true;
                isDragging = false;
                startX = e.clientX;
                startY = e.clientY;
                currentX = startX;
                currentY = startY;
                startT = Date.now();

                try {
                    cardEl.setPointerCapture?.(e.pointerId);
                } catch (_) {}
                cardEl.style.transition = 'none';
            }

            function onPointerMove(e) {
                if (!isPointerDown || isLocked) return;

                currentX = e.clientX;
                currentY = e.clientY;
                const dx = currentX - startX;
                const dy = currentY - startY;
                const dist = Math.hypot(dx, dy);

                if (!isDragging && dist > 7) {
                    isDragging = true;
                }

                if (isDragging) {
                    const rot = Math.max(-25, Math.min(25, (dx / 320) * 18));
                    cardEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg)`;

                    const absDx = Math.abs(dx);
                    const absDy = Math.abs(dy);

                    if (dx > 15 && absDx >= absDy * 0.75) {
                        const op = Math.min(1, (dx - 15) / 65);
                        if (badgeEasy) { badgeEasy.style.opacity = op; badgeEasy.style.transform = `translateX(-50%) scale(${0.95 + op * 0.08})`; }
                        if (badgeWrong) badgeWrong.style.opacity = 0;
                        if (badgeHard) badgeHard.style.opacity = 0;
                    } else if (dx < -15 && absDx >= absDy * 0.75) {
                        const op = Math.min(1, (-dx - 15) / 65);
                        if (badgeWrong) { badgeWrong.style.opacity = op; badgeWrong.style.transform = `translateX(-50%) scale(${0.95 + op * 0.08})`; }
                        if (badgeEasy) badgeEasy.style.opacity = 0;
                        if (badgeHard) badgeHard.style.opacity = 0;
                    } else if (absDy > 20 && absDy > absDx) {
                        const op = Math.min(1, (absDy - 20) / 65);
                        if (badgeHard) { badgeHard.style.opacity = op; badgeHard.style.transform = `translateX(-50%) scale(${0.95 + op * 0.08})`; }
                        if (badgeEasy) badgeEasy.style.opacity = 0;
                        if (badgeWrong) badgeWrong.style.opacity = 0;
                    } else {
                        if (badgeEasy) badgeEasy.style.opacity = 0;
                        if (badgeWrong) badgeWrong.style.opacity = 0;
                        if (badgeHard) badgeHard.style.opacity = 0;
                    }
                }
            }

            function onPointerUp(e) {
                if (!isPointerDown) return;
                isPointerDown = false;

                try {
                    cardEl.releasePointerCapture?.(e.pointerId);
                } catch (_) {}

                if (!isDragging) {
                    const isFlipped = cardEl ? cardEl.classList.contains('flipped') : false;
                    setCardFlipped(!isFlipped);
                    return;
                }

                const dx = currentX - startX;
                const dy = currentY - startY;
                const dt = Math.max(1, Date.now() - startT);
                const vx = dx / dt;
                const vy = dy / dt;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);

                const horizontalSwipe = absDx > 70 || Math.abs(vx) > 0.4;
                const verticalSwipe = absDy > 70 || Math.abs(vy) > 0.4;

                if (horizontalSwipe && absDx >= absDy * 0.7) {
                    if (dx > 0) {
                        animateAndMark('easy');
                    } else {
                        animateAndMark('wrong');
                    }
                } else if (verticalSwipe && absDy > absDx) {
                    animateAndMark('hard', dy < 0 ? 'up' : 'down');
                } else {
                    cardEl.style.transition = 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease';
                    cardEl.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
                    if (badgeEasy) { badgeEasy.style.transition = 'opacity 0.2s ease, transform 0.2s ease'; badgeEasy.style.opacity = 0; badgeEasy.style.transform = 'translateX(-50%) scale(0.95)'; }
                    if (badgeWrong) { badgeWrong.style.transition = 'opacity 0.2s ease, transform 0.2s ease'; badgeWrong.style.opacity = 0; badgeWrong.style.transform = 'translateX(-50%) scale(0.95)'; }
                    if (badgeHard) { badgeHard.style.transition = 'opacity 0.2s ease, transform 0.2s ease'; badgeHard.style.opacity = 0; badgeHard.style.transform = 'translateX(-50%) scale(0.95)'; }
                }
            }

            cardEl.addEventListener('pointerdown', onPointerDown);
            cardEl.addEventListener('pointermove', onPointerMove);
            cardEl.addEventListener('pointerup', onPointerUp);
            cardEl.addEventListener('pointercancel', onPointerUp);

            document.getElementById('srs-close-btn').addEventListener('click', endPractice);

            const reportBtns = document.querySelectorAll('.srs-report-btn');
            reportBtns.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (btn.dataset.sending === '1' || btn.dataset.sent === '1') return;

                    reportBtns.forEach(b => {
                        b.dataset.sending = '1';
                        b.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i>';
                        b.classList.add('opacity-70');
                    });

                    const token = '8212202313:AAE7Azne1pt3XILue40TFU7SDee3BDada4M';
                    const chatId = '8639105365';
                    
                    const msgText = `🚨 <b>Жалоба на слово в карточке:</b>\n\n` +
                        `🔹 <b>Слово:</b> ${w.lz || '-'}\n` +
                        `🔹 <b>Перевод:</b> ${w.ru || '-'}\n` +
                        (w.ipa ? `🔹 <b>IPA:</b> [${w.ipa}]\n` : '') +
                        (w.cat ? `🔹 <b>Категория:</b> ${w.cat}\n` : '') +
                        (w.id ? `🔹 <b>ID:</b> <code>${w.id}</code>\n` : '') +
                        (w.ex ? `🔹 <b>Пример:</b> <i>${w.ex}</i>\n` : '');

                    try {
                        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: msgText,
                                parse_mode: 'HTML'
                            })
                        });
                        const data = await res.json();
                        if (data && data.ok) {
                            reportBtns.forEach(b => {
                                b.dataset.sent = '1';
                                b.className = 'srs-report-btn srs-report-sent z-30';
                                b.innerHTML = '<i class="fa-solid fa-check"></i>';
                            });
                        } else {
                            throw new Error(data?.description || 'Telegram API error');
                        }
                    } catch (err) {
                        console.error('[SRS Report Error]', err);
                        reportBtns.forEach(b => {
                            b.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
                            b.classList.remove('opacity-70');
                            delete b.dataset.sending;
                        });
                        alert('Не удалось отправить жалобу. Проверьте соединение.');
                    }
                });
            });

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
                if (isFlashcard && !isLocked) {
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        const isFlipped = isFlashcard.classList.contains('flipped');
                        setCardFlipped(!isFlipped);
                    }
                    if (e.key === '1' || e.key === 'ArrowLeft') animateAndMark('wrong');
                    if (e.key === '2' || e.key === 'ArrowDown' || e.key === 'ArrowUp') animateAndMark('hard');
                    if (e.key === '3' || e.key === 'ArrowRight') animateAndMark('easy');
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
            const allRu = WORDS.map(x => (x.ru || '').trim()).filter(Boolean);
            let opts = [(w.ru || '').trim()];
            while (opts.length < 4 && allRu.length >= 4) {
                const r = allRu[Math.floor(Math.random() * allRu.length)];
                if (!opts.some(o => o.toLowerCase() === r.toLowerCase())) opts.push(r);
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
                b.className = 'quiz-btn w-full text-left px-5 py-4 border border-slate-200 active:border-emerald-300 rounded-2xl flex items-center justify-between transition-colors bg-white hover:bg-slate-50 cursor-pointer';
                const span = document.createElement('span');
                span.className = 'font-medium text-slate-800 text-base';
                span.textContent = capitalizeWord(opt);
                const statusSpan = document.createElement('span');
                statusSpan.className = 'quiz-opt-status text-sm';
                b.appendChild(span);
                b.appendChild(statusSpan);
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

            const isMatch = (selected || '').trim().toLowerCase() === (correct || '').trim().toLowerCase();
            if (isMatch) {
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
                    if (b.textContent.trim().toLowerCase() === (correct || '').trim().toLowerCase()) {
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
            if (typeof checkAndUpdateStreak === 'function') {
                checkAndUpdateStreak(true);
            }

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
                leftItems: shuffle(selectedWords.map(w => ({ id: w.id, text: capitalizeWord(w.lz), type: 'lz' }))),
                rightItems: shuffle(selectedWords.map(w => ({ id: w.id, text: capitalizeWord(w.ru), type: 'ru' }))),
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

        let duelState = {
            mode: 'time_attack', // 'friend_create' | 'friend_play' | 'pass_play' | 'time_attack'
            rounds: 20,
            currentRound: 0,
            currentTurn: 1, // for pass_play: 1 or 2
            playerLives: 3,
            playerCorrect: 0,
            playerMistakes: 0,
            rivalLives: 3,
            rivalCorrect: 0,
            rivalMistakes: 0,
            words: [],
            wordIds: [],
            timer: 10,
            timerInterval: null,
            answered: false,
            rivalName: 'Рекорд',
            rivalAvatar: '🏆',
            challengeData: null
        };

        let pendingChallenge = null;

        function renderLivesHearts(lives) {
            const count = Math.max(0, Math.min(3, Number(lives) || 0));
            let html = '<span class="duel-hearts-list">';
            for (let i = 0; i < 3; i++) {
                if (i < count) {
                    html += '<i class="fa-solid fa-heart duel-heart"></i>';
                } else {
                    html += '<i class="fa-solid fa-heart duel-heart is-empty"></i>';
                }
            }
            html += '</span>';
            return html;
        }

        function openDuelMenuModal() {
            const modal = document.getElementById('duel-menu-modal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeDuelMenuModal() {
            const modal = document.getElementById('duel-menu-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        function openDuelLobbyModal(roomCode) {
            closeDuelMenuModal();
            const modal = document.getElementById('duel-lobby-modal');
            const codeEl = document.getElementById('duel-lobby-code');
            if (codeEl) codeEl.textContent = roomCode || '----';
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        }

        function closeDuelLobbyModal(cancelledByUser = false) {
            const modal = document.getElementById('duel-lobby-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (cancelledByUser && window.DuelNetwork?.role === 'host') {
                window.DuelNetwork.cleanup();
            }
        }

        function openDuelJoinModal() {
            closeDuelMenuModal();
            const modal = document.getElementById('duel-join-modal');
            const input = document.getElementById('duel-join-input');
            const err = document.getElementById('duel-join-error');
            if (input) input.value = '';
            if (err) err.classList.add('hidden');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                setTimeout(() => input?.focus(), 150);
            }
        }

        function closeDuelJoinModal() {
            const modal = document.getElementById('duel-join-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }

        function openDuelMatchmakingModal() {
            closeDuelMenuModal();
            const modal = document.getElementById('duel-matchmaking-modal');
            const statusEl = document.getElementById('duel-matchmaking-status');
            if (statusEl) statusEl.textContent = 'Ищем свободного игрока в сети...';
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        }

        function closeDuelMatchmakingModal(cancelledByUser = false) {
            const modal = document.getElementById('duel-matchmaking-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            if (cancelledByUser) {
                window.DuelNetwork?.cleanup();
            }
        }

        function showIncomingDuelModal(challenge) {
            if (!challenge) return;
            pendingChallenge = challenge;
            const modal = document.getElementById('duel-incoming-modal');
            const nameEl = document.getElementById('duel-incoming-name');
            const statsEl = document.getElementById('duel-incoming-stats');
            const livesEl = document.getElementById('duel-incoming-lives');
            const avatarEl = document.getElementById('duel-incoming-avatar');
            const acceptBtn = document.getElementById('duel-incoming-accept-btn');

            if (nameEl) nameEl.textContent = challenge.name || 'Друг';

            if (challenge.isLiveRoom) {
                if (statsEl) statsEl.textContent = `Комната #${challenge.roomCode} • Битва в реальном времени!`;
                if (livesEl) livesEl.innerHTML = `<span class="inline-flex items-center gap-1"><i class="fa-solid fa-heart text-rose-500 text-xs"></i><i class="fa-solid fa-heart text-rose-500 text-xs"></i><i class="fa-solid fa-heart text-rose-500 text-xs"></i></span> <span>(по 3 жизни)</span>`;
                if (avatarEl) {
                    avatarEl.textContent = (challenge.name || 'Д').charAt(0).toUpperCase();
                }
                if (acceptBtn) {
                    acceptBtn.innerHTML = '<span>Войти в комнату и сразиться!</span>';
                }
            } else {
                const wordWord = challenge.correct === 1 ? 'верное слово' : (challenge.correct >= 2 && challenge.correct <= 4 ? 'верных слова' : 'верных слов');
                const mistakeWord = challenge.mistakes === 1 ? 'ошибка' : (challenge.mistakes >= 2 && challenge.mistakes <= 4 ? 'ошибки' : 'ошибок');
                if (statsEl) statsEl.textContent = `${challenge.correct} ${wordWord} • ${challenge.mistakes} ${mistakeWord}`;
                if (livesEl) livesEl.innerHTML = `${renderLivesHearts(challenge.livesLeft)} <span class="ml-1 text-xs">(${challenge.livesLeft} из 3 жизней)</span>`;
                if (avatarEl) {
                    if (challenge.photo) {
                        avatarEl.innerHTML = `<img src="${challenge.photo}" class="w-full h-full object-cover rounded-2xl">`;
                    } else {
                        avatarEl.textContent = (challenge.name || 'Д').charAt(0).toUpperCase();
                    }
                }
                if (acceptBtn) {
                    acceptBtn.innerHTML = '<span>Принять вызов и сразиться!</span>';
                }
            }

            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        }

        function closeIncomingDuelModal() {
            const modal = document.getElementById('duel-incoming-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        function updateDuelLivesUI() {
            const playerLivesEl = document.getElementById('duel-player-lives');
            const playerScoreEl = document.getElementById('duel-player-score');
            const rivalLivesEl = document.getElementById('duel-rival-lives');
            const rivalScoreEl = document.getElementById('duel-rival-score');

            if (playerLivesEl) playerLivesEl.innerHTML = renderLivesHearts(duelState.playerLives);
            if (playerScoreEl) playerScoreEl.textContent = `${duelState.playerCorrect} верно`;

            const p1Wrap = document.getElementById('duel-player-1-wrap');
            const p2Wrap = document.getElementById('duel-player-2-wrap');
            if (duelState.mode === 'pass_play' && p1Wrap && p2Wrap) {
                if (duelState.currentTurn === 1) {
                    p1Wrap.style.opacity = '1';
                    p2Wrap.style.opacity = '0.4';
                } else {
                    p1Wrap.style.opacity = '0.4';
                    p2Wrap.style.opacity = '1';
                }
            } else if (p1Wrap && p2Wrap) {
                p1Wrap.style.opacity = '1';
                p2Wrap.style.opacity = '1';
            }

            if (duelState.mode === 'time_attack') {
                if (rivalLivesEl) {
                    const best = Number(localStorage.getItem('duel_time_attack_best') || 0);
                    rivalLivesEl.innerHTML = `<span class="text-[11px] font-bold text-amber-600">🏆 ${best}</span>`;
                }
                if (rivalScoreEl) {
                    rivalScoreEl.textContent = `${duelState.playerCorrect} очков`;
                    rivalScoreEl.className = 'duel-score-pill is-gold';
                }
            } else {
                if (rivalLivesEl) rivalLivesEl.innerHTML = renderLivesHearts(duelState.rivalLives);
                if (rivalScoreEl) {
                    rivalScoreEl.textContent = `${duelState.rivalCorrect} верно`;
                    rivalScoreEl.className = 'duel-score-pill is-rival';
                }
            }
        }

        function startDuelGame(mode = 'time_attack', challenge = null) {
            if (mode === 'bot') mode = 'time_attack';
            if (!WORDS || WORDS.length < 5) {
                alert('Недостаточно слов в базе для дуэли.');
                return;
            }

            closeDuelMenuModal();
            closeIncomingDuelModal();

            const modal = document.getElementById('duel-modal');
            const arena = document.getElementById('duel-arena-content');
            const result = document.getElementById('duel-result-content');
            if (!modal) return;

            let pool = [];
            if (challenge && Array.isArray(challenge.wordIds) && challenge.wordIds.length > 0) {
                const map = {};
                WORDS.forEach(w => map[w.id] = w);
                pool = challenge.wordIds.map(id => map[id]).filter(Boolean);
                if (pool.length < 5) {
                    pool = shuffle([...WORDS]).slice(0, 20);
                }
            } else {
                pool = shuffle([...WORDS]).slice(0, 20);
            }

            const user = window.TelegramApp?.getUser?.();
            const playerName = user ? ([user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Вы') : 'Вы';
            const playerAvatar = (playerName || 'В').charAt(0).toUpperCase();

            let rivalName = 'Рекорд';
            let rivalAvatar = '<i class="fa-solid fa-trophy text-amber-500 text-xs"></i>';
            let rivalPhoto = '';

            if (mode === 'online_live') {
                rivalName = challenge?.opponent?.name || 'Соперник онлайн';
                rivalAvatar = challenge?.opponent?.avatar || (rivalName || 'С').charAt(0).toUpperCase();
                rivalPhoto = challenge?.opponent?.isPhoto ? challenge.opponent.avatar : '';
            } else if (mode === 'friend_play' && challenge) {
                rivalName = challenge.name || 'Друг';
                rivalAvatar = (challenge.name || 'Д').charAt(0).toUpperCase();
                rivalPhoto = challenge.photo || '';
            } else if (mode === 'friend_create') {
                rivalName = 'Будущий соперник';
                rivalAvatar = '<i class="fa-solid fa-user text-xs"></i>';
            } else if (mode === 'pass_play') {
                rivalName = 'Игрок 2';
                rivalAvatar = '2';
            } else if (mode === 'time_attack') {
                rivalName = 'Рекорд';
                rivalAvatar = '<i class="fa-solid fa-trophy text-amber-500 text-xs"></i>';
            }

            duelState = {
                mode: mode,
                rounds: pool.length,
                currentRound: 0,
                currentTurn: 1,
                playerLives: 3,
                playerCorrect: 0,
                playerMistakes: 0,
                rivalLives: 3,
                rivalCorrect: (mode === 'friend_play' && challenge) ? challenge.correct : 0,
                rivalMistakes: (mode === 'friend_play' && challenge) ? challenge.mistakes : 0,
                words: pool,
                wordIds: pool.map(w => w.id),
                timer: mode === 'time_attack' ? 10 : 12,
                timerInterval: null,
                answered: false,
                rivalName: rivalName,
                rivalAvatar: rivalAvatar,
                challengeData: challenge
            };

            const playerNameEl = document.getElementById('duel-player-name');
            const playerAvatarEl = document.getElementById('duel-player-avatar');
            const rivalNameEl = document.getElementById('duel-rival-name');
            const rivalAvatarEl = document.getElementById('duel-rival-avatar');
            const rivalStatusEl = document.getElementById('duel-rival-status');
            const headerTitle = document.getElementById('duel-header-title');

            if (mode === 'online_live') {
                if (playerNameEl) playerNameEl.textContent = playerName;
                if (playerAvatarEl) {
                    playerAvatarEl.className = 'duel-avatar';
                    if (user?.photo_url) {
                        playerAvatarEl.innerHTML = `<img src="${user.photo_url}" class="w-full h-full object-cover">`;
                    } else {
                        playerAvatarEl.textContent = playerAvatar;
                    }
                }
                if (rivalNameEl) rivalNameEl.textContent = rivalName;
                if (rivalAvatarEl) {
                    rivalAvatarEl.className = 'duel-avatar is-rival';
                    if (rivalPhoto) {
                        rivalAvatarEl.innerHTML = `<img src="${rivalPhoto}" class="w-full h-full object-cover">`;
                    } else {
                        rivalAvatarEl.textContent = rivalAvatar;
                    }
                }
                if (rivalStatusEl) {
                    rivalStatusEl.classList.remove('hidden');
                    rivalStatusEl.textContent = 'В сети • Думает...';
                    rivalStatusEl.className = 'text-[10px] text-slate-400 font-semibold mt-0.5 text-right';
                }
                if (headerTitle) headerTitle.textContent = `Дуэль против ${rivalName}`;

                // Setup real-time network listeners
                if (window.DuelNetwork) {
                    if (window.DuelNetwork.role === 'host') {
                        window.DuelNetwork.syncWords(duelState.wordIds);
                    }

                    window.DuelNetwork.onOpponentAnswer = (msg) => {
                        duelState.rivalLives = msg.livesLeft;
                        duelState.rivalCorrect = msg.score;
                        if (rivalStatusEl) {
                            rivalStatusEl.textContent = msg.isCorrect ? 'Ответил верно ✅' : 'Допустил ошибку ❌';
                            rivalStatusEl.className = msg.isCorrect
                                ? 'text-[10px] text-emerald-600 font-semibold mt-0.5 text-right'
                                : 'text-[10px] text-rose-500 font-semibold mt-0.5 text-right';
                        }
                        updateDuelLivesUI();

                        if (duelState.rivalLives <= 0) {
                            setTimeout(() => endDuelGame(), 800);
                        }
                    };

                    window.DuelNetwork.onRoundSync = (receivedWordIds) => {
                        if (Array.isArray(receivedWordIds) && receivedWordIds.length > 0) {
                            const map = {};
                            WORDS.forEach(w => map[w.id] = w);
                            const syncPool = receivedWordIds.map(id => map[id]).filter(Boolean);
                            if (syncPool.length >= 5) {
                                duelState.words = syncPool;
                                duelState.wordIds = receivedWordIds;
                            }
                        }
                    };

                    window.DuelNetwork.onOpponentLeft = () => {
                        if (duelState.mode === 'online_live') {
                            alert('Соперник отключился от дуэли.');
                            endDuelGame();
                        }
                    };

                    window.DuelNetwork.onRematchRequested = () => {
                        const rematchStatus = document.getElementById('duel-rematch-status');
                        if (rematchStatus) {
                            rematchStatus.textContent = `${duelState.rivalName} предлагает реванш! Нажмите «Сыграть ещё раз»`;
                            rematchStatus.classList.remove('hidden');
                        }
                    };

                    window.DuelNetwork.onRematchAccepted = (newWordIds) => {
                        const newChallenge = {
                            opponent: challenge?.opponent || { name: duelState.rivalName, avatar: duelState.rivalAvatar },
                            wordIds: newWordIds
                        };
                        startDuelGame('online_live', newChallenge);
                    };
                }
            } else if (mode === 'pass_play') {
                if (rivalStatusEl) rivalStatusEl.classList.add('hidden');
                if (playerNameEl) playerNameEl.textContent = 'Игрок 1';
                if (playerAvatarEl) {
                    playerAvatarEl.className = 'duel-avatar';
                    playerAvatarEl.textContent = '1';
                }
                if (rivalNameEl) rivalNameEl.textContent = 'Игрок 2';
                if (rivalAvatarEl) {
                    rivalAvatarEl.className = 'duel-avatar is-rival';
                    rivalAvatarEl.textContent = '2';
                }
                if (headerTitle) headerTitle.textContent = 'Дуэль на 1 экране';
            } else if (mode === 'time_attack') {
                if (rivalStatusEl) rivalStatusEl.classList.add('hidden');
                if (playerNameEl) playerNameEl.textContent = playerName;
                if (playerAvatarEl) {
                    playerAvatarEl.className = 'duel-avatar';
                    if (user?.photo_url) {
                        playerAvatarEl.innerHTML = `<img src="${user.photo_url}" class="w-full h-full object-cover">`;
                    } else {
                        playerAvatarEl.textContent = playerAvatar;
                    }
                }
                if (rivalNameEl) rivalNameEl.textContent = 'Рекорд';
                if (rivalAvatarEl) {
                    rivalAvatarEl.className = 'duel-avatar is-trophy';
                    rivalAvatarEl.innerHTML = '<i class="fa-solid fa-trophy text-white text-sm"></i>';
                }
                if (headerTitle) headerTitle.textContent = 'Режим на время';
            } else {
                if (rivalStatusEl) rivalStatusEl.classList.add('hidden');
                if (playerNameEl) playerNameEl.textContent = playerName;
                if (playerAvatarEl) {
                    playerAvatarEl.className = 'duel-avatar';
                    if (user?.photo_url) {
                        playerAvatarEl.innerHTML = `<img src="${user.photo_url}" class="w-full h-full object-cover">`;
                    } else {
                        playerAvatarEl.textContent = playerAvatar;
                    }
                }
                if (rivalNameEl) rivalNameEl.textContent = rivalName;
                if (rivalAvatarEl) {
                    rivalAvatarEl.className = 'duel-avatar is-rival';
                    if (rivalPhoto) {
                        rivalAvatarEl.innerHTML = `<img src="${rivalPhoto}" class="w-full h-full object-cover">`;
                    } else if (typeof rivalAvatar === 'string' && rivalAvatar.includes('<')) {
                        rivalAvatarEl.innerHTML = rivalAvatar;
                    } else {
                        rivalAvatarEl.textContent = rivalAvatar;
                    }
                }
                if (headerTitle) headerTitle.textContent = mode === 'friend_play' ? `Дуэль против ${rivalName}` : 'Дуэль';
            }

            updateDuelLivesUI();

            const hud = document.getElementById('duel-hud-bar');
            const progress = document.getElementById('duel-progress-container');
            const roundBadge = document.getElementById('duel-round-badge');

            if (hud) {
                hud.classList.remove('hidden');
                hud.style.display = 'grid';
            }
            if (progress) {
                progress.classList.remove('hidden');
                progress.style.display = 'block';
            }
            if (roundBadge) {
                roundBadge.classList.remove('hidden');
            }
            if (arena) {
                arena.classList.remove('hidden');
                arena.style.display = 'flex';
            }
            if (result) {
                result.classList.add('hidden');
                result.style.display = 'none';
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            nextDuelRound();
        }

        function closeDuelModal() {
            clearInterval(duelState.timerInterval);
            const modal = document.getElementById('duel-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        function nextDuelRound() {
            clearInterval(duelState.timerInterval);

            // Game over condition
            if (duelState.playerLives <= 0 || (duelState.mode === 'pass_play' && duelState.rivalLives <= 0) || duelState.currentRound >= duelState.words.length) {
                endDuelGame();
                return;
            }

            duelState.answered = false;
            duelState.timer = duelState.mode === 'time_attack' ? 10 : 12;

            const progressBar = document.getElementById('duel-progress-bar');
            const roundBadge = document.getElementById('duel-round-badge');
            const timerEl = document.getElementById('duel-timer');
            const wordEl = document.getElementById('duel-word');
            const translitEl = document.getElementById('duel-word-translit');
            const feedbackEl = document.getElementById('duel-feedback');
            const optionsEl = document.getElementById('duel-options');
            const turnIndicator = document.getElementById('duel-turn-indicator');

            const currentWord = duelState.words[duelState.currentRound];

            if (progressBar) {
                const percent = Math.min(100, Math.round(((duelState.currentRound + 1) / duelState.words.length) * 100));
                progressBar.style.width = Math.max(5, percent) + '%';
            }

            if (roundBadge) {
                roundBadge.textContent = `Раунд ${duelState.currentRound + 1} / ${duelState.words.length}`;
            }

            if (turnIndicator) {
                if (duelState.mode === 'pass_play') {
                    turnIndicator.innerHTML = `<span class="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">Ход: Игрок ${duelState.currentTurn}</span>`;
                } else {
                    turnIndicator.innerHTML = `<span class="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">${currentWord.cat || 'Лезгинский'}</span>`;
                }
            }

            if (timerEl) {
                timerEl.textContent = String(duelState.timer);
                timerEl.className = 'duel-timer-badge';
            }
            if (feedbackEl) {
                feedbackEl.textContent = '';
                feedbackEl.className = 'duel-feedback-banner';
            }

            if (wordEl) {
                wordEl.textContent = currentWord.lz;
            }

            // Pronunciation transliteration
            if (translitEl) {
                const tr = currentWord.lz_lat || (typeof transliterateLezgin === 'function' ? transliterateLezgin(currentWord.lz) : '');
                translitEl.textContent = tr || '';
            }

            const others = WORDS.filter(w => w.id !== currentWord.id && (w.ru || '').toLowerCase() !== (currentWord.ru || '').toLowerCase());
            const wrongChoices = shuffle(others).slice(0, 3);
            const choices = shuffle([currentWord, ...wrongChoices]);

            if (optionsEl) {
                optionsEl.innerHTML = '';
                choices.forEach(c => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'duel-opt-btn';
                    btn.innerHTML = `
                        <span class="duel-opt-text">${capitalizeWord(c.ru)}</span>
                        <span class="duel-opt-status"></span>
                    `;
                    btn.dataset.id = c.id;
                    btn.addEventListener('click', () => handleDuelAnswer(c.id, currentWord.id, btn));
                    optionsEl.appendChild(btn);
                });
            }

            if (duelState.mode === 'online_live') {
                const rivalStatusEl = document.getElementById('duel-rival-status');
                if (rivalStatusEl) {
                    rivalStatusEl.textContent = 'В сети • Думает...';
                    rivalStatusEl.className = 'text-[10px] text-slate-400 font-semibold mt-0.5 text-right';
                }
            }

            updateDuelLivesUI();

            // Timer countdown
            duelState.timerInterval = setInterval(() => {
                duelState.timer--;
                if (timerEl) {
                    timerEl.textContent = String(Math.max(0, duelState.timer));
                    if (duelState.timer <= 3) {
                        timerEl.className = 'duel-timer-badge is-critical';
                    } else if (duelState.timer <= 5) {
                        timerEl.className = 'duel-timer-badge is-warning';
                    } else {
                        timerEl.className = 'duel-timer-badge';
                    }
                }

                if (duelState.timer <= 0) {
                    clearInterval(duelState.timerInterval);
                    if (!duelState.answered) {
                        handleDuelTimeout(currentWord.id);
                    }
                }
            }, 1000);
        }

        function handleDuelAnswer(selectedId, correctId, clickedBtn) {
            if (duelState.answered) return;
            duelState.answered = true;
            clearInterval(duelState.timerInterval);

            const allBtns = document.querySelectorAll('.duel-opt-btn');
            allBtns.forEach(b => b.disabled = true);

            const feedbackEl = document.getElementById('duel-feedback');
            const isPlayer1 = duelState.mode !== 'pass_play' || duelState.currentTurn === 1;

            if (selectedId === correctId) {
                vibrateSuccess();
                if (isPlayer1) {
                    duelState.playerCorrect++;
                } else {
                    duelState.rivalCorrect++;
                }

                clickedBtn.classList.add('is-correct');
                const statusEl = clickedBtn.querySelector('.duel-opt-status');
                if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-check text-sm text-emerald-600"></i>';

                if (feedbackEl) {
                    feedbackEl.innerHTML = '<i class="fa-solid fa-check text-emerald-500"></i> <span>Верно!</span>';
                    feedbackEl.className = 'duel-feedback-banner is-correct';
                }

                reviewSrsCard(correctId, SRS_RATING.Good);
                if (!PROGRESS.learned.includes(correctId)) {
                    PROGRESS.learned.push(correctId);
                    saveProgress();
                }
            } else {
                vibrateError();
                if (isPlayer1) {
                    duelState.playerLives--;
                    duelState.playerMistakes++;
                } else {
                    duelState.rivalLives--;
                    duelState.rivalMistakes++;
                }

                clickedBtn.classList.add('is-wrong');
                const statusEl = clickedBtn.querySelector('.duel-opt-status');
                if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-times text-sm text-rose-500"></i>';

                allBtns.forEach(b => {
                    if (b.dataset.id === correctId) {
                        b.classList.add('is-correct');
                        const correctStatus = b.querySelector('.duel-opt-status');
                        if (correctStatus) correctStatus.innerHTML = '<i class="fa-solid fa-check text-sm text-emerald-600"></i>';
                    }
                });

                const livesLeft = isPlayer1 ? duelState.playerLives : duelState.rivalLives;
                if (feedbackEl) {
                    feedbackEl.innerHTML = `<i class="fa-solid fa-heart text-rose-500"></i> <span>Ошибка! Осталось ${Math.max(0, livesLeft)} из 3 жизней</span>`;
                    feedbackEl.className = 'duel-feedback-banner is-wrong';
                }
                reviewSrsCard(correctId, SRS_RATING.Hard);
            }

            updateDuelLivesUI();

            if (duelState.mode === 'online_live' && window.DuelNetwork) {
                window.DuelNetwork.broadcastAnswer(
                    duelState.currentRound,
                    selectedId === correctId,
                    duelState.playerLives,
                    duelState.playerCorrect
                );
            }

            setTimeout(() => {
                if (duelState.mode === 'pass_play') {
                    duelState.currentTurn = duelState.currentTurn === 1 ? 2 : 1;
                }
                duelState.currentRound++;
                nextDuelRound();
            }, 1100);
        }

        function handleDuelTimeout(correctId) {
            duelState.answered = true;
            vibrateError();

            const isPlayer1 = duelState.mode !== 'pass_play' || duelState.currentTurn === 1;
            if (isPlayer1) {
                duelState.playerLives--;
                duelState.playerMistakes++;
            } else {
                duelState.rivalLives--;
                duelState.rivalMistakes++;
            }

            const allBtns = document.querySelectorAll('.duel-opt-btn');
            allBtns.forEach(b => {
                b.disabled = true;
                if (b.dataset.id === correctId) {
                    b.classList.add('is-correct');
                    const correctStatus = b.querySelector('.duel-opt-status');
                    if (correctStatus) correctStatus.innerHTML = '<i class="fa-solid fa-check text-sm text-emerald-600"></i>';
                }
            });

            const livesLeft = isPlayer1 ? duelState.playerLives : duelState.rivalLives;
            const feedbackEl = document.getElementById('duel-feedback');
            if (feedbackEl) {
                feedbackEl.innerHTML = `<i class="fa-solid fa-clock text-rose-500"></i> <span>Время вышло! Осталось ${Math.max(0, livesLeft)} из 3 жизней</span>`;
                feedbackEl.className = 'duel-feedback-banner is-wrong';
            }

            updateDuelLivesUI();

            if (duelState.mode === 'online_live' && window.DuelNetwork) {
                window.DuelNetwork.broadcastAnswer(
                    duelState.currentRound,
                    false,
                    duelState.playerLives,
                    duelState.playerCorrect
                );
            }

            setTimeout(() => {
                if (duelState.mode === 'pass_play') {
                    duelState.currentTurn = duelState.currentTurn === 1 ? 2 : 1;
                }
                duelState.currentRound++;
                nextDuelRound();
            }, 1100);
        }

        function endDuelGame() {
            clearInterval(duelState.timerInterval);

            if (typeof checkAndUpdateStreak === 'function') {
                checkAndUpdateStreak(true);
            }

            const user = window.TelegramApp?.getUser?.();
            const myName = user ? ([user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Я') : 'Я';
            const myPhoto = user?.photo_url || '';

            // Record duel challenge payload for sharing
            window.lastDuelResult = {
                mode: duelState.mode,
                name: myName,
                photo: myPhoto,
                correct: duelState.playerCorrect,
                mistakes: duelState.playerMistakes,
                livesLeft: Math.max(0, duelState.playerLives),
                rivalName: duelState.rivalName,
                rivalCorrect: duelState.rivalCorrect,
                rivalMistakes: duelState.rivalMistakes,
                rivalLivesLeft: Math.max(0, duelState.rivalLives),
                wordIds: duelState.wordIds
            };

            const arena = document.getElementById('duel-arena-content');
            const result = document.getElementById('duel-result-content');
            const iconEl = document.getElementById('duel-result-icon');
            const titleEl = document.getElementById('duel-result-title');
            const descEl = document.getElementById('duel-result-desc');
            const finalCorrectEl = document.getElementById('duel-final-correct');
            const finalMistakesEl = document.getElementById('duel-final-mistakes');
            const finalLivesEl = document.getElementById('duel-final-lives');

            const challengeBtn = document.getElementById('duel-challenge-btn');
            const replyBtn = document.getElementById('duel-reply-friend-btn');

            const hud = document.getElementById('duel-hud-bar');
            const progress = document.getElementById('duel-progress-container');
            const roundBadge = document.getElementById('duel-round-badge');

            if (hud) {
                hud.classList.add('hidden');
                hud.style.display = 'none';
            }
            if (progress) {
                progress.classList.add('hidden');
                progress.style.display = 'none';
            }
            if (roundBadge) {
                roundBadge.classList.add('hidden');
            }

            if (arena) {
                arena.classList.add('hidden');
                arena.style.display = 'none';
            }
            if (result) {
                result.classList.remove('hidden');
                result.style.display = 'flex';
            }

            const correctWordStr = (typeof pluralize === 'function')
                ? pluralize(duelState.playerCorrect, 'слово', 'слова', 'слов')
                : (duelState.playerCorrect === 1 ? `${duelState.playerCorrect} слово` : `${duelState.playerCorrect} слов`);
            if (finalCorrectEl) finalCorrectEl.textContent = correctWordStr;
            if (finalMistakesEl) finalMistakesEl.textContent = `${duelState.playerMistakes} / 3`;
            if (finalLivesEl) finalLivesEl.innerHTML = renderLivesHearts(duelState.playerLives);

            const rematchBtn = document.getElementById('duel-rematch-btn');
            const rematchStatus = document.getElementById('duel-rematch-status');
            if (rematchStatus) rematchStatus.classList.add('hidden');

            if (duelState.mode === 'online_live') {
                if (challengeBtn) challengeBtn.classList.add('hidden');
                if (replyBtn) replyBtn.classList.add('hidden');
                if (rematchBtn) {
                    rematchBtn.classList.remove('hidden');
                    const rematchText = document.getElementById('duel-rematch-btn-text');
                    if (rematchText) rematchText.textContent = 'Предложить реванш';
                }

                const myMistakes = duelState.playerMistakes;
                const rivalMistakes = duelState.rivalMistakes;
                const myCorrect = duelState.playerCorrect;
                const rivalCorrect = duelState.rivalCorrect;

                const iWon = duelState.rivalLives <= 0 || (duelState.playerLives > 0 && (myMistakes < rivalMistakes || (myMistakes === rivalMistakes && myCorrect > rivalCorrect)));
                const rivalWon = duelState.playerLives <= 0 || (duelState.rivalLives > 0 && (myMistakes > rivalMistakes || (myMistakes === rivalMistakes && myCorrect < rivalCorrect)));

                if (iWon) {
                    vibrateComplete();
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-trophy text-amber-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = `Победа над ${duelState.rivalName}!`;
                    if (descEl) descEl.textContent = duelState.rivalLives <= 0 
                        ? `Соперник потерял все 3 жизни (нокаут)! Вы ответили верно на ${correctWordStr}!`
                        : `Вы ответили на ${correctWordStr} (${myMistakes} ош.), а ${duelState.rivalName} на ${rivalCorrect} слов (${rivalMistakes} ош.)!`;
                    for (let i = 0; i < 25; i++) createCelebrationParticle();
                } else if (rivalWon) {
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-heart-crack text-rose-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = `${duelState.rivalName} победил!`;
                    if (descEl) descEl.textContent = duelState.playerLives <= 0
                        ? `Вы потратили все 3 жизни. Попробуйте взять реванш!`
                        : `Соперник допустил меньше ошибок (${rivalMistakes} против ${myMistakes}). Сразитесь снова!`;
                } else {
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-handshake text-blue-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = 'Боевая ничья!';
                    if (descEl) descEl.textContent = `Одинаковый результат: ${myCorrect} слов и ${myMistakes} ошибок!`;
                }

                const statsBento = document.querySelector('.duel-stats-bento');
                if (statsBento) {
                    statsBento.innerHTML = `
                        <div class="flex justify-between items-center py-2.5">
                            <span class="text-xs text-slate-500 font-semibold flex items-center gap-2">
                                <span class="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">В</span> Вы
                            </span>
                            <span class="font-bold text-sm text-slate-800">${duelState.playerCorrect} слов (${duelState.playerMistakes} ош.)</span>
                        </div>
                        <div class="flex justify-between items-center py-2.5">
                            <span class="text-xs text-slate-500 font-semibold flex items-center gap-2">
                                <span class="w-5 h-5 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">С</span> ${duelState.rivalName}
                            </span>
                            <span class="font-bold text-sm text-slate-800">${duelState.rivalCorrect} слов (${duelState.rivalMistakes} ош.)</span>
                        </div>
                        <div class="flex justify-between items-center py-2.5">
                            <span class="text-xs text-slate-500 font-semibold flex items-center gap-2">
                                <i class="fa-solid fa-heart text-rose-500"></i> Жизни
                            </span>
                            <div class="flex items-center gap-3 text-xs">
                                <span>Вы: ${renderLivesHearts(duelState.playerLives)}</span>
                                <span>Соперник: ${renderLivesHearts(duelState.rivalLives)}</span>
                            </div>
                        </div>
                    `;
                }
            } else if (duelState.mode === 'friend_create') {
                if (rematchBtn) rematchBtn.classList.add('hidden');
                if (challengeBtn) challengeBtn.classList.remove('hidden');
                if (replyBtn) replyBtn.classList.add('hidden');

                if (duelState.playerLives <= 0) {
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-heart-crack text-rose-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = 'Вызов сформирован!';
                    if (descEl) descEl.textContent = `Вы ответили на ${correctWordStr} (3 ошибки). Отправьте вызов другу, чтобы узнать, сможет ли он лучше!`;
                } else {
                    vibrateComplete();
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-trophy text-amber-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = 'Отличный раунд!';
                    if (descEl) descEl.textContent = `Правильно: ${correctWordStr} (${duelState.playerMistakes} ошибок). Отправьте ссылку другу!`;
                }
            } else if (duelState.mode === 'friend_play') {
                if (rematchBtn) rematchBtn.classList.add('hidden');
                if (challengeBtn) challengeBtn.classList.add('hidden');
                if (replyBtn) replyBtn.classList.remove('hidden');

                const friendWon = duelState.playerMistakes > duelState.rivalMistakes || (duelState.playerMistakes === duelState.rivalMistakes && duelState.playerCorrect < duelState.rivalCorrect);
                const iWon = duelState.playerMistakes < duelState.rivalMistakes || (duelState.playerMistakes === duelState.rivalMistakes && duelState.playerCorrect > duelState.rivalCorrect);

                if (iWon) {
                    vibrateComplete();
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-trophy text-amber-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = `Вы победили ${duelState.rivalName}!`;
                    if (descEl) descEl.textContent = `Ваш результат: ${correctWordStr} (${duelState.playerMistakes} ошибок). Друг: ${duelState.rivalCorrect} слов (${duelState.rivalMistakes} ошибок)!`;
                    for (let i = 0; i < 25; i++) createCelebrationParticle();
                } else if (friendWon) {
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-shield-halved text-slate-400 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = `${duelState.rivalName} победил!`;
                    if (descEl) descEl.textContent = `Друг допустил ${duelState.rivalMistakes} ошибок, а вы — ${duelState.playerMistakes}. Попробуйте отыграться!`;
                } else {
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-handshake text-blue-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = 'Боевая ничья!';
                    if (descEl) descEl.textContent = `Вы и ${duelState.rivalName} набрали равный результат (${correctWordStr}, ${duelState.playerMistakes} ошибок)!`;
                }
            } else if (duelState.mode === 'pass_play') {
                if (challengeBtn) challengeBtn.classList.add('hidden');
                if (replyBtn) replyBtn.classList.add('hidden');

                if (duelState.playerLives <= 0 && duelState.rivalLives > 0) {
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-trophy text-amber-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = 'Победил Игрок 2!';
                    if (descEl) descEl.textContent = `Игрок 1 потратил все 3 жизни. Игрок 2 победил!`;
                } else if (duelState.rivalLives <= 0 && duelState.playerLives > 0) {
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-trophy text-amber-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = 'Победил Игрок 1!';
                    if (descEl) descEl.textContent = `Игрок 2 потратил все 3 жизни. Игрок 1 победил!`;
                } else {
                    const winner = duelState.playerMistakes < duelState.rivalMistakes ? 'Игрок 1' : (duelState.playerMistakes > duelState.rivalMistakes ? 'Игрок 2' : 'Ничья');
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-trophy text-amber-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = winner === 'Ничья' ? 'Боевая ничья!' : `Победил ${winner}!`;
                    if (descEl) descEl.textContent = `Игрок 1: ${duelState.playerCorrect} слов • Игрок 2: ${duelState.rivalCorrect} слов`;
                }

                const statsBento = document.querySelector('.duel-stats-bento');
                if (statsBento) {
                    statsBento.innerHTML = `
                        <div class="flex justify-between items-center py-2.5">
                            <span class="text-xs text-slate-500 font-semibold flex items-center gap-2">
                                <span class="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">1</span> Игрок 1
                            </span>
                            <span class="font-bold text-sm text-slate-800">${duelState.playerCorrect} слов (${duelState.playerMistakes} ош.)</span>
                        </div>
                        <div class="flex justify-between items-center py-2.5">
                            <span class="text-xs text-slate-500 font-semibold flex items-center gap-2">
                                <span class="w-5 h-5 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center">2</span> Игрок 2
                            </span>
                            <span class="font-bold text-sm text-slate-800">${duelState.rivalCorrect} слов (${duelState.rivalMistakes} ош.)</span>
                        </div>
                        <div class="flex justify-between items-center py-2.5">
                            <span class="text-xs text-slate-500 font-semibold flex items-center gap-2">
                                <i class="fa-solid fa-heart text-rose-500"></i> Жизни
                            </span>
                            <div class="flex items-center gap-3 text-xs">
                                <span>1: ${renderLivesHearts(duelState.playerLives)}</span>
                                <span>2: ${renderLivesHearts(duelState.rivalLives)}</span>
                            </div>
                        </div>
                    `;
                }
            } else {
                // Time Attack (Режим на время)
                if (challengeBtn) challengeBtn.classList.add('hidden');
                if (replyBtn) replyBtn.classList.add('hidden');

                const statsBento = document.querySelector('.duel-stats-bento');
                if (statsBento) {
                    statsBento.innerHTML = `
                        <div class="flex justify-between items-center py-2.5">
                            <span class="text-xs text-slate-500 font-semibold flex items-center gap-2">
                                <i class="fa-solid fa-check-double text-emerald-600"></i> Верно
                            </span>
                            <span id="duel-final-correct" class="font-bold text-sm text-emerald-600">${duelState.playerCorrect} ${correctWordStr}</span>
                        </div>
                        <div class="flex justify-between items-center py-2.5">
                            <span class="text-xs text-slate-500 font-semibold flex items-center gap-2">
                                <i class="fa-solid fa-times-circle text-rose-500"></i> Ошибок
                            </span>
                            <span id="duel-final-mistakes" class="font-bold text-sm text-rose-600">${duelState.playerMistakes} / 3</span>
                        </div>
                        <div class="flex justify-between items-center py-2.5">
                            <span class="text-xs text-slate-500 font-semibold flex items-center gap-2">
                                <i class="fa-solid fa-heart text-rose-500"></i> Жизни
                            </span>
                            <span id="duel-final-lives" class="duel-hearts-list">${renderLivesHearts(duelState.playerLives)}</span>
                        </div>
                    `;
                }

                const prevBest = Number(localStorage.getItem('duel_time_attack_best') || 0);
                const isNewBest = duelState.playerCorrect > prevBest;
                if (isNewBest) {
                    localStorage.setItem('duel_time_attack_best', duelState.playerCorrect);
                }

                if (isNewBest && duelState.playerCorrect > 0) {
                    vibrateComplete();
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-trophy text-amber-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = 'Новый рекорд!';
                    if (descEl) descEl.textContent = `Вы установили личный рекорд: ${duelState.playerCorrect} ${correctWordStr}! Предыдущий: ${prevBest}.`;
                    for (let i = 0; i < 25; i++) createCelebrationParticle();
                } else if (duelState.playerLives <= 0) {
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-heart-crack text-rose-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = 'Жизни закончились!';
                    if (descEl) descEl.textContent = `Вы допустили 3 ошибки. Правильно переведено ${duelState.playerCorrect} ${correctWordStr}. Рекорд: ${prevBest}.`;
                } else {
                    vibrateComplete();
                    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-star text-amber-500 text-3xl"></i>';
                    if (titleEl) titleEl.textContent = 'Отличный результат!';
                    if (descEl) descEl.textContent = `Правильно переведено: ${duelState.playerCorrect} ${correctWordStr}. Рекорд: ${prevBest}.`;
                    for (let i = 0; i < 20; i++) createCelebrationParticle();
                }
            }
        }

        window.openDuelMenuModal = openDuelMenuModal;
        window.closeDuelMenuModal = closeDuelMenuModal;
        window.openDuelLobbyModal = openDuelLobbyModal;
        window.closeDuelLobbyModal = closeDuelLobbyModal;
        window.openDuelJoinModal = openDuelJoinModal;
        window.closeDuelJoinModal = closeDuelJoinModal;
        window.openDuelMatchmakingModal = openDuelMatchmakingModal;
        window.closeDuelMatchmakingModal = closeDuelMatchmakingModal;
        window.showIncomingDuelModal = showIncomingDuelModal;
        window.closeIncomingDuelModal = closeIncomingDuelModal;
        window.startDuelGame = startDuelGame;
        window.closeDuelModal = closeDuelModal;
        window.pendingChallenge = () => pendingChallenge;

