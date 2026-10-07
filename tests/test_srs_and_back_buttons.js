const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const uiJs = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8').replace(/\r\n/g, '\n');
const srsJs = fs.readFileSync(path.join(ROOT, 'js/srs.js'), 'utf8').replace(/\r\n/g, '\n');

test('Navigation Back Buttons: Redundant buttons removed', async (t) => {
    await t.test('No "К режимам практики" back buttons in index.html', () => {
        assert.ok(!indexHtml.includes('id="grammar-back-btn"'), 'grammar-back-btn should be removed');
        assert.ok(!indexHtml.includes('id="alphabet-practice-back-btn"'), 'alphabet-practice-back-btn should be removed');
        assert.ok(!indexHtml.includes('К режимам практики'), 'Text "К режимам практики" should not be in index.html');
    });

    await t.test('No "К режимам чтения" top back buttons in js/ui.js', () => {
        assert.ok(!uiJs.includes('id="reading-theory-back-btn"'), 'reading-theory-back-btn should be removed');
        assert.ok(!uiJs.includes('id="reading-summary-back-btn"'), 'reading-summary-back-btn should be removed');
        assert.ok(!uiJs.includes('К режимам чтения'), 'Text "К режимам чтения" back button should not be in ui.js');
    });

    await t.test('No "К режимам практики" in js/ui.js', () => {
        assert.ok(!uiJs.includes('К режимам практики'), 'Text "К режимам практики" should not be in ui.js');
    });
});

test('SRS Review Mode ("Повторение"): Clean, relaxed repetition without timer, lives, close button, header title, or round badge', async (t) => {
    await t.test('startDuelGame hides header bar, close btn, title, round badge, and timer widget for srs_review', () => {
        assert.ok(srsJs.includes("if (mode === 'srs_review') {"), 'srs_review branch exists in startDuelGame');
        assert.ok(srsJs.includes("headerBar.classList.add('hidden')"), 'headerBar hidden in srs_review');
        assert.ok(srsJs.includes("closeBtn.classList.add('hidden')"), 'closeBtn hidden in srs_review');
        assert.ok(srsJs.includes("timerWidget.classList.add('hidden')"), 'timerWidget hidden in srs_review');
    });

    await t.test('updateDuelLivesUI hides playerLives for srs_review', () => {
        assert.ok(srsJs.includes("if (duelState.mode === 'srs_review') {\n                    playerLivesEl.innerHTML = '';\n                    playerLivesEl.classList.add('hidden');"), 'playerLives hidden in srs_review');
    });

    await t.test('nextDuelRound keeps roundBadge hidden and bypasses countdown timer for srs_review', () => {
        assert.ok(srsJs.includes("if (duelState.mode !== 'srs_review') {\n                duelState.timerInterval = setInterval"), 'timer interval not started in srs_review');
        assert.ok(srsJs.includes("duelState.mode !== 'srs_review' && duelState.playerLives <= 0"), 'lives game over condition bypassed for srs_review');
    });

    await t.test('handleDuelAnswer does not decrement lives in srs_review and provides clean feedback', () => {
        assert.ok(srsJs.includes("if (duelState.mode !== 'srs_review') {\n                        duelState.playerLives--;\n                    }"), 'lives not decremented on mistake in srs_review');
        assert.ok(srsJs.includes("Ошибка! Слово вернётся на повторение"), 'clean feedback banner without lives in srs_review');
    });

    await t.test('endDuelGame removes lives row and failure message for srs_review', () => {
        // Find srs_review stats bento
        const srsBentoMatch = srsJs.slice(srsJs.indexOf('// SRS Review result screen'));
        assert.ok(!srsBentoMatch.includes('<i class="fa-solid fa-heart text-rose-500"></i> Жизни'), 'lives row omitted from srs_review stats bento');
        assert.ok(!srsBentoMatch.includes('Сессия прервана'), 'session interrupted by lives omitted from srs_review');
    });

    await t.test('index.html CSS provides .is-solo styling hiding timer widget and lives', () => {
        assert.ok(indexHtml.includes('.duel-hud-bar.is-solo .duel-timer-widget'), 'CSS hides duel-timer-widget in is-solo');
        assert.ok(indexHtml.includes('.duel-hud-bar.is-solo #duel-player-lives'), 'CSS hides duel-player-lives in is-solo');
        assert.ok(indexHtml.includes('.duel-header-bar.hidden'), 'CSS hides duel-header-bar when hidden');
    });
});

test('SRS Flashcards: Top header (close button, title, learned/total counter) removed for clean UI', async (t) => {
    await t.test('No top header bar with "Лезгинский язык" or close button in showFlashcard', () => {
        // Find showFlashcard content template
        const flashcardIdx = srsJs.indexOf('function showFlashcard()');
        assert.ok(flashcardIdx !== -1, 'showFlashcard function found');
        const flashcardBody = srsJs.slice(flashcardIdx, flashcardIdx + 2000);
        
        assert.ok(!flashcardBody.includes('srs-close-btn'), 'srs-close-btn removed from flashcard practice');
        assert.ok(!flashcardBody.includes('Лезгинский язык'), '"Лезгинский язык" removed from flashcard practice header');
        assert.ok(!flashcardBody.includes('${learned} / ${total}'), 'counter learned/total removed from flashcard practice');
    });

    await t.test('window.endPractice is explicitly exported', () => {
        assert.ok(srsJs.includes('window.endPractice = endPractice;'), 'window.endPractice exported for Telegram BackButton and global callers');
    });
});

test('Grammar View & Telegram BackButton: On-demand loading and global back button support', async (t) => {
    await t.test('window.hideGrammarList and window.showGrammarList are exported in ui.js', () => {
        assert.ok(uiJs.includes('window.hideGrammarList = hideGrammarList;'), 'window.hideGrammarList exported');
        assert.ok(uiJs.includes('window.showGrammarList = showGrammarList;'), 'window.showGrammarList exported');
    });

    await t.test('loadGrammar is called on-demand in showGrammarList/renderGrammar when GRAMMAR is empty', () => {
        assert.ok(uiJs.includes('loadGrammar();'), 'loadGrammar called when GRAMMAR is empty');
        assert.ok(uiJs.includes('Загрузка юнитов грамматики...'), 'clean spinner state rendered while loading');
    });

    await t.test('showGrammarUnit opens in full-screen mode via is-fullscreen', () => {
        assert.ok(uiJs.includes("modal.classList.add('is-fullscreen')"), 'showGrammarUnit enables full screen');
        assert.ok(uiJs.includes("modal.classList.remove('is-fullscreen')"), 'closeModal removes full screen');
        assert.ok(indexHtml.includes('#word-modal.is-fullscreen'), 'CSS defines full screen modal styles');
        assert.ok(indexHtml.includes('#word-modal.is-fullscreen .modal'), 'CSS defines full screen inner modal styles');
    });
});

test('Header Persistence & Safe Area: Persistent LezgiMez header above all modals and progress bar positioning', async (t) => {
    const tgJs = fs.readFileSync(path.join(ROOT, 'js/telegram.js'), 'utf8').replace(/\r\n/g, '\n');

    await t.test('Header has LezgiMez branding and top z-index', () => {
        assert.ok(indexHtml.includes('LezgiMez <span class="text-emerald-500">β</span>'), 'Header displays LezgiMez logo');
        assert.ok(indexHtml.includes('header.app-header'), 'CSS targets header.app-header');
        assert.ok(indexHtml.includes('z-index: 300 !important;'), 'header.app-header has highest z-index');
    });

    await t.test('All dialogs are positioned strictly under the persistent app header', () => {
        assert.ok(indexHtml.includes('top: var(--app-header-total-h, 56px) !important;'), 'Dialogs start below app-header');
        assert.ok(indexHtml.includes('--app-header-total-h: calc(3.5rem + var(--tg-safe-area-inset-top, 0px));'), 'Header height includes safe area inset');
    });

    await t.test('Duel progress bar is placed directly under the app header above the arena header bar', () => {
        const wrapperIdx = indexHtml.indexOf('<div class="duel-modal-wrapper');
        assert.ok(wrapperIdx !== -1, 'duel-modal-wrapper found');
        const progressIdx = indexHtml.indexOf('id="duel-progress-container"', wrapperIdx);
        const headerBarIdx = indexHtml.indexOf('class="duel-header-bar"', wrapperIdx);
        assert.ok(progressIdx !== -1, 'duel-progress-container found in wrapper');
        assert.ok(headerBarIdx !== -1, 'duel-header-bar found in wrapper');
        assert.ok(progressIdx < headerBarIdx, 'Progress bar sits directly at top of wrapper under app header before arena header bar');
    });

    await t.test('Telegram integration updates --app-header-total-h dynamically with safe area insets', () => {
        assert.ok(tgJs.includes("document.documentElement.style.setProperty('--app-header-total-h'"), 'telegram.js updates --app-header-total-h');
    });

    await t.test('Profile card removes TG badge circle and sync status for clean display', () => {
        assert.ok(!indexHtml.includes('id="tg-user-badge"'), 'tg-user-badge removed from index.html');
        assert.ok(!indexHtml.includes('id="tg-sync-status"'), 'tg-sync-status removed from index.html');
        assert.ok(!indexHtml.includes('Синхронизировано'), 'Синхронизировано removed from index.html');
        assert.ok(!tgJs.includes("badgeEl.textContent = 'TG'"), 'TG badge text assignment removed from telegram.js');
        assert.ok(!tgJs.includes("Синхронизировано"), 'Синхронизировано assignment removed from telegram.js');
    });
});


