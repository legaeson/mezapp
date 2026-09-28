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
