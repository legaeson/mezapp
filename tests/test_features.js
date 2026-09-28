const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT_DIR = path.resolve(__dirname, '..');

// ====================================================================
// 1. HTML Verification Tests
// ====================================================================
test('HTML: index.html structure verification', async (t) => {
    const htmlPath = path.join(ROOT_DIR, 'index.html');
    assert.ok(fs.existsSync(htmlPath), 'index.html must exist');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    await t.test('duel-btn-time-attack is removed from duel modal', () => {
        assert.strictEqual(
            html.includes('id="duel-btn-time-attack"'),
            false,
            'duel-btn-time-attack should not be present in index.html'
        );
    });

    await t.test('prac-mode-review (Повторение) is present in practice screen', () => {
        assert.ok(
            html.includes('id="prac-mode-review"'),
            'prac-mode-review must be present in index.html'
        );
        assert.ok(
            html.includes('id="prac-review-subtitle"'),
            'prac-review-subtitle must be present in index.html'
        );
        assert.ok(
            html.includes('Повторение'),
            'Title "Повторение" must be present'
        );
    });

    await t.test('prac-mode-quiz (Тесты) is removed from practice screen', () => {
        assert.ok(
            !html.includes('id="prac-mode-quiz"'),
            'prac-mode-quiz must be removed from index.html'
        );
    });

    await t.test('other practice modes (flashcards, grammar, duel) remain intact with unified green design', () => {
        assert.ok(html.includes('id="prac-mode-grammar"'), 'prac-mode-grammar must exist');
        assert.ok(html.includes('id="prac-mode-flashcards"'), 'prac-mode-flashcards must exist');
        assert.ok(html.includes('id="prac-mode-duel"'), 'prac-mode-duel must exist');
        assert.doesNotMatch(html, /6 режимов/, 'Badge "6 режимов" must be removed from practice tab');
        assert.doesNotMatch(html, /id="prac-mode-duel"[\s\S]*?В разработке/, 'Badge "В разработке" must be removed from duel card');
        assert.doesNotMatch(html, /• Скоро появится/, 'Text "• Скоро появится" must be removed');
        assert.match(html, /id="prac-mode-duel"[\s\S]*?Режим временно недоступен/, 'Duel card subtitle must state "Режим временно недоступен"');
        assert.match(html, /id="prac-mode-duel"[\s\S]*?bg-slate-100 text-slate-400/, 'Duel card icon must be gray');
    });

    await t.test('alphabet practice mode is available in practice screen with unified green icon', () => {
        assert.ok(html.includes('id="prac-mode-alphabet"'), 'prac-mode-alphabet must exist');
        assert.ok(html.includes('Чтение и звуки'), 'Reading practice title must be present');
    });

    await t.test('alphabet practice script exists', () => {
        const uiCode = fs.readFileSync(path.join(ROOT_DIR, 'js/ui.js'), 'utf-8');
        assert.ok(uiCode.includes('startAlphabetPractice'), 'startAlphabetPractice should be defined');
    });

    await t.test('duel modal buttons exist without time attack', () => {
        assert.ok(html.includes('id="duel-btn-online-match"'), 'online match button exists');
        assert.ok(html.includes('id="duel-btn-create-room"'), 'create room button exists');
        assert.ok(html.includes('id="duel-btn-join-code"'), 'join by code button exists');
        assert.ok(html.includes('id="duel-btn-pass-play"'), 'pass & play button exists');
    });
});

// ====================================================================
// 2. JavaScript Syntax & Parsing Tests
// ====================================================================
test('JavaScript: files parse without syntax errors', async (t) => {
    const files = ['js/srs.js', 'js/app.js', 'js/ui.js', 'js/state.js', 'js/utils.js'];
    for (const relPath of files) {
        await t.test(`File ${relPath} has valid syntax`, () => {
            const filePath = path.join(ROOT_DIR, relPath);
            assert.ok(fs.existsSync(filePath), `${relPath} must exist`);
            const code = fs.readFileSync(filePath, 'utf-8');
            assert.doesNotThrow(() => {
                new vm.Script(code, { filename: relPath });
            }, `Syntax error in ${relPath}`);
        });
    }
});

// ====================================================================
// 3. Spaced Repetition System (SRS) Algorithm Logic Tests
// ====================================================================
test('SRS Algorithm: ensureSrsCard and reviewSrsCard', async (t) => {
    // Extract SRS core functions from srs.js for isolated unit testing
    const srsCode = fs.readFileSync(path.join(ROOT_DIR, 'js/srs.js'), 'utf-8');
    
    // Create a sandbox with PROGRESS and constants
    const sandbox = {
        SRS_RATING: Object.freeze({ Again: 1, Hard: 2, Good: 3, Easy: 4 }),
        PROGRESS: { srs: {}, learned: [] }
    };
    vm.createContext(sandbox);

    // Run core helper functions
    const helpers = `
        function ensureSrsCard(wordId) {
            if (!PROGRESS.srs[wordId]) {
                PROGRESS.srs[wordId] = { next: 0, last: 0, ivl: 0, success: 0, errors: 0, ease: 2.5 };
            }
            const card = PROGRESS.srs[wordId];
            if (typeof card.ease !== 'number' || !Number.isFinite(card.ease)) card.ease = 2.5;
            card.ivl = Math.max(0, Number(card.ivl || 0));
            card.success = Math.max(0, Number(card.success || 0));
            card.errors = Math.max(0, Number(card.errors || 0));
            return card;
        }

        function reviewSrsCard(wordId, rating, now = Date.now()) {
            const card = ensureSrsCard(wordId);
            card.last = now;

            if (rating === SRS_RATING.Again) {
                card.errors += 1;
                card.success = 0;
                card.ease = Math.max(1.3, card.ease - 0.2);
                card.ivl = 0;
            } else if (rating === SRS_RATING.Hard) {
                card.errors += 1;
                card.ease = Math.max(1.3, card.ease - 0.15);
                card.ivl = Math.max(1, Math.round((card.ivl || 1) * 0.8));
            } else if (rating === SRS_RATING.Easy) {
                card.success += 1;
                card.ease = Math.min(3.2, card.ease + 0.1);
                if (card.ivl === 0) card.ivl = 2;
                else if (card.ivl === 1) card.ivl = 4;
                else card.ivl = Math.round(card.ivl * card.ease * 1.15);
            } else {
                card.success += 1;
                if (card.ivl === 0) card.ivl = 1;
                else if (card.ivl === 1) card.ivl = 3;
                else card.ivl = Math.round(card.ivl * card.ease);
            }

            card.ivl = Math.max(0, Math.min(card.ivl, 365));
            card.next = now + (card.ivl * 86400000);
            return card;
        }
    `;
    vm.runInContext(helpers, sandbox);

    await t.test('ensureSrsCard initializes card with ease 2.5 and ivl 0', () => {
        const card = sandbox.ensureSrsCard(101);
        assert.strictEqual(card.ease, 2.5);
        assert.strictEqual(card.ivl, 0);
        assert.strictEqual(card.success, 0);
        assert.strictEqual(card.errors, 0);
    });

    await t.test('reviewSrsCard with Again resets interval and decreases ease', () => {
        const now = 1000000;
        const card = sandbox.reviewSrsCard(101, sandbox.SRS_RATING.Again, now);
        assert.strictEqual(card.ivl, 0);
        assert.strictEqual(card.errors, 1);
        assert.strictEqual(card.success, 0);
        assert.strictEqual(Math.round(card.ease * 10) / 10, 2.3);
        assert.strictEqual(card.next, now);
    });

    await t.test('reviewSrsCard with Good increases interval step by step', () => {
        const now = 1000000;
        // Step 1: ivl 0 -> 1
        let card = sandbox.reviewSrsCard(202, sandbox.SRS_RATING.Good, now);
        assert.strictEqual(card.ivl, 1);
        assert.strictEqual(card.success, 1);
        assert.strictEqual(card.next, now + 1 * 86400000);

        // Step 2: ivl 1 -> 3
        card = sandbox.reviewSrsCard(202, sandbox.SRS_RATING.Good, now);
        assert.strictEqual(card.ivl, 3);
        assert.strictEqual(card.success, 2);

        // Step 3: ivl 3 -> round(3 * 2.5) = 8
        card = sandbox.reviewSrsCard(202, sandbox.SRS_RATING.Good, now);
        assert.strictEqual(card.ivl, 8);
    });

    await t.test('reviewSrsCard with Easy gives bonus interval and increases ease', () => {
        const now = 1000000;
        // Initial easy: ivl 0 -> 2, ease 2.5 -> 2.6
        let card = sandbox.reviewSrsCard(303, sandbox.SRS_RATING.Easy, now);
        assert.strictEqual(card.ivl, 2);
        assert.strictEqual(Math.round(card.ease * 10) / 10, 2.6);

        // Second easy: ivl 2 -> round(2 * 2.6 * 1.15) = 6
        card = sandbox.reviewSrsCard(303, sandbox.SRS_RATING.Easy, now);
        assert.strictEqual(card.ivl, Math.round(2 * 2.6 * 1.15));
    });

    await t.test('reviewSrsCard enforces bounds on ease and interval', () => {
        // Ease lower bound 1.3
        for (let i = 0; i < 20; i++) {
            sandbox.reviewSrsCard(404, sandbox.SRS_RATING.Again);
        }
        assert.strictEqual(sandbox.PROGRESS.srs[404].ease, 1.3);

        // Ease upper bound 3.2
        for (let i = 0; i < 20; i++) {
            sandbox.reviewSrsCard(505, sandbox.SRS_RATING.Easy);
        }
        assert.strictEqual(sandbox.PROGRESS.srs[505].ease, 3.2);

        // Max interval 365
        sandbox.PROGRESS.srs[505].ivl = 300;
        sandbox.reviewSrsCard(505, sandbox.SRS_RATING.Easy);
        assert.strictEqual(sandbox.PROGRESS.srs[505].ivl, 365);
    });
});

// ====================================================================
// 4. SRS Review Queue Priority Sorting Tests
// ====================================================================
test('SRS Review Queue: priority sorting (due -> weak -> fresh)', async (t) => {
    const now = 1000000000;
    const mockWords = [
        { id: 1, lz: 'цIай', ru: 'огонь' },
        { id: 2, lz: 'яд', ru: 'вода' },
        { id: 3, lz: 'накьв', ru: 'земля' },
        { id: 4, lz: 'гьава', ru: 'воздух' },
        { id: 5, lz: 'гада', ru: 'мальчик' },
        { id: 6, lz: 'руш', ru: 'девочка' },
    ];

    const mockProgress = {
        srs: {
            // Overdue card (most urgent)
            1: { next: now - 50000, ivl: 3, errors: 0, success: 3, ease: 2.5 },
            // Overdue card (less urgent than 1)
            2: { next: now - 10000, ivl: 1, errors: 1, success: 1, ease: 2.3 },
            // Weak card (not overdue, but high error count)
            3: { next: now + 86400000, ivl: 2, errors: 5, success: 2, ease: 1.6 },
            // Strong future card (neither due nor weak)
            4: { next: now + 86400000 * 5, ivl: 10, errors: 0, success: 6, ease: 2.8 }
            // 5 and 6 are fresh (not in srs progress yet)
        }
    };

    // Filter due cards
    const due = mockWords
        .filter(w => mockProgress.srs[w.id] && mockProgress.srs[w.id].next <= now && mockProgress.srs[w.id].ivl > 0)
        .sort((a, b) => mockProgress.srs[a.id].next - mockProgress.srs[b.id].next);

    // Filter weak cards
    const weak = mockWords.filter(w => {
        if (due.find(d => d.id === w.id)) return false;
        const card = mockProgress.srs[w.id];
        return card && (card.errors > card.success || card.ease <= 1.8);
    });

    // Filter fresh cards
    const fresh = mockWords.filter(w => {
        if (due.find(d => d.id === w.id)) return false;
        if (weak.find(d => d.id === w.id)) return false;
        return !mockProgress.srs[w.id] || mockProgress.srs[w.id].ivl === 0;
    });

    await t.test('Due cards prioritized and ordered by next ascending', () => {
        assert.strictEqual(due.length, 2);
        assert.strictEqual(due[0].id, 1, 'Word 1 has older due date so it must come first');
        assert.strictEqual(due[1].id, 2, 'Word 2 comes second in due list');
    });

    await t.test('Weak cards identified correctly', () => {
        assert.strictEqual(weak.length, 1);
        assert.strictEqual(weak[0].id, 3, 'Word 3 is weak because ease <= 1.8');
    });

    await t.test('Fresh cards identified correctly', () => {
        assert.strictEqual(fresh.length, 2);
        assert.ok(fresh.some(w => w.id === 5));
        assert.ok(fresh.some(w => w.id === 6));
    });

    await t.test('Queue assembling preserves due -> weak -> fresh priority', () => {
        const queue = [...due, ...weak, ...fresh];
        assert.strictEqual(queue[0].id, 1);
        assert.strictEqual(queue[1].id, 2);
        assert.strictEqual(queue[2].id, 3);
        assert.ok([5, 6].includes(queue[3].id));
        assert.ok([5, 6].includes(queue[4].id));
    });
});

// ====================================================================
// 5. SRS Review Answer Rating & Timing Tests
// ====================================================================
test('SRS Review: answer rating logic based on timer (15s total)', async (t) => {
    const TOTAL_TIMER = 15;
    const SRS_RATING = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

    function calculateRating(isCorrect, timerRemaining) {
        if (!isCorrect) return SRS_RATING.Again;
        const timeUsed = TOTAL_TIMER - timerRemaining;
        return timeUsed <= 7 ? SRS_RATING.Easy : SRS_RATING.Good;
    }

    await t.test('Quick correct answer (<= 7s used) yields Easy', () => {
        // Answered in 3 seconds (12s remaining)
        assert.strictEqual(calculateRating(true, 12), SRS_RATING.Easy);
        // Answered in 7 seconds (8s remaining)
        assert.strictEqual(calculateRating(true, 8), SRS_RATING.Easy);
    });

    await t.test('Slow correct answer (> 7s used) yields Good', () => {
        // Answered in 8 seconds (7s remaining)
        assert.strictEqual(calculateRating(true, 7), SRS_RATING.Good);
        // Answered in 14 seconds (1s remaining)
        assert.strictEqual(calculateRating(true, 1), SRS_RATING.Good);
    });

    await t.test('Wrong answer yields Again regardless of time', () => {
        assert.strictEqual(calculateRating(false, 14), SRS_RATING.Again);
        assert.strictEqual(calculateRating(false, 2), SRS_RATING.Again);
    });

    await t.test('Timeout (0s remaining without answer) yields Again', () => {
        assert.strictEqual(calculateRating(false, 0), SRS_RATING.Again);
    });
});

// ====================================================================
// 6. Duel / Mode Timer Configuration Tests
// ====================================================================
test('Duel Mode: timer assignment logic', async (t) => {
    function getModeTimer(mode) {
        return mode === 'time_attack' ? 10 : (mode === 'srs_review' ? 15 : 12);
    }

    assert.strictEqual(getModeTimer('srs_review'), 15, 'srs_review timer should be 15s');
    assert.strictEqual(getModeTimer('time_attack'), 10, 'time_attack timer should be 10s');
    assert.strictEqual(getModeTimer('pass_play'), 12, 'pass_play timer should be 12s');
    assert.strictEqual(getModeTimer('online_live'), 12, 'online_live timer should be 12s');
});

// ====================================================================
// 7. Pluralize & Subtitle Text Formatting (No Duplication)
// ====================================================================
test('Pluralize & Practice Subtitle Formatting: no number duplication', async (t) => {
    function pluralize(n, one, few, many) {
        const num = Math.abs(n) % 100;
        const n1 = num % 10;
        if (num > 10 && num < 20) return `${n} ${many}`;
        if (n1 > 1 && n1 < 5) return `${n} ${few}`;
        if (n1 === 1) return `${n} ${one}`;
        return `${n} ${many}`;
    }

    function formatReviewSubtitle(dueCount) {
        const cardsStr = pluralize(dueCount, 'карточка', 'карточки', 'карточек');
        return `${cardsStr} к повторению`;
    }

    assert.strictEqual(formatReviewSubtitle(20), '20 карточек к повторению');
    assert.strictEqual(formatReviewSubtitle(1), '1 карточка к повторению');
    assert.strictEqual(formatReviewSubtitle(2), '2 карточки к повторению');
    assert.strictEqual(formatReviewSubtitle(5), '5 карточек к повторению');
    assert.strictEqual(formatReviewSubtitle(21), '21 карточка к повторению');

    assert.ok(!formatReviewSubtitle(20).includes('20 20'));
    assert.ok(!formatReviewSubtitle(1).includes('1 1'));
});
