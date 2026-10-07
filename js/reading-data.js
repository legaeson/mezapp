/**
 * ============================================================================
 * LezgiAPP — База данных режимов чтения, правил орфоэпии и вопросов
 * ============================================================================
 * 
 * ИНСТРУКЦИЯ ДЛЯ РЕДАКТИРОВАНИЯ:
 * 1. Этот файл — ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ для всех тренировок чтения.
 * 2. Любые изменения (исправление ошибок, добавление новых вопросов,
 *    изменение вариантов ответа или подсказок) автоматически применяются
 *    в приложении сразу после сохранения файла и обновления страницы (F5).
 * 3. Не нужно запускать сборщики, компиляторы или писать в другие файлы.
 * ============================================================================
 */

const READING_DATA = {
    // ------------------------------------------------------------------------
    // 1. ТЕОРЕТИЧЕСКИЕ КАРТОЧКИ ПЕРЕД НАЧАЛОМ ТРЕНИРОВОК
    // ------------------------------------------------------------------------
    theory: {
        "labialization": {
            "title": "Лабиализация",
            "subtitle": "Округление губ буквой «В» и переход в [ʷо] или [ʷоь]",
            "rules": [
                {
                    "title": "1. Правило с [ʷо]",
                    "desc": "Обычно сочетание «в + а» произносится с округлением губ и переходит в [ʷо], если слово не заканчивается на «р». Правило: в + а → [ʷо].",
                    "body": "Обычно сочетание «в + а» произносится с округлением губ и переходит в [ʷо], если слово не заканчивается на «р». Правило: в + а → [ʷо].",
                    "examples": [
                        {
                            "word": "кӀвал",
                            "trans": "[кӀʷол]",
                            "ru": "дом"
                        },
                        {
                            "word": "свас",
                            "trans": "[сʷос]",
                            "ru": "невеста"
                        }
                    ]
                },
                {
                    "title": "Исключение: окончание на «р»",
                    "desc": "Если слово заканчивается на «р», буква «а» сохраняет своё обычное звучание ближе к написанию: в + а → [ʷа].",
                    "body": "Если слово заканчивается на «р», буква «а» сохраняет своё обычное звучание ближе к написанию: в + а → [ʷа].",
                    "examples": [
                        {
                            "word": "тӀвар",
                            "trans": "[тӀʷар]",
                            "ru": "имя"
                        },
                        {
                            "word": "ахвар",
                            "trans": "[ахʷар]",
                            "ru": "сон"
                        }
                    ]
                },
                {
                    "title": "2. Правило с [ʷоь] (Вариант с [ʷœ])",
                    "desc": "Звук [оь] — округлённый гласный (как немецкое ö). Сочетание «в + е» всегда произносится как [ʷоь] (независимо от буквы «р»). Правило: в + е → [ʷоь].",
                    "body": "Звук [оь] — округлённый гласный (как немецкое ö). Сочетание «в + е» всегда произносится как [ʷоь] (независимо от буквы «р»). Правило: в + е → [ʷоь].",
                    "examples": [
                        {
                            "word": "кьвед",
                            "trans": "[кьʷоьд]",
                            "ru": "два"
                        },
                        {
                            "word": "хъвер",
                            "trans": "[хъʷоьр]",
                            "ru": "смех"
                        }
                    ]
                }
            ]
        },
        "nasalization": {
            "title": "Назализация",
            "subtitle": "Носовое звучание гласных перед буквой «Н»",
            "rules": [
                {
                    "title": "Носовой призвук в конце слова",
                    "desc": "Конечный согласный «-Н» ослабляется, а предшествующий гласный получает носовой тембр [ᵸ].",
                    "body": "Конечный согласный «-Н» ослабляется, а предшествующий гласный получает носовой тембр [ᵸ].",
                    "examples": [
                        {
                            "word": "зун",
                            "trans": "[зуᵸ]",
                            "ru": "я"
                        },
                        {
                            "word": "ван",
                            "trans": "[ваᵸ]",
                            "ru": "голос"
                        }
                    ]
                },
                {
                    "title": "В заимствованных словах",
                    "desc": "Правило носового гласного последовательно действует и в заимствованных словах на конце слогов.",
                    "body": "Правило носового гласного последовательно действует и в заимствованных словах на конце слогов.",
                    "examples": [
                        {
                            "word": "инсан",
                            "trans": "[иᵸсаᵸ]",
                            "ru": "человек"
                        },
                        {
                            "word": "бенд",
                            "trans": "[беᵸд]",
                            "ru": "куплет"
                        }
                    ]
                }
            ]
        },
        "elision": {
            "title": "Стяжение окончаний (-ай / -яй)",
            "subtitle": "Стяжение падежных и глагольных окончаний в долгие гласные",
            "rules": [
                {
                    "title": "Стяжение окончаний «-ай / -яй»",
                    "desc": "Падежные и глагольные окончания стягиваются в долгие гласные звуки [аа] и [аьаь]. Буква «й» на конце не произносится как отдельный согласный, а удлиняет предшествующий гласный: -ай ➔ [аа], -яй ➔ [аьаь].",
                    "body": "Падежные и глагольные окончания стягиваются в долгие гласные звуки [аа] и [аьаь]. Буква «й» на конце не произносится как отдельный согласный, а удлиняет предшествующий гласный: -ай ➔ [аа], -яй ➔ [аьаь].",
                    "examples": [
                        {
                            "word": "авай",
                            "trans": "[аваа]",
                            "ru": "был, находился"
                        },
                        {
                            "word": "рикӀяй",
                            "trans": "[рикӀаьаь]",
                            "ru": "из сердца"
                        }
                    ]
                }
            ]
        }
    },

    // ------------------------------------------------------------------------
    // 2. ПОЛНЫЙ БАНК ВОПРОСОВ (59 заданий)
    // ------------------------------------------------------------------------
    questions: [
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
            trans: "[кӀʷолаьаь]",
            tip: "Окончание «-яй» после согласного стягивается в долгий [аьаь]: [кӀʷолаьаь].",
            choices: [
                { text: "[кӀʷолаьаь]", correct: true },
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
            questionText: "Какая транскрипция верна для слова «хтай» (вернувшийся)?",
            displayWordHtml: "хтай",
            rawWord: "хтай",
            meaning: "вернувшийся",
            trans: "[хтаа]",
            tip: "При стяжении суффикса «-ай» гласный становится долгим: [хтаа].",
            choices: [
                { text: "[хтаа]", correct: true },
                { text: "[хтай]", correct: false },
                { text: "[хти]", correct: false }
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
            tip: "Глагольное окончание прошедшего времени «-ай»» на «Сочетание гласного с суффиксом прошедшего времени «-й» (-ай) стягивается в долгий [аа].",
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
            tip: "Глагольное окончание прошедшего времени «-ай»» на «Сочетание гласного с суффиксом прошедшего времени «-й» (-ай) стягивается в долгий [аа].",
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
    ]
};

// Expose globally for browser and Node.js test environment
if (typeof window !== 'undefined') {
    window.READING_DATA = READING_DATA;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = READING_DATA;
}
