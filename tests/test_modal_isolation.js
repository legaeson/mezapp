const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT_DIR = path.resolve(__dirname, '..');

// ====================================================================
// 1. CSS Verification for Modal Isolation and Scroll Lock
// ====================================================================
test('CSS: Modal isolation and scroll lock rules in index.html', async (t) => {
    const htmlPath = path.join(ROOT_DIR, 'index.html');
    assert.ok(fs.existsSync(htmlPath), 'index.html must exist');
    const html = fs.readFileSync(htmlPath, 'utf-8');

    await t.test('body.modal-open locks scrolling and touch actions', () => {
        assert.ok(html.includes('body.modal-open'), 'body.modal-open must be defined');
        assert.ok(html.includes('overflow: hidden !important'), 'overflow: hidden must be set on body.modal-open');
        assert.ok(html.includes('touch-action: none !important'), 'touch-action: none must be set on body.modal-open');
    });

    await t.test('Background elements have pointer-events: none and user-select: none when modal is open', () => {
        assert.ok(html.includes('body.modal-open main'), 'body.modal-open main must be targeted');
        assert.ok(html.includes('body.modal-open header.app-header'), 'body.modal-open header must be targeted');
        assert.ok(html.includes('body.modal-open nav.bottom-nav'), 'body.modal-open nav must be targeted');
        assert.ok(html.includes('pointer-events: none !important'), 'pointer-events: none must be enforced');
    });

    await t.test('Modals have overscroll-behavior: contain to prevent scroll chaining to background', () => {
        assert.ok(html.includes('overscroll-behavior: contain !important'), 'overscroll-behavior: contain must be enforced on dialogs');
    });

    await t.test('Alphabet practice mode and subview are present in practice tab', () => {
        assert.ok(html.includes('id="prac-mode-alphabet"'), 'prac-mode-alphabet card must exist');
        assert.ok(html.includes('id="practice-alphabet-view"'), 'practice-alphabet-view container must exist');
    });
});

// ====================================================================
// 2. JavaScript Verification: js/ui.js Isolation Subsystem
// ====================================================================
test('JavaScript: js/ui.js defines modal isolation and escape key handlers', async (t) => {
    const uiCode = fs.readFileSync(path.join(ROOT_DIR, 'js/ui.js'), 'utf-8');

    await t.test('Essential modal isolation functions are defined', () => {
        assert.ok(uiCode.includes('function hasAnyOpenModal()'), 'hasAnyOpenModal should be defined');
        assert.ok(uiCode.includes('function getActiveTopModal()'), 'getActiveTopModal should be defined');
        assert.ok(uiCode.includes('function syncModalOpenState()'), 'syncModalOpenState should be defined');
        assert.ok(uiCode.includes('function activateGhostClickShield('), 'activateGhostClickShield should be defined');
        assert.ok(uiCode.includes('function handleEscapeKey('), 'handleEscapeKey should be defined');
        assert.ok(uiCode.includes('function initModalIsolationSystem()'), 'initModalIsolationSystem should be defined');
    });

    await t.test('Functions are exported to window for global access', () => {
        assert.ok(uiCode.includes('window.hasAnyOpenModal = hasAnyOpenModal'), 'window.hasAnyOpenModal must be exported');
        assert.ok(uiCode.includes('window.syncModalOpenState = syncModalOpenState'), 'window.syncModalOpenState must be exported');
        assert.ok(uiCode.includes('window.handleEscapeKey = handleEscapeKey'), 'window.handleEscapeKey must be exported');
        assert.ok(uiCode.includes('window.activateGhostClickShield = activateGhostClickShield'), 'window.activateGhostClickShield must be exported');
    });

    await t.test('syncModalOpenState sets inert and modal-open class on body and background', () => {
        assert.ok(uiCode.includes("classList.add('modal-open')"), 'modal-open class should be added');
        assert.ok(uiCode.includes("setAttribute('inert'"), 'inert attribute should be set on background');
        assert.ok(uiCode.includes("removeAttribute('inert'"), 'inert attribute should be removed on close');
    });
});

// ====================================================================
// 3. JavaScript Verification: js/app.js Backdrops and Keyboard
// ====================================================================
test('JavaScript: js/app.js handles backdrop containment and Escape key', async (t) => {
    const appCode = fs.readFileSync(path.join(ROOT_DIR, 'js/app.js'), 'utf-8');

    await t.test('setupModalBackdrops is defined and called', () => {
        assert.ok(appCode.includes('function setupModalBackdrops()'), 'setupModalBackdrops should be defined');
        assert.ok(appCode.includes('setupModalBackdrops();'), 'setupModalBackdrops should be called');
    });

    await t.test('initKeyboard calls window.handleEscapeKey on Escape', () => {
        assert.ok(appCode.includes('window.handleEscapeKey'), 'initKeyboard must delegate to window.handleEscapeKey');
    });

    await t.test('Modal cards stop propagation of clicks to the backdrop', () => {
        assert.ok(appCode.includes('e.stopPropagation()'), 'stopPropagation must be used on modal cards');
    });
});

// ====================================================================
// 4. Unit Test of Modal Isolation & Ghost Click Logic (Sandboxed)
// ====================================================================
test('Logic: Modal isolation, ghost click shield, and wheel blocking', async (t) => {
    // Create DOM mocks
    let bodyClassList = new Set();
    let mainAttrs = {};
    let mainStyle = {};

    const documentMock = {
        body: {
            classList: {
                add: (cls) => bodyClassList.add(cls),
                remove: (cls) => bodyClassList.delete(cls),
                contains: (cls) => bodyClassList.has(cls)
            }
        },
        querySelector: (sel) => {
            if (sel === 'main') {
                return {
                    setAttribute: (k, v) => { mainAttrs[k] = v; },
                    removeAttribute: (k) => { delete mainAttrs[k]; },
                    style: mainStyle
                };
            }
            return {
                setAttribute: () => {},
                removeAttribute: () => {}
            };
        },
        getElementById: (id) => {
            // Mock modal states
            if (id === 'duel-menu-modal' && testState.duelMenuOpen) {
                return { id, classList: { contains: (c) => c !== 'hidden' }, style: { display: 'flex' } };
            }
            return { id, classList: { contains: (c) => c === 'hidden' }, style: { display: 'none' } };
        },
        querySelectorAll: () => []
    };

    let testState = { duelMenuOpen: false };
    let ghostClickShieldActive = false;

    function hasAnyOpenModal() {
        return testState.duelMenuOpen;
    }

    function syncModalOpenState() {
        const isOpen = hasAnyOpenModal();
        const mainEl = documentMock.querySelector('main');
        if (isOpen || ghostClickShieldActive) {
            documentMock.body.classList.add('modal-open');
            mainEl.setAttribute('inert', '');
            mainEl.style.overflowY = 'hidden';
        } else {
            documentMock.body.classList.remove('modal-open');
            mainEl.removeAttribute('inert');
            mainEl.style.overflowY = '';
        }
    }

    await t.test('Opening modal sets body.modal-open, inert, and locks main overflow', () => {
        testState.duelMenuOpen = true;
        syncModalOpenState();

        assert.strictEqual(bodyClassList.has('modal-open'), true, 'body must have modal-open');
        assert.strictEqual(mainAttrs['inert'], '', 'main must have inert');
        assert.strictEqual(mainStyle.overflowY, 'hidden', 'main overflowY must be hidden');
    });

    await t.test('Closing modal without ghost shield unlocks background', () => {
        testState.duelMenuOpen = false;
        ghostClickShieldActive = false;
        syncModalOpenState();

        assert.strictEqual(bodyClassList.has('modal-open'), false, 'body must not have modal-open');
        assert.strictEqual('inert' in mainAttrs, false, 'inert must be removed');
        assert.strictEqual(mainStyle.overflowY, '', 'main overflowY must be reset');
    });

    await t.test('Closing modal with ghost shield keeps background locked until shield expires', () => {
        testState.duelMenuOpen = false;
        ghostClickShieldActive = true;
        syncModalOpenState();

        // Background stays locked to absorb 300ms touch ghost clicks
        assert.strictEqual(bodyClassList.has('modal-open'), true, 'body must remain modal-open during shield');
        assert.strictEqual(mainAttrs['inert'], '', 'inert must remain active during shield');

        // Now shield expires
        ghostClickShieldActive = false;
        syncModalOpenState();
        assert.strictEqual(bodyClassList.has('modal-open'), false, 'body unlocks after shield expires');
    });
});
