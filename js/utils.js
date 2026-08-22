
        function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]] } return arr }
        function shuffleArray(arr) { return shuffle([...arr]); }

        function sanitizeString(str) {
            if (!str) return '';
            return str
                .trim()
                .toLowerCase()
                .replace(/[.!?,;:]/g, '')
                .replace(/\s+/g, ' ')
                .replace(/[1I|'`l]/g, 'Ӏ')
                .replace(/ё/gi, 'е')
                .normalize('NFC');
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

