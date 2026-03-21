import {
    createHideRestoreBannerMessage,
    createShowRestoreBannerMessage,
    isBackAsCloseMessage,
    MESSAGE_TYPES,
    type WorkerResponse,
    type TryRestoreMessage,
    type RestoreTabMessage
} from './shared/message-types.js';
import { loadSettings } from './shared/settings.js';

const DEBUG_LOG_ENABLED = true;
const LOG_PREFIX = '[BackAsClose][Background]';

interface RestoredTabInfo {
    url: string;
    title?: string;
    createdAt: number;
    timeoutId?: number;
}

let lastClosedTab: RestoredTabInfo | null = null;
let bannerTabId: number | null = null;

function logDebug(message: string, context: Record<string, unknown> = {}): void {
    if (!DEBUG_LOG_ENABLED) {
        return;
    }

    console.debug(`${LOG_PREFIX} ${message}`, {
        at: new Date().toISOString(),
        ...context
    });
}

function clearRestoreTimeout(): void {
    if (lastClosedTab?.timeoutId) {
        clearTimeout(lastClosedTab.timeoutId);
        lastClosedTab.timeoutId = undefined;
    }
}

async function hideRestoreBanner(): Promise<void> {
    if (bannerTabId === null) {
        return;
    }

    const targetTabId = bannerTabId;
    bannerTabId = null;

    try {
        await chrome.tabs.sendMessage(targetTabId, createHideRestoreBannerMessage());
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logDebug('Failed to hide restore banner.', { tabId: targetTabId, error: errorMessage });
    }
}

async function showRestoreBanner(timeoutMs: number, closedTabTitle?: string): Promise<void> {
    await hideRestoreBanner();

    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    if (!activeTab?.id) {
        logDebug('No active tab available for restore banner.');
        return;
    }

    try {
        await chrome.tabs.sendMessage(
            activeTab.id,
            createShowRestoreBannerMessage(
                Math.max(1, Math.floor(timeoutMs / 1000)),
                closedTabTitle
            )
        );
        bannerTabId = activeTab.id;
        logDebug('Restore banner shown.', { tabId: activeTab.id });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logDebug('Failed to show restore banner.', { tabId: activeTab.id, error: errorMessage });
    }
}

function setRestoreTimeout(timeoutMs: number): void {
    if (!lastClosedTab) return;

    clearRestoreTimeout();

    lastClosedTab.timeoutId = setTimeout(() => {
        logDebug('Restore timeout expired, discarding tab info.', { url: lastClosedTab?.url });
        lastClosedTab = null;
        void hideRestoreBanner();
    }, timeoutMs) as unknown as number;
}

async function handleCloseTab(tabId: number, url?: string, title?: string): Promise<void> {
    logDebug('Recording closed tab for potential restore.', { tabId, url, title });

    const settings = await loadSettings();
    const timeoutMs = settings.restoreTimeoutSeconds * 1000;

    lastClosedTab = {
        url: url || 'about:blank',
        title,
        createdAt: Date.now()
    };

    setRestoreTimeout(timeoutMs);
    await showRestoreBanner(timeoutMs, title || url || '未知页面');
}

function handleTryRestore(sendResponse: (response: WorkerResponse) => void): void {
    if (!lastClosedTab) {
        logDebug('No tab available for restore.');
        sendResponse({ handled: true, action: 'no-restore' });
        return;
    }

    logDebug('Restore available, creating new tab.', { url: lastClosedTab.url });
    const tabUrl = lastClosedTab.url;

    chrome.tabs.create({ url: tabUrl })
        .then((newTab) => {
            logDebug('Tab restored successfully.', { tabId: newTab.id, url: tabUrl });
            clearRestoreTimeout();
            lastClosedTab = null;
            void hideRestoreBanner();
            sendResponse({ handled: true, action: 'restore-tab', restoredUrl: tabUrl });
        })
        .catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logDebug('Failed to restore tab.', { error: errorMessage });
            sendResponse({ handled: false, error: errorMessage, action: 'no-restore' });
        });
}

function isTryRestoreMessage(msg: unknown): msg is TryRestoreMessage {
    if (!msg || typeof msg !== 'object') {
        return false;
    }
    return (msg as Record<string, unknown>).type === MESSAGE_TYPES.TRY_RESTORE;
}

function isRestoreTabMessage(msg: unknown): msg is RestoreTabMessage {
    if (!msg || typeof msg !== 'object') {
        return false;
    }
    return (msg as Record<string, unknown>).type === MESSAGE_TYPES.RESTORE_TAB;
}

chrome.runtime.onMessage.addListener((
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: WorkerResponse) => void
): boolean => {
    if (!isBackAsCloseMessage(message)) {
        return false;
    }

    if (message.type === MESSAGE_TYPES.CLOSE_TAB && sender.tab?.id) {
        const tabId = sender.tab.id;
        const tabUrl = sender.tab.url;
        const tabTitle = sender.tab.title;

        logDebug('Received CLOSE_TAB request.', { tabId, url: tabUrl, title: tabTitle });

        chrome.tabs.remove(tabId)
            .then(() => {
                logDebug('Tab closed successfully.', { tabId });
                return handleCloseTab(tabId, tabUrl, tabTitle);
            })
            .then(() => {
                sendResponse({ handled: true, action: 'close-tab' });
            })
            .catch((error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logDebug('Failed to close tab.', { tabId, error: errorMessage });
                sendResponse({ handled: false, error: errorMessage });
            });

        return true;
    }

    if (isTryRestoreMessage(message) || isRestoreTabMessage(message)) {
        logDebug('Received restore request.');
        handleTryRestore(sendResponse);
        return true;
    }

    return false;
});

logDebug('Background service worker initialized.');