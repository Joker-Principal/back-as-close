const MESSAGE_TYPES = {
    CLOSE_TAB: 'CLOSE_TAB'
};
const DEBUG_LOG_ENABLED = true;
const LOG_PREFIX = '[BackAsClose][Content]';

let pageUnloading = false;

function logDebug(message, context = {}) {
    if (!DEBUG_LOG_ENABLED) {
        return;
    }

    console.debug(`${LOG_PREFIX} ${message}`, {
        at: new Date().toISOString(),
        ...context
    });
}

async function handleBackIntent() {
    if (pageUnloading) {
        logDebug('Ignoring back because page is unloading.');
        return;
    }

    const prevPage = window.location.href;
    logDebug('Handling back intent.', { currentUrl: prevPage });
    window.history.back();

    await new Promise(resolve => setTimeout(resolve, 200));

    const currentUrl = window.location.href;
    logDebug('Back navigation attempt completed.', { currentUrl });

    if (currentUrl == prevPage) {
        try {
            logDebug('No history entry to go back to, sending CLOSE_TAB message.');
            await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CLOSE_TAB });
        } catch (error) {
            logDebug('Error sending CLOSE_TAB message.', { error: error?.message });
        }
    }
}

function handleBackMouseEvent(event) {
    if (event.button !== 3) {
        return;
    }

    logDebug('Captured mouse back event.', {
        eventType: event.type,
        button: event.button,
        buttons: event.buttons
    });
    event.preventDefault();
    event.stopImmediatePropagation();
    void handleBackIntent();
}

function handleKeyDown(event) {
    const target = event.target;
    const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT');
    const isBackShortcut = event.key === 'BrowserBack' || (event.altKey && event.key === 'ArrowLeft');
    if (!isBackShortcut || isEditable) {
        return;
    }

    logDebug('Captured keyboard back shortcut.', {
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey
    });
    event.preventDefault();
    event.stopImmediatePropagation();
    void handleBackIntent();
}

window.addEventListener('auxclick', handleBackMouseEvent, true);
window.addEventListener('keydown', handleKeyDown, true);

window.addEventListener('beforeunload', () => {
    pageUnloading = true;
    logDebug('Page unloading detected. Stopping event handling.');
});

logDebug('Content script initialized (single-event mode: auxclick + keydown).');