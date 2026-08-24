        function toggleFavorite(wordId, event) {
            if (event) event.stopPropagation();
            const idx = PROGRESS.favorites.indexOf(wordId);
            if (idx === -1) {
                PROGRESS.favorites.push(wordId);
            } else {
                PROGRESS.favorites.splice(idx, 1);
            }
            saveProgress();

            // Обновляем только счетчики и активные состояния без пересоздания списка
            refreshCategoryCounters();
            syncSelectedCategoryUI();

            const isFav = PROGRESS.favorites.includes(wordId);
            
            const favIcons = document.querySelectorAll(`i[data-fav-icon="${wordId}"]`);
            favIcons.forEach(icon => {
                icon.className = `fa-${isFav ? 'solid' : 'regular'} fa-star ${isFav ? 'text-amber-400' : 'text-slate-200'}`;
            });
            const favBtns = document.querySelectorAll(`button[data-fav-btn="${wordId}"]`);
            favBtns.forEach(btn => {
                btn.setAttribute('aria-label', isFav ? 'Удалить из избранного' : 'Добавить в избранное');
            });
        }

        // PWA Install
        function normalizeLezgiSearch(value) {
            if (!value) return '';
            return String(value)
                .toLowerCase()
                .normalize('NFC')
                .replace(/ё/g, 'е')
                .replace(/[ӏӀIi!ʼ’'`|]/g, '1')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function rebuildSearchIndex() {
            if (WORDS && WORDS.length > 0 && WORDS[0]._search) return; // already indexed
            const cleanString = (str) => str.replace(/1/g, '');
            const splitParts = (str) => str.split(/[\s/,;|\(\)\-\[\]\.\?\!\:\"]+/).filter(Boolean);

            (WORDS || []).forEach(word => {
                const lz = normalizeLezgiSearch(word.lz);
                const ru = normalizeLezgiSearch(word.ru);
                const ex = normalizeLezgiSearch(word.ex);
                const tags = (word.tags || []).map(t => normalizeLezgiSearch(t));

                word._search = {
                    lz, ru, ex, tags,
                    lzParts: splitParts(lz),
                    ruParts: splitParts(ru),
                    lzClean: cleanString(lz),
                    lzPartsClean: splitParts(lz).map(cleanString),
                    exClean: cleanString(ex),
                    tagsClean: tags.map(cleanString)
                };
            });
        }

        function getSearchResults(words, query) {
            const q = normalizeLezgiSearch(query);
            if (!q) return { results: words, hint: '' };

            if (WORDS && WORDS.length > 0 && !WORDS[0]._search) rebuildSearchIndex();

            const cleanString = (str) => str.replace(/1/g, '');
            const qClean = cleanString(q);

            const scoredItems = [];
            let matchedWithoutPalochka = false;
            let matchedWithPalochka = false;

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const item = word._search;
                if (!item) continue;

                // Быстрый фильтр: если запрос никак не пересекается с записью, пропускаем
                const hasLzMatch = item.lzClean.includes(qClean);
                const hasRuMatch = item.ru.includes(q);
                const hasTagsMatch = item.tags.some((tag, idx) => tag.includes(q) || item.tagsClean[idx].includes(qClean));
                const hasExMatch = item.exClean.includes(qClean);

                if (!hasLzMatch && !hasRuMatch && !hasTagsMatch && !hasExMatch) continue;

                let score = 0;
                let usedPalochkaFallback = false;

                // 1. Lezgi whole-field match
                if (hasLzMatch) {
                    if (item.lz === q) {
                        score += 10000;
                    } else if (item.lzClean === qClean) {
                        score += 8000;
                        usedPalochkaFallback = true;
                    } else if (item.lz.startsWith(q)) {
                        score += 3500;
                    } else if (item.lzClean.startsWith(qClean)) {
                        score += 2500;
                        usedPalochkaFallback = true;
                    } else if (item.lz.includes(q)) {
                        score += 1200;
                    } else if (item.lzClean.includes(qClean)) {
                        score += 900;
                        usedPalochkaFallback = true;
                    }

                    // 2. Lezgi parts match
                    for (let j = 0; j < item.lzParts.length; j++) {
                        const part = item.lzParts[j];
                        const cleanPart = item.lzPartsClean[j];

                        if (part === q) {
                            score += 5000;
                        } else if (cleanPart === qClean) {
                            score += 4000;
                            usedPalochkaFallback = true;
                        } else if (part.startsWith(q)) {
                            score += 3000 + (q.length / part.length * 500);
                        } else if (cleanPart.startsWith(qClean)) {
                            score += 2000 + (qClean.length / cleanPart.length * 400);
                            usedPalochkaFallback = true;
                        } else if (part.includes(q)) {
                            score += 1000 + (q.length / part.length * 100);
                        } else if (cleanPart.includes(qClean)) {
                            score += 800 + (qClean.length / cleanPart.length * 80);
                            usedPalochkaFallback = true;
                        }
                    }
                }

                // 3. Russian whole-field match
                if (hasRuMatch) {
                    if (item.ru === q) {
                        score += 7000;
                    } else if (item.ru.startsWith(q)) {
                        score += 3000;
                    } else if (item.ru.includes(q)) {
                        score += 1000;
                    }

                    // 4. Russian parts match
                    for (let j = 0; j < item.ruParts.length; j++) {
                        const part = item.ruParts[j];
                        if (part === q) {
                            score += 4500;
                        } else if (part.startsWith(q)) {
                            score += 2500 + (q.length / part.length * 400);
                        } else if (part.includes(q)) {
                            score += 900 + (q.length / part.length * 80);
                        }
                    }
                }

                // 5. Tags match
                if (hasTagsMatch) {
                    for (let j = 0; j < item.tags.length; j++) {
                        const tag = item.tags[j];
                        const cleanTag = item.tagsClean[j];

                        if (tag === q) {
                            score += 1500;
                        } else if (cleanTag === qClean) {
                            score += 1200;
                            usedPalochkaFallback = true;
                        } else if (tag.startsWith(q)) {
                            score += 1000;
                        } else if (tag.includes(q)) {
                            score += 500;
                        }
                    }
                }

                // 6. Example match
                if (hasExMatch) {
                    if (item.ex.includes(q)) {
                        score += 300;
                    } else if (item.exClean.includes(qClean)) {
                        score += 150;
                        usedPalochkaFallback = true;
                    }
                }

                if (score > 0) {
                    scoredItems.push({ word, score, index: i });
                    if (usedPalochkaFallback) {
                        matchedWithoutPalochka = true;
                    } else {
                        matchedWithPalochka = true;
                    }
                }
            }

            // Sort by score desc, then by original index to keep stable sort
            scoredItems.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.index - b.index;
            });

            // Map back to word objects
            const results = scoredItems.map(item => item.word);

            // Generate search hints
            let hint = '';
            if (qClean === q && matchedWithoutPalochka) {
                hint = 'Показаны результаты с нормализацией кӀ/к1/кI и похожих символов';
            }

            return { results, hint };
        }

        function initSearchBehavior() {
            const searchInput = document.getElementById('search-input');
            const searchClear = document.getElementById('search-clear');
            if (!searchInput) return;

            let debounceTimer = null;
            searchInput.addEventListener('input', () => {
                if (searchClear) {
                    searchClear.classList.toggle('hidden', searchInput.value.length === 0);
                }

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    currentFilter.search = searchInput.value;
                    renderWords();
                }, 250);
            });
        }

        function buildCategoryOptions() {
            const cats = ['all', ...new Set(WORDS.map(w => w.cat))].sort((a, b) => {
                if (a === 'all') return -1;
                if (b === 'all') return 1;
                return a.localeCompare(b);
            });

            const vocabPanel = document.getElementById('category-filter-panel')?.querySelector('.scroll-area');
            const pracPanel = document.getElementById('practice-category-panel')?.querySelector('.scroll-area');

            if (vocabPanel) vocabPanel.innerHTML = '';
            if (pracPanel) pracPanel.innerHTML = '';

            const createOption = (val, display, type) => {
                const div = document.createElement('div');
                div.className = `dropdown-option flex justify-between items-center cursor-pointer text-sm p-3 hover:bg-slate-50`;
                if (val === 'favorites') div.className += ' border-b border-emerald-100 pb-2 mb-1.5';
                div.dataset.value = val;

                const name = document.createElement('span');
                name.className = val === 'favorites' ? 'opt-name flex items-center gap-2' : 'opt-name';
                if (val === 'favorites') {
                    const icon = document.createElement('i');
                    icon.className = 'fa-solid fa-star text-amber-400 text-sm';
                    const label = document.createElement('span');
                    label.textContent = display;
                    name.append(icon, label);
                } else {
                    name.textContent = display;
                }

                const count = document.createElement('span');
                count.className = 'count text-slate-400 text-sm';
                div.append(name, count);

                div.addEventListener('click', () => {
                    if (type === 'vocab') setVocabularyCategory(val, display);
                    else setPracticeCategory(val, display);
                });
                return div;
            };

            // Vocab options
            if (vocabPanel) {
                vocabPanel.appendChild(createOption('favorites', 'Избранное', 'vocab'));
                cats.forEach(cat => {
                    const name = cat === 'all' ? 'Все' : (NICE_CATEGORY_NAMES[cat] || cat);
                    vocabPanel.appendChild(createOption(cat, name, 'vocab'));
                });
                if (vocabPanel.firstElementChild) {
                    vocabPanel.firstElementChild.style.borderTopLeftRadius = '1.5rem';
                    vocabPanel.firstElementChild.style.borderTopRightRadius = '1.5rem';
                }
                if (vocabPanel.lastElementChild) {
                    vocabPanel.lastElementChild.style.borderBottomLeftRadius = '1.5rem';
                    vocabPanel.lastElementChild.style.borderBottomRightRadius = '1.5rem';
                }
            }

            // Practice options
            if (pracPanel) {
                cats.forEach(cat => {
                    const name = cat === 'all' ? 'Все слова' : (NICE_CATEGORY_NAMES[cat] || cat);
                    pracPanel.appendChild(createOption(cat, name, 'practice'));
                });
                if (pracPanel.firstElementChild) {
                    pracPanel.firstElementChild.style.borderTopLeftRadius = '1.5rem';
                    pracPanel.firstElementChild.style.borderTopRightRadius = '1.5rem';
                }
                if (pracPanel.lastElementChild) {
                    pracPanel.lastElementChild.style.borderBottomLeftRadius = '1.5rem';
                    pracPanel.lastElementChild.style.borderBottomRightRadius = '1.5rem';
                }
            }
        }

        function refreshCategoryCounters() {
            const updatePanel = (panelId, getCount) => {
                const panel = document.getElementById(panelId);
                if (!panel) return;
                panel.querySelectorAll('.dropdown-option').forEach(opt => {
                    const val = opt.dataset.value;
                    const count = getCount(val);
                    opt.querySelector('.count').textContent = `(${count})`;
                });
            };

            updatePanel('category-filter-panel', (val) => {
                if (val === 'favorites') return PROGRESS.favorites.length;
                if (val === 'all') return WORDS.length;
                return WORDS.filter(w => w.cat === val).length;
            });

            updatePanel('practice-category-panel', (val) => {
                if (val === 'all') return WORDS.length;
                return WORDS.filter(w => w.cat === val).length;
            });
        }

        function syncSelectedCategoryUI() {
            const sync = (panelId, currentVal) => {
                const panel = document.getElementById(panelId);
                if (!panel) return;
                panel.querySelectorAll('.dropdown-option').forEach(opt => {
                    opt.classList.toggle('active', opt.dataset.value === currentVal);
                });
            };
            sync('category-filter-panel', currentFilter.category);
            sync('practice-category-panel', practiceCategory);
        }

        function setVocabularyCategory(val, display) {
            currentFilter.category = val;
            const valEl = document.querySelector('#category-filter-wrapper .dropdown-value');
            if (valEl) valEl.textContent = display;
            closeDropdown('category-filter-wrapper');
            syncSelectedCategoryUI();
            renderWords();
        }

        function setPracticeCategory(val, display) {
            practiceCategory = val;
            const fullDisplay = val === 'all' ? `${display} (${WORDS.length})` : `${display} (${WORDS.filter(w => w.cat === val).length})`;
            const valEl = document.querySelector('#practice-category-wrapper .dropdown-value');
            if (valEl) valEl.textContent = fullDisplay;
            closeDropdown('practice-category-wrapper');
            syncSelectedCategoryUI();
            updatePracticeAvailability();
        }

        function updatePracticeAvailability() {
            const cat = practiceCategory;
            const pool = cat === 'all' ? WORDS : WORDS.filter(w => w.cat === cat);
            const count = pool.length;

            const modes = [
                { id: 'prac-mode-flashcards', min: 3 },
                { id: 'prac-mode-pairs', min: 5 },
                { id: 'prac-mode-quiz', min: 8 },
                { id: 'prac-mode-odd', min: 8 },
                { id: 'prac-mode-srs', min: 3 }
            ];

            modes.forEach(mode => {
                const el = document.getElementById(mode.id);
                if (!el) return;

                const isAvailable = count >= mode.min;
                el.classList.toggle('opacity-40', !isAvailable);
                el.classList.toggle('pointer-events-none', !isAvailable);

                const infoText = el.querySelector('.text-sm');
                if (isAvailable) {
                    infoText.textContent = `Доступно слов: ${count}`;
                    infoText.classList.remove('text-red-500');
                } else {
                    infoText.dataset.orig = infoText.textContent;
                    infoText.textContent = `Нужно еще ${mode.min - count} слов (минимум ${mode.min})`;
                    infoText.classList.add('text-red-500');
                }
            });
        }

        function updateVocabStats() {
            const statsEl = document.getElementById('vocab-stats');
            const countEl = document.getElementById('words-count');
            if (typeof WORDS === 'undefined' || !WORDS || !WORDS.length) return;
            const catCount = [...new Set(WORDS.map(w => w.cat))].length;
            if (statsEl) statsEl.textContent = `${WORDS.length} слов • ${catCount} категорий`;
            if (countEl) countEl.textContent = WORDS.length.toLocaleString('ru-RU');
        }

        function toggleDropdown(wrapperId) {
            const wrapper = document.getElementById(wrapperId);
            const panel = wrapper.querySelector('.dropdown-panel');
            const trigger = wrapper.querySelector('.dropdown-trigger');
            const chevron = wrapper.querySelector('.fa-chevron-down');

            // Close all other dropdowns
            document.querySelectorAll('.dropdown-panel').forEach(p => {
                if (p !== panel) p.classList.add('hidden');
            });
            document.querySelectorAll('.fa-chevron-down').forEach(c => {
                if (c !== chevron) c.style.transform = '';
            });

            const isOpen = !panel.classList.contains('hidden');

            if (!isOpen) {
                // Opening
                panel.classList.remove('hidden');
                chevron.style.transform = 'rotate(180deg)';
            } else {
                // Closing
                panel.classList.add('hidden');
                chevron.style.transform = '';
            }
        }

        function closeDropdown(wrapperId) {
            const wrapper = document.getElementById(wrapperId);
            if (!wrapper) return;

            const panel = wrapper.querySelector('.dropdown-panel');
            const trigger = wrapper.querySelector('.dropdown-trigger');
            const chevron = wrapper.querySelector('.fa-chevron-down');

            if (panel) panel.classList.add('hidden');
            if (chevron) chevron.style.transform = '';
        }

        // Alphabet
        const ALPHABET_RAW = [
            { "letter": "А а", "ipa": "/a/" }, { "letter": "Б б", "ipa": "/b/" }, { "letter": "В в", "ipa": "/v/ ~ /w/" },
            { "letter": "Г г", "ipa": "/ɡ/" }, { "letter": "Гъ гъ", "ipa": "/ʁ/" },
            { "letter": "Гь гь", "ipa": "/h/" }, { "letter": "Д д", "ipa": "/d/" },
            { "letter": "Е е", "ipa": "/e/ ~ /je/" }, { "letter": "Ж ж", "ipa": "/ʒ/" }, { "letter": "З з", "ipa": "/z/" },
            { "letter": "И и", "ipa": "/i/" }, { "letter": "Й й", "ipa": "/j/" }, { "letter": "К к", "ipa": "/kʰ/ ~ /k/" },
            { "letter": "Къ къ", "ipa": "/q/" }, { "letter": "Кь кь", "ipa": "/q'/" }, { "letter": "КI кI", "ipa": "/k'/" },
            { "letter": "Л л", "ipa": "/l/" }, { "letter": "М м", "ipa": "/m/" },
            { "letter": "Н н", "ipa": "/n/" }, { "letter": "П п", "ipa": "/pʰ/ ~ /p/" }, { "letter": "ПI пI", "ipa": "/p'/" },
            { "letter": "Р р", "ipa": "/r/" }, { "letter": "С с", "ipa": "/s/" },
            { "letter": "Т т", "ipa": "/tʰ/ ~ /t/" }, { "letter": "ТI тI", "ipa": "/t'/" },
            { "letter": "У у", "ipa": "/u/" }, { "letter": "Уь уь", "ipa": "/y/" },
            { "letter": "Ф ф", "ipa": "/f/" }, { "letter": "Х х", "ipa": "/χ/" },
            { "letter": "Хъ хъ", "ipa": "/qʰ/" }, { "letter": "Хь хь", "ipa": "/x/" },
            { "letter": "Ц ц", "ipa": "/tsʰ/ ~ /ts/" }, { "letter": "ЦI цI", "ipa": "/ts'/" },
            { "letter": "Ч ч", "ipa": "/tʃʰ/ ~ /tʃ/" }, { "letter": "ЧI чI", "ipa": "/tʃ'/" },
            { "letter": "Ш ш", "ipa": "/ʃ/" }, { "letter": "Э э", "ipa": "/e/" }, { "letter": "Ю ю", "ipa": "/ju/ ~ /y/" }, { "letter": "Я я", "ipa": "/ja/ ~ /æ/" }
        ];

        const ALPHABET = [];
        const seenLetters = new Set();

        ALPHABET_RAW.forEach(item => {
            if (!seenLetters.has(item.letter)) {
                ALPHABET.push(item);
                seenLetters.add(item.letter);
            }
        });

        function renderAlphabet() {
            const grid = document.getElementById('alphabet-grid');
            grid.innerHTML = '';

            ALPHABET.forEach((item, idx) => {
                const main = item.letter.split(' ')[0];

                const card = document.createElement('div');
                // Плитки теперь чисто белые, а фон экрана — светло-голубой
                card.className = `letter-card bg-white border border-slate-100 active:border-emerald-500 rounded-2xl h-24 flex items-center justify-center text-center cursor-pointer transition-all shadow-sm`;
                card.setAttribute('role', 'button');

                const mainEl = document.createElement('div');
                mainEl.className = 'font-bold text-emerald-900 leading-none';
                mainEl.style.fontSize = '2.75rem';
                mainEl.textContent = main;

                card.append(mainEl);
                card.addEventListener('click', () => {
                    card.style.transform = 'scale(0.95)';
                    setTimeout(() => card.style.transform = '', 120);
                    showAlphabetModal(item);
                });
                grid.appendChild(card);
            });

            staggerCards(grid);
        }

        function showAlphabetModal(item) {
            const modal = document.getElementById('word-modal');
            const isAlreadyOpen = !modal.classList.contains('hidden');
            if (!isAlreadyOpen) {
                history.pushState({ modalOpen: true }, '');
            }

            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const main = item.letter.split(' ')[0];
            const soundFile = main.toLowerCase().replace(/i/g, '1');

            // Все графемы алфавита (первая часть, например "К", "Къ", "Кь", "КI")
            const allGraphemes = ALPHABET.map(l => l.letter.split(' ')[0]);
            // Графемы, которые начинаются так же, но длиннее (например для "К" → "Къ", "Кь", "КI")
            const longerGraphemes = allGraphemes.filter(g =>
                g.toLowerCase().startsWith(main.toLowerCase()) && g.length > main.length
            );

            // Примеры: слова, начинающиеся ровно на эту графему, а не на составные
            const examples = WORDS.filter(w => {
                const lz = w.lz.toLowerCase();
                if (!lz.startsWith(main.toLowerCase())) return false;
                // Исключаем слова, начинающиеся с составной графемы (Къ, Кь, КI и т.д.)
                return !longerGraphemes.some(gg => lz.startsWith(gg.toLowerCase()));
            }).slice(0, 5);

            const body = document.createElement('div');
            body.className = 'px-6 pb-5 flex flex-col flex-1 min-h-0 overflow-y-auto';
            body.style.paddingTop = 'calc(var(--tg-safe-area-inset-top, 0px) + 2.5rem)';

            const header = document.createElement('div');
            header.className = 'flex justify-between items-start';

            const left = document.createElement('div');
            const catSpan = document.createElement('div');
            catSpan.className = 'uppercase tracking-[1.5px] text-emerald-600 text-sm font-bold';
            catSpan.textContent = 'АЛФАВИТ';

            const h1 = document.createElement('div');
            h1.className = 'text-[56px] leading-none font-bold text-emerald-900 mt-2 lezgin-text';
            h1.textContent = item.letter;
            left.append(catSpan, h1);

            const right = document.createElement('div');
            const close = document.createElement('button');
            close.id = 'modal-close-btn-letter';
            close.className = 'hidden md:flex text-slate-300 active:text-slate-400 pt-2 items-center justify-center';
            close.innerHTML = '<i class="fa-solid fa-times text-3xl"></i>';
            close.addEventListener('click', closeModal);
            right.append(close);

            header.append(left, right);

            const info = document.createElement('div');
            info.className = 'mt-6 flex items-center justify-between bg-emerald-50/50 border border-emerald-100 rounded-3xl p-5';

            const ipaWrap = document.createElement('div');
            const ipaLabel = document.createElement('div');
            ipaLabel.className = 'text-[10.5px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1';
            ipaLabel.textContent = 'Межзвуки МФА';
            const ipaText = document.createElement('div');
            ipaText.className = 'text-2xl font-mono text-emerald-800 font-medium';
            ipaText.textContent = item.ipa;
            ipaWrap.append(ipaLabel, ipaText);

            const playBtn = document.createElement('button');
            playBtn.className = 'w-14 h-14 flex flex-shrink-0 items-center justify-center bg-emerald-500 text-white active:bg-emerald-600 rounded-full text-2xl transition-transform active:scale-95 shadow-sm';
            playBtn.innerHTML = '<i class="fa-solid fa-volume-up relative -left-0.5"></i>';
            playBtn.addEventListener('click', () => {
                speakWord(null, `audio/alphabet/${soundFile}.mp3`);
            });

            if (item.letter === 'Ы ы') {
                info.append(ipaWrap);
                body.append(header, info);

                const descBox = document.createElement('div');
                descBox.className = 'mt-4 bg-slate-50 border border-slate-100 text-slate-700 p-4 rounded-3xl text-sm leading-relaxed shadow-sm';
                descBox.innerHTML = '<b>Ы ы</b> используется в лезгинском языке. Буква заимствована из русского. Звук произносится почти так же, как в русском языке.';
                body.append(descBox);
            } else {
                info.append(ipaWrap, playBtn);
                body.append(header, info);
            }

            const exSection = document.createElement('div');
            exSection.className = 'mt-8 flex-1';
            const exHeader = document.createElement('div');
            exHeader.className = 'text-sm font-bold text-slate-400 uppercase tracking-wider mb-3';
            exHeader.textContent = 'Примеры слов';
            exSection.append(exHeader);

            if (examples.length > 0) {
                const exList = document.createElement('div');
                exList.className = 'flex flex-col gap-2';

                examples.forEach(w => {
                    const exCard = document.createElement('div');
                    exCard.className = 'bg-white border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm';

                    const lCol = document.createElement('div');
                    const lz = document.createElement('div');
                    lz.className = 'font-bold text-emerald-950 mb-0.5 text-lg';

                    const prefixLen = main.length;
                    const prefixStr = w.lz.substring(0, prefixLen);
                    const restStr = w.lz.substring(prefixLen);
                    lz.textContent = '';
                    const highlighted = document.createElement('span');
                    highlighted.className = 'text-emerald-600';
                    highlighted.textContent = prefixStr;
                    lz.append(highlighted, document.createTextNode(restStr));

                    const ru = document.createElement('div');
                    ru.className = 'text-sm text-slate-500';
                    ru.textContent = w.ru;
                    lCol.append(lz, ru);

                    exCard.append(lCol);
                    exList.append(exCard);
                });
                exSection.append(exList);
            } else {
                const noEx = document.createElement('div');
                noEx.className = 'text-sm text-slate-400 italic text-center py-8 bg-slate-50 rounded-3xl border border-slate-100 border-dashed';
                noEx.textContent = 'На эту букву пока нет примеров в словаре';
                exSection.append(noEx);
            }
            body.append(exSection);

            content.append(body);
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        // Vocabulary
        const SHOW_VOCABULARY_IPA = false;
        function renderWords(skipAnimation, append) {
            const grid = document.getElementById('words-grid');
            const countEl = document.getElementById('results-count');
            const badge = document.getElementById('demo-badge');
            const hintEl = document.getElementById('search-hint');

            const isDemo = WORDS.length < 50;
            const hasSearch = currentFilter.search.trim().length > 0;
            let scopedWords = WORDS;

            if (badge) badge.classList.toggle('hidden', !isDemo);
            if (currentFilter.category === 'favorites') {
                scopedWords = scopedWords.filter(w => PROGRESS.favorites.includes(w.id));
            } else if (currentFilter.category !== 'all') {
                scopedWords = scopedWords.filter(w => w.cat === currentFilter.category);
            }

            const searchState = getSearchResults(scopedWords, currentFilter.search);
            const filtered = searchState.results;

            if (hintEl) {
                if (searchState.hint) {
                    hintEl.textContent = searchState.hint;
                    hintEl.classList.remove('hidden');
                } else {
                    hintEl.textContent = '';
                    hintEl.classList.add('hidden');
                }
            }

            if (countEl) countEl.textContent = filtered.length;

            if (!append) {
                loadedCount = PAGE_SIZE;
                grid.innerHTML = '';
            }
            const start = append ? loadedCount : 0;
            const pageWords = filtered.slice(start, start + PAGE_SIZE);
            if (append) {
                loadedCount += PAGE_SIZE;
            }
            log(`[renderWords] Current loadedCount: ${loadedCount}, Total filtered words: ${filtered.length}`);
            // loadedCount теперь всегда отражает количество загруженных элементов (20, 40, 60...)

            // Context Banner
            let contextBanner = document.getElementById('vocab-context');
            if (!contextBanner) {
                contextBanner = document.createElement('div');
                contextBanner.id = 'vocab-context';
                grid.parentNode.insertBefore(contextBanner, grid);
            }
            contextBanner.className = 'text-xs sm:text-sm text-slate-600 bg-emerald-50/50 border border-emerald-100 rounded-xl px-3 py-2 mb-3';

            contextBanner.textContent = '';
            if (currentFilter.category === 'favorites') {
                const b = document.createElement('strong');
                b.textContent = 'Ваш личный список.';
                contextBanner.append(b, ' Повторяйте эти слова регулярно. Прогресс сохраняется на устройстве.');
                contextBanner.style.display = '';
            } else if (currentFilter.category === 'all' && !hasSearch) {
                const b = document.createElement('strong');
                b.textContent = 'Весь словарь.';
                contextBanner.append(b, ' Листайте список, используйте поиск или фильтр по темам.');
                contextBanner.className += ' md:hidden';
                contextBanner.style.display = '';
            } else if (currentFilter.category !== 'all' && !hasSearch) {
                const wrapper = document.getElementById('category-filter-wrapper');
                const catName = wrapper.querySelector('.dropdown-value').textContent;
                contextBanner.append('Слова по теме ');
                const b = document.createElement('strong');
                b.textContent = `«${catName}»`;
                contextBanner.append(b, '. Учите слова в контексте одной темы для лучшего запоминания.');
                contextBanner.style.display = '';
            } else {
                contextBanner.style.display = 'none';
            }

            if (pageWords.length === 0) {
                if (currentFilter.category === 'favorites') {
                    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-100 rounded-3xl mt-2 shadow-sm">
                        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fa-regular fa-star text-3xl text-slate-300"></i>
                        </div>
                        <h3 class="font-semibold text-slate-700 text-lg">Нет избранных слов</h3>
                        <p class="text-sm mt-1 px-6">Нажимайте на звездочку рядом со словом, чтобы добавить его сюда для повторения.</p>
                    </div>`;
                } else if (hasSearch) {
                    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-100 rounded-3xl mt-2 shadow-sm">
                        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fa-solid fa-search text-3xl text-slate-300"></i>
                        </div>
                        <h3 class="font-semibold text-slate-700 text-lg">Ничего не найдено</h3>
                        <p class="text-sm mt-1 px-6">Попробуйте изменить запрос или поискать в другой категории.</p>
                    </div>`;
                } else {
                    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-100 rounded-3xl mt-2 shadow-sm">
                        <h3 class="font-semibold text-slate-700 text-lg">Пусто</h3>
                        <p class="text-sm mt-1 px-6">В этой категории пока нет слов.</p>
                    </div>`;
                }
                document.getElementById('pagination').innerHTML = '';
                return;
            }

            pageWords.forEach(word => {
                const isFav = PROGRESS.favorites.includes(word.id);
                const card = document.createElement('div');
                card.className = 'word-card bg-white border border-slate-100 rounded-3xl p-4 flex items-start gap-4 relative';

                const content = document.createElement('div');
                content.className = 'flex-1 min-w-0';
                const lzWrap = document.createElement('div');
                lzWrap.className = 'lezgin-text text-emerald-950 font-bold mb-1';
                lzWrap.textContent = word.lz;

                const metaWrap = document.createElement('div');
                metaWrap.className = 'flex items-center gap-2 mt-1.5 flex-wrap';

                const cat = document.createElement('div');
                cat.className = 'text-[10px] text-slate-400 font-bold uppercase tracking-wider';
                cat.textContent = word.cat;

                metaWrap.append(cat);
                content.append(lzWrap, metaWrap);

                const right = document.createElement('div');
                right.className = 'text-right flex-shrink-0 flex flex-col items-end gap-2 max-w-[45%]';
                const ru = document.createElement('div');
                ru.className = 'text-sm px-3 py-1 bg-emerald-50 text-emerald-700 rounded-2xl font-medium block whitespace-normal text-right';
                ru.textContent = word.ru;

                const bottom = document.createElement('div');
                bottom.className = 'flex items-center gap-2';
                const fav = document.createElement('button');
                fav.className = 'p-1 -mr-1 cursor-pointer';
                fav.setAttribute('aria-label', isFav ? 'Удалить из избранного' : 'Добавить в избранное');
                fav.setAttribute('data-fav-btn', word.id);
                fav.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFavorite(word.id);
                });
                const favIcon = document.createElement('i');
                favIcon.className = `fa-${isFav ? 'solid' : 'regular'} fa-star ${isFav ? 'text-amber-400' : 'text-slate-200'}`;
                favIcon.setAttribute('data-fav-icon', word.id);
                fav.appendChild(favIcon);
                if (SHOW_VOCABULARY_IPA) {
                    const ipa = document.createElement('span');
                    ipa.className = 'ipa-text text-sm';
                    ipa.textContent = word.ipa || '—';
                    bottom.appendChild(ipa);
                }
                bottom.appendChild(fav);

                right.append(ru, bottom);
                card.append(content, right);
                grid.appendChild(card);
            });

            renderLoadMore(filtered.length);
            if (!skipAnimation && !append) staggerCards(grid);
        }
        function renderLoadMore(total) {
            const container = document.getElementById('pagination');
            container.innerHTML = '';
            log(`[renderLoadMore] Checking if button needed. Loaded: ${loadedCount}, Total: ${total}`);
            if (loadedCount >= total) {
                const done = document.createElement('div');
                done.className = 'text-sm text-slate-400 font-medium py-3 text-center';
                done.textContent = `Все слова загружены (${total})`;
                container.appendChild(done);
                return;
            }
            const nextBatch = Math.min(loadedCount + PAGE_SIZE, total);
            const btn = document.createElement('button');
            btn.className = 'px-6 py-3 text-sm font-semibold rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 active:bg-emerald-100 w-full';
            btn.textContent = `Загрузить ещё (${loadedCount + 1}–${nextBatch} из ${total})`;
            btn.onclick = () => renderWords(false, true);
            container.appendChild(btn);
        }

        function showWordModal(wordId) {
            const word = WORDS.find(w => w.id === wordId);
            if (!word) return;

            const modal = document.getElementById('word-modal');
            const isAlreadyOpen = !modal.classList.contains('hidden');
            if (!isAlreadyOpen) {
                history.pushState({ modalOpen: true }, '');
            }

            const content = document.getElementById('modal-content');

            content.innerHTML = '';
            const isFav = PROGRESS.favorites.includes(word.id);

            const body = document.createElement('div');
            body.className = 'px-6 pb-5 flex flex-col flex-1 min-h-0 overflow-y-auto';
            body.style.paddingTop = 'calc(var(--tg-safe-area-inset-top, 0px) + 2.5rem)';

            const header = document.createElement('div');
            header.className = 'flex justify-between items-start';

            const left = document.createElement('div');
            const catRow = document.createElement('div');
            catRow.className = 'flex items-center gap-2';
            const catSpan = document.createElement('div');
            catSpan.className = 'uppercase tracking-[1.5px] text-emerald-600 text-sm font-bold';
            catSpan.textContent = word.cat;
            catRow.append(catSpan);
            
            const h1Row = document.createElement('div');
            h1Row.className = 'flex items-center gap-3 mt-1';
            const h1 = document.createElement('div');
            h1.className = 'text-[42px] leading-none font-bold text-emerald-900 lezgin-text';
            h1.textContent = word.lz;
            h1Row.append(h1);
            
            left.append(catRow, h1Row);

            const right = document.createElement('div');
            right.className = 'flex items-center gap-3';
            const fav = document.createElement('button');
            fav.className = 'text-2xl transition-transform active:scale-125';
            fav.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-star ${isFav ? 'text-amber-400' : 'text-slate-300'}"></i>`;
            fav.addEventListener('click', () => { toggleFavorite(word.id); showWordModal(word.id); });
            const close = document.createElement('button');
            close.id = 'modal-close-btn';
            close.className = 'hidden md:flex text-slate-300 active:text-slate-400 items-center justify-center';
            close.innerHTML = '<i class="fa-solid fa-times text-3xl"></i>';
            close.addEventListener('click', closeModal);
            right.append(fav, close);
            header.append(left, right);

            const info = document.createElement('div');
            info.className = 'mt-4';
            const ru = document.createElement('div');
            ru.className = 'text-3xl font-semibold';
            ru.textContent = word.ru;
            info.appendChild(ru);
            if (SHOW_VOCABULARY_IPA && word.ipa) {
                const ipa = document.createElement('div');
                ipa.className = 'mt-1 ipa-text';
                ipa.textContent = word.ipa;
                info.appendChild(ipa);
            }

            body.append(header, info);
            if (word.ex) {
                const ex = document.createElement('div');
                ex.className = 'mt-6 bg-emerald-50/40 border-l-4 border-emerald-400 rounded-r-2xl p-4 font-medium text-slate-800 text-base leading-relaxed';
                ex.textContent = word.ex;
                body.appendChild(ex);
            }

            const footer = document.createElement('div');
            footer.className = 'px-6 pb-6 flex gap-3';
            const add = document.createElement('button');
            add.className = 'flex-1 py-3.5 bg-emerald-50 active:bg-emerald-100/80 text-emerald-800 font-bold rounded-3xl flex items-center justify-center gap-x-2 text-sm border border-emerald-100/50 transition-colors shadow-sm';
            add.innerHTML = '<i class="fa-solid fa-plus text-emerald-600"></i><span>В практику</span>';
            add.addEventListener('click', () => { addToPractice(word.id); closeModal(); });

            const reportBtn = document.createElement('button');
            reportBtn.className = 'py-3.5 px-5 bg-rose-50 active:bg-rose-100 text-rose-600 font-bold rounded-3xl flex items-center justify-center gap-x-2 text-sm border border-rose-100/50 transition-colors shadow-sm';
            reportBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            reportBtn.title = 'Сообщить об ошибке';
            reportBtn.setAttribute('aria-label', 'Сообщить об ошибке в слове');
            reportBtn.addEventListener('click', () => {
                showReportForm(word);
            });

            footer.append(add, reportBtn);

            content.append(body, footer);
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function showReportForm(word) {
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
            p.textContent = `В слове «${word.lz}» (${word.ru})`;

            const privacyNote = document.createElement('p');
            privacyNote.className = 'text-[11px] leading-relaxed text-slate-400 bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-3 text-left';
            privacyNote.textContent = 'Когда вы отправляете исправление, текст сообщения передаётся администратору проекта для проверки. Не отправляйте личные данные.';

            // Блок с подсказкой — примеры для заполнения
            const hintBox = document.createElement('div');
            hintBox.className = 'text-left mb-3 bg-slate-50 border border-slate-100 rounded-2xl p-3';
            hintBox.innerHTML = `
                <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Пример описания:</p>
                <p class="text-xs text-slate-500 leading-relaxed mb-2">
                    «Перевод неточный — слово <b class="text-slate-700">чӀал</b> означает не просто "язык", а "слово/речь". Правильнее: <b class="text-slate-700">речь, слово</b>»
                </p>
                <p class="text-xs text-slate-400 mb-2">Или выберите быстрый вариант:</p>
                <div class="flex flex-wrap gap-1.5" id="hint-chips"></div>
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

            // Быстрые подсказки-чипы — заполняют поле одним нажатием
            const chips = [
                { label: '❌ Неправильный перевод', text: 'Неправильный перевод. Должно быть: ' },
                { label: '✏️ Опечатка', text: 'Опечатка в написании слова. Правильно: ' },
                { label: '📝 Нет примера', text: 'Нет примера использования. Предлагаю добавить: ' },
                { label: '🔊 Неверное ударение', text: 'Неверное ударение/транскрипция. Правильно: ' },
            ];
            // Ждем, пока элемент добавится в DOM
            setTimeout(() => {
                const chipsContainer = document.getElementById('hint-chips');
                if (!chipsContainer) return;
                chips.forEach(chip => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'text-[11px] px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-xl active:bg-emerald-50 active:border-emerald-200 active:text-emerald-700 transition-colors';
                    btn.textContent = chip.label;
                    btn.addEventListener('click', () => {
                        textarea.value = chip.text;
                        textarea.focus();
                        // Ставим курсор в конец
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
            cancelBtn.addEventListener('click', () => showWordModal(word.id)); // Возвращаемся к карточке слова

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
                    wordId: String(word.id || '').slice(0, 120),
                    word: String(word.lz || '').slice(0, 120),
                    translation: String(word.ru || '').slice(0, 180),
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
                            
                            let isJsonOk = false;
                            try {
                                const data = await response.json();
                                if (data && data.ok) {
                                    isJsonOk = true;
                                }
                            } catch (e) {
                                // Not a valid JSON response (e.g. static file server returned raw PHP code)
                            }

                            if (response.ok && isJsonOk) {
                                sent = true;
                                break;
                            }
                        } catch (endpointError) {
                            warn('[Report] endpoint failed', endpoint, endpointError);
                        }
                    }

                    if (!sent) {
                        throw new Error('All endpoints failed');
                    }
                    showReportSuccess(word);
                } catch (err) {
                    warn('[Report] failed', err);
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = '<span>Отправить</span>';
                    sendBtn.classList.remove('opacity-70');
                    setTimeout(() => {
                        alert('Не удалось отправить жалобу. Попробуйте позже.');
                    }, 10);
                }
            });

            footer.append(cancelBtn, sendBtn);
            content.append(wrap, footer);
        }

        function showReportSuccess(word) {
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.className = 'px-6 pt-10 pb-8 text-center';

            const iconWrap = document.createElement('div');
            iconWrap.className = 'mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5';
            iconWrap.innerHTML = '<i class="fa-solid fa-check text-emerald-600 text-4xl"></i>';

            const h3 = document.createElement('h3');
            h3.className = 'font-bold text-2xl mb-2 text-slate-800';
            h3.textContent = 'Спасибо!';

            const p = document.createElement('p');
            p.className = 'text-sm text-slate-500 mb-8 px-4 leading-relaxed';
            p.textContent = 'Отчет об ошибке успешно отправлен. Мы исправим это в ближайшем обновлении.';

            const okBtn = document.createElement('button');
            okBtn.className = 'w-full py-3.5 bg-slate-100 active:bg-slate-200 font-bold rounded-3xl text-sm transition-colors text-slate-700';
            okBtn.textContent = 'Вернуться к слову';
            okBtn.addEventListener('click', () => showWordModal(word.id));

            wrap.append(iconWrap, h3, p, okBtn);
            content.append(wrap);
        }

        function isElementVisible(element) {
            return element && !element.classList.contains('hidden');
        }

        function closeModal() {
            const modal = document.getElementById('word-modal');
            if (modal && !modal.classList.contains('hidden')) {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
                if (lastDialogTrigger && typeof lastDialogTrigger.focus === 'function') {
                    lastDialogTrigger.focus({ preventScroll: true });
                }
                if (!isClosingProgrammatically && history.state && history.state.modalOpen) {
                    history.back();
                }
            }
        }

        function showComingSoonModal() {
            const modal = document.getElementById('word-modal');
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.className = 'px-6 py-10 text-center flex flex-col items-center justify-center relative overflow-hidden';

            const glow = document.createElement('div');
            glow.className = 'absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none';
            const glow2 = document.createElement('div');
            glow2.className = 'absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none';
            wrap.append(glow, glow2);

            const iconWrap = document.createElement('div');
            iconWrap.className = 'w-20 h-20 bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl flex items-center justify-center mb-6 shadow-sm relative animate-pulse';
            iconWrap.innerHTML = '<i class="fa-solid fa-compass-drafting text-emerald-600 text-3xl"></i>';
            wrap.appendChild(iconWrap);

            const h3 = document.createElement('h3');
            h3.className = 'font-extrabold text-2xl mb-3 text-slate-800 tracking-tight';
            h3.textContent = 'Раздел в разработке';
            wrap.appendChild(h3);

            const p = document.createElement('p');
            p.className = 'text-sm text-slate-500 max-w-md mb-5 leading-relaxed';
            p.textContent = 'Интерактивный курс лезгинского языка с упражнениями и озвучкой скоро будет доступен! Мы усердно работаем над созданием качественных и увлекательных уроков.';
            wrap.appendChild(p);

            const tgLink = document.createElement('a');
            tgLink.href = 'https://t.me/lezgimez';
            tgLink.target = '_blank';
            tgLink.rel = 'noopener noreferrer';
            tgLink.className = 'text-sm font-medium text-emerald-600 hover:text-emerald-700 mb-8 inline-flex items-center gap-2';
            tgLink.innerHTML = '<i class="fa-brands fa-telegram text-lg"></i>Следить за обновлениями в Telegram';
            wrap.appendChild(tgLink);

            const okBtn = document.createElement('button');
            okBtn.className = 'w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-2xl text-base transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2';
            okBtn.innerHTML = 'Понятно';
            okBtn.addEventListener('click', closeModal);
            wrap.appendChild(okBtn);

            content.appendChild(wrap);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        // Tab switching
        const VALID_TABS = ['alphabet', 'vocabulary', 'course', 'practice', 'more'];
        const SEEN_SCREENS = new Set(); // чтобы анимация входа была только один раз
        let lastDialogTrigger = null;

        function switchTab(tab) {

            if (!tab || !VALID_TABS.includes(tab)) return;
            if (currentTab === tab) {
                document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
                return;
            }

            const prevTab = currentTab;
            currentTab = tab;

            tabSwitchGuard = true;
            history.replaceState(null, '', `#${tab}`);
            setTimeout(() => { tabSwitchGuard = false; }, 50);

            if (!localStorage.getItem('lezgi_notif_asked') && supportsNotifications() && Notification.permission === 'default') {
                document.getElementById('notif-banner')?.classList.remove('hidden');
            }

            const prevScreen = document.getElementById(`screen-${prevTab}`);
            const nextScreen = document.getElementById(`screen-${tab}`);
            const mainEl = document.querySelector('main');

            if (prevScreen) {
                prevScreen.classList.remove('active');
            }

            if (nextScreen) {
                nextScreen.classList.remove('active');
                const firstVisit = !SEEN_SCREENS.has(tab);
                if (firstVisit) {
                    SEEN_SCREENS.add(tab);
                    nextScreen.classList.add('entrance');
                    if (tab === 'practice') nextScreen.classList.add('fast');
                    void nextScreen.offsetHeight;
                } else {
                    nextScreen.classList.remove('entrance', 'fast');
                }
                nextScreen.classList.add('active');
                if (tab === 'vocabulary') renderWords(!firstVisit);
                if (tab === 'practice') renderGrammar();
                if (tab === 'course') { showCourseMainView(); renderCourseScreen(); }
                if (tab === 'more') { window.TelegramApp?.renderProfileCard?.(); updateStatsUI(); }
                document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
            }

            const nav = document.querySelector('.bottom-nav');
            if (tab === 'alphabet') {
                nav.classList.add('bg-[#121212]', 'border-t-white/10');
                nav.classList.remove('bg-white', 'border-t-slate-100');
            } else {
                nav.classList.remove('bg-[#121212]', 'border-t-white/10');
                nav.classList.add('bg-white', 'border-t-slate-100');
            }

            document.querySelectorAll('.nav-tab').forEach(t => {
                t.classList.remove('active', 'text-emerald-600', 'bg-emerald-50');
                t.classList.add('text-slate-500');
            });
            document.querySelectorAll(`.nav-tab[data-tab="${tab}"]`).forEach(t => {
                t.classList.add('active', 'text-emerald-600');
                t.classList.remove('text-slate-500');
                if (t.classList.contains('nav-tab-desktop')) {
                    t.classList.add('bg-emerald-50');
                }
            });
        }

        // Grammar
        async function loadGrammar() {
            try {
                const res = await fetch('grammar.json');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                GRAMMAR = await res.json();
                log(`[LezgiMez] Loaded ${GRAMMAR.length} grammar units`);
            } catch (e) {
                warn('[LezgiMez] Could not load grammar.json', e);
            } finally {
                const practiceGrammarView = document.getElementById('practice-grammar-view');
                if (practiceGrammarView && !practiceGrammarView.classList.contains('hidden')) {
                    renderGrammar();
                }
            }
        }

        function showGrammarList() {
            const mv = document.getElementById('practice-main-view');
            const gv = document.getElementById('practice-grammar-view');
            
            if (mv) mv.classList.add('hidden');
            if (gv) gv.classList.remove('hidden');
            
            if (typeof window.TelegramApp?.updateBackButton === 'function') {
                window.TelegramApp.updateBackButton();
            }
            renderGrammar();
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function hideGrammarList() {
            const mv = document.getElementById('practice-main-view');
            const gv = document.getElementById('practice-grammar-view');
            
            if (gv) gv.classList.add('hidden');
            if (mv) mv.classList.remove('hidden');
            
            if (typeof window.TelegramApp?.updateBackButton === 'function') {
                window.TelegramApp.updateBackButton();
            }
        }

        function grammarLevelLabel(level) {
            const map = { beginner: 'Начальный', intermediate: 'Средний', advanced: 'Продвинутый' };
            return map[level] || 'Урок';
        }

                function searchGrammar(query) {
            if (!query) return GRAMMAR;
            const cleanQuery = normalizeLezgiSearch(query);
            const terms = cleanQuery.split(/\s+/).filter(t => t.length > 0);
            if (terms.length === 0) return GRAMMAR;

            return GRAMMAR.map(unit => {
                const title = normalizeLezgiSearch(unit.title || "");
                const contentText = normalizeLezgiSearch(unit.content || "");
                let score = 0;

                terms.forEach(term => {
                    // Exact or prefix title match is heavily weighted
                    if (title.includes(term)) {
                        score += 20;
                        if (title.startsWith(term)) score += 10;
                    }
                    // Full-text occurrences in body text
                    let idx = -1;
                    while ((idx = contentText.indexOf(term, idx + 1)) !== -1) {
                        score += 3;
                    }
                });

                return { unit, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.unit);
        }

        function closeGrammarSearch() {
            const toggleBtn = document.getElementById('grammar-search-toggle');
            const searchContainer = document.getElementById('grammar-search-container');
            const searchInput = document.getElementById('grammar-search-input');
            const suggestions = document.getElementById('grammar-search-suggestions');
            const searchClear = document.getElementById('grammar-search-clear');

            if (searchContainer) searchContainer.classList.add('hidden');
            if (suggestions) suggestions.classList.add('hidden');
            if (searchInput) searchInput.value = '';
            if (searchClear) searchClear.classList.add('hidden');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="fa-solid fa-search"></i>';
                toggleBtn.className = 'w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors';
            }
            renderGrammar();
        }

        function renderGrammarSuggestions(list) {
            const suggestions = document.getElementById('grammar-search-suggestions');
            if (!suggestions) return;
            suggestions.innerHTML = '';

            if (list.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'px-4 py-3.5 text-sm text-slate-400 text-center';
                empty.textContent = 'Ничего не найдено';
                suggestions.appendChild(empty);
                suggestions.classList.remove('hidden');
                return;
            }

            list.forEach(unit => {
                const item = document.createElement('div');
                item.className = 'px-4 py-3.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors group';

                const left = document.createElement('div');
                left.className = 'flex items-center min-w-0';
                const sub = document.createElement('span');
                sub.className = 'text-xs text-emerald-600 font-bold mr-3 flex-shrink-0';
                sub.textContent = `Раздел ${unit.id}`;
                const title = document.createElement('span');
                title.className = 'text-sm font-semibold text-slate-700 truncate group-hover:text-emerald-600 transition-colors';
                title.textContent = unit.title;
                left.append(sub, title);

                item.append(left);

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showGrammarUnit(unit.id);
                    closeGrammarSearch();
                });
                suggestions.appendChild(item);
            });

            suggestions.classList.remove('hidden');
        }

        function initGrammarSearchBehavior() {
            const toggleBtn = document.getElementById('grammar-search-toggle');
            const searchContainer = document.getElementById('grammar-search-container');
            const searchInput = document.getElementById('grammar-search-input');
            const searchClear = document.getElementById('grammar-search-clear');
            const suggestions = document.getElementById('grammar-search-suggestions');

            if (!toggleBtn || !searchContainer || !searchInput || !suggestions) return;

            toggleBtn.addEventListener('click', () => {
                const isHidden = searchContainer.classList.contains('hidden');
                if (isHidden) {
                    searchContainer.classList.remove('hidden');
                    searchInput.focus();
                    toggleBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
                    toggleBtn.className = 'w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors';
                } else {
                    closeGrammarSearch();
                }
            });

            searchInput.addEventListener('focus', () => {
                const val = searchInput.value.trim();
                if (val.length === 0) {
                    suggestions.classList.add('hidden');
                } else {
                    const filtered = searchGrammar(val);
                    renderGrammarSuggestions(filtered);
                }
            });

            let debounceTimer = null;
            searchInput.addEventListener('input', () => {
                const val = searchInput.value.trim();
                if (searchClear) {
                    searchClear.classList.toggle('hidden', val.length === 0);
                }

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    if (val.length === 0) {
                        suggestions.classList.add('hidden');
                        renderGrammar();
                    } else {
                        const filtered = searchGrammar(val);
                        renderGrammarSuggestions(filtered);
                        renderGrammar(filtered);
                    }
                }, 150);
            });

            if (searchClear) {
                searchClear.addEventListener('click', () => {
                    searchInput.value = '';
                    searchClear.classList.add('hidden');
                    searchInput.focus();
                    suggestions.classList.add('hidden');
                    renderGrammar();
                });
            }

            // Close suggestions when clicking outside
            document.addEventListener('click', (e) => {
                if (searchContainer && suggestions && !searchContainer.contains(e.target) && e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
                    suggestions.classList.add('hidden');
                }
            });
        }

        function renderGrammar(filteredList) {
            const grid = document.getElementById('grammar-units-grid');
            const stats = document.getElementById('grammar-stats');
            if (!grid) return;
            grid.innerHTML = '';

            const list = filteredList || GRAMMAR;

            if (list.length === 0) {
                grid.innerHTML = '<div class="text-center py-10 text-slate-400">Ничего не найдено. Попробуйте другой запрос.</div>';
                return;
            }

            if (stats) {
                if (filteredList) {
                    stats.textContent = `Найдено разделов: ${list.length}`;
                } else {
                    stats.textContent = `${GRAMMAR.length} разделов • основы и практика`;
                }
            }

            list.forEach(unit => {
                const card = document.createElement('div');
                card.className = 'bg-white border border-slate-100 active:border-emerald-200 rounded-3xl p-5 flex items-center justify-between cursor-pointer shadow-sm hover:shadow-md transition-all';

                const left = document.createElement('div');
                const id = document.createElement('div');
                id.className = 'text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1';
                id.textContent = `Раздел ${unit.id}`;
                const title = document.createElement('div');
                title.className = 'text-lg font-bold text-slate-800 leading-tight';
                title.textContent = unit.title;
                left.append(id, title);

                const icon = document.createElement('div');
                icon.className = 'w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 flex-shrink-0 ml-4';
                icon.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

                card.append(left, icon);
                card.addEventListener('click', () => showGrammarUnit(unit.id));
                grid.appendChild(card);
            });

            staggerCards(grid);
        }

        function showGrammarUnit(unitId) {
            const unit = GRAMMAR.find(u => u.id === unitId);
            if (!unit) return;

            const modal = document.getElementById('word-modal');
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const topBar = document.createElement('div');
            topBar.className = 'app-header relative flex items-center justify-center px-16 py-4 border-b border-slate-100 bg-white shrink-0 z-10 w-full text-center';
            topBar.innerHTML = `<div class="font-bold text-slate-800 text-lg text-center w-full truncate">Теория</div>
                                <button id="modal-close-btn-grammar" class="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
                                    <i class="fa-solid fa-times"></i>
                                </button>`;

            const body = document.createElement('div');
            body.className = 'px-6 py-6 overflow-y-auto flex-1 min-h-0 w-full';
            body.style.webkitOverflowScrolling = 'touch';

            const id = document.createElement('div');
            id.className = 'text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1';
            id.textContent = `Раздел ${unit.id}`;
            const title = document.createElement('h2');
            title.className = 'text-2xl font-bold text-slate-900 mb-6 leading-tight';
            title.textContent = unit.title;

            const theory = document.createElement('div');
            theory.className = 'grammar-content max-w-none text-slate-700 leading-relaxed';
            theory.innerHTML = simpleMarkdown(unit.content);

            body.append(id, title, theory);

            if (unit.exercises && unit.exercises.length > 0) {
                const footer = document.createElement('div');
                footer.className = 'p-4 bg-white border-t border-slate-100 flex flex-col shrink-0 w-full';

                const startBtn = document.createElement('button');
                startBtn.className = 'w-full py-4 bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-colors';
                startBtn.innerHTML = '<i class="fa-solid fa-play"></i><span>Пройти упражнения</span>';
                startBtn.addEventListener('click', () => {
                    closeModal();
                    startGrammarQuiz(unit.id);
                });

                footer.append(startBtn);
                content.append(topBar, body, footer);
            } else {
                content.append(topBar, body);
            }

            document.getElementById('modal-close-btn-grammar').addEventListener('click', closeModal);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function escapeHtml(text = '') {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatInlineMarkdown(text = '') {
            let html = escapeHtml(text);
            html = html.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
            html = html.replace(/`([^`]+)`/g, '<code class="grammar-code">$1</code>');
            html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="grammar-strong">$1</strong>');
            html = html.replace(/\*([^*\n]+)\*/g, '<em class="grammar-em">$1</em>');

            if (html.includes('❌') && html.includes('✅')) {
                html = html.replace(/❌\s*Неправильно:\s*(.*?)\s*✅\s*Правильно:\s*(.*)/g, `
                    <div class="mt-3.5 flex flex-col gap-2.5 mb-1 w-full">
                        <div class="p-4 rounded-2xl grammar-wrong-card">
                            <div class="flex items-center gap-2 mb-1.5">
                                <i class="fa-solid fa-circle-xmark grammar-wrong text-sm"></i>
                                <span class="text-[11px] font-extrabold uppercase tracking-widest grammar-wrong">Неправильно</span>
                            </div>
                            <div class="text-[0.95rem] leading-relaxed opacity-90">$1</div>
                        </div>
                        <div class="p-4 rounded-2xl grammar-right-card">
                            <div class="flex items-center gap-2 mb-1.5">
                                <i class="fa-solid fa-circle-check grammar-right text-sm"></i>
                                <span class="text-[11px] font-extrabold uppercase tracking-widest grammar-right">Правильно</span>
                            </div>
                            <div class="text-[0.95rem] leading-relaxed opacity-90">$2</div>
                        </div>
                    </div>
                `);
            } else {
                html = html.replace(/❌\s*Неправильно:/g, '<span class="grammar-wrong font-bold">Неправильно:</span>');
                html = html.replace(/✅\s*Правильно:/g, '<span class="grammar-right font-bold">Правильно:</span>');
            }

            return html;
        }

        function renderListBlock(block, ordered = false) {
            const lines = block.split('\n').map(line => line.trimEnd()).filter(line => line.trim().length > 0);
            const marker = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
            const items = [];
            let current = null;

            function flushCurrent() {
                if (current !== null && current.trim()) items.push(current.trim());
                current = null;
            }

            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (marker.test(line)) {
                    flushCurrent();
                    current = line.replace(marker, '').trim();
                    continue;
                }

                if (ordered && /^[-*]\s+/.test(line) && current !== null) {
                    current += `\n${line}`;
                    continue;
                }

                if (current === null) current = line;
                else current += ` ${line}`;
            }
            flushCurrent();

            if (items.length === 0) return '';

            const tag = ordered ? 'ol' : 'ul';
            const isExamples = !ordered && items.every(item => item.includes(' — '));
            const cls = ordered ? 'grammar-ol' : (isExamples ? 'grammar-ul grammar-examples' : 'grammar-ul');

            const itemsHtml = items.map(item => {
                const parts = item.split(/\n(?=[-*]\s+)/).filter(Boolean);
                const main = parts.shift() || '';
                const mainHtml = formatInlineMarkdown(main);

                if (parts.length === 0) {
                    return `<li>${mainHtml}</li>`;
                }

                const subItems = parts
                    .map(part => part.replace(/^[-*]\s+/, '').trim())
                    .filter(Boolean)
                    .map(part => `<li>${formatInlineMarkdown(part)}</li>`)
                    .join('');

                return `<li>${mainHtml}<ul class="grammar-sublist">${subItems}</ul></li>`;
            }).join('');

            return `<${tag} class="${cls}">${itemsHtml}</${tag}>`;
        }

        function renderTableBlock(lines) {
            if (lines.length < 2) return '';

            const headerLine = lines[0];
            const headers = headerLine.split('|').map(cell => cell.trim()).filter(Boolean);

            let html = '<div class="grammar-table-wrapper"><table class="grammar-table"><thead><tr>';
            for (let th of headers) {
                html += `<th>${formatInlineMarkdown(th)}</th>`;
            }
            html += '</tr></thead><tbody>';

            for (let j = 2; j < lines.length; j++) {
                const rowLine = lines[j];
                const cells = rowLine.split('|').map(cell => cell.trim()).filter(Boolean);
                if (cells.length === 0) continue;
                html += '<tr>';
                for (let td of cells) {
                    html += `<td>${formatInlineMarkdown(td)}</td>`;
                }
                html += '</tr>';
            }

            html += '</tbody></table></div>';
            return html;
        }

        function renderMarkdownBlock(block) {
            if (/^#{1,3}\s+/.test(block)) {
                return `<h3 class="grammar-h3">${formatInlineMarkdown(block.replace(/^#{1,3}\s+/, '').trim())}</h3>`;
            }

            if (/^\*\*Для чего этот урок:\*\*/i.test(block) || /^\*\*Зачем этот юнит:\*\*/i.test(block)) {
                return `<div class="grammar-lead">${formatInlineMarkdown(block)}</div>`;
            }

            if (/^\*\*Обрати внимание:\*\*/i.test(block)) {
                return `<div class="grammar-note">${formatInlineMarkdown(block)}</div>`;
            }

            if (/^\*\*Резюме раздела/i.test(block)) {
                return `<div class="grammar-summary">${formatInlineMarkdown(block)}</div>`;
            }

            if (/^\*См\. также:/i.test(block)) {
                return `<div class="grammar-see">${formatInlineMarkdown(block)}</div>`;
            }
            if (/^\d+\.\s+/.test(block)) {
                return renderListBlock(block, true);
            }

            if (/^[-*]\s+/.test(block)) {
                return renderListBlock(block, false);
            }

            if (/^>\s*/.test(block)) {
                const cleaned = block.split('\n').map(l => l.replace(/^>\s*/, '')).join('\n');
                let html = formatInlineMarkdown(cleaned).replace(/\n/g, '<br>');
                if (html.startsWith('💡 Совет')) {
                    html = html.replace(/^💡 Совет(?:Заметь\s*|:\s*|\s+)?/, '<strong class="grammar-strong">💡 Совет:</strong> ');
                }
                return `<div class="grammar-note">${html}</div>`;
            }

            return `<p class="grammar-p">${formatInlineMarkdown(block).replace(/\n/g, '<br>')}</p>`;
        }

        function simpleMarkdown(md) {
            if (!md) return '';
            const normalized = String(md).replace(/\r\n/g, '\n').trim();
            if (!normalized) return '';
            const lines = normalized.split('\n');
            const rendered = [];
            const paragraphLines = [];

            function flushParagraph() {
                if (paragraphLines.length === 0) return;
                rendered.push(renderMarkdownBlock(paragraphLines.join('\n').trim()));
                paragraphLines.length = 0;
            }

            let i = 0;
            while (i < lines.length) {
                const rawLine = lines[i];
                const line = rawLine.trim();

                if (!line) {
                    flushParagraph();
                    i++;
                    continue;
                }

                if (/^#{1,3}\s+/.test(line)) {
                    flushParagraph();
                    rendered.push(renderMarkdownBlock(line));
                    i++;
                    continue;
                }

                if (line.startsWith('|')) {
                    flushParagraph();
                    const tableLines = [];
                    while (i < lines.length && lines[i].trim().startsWith('|')) {
                        tableLines.push(lines[i].trim());
                        i++;
                    }
                    rendered.push(renderTableBlock(tableLines));
                    continue;
                }

                if (/^\d+\.\s+/.test(line)) {
                    flushParagraph();
                    const listLines = [];
                    while (i < lines.length) {
                        const current = lines[i].trim();
                        if (!current) break;
                        if (/^\d+\.\s+/.test(current) || /^[-*]\s+/.test(current)) {
                            listLines.push(current);
                            i++;
                            continue;
                        }
                        if (listLines.length > 0) {
                            listLines.push(current);
                            i++;
                            continue;
                        }
                        break;
                    }
                    rendered.push(renderListBlock(listLines.join('\n'), true));
                    continue;
                }

                if (/^[-*]\s+/.test(line)) {
                    flushParagraph();
                    const listLines = [];
                    while (i < lines.length) {
                        const current = lines[i].trim();
                        if (!current) break;
                        if (/^[-*]\s+/.test(current)) {
                            listLines.push(current);
                            i++;
                            continue;
                        }
                        if (listLines.length > 0) {
                            listLines.push(current);
                            i++;
                            continue;
                        }
                        break;
                    }
                    rendered.push(renderListBlock(listLines.join('\n'), false));
                    continue;
                }

                paragraphLines.push(line);
                i++;
            }

            flushParagraph();
            return rendered.join('');
        }

        function startGrammarQuiz(unitId) {
            const unit = GRAMMAR.find(u => u.id === unitId);
            if (!unit || !unit.exercises || unit.exercises.length === 0) return;

            practiceState = {
                exercises: unit.exercises,
                idx: 0,
                score: 0,
                mode: 'grammar',
                unitTitle: unit.title
            };
            showGrammarQuestion();
        }

        function showGrammarQuestion() {
            const modal = document.getElementById('practice-modal');
            const content = document.getElementById('practice-content');
            const q = practiceState.exercises[practiceState.idx];
            content.innerHTML = '';

            const progress = Math.round((practiceState.idx / practiceState.exercises.length) * 100);

            const header = document.createElement('div');
            header.className = 'flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0 relative z-10 w-full sticky top-0';
            const hTitle = document.createElement('div');
            hTitle.className = 'font-bold text-slate-800 text-lg truncate mr-4';
            hTitle.textContent = practiceState.unitTitle;
            const close = document.createElement('button');
            close.className = 'w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 rounded-full transition-all';
            close.innerHTML = '<i class="fa-solid fa-times"></i>';
            close.addEventListener('click', endPractice);
            header.append(hTitle, close);

            const body = document.createElement('div');
            body.className = 'p-6';

            const qNum = document.createElement('div');
            qNum.className = 'text-emerald-600 text-xs font-bold uppercase tracking-wider mb-4';
            qNum.textContent = `Вопрос ${practiceState.idx + 1} из ${practiceState.exercises.length}`;

            const qText = document.createElement('div');
            qText.className = 'text-xl font-bold text-slate-800 mb-8 leading-tight';
            qText.textContent = q.question;

            const optsWrap = document.createElement('div');
            optsWrap.className = 'space-y-3';

            Object.entries(q.options).forEach(([key, val]) => {
                const b = document.createElement('button');
                b.className = 'w-full text-left px-5 py-4 border-2 border-slate-100 rounded-2xl flex items-center gap-4 transition-all bg-white';

                const keyCircle = document.createElement('div');
                keyCircle.className = 'w-8 h-8 rounded-full border-2 border-slate-100 flex items-center justify-center font-bold text-slate-400 flex-shrink-0';
                keyCircle.textContent = key;

                const valText = document.createElement('div');
                valText.className = 'font-medium text-slate-700';
                valText.textContent = val;

                b.append(keyCircle, valText);
                b.addEventListener('click', () => checkGrammarAnswer(key, q.correct, q.explanation, b));
                optsWrap.appendChild(b);
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

            body.append(qNum, qText, optsWrap, progWrap);
            content.append(header, body);

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function checkGrammarAnswer(selected, correct, explanation, btn) {
            const allBtns = btn.parentElement.querySelectorAll('button');
            allBtns.forEach(b => b.disabled = true);

            const isCorrect = selected === correct;
            if (isCorrect) { practiceState.score++; vibrateSuccess(); }
            else { vibrateError(); }

            btn.classList.add(isCorrect ? '!border-emerald-500' : '!border-red-300', isCorrect ? '!bg-emerald-50' : '!bg-red-50');
            const circle = btn.querySelector('div');
            circle.classList.replace('border-slate-100', isCorrect ? 'border-emerald-500' : 'border-red-300');
            circle.classList.replace('text-slate-400', isCorrect ? 'text-emerald-600' : 'text-red-500');
            if (isCorrect) circle.innerHTML = '<i class="fa-solid fa-check"></i>';
            else circle.innerHTML = '<i class="fa-solid fa-times"></i>';

            if (!isCorrect) {
                allBtns.forEach(b => {
                    const key = b.querySelector('div').textContent;
                    if (key === correct) {
                        b.classList.add('!border-emerald-500', '!bg-emerald-50');
                        b.querySelector('div').classList.replace('border-slate-100', 'border-emerald-500');
                        b.querySelector('div').classList.replace('text-slate-400', 'text-emerald-600');
                        b.querySelector('div').innerHTML = '<i class="fa-solid fa-check"></i>';
                    }
                });
            }

            // Show explanation
            const expl = document.createElement('div');
            expl.className = `mt-6 p-4 rounded-2xl text-sm leading-relaxed animate-fade-in ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`;
            expl.textContent = '';
            const resultStrong = document.createElement('strong');
            resultStrong.textContent = isCorrect ? 'Верно!' : 'Не совсем...';
            expl.append(resultStrong, document.createElement('br'), document.createTextNode(explanation));
            btn.parentElement.appendChild(expl);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'mt-6 w-full py-4 bg-slate-800 text-white font-bold rounded-2xl shadow-lg';
            nextBtn.textContent = (practiceState.idx + 1 === practiceState.exercises.length) ? 'Завершить' : 'Дальше';
            nextBtn.addEventListener('click', () => {
                practiceState.idx++;
                if (practiceState.idx >= practiceState.exercises.length) {
                    practiceState.words = practiceState.exercises; // For results calculation
                    showResults();
                } else {
                    showGrammarQuestion();
                }
            });
            btn.parentElement.appendChild(nextBtn);
        }

        // Practice
        // =============== ТЁМНАЯ ТЕМА ===============
        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            updateThemeUI();
        }

        function initTheme() {
            const saved = localStorage.getItem('lezgi_theme');
            if (saved) {
                applyTheme(saved);
            } else {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
                applyTheme(prefersDark.matches ? 'dark' : 'light');
            }

            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('lezgi_theme')) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }

        function toggleTheme() {
            const html = document.documentElement;
            const isDark = html.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('lezgi_theme', newTheme);
            updateThemeUI();
        }

        function updateThemeUI() {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const icon = document.getElementById('theme-icon');
            const label = document.getElementById('theme-label');
            if (icon) {
                icon.className = `fa-solid fa-${isDark ? 'sun' : 'moon'} w-5 text-emerald-600 text-center`;
            }
            if (label) {
                label.textContent = isDark ? 'Тёмная тема' : 'Светлая тема';
            }
        }

        function showCustomAlert(title, message, isError = false) {
            let el = document.getElementById('custom-app-alert');
            if (!el) {
                el = document.createElement('div');
                el.id = 'custom-app-alert';
                el.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300';
                document.body.appendChild(el);
            }
            el.innerHTML = `
                <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center">
                    <div class="w-12 h-12 rounded-2xl ${isError ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'} flex items-center justify-center text-xl mb-3">
                        <i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
                    </div>
                    <h3 class="font-bold text-slate-800 text-lg mb-1">${title}</h3>
                    <p class="text-slate-600 text-sm mb-5 leading-relaxed break-words">${message}</p>
                    <button type="button" data-alert-close class="w-full py-3 bg-emerald-600 active:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-md transition-colors">
                        Понятно
                    </button>
                </div>
            `;
            el.querySelector('[data-alert-close]')?.addEventListener('click', () => {
                el.classList.add('hidden');
            });
            el.classList.remove('hidden');
        }

        async function initiateDonation(amount, btnElement) {
            let originalContent = '';
            if (btnElement) {
                originalContent = btnElement.innerHTML;
                btnElement.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-amber-500"></i>';
                btnElement.classList.add('pointer-events-none', 'opacity-70');
            }
            try {
                await processStarsInvoice(amount);
            } catch (err) {
                console.error('[Donation] initiateDonation error:', err);
            } finally {
                if (btnElement) {
                    btnElement.innerHTML = originalContent;
                    btnElement.classList.remove('pointer-events-none', 'opacity-70');
                }
            }
        }

        async function processStarsInvoice(amount) {
            try {
                if (typeof Telegram !== 'undefined' && Telegram.WebApp && typeof Telegram.WebApp.MainButton !== 'undefined') {
                    try {
                        Telegram.WebApp.MainButton.setText('Создаем счет...');
                        Telegram.WebApp.MainButton.show();
                        Telegram.WebApp.MainButton.disable();
                    } catch(e) {}
                }

                let data = null;
                let lastError = null;

                const endpoints = [
                    '/api/create-invoice',
                    '/api/create-invoice.js',
                    '/api/create-invoice.php',
                    './api/create-invoice.php'
                ];

                for (const endpoint of endpoints) {
                    try {
                        const res = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount })
                        });
                        
                        let json = null;
                        try {
                            json = await res.json();
                        } catch (parseErr) {}

                        if (res.ok && json && json.ok && json.invoiceLink) {
                            data = json;
                            break;
                        } else {
                            const errMsg = (json && (json.error || json.message)) || `HTTP ${res.status} ${res.statusText}`;
                            throw new Error(errMsg);
                        }
                    } catch (e) {
                        console.warn(`[Donation] Endpoint ${endpoint} error:`, e);
                        lastError = e.message;
                    }
                }

                if (!data || !data.invoiceLink) {
                    throw new Error(lastError || 'Не удалось сформировать счет. Проверьте подключение.');
                }

                const tg = (typeof Telegram !== 'undefined' && Telegram.WebApp) ? Telegram.WebApp : null;

                if (tg && typeof tg.openInvoice === 'function') {
                    if (tg.MainButton) try { tg.MainButton.hide(); } catch(e) {}
                    tg.openInvoice(data.invoiceLink, function(status) {
                        if (status === 'paid') {
                            showCustomAlert('Спасибо!', `Спасибо за поддержку LezgiMez! Пожертвование ${amount} ⭐️ успешно отправлено.`);
                        } else if (status === 'failed') {
                            showCustomAlert('Ошибка оплаты', 'Не удалось провести платеж. Попробуйте еще раз.', true);
                        }
                    });
                } else if (tg && typeof tg.openTelegramLink === 'function') {
                    tg.openTelegramLink(data.invoiceLink);
                } else {
                    window.open(data.invoiceLink, '_blank');
                }
            } catch (err) {
                if (typeof warn === 'function') warn('[Donation] Error', err);
                else console.warn('[Donation] Error', err);

                if (typeof Telegram !== 'undefined' && Telegram.WebApp && typeof Telegram.WebApp.MainButton !== 'undefined') {
                    try { Telegram.WebApp.MainButton.hide(); } catch(e) {}
                }
                const msg = err.message || 'Не удалось сформировать счет. Попробуйте позже.';
                showCustomAlert('Ошибка доната', msg, true);
            }
        }

        function bindDonationButtons() {
            document.querySelectorAll('[data-donation-amount]').forEach((btn) => {
                if (btn.dataset.donationBound === 'true') return;
                btn.dataset.donationBound = 'true';
                btn.addEventListener('click', () => {
                    const amount = parseInt(btn.dataset.donationAmount, 10);
                    if (!Number.isFinite(amount)) return;
                    initiateDonation(amount, btn);
                });
            });
        }

        function updatePracticeStreakUI() {
            const streakCount = window.PROGRESS?.streak?.current || 1;
            const daysEl = document.getElementById('practice-streak-days');
            const tgStreakEl = document.getElementById('tg-user-streak');
            const suffix = streakCount === 1 ? 'день' : (streakCount >= 2 && streakCount <= 4 ? 'дня' : 'дней');
            const text = `${streakCount} ${suffix}`;
            if (daysEl) daysEl.textContent = text;
            if (tgStreakEl) tgStreakEl.textContent = text;
        }

        let currentLeaderboardTab = 'words';
        function openLeaderboardModal() {
            const modal = document.getElementById('leaderboard-modal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            renderLeaderboard(currentLeaderboardTab);
        }

        function closeLeaderboardModal() {
            const modal = document.getElementById('leaderboard-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        function renderLeaderboard(tab = 'words') {
            currentLeaderboardTab = tab;
            const listEl = document.getElementById('leaderboard-list');
            const btnWords = document.getElementById('leaderboard-tab-words');
            const btnStreak = document.getElementById('leaderboard-tab-streak');
            const myRankEl = document.getElementById('leaderboard-my-rank');
            const myNameEl = document.getElementById('leaderboard-my-name');
            const myScoreEl = document.getElementById('leaderboard-my-score');

            if (!listEl) return;

            if (btnWords && btnStreak) {
                if (tab === 'words') {
                    btnWords.className = 'flex-1 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white transition-colors';
                    btnStreak.className = 'flex-1 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 transition-colors';
                } else {
                    btnWords.className = 'flex-1 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 transition-colors';
                    btnStreak.className = 'flex-1 py-2 text-xs font-bold rounded-xl bg-amber-500 text-white transition-colors';
                }
            }

            const { baseList, currentUserItem } = typeof getLeaderboardData === 'function' ? getLeaderboardData() : { baseList: [], currentUserItem: {} };
            const fullList = [...baseList, currentUserItem];

            if (tab === 'words') {
                fullList.sort((a, b) => b.words - a.words || b.score - a.score);
            } else {
                fullList.sort((a, b) => b.streak - a.streak || b.words - a.words);
            }

            listEl.innerHTML = '';
            let myRank = 1;

            fullList.forEach((item, index) => {
                const rank = index + 1;
                if (item.isMe) myRank = rank;

                let medal = `#${rank}`;
                let medalBg = 'bg-slate-100 text-slate-600';
                if (rank === 1) { medal = '🥇'; medalBg = 'bg-amber-100 text-amber-800 text-sm'; }
                else if (rank === 2) { medal = '🥈'; medalBg = 'bg-slate-200 text-slate-800 text-sm'; }
                else if (rank === 3) { medal = '🥉'; medalBg = 'bg-amber-100 text-amber-900 text-sm'; }

                const isMe = item.isMe;
                const card = document.createElement('div');
                card.className = `flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isMe 
                        ? 'bg-emerald-50/80 border-emerald-300 shadow-sm' 
                        : 'bg-white border-slate-100 hover:border-slate-200'
                }`;

                const left = document.createElement('div');
                left.className = 'flex items-center gap-3 min-w-0';

                const rankBadge = document.createElement('div');
                rankBadge.className = `w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${medalBg}`;
                rankBadge.textContent = medal;

                const avatar = document.createElement('div');
                avatar.className = 'w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden';
                if (item.photo) {
                    avatar.innerHTML = `<img src="${item.photo}" class="w-full h-full object-cover">`;
                } else {
                    avatar.textContent = item.avatar || (item.name ? item.name.charAt(0) : 'U');
                }

                const nameWrap = document.createElement('div');
                nameWrap.className = 'min-w-0';
                const nameRow = document.createElement('div');
                nameRow.className = 'flex items-center gap-1.5';
                const name = document.createElement('div');
                name.className = `text-xs font-bold truncate ${isMe ? 'text-emerald-900' : 'text-slate-800'}`;
                name.textContent = isMe ? `${item.name} (Вы)` : item.name;
                nameRow.appendChild(name);

                const sub = document.createElement('div');
                sub.className = 'text-[11px] text-slate-400 truncate';
                sub.textContent = item.username || '';

                nameWrap.append(nameRow, sub);
                left.append(rankBadge, avatar, nameWrap);

                const right = document.createElement('div');
                right.className = 'text-right flex-shrink-0';
                if (tab === 'words') {
                    const score = document.createElement('div');
                    score.className = 'text-xs font-bold text-slate-800';
                    score.textContent = `${item.words} слов`;
                    const subText = document.createElement('div');
                    subText.className = 'text-[10px] text-slate-400';
                    subText.textContent = `🔥 ${item.streak} дн`;
                    right.append(score, subText);
                } else {
                    const score = document.createElement('div');
                    score.className = 'text-xs font-bold text-amber-600 flex items-center gap-1 justify-end';
                    score.innerHTML = `<span>🔥</span><span>${item.streak} дн</span>`;
                    const subText = document.createElement('div');
                    subText.className = 'text-[10px] text-slate-400';
                    subText.textContent = `${item.words} слов`;
                    right.append(score, subText);
                }

                card.append(left, right);
                listEl.appendChild(card);
            });

            if (myRankEl) myRankEl.textContent = `#${myRank}`;
            if (myNameEl) myNameEl.textContent = currentUserItem.name ? `${currentUserItem.name} (Вы)` : 'Вы';
            if (myScoreEl) {
                myScoreEl.textContent = tab === 'words' 
                    ? `${currentUserItem.words} слов` 
                    : `🔥 ${currentUserItem.streak} дн подряд`;
            }
        }

        function openFeedbackModal(defaultTopic = '') {
            const modal = document.getElementById('feedback-modal');
            const topicInput = document.getElementById('feedback-input-topic');
            const textInput = document.getElementById('feedback-input-text');
            if (!modal) return;
            if (topicInput) topicInput.value = defaultTopic;
            if (textInput) textInput.value = '';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeFeedbackModal() {
            const modal = document.getElementById('feedback-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        function sendFeedbackMessage() {
            const topic = document.getElementById('feedback-input-topic')?.value?.trim() || 'Предложение';
            const text = document.getElementById('feedback-input-text')?.value?.trim() || '';

            if (!text && !topic) {
                showCustomAlert('Заполните форму', 'Пожалуйста, напишите ваше предложение или вопрос.', true);
                return;
            }

            closeFeedbackModal();
            if (window.TelegramApp?.openSupportChat) {
                window.TelegramApp.openSupportChat(topic);
            } else {
                window.open('https://t.me/LezgiMez', '_blank');
            }
            showCustomAlert('Спасибо за отклик!', 'Ваше сообщение помогает делать LezgiMez лучше.');
        }

        window.initiateDonation = initiateDonation;
        window.processStarsInvoice = processStarsInvoice;
        window.showCustomAlert = showCustomAlert;
        window.updatePracticeStreakUI = updatePracticeStreakUI;
        window.openLeaderboardModal = openLeaderboardModal;
        window.closeLeaderboardModal = closeLeaderboardModal;
        window.renderLeaderboard = renderLeaderboard;
        window.openFeedbackModal = openFeedbackModal;
        window.closeFeedbackModal = closeFeedbackModal;
        window.sendFeedbackMessage = sendFeedbackMessage;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindDonationButtons, { once: true });
        } else {
            bindDonationButtons();
        }
