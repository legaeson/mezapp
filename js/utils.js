
        function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]] } return arr }
        function shuffleArray(arr) { return shuffle([...arr]); }

        function sanitizeString(str) {
            if (!str) return '';
            let s = str.trim().replace(/[1I|'`l]/g, 'Ӏ');
            s = s.toLowerCase().replace(/ӏ/g, 'Ӏ');
            return s
                .replace(/[.!?,;:]/g, '')
                .replace(/\s+/g, ' ')
                .replace(/ё/gi, 'е')
                .normalize('NFC');
        }

        const VOWELS_AND_SIGNS = new Set('аеёиоуыэюяАЕЁИОУЫЭЮЯъьЪЬaeyioɨuAEYIOƗUāǣĀǢæœəÆŒƏ'.split(''));

        function isLetterChar(ch) {
            return ch && ch.toLowerCase() !== ch.toUpperCase();
        }

        function replaceYa(text) {
            if (!text) return text;
            let res = '';
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === 'я' || char === 'Я') {
                    let prevIdx = i - 1;
                    while (prevIdx >= 0 && (text[prevIdx] === 'Ӏ' || text[prevIdx] === 'ӏ' || text[prevIdx] === '\'' || text[prevIdx] === '1')) {
                        prevIdx--;
                    }
                    const prevChar = prevIdx >= 0 ? text[prevIdx] : '';
                    if (!prevChar || !isLetterChar(prevChar) || VOWELS_AND_SIGNS.has(prevChar)) {
                        res += (char === 'Я' ? 'Ja' : 'ja');
                    } else {
                        res += (char === 'Я' ? 'Æ' : 'æ');
                    }
                } else {
                    res += char;
                }
            }
            return res;
        }

        // -------------------------------------------------------------
        // ЛЕЗГИНСКАЯ ТРАНСЛИТЕРАЦИЯ (КИРИЛЛИЦА -> ЛАТИНИЦА)
        // -------------------------------------------------------------
        const CYR_TO_LAT_MAPPING = [
            ["чӀ", "ch'"], ["ЧӀ", "Ch'"],
            ["дж", "dzh"], ["Дж", "Dzh"], ["ДЖ", "DZH"],
            ["дз", "dz"],  ["Дз", "Dz"],  ["ДЗ", "DZ"],
            ["цӀ", "c'"],  ["ЦӀ", "C'"],
            ["кӀ", "k'"],  ["КӀ", "K'"],
            ["пӀ", "p'"],  ["ПӀ", "P'"],
            ["тӀ", "t'"],  ["ТӀ", "T'"],
            ["кь", "q'"],  ["Кь", "Q'"],  ["КЬ", "Q'"],
            ["къ", "q"],   ["Къ", "Q"],   ["КЪ", "Q"],
            ["хъ", "qh"],  ["Хъ", "Qh"],  ["ХЪ", "QH"],
            ["гъ", "gh"],  ["Гъ", "Gh"],  ["ГЪ", "GH"],
            ["гь", "h"],   ["Гь", "H"],   ["ГЬ", "H"],
            ["хӀ", "h"],   ["ХӀ", "H"],
            ["хь", "h"],   ["Хь", "H"],   ["ХЬ", "H"],

            ["аь", "æ"],   ["Аь", "Æ"],   ["АЬ", "Æ"],
            ["оь", "œ"],   ["Оь", "Œ"],   ["ОЬ", "Œ"],
            ["уь", "y"],   ["Уь", "Y"],   ["УЬ", "Y"],

            ["ч", "ch"],   ["Ч", "Ch"],
            ["ш", "sh"],   ["Ш", "Sh"],
            ["ж", "zh"],   ["Ж", "Zh"],
            ["щ", "shch"], ["Щ", "Shch"],

            ["ю", "ju"],   ["Ю", "Ju"],
            ["ё", "jo"],   ["Ё", "Jo"],

            ["а", "a"], ["А", "A"],
            ["б", "b"], ["Б", "B"],
            ["в", "w"], ["В", "W"],
            ["г", "g"], ["Г", "G"],
            ["д", "d"], ["Д", "D"],
            ["е", "e"], ["Е", "E"],
            ["э", "e"], ["Э", "E"],
            ["з", "z"], ["З", "Z"],
            ["и", "i"], ["И", "I"],
            ["к", "k"], ["К", "K"],
            ["л", "l"], ["Л", "L"],
            ["м", "m"], ["М", "M"],
            ["н", "n"], ["Н", "N"],
            ["о", "o"], ["О", "O"],
            ["п", "p"], ["П", "P"],
            ["р", "r"], ["Р", "R"],
            ["с", "s"], ["С", "S"],
            ["т", "t"], ["Т", "T"],
            ["у", "u"], ["У", "U"],
            ["ф", "f"], ["Ф", "F"],
            ["х", "x"], ["Х", "X"],
            ["ц", "c"], ["Ц", "C"],
            ["ы", "ə"], ["Ы", "Ə"],

            ["ъ", ""],  ["Ъ", ""],
            ["ь", ""],  ["Ь", ""],
            ["Ӏ", ""]
        ];

        function cyrillicToLatin(text) {
            if (!text) return '';

            // 1. Нормализуем варианты палочек (I, l, 1, Ӏ) после смычных согласных
            let t = text.replace(/(?<=[кптцчхКПТЦЧХ])[I1l!|]/g, 'Ӏ');

            // 2. Буква «Й»: всегда -> 'j' / 'J'
            t = t.replace(/й/g, 'j').replace(/Й/g, 'J');

            // 3. Позиционная замена «Я»:
            // В начале слова, после гласных и знаков -> ja / Ja
            // После согласных -> æ / Æ
            t = replaceYa(t);

            // 4. Полный словарь подстановок (по убыванию длины)
            for (let i = 0; i < CYR_TO_LAT_MAPPING.length; i++) {
                const [cyr, lat] = CYR_TO_LAT_MAPPING[i];
                t = t.split(cyr).join(lat);
            }

            return t;
        }

        function transliterateLezgi(text, mazin = false) {
            return cyrillicToLatin(text);
        }

        const transliterateLezgin = transliterateLezgi;

        function getLezgiWord(w) {
            if (!w) return '';
            const isLat = typeof isLatinEnabled === 'function' && isLatinEnabled();
            if (typeof w === 'string') {
                return isLat && typeof transliterateLezgi === 'function' ? transliterateLezgi(w) : w;
            }
            if (isLat) {
                return w.lz_lat || (typeof transliterateLezgi === 'function' ? transliterateLezgi(w.lz) : w.lz);
            }
            return w.lz;
        }

        if (typeof window !== 'undefined') {
            window.getLezgiWord = getLezgiWord;
            window.transliterateLezgi = transliterateLezgi;
            window.transliterateLezgin = transliterateLezgin;
        }
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = {
                cyrillicToLatin,
                replaceYa,
                getLezgiWord,
                transliterateLezgi,
                transliterateLezgin
            };
        }

        function levenshteinDistance(s1, s2) {
            if (!s1) return s2 ? s2.length : 0;
            if (!s2) return s1.length;
            const costs = [];
            for (let i = 0; i <= s1.length; i++) {
                let lastValue = i;
                for (let j = 0; j <= s2.length; j++) {
                    if (i === 0) {
                        costs[j] = j;
                    } else {
                        if (j > 0) {
                            let newValue = costs[j - 1];
                            if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                                newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                            }
                            costs[j - 1] = lastValue;
                            lastValue = newValue;
                        }
                    }
                }
                if (i > 0) costs[s2.length] = lastValue;
            }
            return costs[s2.length];
        }


        // Анимация — однократный fade-in-up через inline style (не оставляет классов)
        function staggerCards(container) {
            const children = container.children;
            for (let i = 0; i < children.length; i++) {
                const el = children[i];
                const delay = Math.min(i, 14) * 0.015;
                el.style.animation = `fade-in-up 0.3s ease-out ${delay}s both`;
                el.addEventListener('animationend', function handler() {
                    el.style.animation = '';
                    el.removeEventListener('animationend', handler);
                }, { once: true });
            }
        }



        const AUDIO_ASSET_VERSION = '2026-05-27-2';
        const PRELOADED_AUDIO = {};
        const AUDIO_PLAYER = new Audio();

        function getVersionedAudioUrl(audioPath) {
            const url = new URL(audioPath, window.location.href);
            if (url.pathname.endsWith('.mp3')) {
                url.searchParams.set('v', AUDIO_ASSET_VERSION);
            }
            return url.toString();
        }

        function speakWord(text, audioPath) {
            if (audioPath) {
                const versionedUrl = getVersionedAudioUrl(audioPath);
                const cachedUrl = PRELOADED_AUDIO[versionedUrl] || versionedUrl;
                AUDIO_PLAYER.src = cachedUrl;
                AUDIO_PLAYER.play().catch(err => {
                    warn("Файл не найден, используем синтезатор:", err);
                    if (text) runFallbackSpeech(text);
                });
                return;
            }
            if (text) runFallbackSpeech(text);
        }

        function runFallbackSpeech(text) {
            const utter = new SpeechSynthesisUtterance(text);
            
            if (typeof speechSynthesis !== 'undefined' && typeof speechSynthesis.getVoices === 'function') {
                const voices = speechSynthesis.getVoices();
                // 1. Try to find a Georgian voice
                let voice = voices.find(v => v.lang.startsWith('ka') || v.lang.startsWith('GE') || v.name.toLowerCase().includes('georgian'));
                if (voice) {
                    utter.voice = voice;
                    utter.lang = voice.lang;
                } else {
                    // 2. Fallback to Turkish (much closer phonetic engine than Russian)
                    voice = voices.find(v => v.lang.startsWith('tr') || v.name.toLowerCase().includes('turkish'));
                    if (voice) {
                        utter.voice = voice;
                        utter.lang = voice.lang;
                    } else {
                        // 3. Fallback to default Georgian code
                        utter.lang = 'ka-GE';
                    }
                }
            } else {
                utter.lang = 'ka-GE';
            }
            
            speechSynthesis.speak(utter);
        }

        function vibrateError() {
            window.TelegramApp?.haptic('error');
            if (!navigator.vibrate) return;
            navigator.vibrate([50, 30, 50]);
        }
        function vibrateSuccess() {
            window.TelegramApp?.haptic('success');
            if (!navigator.vibrate) return;
            navigator.vibrate(15);
        }
        function vibrateComplete() {
            window.TelegramApp?.haptic('success');
            if (!navigator.vibrate) return;
            navigator.vibrate([20, 20, 20]);
        }

        function escapeHtml(text = '') {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

