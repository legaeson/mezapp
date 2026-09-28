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
        letters: {
            title: 'Гласные и согласные',
            subtitle: 'Главные правила произношения и чтение букв',
            rules: [
                {
                    title: '5 гласных фонем',
                    body: 'в лезгинском языке всего 5 гласных фонем: <span class="font-bold text-emerald-600 dark:text-emerald-400">/a/, /e/ (э), /i/ (и), /u/, /y/ (уь)</span>. Буквы <strong>О</strong> и <strong>Ы</strong> встречаются исключительно в русских заимствованиях. Буква <strong>«Уь»</strong> передаёт передний огубленный гласный <span class="font-bold text-emerald-600 dark:text-emerald-400">[y]</span> (как немецкое <em>ü</em>).'
                },
                {
                    title: 'Чтение буквы «Я»',
                    body: 'в начале слова и после гласных обозначает два звука: <span class="font-bold text-emerald-600 dark:text-emerald-400">[j] + [a] ➔ [ja]</span>. После согласных обозначает широкий гласный <span class="font-bold text-emerald-600 dark:text-emerald-400">[æ]</span>, при этом согласный остаётся твёрдым.'
                },
                {
                    title: 'Чтение буквы «Е»',
                    body: 'в начале слова и после гласных обозначает два звука: <span class="font-bold text-emerald-600 dark:text-emerald-400">[j] + [e] ➔ [je]</span>. После согласных обозначает чистый звук <span class="font-bold text-emerald-600 dark:text-emerald-400">[e]</span> без смягчения согласного.'
                }
            ]
        },
        labialization: {
            title: 'Лабиализация',
            subtitle: 'Огубление согласных буквой «В» и правила чтения',
            rules: [
                {
                    title: '1. Лабиализованный звук [ɔ]',
                    body: 'сочетание согласного с «ва» в корне и суффиксах образует огубленный гласный <span class="font-bold text-emerald-600 dark:text-emerald-400">[ɔ]</span>: <em>кӀвал</em> [kʼɔl] (дом), <em>хва</em> [χɔ] (сын), <em>къван</em> [qːɔn] (камень).'
                },
                {
                    title: '2. Слова на «-вар» (-war)',
                    body: 'слово, заканчивающееся на <strong>-вар</strong>, произносится как сочетание <strong>war</strong> (это не дифтонг, буква «в» звучит как звук [w] / [u], читается почти так же, как пишется: например, <em>твар</em> как <em>t-u-a-r</em>): <em>твар</em> [tʰwɑr] (зёрнышко), <em>тӀвар</em> [tʼwɑr] (имя), <em>ахвар</em> [aˈχwɑr] (сон).'
                },
                {
                    title: '3. Лабиализованный звук [œ]',
                    body: 'сочетание согласного с «ве» образует передний огубленный гласный <span class="font-bold text-emerald-600 dark:text-emerald-400">[œ]</span>: <em>звер</em> [zœr] (кипение), <em>хъвер</em> [qʰœr] (улыбка), <em>кьвед</em> [qʼœd] (два).'
                }
            ]
        },
        nasalization: {
            title: 'Назализация',
            subtitle: 'Носовое звучание гласных перед буквой «Н»',
            rules: [
                {
                    title: 'Носовой призвук в конце слова',
                    body: 'конечный звук <strong>«-Н»</strong> (на конце слова и перед согласными) ослабляется, а предшествующий гласный получает отчётливый носовой тембр: <em>зун</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[zũ]</span>, <em>вун</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[wũ]</span>, <em>ван</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[wã]</span>.'
                },
                {
                    title: 'В заимствованных словах',
                    body: 'это же правило последовательно действует и в заимствованиях: <em>инсан</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[ĩsan] / [ĩsã]</span>, <em>винт</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[vĩt] / [wĩt]</span>.'
                },
                {
                    title: 'Обозначение в транскрипции',
                    body: 'носовой призвук обозначается диакритической тильдой над гласным символом: <span class="font-bold text-emerald-600 dark:text-emerald-400">[ ̃ ]</span>.'
                }
            ]
        },
        elision: {
            title: 'Ударение и выпадение гласных',
            subtitle: 'Правила ударения и сокращения гласных в словах',
            rules: [
                {
                    title: 'Правило ударения',
                    body: 'силовое ударение обычно падает на <strong>второй слог от начала</strong> слова: <em>къва́лар</em> (осадки) — <em>къвала́р</em> (бока); <em>къа́лун</em> (шуметь) — <em>къалу́н</em> (показывать).'
                },
                {
                    title: 'Выпадение гласных (редукция)',
                    body: 'в беглой речи узкие гласные [i, u, y] ослабляются: <em>кита́б</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[kʰtab]</span>, <em>туху́н</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[txun]</span>. Во множественном числе: <em>кар</em> ➔ <em>крар</em>, <em>кас</em> ➔ <em>ксар</em>.'
                },
                {
                    title: 'Стяжение окончаний «-ай / -яй»',
                    body: 'окончания сливаются в долгие гласные: <em>авай</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[awaː]</span>, <em>фенай</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[fenaː]</span>, <em>рикӀяй</em> ➔ <span class="font-bold text-emerald-600 dark:text-emerald-400">[rikʼæː]</span>.'
                }
            ]
        },
        words: {
            title: 'Увулярные звуки',
            subtitle: 'Глубокие звуки глотки (Къ, Хъ, Кь, Гъ, Х, Гь, Хь, Ъ)',
            rules: [
                {
                    title: 'Увулярные смычные (Къ, Хъ, Кь)',
                    body: '<strong>Къ [q]</strong> — глухой глубокий взрывной без выдоха; <strong>Хъ [qʰ]</strong> — глубокий взрывной с сильным выдохом (например, <span class="font-bold text-emerald-600 dark:text-emerald-400">[qʰsan]</span>); <strong>Кь [qʼ]</strong> — глубокий щелкающий звук.'
                },
                {
                    title: 'Щелевые звуки (Гъ, Х, Гь)',
                    body: '<strong>Гъ [ʁ]</strong> — звонкий щелевой (как французское грассирующее «r»); <strong>Х [χ]</strong> — хриплый глухой звук (как немецкий <em>ach-Laut</em>); <strong>Гь [h]</strong> — чистый легкий выдох (как английское <em>h</em> в <em>house</em>).'
                },
                {
                    title: 'Особые звуки (Хь, Ъ)',
                    body: '<strong>Хь [ç / x]</strong>: перед Е или И читается мягко (<em>хьел</em> — стрела), перед другими гласными — твёрдо; <strong>Ъ [ʔ]</strong>: гортанная пауза (как в слове <em>ваъ</em> — нет).'
                }
            ]
        }
    },

    // ------------------------------------------------------------------------
    // 2. ПОЛНЫЙ БАНК ВОПРОСОВ (115 заданий)
    // ------------------------------------------------------------------------
    questions: [
        {
                    id: 1,
                    modeId: 'letters',
                    ruleId: 'ya_double',
                    questionText: 'Какая транскрипция передаёт правильное звучание?',
                    displayWordHtml: 'яр',
                    rawWord: 'яр',
                    meaning: 'заря; возлюбленный / возлюбленная',
                    trans: '[jar]',
                    tip: 'В абсолютном начале слова буква «Я» читается как сочетание двух звуков [j] + [a] ➔ [jar].',
                    choices: [
                        { text: '[jar]', correct: true },
                        { text: '[jær]', correct: false },
                        { text: '[ar]', correct: false }
                    ]
                },
                {
                    id: 2,
                    modeId: 'letters',
                    ruleId: 'ya_double',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'бязи',
                    rawWord: 'бязи',
                    meaning: 'некоторый, иной',
                    trans: '[bæzi]',
                    tip: 'После согласного буква «Я» читается как широкий гласный [æ], при этом согласный остаётся твёрдым!',
                    choices: [
                        { text: '[bæzi]', correct: true },
                        { text: '[bʲazi]', correct: false },
                        { text: '[bazi]', correct: false }
                    ]
                },
                {
                    id: 3,
                    modeId: 'letters',
                    ruleId: 'ya_double',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'сят',
                    rawWord: 'сят',
                    meaning: 'час, часы',
                    trans: '[sæt]',
                    tip: '«Я» после согласных обозначает звук [æ]. Никакого смягчения согласного «с» быть не должно.',
                    choices: [
                        { text: '[sæt]', correct: true },
                        { text: '[sʲat]', correct: false },
                        { text: '[sat]', correct: false }
                    ]
                },
                {
                    id: 4,
                    modeId: 'letters',
                    ruleId: 'ya_double',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'няни',
                    rawWord: 'няни',
                    meaning: 'вечер',
                    trans: '[næni]',
                    tip: '«Н» произносится твёрдо, буква «я» даёт гласный [æ]: [næni].',
                    choices: [
                        { text: '[næni]', correct: true },
                        { text: '[nʲanʲi]', correct: false },
                        { text: '[nani]', correct: false }
                    ]
                },
                {
                    id: 5,
                    modeId: 'letters',
                    ruleId: 'e_double',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'еке',
                    rawWord: 'еке',
                    meaning: 'большой, крупный',
                    trans: '[jeke]',
                    tip: 'В начале слова буква «Е» обязательно йотируется: [j] + [e] ➔ [jeke].',
                    choices: [
                        { text: '[jeke]', correct: true },
                        { text: '[eke]', correct: false },
                        { text: '[jike]', correct: false }
                    ]
                },
                {
                    id: 6,
                    modeId: 'letters',
                    ruleId: 'e_double',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'ем',
                    rawWord: 'ем',
                    meaning: 'корм',
                    trans: '[jem]',
                    tip: 'В начале слова «Е» читается йотированно: [jem].',
                    choices: [
                        { text: '[jem]', correct: true },
                        { text: '[em]', correct: false },
                        { text: '[jæm]', correct: false }
                    ]
                },
                {
                    id: 7,
                    modeId: 'letters',
                    ruleId: 'e_double',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'мез',
                    rawWord: 'мез',
                    meaning: 'язык — анатомический орган',
                    trans: '[mez]',
                    tip: 'После согласного «Е» звучит как чистый монофтонг [e], не смягчая предшествующий согласный [mez].',
                    choices: [
                        { text: '[mez]', correct: true },
                        { text: '[mʲez]', correct: false },
                        { text: '[miz]', correct: false }
                    ]
                },
                {
                    id: 8,
                    modeId: 'letters',
                    ruleId: 'e_double',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'деве',
                    rawWord: 'деве',
                    meaning: 'верблюд',
                    trans: '[dewe]',
                    tip: 'Избегайте русского акцента: согласные «д» и «в» перед «е» остаются твёрдыми [dewe].',
                    choices: [
                        { text: '[dewe]', correct: true },
                        { text: '[dʲevʲe]', correct: false },
                        { text: '[dævæ]', correct: false }
                    ]
                },
                {
                    id: 9,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'уьмуьр',
                    rawWord: 'уьмуьр',
                    meaning: 'жизнь',
                    trans: '[ymyr]',
                    tip: 'Буква «Уь» передаёт передний огубленный гласный [y]: [ymyr].',
                    choices: [
                        { text: '[ymyr]', correct: true },
                        { text: '[umur]', correct: false },
                        { text: '[imir]', correct: false }
                    ]
                },
                {
                    id: 10,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'куьче',
                    rawWord: 'куьче',
                    meaning: 'улица',
                    trans: '[kytʃe]',
                    tip: 'Гласный «Уь» читается как огубленный [y]: [kytʃe].',
                    choices: [
                        { text: '[kytʃe]', correct: true },
                        { text: '[kutʃe]', correct: false },
                        { text: '[kitʃe]', correct: false }
                    ]
                },
                {
                    id: 11,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'Какой звук вы услышали?',
                    trans: '[y]',
                    audioFile: 'audio/alphabet/уь.mp3',
                    tip: 'Вы услышали огубленный гласный переднего ряда [y], обозначаемый буквой «Уь».',
                    choices: [
                        { text: 'Буква «уь» [y]', correct: true },
                        { text: 'Буква «а»', correct: false },
                        { text: 'Буква «е»', correct: false }
                    ]
                },
                {
                    id: 12,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'Какой звук вы услышали?',
                    trans: '[ja]',
                    audioFile: 'audio/alphabet/я.mp3',
                    tip: 'В изолированном звучании и в начале слова «Я» звучит как дифтонг [ja].',
                    choices: [
                        { text: 'Буква «я» [ja]', correct: true },
                        { text: 'Буква «а»', correct: false },
                        { text: 'Буква «е»', correct: false }
                    ]
                },
                {
                    id: 13,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'Какой звук вы услышали?',
                    trans: '[je]',
                    audioFile: 'audio/alphabet/е.mp3',
                    tip: 'В изолированном звучании и в начале слова «Е» звучит как йотированный [je].',
                    choices: [
                        { text: 'Буква «е» [je]', correct: true },
                        { text: 'Буква «а»', correct: false },
                        { text: 'Буква «и»', correct: false }
                    ]
                },
                {
                    id: 14,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'Какой звук вы услышали?',
                    trans: '[a]',
                    audioFile: 'audio/alphabet/а.mp3',
                    tip: 'Вы услышали чистый открытый гласный [a].',
                    choices: [
                        { text: 'Буква «а» [a]', correct: true },
                        { text: 'Буква «е»', correct: false },
                        { text: 'Буква «и»', correct: false }
                    ]
                },
                {
                    id: 15,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'Какой звук вы услышали?',
                    trans: '[u]',
                    audioFile: 'audio/alphabet/у.mp3',
                    tip: 'Вы услышали закрытый задний огубленный гласный [u].',
                    choices: [
                        { text: 'Буква «у» [u]', correct: true },
                        { text: 'Буква «а»', correct: false },
                        { text: 'Буква «е»', correct: false }
                    ]
                },
                {
                    id: 16,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'Какой звук вы услышали?',
                    trans: '[i]',
                    audioFile: 'audio/alphabet/и.mp3',
                    tip: 'Вы услышали закрытый неогубленный гласный переднего ряда [i].',
                    choices: [
                        { text: 'Буква «и» [i]', correct: true },
                        { text: 'Буква «а»', correct: false },
                        { text: 'Буква «е»', correct: false }
                    ]
                },
                {
                    id: 17,
                    modeId: 'letters',
                    ruleId: 'letters_ejectives',
                    questionText: 'Какой звук вы услышали?',
                    trans: '[kʼ]',
                    audioFile: 'audio/alphabet/к1.mp3',
                    tip: 'Вы услышали смычно-гортанный абруптивный звук [kʼ].',
                    choices: [
                        { text: 'Буква «кӀ» [kʼ]', correct: true },
                        { text: 'Буква «а»', correct: false },
                        { text: 'Буква «е»', correct: false }
                    ]
                },
                {
                    id: 18,
                    modeId: 'letters',
                    ruleId: 'letters_ejectives',
                    questionText: 'Какой звук вы услышали?',
                    trans: '[qʼ]',
                    audioFile: 'audio/alphabet/кь.mp3',
                    tip: 'Вы услышали глубокий увулярный абруптивный звук [qʼ].',
                    choices: [
                        { text: 'Буква «кь» [qʼ]', correct: true },
                        { text: 'Буква «а»', correct: false },
                        { text: 'Буква «е»', correct: false }
                    ]
                },
                {
                    id: 19,
                    modeId: 'letters',
                    ruleId: 'letters_ejectives',
                    questionText: 'Какой звук вы услышали?',
                    trans: '[tʼ]',
                    audioFile: 'audio/alphabet/т1.mp3',
                    tip: 'Вы услышали зубной взрывной смычно-гортанный (абруптив) [tʼ].',
                    choices: [
                        { text: 'Буква «тӀ» [tʼ]', correct: true },
                        { text: 'Буква «а»', correct: false },
                        { text: 'Буква «е»', correct: false }
                    ]
                },
                {
                    id: 20,
                    modeId: 'letters',
                    ruleId: 'letters_ejectives',
                    questionText: 'Какой звук вы услышали?',
                    trans: '[tʃʼ]',
                    audioFile: 'audio/alphabet/ч1.mp3',
                    tip: 'Вы услышали аффрикату смычно-гортанного типа [tʃʼ].',
                    choices: [
                        { text: 'Буква «чӀ» [tʃʼ]', correct: true },
                        { text: 'Буква «а»', correct: false },
                        { text: 'Буква «е»', correct: false }
                    ]
                },
                {
                    id: 21,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'Сколько исконных гласных фонем существует в лезгинском языке?',
                    trans: '[a, e, i, u, y]',
                    tip: 'В лезгинском языке ровно 5 гласных фонем: /a/, /e/, /i/, /u/, /y/ (уь). Гласные «о» и «ы» встречаются исключительно в русских заимствованиях.',
                    choices: [
                        { text: '5 гласных фонем', correct: true },
                        { text: '6 гласных фонем', correct: false },
                        { text: '9 гласных фонем', correct: false }
                    ]
                },
                {
                    id: 22,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'В каких словах лезгинского языка встречаются гласные буквы «О» и «Ы»?',
                    trans: '[o, ɨ]',
                    tip: 'В исконной лексике звуков [о] и [ы] нет. Они используются только для записи заимствований из русского языка.',
                    choices: [
                        { text: 'Исключительно в русских заимствованиях', correct: true },
                        { text: 'В начале любого исконного слова', correct: false },
                        { text: 'После увулярных согласных', correct: false }
                    ]
                },
                {
                    id: 23,
                    modeId: 'letters',
                    ruleId: 'ya_double',
                    questionText: 'Смягчаются ли согласные звуки в лезгинском языке перед буквами Е, И, Я?',
                    trans: '[tʰwerdi]',
                    tip: 'Категорическое правило лезгинской орфоэпии: согласные перед гласными переднего ряда НЕ смягчаются. Говорить [mʲez] или [dʲeve] — грубая ошибка.',
                    choices: [
                        { text: 'Нет, согласные всегда остаются твёрдыми', correct: true },
                        { text: 'Да, согласные смягчаются так же, как в русском', correct: false },
                        { text: 'Смягчаются только свистящие звуки С и З', correct: false }
                    ]
                },
                {
                    id: 24,
                    modeId: 'letters',
                    ruleId: 'vowels_lezgi',
                    questionText: 'Какой согласный звук является единственным исключением и звучит мягко перед гласными переднего ряда?',
                    trans: '[lʲ]',
                    tip: 'Сонант «Л» перед гласными переднего ряда (е, и, уь, я) палатализуется и звучит мягко: эллер [elʲːer], лишан [lʲiʃan].',
                    choices: [
                        { text: 'Согласный «Л» (звучит мягко как «ль»)', correct: true },
                        { text: 'Согласный «М»', correct: false },
                        { text: 'Согласный «Р»', correct: false }
                    ]
                },
                {
                    id: 25,
                    modeId: 'letters',
                    ruleId: 'ya_double',
                    questionText: 'В чём фонетическое различие чтения буквы «Я» в начале слова («яр») и после согласного («бязи»)?',
                    trans: '[jar] vs [bæzi]',
                    tip: 'В начале слова «я» обозначает дифтонг [ja], а после согласного — широкий монофтонг [æ] при твёрдом согласном.',
                    choices: [
                        { text: 'В начале слова звучит как [ja], а после согласного как [æ]', correct: true },
                        { text: 'В обоих случаях звучит одинаково как чистый гласный [a]', correct: false },
                        { text: 'После согласного согласный обязательно смягчается', correct: false }
                    ]
                },
                {
                    id: 26,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: 'Какая транскрипция передаёт правильное звучание слова «звал» (кручение)?',
                    displayWordHtml: 'звал',
                    rawWord: 'звал',
                    meaning: 'кручение',
                    trans: '[zɔl]',
                    tip: 'Сочетание согласного с «ва» образует лабиализованный гласный [ɔ]: [zɔl].',
                    choices: [
                        { text: '[zɔl]', correct: true },
                        { text: '[zval]', correct: false },
                        { text: '[zal]', correct: false }
                    ]
                },
                {
                    id: 27,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: 'Какая транскрипция верна для слова «свас» (невеста)?',
                    displayWordHtml: 'свас',
                    rawWord: 'свас',
                    meaning: 'невеста',
                    trans: '[sɔs]',
                    tip: 'Сочетание «сва-» произносится как лабиализованный гласный [ɔ]: [sɔs].',
                    choices: [
                        { text: '[sɔs]', correct: true },
                        { text: '[svas]', correct: false },
                        { text: '[sas]', correct: false }
                    ]
                },
                {
                    id: 28,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: 'Какая транскрипция верна для слова «чӀугвада» (потянет)?',
                    displayWordHtml: 'чӀугвада',
                    rawWord: 'чӀугвада',
                    meaning: 'потянет',
                    trans: '[t͡ʃʼuˈɡɔda]',
                    tip: 'Сочетание «-гва-» произносится как лабиализованный гласный [ɔ]: [t͡ʃʼuˈɡɔda].',
                    choices: [
                        { text: '[t͡ʃʼuˈɡɔda]', correct: true },
                        { text: '[t͡ʃʼuˈɡvada]', correct: false },
                        { text: '[t͡ʃʼuˈɡada]', correct: false }
                    ]
                },
                {
                    id: 29,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: 'Какая транскрипция верна для слова «аквада» (увидит)?',
                    displayWordHtml: 'аквада',
                    rawWord: 'аквада',
                    meaning: 'увидит',
                    trans: '[aˈkʰɔda]',
                    tip: 'Сочетание «-ква-» произносится как лабиализованный гласный [ɔ]: [aˈkʰɔda].',
                    choices: [
                        { text: '[aˈkʰɔda]', correct: true },
                        { text: '[aˈkʰvada]', correct: false },
                        { text: '[aˈkʰada]', correct: false }
                    ]
                },
                {
                    id: 30,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: 'Какая транскрипция верна для слова «тӀвар» (имя)?',
                    displayWordHtml: 'тӀвар',
                    rawWord: 'тӀвар',
                    meaning: 'имя',
                    trans: '[tʼwɑr]',
                    listenAudio: 'audio/reading/t1war.mp3',
                    tip: 'Слово, заканчивающееся на -war, произносится как сочетание war: [tʼwɑr] (читается почти так же, как пишется: t-u-a-r).',
                    choices: [
                        { text: '[tʼwɑr]', correct: true },
                        { text: '[tʼvar]', correct: false },
                        { text: '[tʼar]', correct: false }
                    ]
                },
                {
                    id: 31,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: 'Какая транскрипция верна для слова «ахвар» (сон)?',
                    displayWordHtml: 'ахвар',
                    rawWord: 'ахвар',
                    meaning: 'сон',
                    trans: '[aˈχwɑr]',
                    listenAudio: 'audio/reading/ahwar.mp3',
                    tip: 'Слово, заканчивающееся на -war, произносится как сочетание war: [aˈχwɑr].',
                    choices: [
                        { text: '[aˈχwɑr]', correct: true },
                        { text: '[aˈχvar]', correct: false },
                        { text: '[aˈχar]', correct: false }
                    ]
                },
                {
                    id: 32,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: 'Какая транскрипция верна для слова «цвар» (моча)?',
                    displayWordHtml: 'цвар',
                    rawWord: 'цвар',
                    meaning: 'моча',
                    trans: '[t͡sʰwɑr]',
                    tip: 'Слово, заканчивающееся на -war, произносится как сочетание war: [t͡sʰwɑr].',
                    choices: [
                        { text: '[t͡sʰwɑr]', correct: true },
                        { text: '[t͡sʰvar]', correct: false },
                        { text: '[t͡sʰar]', correct: false }
                    ]
                },
                {
                    id: 33,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: 'Какая транскрипция верна для слова «звер» (кипение)?',
                    displayWordHtml: 'звер',
                    rawWord: 'звер',
                    meaning: 'кипение',
                    trans: '[zœr]',
                    listenAudio: 'audio/reading/zver.mp3',
                    tip: 'Сочетание «-ве-» произносится как лабиализованный гласный [œ]: [zœr].',
                    choices: [
                        { text: '[zœr]', correct: true },
                        { text: '[zver]', correct: false },
                        { text: '[zir]', correct: false }
                    ]
                },
                {
                    id: 34,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: 'Какая транскрипция верна для слова «цӀвел» (висок)?',
                    displayWordHtml: 'цӀвел',
                    rawWord: 'цӀвел',
                    meaning: 'висок',
                    trans: '[t͡sʼœl]',
                    tip: 'Сочетание «цӀве-» образует лабиализованный гласный [œ]: [t͡sʼœl].',
                    choices: [
                        { text: '[t͡sʼœl]', correct: true },
                        { text: '[t͡sʼvel]', correct: false },
                        { text: '[t͡sʼel]', correct: false }
                    ]
                },
                {
                    id: 35,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: 'Какая транскрипция верна для слова «хъвер» (улыбка)?',
                    displayWordHtml: 'хъвер',
                    rawWord: 'хъвер',
                    meaning: 'улыбка',
                    trans: '[qʰœr]',
                    listenAudio: 'audio/reading/qhver.mp3',
                    tip: 'Сочетание «хъве-» образует лабиализованный гласный [œ]: [qʰœr].',
                    choices: [
                        { text: '[qʰœr]', correct: true },
                        { text: '[qʰver]', correct: false },
                        { text: '[qʰer]', correct: false }
                    ]
                },
                {
                    id: 36,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: 'Какая транскрипция верна для слова «хвеш» (радость)?',
                    displayWordHtml: 'хвеш',
                    rawWord: 'хвеш',
                    meaning: 'радость',
                    trans: '[χœʃ]',
                    tip: 'Сочетание «хве-» произносится как лабиализованный гласный [œ]: [χœʃ].',
                    choices: [
                        { text: '[χœʃ]', correct: true },
                        { text: '[χveʃ]', correct: false },
                        { text: '[χuʃ]', correct: false }
                    ]
                },
                {
                    id: 37,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: 'Какая транскрипция верна для слова «тӀветӀ» (муха)?',
                    displayWordHtml: 'тӀветӀ',
                    rawWord: 'тӀветӀ',
                    meaning: 'муха',
                    trans: '[tʼœtʼ]',
                    listenAudio: 'audio/reading/t1vet1.mp3',
                    tip: 'Сочетание «тӀве-» образует лабиализованный гласный [œ]: [tʼœtʼ].',
                    choices: [
                        { text: '[tʼœtʼ]', correct: true },
                        { text: '[tʼvetʼ]', correct: false },
                        { text: '[tʼetʼ]', correct: false }
                    ]
                },
                {
                    id: 38,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[kʼɔl]',
                    audioFile: 'audio/reading/kval.mp3',
                    tip: 'Вы услышали слово «кӀвал» (дом). Сочетание «кӀва-» произносится как лабиализованный гласный [kʼɔl].',
                    choices: [
                        { text: 'кӀвал', correct: true },
                        { text: 'кӀал', correct: false },
                        { text: 'кал', correct: false }
                    ]
                },
                {
                    id: 39,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[sɔs]',
                    audioFile: 'audio/reading/svas.mp3',
                    tip: 'Вы услышали слово «свас» (невеста). Сочетание «сва-» произносится как [sɔs].',
                    choices: [
                        { text: 'свас', correct: true },
                        { text: 'сас', correct: false },
                        { text: 'сос', correct: false }
                    ]
                },
                {
                    id: 40,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[qɔn]',
                    audioFile: 'audio/reading/qvan.mp3',
                    tip: 'Вы услышали слово «къван» (камень). Сочетание «къва-» произносится как [qɔn].',
                    choices: [
                        { text: 'къван', correct: true },
                        { text: 'къан', correct: false },
                        { text: 'кан', correct: false }
                    ]
                },
                {
                    id: 41,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[qʼœd]',
                    audioFile: 'audio/reading/qved.mp3',
                    tip: 'Вы услышали числительное «кьвед» (два). Сочетание «кьве-» произносится с лабиализованным гласным [œ]: [qʼœd].',
                    choices: [
                        { text: 'кьвед', correct: true },
                        { text: 'кед', correct: false },
                        { text: 'къед', correct: false }
                    ]
                },
                {
                    id: 42,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[ʁœtʃʼi]',
                    audioFile: 'audio/reading/gvechi.mp3',
                    tip: 'Вы услышали слово «гъвечӀи» (маленький). «Гъве-» произносится как [ʁœtʃʼi].',
                    choices: [
                        { text: 'гъвечӀи', correct: true },
                        { text: 'гечи', correct: false },
                        { text: 'гъечи', correct: false }
                    ]
                },
                {
                    id: 43,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[tʼɔl]',
                    audioFile: 'audio/reading/tval.mp3',
                    tip: 'Вы услышали слово «тӀвал» (палка, прут). Произносится с лабиализованным гласным [tʼɔl], что отличает его от «тӀал» (боль).',
                    choices: [
                        { text: 'тӀвал', correct: true },
                        { text: 'тӀал', correct: false },
                        { text: 'тал', correct: false }
                    ]
                },
                {
                    id: 44,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[t͡sʰɔl]',
                    audioFile: 'audio/reading/cval.mp3',
                    tip: 'Вы услышали слово «цвал» (стёжка). Произносится как [t͡sʰɔl], что отличает его от слов «сал» (сад) и «цал» (стена).',
                    choices: [
                        { text: 'цвал', correct: true },
                        { text: 'сал', correct: false },
                        { text: 'цал', correct: false }
                    ]
                },
                {
                    id: 45,
                    modeId: 'labialization',
                    ruleId: 'va_to_o',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[χɔ]',
                    audioFile: 'audio/reading/hva.mp3',
                    tip: 'Вы услышали слово «хва» (сын). В слове звучит лабиализованный гласный [χɔ].',
                    choices: [
                        { text: 'хва', correct: true },
                        { text: 'ха', correct: false },
                        { text: 'хо', correct: false }
                    ]
                },
                {
                    id: 46,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[zũ]',
                    audioFile: 'audio/reading/zun.mp3',
                    tip: 'Вы услышали местоимение «зун» (я). Конечная буква «н» назализует предшествующий гласный: [zũ].',
                    choices: [
                        { text: 'зун', correct: true },
                        { text: 'зу', correct: false },
                        { text: 'зо', correct: false }
                    ]
                },
                {
                    id: 47,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[wũ]',
                    audioFile: 'audio/reading/vun.mp3',
                    tip: 'Вы услышали местоимение «вун» (ты). Гласный звучит с носовым тембром: [wũ].',
                    choices: [
                        { text: 'вун', correct: true },
                        { text: 'ву', correct: false },
                        { text: 'ви', correct: false }
                    ]
                },
                {
                    id: 48,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[wã]',
                    audioFile: 'audio/reading/van.mp3',
                    tip: 'Вы услышали слово «ван» (голос, звук). Гласный «а» звучит с носовой назализацией: [wã].',
                    choices: [
                        { text: 'ван', correct: true },
                        { text: 'ва', correct: false },
                        { text: 'во', correct: false }
                    ]
                },
                {
                    id: 49,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[kʼã]',
                    audioFile: 'audio/reading/kan.mp3',
                    tip: 'Вы услышали слово «кӀан» (дно, основание). Абруптивный [kʼ] в сочетании с назализацией гласного: [kʼã].',
                    choices: [
                        { text: 'кӀан', correct: true },
                        { text: 'кӀа', correct: false },
                        { text: 'кан', correct: false }
                    ]
                },
                {
                    id: 50,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[tʃĩ]',
                    audioFile: 'audio/reading/chin.mp3',
                    tip: 'Вы услышали слово «чин» (лицо). Гласный «и» назализуется на конце слова: [tʃĩ].',
                    choices: [
                        { text: 'чин', correct: true },
                        { text: 'чи', correct: false },
                        { text: 'чен', correct: false }
                    ]
                },
                {
                    id: 51,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[tsʼĩ]',
                    audioFile: 'audio/reading/cin.mp3',
                    tip: 'Вы услышали слово «цӀин» (в этом году / огонь). Конечный «н» назализует гласный: [tsʼĩ].',
                    choices: [
                        { text: 'цӀин', correct: true },
                        { text: 'цӀи', correct: false },
                        { text: 'цин', correct: false }
                    ]
                },
                {
                    id: 52,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[ĩsã]',
                    audioFile: 'audio/reading/insan.mp3',
                    tip: 'Вы услышали слово «инсан» (человек). В заимствованных словах на конце слога «н» также даёт назализацию: [ĩsã].',
                    choices: [
                        { text: 'инсан', correct: true },
                        { text: 'исан', correct: false },
                        { text: 'исен', correct: false }
                    ]
                },
                {
                    id: 53,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[qʼʷã]',
                    audioFile: 'audio/reading/qvan_nasal.mp3',
                    tip: 'Вы услышали слово «кьван» (столько, сколько). Увулярный абруптив с огублением и назализацией гласного: [qʼʷã].',
                    choices: [
                        { text: 'кьван', correct: true },
                        { text: 'кьва', correct: false },
                        { text: 'кван', correct: false }
                    ]
                },
                {
                    id: 54,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какая транскрипция передаёт правильное звучание слова?',
                    displayWordHtml: 'зун',
                    rawWord: 'зун',
                    meaning: 'я — местоимение',
                    trans: '[zũ]',
                    listenAudio: 'audio/reading/zun.mp3',
                    tip: 'Буква «н» на конце слова ослабляется, гласный произносится в нос: [zũ].',
                    choices: [
                        { text: '[zũ]', correct: true },
                        { text: '[zun]', correct: false },
                        { text: '[zen]', correct: false }
                    ]
                },
                {
                    id: 55,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'вун',
                    rawWord: 'вун',
                    meaning: 'ты — местоимение',
                    trans: '[wũ]',
                    listenAudio: 'audio/reading/vun.mp3',
                    tip: 'Гласный звук назализуется перед конечным сонантом: [wũ].',
                    choices: [
                        { text: '[wũ]', correct: true },
                        { text: '[vun]', correct: false },
                        { text: '[win]', correct: false }
                    ]
                },
                {
                    id: 56,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'ван',
                    rawWord: 'ван',
                    meaning: 'голос, звук, шум',
                    trans: '[wã]',
                    listenAudio: 'audio/reading/van.mp3',
                    tip: 'В слове «ван» конечный «н» редуцируется в назализацию гласного [a]: [wã].',
                    choices: [
                        { text: '[wã]', correct: true },
                        { text: '[van]', correct: false },
                        { text: '[wen]', correct: false }
                    ]
                },
                {
                    id: 57,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'чин',
                    rawWord: 'чин',
                    meaning: 'лицо',
                    trans: '[tʃĩ]',
                    listenAudio: 'audio/reading/chin.mp3',
                    tip: 'Конечный сонант «н» передаёт носовой гласный: [tʃĩ].',
                    choices: [
                        { text: '[tʃĩ]', correct: true },
                        { text: '[tʃin]', correct: false },
                        { text: '[tʃen]', correct: false }
                    ]
                },
                {
                    id: 58,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'кӀан',
                    rawWord: 'кӀан',
                    meaning: 'дно, основание',
                    trans: '[kʼã]',
                    listenAudio: 'audio/reading/kan.mp3',
                    tip: 'Абруптив [kʼ] в сочетании с назализованным гласным: [kʼã].',
                    choices: [
                        { text: '[kʼã]', correct: true },
                        { text: '[kʼan]', correct: false },
                        { text: '[kan]', correct: false }
                    ]
                },
                {
                    id: 59,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'кьван',
                    rawWord: 'кьван',
                    meaning: 'столько, сколько',
                    trans: '[qʼʷã]',
                    listenAudio: 'audio/reading/qvan_nasal.mp3',
                    tip: 'Слово «кьван» произносится с огублением и носовым гласным: [qʼʷã].',
                    choices: [
                        { text: '[qʼʷã]', correct: true },
                        { text: '[qvan]', correct: false },
                        { text: '[kan]', correct: false }
                    ]
                },
                {
                    id: 60,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'инсан',
                    rawWord: 'инсан',
                    meaning: 'человек',
                    trans: '[ĩsã]',
                    listenAudio: 'audio/reading/insan.mp3',
                    tip: 'В слове «инсан» назализация возникает на обоих слогах: [ĩsã] / [ĩsan].',
                    choices: [
                        { text: '[ĩsã]', correct: true },
                        { text: '[insan]', correct: false },
                        { text: '[isan]', correct: false }
                    ]
                },
                {
                    id: 61,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'залан',
                    rawWord: 'залан',
                    meaning: 'залан — усталость',
                    trans: '[zalã]',
                    tip: 'Перед смычным звуком «т» сонант «н» ослабляется, гласный назализуется: [zalã].',
                    choices: [
                        { text: '[zalã]', correct: true },
                        { text: '[zalan]', correct: false },
                        { text: '[zalt]', correct: false }
                    ]
                },
                {
                    id: 62,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'бенд',
                    rawWord: 'бенд',
                    meaning: 'куплет стиха',
                    trans: '[bẽd]',
                    tip: 'Сонант «н» перед «д» переходит в назализацию гласного: [bẽd].',
                    choices: [
                        { text: '[bẽd]', correct: true },
                        { text: '[bend]', correct: false },
                        { text: '[bad]', correct: false }
                    ]
                },
                {
                    id: 63,
                    modeId: 'nasalization',
                    ruleId: 'nasal_n',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'патан',
                    rawWord: 'патан',
                    meaning: 'чужой; стороны',
                    trans: '[patã]',
                    tip: 'Конечный сонант «н» ослабляется, гласный «а» получает носовой призвук: [patã].',
                    choices: [
                        { text: '[patã]', correct: true },
                        { text: '[patan]', correct: false },
                        { text: '[patin]', correct: false }
                    ]
                },
                {
                    id: 66,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'На какой слог от начала слова обычно падает силовое ударение в лезгинских словах?',
                    trans: '[udarenie]',
                    tip: 'В исконных лезгинских словах силовое ударение обычно падает на второй слог от начала слова.',
                    choices: [
                        { text: 'На второй слог от начала слова', correct: true },
                        { text: 'Всегда на самый первый слог', correct: false },
                        { text: 'Всегда на самый последний слог', correct: false }
                    ]
                },
                {
                    id: 67,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Что означает слово «къва́лар» с ударением на первый слог?',
                    displayWordHtml: 'къва́лар',
                    rawWord: 'къва́лар',
                    meaning: 'осадки',
                    trans: '[qʷálar]',
                    tip: 'Ударение смыслоразличительно: къва́лар (на 1-й слог) — осадки (дожди), а къвала́р (на 2-й слог) — бока.',
                    choices: [
                        { text: 'Осадки, дожди', correct: true },
                        { text: 'Бока, стороны', correct: false },
                        { text: 'Камни', correct: false }
                    ]
                },
                {
                    id: 68,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Что означает слово «къалу́н» с ударением на второй слог?',
                    displayWordHtml: 'къалу́н',
                    rawWord: 'къалу́н',
                    meaning: 'показывать',
                    trans: '[qalún]',
                    tip: 'Ударение на второй слог къалу́н означает «показывать», тогда как къа́лун (на 1-й слог) — «шуметь, галдеть».',
                    choices: [
                        { text: 'Показывать', correct: true },
                        { text: 'Шуметь, галдеть', correct: false },
                        { text: 'Покупать', correct: false }
                    ]
                },
                {
                    id: 69,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'В чём смысловое отличие между словами «хъва́дай» и «хъвада́й»?',
                    trans: '[qʰwádaj] vs [qʰwadáj]',
                    tip: 'Ударение на 1-й слог хъва́дай образует причастие «пьющий», а на 2-й слог хъвада́й — форму условного наклонения «выпил бы».',
                    choices: [
                        { text: 'хъва́дай — пьющий, а хъвада́й — выпил бы', correct: true },
                        { text: 'Они означают одно и то же', correct: false },
                        { text: 'хъва́дай — налей, а хъвада́й — напиток', correct: false }
                    ]
                },
                {
                    id: 70,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Как произносится слово «китаб» в беглой живой речи?',
                    displayWordHtml: 'китаб',
                    rawWord: 'китаб',
                    meaning: 'книга',
                    trans: '[kʰtab]',
                    listenAudio: 'audio/reading/kitab.mp3',
                    tip: 'Безударный узкий гласный «и» в первом слоге регулярно выпадает (синкопа): [kʰtab].',
                    choices: [
                        { text: '[kʰtab]', correct: true },
                        { text: '[kʰitæb]', correct: false },
                        { text: '[katb]', correct: false }
                    ]
                },
                {
                    id: 71,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Как произносится слово «тухун» в живом потоке речи?',
                    displayWordHtml: 'тухун',
                    rawWord: 'тухун',
                    meaning: 'уносить, вести',
                    trans: '[txun]',
                    listenAudio: 'audio/reading/tuhun.mp3',
                    tip: 'Безударный гласный «у» выпадает: [txun].',
                    choices: [
                        { text: '[txun]', correct: true },
                        { text: '[toxun]', correct: false },
                        { text: '[txan]', correct: false }
                    ]
                },
                {
                    id: 72,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Как звучит слово «пулун» в быстрой связной речи?',
                    displayWordHtml: 'пулун',
                    rawWord: 'пулун',
                    meaning: 'денег',
                    trans: '[plun]',
                    tip: 'Синкопа первого узкого гласного [u]: [plun].',
                    choices: [
                        { text: '[plun]', correct: true },
                        { text: '[pulun]', correct: false },
                        { text: '[paln]', correct: false }
                    ]
                },
                {
                    id: 73,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Как произносится слово «руфун» в связной речи?',
                    displayWordHtml: 'руфун',
                    rawWord: 'руфун',
                    meaning: 'живот',
                    trans: '[rfun]',
                    tip: 'Узкий гласный «у» в первом безударном слоге выпадает: [rfun].',
                    choices: [
                        { text: '[rfun]', correct: true },
                        { text: '[rufun]', correct: false },
                        { text: '[rafn]', correct: false }
                    ]
                },
                {
                    id: 74,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Какая форма множественного числа образуется от слова «кар» (дело)?',
                    trans: '[krar]',
                    tip: 'При образовании множественного числа коренной гласный синкопируется: кар ➔ крар.',
                    choices: [
                        { text: 'крар', correct: true },
                        { text: 'карар', correct: false },
                        { text: 'карри', correct: false }
                    ]
                },
                {
                    id: 75,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Какая форма множественного числа образуется от слова «кас» (человек)?',
                    trans: '[ksar]',
                    tip: 'Коренной гласный выпадает: кас ➔ ксар.',
                    choices: [
                        { text: 'ксар', correct: true },
                        { text: 'касар', correct: false },
                        { text: 'каслар', correct: false }
                    ]
                },
                {
                    id: 76,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Какая форма множественного числа образуется от слова «тар» (дерево)?',
                    trans: '[trar]',
                    tip: 'Синкопа коренного гласного при образовании множественного числа: тар ➔ трар.',
                    choices: [
                        { text: 'трар', correct: true },
                        { text: 'тарар', correct: false },
                        { text: 'таррар', correct: false }
                    ]
                },
                {
                    id: 77,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Как звучит окончание родительного падежа в естественном потоке речи?',
                    displayWordHtml: 'дидедин гъил',
                    rawWord: 'дидедин гъил',
                    meaning: 'рука матери',
                    trans: '[dided ʁil]',
                    tip: 'Падежный формант -дин перед словами на согласный регулярно усекается до -д: [dided ʁil].',
                    choices: [
                        { text: '[dided ʁil]', correct: true },
                        { text: '[dide ʁil]', correct: false },
                        { text: '[didedi ʁil]', correct: false }
                    ]
                },
                {
                    id: 78,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Как произносится сочетание «бубадин кӀвал» в живой речи?',
                    displayWordHtml: 'бубадин кӀвал',
                    rawWord: 'бубадин кӀвал',
                    meaning: 'дом отца',
                    trans: '[bubad kʼwal]',
                    tip: 'Окончание родительного падежа редуцируется перед согласным: [bubad kʼwal].',
                    choices: [
                        { text: '[bubad kʼwal]', correct: true },
                        { text: '[buba kʼwal]', correct: false },
                        { text: '[bubadi kʼwal]', correct: false }
                    ]
                },
                {
                    id: 79,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: 'В чём фонетическое отличие слова «авай» (был) от «ава» (есть)?',
                    displayWordHtml: 'авай',
                    rawWord: 'авай',
                    meaning: 'был, находился',
                    trans: '[awaː]',
                    listenAudio: 'audio/reading/avay.mp3',
                    tip: 'Сочетание «-ай» стягивается в долгий гласный [awaː], что отличает прошедшее время от настоящего ава [awa].',
                    choices: [
                        { text: 'В слове «авай» гласный на конце долгий: [awaː]', correct: true },
                        { text: 'Они звучат абсолютно одинаково кратким звуком [awa]', correct: false },
                        { text: 'В слове «авай» ударение падает на первый слог', correct: false }
                    ]
                },
                {
                    id: 80,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'фенай',
                    rawWord: 'фенай',
                    meaning: 'пошёл, ушёл',
                    trans: '[fenaː]',
                    listenAudio: 'audio/reading/fenay.mp3',
                    tip: 'При стяжении глагольного окончания «-ай» возникает фонетическая долгота: [fenaː].',
                    choices: [
                        { text: '[fenaː]', correct: true },
                        { text: '[fena]', correct: false },
                        { text: '[feni]', correct: false }
                    ]
                },
                {
                    id: 81,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'атай',
                    rawWord: 'атай',
                    meaning: 'пришедший',
                    trans: '[ataː]',
                    tip: 'Суффикс «-ай» стягивается в долгий гласный: [ataː].',
                    choices: [
                        { text: '[ataː]', correct: true },
                        { text: '[ata]', correct: false },
                        { text: '[ati]', correct: false }
                    ]
                },
                {
                    id: 82,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'рикӀяй',
                    rawWord: 'рикӀяй',
                    meaning: 'из сердца — падеж элатив',
                    trans: '[rikʼæː]',
                    listenAudio: 'audio/reading/rikyay.mp3',
                    tip: 'Падежное окончание «-яй» после согласного стягивается в долгий широкий гласный [rikʼæː].',
                    choices: [
                        { text: '[rikʼæː]', correct: true },
                        { text: '[rikʼjaj]', correct: false },
                        { text: '[rikʼij]', correct: false }
                    ]
                },
                {
                    id: 83,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: 'Какая транскрипция верна?',
                    displayWordHtml: 'виляй',
                    rawWord: 'виляй',
                    meaning: 'из глаза',
                    trans: '[wilæː]',
                    tip: 'Окончание «-яй» стягивается в долгий открытый [æː]: [wilæː].',
                    choices: [
                        { text: '[wilæː]', correct: true },
                        { text: '[wiljaj]', correct: false },
                        { text: '[wili]', correct: false }
                    ]
                },
                {
                    id: 84,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какой согласный обозначает буква «Къ»?',
                    trans: '[q]',
                    tip: '«Къ» обозначает глухой увулярный смычный звук без выдоха (придыхания) [q].',
                    choices: [
                        { text: 'Глухой глубокий смычный звук без выдоха [q]', correct: true },
                        { text: 'Обычный звук [k]', correct: false },
                        { text: 'Щелевой звук [x]', correct: false }
                    ]
                },
                {
                    id: 85,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какой звук обозначает буква «Хъ»?',
                    trans: '[qʰ]',
                    tip: '«Хъ» — это увулярный смычный звук с сильным придыханием (выдохом) [qʰ].',
                    choices: [
                        { text: 'Глубокий смычный звук с сильным выдохом (придыханием) [qʰ]', correct: true },
                        { text: 'Простой русский звук [х]', correct: false },
                        { text: 'Звонкий звук [g]', correct: false }
                    ]
                },
                {
                    id: 86,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какой звук обозначает буква «Кь»?',
                    trans: '[qʼ]',
                    tip: '«Кь» — это увулярный смычно-гортанный абруптив [qʼ] (глубокий щелкающий звук).',
                    choices: [
                        { text: 'Глубокий смычно-гортанный щелкающий абруптив [qʼ]', correct: true },
                        { text: 'Мягкий русский звук [к\']', correct: false },
                        { text: 'Звонкий звук [b]', correct: false }
                    ]
                },
                {
                    id: 87,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция передаёт правильное звучание слова?',
                    displayWordHtml: 'къал',
                    rawWord: 'къал',
                    meaning: 'шум, скандал, ссора',
                    trans: '[qal]',
                    tip: 'Слово «къал» начинается с глухого увулярного взрывного звука [q]: [qal]. Сравните: «кал» [kʰal] (корова).',
                    choices: [
                        { text: '[qal]', correct: true },
                        { text: '[kal]', correct: false },
                        { text: '[kʰal]', correct: false }
                    ]
                },
                {
                    id: 88,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «хар» (град)?',
                    displayWordHtml: 'хар',
                    rawWord: 'хар',
                    meaning: 'град',
                    trans: '[χar]',
                    tip: 'Буква «Х» в лезгинском языке произносится как глубокий увулярный щелевой [χ] (глубже русского [х]).',
                    choices: [
                        { text: '[χar]', correct: true },
                        { text: '[xar]', correct: false },
                        { text: '[qar]', correct: false }
                    ]
                },
                {
                    id: 89,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «гъед» (рыба / звезда)?',
                    displayWordHtml: 'гъед',
                    rawWord: 'гъед',
                    meaning: 'рыба; звезда',
                    trans: '[ʁed]',
                    tip: 'Буква «Гъ» — звонкий увулярный щелевой [ʁ]. Согласный перед «е» остаётся твёрдым: [ʁed].',
                    choices: [
                        { text: '[ʁed]', correct: true },
                        { text: '[gʲed]', correct: false },
                        { text: '[ged]', correct: false }
                    ]
                },
                {
                    id: 90,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая пара слов различается звуками «Къ» [q] и «К» [kʰ]?',
                    trans: '[q] vs [kʰ]',
                    tip: '«Къал» [qal] (шум) и «кал» [kʰal] (корова) — классическая смыслоразличительная пара.',
                    choices: [
                        { text: '«къал» (шум) и «кал» (корова)', correct: true },
                        { text: '«кьил» (голова) и «гъил» (рука)', correct: false },
                        { text: '«яр» (заря) и «вар» (ворота)', correct: false }
                    ]
                },
                {
                    id: 91,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «кьуьл» (танец)?',
                    displayWordHtml: 'кьуьл',
                    rawWord: 'кьуьл',
                    meaning: 'танец',
                    trans: '[qʼyl]',
                    tip: 'Начинается с увулярного абруптива «Кь» [qʼ], за которым следует огубленный гласный переднего ряда «Уь» [y]: [qʼyl].',
                    choices: [
                        { text: '[qʼyl]', correct: true },
                        { text: '[kul]', correct: false },
                        { text: '[qul]', correct: false }
                    ]
                },
                {
                    id: 92,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Как произносится буква «Хь» перед гласными переднего ряда (Е, И)?',
                    trans: '[ç]',
                    tip: 'Перед «е» и «и» буква «Хь» звучит мягко как среднеязычный щелевой [ç] (например, «хьел» [çel] — стрела).',
                    choices: [
                        { text: 'Мягко, как среднеязычный глухой щелевой [ç]', correct: true },
                        { text: 'Твёрдо, как обычный глубокий [χ]', correct: false },
                        { text: 'Как звонкий звук [ʒ]', correct: false }
                    ]
                },
                {
                    id: 93,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая функция у буквы «Ъ» в лезгинских словах?',
                    trans: '[ʔ]',
                    tip: 'Буква «Ъ» передаёт самостоятельный согласный звук — гортанную паузу (смычку) [ʔ] (например, «ваъ» [vaʔ] — нет).',
                    choices: [
                        { text: 'Обозначает самостоятельный согласный — гортанную паузу (смычку) [ʔ]', correct: true },
                        { text: 'Служит только разделительным знаком, как в русском', correct: false },
                        { text: 'Обозначает ударение', correct: false }
                    ]
                },
                {
                    id: 94,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «къуш» (птица)?',
                    displayWordHtml: 'къуш',
                    rawWord: 'къуш',
                    meaning: 'птица',
                    trans: '[quʃ]',
                    tip: 'Буква «Къ» — глухой глубокий смычный [q]: [quʃ].',
                    choices: [
                        { text: '[quʃ]', correct: true },
                        { text: '[kuʃ]', correct: false },
                        { text: '[kʼuʃ]', correct: false }
                    ]
                },
                {
                    id: 95,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция передаёт правильное звучание?',
                    displayWordHtml: 'хъсан',
                    rawWord: 'хъсан',
                    meaning: 'хороший',
                    trans: '[qʰsan]',
                    tip: 'Буква «Хъ» передаёт глубокий взрывной звук с сильным придыханием [qʰ]. Произносить его как простой «х» нельзя.',
                    choices: [
                        { text: '[qʰsan]', correct: true },
                        { text: '[χsan]', correct: false },
                        { text: '[hsan]', correct: false }
                    ]
                },
                {
                    id: 96,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «хъун» (пить)?',
                    displayWordHtml: 'хъун',
                    rawWord: 'хъун',
                    meaning: 'пить',
                    trans: '[qʰun]',
                    tip: 'Смыслоразличительная пара: хъун [qʰun] (пить) начинается со взрывного [qʰ], тогда как хун [χun] (рождаться / ломаться) начинается со щелевого [χ].',
                    choices: [
                        { text: '[qʰun]', correct: true },
                        { text: '[χun]', correct: false },
                        { text: '[kun]', correct: false }
                    ]
                },
                {
                    id: 97,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «кьил» (голова)?',
                    displayWordHtml: 'кьил',
                    rawWord: 'кьил',
                    meaning: 'голова',
                    trans: '[qʼil]',
                    tip: 'Буква «Кь» передаёт глубокий смычно-гортанный абруптив [qʼ].',
                    choices: [
                        { text: '[qʼil]', correct: true },
                        { text: '[kil]', correct: false },
                        { text: '[qil]', correct: false }
                    ]
                },
                {
                    id: 98,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «гъил» (рука)?',
                    displayWordHtml: 'гъил',
                    rawWord: 'гъил',
                    meaning: 'рука',
                    trans: '[ʁil]',
                    tip: 'Буква «Гъ» — звонкий щелевой увулярный звук [ʁ] (подобно французскому грассирующему «r»).',
                    choices: [
                        { text: '[ʁil]', correct: true },
                        { text: '[gil]', correct: false },
                        { text: '[χil]', correct: false }
                    ]
                },
                {
                    id: 99,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «къван» (камень)?',
                    displayWordHtml: 'къван',
                    rawWord: 'къван',
                    meaning: 'камень',
                    trans: '[qʷɔn]',
                    tip: 'Буква «Къ» обозначает глубокий смычный увуляр без выдоха [q], который огубляется перед «ва»: [qʷɔn].',
                    choices: [
                        { text: '[qʷɔn]', correct: true },
                        { text: '[qvan]', correct: false },
                        { text: '[kan]', correct: false }
                    ]
                },
                {
                    id: 100,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «ваъ» (нет)?',
                    displayWordHtml: 'ваъ',
                    rawWord: 'ваъ',
                    meaning: 'нет — отрицание',
                    trans: '[vaʔ]',
                    tip: 'Буква «Ъ» обозначает гортанную паузу (смычку) [ʔ]: [vaʔ].',
                    choices: [
                        { text: '[vaʔ]', correct: true },
                        { text: '[va]', correct: false },
                        { text: '[vah]', correct: false }
                    ]
                },
                {
                    id: 101,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «хьел» (стрела)?',
                    displayWordHtml: 'хьел',
                    rawWord: 'хьел',
                    meaning: 'стрела',
                    trans: '[çel]',
                    tip: 'Буква «Хь» перед гласными переднего ряда (е, и) произносится мягко как среднеязычный глухой щелевой [ç].',
                    choices: [
                        { text: '[çel]', correct: true },
                        { text: '[χel]', correct: false },
                        { text: '[hel]', correct: false }
                    ]
                },
                {
                    id: 102,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «гьава» (погода, воздух)?',
                    displayWordHtml: 'гьава',
                    rawWord: 'гьава',
                    meaning: 'погода, воздух',
                    trans: '[hawa]',
                    tip: 'Буква «Гь» передаёт чистый легкий выдох [h] (как английское h в house).',
                    choices: [
                        { text: '[hawa]', correct: true },
                        { text: '[gawa]', correct: false },
                        { text: '[χawa]', correct: false }
                    ]
                },
                {
                    id: 103,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'Какая транскрипция верна для слова «халкь» (народ)?',
                    displayWordHtml: 'халкь',
                    rawWord: 'халкь',
                    meaning: 'народ',
                    trans: '[χalqʼ]',
                    tip: 'Буква «Х» — хриплый щелевой [χ], а «Кь» — глубокий смычно-гортанный абруптив [qʼ]: [χalqʼ].',
                    choices: [
                        { text: '[χalqʼ]', correct: true },
                        { text: '[halk]', correct: false },
                        { text: '[xalk]', correct: false }
                    ]
                },
                {
                    id: 104,
                    modeId: 'words',
                    ruleId: 'uvular_hq',
                    questionText: 'В чём фонетическое различие между звуками «Къ» и «Хъ»?',
                    trans: '[q] vs [qʰ]',
                    tip: 'Къ [q] произносится без выдоха, а Хъ [qʰ] — с мощным выдохом (придыханием).',
                    choices: [
                        { text: 'Къ произносится без выдоха [q], а Хъ — с сильным выдохом [qʰ]', correct: true },
                        { text: 'Къ произносится мягко, а Хъ — твёрдо', correct: false },
                        { text: 'Они звучат абсолютно одинаково', correct: false }
                    ]
                },
                {
                    id: 105,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[tʰwɑr]',
                    audioFile: 'audio/reading/twar.mp3',
                    tip: 'Вы услышали слово «твар» (зёрнышко). Заканчивается на -war: [tʰwɑr].',
                    choices: [
                        { text: 'твар', correct: true },
                        { text: 'тар', correct: false },
                        { text: 'тӀвар', correct: false }
                    ]
                },
                {
                    id: 106,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[tʼwɑr]',
                    audioFile: 'audio/reading/t1war.mp3',
                    tip: 'Вы услышали слово «тӀвар» (имя). Слово на -war звучит как [tʼwɑr].',
                    choices: [
                        { text: 'тӀвар', correct: true },
                        { text: 'твар', correct: false },
                        { text: 'тӀар', correct: false }
                    ]
                },
                {
                    id: 107,
                    modeId: 'labialization',
                    ruleId: 'war_diphthong',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[aˈχwɑr]',
                    audioFile: 'audio/reading/ahwar.mp3',
                    tip: 'Вы услышали слово «ахвар» (сон). Окончание -war звучит как war: [aˈχwɑr].',
                    choices: [
                        { text: 'ахвар', correct: true },
                        { text: 'ахар', correct: false },
                        { text: 'ахва', correct: false }
                    ]
                },
                {
                    id: 108,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[zœr]',
                    audioFile: 'audio/reading/zver.mp3',
                    tip: 'Вы услышали слово «звер» (кипение). Сочетание «-ве-» образует огубленный гласный [œ]: [zœr].',
                    choices: [
                        { text: 'звер', correct: true },
                        { text: 'зар', correct: false },
                        { text: 'зер', correct: false }
                    ]
                },
                {
                    id: 109,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[qʰœr]',
                    audioFile: 'audio/reading/qhver.mp3',
                    tip: 'Вы услышали слово «хъвер» (улыбка). Сочетание «хъве-» произносится как [qʰœr].',
                    choices: [
                        { text: 'хъвер', correct: true },
                        { text: 'хвер', correct: false },
                        { text: 'хъар', correct: false }
                    ]
                },
                {
                    id: 110,
                    modeId: 'labialization',
                    ruleId: 've_to_oe',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[tʼœtʼ]',
                    audioFile: 'audio/reading/t1vet1.mp3',
                    tip: 'Вы услышали слово «тӀветӀ» (муха). «ТӀве-» образует лабиализованный гласный [œ]: [tʼœtʼ].',
                    choices: [
                        { text: 'тӀветӀ', correct: true },
                        { text: 'твет', correct: false },
                        { text: 'тӀетӀ', correct: false }
                    ]
                },
                {
                    id: 111,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[kʰtab]',
                    audioFile: 'audio/reading/kitab.mp3',
                    tip: 'Вы услышали слово «китаб» (книга). В беглой речи узкий гласный «и» в первом слоге редуцируется: [kʰtab].',
                    choices: [
                        { text: 'китаб', correct: true },
                        { text: 'ктаб', correct: false },
                        { text: 'катиб', correct: false }
                    ]
                },
                {
                    id: 112,
                    modeId: 'elision',
                    ruleId: 'syncope',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[txun]',
                    audioFile: 'audio/reading/tuhun.mp3',
                    tip: 'Вы услышали слово «тухун» (уносить, вести). Безударный гласный «у» синкопируется: [txun].',
                    choices: [
                        { text: 'тухун', correct: true },
                        { text: 'тхун', correct: false },
                        { text: 'тохун', correct: false }
                    ]
                },
                {
                    id: 113,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[awaː]',
                    audioFile: 'audio/reading/avay.mp3',
                    tip: 'Вы услышали глагол «авай» (был). Окончание «-ай» стягивается в долгий гласный: [awaː].',
                    choices: [
                        { text: 'авай', correct: true },
                        { text: 'ава', correct: false },
                        { text: 'ави', correct: false }
                    ]
                },
                {
                    id: 114,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[fenaː]',
                    audioFile: 'audio/reading/fenay.mp3',
                    tip: 'Вы услышали глагол «фенай» (пошёл). Сочетание «-ай» стягивается в долгий [fenaː].',
                    choices: [
                        { text: 'фенай', correct: true },
                        { text: 'фена', correct: false },
                        { text: 'фени', correct: false }
                    ]
                },
                {
                    id: 115,
                    modeId: 'elision',
                    ruleId: 'contraction_ay',
                    questionText: 'Какое слово вы слышите? Выберите верное написание:',
                    trans: '[rikʼæː]',
                    audioFile: 'audio/reading/rikyay.mp3',
                    tip: 'Вы услышали форму «рикӀяй» (из сердца). Падежное окончание «-яй» стягивается в долгий [rikʼæː].',
                    choices: [
                        { text: 'рикӀяй', correct: true },
                        { text: 'рикӀай', correct: false },
                        { text: 'рикӀей', correct: false }
                    ]
                }
    ]
};

// Экспорт в глобальную область видимости браузера
if (typeof window !== 'undefined') {
    window.READING_DATA = READING_DATA;
}

// Экспорт для тестирования в Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = READING_DATA;
}

