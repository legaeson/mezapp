        function pluralize(n, one, few, many) {
            const num = Math.abs(n) % 100;
            const n1 = num % 10;
            if (num > 10 && num < 20) return `${n} ${many}`;
            if (n1 > 1 && n1 < 5) return `${n} ${few}`;
            if (n1 === 1) return `${n} ${one}`;
            return `${n} ${many}`;
        }
        window.pluralize = pluralize;

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
                icon.className = `fa-${isFav ? 'solid' : 'regular'} fa-star ${isFav ? 'text-amber-400' : 'text-slate-400'}`;
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
                const ex = normalizeLezgiSearch(word.ex || '');
                const tags = (word.tags || []).map(t => normalizeLezgiSearch(t));
                const lat = normalizeLezgiSearch(word.lz_lat || (typeof transliterateLezgi === 'function' ? transliterateLezgi(word.lz) : ''));

                const mazin = word.mazin ? normalizeLezgiSearch(word.mazin) : '';
                const mazinLat = word.mazin_lat ? normalizeLezgiSearch(word.mazin_lat) : '';
                const mazinAcad = word.mazin_academic ? normalizeLezgiSearch(word.mazin_academic) : '';
                const mazinAcadLat = word.mazin_academic_lat ? normalizeLezgiSearch(word.mazin_academic_lat) : '';

                word._search = {
                    lz, ru, ex, tags, lat,
                    lzParts: splitParts(lz),
                    ruParts: splitParts(ru),
                    latParts: splitParts(lat),
                    lzClean: cleanString(lz),
                    latClean: cleanString(lat),
                    lzPartsClean: splitParts(lz).map(cleanString),
                    latPartsClean: splitParts(lat).map(cleanString),
                    exClean: cleanString(ex),
                    tagsClean: tags.map(cleanString),
                    // Dialect fields
                    mazin,
                    mazinClean: cleanString(mazin),
                    mazinParts: splitParts(mazin),
                    mazinPartsClean: splitParts(mazin).map(cleanString),
                    mazinLat,
                    mazinLatParts: splitParts(mazinLat),
                    mazinAcad,
                    mazinAcadClean: cleanString(mazinAcad),
                    mazinAcadParts: splitParts(mazinAcad),
                    mazinAcadPartsClean: splitParts(mazinAcad).map(cleanString),
                    mazinAcadLat,
                    mazinAcadLatParts: splitParts(mazinAcadLat)
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
                const hasLatMatch = item.lat && (item.latClean.includes(qClean) || item.lat.includes(q));
                const hasRuMatch = item.ru.includes(q);
                const hasTagsMatch = item.tags.some((tag, idx) => tag.includes(q) || item.tagsClean[idx].includes(qClean));
                const hasExMatch = item.exClean.includes(qClean);
                const hasMazinMatch = (
                    (item.mazin && item.mazinClean.includes(qClean)) ||
                    (item.mazinLat && item.mazinLat.includes(q)) ||
                    (item.mazinAcad && item.mazinAcadClean.includes(qClean)) ||
                    (item.mazinAcadLat && item.mazinAcadLat.includes(q))
                );

                if (!hasLzMatch && !hasLatMatch && !hasRuMatch && !hasTagsMatch && !hasExMatch && !hasMazinMatch) continue;

                let score = 0;
                let usedPalochkaFallback = false;

                if (hasLatMatch) {
                    if (item.lat === q || item.latClean === qClean) {
                        score += 9500;
                    } else if (item.lat.startsWith(q) || item.latClean.startsWith(qClean)) {
                        score += 3200;
                    } else if (item.lat.includes(q) || item.latClean.includes(qClean)) {
                        score += 1100;
                    }
                }

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

                // 7. Dialect match
                if (hasMazinMatch) {
                    if (item.mazin === q || item.mazinAcad === q || item.mazinLat === q || item.mazinAcadLat === q) {
                        score += 9000;
                    } else if (item.mazinClean === qClean || item.mazinAcadClean === qClean) {
                        score += 7500;
                        usedPalochkaFallback = true;
                    } else if ((item.mazin && item.mazin.startsWith(q)) || (item.mazinAcad && item.mazinAcad.startsWith(q)) || (item.mazinLat && item.mazinLat.startsWith(q))) {
                        score += 3000;
                    } else if ((item.mazinClean && item.mazinClean.startsWith(qClean)) || (item.mazinAcadClean && item.mazinAcadClean.startsWith(qClean))) {
                        score += 2000;
                        usedPalochkaFallback = true;
                    } else if ((item.mazin && item.mazin.includes(q)) || (item.mazinAcad && item.mazinAcad.includes(q)) || (item.mazinLat && item.mazinLat.includes(q))) {
                        score += 1000;
                    } else if ((item.mazinClean && item.mazinClean.includes(qClean)) || (item.mazinAcadClean && item.mazinAcadClean.includes(qClean))) {
                        score += 800;
                        usedPalochkaFallback = true;
                    }

                    // Parts match for multi-word dialect entries
                    const allMazinParts = [...(item.mazinParts || []), ...(item.mazinAcadParts || []), ...(item.mazinLatParts || [])];
                    const allMazinPartsClean = [...(item.mazinPartsClean || []), ...(item.mazinAcadPartsClean || [])];

                    for (let j = 0; j < allMazinParts.length; j++) {
                        const part = allMazinParts[j];
                        if (part === q) {
                            score += 4000;
                        } else if (part.startsWith(q)) {
                            score += 2000 + (q.length / part.length * 300);
                        } else if (part.includes(q)) {
                            score += 800 + (q.length / part.length * 50);
                        }
                    }
                    for (let j = 0; j < allMazinPartsClean.length; j++) {
                        const cleanPart = allMazinPartsClean[j];
                        if (cleanPart === qClean) {
                            score += 3000;
                            usedPalochkaFallback = true;
                        } else if (cleanPart.startsWith(qClean)) {
                            score += 1500 + (qClean.length / cleanPart.length * 200);
                            usedPalochkaFallback = true;
                        } else if (cleanPart.includes(qClean)) {
                            score += 600 + (qClean.length / cleanPart.length * 40);
                            usedPalochkaFallback = true;
                        }
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
                hint = 'Показаны результаты с нормализацией кӀ/кӀ/кӀ и похожих символов';
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
                if (val === 'favorites') div.className += ' border-b border-emerald-100/60 dark:border-white/10 pb-2 mb-1';
                if (val === 'mazin') div.className += ' border-b border-emerald-100/60 dark:border-white/10 pb-2 mb-1.5';
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
                vocabPanel.appendChild(createOption('mazin', 'Мазинский говор', 'vocab'));
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
                if (val === 'mazin') return WORDS.filter(w => w.mazin && w.mazin !== 'В слове').length;
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
            const scrollContainer = document.querySelector('#screen-vocabulary .overflow-y-auto');
            if (scrollContainer) scrollContainer.scrollTop = 0;
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
                if (!infoText) return;
                if (!infoText.dataset.orig) {
                    infoText.dataset.orig = infoText.textContent;
                }

                if (isAvailable) {
                    if (cat !== 'all') {
                        infoText.textContent = `Доступно слов: ${count}`;
                    } else {
                        infoText.textContent = infoText.dataset.orig;
                    }
                    infoText.classList.remove('text-red-500');
                } else {
                    infoText.textContent = `Нужно еще ${mode.min - count} слов (минимум ${mode.min})`;
                    infoText.classList.add('text-red-500');
                }
            });

            // Special handling for SRS Review mode — show due count
            const reviewEl = document.getElementById('prac-mode-review');
            const reviewSubtitle = document.getElementById('prac-review-subtitle');
            if (reviewEl) {
                const isAvailable = count >= 4;
                reviewEl.classList.toggle('opacity-40', !isAvailable);
                reviewEl.classList.toggle('pointer-events-none', !isAvailable);

                if (reviewSubtitle) {
                    if (!isAvailable) {
                        reviewSubtitle.textContent = 'Нужно минимум 4 слова в базе';
                        reviewSubtitle.classList.add('text-red-500');
                    } else {
                        reviewSubtitle.classList.remove('text-red-500');
                        // Count SRS due words
                        try {
                            const now = Date.now();
                            const srs = (typeof PROGRESS !== 'undefined' && PROGRESS && typeof PROGRESS.srs === 'object' && PROGRESS.srs) ? PROGRESS.srs : {};
                            const poolWords = (typeof WORDS !== 'undefined' && Array.isArray(WORDS)) ? WORDS : [];
                            const due = poolWords.filter(w =>
                                srs[w.id] && srs[w.id].next <= now && (srs[w.id].ivl || 0) > 0
                            );
                            const weak = poolWords.filter(w => {
                                if (due.find(d => d.id === w.id)) return false;
                                const card = srs[w.id];
                                return card && ((card.errors || 0) > (card.success || 0) || (card.ease || 2.5) <= 1.8);
                            });
                            const fresh = poolWords.filter(w =>
                                !srs[w.id] || (srs[w.id].ivl || 0) === 0
                            );
                            if (due.length > 0 || weak.length > 0) {
                                const urgentCount = due.length + weak.length;
                                const cardsStr = (typeof pluralize === 'function')
                                    ? pluralize(urgentCount, 'карточка', 'карточки', 'карточек')
                                    : `${urgentCount} карточек`;
                                reviewSubtitle.textContent = `${cardsStr} к повторению`;
                            } else if (fresh.length > 0) {
                                const freshStr = (typeof pluralize === 'function')
                                    ? pluralize(fresh.length, 'новое слово', 'новых слова', 'новых слов')
                                    : `${fresh.length} новых слов`;
                                reviewSubtitle.textContent = `${freshStr} для изучения`;
                            } else {
                                reviewSubtitle.textContent = 'Всё повторено — отличная работа!';
                            }
                        } catch (e) {
                            reviewSubtitle.textContent = 'Интервальное повторение с таймером';
                        }
                    }
                }
            }
        }

        function updateVocabStats() {
            const statsEl = document.getElementById('vocab-stats');
            const countEl = document.getElementById('words-count');
            if (typeof WORDS === 'undefined' || !WORDS || !WORDS.length) return;
            const catCount = [...new Set(WORDS.map(w => w.cat))].length;
            const wordsStr = pluralize(WORDS.length, 'слово', 'слова', 'слов');
            const catsStr = pluralize(catCount, 'категория', 'категории', 'категорий');
            if (statsEl) statsEl.textContent = `${wordsStr} • ${catsStr}`;
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
            { "letter": "Къ къ", "ipa": "/q/" }, { "letter": "Кь кь", "ipa": "/q'/" }, { "letter": "КӀ кӀ", "ipa": "/k'/" },
            { "letter": "Л л", "ipa": "/l/" }, { "letter": "М м", "ipa": "/m/" },
            { "letter": "Н н", "ipa": "/n/" }, { "letter": "П п", "ipa": "/pʰ/ ~ /p/" }, { "letter": "ПӀ пӀ", "ipa": "/p'/" },
            { "letter": "Р р", "ipa": "/r/" }, { "letter": "С с", "ipa": "/s/" },
            { "letter": "Т т", "ipa": "/tʰ/ ~ /t/" }, { "letter": "ТӀ тӀ", "ipa": "/t'/" },
            { "letter": "У у", "ipa": "/u/" }, { "letter": "Уь уь", "ipa": "/y/" },
            { "letter": "Ф ф", "ipa": "/f/" }, { "letter": "Х х", "ipa": "/χ/" },
            { "letter": "Хъ хъ", "ipa": "/qʰ/" }, { "letter": "Хь хь", "ipa": "/x/" },
            { "letter": "Ц ц", "ipa": "/tsʰ/ ~ /ts/" }, { "letter": "ЦӀ цӀ", "ipa": "/ts'/" },
            { "letter": "Ч ч", "ipa": "/tʃʰ/ ~ /tʃ/" }, { "letter": "ЧӀ чӀ", "ipa": "/tʃ'/" },
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

            const isLatin = typeof isLatinEnabled === 'function' && isLatinEnabled();

            ALPHABET.forEach((item, idx) => {
                const upper = item.letter.split(' ')[0];
                const latUpper = typeof transliterateLezgin === 'function' ? transliterateLezgin(upper) : '';

                const card = document.createElement('div');
                card.className = `letter-card bg-white border border-slate-100 active:border-emerald-500 rounded-2xl h-20 flex flex-col items-center justify-center text-center cursor-pointer transition-all shadow-sm p-1`;
                card.setAttribute('role', 'button');

                const displayLetter = isLatin ? (latUpper || upper) : upper;
                const mainEl = document.createElement('div');
                mainEl.className = 'flex items-center justify-center font-bold text-emerald-900 dark:text-emerald-300 leading-none select-none';
                mainEl.style.fontSize = '32px';
                mainEl.textContent = displayLetter;

                card.append(mainEl);

                if (isLatin && latUpper && latUpper !== upper) {
                    const subEl = document.createElement('div');
                    subEl.className = 'text-[11px] font-semibold text-slate-400 mt-1 select-none leading-none';
                    subEl.textContent = upper;
                    card.append(subEl);
                }

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
            const normMain = normalizeLezgiSearch(main);
            const soundFile = normMain;

            // Все графемы алфавита (первая часть, например "К", "Къ", "Кь", "КӀ")
            const allGraphemes = ALPHABET.map(l => l.letter.split(' ')[0]);
            // Графемы, которые начинаются так же, но длиннее (например для "К" → "Къ", "Кь", "КӀ")
            const longerGraphemes = allGraphemes.filter(g => {
                const normG = normalizeLezgiSearch(g);
                return normG.startsWith(normMain) && normG.length > normMain.length;
            });
            const normLonger = longerGraphemes.map(g => normalizeLezgiSearch(g));

            // Примеры: слова, начинающиеся ровно на эту графему, а не на составные
            const examples = WORDS.filter(w => {
                const normLz = normalizeLezgiSearch(w.lz);
                if (!normLz.startsWith(normMain)) return false;
                // Исключаем слова, начинающиеся с составной графемы (Къ, Кь, КӀ и т.д.)
                return !normLonger.some(nl => normLz.startsWith(nl));
            }).slice(0, 5);

            const body = document.createElement('div');
            body.className = 'px-6 pt-3 pb-8 sm:pb-10 flex flex-col flex-1 min-h-0 overflow-y-auto';

            const dragHandle = document.createElement('div');
            dragHandle.className = 'w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-1 mb-5 shrink-0';
            body.append(dragHandle);

            const header = document.createElement('div');
            header.className = 'flex justify-between items-center mb-5';

            const isLatin = typeof isLatinEnabled === 'function' && isLatinEnabled();
            const latLetter = typeof transliterateLezgin === 'function' ? transliterateLezgin(item.letter) : '';

            const left = document.createElement('div');
            const catSpan = document.createElement('div');
            catSpan.className = 'uppercase tracking-[1.5px] text-emerald-600 dark:text-emerald-400 text-xs font-bold';
            catSpan.textContent = 'АЛФАВИТ';

            const h1 = document.createElement('div');
            h1.className = 'text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1';
            h1.textContent = isLatin ? (latLetter || item.letter) : item.letter;
            left.append(catSpan, h1);

            if (isLatin && latLetter && latLetter !== item.letter) {
                const subCyr = document.createElement('div');
                subCyr.className = 'text-lg font-semibold text-slate-400 mt-0.5';
                subCyr.textContent = item.letter;
                left.append(subCyr);
            }

            const right = document.createElement('div');
            const close = document.createElement('button');
            close.id = 'modal-close-btn-letter';
            close.className = 'w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-200 active:bg-slate-300 transition-colors cursor-pointer';
            close.innerHTML = '<i class="fa-solid fa-times text-base"></i>';
            close.addEventListener('click', closeModal);
            right.append(close);

            header.append(left, right);

            const info = document.createElement('div');
            info.className = 'flex items-center justify-between bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl p-4 sm:p-5 mb-6';

            const ipaWrap = document.createElement('div');
            const ipaLabel = document.createElement('div');
            ipaLabel.className = 'text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5';
            ipaLabel.textContent = 'Транскрипция';
            const ipaText = document.createElement('div');
            ipaText.className = 'text-2xl font-bold text-slate-800 dark:text-white tracking-wide font-sans';
            ipaText.textContent = item.ipa.trim();
            ipaWrap.append(ipaLabel, ipaText);

            const playBtn = document.createElement('button');
            playBtn.className = 'w-12 h-12 flex flex-shrink-0 items-center justify-center bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-full text-xl transition-transform active:scale-95 shadow-md shadow-emerald-600/20 cursor-pointer';
            playBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            playBtn.setAttribute('title', 'Прослушать букву');
            playBtn.addEventListener('click', () => {
                speakWord(null, `audio/alphabet/${soundFile}.mp3`);
            });

            info.append(ipaWrap, playBtn);
            body.append(header, info);

            const exSection = document.createElement('div');
            exSection.className = 'flex-1 flex flex-col';
            const exHeader = document.createElement('div');
            exHeader.className = 'text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3';
            exHeader.textContent = 'Примеры слов';
            exSection.append(exHeader);

            if (examples.length > 0) {
                const exList = document.createElement('div');
                exList.className = 'flex flex-col gap-2.5';

                examples.forEach(w => {
                    const primaryRu = (w.ru || '').split(/[,;]/)[0].trim();

                    const exRow = document.createElement('div');
                    exRow.className = 'flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 dark:bg-white/5 hover:bg-slate-100/80 dark:hover:bg-white/10 border border-slate-100 dark:border-white/5 rounded-2xl transition-all';

                    const isLat = typeof isLatinEnabled === 'function' && isLatinEnabled();
                    const wordLz = isLat ? (w.lz_lat || (typeof transliterateLezgin === 'function' ? transliterateLezgin(w.lz) : w.lz)) : w.lz;

                    const lz = document.createElement('div');
                    lz.className = 'font-bold text-emerald-900 dark:text-emerald-400 text-base leading-snug';

                    if (isLat) {
                        lz.textContent = wordLz;
                    } else {
                        const prefixLen = main.length;
                        const prefixStr = w.lz.substring(0, prefixLen);
                        const restStr = w.lz.substring(prefixLen);
                        const highlighted = document.createElement('span');
                        highlighted.className = 'text-emerald-600 dark:text-emerald-500';
                        highlighted.textContent = prefixStr;
                        lz.append(highlighted, document.createTextNode(restStr));
                    }

                    const ru = document.createElement('div');
                    ru.className = 'text-slate-600 dark:text-slate-300 text-sm font-medium leading-snug text-right';
                    ru.textContent = primaryRu;

                    exRow.append(lz, ru);
                    exList.append(exRow);
                });
                exSection.append(exList);
            } else {
                const noEx = document.createElement('div');
                noEx.className = 'text-sm text-slate-400 italic text-center py-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 border-dashed';
                noEx.textContent = 'На эту букву пока нет примеров в словаре';
                exSection.append(noEx);
            }
            body.append(exSection);

            content.append(body);
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            modal.classList.add('is-fullscreen');
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
            } else if (currentFilter.category === 'mazin') {
                scopedWords = scopedWords.filter(w => w.mazin && w.mazin !== 'В слове');
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
                grid.innerHTML = '';
                loadedCount = PAGE_SIZE;
                const scrollContainer = document.querySelector('#screen-vocabulary .overflow-y-auto');
                if (scrollContainer) scrollContainer.scrollTop = 0;
            }
            const start = append ? loadedCount : 0;
            const pageWords = filtered.slice(start, start + PAGE_SIZE);
            if (append) {
                loadedCount += PAGE_SIZE;
            }
            log(`[renderWords] Current loadedCount: ${loadedCount}, Total filtered words: ${filtered.length}`);
            // loadedCount теперь всегда отражает количество загруженных элементов (20, 40, 60...)

            // Context Banner (Hidden)
            let contextBanner = document.getElementById('vocab-context');
            if (contextBanner) {
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
                } else if (currentFilter.category === 'mazin') {
                    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-100 rounded-3xl mt-2 shadow-sm">
                        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fa-solid fa-mountain-sun text-3xl text-slate-300"></i>
                        </div>
                        <h3 class="font-semibold text-slate-700 text-lg">Нет слов мазинского говора</h3>
                        <p class="text-sm mt-1 px-6">Слова с соответствиями в мазинском говоре не найдены.</p>
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

            pageWords.forEach((word, idx) => {
                const card = document.createElement('div');
                card.className = 'word-card bg-white border border-slate-100 rounded-3xl p-4 sm:p-5 flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-[0.98] relative overflow-hidden';
                card.addEventListener('click', () => showWordModal(word.id));

                const content = document.createElement('div');
                content.className = 'flex-1 min-w-0';

                const wordLine = document.createElement('div');
                wordLine.className = 'leading-normal flex flex-wrap items-center pt-0.5';

                const isLatin = typeof isLatinEnabled === 'function' && isLatinEnabled();
                const lzWord = typeof getLezgiWord === 'function' ? getLezgiWord(word) : (isLatin ? (word.lz_lat || word.lz) : word.lz);

                const lzMain = document.createElement('span');
                lzMain.className = 'text-emerald-900 dark:text-emerald-300 font-bold text-base sm:text-lg';
                lzMain.textContent = lzWord;

                // Display only the first translation on the card
                const primaryRu = (word.ru || '').split(/[,;]/)[0].trim();

                const ruWrap = document.createElement('span');
                ruWrap.className = 'inline-flex items-center text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal whitespace-nowrap';

                const dash = document.createElement('span');
                dash.className = 'text-slate-300 dark:text-slate-600 font-normal select-none';
                dash.style.marginLeft = '6px';
                dash.style.marginRight = '7px';
                dash.textContent = '—';

                const ru = document.createElement('span');
                ru.textContent = primaryRu;

                ruWrap.append(dash, ru);
                wordLine.append(lzMain, ruWrap);

                const metaWrap = document.createElement('div');
                metaWrap.className = 'flex items-center gap-2 mt-1.5 flex-wrap';

                if (isLatin && word.lz && lzWord !== word.lz) {
                    const cyrTag = document.createElement('span');
                    cyrTag.className = 'text-xs text-slate-400 font-medium mr-1';
                    cyrTag.textContent = word.lz;
                    metaWrap.append(cyrTag);
                }

                const cat = document.createElement('div');
                cat.className = 'text-[10px] text-slate-400 font-bold uppercase tracking-wider';
                cat.textContent = word.cat;

                metaWrap.append(cat);
                content.append(wordLine, metaWrap);
                card.append(content);
                grid.appendChild(card);
            });

            renderLoadMore(filtered.length);
            if (!skipAnimation && !append) staggerCards(grid);
        }
        let vocabObserver = null;
        let isVocabLoading = false;

        function initVocabInfiniteScroll() {
            const pagination = document.getElementById('pagination');
            const scrollContainer = document.querySelector('#screen-vocabulary .overflow-y-auto');
            if (!pagination || !scrollContainer) return;

            if (vocabObserver) {
                vocabObserver.disconnect();
            }

            if (typeof IntersectionObserver !== 'undefined') {
                vocabObserver = new IntersectionObserver((entries) => {
                    const entry = entries[0];
                    if (entry && entry.isIntersecting && !isVocabLoading) {
                        const currentTotal = parseInt(document.getElementById('results-count')?.textContent || '0', 10);
                        if (loadedCount < currentTotal) {
                            isVocabLoading = true;
                            renderWords(true, true);
                            setTimeout(() => { isVocabLoading = false; }, 250);
                        }
                    }
                }, {
                    root: scrollContainer,
                    rootMargin: '250px 0px 250px 0px',
                    threshold: 0.05
                });
                vocabObserver.observe(pagination);
            }

            if (!scrollContainer._hasInfiniteScroll) {
                scrollContainer._hasInfiniteScroll = true;
                scrollContainer.addEventListener('scroll', () => {
                    if (isVocabLoading) return;
                    const currentTotal = parseInt(document.getElementById('results-count')?.textContent || '0', 10);
                    if (loadedCount >= currentTotal) return;
                    if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 350) {
                        isVocabLoading = true;
                        renderWords(true, true);
                        setTimeout(() => { isVocabLoading = false; }, 250);
                    }
                }, { passive: true });
            }
        }

        function renderLoadMore(total) {
            const container = document.getElementById('pagination');
            if (!container) return;
            container.innerHTML = '';
            log(`[renderLoadMore] Checking if button needed. Loaded: ${loadedCount}, Total: ${total}`);
            if (loadedCount >= total) {
                const done = document.createElement('div');
                done.className = 'text-sm text-slate-400 font-medium py-3 text-center';
                done.textContent = `Все слова загружены (${total})`;
                container.appendChild(done);
                if (vocabObserver) vocabObserver.disconnect();
                return;
            }
            const nextBatch = Math.min(loadedCount + PAGE_SIZE, total);
            const btn = document.createElement('button');
            btn.className = 'px-6 py-3 text-sm font-semibold rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 active:bg-emerald-100 w-full flex items-center justify-center gap-2';
            btn.innerHTML = `Загрузить ещё (${loadedCount + 1}–${nextBatch} из ${total})`;
            btn.onclick = () => {
                isVocabLoading = true;
                renderWords(true, true);
                setTimeout(() => { isVocabLoading = false; }, 250);
            };
            container.appendChild(btn);

            initVocabInfiniteScroll();
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

            const dragHandle = document.createElement('div');
            dragHandle.className = 'w-10 h-1 bg-slate-200 rounded-full mx-auto my-2 shrink-0';
            body.append(dragHandle);

            const tr = word.lz_lat || (typeof transliterateLezgin === 'function' ? transliterateLezgin(word.lz) : '');

            const header = document.createElement('div');
            header.className = 'flex justify-between items-start gap-4 pt-1';

            const left = document.createElement('div');
            left.className = 'flex-1 min-w-0';

            // Category label
            const catSpan = document.createElement('span');
            catSpan.className = 'block text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1.5 leading-none';
            catSpan.textContent = word.cat;
            left.append(catSpan);

            // Translations parsing (Primary and others)
            const ruParts = (word.ru || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
            const primaryRu = ruParts[0] || (word.ru || '');
            const secondaryRu = ruParts.slice(1);

            // Word Title + Primary Translation on same line: "Слово — Перевод"
            const titleRow = document.createElement('div');
            titleRow.className = 'leading-snug mt-0.5 flex flex-wrap items-center';

            const isLatin = typeof isLatinEnabled === 'function' && isLatinEnabled();

            const lzWord = document.createElement('span');
            lzWord.className = 'text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading';
            lzWord.textContent = isLatin ? (tr || word.lz) : word.lz;

            const ruWrap = document.createElement('span');
            ruWrap.className = 'inline-flex items-center text-2xl sm:text-3xl font-semibold text-slate-700 dark:text-slate-200 tracking-tight font-heading whitespace-nowrap';

            const dash = document.createElement('span');
            dash.className = 'text-xl sm:text-2xl font-light text-slate-300 dark:text-slate-600 select-none';
            dash.style.marginLeft = '7px';
            dash.style.marginRight = '8px';
            dash.textContent = '—';

            const ruWord = document.createElement('span');
            ruWord.textContent = primaryRu;

            ruWrap.append(dash, ruWord);
            titleRow.append(lzWord, ruWrap);
            left.append(titleRow);

            // Subtitle: if Latin is active, show Cyrillic below
            if (isLatin && word.lz && word.lz !== lzWord.textContent) {
                const trRow = document.createElement('div');
                trRow.className = 'mt-0.5 text-2xl sm:text-3xl font-bold text-slate-400 dark:text-slate-500 tracking-tight font-heading';
                trRow.textContent = word.lz;
                left.append(trRow);
            }

            // Secondary translations if any
            if (secondaryRu.length > 0) {
                const otherWrap = document.createElement('div');
                otherWrap.className = 'mt-2 flex items-center gap-1.5 flex-wrap text-sm text-slate-500 dark:text-slate-400 font-normal';
                otherWrap.innerHTML = `<span class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Другие значения:</span> <span class="text-slate-700 dark:text-slate-200 font-medium">${secondaryRu.join(', ')}</span>`;
                left.append(otherWrap);
            }

            if (SHOW_VOCABULARY_IPA && word.ipa) {
                const ipa = document.createElement('div');
                ipa.className = 'mt-1.5 ipa-text text-sm text-slate-400';
                ipa.textContent = word.ipa;
                left.append(ipa);
            }

            const right = document.createElement('div');
            right.className = 'flex items-center gap-2 flex-shrink-0 pt-0.5';

            const reportBtn = document.createElement('button');
            reportBtn.className = 'w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 active:bg-rose-100 transition-colors cursor-pointer';
            reportBtn.title = 'Сообщить об ошибке';
            reportBtn.setAttribute('aria-label', 'Сообщить об ошибке в слове');
            reportBtn.innerHTML = '<i class="fa-solid fa-flag text-xs"></i>';
            reportBtn.addEventListener('click', () => {
                showReportForm(word);
            });

            const close = document.createElement('button');
            close.id = 'modal-close-btn';
            close.className = 'w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 active:bg-slate-300 transition-colors cursor-pointer';
            close.innerHTML = '<i class="fa-solid fa-times text-xs"></i>';
            close.addEventListener('click', closeModal);

            right.append(reportBtn, close);
            header.append(left, right);
            body.append(header);

            if (word.mazin && word.mazin !== 'В слове') {
                const dialectSection = document.createElement('div');
                dialectSection.className = 'mt-6 pt-4 border-t border-slate-100/80 dark:border-white/5';
                
                const dialectTitle = document.createElement('div');
                dialectTitle.className = 'text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest mb-1.5';
                dialectTitle.textContent = 'Мазинский говор (Маза)';
                dialectSection.appendChild(dialectTitle);

                const mazinWord = document.createElement('div');
                mazinWord.className = 'font-bold text-emerald-900 dark:text-emerald-300 text-xl sm:text-2xl';
                mazinWord.textContent = word.mazin;
                dialectSection.appendChild(mazinWord);

                // If academic is different, show it
                if (word.mazin_academic && word.mazin_academic !== word.mazin) {
                    const acadRow = document.createElement('div');
                    acadRow.className = 'text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap';
                    
                    const label = document.createElement('span');
                    label.className = 'font-semibold text-slate-400 dark:text-slate-500';
                    label.textContent = 'Академ. запись:';
                    
                    const val = document.createElement('span');
                    val.className = 'font-bold text-slate-700 dark:text-slate-200';
                    val.textContent = word.mazin_academic;
                    
                    acadRow.appendChild(label);
                    acadRow.appendChild(val);
                    dialectSection.appendChild(acadRow);
                }

                // Translation of the dialect word if it differs from primary translation
                const primaryRuNorm = primaryRu.toLowerCase();
                const mazinRu = (word.mazin_ru || '').trim().toLowerCase();
                if (word.mazin_ru && mazinRu !== primaryRuNorm && !primaryRuNorm.includes(mazinRu) && !mazinRu.includes(primaryRuNorm)) {
                    const transRow = document.createElement('div');
                    transRow.className = 'text-sm text-slate-600 dark:text-slate-300 font-medium mt-1 flex items-center gap-1.5 flex-wrap';
                    
                    const label = document.createElement('span');
                    label.className = 'text-slate-400 dark:text-slate-500 font-normal';
                    label.textContent = 'Перевод диалекта:';
                    
                    const val = document.createElement('span');
                    val.className = 'font-semibold text-slate-700 dark:text-slate-200';
                    val.textContent = word.mazin_ru;
                    
                    transRow.appendChild(label);
                    transRow.appendChild(val);
                    dialectSection.appendChild(transRow);
                }

                body.appendChild(dialectSection);
            }

            if (word.ex) {
                const exSection = document.createElement('div');
                exSection.className = 'mt-6 pt-4 border-t border-slate-100/80';

                const exHeader = document.createElement('div');
                exHeader.className = 'text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest mb-3';
                exHeader.textContent = 'Пример / Пословица';
                exSection.appendChild(exHeader);

                const exList = document.createElement('div');
                exList.className = 'flex flex-col gap-4';

                const items = word.ex.split('//').map(s => s.trim()).filter(Boolean);
                items.forEach(itemStr => {
                    const parts = itemStr.split('|').map(s => s.trim()).filter(Boolean);
                    const lzText = parts[0] || '';
                    const ruText = parts[1] || '';

                    const isLat = typeof isLatinEnabled === 'function' && isLatinEnabled();
                    const displayLzText = isLat && typeof transliterateLezgin === 'function' ? transliterateLezgin(lzText) : lzText;

                    const card = document.createElement('div');
                    card.className = 'flex flex-col gap-1';

                    const lzEl = document.createElement('div');
                    lzEl.className = 'font-bold text-slate-800 text-lg sm:text-xl leading-snug lezgin-text';
                    lzEl.textContent = displayLzText;
                    card.appendChild(lzEl);

                    if (isLat && displayLzText !== lzText) {
                        const origSub = document.createElement('div');
                        origSub.className = 'text-xs text-slate-400 font-medium';
                        origSub.textContent = lzText;
                        card.appendChild(origSub);
                    }

                    if (ruText) {
                        const ruEl = document.createElement('div');
                        ruEl.className = 'text-base sm:text-lg text-slate-500 font-normal leading-relaxed';
                        ruEl.textContent = ruText;
                        card.appendChild(ruEl);
                    }

                    exList.appendChild(card);
                });

                exSection.appendChild(exList);
                body.appendChild(exSection);
            }

            const footer = document.createElement('div');
            footer.className = 'px-6 pb-6 mt-auto pt-3';
            const add = document.createElement('button');
            
            if (isFav) {
                add.className = 'w-full py-3.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-2xl flex items-center justify-center gap-x-2 text-sm sm:text-base border border-amber-200 transition-all active:scale-[0.98] shadow-sm cursor-pointer';
                add.innerHTML = '<i class="fa-solid fa-star text-amber-500"></i><span>В избранном</span>';
            } else {
                add.className = 'w-full py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-2xl flex items-center justify-center gap-x-2 text-sm sm:text-base border border-emerald-200/60 transition-all active:scale-[0.98] shadow-sm cursor-pointer';
                add.innerHTML = '<i class="fa-regular fa-star text-emerald-600"></i><span>В избранное</span>';
            }
            
            add.addEventListener('click', () => { 
                toggleFavorite(word.id); 
                showWordModal(word.id); 
            });

            footer.append(add);

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
                    showWordModal(word.id);
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

        function isElementVisible(element) {
            return element && !element.classList.contains('hidden');
        }

        function closeModal() {
            const modal = document.getElementById('word-modal');
            if (modal && !modal.classList.contains('hidden')) {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
                modal.classList.remove('is-fullscreen');
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
            iconWrap.className = 'w-20 h-20 bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl flex items-center justify-center mb-6 shadow-sm relative';
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
                if (tab === 'practice') {
                    const _av = document.getElementById('practice-alphabet-view');
                    const _gv = document.getElementById('practice-grammar-view');
                    const _mv = document.getElementById('practice-main-view');
                    if (_av && !_av.classList.contains('hidden')) { _av.classList.add('hidden'); if (_mv) _mv.classList.remove('hidden'); }
                    if (_gv && !_gv.classList.contains('hidden')) { _gv.classList.add('hidden'); if (_mv) _mv.classList.remove('hidden'); }
                }
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
                }
                nextScreen.classList.remove('entrance', 'fast');
                nextScreen.classList.add('active');
                if (tab === 'vocabulary') renderWords(!firstVisit);
                if (tab === 'practice') {
                    renderGrammar();
                    window.OnlinePresence?.updateUI();
                    const _av = document.getElementById('practice-alphabet-view');
                    const _gv = document.getElementById('practice-grammar-view');
                    const _mv = document.getElementById('practice-main-view');
                    if (_av && !_av.classList.contains('hidden')) { _av.classList.add('hidden'); if (_mv) _mv.classList.remove('hidden'); }
                    if (_gv && !_gv.classList.contains('hidden')) { _gv.classList.add('hidden'); if (_mv) _mv.classList.remove('hidden'); }
                }
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
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }

            const mv = document.getElementById('practice-main-view');
            const gv = document.getElementById('practice-grammar-view');
            
            if (mv) mv.classList.add('hidden');
            if (gv) gv.classList.remove('hidden');
            
            const main = document.querySelector('main');
            const resetViewScroll = () => {
                if (main) {
                    main.scrollTop = 0;
                    try { main.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) {}
                }
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
                document.documentElement.scrollTop = 0;
            };

            resetViewScroll();
            
            if (typeof window.TelegramApp?.updateBackButton === 'function') {
                window.TelegramApp.updateBackButton();
            }

            const grid = document.getElementById('grammar-units-grid');
            if (!GRAMMAR || GRAMMAR.length === 0) {
                if (grid) grid.innerHTML = '<div class="text-center py-10 text-slate-400">Загрузка юнитов грамматики...</div>';
                loadGrammar();
            } else if (!grid || grid.children.length === 0) {
                renderGrammar();
            }
            
            resetViewScroll();
            requestAnimationFrame(resetViewScroll);
            setTimeout(resetViewScroll, 20);
            setTimeout(resetViewScroll, 60);
            setTimeout(resetViewScroll, 120);
            setTimeout(resetViewScroll, 250);
        }

        function hideGrammarList() {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }

            const mv = document.getElementById('practice-main-view');
            const gv = document.getElementById('practice-grammar-view');
            
            if (gv) gv.classList.add('hidden');
            if (mv) mv.classList.remove('hidden');
            
            const main = document.querySelector('main');
            const resetViewScroll = () => {
                if (main) {
                    main.scrollTop = 0;
                    try { main.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) {}
                }
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
                document.documentElement.scrollTop = 0;
            };

            resetViewScroll();
            requestAnimationFrame(resetViewScroll);
            setTimeout(resetViewScroll, 30);
            setTimeout(resetViewScroll, 80);
            
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

        let grammarRenderedOnce = false;

        function renderGrammar(filteredList, forceRebuild = false) {
            const grid = document.getElementById('grammar-units-grid');
            const stats = document.getElementById('grammar-stats');
            if (!grid) return;

            const list = filteredList || GRAMMAR;

            if (list.length === 0) {
                grid.innerHTML = '<div class="text-center py-10 text-slate-400">Ничего не найдено. Попробуйте другой запрос.</div>';
                return;
            }

            if (stats) {
                stats.textContent = '';
            }

            // Избегаем лишнего уничтожения DOM и повторной каскадной анимации, если карточки уже отрисованы
            if (!filteredList && !forceRebuild && grid.children.length === list.length && grammarRenderedOnce) {
                return;
            }

            grid.innerHTML = '';

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

            if (!grammarRenderedOnce || filteredList) {
                staggerCards(grid);
            }
            grammarRenderedOnce = true;
        }

        function showGrammarUnit(unitId) {
            const unit = GRAMMAR.find(u => u.id === unitId);
            if (!unit) return;

            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }

            const modal = document.getElementById('word-modal');
            const content = document.getElementById('modal-content');
            content.innerHTML = '';

            const topBar = document.createElement('div');
            topBar.className = 'app-header relative flex items-center justify-center px-16 py-4 border-b border-slate-100 bg-white shrink-0 z-10 w-full text-center';
            topBar.innerHTML = `<div class="font-bold text-slate-800 text-lg text-center w-full truncate">Теория</div>
                                <button id="modal-close-btn-grammar" class="flex absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-500 rounded-full transition-colors cursor-pointer">
                                    <i class="fa-solid fa-times text-xs"></i>
                                </button>`;

            const body = document.createElement('div');
            body.className = 'px-6 py-6 overflow-y-auto flex-1 min-h-0 w-full';
            body.style.webkitOverflowScrolling = 'touch';
            body.style.overflowAnchor = 'none';

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

            const resetModalScroll = () => {
                if (body) {
                    body.scrollTop = 0;
                    try { body.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) {}
                }
                if (content) content.scrollTop = 0;
                const modalBox = modal.querySelector('.modal');
                if (modalBox) modalBox.scrollTop = 0;
                modal.scrollTop = 0;
            };

            resetModalScroll();
            requestAnimationFrame(resetModalScroll);
            setTimeout(resetModalScroll, 20);
            setTimeout(resetModalScroll, 60);
            setTimeout(resetModalScroll, 120);
            setTimeout(resetModalScroll, 250);
            setTimeout(resetModalScroll, 380);
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

            requestAnimationFrame(() => {
                content.scrollTop = 0;
            });
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
            expl.className = `mt-6 p-4 rounded-2xl text-sm leading-relaxed ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`;
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
        function getAutoTheme() {
            // 1. Telegram WebApp environment
            if (window.Telegram?.WebApp) {
                const tg = window.Telegram.WebApp;
                if (tg.colorScheme === 'dark') return 'dark';
                if (tg.colorScheme === 'light') return 'light';
                if (tg.themeParams?.bg_color) {
                    const isDark = typeof window.TelegramApp?.isDarkHex === 'function'
                        ? window.TelegramApp.isDarkHex(tg.themeParams.bg_color)
                        : (parseInt(tg.themeParams.bg_color.replace('#', ''), 16) < 0x888888);
                    return isDark ? 'dark' : 'light';
                }
            }
            // 2. Device / OS preferences
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
            return 'light';
        }

        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            if (window.Telegram?.WebApp) {
                const tg = window.Telegram.WebApp;
                try {
                    if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#059669');
                    if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(theme === 'dark' ? '#121212' : '#f8fafc');
                } catch (e) {}
            }
            updateThemeUI();
        }

        function initTheme() {
            localStorage.removeItem('lezgi_theme');
            applyTheme(getAutoTheme());

            // Listen for device / system OS theme changes in real time
            if (window.matchMedia) {
                const mql = window.matchMedia('(prefers-color-scheme: dark)');
                const onThemeChange = () => applyTheme(getAutoTheme());
                if (mql.addEventListener) {
                    mql.addEventListener('change', onThemeChange);
                } else if (mql.addListener) {
                    mql.addListener(onThemeChange);
                }
            }

            // Listen for Telegram WebApp theme changes in real time
            if (window.Telegram?.WebApp?.onEvent) {
                try {
                    window.Telegram.WebApp.onEvent('themeChanged', () => {
                        applyTheme(getAutoTheme());
                    });
                } catch (e) {}
            }

            // Sync on focus / visibility change (e.g. user flipped theme in device settings)
            window.addEventListener('focus', () => applyTheme(getAutoTheme()));
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    applyTheme(getAutoTheme());
                }
            });
        }

        function toggleTheme() {
            applyTheme(getAutoTheme());
        }

        function updateThemeUI() {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const icon = document.getElementById('theme-icon');
            const label = document.getElementById('theme-label');
            const toggle = document.getElementById('theme-toggle-switch');
            const sub = document.getElementById('theme-sub');

            if (toggle) {
                toggle.checked = isDark;
            }
            if (icon) {
                icon.className = isDark ? 'fa-solid fa-moon text-emerald-400' : 'fa-solid fa-moon text-emerald-600';
            }
            if (label) {
                label.textContent = 'Тёмная тема';
            }
            if (sub) {
                sub.textContent = isDark ? 'Включена тёмная тема' : 'Тёмное оформление интерфейса';
            }
        }

        function showCustomAlert(title, message, isError = false) {
            let el = document.getElementById('custom-app-alert');
            if (!el) {
                el = document.createElement('div');
                el.id = 'custom-app-alert';
                document.body.appendChild(el);
            }
            el.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300';
            el.innerHTML = `
                <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                    <div class="w-12 h-12 rounded-2xl ${isError ? 'bg-red-50 dark:bg-red-950/40 text-red-500' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'} flex items-center justify-center text-xl mb-3">
                        <i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
                    </div>
                    <h3 class="font-bold text-slate-800 dark:text-white text-lg mb-1">${title}</h3>
                    <p class="text-slate-600 dark:text-slate-300 text-sm mb-5 leading-relaxed break-words">${message}</p>
                    <button type="button" data-alert-close class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-bold text-sm shadow-md transition-colors cursor-pointer">
                        Понятно
                    </button>
                </div>
            `;
            el.querySelector('[data-alert-close]')?.addEventListener('click', () => {
                el.classList.add('hidden');
                el.classList.remove('flex');
            });
            el.classList.remove('hidden');
            el.classList.add('flex');
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

        // ===================== ALPHABET PRACTICE MODE =====================

        let alphabetFilterMode = 'hard'; // 'hard' | 'ortho' | 'all'
        let alphabetPracticeState = null;
        let alphabetAutoNextTimer = null;

        // Key confusable hard sound groups in Lezgin
        const HARD_LETTER_GROUPS = [
            {
                id: 't',
                name: 'Т vs ТӀ',
                letters: ['Т т', 'ТӀ тӀ'],
                badge: 'Т vs ТӀ',
                desc: 'Т — придыхательный; ТӀ — щелкающий абруптив'
            },
            {
                id: 'k',
                name: 'К vs Кь vs Къ vs КӀ',
                letters: ['К к', 'Кь кь', 'Къ къ', 'КӀ кӀ'],
                badge: 'К vs Кь vs Къ vs КӀ',
                desc: 'К — обычный; Къ — глубокий горловой; Кь — смычно-гортанный щелчок; КӀ — резкий взрывной'
            },
            {
                id: 'h',
                name: 'Х vs Хъ vs Хь',
                letters: ['Х х', 'Хъ хъ', 'Хь хь'],
                badge: 'Х vs Хъ vs Хь',
                desc: 'Х — глухой; Хъ — твердый хриплый горловой; Хь — мягкий шелестящий'
            },
            {
                id: 'ch',
                name: 'Ч vs ЧӀ',
                letters: ['Ч ч', 'ЧӀ чӀ'],
                badge: 'Ч vs ЧӀ',
                desc: 'Ч — обычный с придыханием; ЧӀ — резкий щелкающий абруптив'
            },
            {
                id: 'c',
                name: 'Ц vs ЦӀ',
                letters: ['Ц ц', 'ЦӀ цӀ'],
                badge: 'Ц vs ЦӀ',
                desc: 'Ц — придыхательный; ЦӀ — резкий щелкающий абруптив'
            },
            {
                id: 'p',
                name: 'П vs ПӀ',
                letters: ['П п', 'ПӀ пӀ'],
                badge: 'П vs ПӀ',
                desc: 'П — обычный губной; ПӀ — губной взрывной щелчок'
            },
            {
                id: 'g',
                name: 'Г vs Гъ vs Гь',
                letters: ['Г г', 'Гъ гъ', 'Гь гь'],
                badge: 'Г vs Гъ vs Гь',
                desc: 'Г — обычный звонкий; Гъ — раскатистый задненёбный; Гь — мягкий выдох'
            },
            {
                id: 'u',
                name: 'У vs Уь',
                letters: ['У у', 'Уь уь'],
                badge: 'У vs Уь',
                desc: 'У — гласный у; Уь — мягкий огубленный (немецкое ü)'
            }
        ];

        const HARD_LETTERS_SET = new Set([
            'Т т', 'ТӀ тӀ',
            'К к', 'Кь кь', 'Къ къ', 'КӀ кӀ',
            'Х х', 'Хъ хъ', 'Хь хь',
            'Ч ч', 'ЧӀ чӀ',
            'Ц ц', 'ЦӀ цӀ',
            'П п', 'ПӀ пӀ',
            'Г г', 'Гъ гъ', 'Гь гь',
            'У у', 'Уь уь'
        ]);

        const HARD_LETTER_INFO = {
            'Т т': { title: 'Т', tag: 'Придыхательный', shortTag: 'Обычный', desc: 'Обычный глухой звук Т с легким выдохом' },
            'ТӀ тӀ': { title: 'ТӀ', tag: 'Абруптивный (щелкающий)', shortTag: 'Абруптивный', desc: 'Резкий щелчок кончика языка с задержкой дыхания' },
            'К к': { title: 'К', tag: 'Придыхательный', shortTag: 'Обычный', desc: 'Обычный заднеязычный К с мягким выдохом' },
            'КӀ кӀ': { title: 'КӀ', tag: 'Абруптивный (щелкающий)', shortTag: 'Абруптивный', desc: 'Резкий гортанный взрывной щелчок' },
            'Къ къ': { title: 'Къ', tag: 'Увулярный горловой', shortTag: 'Горловой Къ', desc: 'Глубокий глухой звук у язычка в глубине зева' },
            'Кь кь': { title: 'Кь', tag: 'Смычно-гортанный', shortTag: 'Глубокий Кь', desc: 'Глухой щелкающий смычный звук глубоко в гортани' },
            'Х х': { title: 'Х', tag: 'Обычный глухой', shortTag: 'Обычный', desc: 'Стандартный глухой звук Х как в слове «хлеб»' },
            'Хъ хъ': { title: 'Хъ', tag: 'Увулярный глухой', shortTag: 'Твёрдый Хъ', desc: 'Твердый хриплый звук в глубине горла' },
            'Хь хь': { title: 'Хь', tag: 'Мягкий шелестящий', shortTag: 'Мягкий Хь', desc: 'Нежный шелестящий звук «хь», среднее между Х и Щ' },
            'Ч ч': { title: 'Ч', tag: 'Придыхательный', shortTag: 'Обычный', desc: 'Обычный мягкий звук Ч с легким придыханием' },
            'ЧӀ чӀ': { title: 'ЧӀ', tag: 'Абруптивный (щелкающий)', shortTag: 'Абруптивный', desc: 'Резкий звонкий щелкающий звук кончиком языка' },
            'Ц ц': { title: 'Ц', tag: 'Придыхательный', shortTag: 'Обычный', desc: 'Обычный звук Ц с легким выдохом' },
            'ЦӀ цӀ': { title: 'ЦӀ', tag: 'Абруптивный (щелкающий)', shortTag: 'Абруптивный', desc: 'Резкий сочный щелчок передней частью языка' },
            'П п': { title: 'П', tag: 'Придыхательный', shortTag: 'Обычный', desc: 'Обычный губной звук П с выдохом' },
            'ПӀ пӀ': { title: 'ПӀ', tag: 'Абруптивный (щелкающий)', shortTag: 'Абруптивный', desc: 'Взрыв сомкнутых губ с задержкой дыхания' },
            'Г г': { title: 'Г', tag: 'Звонкий взрывной', shortTag: 'Обычный', desc: 'Обычный звонкий звук Г' },
            'Гъ гъ': { title: 'Гъ', tag: 'Увулярный звонкий', shortTag: 'Горловой Гъ', desc: 'Раскатистый глубокий горловой звук (как французское R)' },
            'Гь гь': { title: 'Гь', tag: 'Фарингальный выдох', shortTag: 'Выдох Гь', desc: 'Легкий чистый выдох без хрипа (как английский H)' },
            'У у': { title: 'У', tag: 'Гласный', shortTag: 'Обычный', desc: 'Заднеязычный гласный У' },
            'Уь уь': { title: 'Уь', tag: 'Огубленный мягкий', shortTag: 'Мягкий Уь', desc: 'Мягкий гласный как в немецком «über»' }
        };

        const HARD_LETTER_WORDS = {
            'ТӀ тӀ': { lz: 'ТӀвар', ru: 'Имя', letter: 'ТӀ' },
            'Т т': { lz: 'Там', ru: 'Лес', letter: 'Т' },
            'КӀ кӀ': { lz: 'КӀвал', ru: 'Дом', letter: 'КӀ' },
            'Къ къ': { lz: 'Къе', ru: 'Сегодня', letter: 'Къ' },
            'Кь кь': { lz: 'Кьвед', ru: 'Два', letter: 'Кь' },
            'К к': { lz: 'Кхьин', ru: 'Писать', letter: 'К' },
            'Хъ хъ': { lz: 'Хъсан', ru: 'Хороший', letter: 'Хъ' },
            'Хь хь': { lz: 'Хьел', ru: 'Стрела', letter: 'Хь' },
            'Х х': { lz: 'Хуьр', ru: 'Село', letter: 'Х' },
            'ЧӀ чӀ': { lz: 'ЧӀал', ru: 'Язык (речь)', letter: 'ЧӀ' },
            'Ч ч': { lz: 'Чун', ru: 'Мы', letter: 'Ч' },
            'ЦӀ цӀ': { lz: 'ЦӀай', ru: 'Огонь', letter: 'ЦӀ' },
            'Ц ц': { lz: 'Цав', ru: 'Небо', letter: 'Ц' },
            'ПӀ пӀ': { lz: 'ПӀипӀ', ru: 'Угол', letter: 'ПӀ' },
            'П п': { lz: 'Пай', ru: 'Часть, доля', letter: 'П' },
            'Гъ гъ': { lz: 'Гъил', ru: 'Рука', letter: 'Гъ' },
            'Гь гь': { lz: 'Гьина', ru: 'Где', letter: 'Гь' },
            'Г г': { lz: 'Гада', ru: 'Мальчик', letter: 'Г' },
            'Уь уь': { lz: 'Уьмуьр', ru: 'Жизнь', letter: 'Уь' },
            'У у': { lz: 'Улуб', ru: 'Книга', letter: 'У' }
        };

        // Living Lezgin Orthoepy & Reading Rules
                // Living Lezgin Orthoepy & Reading Rules
        const ORTHO_RULES = [
            {
                id: 'va_to_o',
                title: '1. Лабиализованный звук [ɔ]',
                desc: 'Сочетание согласного с «ва» в корне и суффиксах образует огубленный гласный [ɔ]',
                examples: [
                    { word: 'кӀвал', trans: '[kʼɔl]', meaning: 'дом', wrong: ['[kʼval]', '[kal]'] },
                    { word: 'хва', trans: '[χɔ]', meaning: 'сын', wrong: ['[χva]', '[χa]'] },
                    { word: 'цвал', trans: '[tsʰɔl]', meaning: 'стёжка', wrong: ['[tsʰval]', '[tsʰal]'] }
                ]
            },
            {
                id: 'war_diphthong',
                title: '2. Слова на «-вар» (-war)',
                desc: 'Слово, заканчивающееся на -war, произносится как сочетание war (звук [w] / [u], не дифтонг)',
                examples: [
                    { word: 'твар', trans: '[tʰwɑr]', meaning: 'зёрнышко', wrong: ['[tʰvar]', '[tʰar]'] },
                    { word: 'тӀвар', trans: '[tʼwɑr]', meaning: 'имя', wrong: ['[tʼvar]', '[tʼar]'] },
                    { word: 'ахвар', trans: '[aˈχwɑr]', meaning: 'сон', wrong: ['[aˈχvar]', '[aˈχar]'] }
                ]
            },
            {
                id: 've_to_oe',
                title: '3. Лабиализованный звук [œ]',
                desc: 'Сочетание согласного с «ве» образует передний огубленный гласный [œ]',
                examples: [
                    { word: 'звер', trans: '[zœr]', meaning: 'кипение', wrong: ['[zver]', '[zir]'] },
                    { word: 'хъвер', trans: '[qʰœr]', meaning: 'улыбка', wrong: ['[qʰver]', '[qʰer]'] },
                    { word: 'кьвед', trans: '[qʼœd]', meaning: 'два', wrong: ['[qʼved]', '[qʼed]'] }
                ]
            },
            {
                id: 'ya_double',
                title: 'Чтение буквы «Я»',
                desc: 'В начале слова читается как [ja], а после согласных — как широкий открытый гласный [æ]',
                examples: [
                    { word: 'яр', trans: '[jar]', tip: 'В начале слова «Я» читается как [ja]', wrong: ['[ar]', '[er]'] },
                    { word: 'бязи', trans: '[bæzi]', tip: 'После согласного «Я» читается как [æ]', wrong: ['[bjazi]', '[bazi]'] },
                    { word: 'сягьят', trans: '[sæhæt]', tip: 'После согласного «Я» читается как [æ]', wrong: ['[sjahjat]', '[sahat]'] },
                    { word: 'няни', trans: '[næni]', tip: 'После согласного «Я» читается как [æ]', wrong: ['[njani]', '[nani]'] }
                ]
            },
            {
                id: 'e_double',
                title: 'Чтение буквы «Е»',
                desc: 'В начале слова читается как [je], а после согласных — как чистый гласный [e]',
                examples: [
                    { word: 'еке', trans: '[jeke]', tip: 'В начале слова «Е» читается как [je]', wrong: ['[eke]', '[uke]'] },
                    { word: 'ем', trans: '[jem]', tip: 'В начале слова «Е» читается как [je]', wrong: ['[em]', '[jum]'] },
                    { word: 'мез', trans: '[mez]', tip: 'После согласного «Е» читается как чистый гласный [e]', wrong: ['[mjez]', '[miz]'] },
                    { word: 'деве', trans: '[deve]', tip: 'После согласного «Е» читается как чистый гласный [e]', wrong: ['[djeve]', '[dive]'] }
                ]
            },
            {
                id: 'vowels_lezgi',
                title: 'Гласные звуки и буква «Уь» [y]',
                desc: 'В лезгинском языке 5 гласных фонем (/a, e, i, u, y/). Звука [o] в исконных словах нет. Буква Уь передает огубленный гласный [y]',
                examples: [
                    { word: 'уьмуьр', trans: '[ymyr]', tip: 'Буква «Уь» передаёт огубленный гласный [y]', wrong: ['[umur]', '[emir]'] },
                    { word: 'куьч', trans: '[kyt͡ʃ]', tip: 'Буква «Уь» передаёт огубленный гласный [y]', wrong: ['[kut͡ʃ]', '[kit͡ʃ]'] }
                ]
            },
            {
                id: 'nasal_n',
                title: 'Исчезающая «Н» (Носовой звук [ ̃ ])',
                desc: 'В конце слова буква «Н» назализует гласный [ ̃ ], а в родительном падеже выпадает',
                examples: [
                    { word: 'зун', trans: '[zũ]', meaning: 'я', wrong: ['[zun]', '[zen]'] },
                    { word: 'ван', trans: '[wã]', meaning: 'голос', wrong: ['[wan]', '[wen]'] },
                    { word: 'дидедин гъил', trans: '[dided ʁil]', meaning: 'рука матери', wrong: ['[didedin ʁil]', '[dide ʁil]'] }
                ]
            },
            {
                id: 'syncope',
                title: '«Съедание» безударных гласных (Синкопа)',
                desc: 'Узкие гласные (i, u, y) в безударном положении в быстрой речи выпадают',
                examples: [
                    { word: 'китаб', trans: '[ktab]', meaning: 'книга', wrong: ['[kitab]', '[katb]'] },
                    { word: 'тухун', trans: '[txun]', meaning: 'нести', wrong: ['[tuxun]', '[toxun]'] },
                    { word: 'стулдилай', trans: '[stuldaj]', meaning: 'со стула', wrong: ['[stuldilaj]', '[stullaj]'] }
                ]
            },
            {
                id: 'contraction_ay',
                title: 'Стяжение «-ай / -яй» ➔ [aː / æː]',
                desc: 'Окончание «-ай» стягивается в долгий гласный [aː], а «-яй» — в долгий широкий [æː]',
                examples: [
                    { word: 'авай', trans: '[awaː]', meaning: 'был, имелся', wrong: ['[awaj]', '[awi]'] },
                    { word: 'фенай', trans: '[fenaː]', meaning: 'ходил, пошел', wrong: ['[fenaj]', '[feni]'] },
                    { word: 'рикӀяй', trans: '[rikʼæː]', meaning: 'из сердца', wrong: ['[rikʼjaj]', '[rikʼij]'] }
                ]
            },
            {
                id: 'uvular_hq',
                title: 'Взрывной увулярный «Хъ» [qʰ]',
                desc: 'Звук Хъ произносится как глухой придыхательный увулярный взрывной [qʰ]',
                examples: [
                    { word: 'хъсан', trans: '[qʰsan]', meaning: 'хороший', wrong: ['[χsan]', '[hsan]'] },
                    { word: 'хъун', trans: '[qʰun]', meaning: 'пить', wrong: ['[χun]', '[kun]'] }
                ]
            },
            {
                id: 'uvular_stops',
                title: 'Увулярные смычные (Къ, Хъ, Кь)',
                desc: 'Глубокие звуки глотки: взрывной без выдоха Къ [q], придыхательный Хъ [qʰ], щелкающий абруптив Кь [qʼ]',
                examples: [
                    { word: 'къал', trans: '[qal]', meaning: 'шум, скандал', wrong: ['[kal]', '[kʰal]'] },
                    { word: 'хъсан', trans: '[qʰsan]', meaning: 'хороший', wrong: ['[χsan]', '[hsan]'] },
                    { word: 'кьил', trans: '[qʼil]', meaning: 'голова', wrong: ['[kil]', '[qil]'] }
                ]
            }
        ];

        function openAlphabetMenuModal() {
            const modal = document.getElementById('alphabet-menu-modal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        }

        function closeAlphabetMenuModal() {
            const modal = document.getElementById('alphabet-menu-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }

        
        // ====================================================================
        // SECTION «ЧТЕНИЕ И ЗВУКИ» (READING & PHONETICS ENGINE)
        // ====================================================================

        
        function alphaShuffleArr(arr) {
            if (!arr) return [];
            const a = [].concat(arr);
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
            }
            return a;
        }

        function alphaNormLetter(letterStr) {
            return (letterStr || '').split(' ')[0];
        }

        function playLetterAudio(letterStr) {
            const upper = alphaNormLetter(letterStr);
            const sf = (typeof normalizeLezgiSearch === 'function') ? normalizeLezgiSearch(upper) : upper.toLowerCase();
            if (typeof speakWord === 'function') {
                speakWord(null, 'audio/alphabet/' + sf + '.mp3');
            }
        }

        const READING_MODES = [
            {
                id: 'labialization',
                title: '1. Лабиализация',
                subtitle: 'Огубление [ʷо] и [ʷоь] рядом с согласными (25 заданий)',
                icon: 'fa-circle-dot',
                badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
                badgeText: 'text-emerald-600 dark:text-emerald-400',
                badgeBorder: 'border-emerald-100/80 dark:border-emerald-900/60'
            },
            {
                id: 'nasalization',
                title: '2. Назализация',
                subtitle: 'Исчезающая «Н» и носовой гласный [ᵸ] в конце слов (18 заданий)',
                icon: 'fa-wind',
                badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
                badgeText: 'text-emerald-600 dark:text-emerald-400',
                badgeBorder: 'border-emerald-100/80 dark:border-emerald-900/60'
            },
            {
                id: 'elision',
                title: '3. Стяжение (-ай / -яй)',
                subtitle: 'Стяжение окончаний -ай/-яй в долгие гласные [аа / аьаь] (16 заданий)',
                icon: 'fa-bolt',
                badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
                badgeText: 'text-emerald-600 dark:text-emerald-400',
                badgeBorder: 'border-emerald-100/80 dark:border-emerald-900/60'
            },
            {
                id: 'mixed',
                title: '4. Общая практика',
                subtitle: 'Смешанный марафон по правилам орфоэпии (59 заданий)',
                icon: 'fa-cubes',
                badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
                badgeText: 'text-emerald-600 dark:text-emerald-400',
                badgeBorder: 'border-emerald-100/80 dark:border-emerald-900/60'
            }
        ];

        function getReadingSkillStats() {
            try {
                const raw = localStorage.getItem('lezgi_reading_skills_v1');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    // Automatic migration: if old hardcoded mock stats were cached (0.92, 0.71, without totalSessions), clear them
                    if (parsed.letters === 0.92 && parsed.labialization === 0.71 && !parsed.totalSessions) {
                        localStorage.removeItem('lezgi_reading_skills_v1');
                    } else {
                        return parsed;
                    }
                }
            } catch(e) {}
            return {
                letters: 0,
                labialization: 0,
                nasalization: 0,
                elision: 0,
                words: 0,
                mixed: 0,
                totalSessions: 0,
                rules: {}
            };
        }

        function saveReadingSkillStats(stats) {
            try {
                localStorage.setItem('lezgi_reading_skills_v1', JSON.stringify(stats));
            } catch(e) {}
        }

        function recordReadingRuleAttempt(modeId, ruleId, isCorrect, timeMs) {
            const stats = getReadingSkillStats();
            let current = (stats[modeId] !== undefined) ? stats[modeId] : 0;
            if (isCorrect) {
                current += (timeMs && timeMs < 4500) ? 0.05 : 0.03;
            } else {
                current = Math.max(0, current - 0.05);
            }
            stats[modeId] = Math.max(0, Math.min(1.0, Math.round(current * 100) / 100));

            if (ruleId) {
                if (!stats.rules) stats.rules = {};
                const r = stats.rules[ruleId] || { score: 0, attempts: 0, correct: 0 };
                r.attempts++;
                if (isCorrect) r.correct++;
                r.score = r.attempts > 0 ? Math.round((r.correct / r.attempts) * 100) / 100 : 0;
                stats.rules[ruleId] = r;
            }
            saveReadingSkillStats(stats);
        }

        let currentReadingSession = null;

        function showAlphabetPracticeView(mode) {
            closeAlphabetMenuModal();
            if (typeof switchTab === 'function') switchTab('practice');
            const mainView = document.getElementById('practice-main-view');
            const grammarView = document.getElementById('practice-grammar-view');
            const alphaView = document.getElementById('practice-alphabet-view');
            if (mainView) mainView.classList.add('hidden');
            if (grammarView) grammarView.classList.add('hidden');
            if (alphaView) alphaView.classList.remove('hidden');

            if (mode) {
                startReadingModeSession(mode);
            } else {
                renderReadingPhoneticsHub();
            }
            if (typeof window.TelegramApp?.updateBackButton === 'function') {
                window.TelegramApp.updateBackButton();
            }
        }

        function hideAlphabetPracticeView() {
            if (alphabetAutoNextTimer) { clearTimeout(alphabetAutoNextTimer); alphabetAutoNextTimer = null; }
            currentReadingSession = null;
            const mainView = document.getElementById('practice-main-view');
            const alphaView = document.getElementById('practice-alphabet-view');
            if (alphaView) alphaView.classList.add('hidden');
            if (mainView) mainView.classList.remove('hidden');
            if (typeof window.TelegramApp?.updateBackButton === 'function') {
                window.TelegramApp.updateBackButton();
            }
        }

        function renderReadingPhoneticsHub() {
            if (alphabetAutoNextTimer) { clearTimeout(alphabetAutoNextTimer); alphabetAutoNextTimer = null; }
            currentReadingSession = null;
            const container = document.getElementById('alphabet-practice-exercise');
            if (!container) return;

            const headerWrap = document.getElementById('reading-phonetics-header-wrap');
            if (headerWrap) headerWrap.style.display = 'block';

            const backBtn = document.getElementById('alphabet-practice-back-btn');
            if (backBtn) backBtn.style.display = 'flex';

            const stats = getReadingSkillStats();
            const hasAnySessions = (stats.totalSessions || 0) > 0;

            const lettersScore = (stats.letters || 0);
            const labialScore = (stats.labialization || 0);
            const nasalScore = (stats.nasalization || 0);
            const elisionScore = (stats.elision || 0);
            const avgScore = hasAnySessions ? ((labialScore + nasalScore + elisionScore) / 3) : 0;

            let masteryTitle = 'Начальный уровень';
            let masteryBadge = 'Старт';
            if (hasAnySessions) {
                if (avgScore >= 0.8) {
                    masteryTitle = 'Продвинутый уровень';
                    masteryBadge = 'Отлично';
                } else if (avgScore >= 0.5) {
                    masteryTitle = 'Уверенный уровень';
                    masteryBadge = 'Хорошо';
                } else {
                    masteryTitle = 'Базовый уровень';
                    masteryBadge = 'В процессе';
                }
            }

            let html = `
                <div class="space-y-4 pb-8">

                    <!-- Уровень освоения -->
                    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-4.5 flex items-center justify-between shadow-xs">
                        <div>
                            <div class="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Уровень освоения</div>
                            <div class="text-base font-bold text-slate-800 dark:text-white">${masteryTitle}</div>
                        </div>
                        <span class="text-xs font-bold text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/40">
                            ${masteryBadge}
                        </span>
                    </div>

                    <!-- Modes Stack -->
                    <div class="space-y-3 pt-1">
                        <h3 class="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Режимы обучения</h3>
            `;

            READING_MODES.forEach(function(m) {
                html += `
                    <div data-reading-mode="${m.id}" class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 active:border-emerald-300 hover:border-emerald-200 dark:hover:border-emerald-800/60 rounded-3xl p-4 sm:p-4.5 flex items-center justify-between cursor-pointer shadow-xs hover:shadow-md active:scale-[0.99] transition-all">
                        <div class="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                            <div class="w-12 h-12 sm:w-13 sm:h-13 ${m.badgeBg} ${m.badgeText} border ${m.badgeBorder} rounded-2xl flex items-center justify-center text-xl flex-shrink-0 shadow-2xs">
                                <i class="fa-solid ${m.icon}"></i>
                            </div>
                            <div class="min-w-0 flex-1 flex items-center">
                                <h4 class="font-bold text-base text-slate-800 dark:text-white truncate">${m.title}</h4>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-slate-300 dark:text-slate-600 ml-4 flex-shrink-0 text-sm"></i>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;

            container.innerHTML = html;

            container.querySelectorAll('[data-reading-mode]').forEach(function(el) {
                el.addEventListener('click', function() {
                    const modeId = el.getAttribute('data-reading-mode');
                    if (modeId && typeof window.startReadingModeSession === 'function') {
                        window.startReadingModeSession(modeId);
                    }
                });
            });
        }

        function startReadingModeSession(modeId, ruleIdFilter) {
            const headerWrap = document.getElementById('reading-phonetics-header-wrap');
            if (headerWrap) headerWrap.style.display = 'none';

            const backBtn = document.getElementById('alphabet-practice-back-btn');
            if (backBtn) backBtn.style.display = 'none';

            // Show theory card first if mode has theory
            if (['labialization', 'nasalization', 'elision'].includes(modeId) && !ruleIdFilter) {
                renderRuleTheoryCard(modeId, function() {
                    launchReadingQuestions(modeId, ruleIdFilter);
                });
            } else {
                launchReadingQuestions(modeId, ruleIdFilter);
            }
        }

        function renderRuleTheoryCard(modeId, onStart) {
            const container = document.getElementById('alphabet-practice-exercise');
            if (!container) return;

            let title = '';
            let subtitle = '';
            let ruleBlocks = [];

            const tData = (typeof window !== 'undefined' && window.READING_DATA && window.READING_DATA.theory) 
                ? (window.READING_DATA.theory[modeId] || (modeId === 'mixed' ? null : window.READING_DATA.theory.letters)) 
                : null;

            if (tData) {
                title = tData.title;
                subtitle = tData.subtitle;
                ruleBlocks = tData.rules || [];
            } else if (modeId === 'nasalization') {
                title = '2. Назализация';
                subtitle = 'Носовое звучание гласных перед буквой «Н»';
                ruleBlocks = [
                    {
                        title: 'Носовой призвук в конце слова',
                        body: 'конечный согласный «-Н» ослабляется, а предшествующий гласный получает носовой тембр [ᵸ]: <em>зун</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[зуᵸ]</span>, <em>ван</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[ваᵸ]</span>.'
                    },
                    {
                        title: 'В заимствованных словах',
                        body: 'это же правило последовательно действует и в заимствованиях: <em>инсан</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[иᵸсаᵸ]</span>, <em>бенд</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[беᵸд]</span>.'
                    }
                ];
            } else if (modeId === 'elision') {
                title = '3. Стяжение (-ай / -яй)';
                subtitle = 'Стяжение падежных и глагольных окончаний в долгие гласные';
                ruleBlocks = [
                    {
                        title: 'Стяжение окончаний «-ай / -яй»',
                        body: 'окончания сливаются в долгие гласные: <em>авай</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[аваа]</span>, <em>фенай</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[фенаа]</span>, <em>рикӀяй</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[рикӀаьаь]</span>.'
                    }
                ];
            } else {
                title = '1. Лабиализация';
                subtitle = 'Округление губ буквой «В» и переход в [ʷо] или [ʷоь]';
                ruleBlocks = [
                    {
                        title: '1. Вариант с [ʷо]',
                        body: 'Обычно сочетание <strong>в + а</strong> произносится с округлением губ и становится близким к <strong>[ʷо]</strong>, если слово не заканчивается на <strong>р</strong>: <em>кӀвал</em> ➔ [кӀʷол], <em>свас</em> ➔ [сʷос], <em>цвал</em> ➔ [цʷол].'
                    },
                    {
                        title: 'Исключение: окончание на «р»',
                        body: 'Если слово заканчивается на <strong>р</strong>, буква <strong>а</strong> сохраняет своё обычное звучание (<strong>в + а → [ʷа]</strong>): <em>тӀвар</em> ➔ [тӀʷар], <em>ахвар</em> ➔ [ахʷар].'
                    },
                    {
                        title: '2. Вариант с [ʷоь] (Вариант с [ʷœ])',
                        body: 'Звук <strong>[оь] / [œ]</strong> — округлённый гласный, близкий к немецкому/турецкому <strong>ö</strong>. Появляется, когда после лабиализованной согласной стоит буква <strong>е</strong> (<strong>в + е → [ʷоь]</strong>): <em>кьвед</em> ➔ [кьʷоьд], <em>хъвер</em> ➔ [хъʷоьр], <em>хвеш</em> ➔ [хʷоьш].'
                    }
                ];
            }

            container.innerHTML = `
                <div class="max-w-lg mx-auto flex flex-col gap-4 pb-6">
                    <!-- Main Theory Card -->
                    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs text-left flex flex-col gap-5">
                        <!-- Header -->
                        <div class="border-b border-slate-100 dark:border-slate-800/80 pb-4">
                            <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">${title}</h2>
                            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-normal">${subtitle}</p>
                        </div>

                        <!-- Rules List -->
                        <div class="space-y-4 divide-y divide-slate-100 dark:divide-slate-800/80">
                            ${ruleBlocks.map((b, idx) => `
                                <div class="${idx > 0 ? 'pt-4' : ''}">
                                    <div class="text-[15px] sm:text-base leading-relaxed text-slate-700 dark:text-slate-300">
                                        <span class="text-emerald-600 dark:text-emerald-400 font-extrabold text-lg select-none mr-2 inline-block">—</span> <span class="font-bold text-slate-900 dark:text-white text-base sm:text-[16px] inline mr-1.5">${b.title}:</span>
                                        <span>${b.body}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Action Button at the bottom -->
                        <button type="button" id="start-theory-practice-btn" class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-extrabold text-base shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 active:scale-[0.99]">
                            <span>Начать тренировку</span>
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;

            document.getElementById('start-theory-practice-btn')?.addEventListener('click', onStart);
        }

        function launchReadingQuestions(modeId, ruleIdFilter) {
            const questions = buildReadingPhoneticsQuestions(modeId, ruleIdFilter);
            currentReadingSession = {
                modeId: modeId,
                questions: questions,
                index: 0,
                score: 0,
                total: questions.length,
                startTime: Date.now()
            };
            renderReadingQuestion();
        }

        function highlightRuleInWord(word, ruleId) {
            if (!word) return '';
            const hl = function(txt) {
                return '<span class="text-emerald-600 dark:text-emerald-400 underline decoration-2 underline-offset-4 font-black">' + txt + '</span>';
            };
            if (ruleId === 'va_to_o' || ruleId === 'war_diphthong') return word.replace(/(ва|вар)/gi, hl('$1'));
            if (ruleId === 've_to_oe') return word.replace(/(ве)/gi, hl('$1'));
            if (ruleId === 'ya_to_ae' || ruleId === 'ya_double') return word.replace(/(я)/gi, hl('$1'));
            if (ruleId === 'e_double') return word.replace(/(е)/gi, hl('$1'));
            if (ruleId === 'vowels_lezgi') return word.replace(/(уь)/gi, hl('$1'));
            if (ruleId === 'nasal_n') return word.replace(/(н\b|дин\b)/gi, hl('$1'));
            if (ruleId === 'syncope') return word.replace(/(и|у|уь)/i, hl('$1'));
            if (ruleId === 'contraction_ay') return word.replace(/(ай|яй)/gi, hl('$1'));
            if (ruleId === 'uvular_hq') return word.replace(/(хъ)/gi, hl('$1'));
            if (ruleId === 'uvular_stops') return word.replace(/(къ|хъ|кь)/gi, hl('$1'));
            return word;
        }

        function buildReadingPhoneticsQuestions(modeId, ruleIdFilter) {
            // Full comprehensive 104-question bank according to Чтение.md
            const ALL_READING_QUESTIONS = [
                {
                    id: 1,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: "Как произносится слово «цвал» (стёжка)?",
                    displayWordHtml: "цвал",
                    rawWord: "цвал",
                    meaning: "стёжка, шов",
                    trans: "[цʷол]",
                    tip: "Сочетание «в + а» в слове «цвал» произносится с округлением губ как [ʷо]: [цʷол].",
                    choices: [
                        { text: "[цʷал]", correct: false },
                        { text: "[цʷол]", correct: true },
                        { text: "[цʷел]", correct: false },
                        { text: "[цал]", correct: false }
                    ]
                },
                {
                    id: 2,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Как произносится слово «кьвед» (два)?",
                    displayWordHtml: "кьвед",
                    rawWord: "кьвед",
                    meaning: "два",
                    trans: "[кьʷоьд]",
                    tip: "Сочетание «в + е» всегда переходит в [ʷоь]: [кьʷоьд].",
                    choices: [
                        { text: "[кьʷод]", correct: false },
                        { text: "[кьвед]", correct: false },
                        { text: "[кьʷоьд]", correct: true },
                        { text: "[кьад]", correct: false }
                    ]
                },
                {
                    id: 3,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: "Как произносится слово «тӀвар» (имя)?",
                    displayWordHtml: "тӀвар",
                    rawWord: "тӀвар",
                    meaning: "имя",
                    trans: "[тӀʷар]",
                    tip: "Слово заканчивается на «р» — это исключение, поэтому буква «а» сохраняет обычное звучание: [тӀʷар].",
                    choices: [
                        { text: "[тӀʷор]", correct: false },
                        { text: "[тӀʷар]", correct: true },
                        { text: "[тӀвер]", correct: false },
                        { text: "[тӀор]", correct: false }
                    ]
                },
                {
                    id: 4,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: "Как произносится слово «свас» (невеста)?",
                    displayWordHtml: "свас",
                    rawWord: "свас",
                    meaning: "невеста",
                    trans: "[сʷос]",
                    tip: "Сочетание «в + а» не перед «р» произносится с округлением губ и звучит как [ʷо]: [сʷос].",
                    choices: [
                        { text: "[своьс]", correct: false },
                        { text: "[свас]", correct: false },
                        { text: "[сʷос]", correct: true },
                        { text: "[сес]", correct: false }
                    ]
                },
                {
                    id: 5,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Как произносится слово «хъвер» (смех)?",
                    displayWordHtml: "хъвер",
                    rawWord: "хъвер",
                    meaning: "смех",
                    trans: "[хъʷоьр]",
                    tip: "Правило «в + е → [ʷоь]» действует всегда независимо от окончания на «р»: [хъʷоьр].",
                    choices: [
                        { text: "[хъʷор]", correct: false },
                        { text: "[хъвар]", correct: false },
                        { text: "[хъвер]", correct: false },
                        { text: "[хъʷоьр]", correct: true }
                    ]
                },
                {
                    id: 6,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: "Как произносится слово «кӀвал» (дом)?",
                    displayWordHtml: "кӀвал",
                    rawWord: "кӀвал",
                    meaning: "дом",
                    trans: "[кӀʷол]",
                    tip: "Сочетание «в + а» перед согласным «л» переходит в [ʷо]: [кӀʷол].",
                    choices: [
                        { text: "[кӀал]", correct: false },
                        { text: "[кӀвел]", correct: false },
                        { text: "[кӀʷол]", correct: true },
                        { text: "[кӀвал]", correct: false }
                    ]
                },
                {
                    id: 7,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: "В какой звук переходит гласный «а» в сочетании «согласный + в + а» (свас, кӀвал)?",
                    trans: "[ʷо]",
                    tip: "Гласный «а» в сочетании с «в» огубляется и переходит в [ʷо].",
                    choices: [
                        { text: "[э]", correct: false },
                        { text: "[ʷо]", correct: true },
                        { text: "[у]", correct: false },
                        { text: "[ы]", correct: false }
                    ]
                },
                {
                    id: 8,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: "Какая буква на конце слова является исключением и сохраняет произношение [ʷа] вместо [ʷо]?",
                    trans: "[ʷа]",
                    tip: "Перед буквой «р» на конце слова звук [а] не переходит в [о], а сохраняет произношение [ʷа] (тӀвар, ахвар).",
                    choices: [
                        { text: "«л»", correct: false },
                        { text: "«н»", correct: false },
                        { text: "«р»", correct: true },
                        { text: "«с»", correct: false }
                    ]
                },
                {
                    id: 9,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: "Какую функцию выполняет показатель лабиализации ʷ (буква «в» на письме) после согласных?",
                    trans: "[ʷ]",
                    tip: "Буква «в» после согласных обозначает лабиализацию — дополнительное округление и вытягивание губ вперед.",
                    choices: [
                        { text: "Обозначает отдельный чёткий звук [в]", correct: false },
                        { text: "Обозначает лабиализацию — округление и вытягивание губ", correct: true },
                        { text: "Делает согласный тихим", correct: false }
                    ]
                },
                {
                    id: 10,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: "Почему в слове «тӀвар» гласный читается как [ʷа], а не [ʷо]?",
                    trans: "[тӀʷар]",
                    tip: "Конечная буква «р» сохраняет обычное звучание гласного «а»: в + а → [ʷа].",
                    choices: [
                        { text: "Из-за буквы «тӀ»", correct: false },
                        { text: "Из-за буквы «р» на конце слова", correct: true },
                        { text: "Это глагол", correct: false }
                    ]
                },
                {
                    id: 11,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: "С каким английским звуком сравнивают знак лабиализации / произношение буквы «в» после согласной?",
                    trans: "[w]",
                    tip: "После согласных буква «в» обозначает звук, близкий к английскому [w], обозначаемому значком ʷ.",
                    choices: [
                        { text: "[v]", correct: false },
                        { text: "[w] (в транскрипции ʷ)", correct: true },
                        { text: "[r]", correct: false }
                    ]
                },
                {
                    id: 12,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Слово «кьвед» (два) читается как [кьʷод].",
                    displayWordHtml: "кьвед",
                    rawWord: "кьвед",
                    meaning: "два",
                    trans: "[кьʷоьд]",
                    tip: "Неверно: в + е даёт [ʷоь], поэтому правильное произношение — [кьʷоьд].",
                    choices: [
                        { text: "Да", correct: false },
                        { text: "Нет (правильно: [кьʷоьд])", correct: true }
                    ]
                },
                {
                    id: 13,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: "Слово «свас» (невеста) читается как [сʷос].",
                    displayWordHtml: "свас",
                    rawWord: "свас",
                    meaning: "невеста",
                    trans: "[сʷос]",
                    tip: "Правильно! Сочетание «в + а» не перед «р» даёт [ʷо]: [сʷос].",
                    choices: [
                        { text: "Да", correct: true },
                        { text: "Нет", correct: false }
                    ]
                },
                {
                    id: 14,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: "Слово «тӀвар» (имя) читается как [тӀʷор].",
                    displayWordHtml: "тӀвар",
                    rawWord: "тӀвар",
                    meaning: "имя",
                    trans: "[тӀʷар]",
                    tip: "Неверно: слово оканчивается на «р», поэтому сохраняется [а]: [тӀʷар].",
                    choices: [
                        { text: "Да", correct: false },
                        { text: "Нет (правильно: [тӀʷар])", correct: true }
                    ]
                },
                {
                    id: 15,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Слово «хвеш» (радостный) читается как [хʷоьш].",
                    displayWordHtml: "хвеш",
                    rawWord: "хвеш",
                    meaning: "радостный",
                    trans: "[хʷоьш]",
                    tip: "Правильно! «в + е» всегда переходит в [ʷоь]: [хʷоьш].",
                    choices: [
                        { text: "Да", correct: true },
                        { text: "Нет", correct: false }
                    ]
                },
                {
                    id: 16,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Слово «гвез» (нести) читается как [гʷоз].",
                    displayWordHtml: "гвез",
                    rawWord: "гвез",
                    meaning: "нести",
                    trans: "[гʷоьз]",
                    tip: "Неверно: перед «е» звук переходит в [ʷоь], правильное произношение — [гʷоьз].",
                    choices: [
                        { text: "Да", correct: false },
                        { text: "Нет (правильно: [гʷоьз])", correct: true }
                    ]
                },
                {
                    id: 17,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Какой звук даёт сочетание «в + е» после согласного (кьвед, хъвер)?",
                    trans: "[ʷоь]",
                    tip: "Сочетание «в + е» даёт округлённый гласный [ʷоь] (как немецкое ö).",
                    choices: [
                        { text: "[ʷо]", correct: false },
                        { text: "[ʷоь] — с показателем лабиализации", correct: true },
                        { text: "[э]", correct: false }
                    ]
                },
                {
                    id: 18,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Что происходит с буквой «е» в слове «къвез» в разговорной речи?",
                    displayWordHtml: "къвез",
                    rawWord: "къвез",
                    meaning: "идти, приходить",
                    trans: "[къʷоьз]",
                    tip: "В разговорной речи сочетание «в + е» переходит в огубленный [ʷоь]: [къʷоьз].",
                    choices: [
                        { text: "Переходит в [о] — [къʷоз]", correct: false },
                        { text: "Переходит в [оь] — [къʷоьз]", correct: true },
                        { text: "Сохраняет русский [е]", correct: false }
                    ]
                },
                {
                    id: 19,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Верно ли, что наличие буквы «р» на конце слова меняет произношение «в + е» (как в слове «хъвер»)?",
                    trans: "[хъʷоьр]",
                    tip: "Правило в + е → [ʷоь] действует абсолютно всегда, независимо от окончания на «р».",
                    choices: [
                        { text: "Да", correct: false },
                        { text: "Нет. Правило в + е → [ʷоь] действует всегда и без исключений.", correct: true }
                    ]
                },
                {
                    id: 20,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Как в беглой речи звучит слово «квел» (на вас)?",
                    displayWordHtml: "квел",
                    rawWord: "квел",
                    meaning: "на вас",
                    trans: "[кʷоьл]",
                    tip: "Сочетание «в + е» даёт огубленный [ʷоь]: [кʷоьл].",
                    choices: [
                        { text: "[кʷол]", correct: false },
                        { text: "[кʷоьл]", correct: true },
                        { text: "[квал]", correct: false }
                    ]
                },
                {
                    id: 21,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: "Диктор произносит [кӀʷол]. Какое слово вы слышите?",
                    trans: "[кӀʷол]",
                    audioFile: "audio/reading/kval.mp3",
                    tip: "Произношение [кӀʷол] соответствует написанию «кӀвал» (дом).",
                    choices: [
                        { text: "кӀвал", correct: true },
                        { text: "кӀвел", correct: false },
                        { text: "кӀвар", correct: false }
                    ]
                },
                {
                    id: 22,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: "Диктор произносит [сʷос]. Какое слово написано в тексте?",
                    trans: "[сʷос]",
                    audioFile: "audio/reading/svas.mp3",
                    tip: "Произношение [сʷос] соответствует слову «свас» (невеста).",
                    choices: [
                        { text: "сос", correct: false },
                        { text: "свас", correct: true },
                        { text: "свес", correct: false }
                    ]
                },
                {
                    id: 23,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Диктор произносит [кьʷоьд]. Какое слово написано в тексте?",
                    trans: "[кьʷоьд]",
                    audioFile: "audio/reading/qved.mp3",
                    tip: "Произношение [кьʷоьд] соответствует слову «кьвед» (два).",
                    choices: [
                        { text: "кьвад", correct: false },
                        { text: "кьвед", correct: true },
                        { text: "кьвор", correct: false }
                    ]
                },
                {
                    id: 24,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: "Диктор произносит [ахʷар]. Какое слово написано в тексте?",
                    trans: "[ахʷар]",
                    audioFile: "audio/reading/ahwar.mp3",
                    tip: "Произношение [ахʷар] соответствует написанию «ахвар» (сон), окончание на «р» сохраняет «а».",
                    choices: [
                        { text: "ахор", correct: false },
                        { text: "ахвар", correct: true },
                        { text: "ахоьр", correct: false }
                    ]
                },
                {
                    id: 25,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: "Диктор произносит [хʷоьш]. Какое слово написано в тексте?",
                    trans: "[хʷоьш]",
                    tip: "Произношение [хʷоьш] соответствует слову «хвеш» (радостный).",
                    choices: [
                        { text: "хвеш", correct: true },
                        { text: "хваш", correct: false },
                        { text: "хош", correct: false }
                    ]
                },
                {
                    id: 26,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какое слово вы слышите? Выберите верное написание:",
                    trans: "[зуᵸ]",
                    audioFile: "audio/reading/zun.mp3",
                    tip: "Вы услышали местоимение «зун» (я). Конечная буква «н» назализует предшествующий гласный: [зуᵸ].",
                    choices: [
                        { text: "зун", correct: true },
                        { text: "зу", correct: false },
                        { text: "зо", correct: false }
                    ]
                },
                {
                    id: 27,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какое слово вы слышите? Выберите верное написание:",
                    trans: "[вуᵸ]",
                    audioFile: "audio/reading/vun.mp3",
                    tip: "Вы услышали местоимение «вун» (ты). Буква «в» дает [в], гласный звучит с носовым тембром: [вуᵸ].",
                    choices: [
                        { text: "вун", correct: true },
                        { text: "ву", correct: false },
                        { text: "ви", correct: false }
                    ]
                },
                {
                    id: 28,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какое слово вы слышите? Выберите верное написание:",
                    trans: "[кʰуьᵸ]",
                    audioFile: "audio/reading/kyn.mp3",
                    tip: "Вы услышали слово «куьн» (вы). Придыхательный [кʰ], а гласный «уь» звучит с носовой назализацией: [кʰуьᵸ].",
                    choices: [
                        { text: "куьн", correct: true },
                        { text: "кю", correct: false },
                        { text: "кун", correct: false }
                    ]
                },
                {
                    id: 29,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какое слово вы слышите? Выберите верное написание:",
                    trans: "[кӀаᵸ]",
                    audioFile: "audio/reading/kan.mp3",
                    tip: "Вы услышали слово «кӀан» (дно, основание). Абруптивный [кӀ] в сочетании с назализацией гласного: [кӀаᵸ].",
                    choices: [
                        { text: "кӀан", correct: true },
                        { text: "кӀа", correct: false },
                        { text: "кан", correct: false }
                    ]
                },
                {
                    id: 30,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какое слово вы слышите? Выберите верное написание:",
                    trans: "[чʰиᵸ]",
                    audioFile: "audio/reading/chin.mp3",
                    tip: "Вы услышали слово «чин» (лицо). Начальный звук «ч» придыхательный [чʰ], гласный «и» назализуется на конце слова: [чʰиᵸ].",
                    choices: [
                        { text: "чин", correct: true },
                        { text: "чи", correct: false },
                        { text: "чен", correct: false }
                    ]
                },
                {
                    id: 31,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какое слово вы слышите? Выберите верное написание:",
                    trans: "[цӀиᵸ]",
                    audioFile: "audio/reading/cin.mp3",
                    tip: "Вы услышали слово «цӀин» (нынешнего года / в этом году). Конечный «н» назализует гласный: [цӀиᵸ].",
                    choices: [
                        { text: "цӀин", correct: true },
                        { text: "цӀи", correct: false },
                        { text: "цин", correct: false }
                    ]
                },
                {
                    id: 32,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какое слово вы слышите? Выберите верное написание:",
                    trans: "[иᵸсаᵸ]",
                    audioFile: "audio/reading/insan.mp3",
                    tip: "Вы услышали слово «инсан» (человек). В заимствованных словах на конце слога «н» также даёт назализацию: [иᵸсаᵸ].",
                    choices: [
                        { text: "инсан", correct: true },
                        { text: "исан", correct: false },
                        { text: "исен", correct: false }
                    ]
                },
                {
                    id: 34,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какая транскрипция передаёт правильное звучание слова?",
                    displayWordHtml: "зун",
                    rawWord: "зун",
                    meaning: "я — местоимение",
                    trans: "[зуᵸ]",
                    tip: "Буква «н» на конце слова ослабляется, гласный произносится в нос: [зуᵸ].",
                    choices: [
                        { text: "[зуᵸ]", correct: true },
                        { text: "[зун]", correct: false },
                        { text: "[зен]", correct: false }
                    ]
                },
                {
                    id: 35,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "вун",
                    rawWord: "вун",
                    meaning: "ты — местоимение",
                    trans: "[вуᵸ]",
                    tip: "Гласный звук назализуется перед конечным сонантом: [вуᵸ].",
                    choices: [
                        { text: "[вуᵸ]", correct: true },
                        { text: "[вун]", correct: false },
                        { text: "[вин]", correct: false }
                    ]
                },
                {
                    id: 36,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "ван",
                    rawWord: "ван",
                    meaning: "голос, звук, шум",
                    trans: "[ваᵸ]",
                    audioFile: "audio/reading/van.mp3",
                    tip: "В слове «ван» конечный «н» редуцируется в назализацию гласного [а]: [ваᵸ].",
                    choices: [
                        { text: "[ваᵸ]", correct: true },
                        { text: "[ван]", correct: false },
                        { text: "[вен]", correct: false }
                    ]
                },
                {
                    id: 37,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "чин",
                    rawWord: "чин",
                    meaning: "лицо",
                    trans: "[чʰиᵸ]",
                    tip: "Конечный сонант «н» передаёт носовой гласный: [чʰиᵸ].",
                    choices: [
                        { text: "[чʰиᵸ]", correct: true },
                        { text: "[чин]", correct: false },
                        { text: "[чен]", correct: false }
                    ]
                },
                {
                    id: 38,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "кӀан",
                    rawWord: "кӀан",
                    meaning: "дно, основание",
                    trans: "[кӀаᵸ]",
                    tip: "Абруптив [кӀ] в сочетании с назализованным гласным: [кӀаᵸ].",
                    choices: [
                        { text: "[кӀаᵸ]", correct: true },
                        { text: "[кӀан]", correct: false },
                        { text: "[кан]", correct: false }
                    ]
                },
                {
                    id: 40,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "инсан",
                    rawWord: "инсан",
                    meaning: "человек",
                    trans: "[иᵸсаᵸ]",
                    tip: "В слове «инсан» назализация возникает на обоих слогах, так как «н» закрывает слоги: [иᵸсаᵸ].",
                    choices: [
                        { text: "[иᵸсаᵸ]", correct: true },
                        { text: "[инсан]", correct: false },
                        { text: "[исан]", correct: false }
                    ]
                },
                {
                    id: 41,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "залан",
                    rawWord: "залан",
                    meaning: "тяжёлый",
                    trans: "[залаᵸ]",
                    tip: "Последняя «а» уходит в нос: [залаᵸ].",
                    choices: [
                        { text: "[залаᵸ]", correct: true },
                        { text: "[залан]", correct: false },
                        { text: "[зала]", correct: false }
                    ]
                },
                {
                    id: 42,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "бенд",
                    rawWord: "бенд",
                    meaning: "куплет стиха",
                    trans: "[беᵸд]",
                    tip: "Сонант «н» перед согласным «д» часто переходит в назализацию гласного: [беᵸд].",
                    choices: [
                        { text: "[беᵸд]", correct: true },
                        { text: "[бенд]", correct: false },
                        { text: "[бад]", correct: false }
                    ]
                },
                {
                    id: 43,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "патан",
                    rawWord: "патан",
                    meaning: "чужой; стороны",
                    trans: "[пʰатаᵸ]",
                    tip: "Начальный «п» произносится с придыханием [пʰ], а конечный «н» ослабляется, гласный «а» получает носовой призвук: [пʰатаᵸ].",
                    choices: [
                        { text: "[пʰатаᵸ]", correct: true },
                        { text: "[патан]", correct: false },
                        { text: "[патин]", correct: false }
                    ]
                },
                {
                    id: 44,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "В чём фонетическое отличие слова «авай» (был) от «ава» (есть)?",
                    displayWordHtml: "авай",
                    rawWord: "авай",
                    meaning: "был, находился",
                    trans: "[аваа]",
                    tip: "Сочетание «-ай» стягивается в долгий гласный [аваа], что отличает прошедшее время от настоящего «ава» [ава].",
                    choices: [
                        { text: "В слове «авай» гласный на конце долгий: [аваа]", correct: true },
                        { text: "Они звучат абсолютно одинаково кратким звуком [ава]", correct: false },
                        { text: "В слове «авай» ударение падает на первый слог", correct: false }
                    ]
                },
                {
                    id: 45,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "фенай",
                    rawWord: "фенай",
                    meaning: "пошёл, ушёл",
                    trans: "[фенаа]",
                    tip: "При стяжении глагольного окончания «-ай» возникает фонетическая долгота: [фенаа].",
                    choices: [
                        { text: "[фенаа]", correct: true },
                        { text: "[фена]", correct: false },
                        { text: "[фени]", correct: false }
                    ]
                },
                {
                    id: 46,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "атай",
                    rawWord: "атай",
                    meaning: "пришедший",
                    trans: "[атаа]",
                    tip: "Суффикс «-ай» стягивается в долгий гласный: [атаа].",
                    choices: [
                        { text: "[атаа]", correct: true },
                        { text: "[ата]", correct: false },
                        { text: "[ати]", correct: false }
                    ]
                },
                {
                    id: 47,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "рикӀяй",
                    rawWord: "рикӀяй",
                    meaning: "из сердца — падеж элатив",
                    trans: "[рикӀаьаь]",
                    tip: "Падежное окончание «-яй» после согласного стягивается в долгий широкий гласный [рикӀаьаь].",
                    choices: [
                        { text: "[рикӀаьаь]", correct: true },
                        { text: "[рикӀйай]", correct: false },
                        { text: "[рикӀий]", correct: false }
                    ]
                },
                {
                    id: 48,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какая транскрипция верна?",
                    displayWordHtml: "виляй",
                    rawWord: "виляй",
                    meaning: "из глаза",
                    trans: "[вилаьаь]",
                    tip: "Окончание «-яй» стягивается в долгий открытый [аьаь]: [вилаьаь].",
                    choices: [
                        { text: "[вилаьаь]", correct: true },
                        { text: "[вилйай]", correct: false },
                        { text: "[вили]", correct: false }
                    ]
                },
                {
                    id: 49,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какое слово вы слышите? Выберите верное написание:",
                    trans: "[аваа]",
                    audioFile: "audio/reading/avay.mp3",
                    tip: "Вы услышали глагол «авай» (был). Окончание «-ай» стягивается в долгий гласный: [аваа].",
                    choices: [
                        { text: "авай", correct: true },
                        { text: "ава", correct: false },
                        { text: "ави", correct: false }
                    ]
                },
                {
                    id: 50,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какое слово вы слышите? Выберите верное написание:",
                    trans: "[фенаа]",
                    audioFile: "audio/reading/fenay.mp3",
                    tip: "Вы услышали глагол «фенай» (пошёл). Сочетание «-ай» стягивается в долгий [фенаа].",
                    choices: [
                        { text: "фенай", correct: true },
                        { text: "фена", correct: false },
                        { text: "фени", correct: false }
                    ]
                },
                {
                    id: 51,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какое слово вы слышите? Выберите верное написание:",
                    trans: "[рикӀаьаь]",
                    audioFile: "audio/reading/rikyay.mp3",
                    tip: "Вы услышали форму «рикӀяй» (из сердца). Падежное окончание «-яй» стягивается в долгий [рикӀаьаь].",
                    choices: [
                        { text: "рикӀяй", correct: true },
                        { text: "рикӀай", correct: false },
                        { text: "рикӀей", correct: false }
                    ]
                },
                {
                    id: 52,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какая транскрипция верна для слова «кӀваляй» (из дома)?",
                    displayWordHtml: "кӀваляй",
                    rawWord: "кӀваляй",
                    meaning: "из дома",
                    trans: "[кӀвалаьаь]",
                    tip: "Окончание «-яй» после согласного стягивается в долгий [аьаь]: [кӀвалаьаь].",
                    choices: [
                        { text: "[кӀвалаьаь]", correct: true },
                        { text: "[кӀвалйай]", correct: false },
                        { text: "[кӀвали]", correct: false }
                    ]
                },
                {
                    id: 53,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какая транскрипция верна для слова «чиляй» (из земли)?",
                    displayWordHtml: "чиляй",
                    rawWord: "чиляй",
                    meaning: "из земли",
                    trans: "[чилаьаь]",
                    tip: "Окончание «-яй» стягивается в долгий открытый [аьаь]: [чилаьаь].",
                    choices: [
                        { text: "[чилаьаь]", correct: true },
                        { text: "[чилйай]", correct: false },
                        { text: "[чили]", correct: false }
                    ]
                },
                {
                    id: 54,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какая транскрипция верна для слова «хьай» (случившийся)?",
                    displayWordHtml: "хьай",
                    rawWord: "хьай",
                    meaning: "случившийся / бывший",
                    trans: "[хьаа]",
                    tip: "Суффикс «-ай» стягивается в долгий гласный: [хьаа].",
                    choices: [
                        { text: "[хьаа]", correct: true },
                        { text: "[хьай]", correct: false },
                        { text: "[хьи]", correct: false }
                    ]
                },
                {
                    id: 55,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какая транскрипция верна для слова «хъшай» (вернувшийся)?",
                    displayWordHtml: "хъшай",
                    rawWord: "хъшай",
                    meaning: "вернувшийся",
                    trans: "[хъшаа]",
                    tip: "При стяжении суффикса «-ай» гласный становится долгим: [хъшаа].",
                    choices: [
                        { text: "[хъшаа]", correct: true },
                        { text: "[хъшай]", correct: false },
                        { text: "[хъши]", correct: false }
                    ]
                },
                {
                    id: 56,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какая транскрипция верна для слова «фидай» (уходивший)?",
                    displayWordHtml: "фидай",
                    rawWord: "фидай",
                    meaning: "уходивший",
                    trans: "[фидаа]",
                    tip: "Глагольное окончание прошедшего времени «-ай» звучит как долгий [аа]: [фидаа].",
                    choices: [
                        { text: "[фидаа]", correct: true },
                        { text: "[фидай]", correct: false },
                        { text: "[фиди]", correct: false }
                    ]
                },
                {
                    id: 57,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "Какая транскрипция верна для слова «лугьудай» (говоривший)?",
                    displayWordHtml: "лугьудай",
                    rawWord: "лугьудай",
                    meaning: "говоривший",
                    trans: "[лугьудаа]",
                    tip: "Окончание «-ай» стягивается в долгий звук [аа]: [лугьудаа].",
                    choices: [
                        { text: "[лугьудаа]", correct: true },
                        { text: "[лугьудай]", correct: false },
                        { text: "[лугьуди]", correct: false }
                    ]
                },
                {
                    id: 58,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "В какой долгий гласный звук стягивается окончание «-ай» в живой речи?",
                    trans: "[аа]",
                    tip: "Сочетание «-ай» на конце слов стягивается в долгий монофтонг [аа].",
                    choices: [
                        { text: "В долгий гласный [аа]", correct: true },
                        { text: "В краткий звук [а]", correct: false },
                        { text: "В дифтонг [ай]", correct: false }
                    ]
                },
                {
                    id: 59,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: "В какой долгий гласный звук стягивается падежное окончание «-яй»?",
                    trans: "[аьаь]",
                    tip: "Окончание элатива «-яй» после согласных стягивается в долгий широкий [аьаь].",
                    choices: [
                        { text: "В долгий широкий гласный [аьаь]", correct: true },
                        { text: "В обычный звук [йа]", correct: false },
                        { text: "В краткий звук [э]", correct: false }
                    ]
                }
];

            const sourceQuestions = (typeof window !== 'undefined' && window.READING_DATA && Array.isArray(window.READING_DATA.questions))
                ? window.READING_DATA.questions
                : ALL_READING_QUESTIONS;

            const availableQuestions = sourceQuestions.slice();

            let pool = [];
            if (modeId === 'mixed') {
                pool = availableQuestions.slice();
            } else if (modeId) {
                pool = availableQuestions.filter(q => q.modeId === modeId);
                if (ruleIdFilter) {
                    pool = pool.filter(q => q.ruleId === ruleIdFilter);
                }
            } else {
                pool = availableQuestions.slice();
            }

            if (pool.length === 0) pool = availableQuestions.slice();

            // Distribute audio questions evenly throughout the session rather than clustering at the end
            function distributeAudioQuestions(arr) {
                const audio = alphaShuffleArr(arr.filter(q => q.audioFile || q.listenAudio));
                const text = alphaShuffleArr(arr.filter(q => !q.audioFile && !q.listenAudio));
                if (audio.length === 0) return text;
                if (text.length === 0) return audio;

                const numBuckets = audio.length;
                const bucketSize = Math.floor(text.length / numBuckets);
                const result = [];
                let textIdx = 0;

                for (let b = 0; b < numBuckets; b++) {
                    const currentBucketSize = bucketSize + (b < (text.length % numBuckets) ? 1 : 0);
                    const bucket = text.slice(textIdx, textIdx + currentBucketSize);
                    textIdx += currentBucketSize;

                    const insertOffset = Math.max(1, Math.min(bucket.length, Math.floor(Math.random() * bucket.length) + 1));
                    bucket.splice(insertOffset, 0, audio[b]);
                    result.push(...bucket);
                }
                return result;
            }

            const shuffled = distributeAudioQuestions(pool);
            // Workout session length: select all questions in the mode (e.g. 25 for labialization, 18 for nasalization)
            const count = (shuffled.length > 15) ? shuffled.length : shuffled.length;
            return shuffled.slice(0, count).map(q => ({
                id: q.id,
                modeId: q.modeId,
                ruleId: q.ruleId,
                questionText: q.questionText,
                displayWordHtml: q.displayWordHtml || '',
                rawWord: q.rawWord || '',
                meaning: q.meaning || '',
                trans: q.trans,
                audioFile: q.audioFile || null,
                listenAudio: q.listenAudio || null,
                tip: q.tip,
                choices: alphaShuffleArr(q.choices)
            }));
        }

        function renderReadingQuestion() {
            const container = document.getElementById('alphabet-practice-exercise');
            if (!container) return;
            const sess = currentReadingSession;
            if (!sess) return;

            const headerWrap = document.getElementById('reading-phonetics-header-wrap');
            if (headerWrap) headerWrap.style.display = 'none';

            const backBtn = document.getElementById('alphabet-practice-back-btn');
            if (backBtn) backBtn.style.display = 'none';

            if (sess.index >= sess.total) {
                renderReadingResults();
                return;
            }

            const q = sess.questions[sess.index];
            const qStartTime = Date.now();
            const pct = Math.round(((sess.index) / sess.total) * 100);

            let html = `
                <div class="max-w-lg mx-auto flex flex-col min-h-[calc(100dvh-12rem)] sm:min-h-[580px] justify-between gap-3">
                    <!-- Progress Bar -->
                    <div class="flex items-center gap-3">
                        <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div class="h-full bg-emerald-500 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                        </div>
                        <span class="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">${sess.index + 1}/${sess.total}</span>
                    </div>

                    <!-- Question Card -->
                    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs text-center flex flex-col flex-1 justify-between gap-4">
                        <!-- Question Text -->
                        <div>
                            <h3 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-snug tracking-tight">${q.questionText}</h3>
                        </div>

                        <!-- Center Display: Sound or Word (No meaning, No TTS button) -->
                        <div class="my-auto py-2">
                            ${q.audioFile ? `
                                <div class="flex flex-col items-center justify-center py-2 sm:py-3">
                                    <button type="button" id="reading-replay-sound-btn" class="w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px] aspect-square flex-shrink-0 rounded-full bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-2xl shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer group" style="width: 64px; height: 64px; min-width: 64px; min-height: 64px; max-width: 64px; max-height: 64px; border-radius: 9999px; aspect-ratio: 1 / 1;" title="Повторить звук">
                                        <i class="fa-solid fa-volume-high transition-transform group-hover:scale-110"></i>
                                    </button>
                                    <span class="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium inline-flex items-center gap-1.5">
                                        <i class="fa-solid fa-rotate-right text-[10px] text-emerald-500"></i>
                                        Нажмите, чтобы повторить
                                    </span>
                                </div>
                            ` : (q.displayWordHtml ? `
                                <div class="py-5 px-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl ${q.listenAudio ? 'cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-slate-800/90 transition-colors' : ''}" ${q.listenAudio ? 'id="reading-word-listen-btn" title="Нажмите, чтобы послушать"' : ''}>
                                    <div class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-wide flex items-center justify-center gap-2.5">
                                        <span>${q.displayWordHtml}</span>
                                        ${q.listenAudio ? `<i class="fa-solid fa-volume-high text-lg text-emerald-500 hover:scale-110 transition-transform"></i>` : ''}
                                    </div>
                                    ${q.listenAudio ? `<span class="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium inline-block">Нажмите для прослушивания</span>` : ''}
                                </div>
                            ` : '')}
                        </div>

                        <!-- Choices Stack: Evenly Distributed -->
                        <div id="reading-choices-stack" class="flex-1 flex flex-col justify-around gap-2.5 sm:gap-3 py-1">
                            ${q.choices.map(function(choice, idx) {
                                return `
                                    <button type="button" data-choice-idx="${idx}" class="reading-choice-btn w-full p-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 rounded-2xl font-bold text-base sm:text-lg text-slate-800 dark:text-slate-100 shadow-xs active:scale-[0.99] transition-all text-left flex items-center justify-between gap-3 cursor-pointer flex-1">
                                        <span class="leading-snug">${choice.text}</span>
                                        <div class="choice-indicator w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs flex-shrink-0"></div>
                                    </button>
                                ` ;
                            }).join('')}
                        </div>

                        <!-- Feedback Banner Area -->
                        <div id="reading-feedback-banner" class="hidden text-left space-y-3 pt-2"></div>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Automatically pronounce sound if question has audio
            if (q.audioFile && typeof speakWord === 'function') {
                setTimeout(function() {
                    speakWord(null, q.audioFile);
                }, 200);
            }

            container.querySelector('#reading-replay-sound-btn')?.addEventListener('click', function() {
                const btn = this;
                btn.classList.add('scale-95', 'ring-4', 'ring-emerald-400/30');
                setTimeout(function() {
                    btn.classList.remove('scale-95', 'ring-4', 'ring-emerald-400/30');
                }, 200);
                if (q.audioFile && typeof speakWord === 'function') {
                    speakWord(null, q.audioFile);
                }
            });

            if (q.listenAudio) {
                container.querySelector('#reading-word-listen-btn')?.addEventListener('click', function() {
                    if (typeof speakWord === 'function') {
                        speakWord(null, q.listenAudio);
                    }
                });
            }

            // Bind click handlers to choices
            container.querySelectorAll('.reading-choice-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const idx = parseInt(btn.dataset.choiceIdx, 10);
                    handleReadingChoice(q, idx, qStartTime);
                });
            });
        }

        function handleReadingChoice(q, chosenIdx, qStartTime) {
            const sess = currentReadingSession;
            if (!sess) return;

            const timeMs = Date.now() - qStartTime;
            const chosen = q.choices[chosenIdx];
            const isCorrect = chosen ? chosen.correct : false;

            if (isCorrect) sess.score++;
            recordReadingRuleAttempt(q.modeId, q.ruleId, isCorrect, timeMs);

            const container = document.getElementById('alphabet-practice-exercise');
            const btns = container.querySelectorAll('.reading-choice-btn');
            btns.forEach(function(btn) {
                btn.disabled = true;
                btn.style.cursor = 'default';
            });

            // Highlight chosen & correct
            btns.forEach(function(btn) {
                const bIdx = parseInt(btn.dataset.choiceIdx, 10);
                const isThis = (bIdx === chosenIdx);
                const opt = q.choices[bIdx];
                const indicator = btn.querySelector('.choice-indicator');

                if (isThis) {
                    if (isCorrect) {
                        btn.className = btn.className.replace(/border-slate-[0-9]+/g, '') + ' border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100';
                        if (indicator) {
                            indicator.className = 'choice-indicator is-correct text-white';
                            indicator.innerHTML = '<i class="fa-solid fa-check text-xs"></i>';
                        }
                    } else {
                        btn.className = btn.className.replace(/border-slate-[0-9]+/g, '') + ' border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100';
                        if (indicator) {
                            indicator.className = 'choice-indicator is-wrong text-white';
                            indicator.innerHTML = '<i class="fa-solid fa-xmark text-xs"></i>';
                        }
                    }
                } else if (opt && opt.correct) {
                    btn.className = btn.className.replace(/border-slate-[0-9]+/g, '') + ' border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/30';
                    if (indicator) {
                        indicator.className = 'choice-indicator is-correct text-white';
                        indicator.innerHTML = '<i class="fa-solid fa-check text-xs"></i>';
                    }
                }
            });

            const feedback = document.getElementById('reading-feedback-banner');
            if (feedback) {
                feedback.classList.remove('hidden');
                const targetAudio = q.listenAudio || q.audioFile;
                feedback.innerHTML = `
                    <div class="${isCorrect ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-950 dark:text-emerald-200' : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-950 dark:text-rose-200'} p-4 rounded-2xl border space-y-1 shadow-xs">
                        <div class="font-extrabold text-sm flex items-center gap-2">
                            <i class="fa-solid ${isCorrect ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-rose-600'} text-lg"></i>
                            <span>${isCorrect ? 'Верно!' : 'Не совсем так, обратите внимание'}</span>
                        </div>
                        ${!isCorrect && q.tip ? `<div class="text-xs opacity-90 leading-relaxed font-medium">${q.tip}</div>` : ''}
                        ${targetAudio ? `
                            <button type="button" id="reading-feedback-audio-btn" class="mt-2 inline-flex items-center gap-2 py-1.5 px-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all cursor-pointer shadow-2xs">
                                <i class="fa-solid fa-volume-high text-emerald-500"></i>
                                <span>Послушать произношение</span>
                            </button>
                        ` : ''}
                    </div>

                    <button type="button" id="next-reading-question-btn" class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-black text-base shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2">
                        <span>${sess.index + 1 < sess.total ? 'Следующий пример' : 'Посмотреть результаты'}</span>
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                `;

                if (targetAudio) {
                    feedback.querySelector('#reading-feedback-audio-btn')?.addEventListener('click', function() {
                        if (typeof speakWord === 'function') {
                            speakWord(null, targetAudio);
                        }
                    });
                }

                document.getElementById('next-reading-question-btn')?.addEventListener('click', function() {
                    sess.index++;
                    renderReadingQuestion();
                });
            }
        }

        function renderReadingResults() {
            const container = document.getElementById('alphabet-practice-exercise');
            if (!container) return;
            const sess = currentReadingSession;
            if (!sess) return;

            const headerWrap = document.getElementById('reading-phonetics-header-wrap');
            if (headerWrap) headerWrap.style.display = 'none';

            const backBtn = document.getElementById('alphabet-practice-back-btn');
            if (backBtn) backBtn.style.display = 'none';

            const pct = Math.round((sess.score / sess.total) * 100);

            // Record completed session in real stats
            if (sess.total > 0 && !sess._recorded) {
                sess._recorded = true;
                const sessionPct = sess.score / sess.total;
                const stats = getReadingSkillStats();
                stats.totalSessions = (stats.totalSessions || 0) + 1;
                if (!stats.sessions) stats.sessions = {};
                stats.sessions[sess.modeId] = (stats.sessions[sess.modeId] || 0) + 1;

                const prevScore = (stats[sess.modeId] !== undefined) ? stats[sess.modeId] : 0;
                if (stats.sessions[sess.modeId] <= 1) {
                    stats[sess.modeId] = Math.round(sessionPct * 100) / 100;
                } else {
                    stats[sess.modeId] = Math.round((prevScore * 0.4 + sessionPct * 0.6) * 100) / 100;
                }
                saveReadingSkillStats(stats);
            }

            container.innerHTML = `
                <div class="max-w-lg mx-auto space-y-4">
                    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-7 text-center space-y-4 shadow-xs">
                        <div class="w-20 h-20 ${pct >= 80 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50' : pct >= 50 ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/50' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50'} rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-xs">
                            <i class="fa-solid ${pct >= 80 ? 'fa-trophy' : pct >= 50 ? 'fa-star' : 'fa-arrow-rotate-right'}"></i>
                        </div>

                        <div>
                            <h2 class="text-2xl font-black text-slate-900 dark:text-white">Сессия завершена!</h2>
                            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Вы ответили правильно на ${sess.score} из ${sess.total} (${pct}%)</p>
                        </div>

                        <!-- Stats Overview Card -->
                        <div class="p-4 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-2.5 text-left text-xs sm:text-sm">
                            <div class="flex justify-between items-center text-slate-700 dark:text-slate-300">
                                <span class="flex items-center gap-2"><i class="fa-solid fa-check-circle text-emerald-600 text-xs"></i> Правильных ответов:</span>
                                <span class="font-bold text-slate-900 dark:text-white">${sess.score} / ${sess.total}</span>
                            </div>
                            <div class="flex justify-between items-center text-slate-700 dark:text-slate-300">
                                <span class="flex items-center gap-2"><i class="fa-solid fa-bullseye text-sky-600 text-xs"></i> Точность чтения:</span>
                                <span class="font-bold text-emerald-600 dark:text-emerald-400">${pct}%</span>
                            </div>
                            <div class="flex justify-between items-center text-slate-700 dark:text-slate-300">
                                <span class="flex items-center gap-2"><i class="fa-solid fa-chart-line text-violet-600 text-xs"></i> Оценка навыка:</span>
                                <span class="font-bold text-slate-800 dark:text-white">${pct >= 80 ? 'Отлично' : pct >= 50 ? 'Хорошо' : 'Требуется повторение'}</span>
                            </div>
                        </div>

                        <div class="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100/60 dark:border-emerald-900/30 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-left">
                            ${pct >= 80 ? 'Отличная работа! Ваш навык автоматического чтения и распознавания правил закрепился.' : 'Хорошая тренировка! Регулярное повторение поможет довести распознавание этих букв и звуков до автоматизма.'}
                        </div>

                        <div class="flex flex-col gap-3 pt-1" style="display: flex; flex-direction: column; gap: 12px;">
                            <button type="button" id="reading-summary-retry-btn" class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-black text-base shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 flex-shrink-0" style="flex-shrink: 0;">
                                <i class="fa-solid fa-arrow-rotate-right"></i>
                                <span>Повторить тренировку</span>
                            </button>
                            <button type="button" id="reading-summary-hub-btn" class="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-2xl font-bold text-base active:scale-[0.99] transition-all cursor-pointer flex-shrink-0" style="flex-shrink: 0;">
                                <span>Вернуться в меню правил</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            container.querySelector('#reading-summary-hub-btn')?.addEventListener('click', function() {
                if (typeof window.renderReadingPhoneticsHub === 'function') {
                    window.renderReadingPhoneticsHub();
                }
            });
            container.querySelector('#reading-summary-hub-btn')?.addEventListener('click', function() {
                if (typeof window.renderReadingPhoneticsHub === 'function') {
                    window.renderReadingPhoneticsHub();
                }
            });
            container.querySelector('#reading-summary-retry-btn')?.addEventListener('click', function() {
                if (typeof window.startReadingModeSession === 'function') {
                    window.startReadingModeSession(sess.modeId);
                }
            });
        }


        function renderAlphabetQuestion() {
            renderReadingQuestion();
        }

        // Beautiful Choice Button generator for Contrast & Letter choices (Clean pure letter cards)
        function createElevatedChoiceButton(letterStr, isContrastGroup) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'alpha-choice-card group flex flex-col items-center justify-center cursor-pointer outline-none select-none';
            btn.style.minHeight = '100px';
            btn.style.padding = '22px 14px';

            const bigLetter = document.createElement('div');
            bigLetter.className = 'text-4xl font-black text-slate-800 leading-none transition-transform group-hover:scale-105';
            bigLetter.textContent = alphaNormLetter(letterStr);

            btn.appendChild(bigLetter);
            return btn;
        }

        // TYPE: Contrast listening (e.g. T vs T1, or K vs Kb vs Kq vs K1)
        function renderListenContrastQuestion(container, q) {
            const item = q.item;
            const group = q.group;
            const choices = q.choices || group.letters;

            const card = document.createElement('div');
            card.className = 'bg-white rounded-3xl p-6 shadow-sm border border-slate-100/80';
            card.style.boxShadow = '0 10px 30px -5px rgba(0, 0, 0, 0.04)';

            const label = document.createElement('div');
            label.className = 'text-lg font-black text-slate-800 text-center mb-6 tracking-tight';
            label.textContent = 'Какой звук ты слышишь?';

            // Beautiful Audio Sphere with Halo Ring
            const playArea = document.createElement('div');
            playArea.className = 'flex flex-col items-center mb-6';

            const haloWrap = document.createElement('div');
            haloWrap.className = 'p-2 rounded-full inline-flex items-center justify-center transition-transform active:scale-95';
            haloWrap.style.background = 'rgba(16, 185, 129, 0.08)';

            const playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'w-22 h-22 rounded-full flex items-center justify-center text-3xl shadow-xl transition-all cursor-pointer outline-none border-0';
            playBtn.style.width = '88px';
            playBtn.style.height = '88px';
            playBtn.style.borderRadius = '50%';
            playBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
            playBtn.style.color = '#ffffff';
            playBtn.style.boxShadow = '0 12px 28px -4px rgba(16, 185, 129, 0.45)';
            playBtn.style.border = '4px solid #ecfdf5';
            playBtn.style.outline = 'none';
            playBtn.setAttribute('title', 'Прослушать звук');
            playBtn.innerHTML = '<i class="fa-solid fa-volume-high text-white text-3xl drop-shadow"></i>';

            playBtn.addEventListener('click', function() {
                playBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-white text-2xl"></i>';
                setTimeout(function() { playBtn.innerHTML = '<i class="fa-solid fa-volume-high text-white text-3xl drop-shadow"></i>'; }, 800);
                playLetterAudio(item.letter);
            });

            haloWrap.appendChild(playBtn);

            const hint = document.createElement('p');
            hint.className = 'text-xs font-semibold text-slate-400 mt-3 inline-flex items-center gap-1.5';
            hint.innerHTML = '<i class="fa-solid fa-rotate-right text-emerald-500 text-[10px]"></i> Нажми, чтобы повторить';

            playArea.append(haloWrap, hint);
            card.append(label, playArea);
            container.appendChild(card);

            setTimeout(function() { playLetterAudio(item.letter); }, 350);

            // Contrast choices buttons
            const choicesGrid = document.createElement('div');
            const cols = choices.length <= 2 ? 2 : (choices.length === 3 ? 3 : 2);
            choicesGrid.className = 'grid gap-3 mt-3';
            choicesGrid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';

            choices.forEach(function(letterStr) {
                const btn = createElevatedChoiceButton(letterStr, true);

                btn.addEventListener('click', function() {
                    if (alphabetPracticeState.answered) return;
                    const isCorrect = letterStr === item.letter;
                    handleContrastAnswer(isCorrect, btn, choicesGrid, item.letter, group, container);
                });

                choicesGrid.appendChild(btn);
            });

            container.appendChild(choicesGrid);
        }

        // TYPE: Word context (sound in a real Lezgin word)
        function renderWordContextQuestion(container, q) {
            const item = q.item;
            const group = q.group;
            const wordInfo = q.wordInfo || HARD_LETTER_WORDS[item.letter] || { lz: 'ТӀвар', ru: 'Имя', letter: 'ТӀ' };
            const choices = q.choices || (group ? group.letters : ['Т т', 'ТӀ тӀ']);

            const card = document.createElement('div');
            card.className = 'bg-white rounded-3xl p-6 shadow-sm border border-slate-100/80';
            card.style.boxShadow = '0 10px 30px -5px rgba(0, 0, 0, 0.04)';

            const qTitle = document.createElement('div');
            qTitle.className = 'text-lg font-black text-slate-800 text-center mb-4 tracking-tight';
            qTitle.textContent = 'Какая буква звучит в этом слове?';

            // Word display box
            const wordBox = document.createElement('div');
            wordBox.className = 'bg-gradient-to-b from-slate-50 to-slate-100/60 border border-slate-200/70 rounded-3xl p-5 my-2 flex items-center justify-between shadow-inner';

            const wordTextWrap = document.createElement('div');
            wordTextWrap.className = 'text-left flex-1 pr-3';

            const lzWord = document.createElement('div');
            lzWord.className = 'text-3xl font-black text-slate-900 tracking-wide';

            const normTarget = alphaNormLetter(item.letter);
            const rawLz = wordInfo.lz;
            const normLz = (typeof normalizeLezgiSearch === 'function') ? normalizeLezgiSearch(rawLz) : rawLz.toLowerCase();
            const normT = (typeof normalizeLezgiSearch === 'function') ? normalizeLezgiSearch(normTarget) : normTarget.toLowerCase();

            if (normLz.startsWith(normT)) {
                const prefix = rawLz.slice(0, normTarget.length);
                const rest = rawLz.slice(normTarget.length);
                lzWord.innerHTML = '<span class="text-emerald-700 underline decoration-emerald-500 decoration-3">' + prefix + '</span>' + rest;
            } else {
                lzWord.textContent = rawLz;
            }

            const ruWord = document.createElement('div');
            ruWord.className = 'text-xs font-bold text-slate-500 mt-1';
            ruWord.textContent = wordInfo.ru ? '«' + wordInfo.ru + '»' : '';

            wordTextWrap.append(lzWord, ruWord);

            const playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-lg active:scale-95 transition-transform flex-shrink-0 cursor-pointer outline-none border-0';
            playBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
            playBtn.style.color = '#ffffff';
            playBtn.style.boxShadow = '0 8px 20px -2px rgba(16, 185, 129, 0.4)';
            playBtn.style.border = '3px solid #ecfdf5';
            playBtn.style.outline = 'none';
            playBtn.setAttribute('title', 'Прослушать звук');
            playBtn.innerHTML = '<i class="fa-solid fa-volume-high text-white text-xl"></i>';

            playBtn.addEventListener('click', function() {
                playBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-white text-xl"></i>';
                setTimeout(function() {
                    playBtn.innerHTML = '<i class="fa-solid fa-volume-high text-white text-xl"></i>';
                }, 700);
                playLetterAudio(item.letter);
            });

            wordBox.append(wordTextWrap, playBtn);
            card.append(qTitle, wordBox);
            container.appendChild(card);

            setTimeout(function() { playLetterAudio(item.letter); }, 350);

            // Choices
            const choicesGrid = document.createElement('div');
            const cols = choices.length <= 2 ? 2 : (choices.length === 3 ? 3 : 2);
            choicesGrid.className = 'grid gap-3 mt-3';
            choicesGrid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';

            choices.forEach(function(letterStr) {
                const btn = createElevatedChoiceButton(letterStr, true);

                btn.addEventListener('click', function() {
                    if (alphabetPracticeState.answered) return;
                    const isCorrect = letterStr === item.letter;
                    handleContrastAnswer(isCorrect, btn, choicesGrid, item.letter, group, container);
                });

                choicesGrid.appendChild(btn);
            });

            container.appendChild(choicesGrid);
        }

        // ORTHO: «Как это слово произносится в живой речи?»
        function renderOrthoReadQuestion(container, q) {
            const item = q.item;
            const rule = q.rule;
            const choices = q.choices;

            const card = document.createElement('div');
            card.className = 'bg-white rounded-3xl p-6 shadow-sm border border-slate-100/80';
            card.style.boxShadow = '0 10px 30px -5px rgba(0, 0, 0, 0.04)';

            const qTitle = document.createElement('div');
            qTitle.className = 'text-lg font-black text-slate-800 text-center mb-4 tracking-tight';
            qTitle.textContent = 'Как это слово звучит в живой речи?';

            const wordBox = document.createElement('div');
            wordBox.className = 'bg-gradient-to-b from-slate-50 to-slate-100/60 border border-slate-200/70 rounded-3xl p-6 my-2 text-center shadow-inner';

            const lzWord = document.createElement('div');
            lzWord.className = 'text-4xl font-black text-slate-900 tracking-wide mb-1.5';
            lzWord.textContent = item.word;

            const ruWord = document.createElement('div');
            ruWord.className = 'text-xs font-bold text-slate-500';
            ruWord.textContent = '«' + item.meaning + '»';

            wordBox.append(lzWord, ruWord);
            card.append(qTitle, wordBox);
            container.appendChild(card);

            const choicesGrid = document.createElement('div');
            choicesGrid.className = 'grid gap-2.5 mt-3';

            choices.forEach(function(choiceStr) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'group py-4 px-5 rounded-2xl bg-white flex items-center justify-between transition-all shadow-sm cursor-pointer outline-none select-none';
                btn.style.border = '2px solid #e2e8f0';
                btn.style.outline = 'none';

                const transText = document.createElement('div');
                transText.className = 'text-2xl font-bold font-mono text-slate-800 tracking-wide transition-transform group-hover:scale-105';
                transText.textContent = choiceStr;

                const icon = document.createElement('div');
                icon.className = 'w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors';
                icon.innerHTML = '<i class="fa-solid fa-chevron-right text-[10px]"></i>';

                btn.append(transText, icon);

                btn.addEventListener('mouseenter', function() {
                    if (!alphabetPracticeState.answered) {
                        btn.style.borderColor = '#10b981';
                        btn.style.backgroundColor = '#f0fdf4';
                    }
                });
                btn.addEventListener('mouseleave', function() {
                    if (!alphabetPracticeState.answered) {
                        btn.style.borderColor = '#e2e8f0';
                        btn.style.backgroundColor = '#ffffff';
                    }
                });

                btn.addEventListener('click', function() {
                    if (alphabetPracticeState.answered) return;
                    const isCorrect = choiceStr === item.trans;
                    handleOrthoAnswer(isCorrect, btn, choicesGrid, item.trans, rule, item, container);
                });

                choicesGrid.appendChild(btn);
            });

            container.appendChild(choicesGrid);
        }

        // ORTHO: «Какое слово так пишется по правилам?»
        function renderOrthoSpellQuestion(container, q) {
            const item = q.item;
            const rule = q.rule;
            const choices = q.choices;

            const card = document.createElement('div');
            card.className = 'bg-white rounded-3xl p-6 shadow-sm border border-slate-100/80';
            card.style.boxShadow = '0 10px 30px -5px rgba(0, 0, 0, 0.04)';

            const qTitle = document.createElement('div');
            qTitle.className = 'text-lg font-black text-slate-800 text-center mb-4 tracking-tight';
            qTitle.textContent = 'Как пишется слово с таким звучанием?';

            const wordBox = document.createElement('div');
            wordBox.className = 'bg-gradient-to-b from-slate-50 to-slate-100/60 border border-slate-200/70 rounded-3xl p-6 my-2 text-center shadow-inner';

            const transLabel = document.createElement('div');
            transLabel.className = 'text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1';
            transLabel.textContent = 'Живое произношение:';

            const transWord = document.createElement('div');
            transWord.className = 'text-4xl font-black font-mono text-emerald-800 tracking-wide mb-1.5';
            transWord.textContent = item.trans;

            const ruWord = document.createElement('div');
            ruWord.className = 'text-xs font-bold text-slate-500';
            ruWord.textContent = '«' + item.meaning + '»';

            wordBox.append(transLabel, transWord, ruWord);
            card.append(qTitle, wordBox);
            container.appendChild(card);

            const choicesGrid = document.createElement('div');
            choicesGrid.className = 'grid gap-2.5 mt-3';

            choices.forEach(function(choiceWord) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'group py-4 px-5 rounded-2xl bg-white flex items-center justify-between transition-all shadow-sm cursor-pointer outline-none select-none';
                btn.style.border = '2px solid #e2e8f0';
                btn.style.outline = 'none';

                const wordText = document.createElement('div');
                wordText.className = 'text-2xl font-black text-slate-800 tracking-wide transition-transform group-hover:scale-105';
                wordText.textContent = choiceWord;

                const icon = document.createElement('div');
                icon.className = 'w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors';
                icon.innerHTML = '<i class="fa-solid fa-chevron-right text-[10px]"></i>';

                btn.append(wordText, icon);

                btn.addEventListener('mouseenter', function() {
                    if (!alphabetPracticeState.answered) {
                        btn.style.borderColor = '#10b981';
                        btn.style.backgroundColor = '#f0fdf4';
                    }
                });
                btn.addEventListener('mouseleave', function() {
                    if (!alphabetPracticeState.answered) {
                        btn.style.borderColor = '#e2e8f0';
                        btn.style.backgroundColor = '#ffffff';
                    }
                });

                btn.addEventListener('click', function() {
                    if (alphabetPracticeState.answered) return;
                    const isCorrect = choiceWord === item.word;
                    handleOrthoAnswer(isCorrect, btn, choicesGrid, item.word, rule, item, container);
                });

                choicesGrid.appendChild(btn);
            });

            container.appendChild(choicesGrid);
        }

        // Handle Ortho answer + show rich rule explanation box
        function handleOrthoAnswer(isCorrect, clickedBtn, choicesGrid, correctVal, rule, item, container) {
            alphabetPracticeState.answered = true;
            if (isCorrect) {
                alphabetPracticeState.score++;
                clickedBtn.style.borderColor = '#4ade80';
                clickedBtn.style.background = '#f0fdf4';
                clickedBtn.style.color = '#15803d';
            } else {
                clickedBtn.style.borderColor = '#f87171';
                clickedBtn.style.background = '#fff1f2';
                clickedBtn.style.color = '#e11d48';
                choicesGrid.querySelectorAll('button').forEach(function(b) {
                    const firstDiv = b.querySelector('div');
                    const txt = (firstDiv ? firstDiv.textContent : b.textContent).trim();
                    if (txt === correctVal) {
                        b.style.borderColor = '#4ade80';
                        b.style.background = '#f0fdf4';
                        b.style.color = '#15803d';
                    }
                });
            }

            choicesGrid.querySelectorAll('button').forEach(function(b) { b.disabled = true; });

            // Rich Rule Explanation box
            const feedbackBox = document.createElement('div');
            feedbackBox.className = 'mt-3 bg-white border ' + (isCorrect ? 'border-emerald-200' : 'border-rose-200') + ' rounded-3xl p-5 shadow-md text-left';

            const topRow = document.createElement('div');
            topRow.className = 'flex items-center justify-between mb-3';

            const statusBadge = document.createElement('div');
            statusBadge.className = 'inline-flex items-center gap-1.5 font-bold text-sm ' + (isCorrect ? 'text-emerald-700' : 'text-rose-600');
            statusBadge.innerHTML = isCorrect
                ? '<i class="fa-solid fa-circle-check text-emerald-500 text-base"></i> Отлично!'
                : '<i class="fa-solid fa-circle-xmark text-rose-500 text-base"></i> Запомните это правило:';

            const nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer';
            nextBtn.style.backgroundColor = '#0f172a';
            nextBtn.innerHTML = 'Дальше <i class="fa-solid fa-arrow-right text-[10px]"></i>';

            topRow.append(statusBadge, nextBtn);

            const ruleTitle = document.createElement('div');
            ruleTitle.className = 'text-xs font-bold text-amber-900 mb-1 flex items-center gap-1.5';
            ruleTitle.innerHTML = '<i class="fa-solid fa-lightbulb text-amber-500"></i> ' + rule.title;

            const ruleDesc = document.createElement('div');
            ruleDesc.className = 'text-xs text-slate-600 leading-relaxed mb-3';
            ruleDesc.textContent = rule.desc;

            const formulaBox = document.createElement('div');
            formulaBox.className = 'p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between font-mono text-xs';
            formulaBox.innerHTML = '<div>Пишем: <b class="text-slate-900 underline">' + item.word + '</b></div><i class="fa-solid fa-arrow-right text-slate-300 text-[10px]"></i><div>Звучит: <b class="text-emerald-700 font-bold">' + item.trans + '</b></div>';

            feedbackBox.append(topRow, ruleTitle, ruleDesc, formulaBox);
            container.appendChild(feedbackBox);

            function advanceToNext() {
                if (alphabetAutoNextTimer) { clearTimeout(alphabetAutoNextTimer); alphabetAutoNextTimer = null; }
                alphabetPracticeState.index++;
                alphabetPracticeState.answered = false;
                renderAlphabetQuestion();
            }

            nextBtn.addEventListener('click', advanceToNext);
            alphabetAutoNextTimer = setTimeout(advanceToNext, 4500);
        }

        // TYPE: Spelling hard letters with virtual keyboard buttons [ Ӏ ] [ ъ ] [ ь ]
        function renderSpellingHardQuestion(container, q) {
            const item = q.item;
            const group = q.group;
            const targetNorm = alphaNormLetter(item.letter);

            const card = document.createElement('div');
            card.className = 'bg-white rounded-3xl p-6 shadow-sm border border-slate-100/80';
            card.style.boxShadow = '0 10px 30px -5px rgba(0, 0, 0, 0.04)';

            const label = document.createElement('div');
            label.className = 'text-lg font-black text-slate-800 text-center mb-3 tracking-tight';
            label.textContent = 'Напиши букву, которую ты слышишь';

            const playArea = document.createElement('div');
            playArea.className = 'flex flex-col items-center my-4';

            const haloWrap = document.createElement('div');
            haloWrap.className = 'p-2 rounded-full inline-flex items-center justify-center transition-transform active:scale-95';
            haloWrap.style.background = 'rgba(16, 185, 129, 0.08)';

            const playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'w-18 h-18 rounded-full flex items-center justify-center text-2xl shadow-xl transition-all cursor-pointer outline-none border-0';
            playBtn.style.width = '76px';
            playBtn.style.height = '76px';
            playBtn.style.borderRadius = '50%';
            playBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
            playBtn.style.color = '#ffffff';
            playBtn.style.boxShadow = '0 10px 24px -3px rgba(16, 185, 129, 0.4)';
            playBtn.style.border = '3px solid #ecfdf5';
            playBtn.style.outline = 'none';
            playBtn.setAttribute('title', 'Прослушать звук');
            playBtn.innerHTML = '<i class="fa-solid fa-volume-high text-white text-2xl drop-shadow"></i>';

            playBtn.addEventListener('click', function() {
                playBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-white text-2xl"></i>';
                setTimeout(function() {
                    playBtn.innerHTML = '<i class="fa-solid fa-volume-high text-white text-2xl drop-shadow"></i>';
                }, 700);
                playLetterAudio(item.letter);
            });

            haloWrap.appendChild(playBtn);

            const hint = document.createElement('p');
            hint.className = 'text-xs font-semibold text-slate-400 mt-2';
            hint.textContent = 'Нажми, чтобы прослушать звук';
            playArea.append(haloWrap, hint);

            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = 'Введи букву (например ' + targetNorm + ')...';
            inp.className = 'w-full py-4 px-5 text-2xl font-black text-center bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 rounded-2xl outline-none transition-all tracking-wider mb-2';
            inp.maxLength = 6;

            const quickBar = document.createElement('div');
            quickBar.className = 'flex items-center justify-center gap-2 mb-3';
            const quickLabel = document.createElement('span');
            quickLabel.className = 'text-xs text-slate-400 font-medium mr-1';
            quickLabel.textContent = 'Вставить:';
            quickBar.appendChild(quickLabel);

            ['Ӏ', 'ъ', 'ь'].forEach(function(char) {
                const qBtn = document.createElement('button');
                qBtn.type = 'button';
                qBtn.className = 'px-4 py-2 rounded-xl bg-slate-100 hover:bg-emerald-100 active:bg-emerald-200 text-slate-800 font-bold text-lg border border-slate-200 shadow-sm transition-all cursor-pointer outline-none';
                qBtn.textContent = char;
                qBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    inp.value += char;
                    inp.focus();
                });
                quickBar.appendChild(qBtn);
            });

            const checkBtn = document.createElement('button');
            checkBtn.type = 'button';
            checkBtn.className = 'w-full py-3.5 rounded-2xl text-white font-bold text-base active:scale-95 transition-all shadow-md mb-2 cursor-pointer';
            checkBtn.style.backgroundColor = '#059669';
            checkBtn.innerHTML = '<i class="fa-solid fa-check mr-2 text-white"></i>Проверить ответ';

            const knowBtn = document.createElement('button');
            knowBtn.type = 'button';
            knowBtn.className = 'w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs active:scale-95 transition-all cursor-pointer';
            knowBtn.innerHTML = 'Я знаю этот звук — это «' + targetNorm + '»';

            card.append(label, playArea, inp, quickBar, checkBtn, knowBtn);
            container.appendChild(card);

            setTimeout(function() { playLetterAudio(item.letter); }, 350);
            setTimeout(function() { inp.focus(); }, 450);

            function doCheck() {
                if (alphabetPracticeState.answered) return;
                const val = inp.value.trim();
                if (!val) return;
                const normVal = (typeof normalizeLezgiSearch === 'function') ? normalizeLezgiSearch(val) : val.toLowerCase();
                const normCorrect = (typeof normalizeLezgiSearch === 'function') ? normalizeLezgiSearch(targetNorm) : targetNorm.toLowerCase();
                const isCorrect = normVal === normCorrect;

                inp.readOnly = true;
                if (isCorrect) {
                    inp.style.borderColor = '#4ade80';
                    inp.style.background = '#f0fdf4';
                    inp.style.color = '#15803d';
                } else {
                    inp.style.borderColor = '#f87171';
                    inp.style.background = '#fff1f2';
                    inp.style.color = '#e11d48';
                }

                alphabetPracticeState.answered = true;
                if (isCorrect) alphabetPracticeState.score++;
                checkBtn.disabled = true;
                knowBtn.disabled = true;

                showContrastComparisonFeedback(container, item.letter, group, isCorrect);
            }

            checkBtn.addEventListener('click', doCheck);
            inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') doCheck(); });

            knowBtn.addEventListener('click', function() {
                if (alphabetPracticeState.answered) return;
                alphabetPracticeState.answered = true;
                alphabetPracticeState.score++;
                knowBtn.disabled = true;
                checkBtn.disabled = true;
                inp.value = targetNorm;
                inp.style.borderColor = '#4ade80';
                inp.style.background = '#f0fdf4';
                showContrastComparisonFeedback(container, item.letter, group, true);
            });
        }

        // Standard listen question for easy letters in 'all' mode
        function renderListenPickQuestion(container, q) {
            const item = q.item;
            const card = document.createElement('div');
            card.className = 'bg-white rounded-3xl p-6 shadow-sm border border-slate-100/80';
            card.style.boxShadow = '0 10px 30px -5px rgba(0, 0, 0, 0.04)';

            const label = document.createElement('div');
            label.className = 'text-lg font-black text-slate-800 text-center mb-6 tracking-tight';
            label.textContent = 'Какую букву ты слышишь?';

            const playArea = document.createElement('div');
            playArea.className = 'flex flex-col items-center mb-6';

            const haloWrap = document.createElement('div');
            haloWrap.className = 'p-2 rounded-full inline-flex items-center justify-center transition-transform active:scale-95';
            haloWrap.style.background = 'rgba(16, 185, 129, 0.08)';

            const playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'w-22 h-22 rounded-full flex items-center justify-center text-3xl shadow-xl transition-all cursor-pointer outline-none border-0';
            playBtn.style.width = '88px';
            playBtn.style.height = '88px';
            playBtn.style.borderRadius = '50%';
            playBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
            playBtn.style.color = '#ffffff';
            playBtn.style.boxShadow = '0 12px 28px -4px rgba(16, 185, 129, 0.45)';
            playBtn.style.border = '4px solid #ecfdf5';
            playBtn.style.outline = 'none';
            playBtn.setAttribute('title', 'Прослушать звук');
            playBtn.innerHTML = '<i class="fa-solid fa-volume-high text-white text-3xl drop-shadow"></i>';

            playBtn.addEventListener('click', function() {
                playBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-white text-2xl"></i>';
                setTimeout(function() { playBtn.innerHTML = '<i class="fa-solid fa-volume-high text-white text-3xl drop-shadow"></i>'; }, 800);
                playLetterAudio(item.letter);
            });

            haloWrap.appendChild(playBtn);

            const hint = document.createElement('p');
            hint.className = 'text-xs font-semibold text-slate-400 mt-3 inline-flex items-center gap-1.5';
            hint.innerHTML = '<i class="fa-solid fa-rotate-right text-emerald-500 text-[10px]"></i> Нажми, чтобы повторить';

            playArea.append(haloWrap, hint);
            card.append(label, playArea);
            container.appendChild(card);

            setTimeout(function() { playLetterAudio(item.letter); }, 350);

            const allLetters = ALPHABET.filter(function(a) { return a.letter !== item.letter; });
            const wrongChoices = alphaShuffleArr(allLetters).slice(0, 3);
            const choices = alphaShuffleArr([item].concat(wrongChoices));

            const choicesGrid = document.createElement('div');
            choicesGrid.className = 'grid grid-cols-2 gap-3 mt-3';

            choices.forEach(function(choice) {
                const btn = createElevatedChoiceButton(choice.letter, false);

                btn.addEventListener('click', function() {
                    if (alphabetPracticeState.answered) return;
                    const isCorrect = choice.letter === item.letter;
                    handleContrastAnswer(isCorrect, btn, choicesGrid, item.letter, null, container);
                });

                choicesGrid.appendChild(btn);
            });

            container.appendChild(choicesGrid);
        }

        function handleContrastAnswer(isCorrect, clickedBtn, choicesGrid, correctLetter, group, container) {
            alphabetPracticeState.answered = true;
            if (isCorrect) {
                alphabetPracticeState.score++;
                clickedBtn.classList.add('is-correct');
            } else {
                clickedBtn.classList.add('is-wrong');
                choicesGrid.querySelectorAll('button').forEach(function(b) {
                    const firstDiv = b.querySelector('div');
                    const txt = (firstDiv ? firstDiv.textContent : b.textContent).trim();
                    if (txt === alphaNormLetter(correctLetter)) {
                        b.classList.add('is-correct');
                    }
                });
            }

            choicesGrid.querySelectorAll('button').forEach(function(b) { b.disabled = true; });

            showContrastComparisonFeedback(container, correctLetter, group, isCorrect);
        }

        function showContrastComparisonFeedback(container, correctLetter, group, isCorrect) {
            const feedbackBox = document.createElement('div');
            feedbackBox.className = 'mt-3 bg-white border ' + (isCorrect ? 'border-emerald-200' : 'border-rose-200') + ' rounded-3xl p-5 shadow-md';

            const topRow = document.createElement('div');
            topRow.className = 'flex items-center justify-between mb-3';

            const statusBadge = document.createElement('div');
            statusBadge.className = 'inline-flex items-center gap-1.5 font-bold text-sm ' + (isCorrect ? 'text-emerald-700' : 'text-rose-600');
            statusBadge.innerHTML = isCorrect
                ? '<i class="fa-solid fa-circle-check text-emerald-500 text-base"></i> Верно! Это «' + alphaNormLetter(correctLetter) + '»'
                : '<i class="fa-solid fa-circle-xmark text-rose-500 text-base"></i> Правильный звук: «' + alphaNormLetter(correctLetter) + '»';

            const nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer';
            nextBtn.style.backgroundColor = '#0f172a';
            nextBtn.innerHTML = 'Дальше <i class="fa-solid fa-arrow-right text-[10px]"></i>';

            topRow.append(statusBadge, nextBtn);
            feedbackBox.appendChild(topRow);

            if (group && group.letters && group.letters.length > 1) {
                const compareTitle = document.createElement('div');
                compareTitle.className = 'text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1';
                compareTitle.innerHTML = '<i class="fa-solid fa-headphones text-emerald-600"></i> Сравни звуки этой группы:';
                feedbackBox.appendChild(compareTitle);

                const compareGrid = document.createElement('div');
                compareGrid.className = 'flex flex-col gap-2 mb-3';

                group.letters.forEach(function(letterStr) {
                    const normL = alphaNormLetter(letterStr);
                    const info = HARD_LETTER_INFO[letterStr] || { tag: '', desc: '' };
                    const isTarget = letterStr === correctLetter;

                    const row = document.createElement('div');
                    row.className = 'flex items-center justify-between gap-3 p-2.5 rounded-2xl ' + (isTarget ? 'bg-emerald-50 border border-emerald-200/80' : 'bg-slate-50 border border-slate-100');

                    const left = document.createElement('div');
                    left.className = 'flex items-center gap-2.5 min-w-0 flex-1';

                    const letterBadge = document.createElement('div');
                    letterBadge.className = 'w-8 h-8 rounded-xl font-black text-base flex items-center justify-center flex-shrink-0 ' + (isTarget ? 'bg-emerald-600 text-white' : 'bg-white text-slate-800 border border-slate-200');
                    letterBadge.textContent = normL;

                    const textWrap = document.createElement('div');
                    textWrap.className = 'min-w-0';
                    const tag = document.createElement('div');
                    tag.className = 'text-xs font-bold ' + (isTarget ? 'text-emerald-900' : 'text-slate-800') + ' truncate';
                    tag.textContent = info.tag || normL;
                    const desc = document.createElement('div');
                    desc.className = 'text-[11px] text-slate-500 leading-tight line-clamp-1';
                    desc.textContent = info.desc;
                    textWrap.append(tag, desc);
                    left.append(letterBadge, textWrap);

                    const listenMiniBtn = document.createElement('button');
                    listenMiniBtn.type = 'button';
                    listenMiniBtn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer';
                    if (isTarget) {
                        listenMiniBtn.style.backgroundColor = '#059669';
                        listenMiniBtn.style.color = '#ffffff';
                    } else {
                        listenMiniBtn.style.backgroundColor = '#ffffff';
                        listenMiniBtn.style.color = '#0f172a';
                        listenMiniBtn.style.border = '1px solid #e2e8f0';
                    }
                    listenMiniBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> ' + normL;
                    listenMiniBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (alphabetAutoNextTimer) {
                            clearTimeout(alphabetAutoNextTimer);
                            alphabetAutoNextTimer = null;
                        }
                        playLetterAudio(letterStr);
                    });

                    row.append(left, listenMiniBtn);
                    compareGrid.appendChild(row);
                });

                feedbackBox.appendChild(compareGrid);
            }

            container.appendChild(feedbackBox);

            function advanceToNext() {
                if (alphabetAutoNextTimer) { clearTimeout(alphabetAutoNextTimer); alphabetAutoNextTimer = null; }
                alphabetPracticeState.index++;
                alphabetPracticeState.answered = false;
                renderAlphabetQuestion();
            }

            nextBtn.addEventListener('click', advanceToNext);
            alphabetAutoNextTimer = setTimeout(advanceToNext, 6500);
        }

        function renderAlphabetResults() {
            if (alphabetAutoNextTimer) { clearTimeout(alphabetAutoNextTimer); alphabetAutoNextTimer = null; }
            const container = document.getElementById('alphabet-practice-exercise');
            if (!container) return;
            container.innerHTML = '';
            const state = alphabetPracticeState;
            const pct = Math.round((state.score / state.total) * 100);

            const wrap = document.createElement('div');
            wrap.className = 'bg-white border border-slate-100 rounded-3xl p-8 shadow-sm text-center flex flex-col items-center gap-4';

            const emojiEl = document.createElement('div');
            emojiEl.className = 'text-6xl';
            emojiEl.textContent = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚';

            const title = document.createElement('h2');
            title.className = 'text-2xl font-black text-slate-800';
            title.textContent = pct >= 80 ? 'Отличный результат!' : pct >= 50 ? 'Хорошо!' : 'Продолжай тренироваться!';

            const scoreEl = document.createElement('div');
            scoreEl.className = 'text-5xl font-black text-emerald-600';
            scoreEl.textContent = pct + '%';

            const sub = document.createElement('p');
            sub.className = 'text-sm text-slate-500';
            sub.textContent = state.score + ' правильно из ' + state.total;

            const modeLabel = document.createElement('div');
            modeLabel.className = 'text-xs font-bold text-slate-400';
            modeLabel.textContent = alphabetFilterMode === 'hard'
                ? 'Режим: Сложные звуки'
                : (alphabetFilterMode === 'ortho' ? 'Режим: Живая речь (Орфоэпия)' : 'Режим: Весь алфавит');

            const retryBtn = document.createElement('button');
            retryBtn.type = 'button';
            retryBtn.className = 'w-full py-4 text-white font-bold rounded-2xl text-base mt-2 active:scale-95 transition-all shadow-md cursor-pointer';
            retryBtn.style.backgroundColor = '#059669';
            retryBtn.innerHTML = '<i class="fa-solid fa-rotate-right mr-2 text-white"></i>Попробовать снова';
            retryBtn.addEventListener('click', startAlphabetPractice);

            const backBtn2 = document.createElement('button');
            backBtn2.type = 'button';
            backBtn2.className = 'w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-base active:scale-95 transition-all cursor-pointer';
            backBtn2.textContent = 'Завершить';
            backBtn2.addEventListener('click', hideAlphabetPracticeView);

            wrap.append(emojiEl, title, scoreEl, sub, modeLabel, retryBtn, backBtn2);
            container.appendChild(wrap);
        }

        function startAlphabetPractice() { if (typeof window.startReadingModeSession === 'function') window.startReadingModeSession('letters'); }
        function setAlphabetPracticeMode(m) { if (typeof window.startReadingModeSession === 'function') window.startReadingModeSession(m); }

        window.openAlphabetMenuModal = openAlphabetMenuModal;
        window.closeAlphabetMenuModal = closeAlphabetMenuModal;
        window.showAlphabetPracticeView = showAlphabetPracticeView;
        window.hideAlphabetPracticeView = hideAlphabetPracticeView;
        window.startAlphabetPractice = startAlphabetPractice;
        window.setAlphabetPracticeMode = setAlphabetPracticeMode;
        window.startReadingModeSession = startReadingModeSession;
        window.renderReadingPhoneticsHub = renderReadingPhoneticsHub;


        // ========================================================
        // MODAL ISOLATION & SCROLL LOCK SYSTEM
        // ========================================================
        const ALL_MODAL_IDS = [
            'word-modal',
            'practice-modal',
            'leaderboard-modal',
            'duel-menu-modal',
            'duel-lobby-modal',
            'duel-join-modal',
            'duel-matchmaking-modal',
            'duel-incoming-modal',
            'duel-modal',
            'feedback-modal'
        ];

        let ghostClickShieldActive = false;
        let ghostClickShieldTimer = null;

        function activateGhostClickShield(duration = 350) {
            ghostClickShieldActive = true;
            if (ghostClickShieldTimer) clearTimeout(ghostClickShieldTimer);
            ghostClickShieldTimer = setTimeout(() => {
                ghostClickShieldActive = false;
                ghostClickShieldTimer = null;
                syncModalOpenState();
            }, duration);
        }

        function hasAnyOpenModal() {
            for (let i = 0; i < ALL_MODAL_IDS.length; i++) {
                const el = document.getElementById(ALL_MODAL_IDS[i]);
                if (el && !el.classList.contains('hidden') && el.style.display !== 'none') {
                    return true;
                }
            }
            if (typeof document !== 'undefined') {
                const dialogs = document.querySelectorAll('[role="dialog"]:not(.hidden)');
                for (let i = 0; i < dialogs.length; i++) {
                    if (dialogs[i].style.display !== 'none') return true;
                }
            }
            return false;
        }

        function getActiveTopModal() {
            const priority = [
                'duel-modal',
                'duel-matchmaking-modal',
                'duel-lobby-modal',
                'duel-join-modal',
                'duel-incoming-modal',
                'duel-menu-modal',
                'leaderboard-modal',
                'feedback-modal',
                'practice-modal',
                'word-modal'
            ];
            for (let i = 0; i < priority.length; i++) {
                const el = document.getElementById(priority[i]);
                if (el && !el.classList.contains('hidden') && el.style.display !== 'none') {
                    return el;
                }
            }
            return null;
        }

        function syncModalOpenState() {
            if (typeof document === 'undefined') return;
            const isOpen = hasAnyOpenModal();
            const mainEl = document.querySelector('main');
            const headerEl = document.querySelector('header.app-header');
            const navEl = document.querySelector('nav.bottom-nav');
            const asideEl = document.querySelector('aside');

            if (isOpen || ghostClickShieldActive) {
                document.body?.classList.add('modal-open');
                mainEl?.setAttribute('inert', '');
                headerEl?.setAttribute('inert', '');
                navEl?.setAttribute('inert', '');
                asideEl?.setAttribute('inert', '');
                if (mainEl) mainEl.style.overflowY = 'hidden';
            } else {
                document.body?.classList.remove('modal-open');
                mainEl?.removeAttribute('inert');
                headerEl?.removeAttribute('inert');
                navEl?.removeAttribute('inert');
                asideEl?.removeAttribute('inert');
                if (mainEl) mainEl.style.overflowY = '';
            }

            if (typeof window !== 'undefined' && typeof window.TelegramApp?.updateBackButton === 'function') {
                window.TelegramApp.updateBackButton();
            }
        }

        function isTargetInsideScrollableModal(target) {
            if (!target || typeof target.closest !== 'function') return false;
            const openModal = target.closest('[role="dialog"]:not(.hidden)');
            if (!openModal) return false;

            // If target is the outer backdrop element, it is NOT inside a scrollable container
            if (target === openModal) return false;

            let el = target;
            while (el && el !== openModal) {
                if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
                    const style = window.getComputedStyle(el);
                    const ovY = style.overflowY;
                    if ((ovY === 'auto' || ovY === 'scroll') && el.scrollHeight > el.clientHeight) {
                        return { scrollableEl: el, modal: openModal };
                    }
                }
                el = el.parentElement;
            }
            return false;
        }

        function handleEscapeKey(e) {
            if (!hasAnyOpenModal()) {
                const grammarView = document.getElementById('practice-grammar-view');
                if (grammarView && !grammarView.classList.contains('hidden')) {
                    e?.preventDefault?.();
                    if (typeof hideGrammarUnitsView === 'function') hideGrammarUnitsView();
                    return true;
                }
                const alphaView = document.getElementById('practice-alphabet-view');
                if (alphaView && !alphaView.classList.contains('hidden')) {
                    e?.preventDefault?.();
                    if (typeof hideAlphabetPracticeView === 'function') hideAlphabetPracticeView();
                    return true;
                }
                return false;
            }

            e?.preventDefault?.();
            e?.stopPropagation?.();
            activateGhostClickShield(350);

            const topModal = getActiveTopModal();
            if (!topModal) return false;

            switch (topModal.id) {
                case 'word-modal':
                    if (typeof closeModal === 'function') closeModal();
                    break;
                case 'practice-modal':
                    if (typeof endPractice === 'function') endPractice();
                    break;
                case 'leaderboard-modal':
                    if (typeof closeLeaderboardModal === 'function') closeLeaderboardModal();
                    break;
                case 'duel-menu-modal':
                    if (typeof closeDuelMenuModal === 'function') closeDuelMenuModal();
                    break;
                case 'duel-lobby-modal':
                    if (typeof closeDuelLobbyModal === 'function') closeDuelLobbyModal();
                    break;
                case 'duel-join-modal':
                    if (typeof closeDuelJoinModal === 'function') closeDuelJoinModal();
                    break;
                case 'duel-matchmaking-modal':
                    if (typeof closeDuelMatchmakingModal === 'function') closeDuelMatchmakingModal(true);
                    break;
                case 'duel-incoming-modal':
                    if (typeof closeIncomingDuelModal === 'function') closeIncomingDuelModal();
                    break;
                case 'duel-modal':
                    if (typeof closeDuelModal === 'function') closeDuelModal();
                    break;
                case 'feedback-modal':
                    if (typeof closeFeedbackModal === 'function') closeFeedbackModal();
                    break;
                default:
                    topModal.classList.add('hidden');
                    topModal.classList.remove('flex');
                    break;
            }
            syncModalOpenState();
            return true;
        }

        let isModalIsolationInitialized = false;
        function initModalIsolationSystem() {
            if (isModalIsolationInitialized || typeof window === 'undefined') return;
            isModalIsolationInitialized = true;

            // 1. Mouse Wheel Blocker: locks background scroll completely
            window.addEventListener('wheel', (e) => {
                if (!hasAnyOpenModal()) return;

                const scrollInfo = isTargetInsideScrollableModal(e.target);
                if (!scrollInfo) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                // If inside scrollable container, prevent scroll chaining to background
                const el = scrollInfo.scrollableEl;
                const isScrollingUp = e.deltaY < 0;
                const isScrollingDown = e.deltaY > 0;

                if (isScrollingUp && el.scrollTop <= 0) {
                    e.preventDefault();
                } else if (isScrollingDown && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
                    e.preventDefault();
                }
            }, { passive: false });

            // 2. Touchmove Blocker: prevents mobile drag/scroll of background
            window.addEventListener('touchmove', (e) => {
                if (!hasAnyOpenModal()) return;

                const scrollInfo = isTargetInsideScrollableModal(e.target);
                if (!scrollInfo) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, { passive: false });

            // 3. Capturing Click Guard: absorbs ghost clicks when closing modals
            window.addEventListener('click', (e) => {
                if (ghostClickShieldActive) {
                    const topModal = getActiveTopModal();
                    const isInsideModalContent = topModal && e.target && topModal.contains(e.target) && e.target !== topModal;
                    if (!isInsideModalContent) {
                        e.stopPropagation();
                        e.preventDefault();
                        e.stopImmediatePropagation();
                    }
                }
            }, true);

            // 4. MutationObserver auto-syncing modal states
            if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
                const observer = new MutationObserver(() => {
                    syncModalOpenState();
                });

                ALL_MODAL_IDS.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        observer.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
                    }
                });
            }

            syncModalOpenState();
        }

        if (typeof window !== 'undefined') {
            window.hasAnyOpenModal = hasAnyOpenModal;
            window.getActiveTopModal = getActiveTopModal;
            window.syncModalOpenState = syncModalOpenState;
            window.activateGhostClickShield = activateGhostClickShield;
            window.handleEscapeKey = handleEscapeKey;
            window.initModalIsolationSystem = initModalIsolationSystem;
            window.hideGrammarList = hideGrammarList;
            window.showGrammarList = showGrammarList;
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initModalIsolationSystem, { once: true });
            } else {
                initModalIsolationSystem();
            }
        }
