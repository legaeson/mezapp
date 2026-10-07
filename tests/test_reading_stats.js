const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Reading & Phonetics: Honest 0-based stats & real progress tracking', async (t) => {
    const uiJsPath = path.join(__dirname, '..', 'js', 'ui.js');
    const content = fs.readFileSync(uiJsPath, 'utf8');

    await t.test('No hardcoded 0.92 mock defaults in getReadingSkillStats', () => {
        assert.doesNotMatch(content, /letters:\s*0\.92/, 'Should not hardcode 0.92 for letters');
        assert.doesNotMatch(content, /labialization:\s*0\.71/, 'Should not hardcode 0.71 for labialization');
        assert.doesNotMatch(content, /nasalization:\s*0\.64/, 'Should not hardcode 0.64 for nasalization');
        assert.doesNotMatch(content, /elision:\s*0\.48/, 'Should not hardcode 0.48 for elision');
    });

    await t.test('Initial state is honest 0 across all skills', () => {
        assert.match(content, /letters:\s*0,/, 'Default letters should be 0');
        assert.match(content, /labialization:\s*0,/, 'Default labialization should be 0');
        assert.match(content, /totalSessions:\s*0,/, 'Default totalSessions should be 0');
    });

    await t.test('Falsy-check bug fixed (no stats.letters || 0.9 fallback)', () => {
        assert.doesNotMatch(content, /stats\.letters\s*\|\|\s*0\.9/, 'Should not fall back to 0.9 when 0');
        assert.doesNotMatch(content, /stats\.labialization\s*\|\|\s*0\.7/, 'Should not fall back to 0.7 when 0');
        assert.doesNotMatch(content, /stats\.nasalization\s*\|\|\s*0\.6/, 'Should not fall back to 0.6 when 0');
        assert.doesNotMatch(content, /stats\.elision\s*\|\|\s*0\.5/, 'Should not fall back to 0.5 when 0');
    });

    await t.test('Clean minimalist hub: Hero card and phonetic accordion removed, clean mode cards', () => {
        assert.doesNotMatch(content, /Рекомендуемый тренажёр/, 'Hero card should be removed');
        assert.doesNotMatch(content, /Справочник правил фонетики/, 'Theory accordion should be removed');
        assert.doesNotMatch(content, /<p class="text-xs text-slate-500 dark:text-slate-400 mt-0\.5 truncate">\$\{m\.subtitle\}<\/p>/, 'Mode subtitles should be removed');
    });

    await t.test('No "Примеры произношения" block rendered in theory card', () => {
        assert.doesNotMatch(content, /Примеры произношения/, 'Should not render Примеры произношения block in theory card');
    });

    await t.test('renderReadingResults records completed session', () => {
        assert.match(content, /stats\.totalSessions\s*=/, 'Should record totalSessions on completion');
        assert.match(content, /saveReadingSkillStats\(stats\)/, 'Should save stats after recording');
    });

    await t.test('Mode 1: Лабиализация has correct title, theory, and examples', () => {
        assert.match(content, /title:\s*['"]1\.\s*Лабиализация['"]/, 'Mode 1 title should be 1. Лабиализация');
        assert.match(content, /Лабиализация/, 'Theory should explain labialization');
        assert.match(content, /Вариант с \[ʷо\]/, 'Theory should explain [ʷо]');
        assert.match(content, /Вариант с \[ʷœ\]/, 'Theory should explain [ʷœ]');
    });

    await t.test('All transcriptions in ORTHO_RULES and theory are in IPA (МФА)', () => {
        // Find ORTHO_RULES block
        const orthoRulesMatch = content.match(/const ORTHO_RULES = \[([\s\S]*?)\];/);
        assert.ok(orthoRulesMatch, 'ORTHO_RULES should exist');
        const rulesStr = orthoRulesMatch[1];

        // All trans: fields must NOT contain Cyrillic letters
        const transMatches = [...rulesStr.matchAll(/trans:\s*['"]([^'"]+)['"]/g)];
        assert.ok(transMatches.length >= 20, 'Should find at least 20 trans entries');
        for (const m of transMatches) {
            const val = m[1];
            assert.doesNotMatch(val, /[а-яёА-ЯЁ]/, `Transcription "${val}" must be in IPA, not Cyrillic`);
        }

        // Verify key IPA symbols are used
        assert.match(rulesStr, /\[kʼ[oɔ]l\]/, 'kʼol should use IPA ejective kʼ');
        assert.match(rulesStr, /\[qʼœd\]/, 'qʼœd should use IPA ejective qʼ and œ');
        assert.match(rulesStr, /\[bæzi\]/, 'bæzi should use IPA æ');
        assert.match(rulesStr, /\[jar\]/, 'jar should use IPA j');
        assert.match(rulesStr, /\[ymyr\]/, 'ymyr should use IPA y');
        assert.match(rulesStr, /\[zũ\]/, 'zũ should use IPA nasal ̃');
        assert.match(rulesStr, /\[awaː\]/, 'awaː should use IPA long ː');
        assert.match(rulesStr, /\[qʰsan\]/, 'qʰsan should use IPA aspirated qʰ');
    });

    await t.test('Theory card contains no literal "МФА" words, removes "Суть правила" and "Теория" badge', () => {
        const theoryFuncMatch = content.match(/function renderRuleTheoryCard[\s\S]*?function launchReadingQuestions/);
        assert.ok(theoryFuncMatch, 'renderRuleTheoryCard function should exist');
        const theoryStr = theoryFuncMatch[0];
        assert.doesNotMatch(theoryStr, /МФА/, 'Theory card should not contain literal "МФА"');
        assert.doesNotMatch(theoryStr, /Суть правила/, 'Theory card should not contain "Суть правила"');
        assert.match(theoryStr, />—<\/span>/, 'Theory examples should use green em-dash');
        assert.doesNotMatch(theoryStr, /bg-emerald-50.*?>\$\{ex\.trans\}<\/span>/, 'Theory examples should not use green square badge');
    });

    await t.test('Question screen fills viewport height, removes word meaning and TTS, and supports authentic sound listening', () => {
        const questionFuncMatch = content.match(/function renderReadingQuestion\(\)[\s\S]*?function handleReadingChoice/);
        assert.ok(questionFuncMatch, 'renderReadingQuestion should exist');
        const qStr = questionFuncMatch[0];

        // Full screen height
        assert.match(qStr, /min-h-\[calc\(100dvh-12rem\)\]/, 'Question container must use full viewport height');
        assert.match(qStr, /flex-1/, 'Choices stack or buttons should expand with flex-1');

        // Removed legacy clutter & Telegram Mini App optimizations
        assert.doesNotMatch(qStr, /reading-question-close-btn/, 'Tiny close button must be removed for Telegram Mini App');
        assert.doesNotMatch(qStr, /border-slate-100 dark:border-slate-700/, 'Word display must not have border box outline');
        assert.doesNotMatch(qStr, /q\.levelTitle/, 'levelTitle badge must be removed');
        assert.doesNotMatch(qStr, /q\.meaning/, 'Word meaning must be removed');
        assert.doesNotMatch(qStr, /Послушать произношение/, 'Word Russian TTS button must be removed');

        // Sound listening support
        assert.match(qStr, /reading-replay-sound-btn/, 'Replay sound button must exist for listening questions');
        assert.match(qStr, /width:\s*64px;\s*height:\s*64px;/, 'Sound button must have neat fixed dimensions');
        assert.match(qStr, /aspect-ratio:\s*1\s*\/\s*1;/, 'Sound button must have aspect-ratio 1:1');
        assert.match(qStr, /speakWord\(null,\s*q\.audioFile\)/, 'Audio must be played via speakWord');

        // Questions builder contains authentic audio questions and clean choices without parenthetical hints
        const buildFuncMatch = content.match(/function buildReadingPhoneticsQuestions[\s\S]*?function renderReadingQuestion/);
        assert.ok(buildFuncMatch, 'buildReadingPhoneticsQuestions should exist');
        const bStr = buildFuncMatch[0];
        assert.match(bStr, /audio\/reading\/kval\.mp3/, 'Should include authentic audio for kval');
        assert.match(bStr, /Какое слово вы слышите\?/, 'Should ask "Какое слово вы слышите?"');
        assert.doesNotMatch(bStr, /Слово и живая речь/, 'Should not include "Слово и живая речь"');
        assert.doesNotMatch(bStr, /увулярный взрывной с придыханием/, 'Choices must not contain parenthetical hints (увулярный взрывной)');
        assert.doesNotMatch(bStr, /ошибочное чтение через/, 'Choices must not contain parenthetical hints (ошибочное чтение)');

        // Feedback banner must not repeat transcription or generic rule paragraphs
        const choiceFuncMatch = content.match(/function handleReadingChoice[\s\S]*?function renderReadingResults/);
        assert.ok(choiceFuncMatch, 'handleReadingChoice should exist');
        const cStr = choiceFuncMatch[0];
        assert.doesNotMatch(cStr, /Транскрипция:/, 'Feedback banner must not duplicate transcription');
        assert.doesNotMatch(cStr, /q\.ruleTitle/, 'Feedback banner must not repeat generic ruleTitle');
        assert.doesNotMatch(cStr, /q\.ruleDesc/, 'Feedback banner must not repeat generic ruleDesc');
        assert.match(cStr, /!isCorrect\s*&&\s*q\.tip/, 'Tip must only be shown on wrong answers, not on correct answers');
    });

    await t.test('All reading modes have minimum 15 questions, uvular consonants, and audio spelling levels', () => {
        const buildFuncMatch = content.match(/function buildReadingPhoneticsQuestions[\s\S]*?function renderReadingQuestion/);
        assert.ok(buildFuncMatch, 'buildReadingPhoneticsQuestions should exist');
        const bStr = buildFuncMatch[0];

        // Mode counts check
        const modes = [...bStr.matchAll(/modeId:\s*['"](\w+)['"]/g)].map(m => m[1]);
        const counts = {};
        modes.forEach(m => counts[m] = (counts[m] || 0) + 1);

        assert.ok((counts.labialization || 0) >= 15, `labialization must have >= 15 questions, found ${counts.labialization}`);
        assert.ok((counts.nasalization || 0) >= 15, `nasalization must have >= 15 questions, found ${counts.nasalization}`);
        assert.ok((counts.elision || 0) >= 15, `elision must have >= 15 questions, found ${counts.elision}`);
        assert.ok(modes.length >= 50, `Total questions should be >= 50, found ${modes.length}`);

        // Workout session length is at least 15
        assert.match(bStr, /shuffled\.length\s*>\s*15/, 'Session should select at least 15 questions');

        // Labialization audio questions
        assert.match(bStr, /audio\/reading\/kval\.mp3/, 'Labialization audio question for кӀвал must exist');
        assert.match(bStr, /audio\/reading\/svas\.mp3/, 'Labialization audio question for свас must exist');

        // Nasalization audio questions
        assert.match(bStr, /audio\/reading\/zun\.mp3/, 'Nasalization audio question for зун must exist');
        assert.match(bStr, /audio\/reading\/vun\.mp3/, 'Nasalization audio question for вун must exist');
        assert.match(bStr, /audio\/reading\/van\.mp3/, 'Nasalization audio question for ван must exist');
    });
});


