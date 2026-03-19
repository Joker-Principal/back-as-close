const MESSAGE_TYPES = {
    CLOSE_TAB: 'CLOSE_TAB'
};
const DEBUG_LOG_ENABLED = true;
const LOG_PREFIX = '[BackAsClose][Background]';

function logDebug(message, context = {}) {
    if (!DEBUG_LOG_ENABLED) {
        return;
    }

    console.debug(`${LOG_PREFIX} ${message}`, {
        at: new Date().toISOString(),
        ...context
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== MESSAGE_TYPES.CLOSE_TAB || !sender.tab?.id) {
        return false;
    }

    const tabId = sender.tab.id;
    logDebug('Received CLOSE_TAB request.', { tabId, url: sender.tab.url });

    chrome.tabs.remove(tabId)
        .then(() => {
            logDebug('Tab closed successfully.', { tabId });
            sendResponse({ handled: true, action: 'close-tab' });
        })
        .catch((error) => {
            logDebug('Failed to close tab.', { tabId, error: error?.message });
            sendResponse({ handled: false, error: error?.message });
        });

    return true;
});

logDebug('Background service worker initialized.');