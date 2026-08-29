
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

        // -------------------------------------------------------------
        // ЛЕЗГИНСКАЯ ТРАНСЛИТЕРАЦИЯ — ПРАКТИЧЕСКАЯ СИСТЕМА
        // -------------------------------------------------------------
        const REPLACEMENTS_MAP = {
            "чӀ˚в": "c'˚w", "ЧӀ˚в": "C'˚w", "чӀ˚": "c'˚", "ЧӀ˚": "C'˚",
            "чh˚": "ch̊", "Чh˚": "Ch̊", "ч˚в": "c̊w", "Ч˚в": "C̊w", "ч˚": "c̊", "Ч˚": "C̊",
            "ж˚в": "j̊w", "Ж˚в": "J̊w", "ж˚": "j̊", "Ж˚": "J̊",
            "дж˚": "dj̊", "Дж˚": "Dj̊",
            "ш˚": "sh̊", "Ш˚": "Sh̊",
            "ф˚": "f̊", "Ф˚": "F̊",

            "къв": "qw", "Къв": "Qw", "кӀв": "k'w", "КӀв": "K'w", "кьв": "q'w", "Кьв": "Q'w",
            "гъв": "ġw", "Гъв": "Ġw", "гв": "gw", "Гв": "Gw",
            "тӀв": "t'w", "ТӀв": "T'w", "тв": "tw", "Тв": "Tw",
            "цӀв": "ts'w", "ЦӀв": "Ts'w", "цв": "tsw", "Цв": "Tsw",
            "хъв": "qhw", "Хъв": "Qhw", "хьв": "xhw", "Хьв": "Xhw", "хв": "xw", "Хв": "Xw",
            "зв": "zw", "Зв": "Zw", "св": "sw", "Св": "Sw", "кв": "kw", "Кв": "Kw",

            "гъ": "ġ", "Гъ": "Ġ", "ГЪ": "Ġ",
            "гь": "h", "Гь": "H", "ГЬ": "H",
            "гӀ": "g'", "ГӀ": "G'",
            "къ": "q", "Къ": "Q", "КЪ": "Q",
            "кь": "q'", "Кь": "Q'", "КЬ": "Q'",
            "кӀ": "k'", "КӀ": "K'",
            "хъ": "qh", "Хъ": "Qh", "ХЪ": "QH",
            "хь": "xh", "Хь": "Xh", "ХЬ": "XH",
            "хӀ": "x'", "ХӀ": "X'",
            "пӀ": "p'", "ПӀ": "P'",
            "тӀ": "t'", "ТӀ": "T'",
            "цӀ": "ts'", "ЦӀ": "Ts'",
            "чӀ": "c'", "ЧӀ": "C'",
            "дж": "dj", "Дж": "Dj", "ДЖ": "DJ",
            "щ": "shch", "Щ": "Shch",
            "ш": "sh", "Ш": "Sh",
            "ц": "ts", "Ц": "Ts",
            "ч": "c", "Ч": "C"
        };

        const SINGLE_LETTERS_MAP = {
            "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "j",
            "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
            "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "x", "ы": "ɨ",
            "э": "e", "ю": "yu", "я": "ya", "ъ": "'", "ь": "",

            "А": "A", "Б": "B", "В": "V", "Г": "G", "Д": "D", "Е": "E", "Ё": "Yo", "Ж": "J",
            "З": "Z", "И": "I", "Й": "Y", "К": "K", "Л": "L", "М": "M", "Н": "N", "О": "O",
            "П": "P", "Р": "R", "С": "S", "Т": "T", "У": "U", "Ф": "F", "Х": "X", "Ы": "Ɨ",
            "Э": "E", "Ю": "Yu", "Я": "Ya", "Ъ": "'", "Ь": ""
        };

        const LONG_VOWELS_MAP = { "аа": "ā", "Аа": "Ā", "АА": "Ā" };
        const MAZIN_LONG_VOWELS_MAP = { "аьаь": "ǣ", "Аьаь": "Ǣ", "АЬАЬ": "Ǣ" };

        function _escapeRegExp(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function _makePattern(mapping) {
            const keys = Object.keys(mapping).sort((a, b) => b.length - a.length);
            return new RegExp(keys.map(k => _escapeRegExp(k)).join('|'), 'g');
        }

        const SPECIAL_PATTERN = _makePattern(REPLACEMENTS_MAP);
        const LETTER_PATTERN = _makePattern(SINGLE_LETTERS_MAP);
        const LONG_PATTERN = _makePattern(LONG_VOWELS_MAP);
        const MAZIN_LONG_PATTERN = _makePattern(MAZIN_LONG_VOWELS_MAP);

        function _replaceWithDict(text, pattern, mapping) {
            return text.replace(pattern, m => mapping[m]);
        }

        function normalizePalochka(text) {
            if (!text) return text;
            let t = text.replace(/([а-яА-ЯёЁӀӏ][\u0300-\u036f˚]*)[1lLIi|ӏІі]/gu, '$1Ӏ');
            t = t.replace(/(^|[\s\b])[1lLIi|ӏІі](?=[а-яА-ЯёЁ])/gu, '$1Ӏ');
            const palMap = {'1':'Ӏ','l':'Ӏ','L':'Ӏ','|':'Ӏ','I':'Ӏ','i':'Ӏ','ӏ':'Ӏ','І':'Ӏ','і':'Ӏ'};
            return t.replace(/[1lLIi|ӏІі]/g, m => palMap[m] || m);
        }

        const VOWELS_AND_SIGNS_SET = new Set([
            'а','е','ё','и','о','у','ы','э','ю','я',
            'А','Е','Ё','И','О','У','Ы','Э','Ю','Я',
            'ъ','ь','Ъ','Ь',
            'ā','ǣ','Ā','Ǣ',
            'a','e','i','o','u','y','ɨ',
            'A','E','I','O','U','Y','Ɨ'
        ]);

        function _isLetter(ch) {
            return ch && ch.toLowerCase() !== ch.toUpperCase();
        }

        function replaceYa(text) {
            if (!text) return text;
            let res = '';
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === 'я' || char === 'Я') {
                    let prevIdx = i - 1;
                    if (prevIdx >= 0 && (text[prevIdx] === 'Ӏ' || text[prevIdx] === 'ӏ' || text[prevIdx] === "'")) {
                        prevIdx--;
                    }
                    let prevChar = prevIdx >= 0 ? text[prevIdx] : '';
                    if (!prevChar || !_isLetter(prevChar) || VOWELS_AND_SIGNS_SET.has(prevChar)) {
                        res += (char === 'Я' ? 'Ya' : 'ya');
                    } else {
                        res += (char === 'Я' ? 'Æ' : 'æ');
                    }
                } else {
                    res += char;
                }
            }
            return res;
        }

        function transliterateLezgi(text, mazin = false) {
            if (!text) return '';
            let t = normalizePalochka(text);
            if (mazin) {
                t = _replaceWithDict(t, MAZIN_LONG_PATTERN, MAZIN_LONG_VOWELS_MAP);
            }
            t = _replaceWithDict(t, LONG_PATTERN, LONG_VOWELS_MAP);
            t = replaceYa(t);
            t = _replaceWithDict(t, SPECIAL_PATTERN, REPLACEMENTS_MAP);
            t = _replaceWithDict(t, LETTER_PATTERN, SINGLE_LETTERS_MAP);
            return t.replace(/Ӏ/g, "'");
        }

        const transliterateLezgin = transliterateLezgi;

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

