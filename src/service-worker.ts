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

const LOG_PREFIX = '[BackAsClose][Background]';

interface RestoredTabInfo {
    url: string;
    title?: string;
    createdAt: number;
    timeoutId?: number;
}

let lastClosedTab: RestoredTabInfo | null = null;
let bannerTabId: number | null = null;

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
        console.debug(`${LOG_PREFIX} Failed to hide restore banner.`, { at: new Date().toISOString(), tabId: targetTabId, error: errorMessage });
    }
}

async function showRestoreBanner(timeoutMs: number, closedTabTitle?: string): Promise<void> {
    await hideRestoreBanner();

    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    if (!activeTab?.id) {
        console.debug(`${LOG_PREFIX} No active tab available for restore banner.`);
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
        console.debug(`${LOG_PREFIX} Restore banner shown.`, { at: new Date().toISOString(), tabId: activeTab.id });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.debug(`${LOG_PREFIX} Failed to show restore banner.`, { at: new Date().toISOString(), tabId: activeTab.id, error: errorMessage });
    }
}

function setRestoreTimeout(timeoutMs: number): void {
    if (!lastClosedTab) return;

    clearRestoreTimeout();

    lastClosedTab.timeoutId = setTimeout(() => {
        console.debug(`${LOG_PREFIX} Restore timeout expired, discarding tab info.`, { at: new Date().toISOString(), url: lastClosedTab?.url });
        lastClosedTab = null;
        void hideRestoreBanner();
    }, timeoutMs) as unknown as number;
}

async function handleCloseTab(tabId: number, url?: string, title?: string): Promise<void> {
    console.debug(`${LOG_PREFIX} Recording closed tab for potential restore.`, { at: new Date().toISOString(), tabId, url, title });

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
        console.debug(`${LOG_PREFIX} No tab available for restore.`);
        sendResponse({ handled: true, action: 'no-restore' });
        return;
    }

    console.debug(`${LOG_PREFIX} Restore available, creating new tab.`, { at: new Date().toISOString(), url: lastClosedTab.url });
    const tabUrl = lastClosedTab.url;

    chrome.tabs.create({ url: tabUrl })
        .then((newTab) => {
            console.debug(`${LOG_PREFIX} Tab restored successfully.`, { at: new Date().toISOString(), tabId: newTab.id, url: tabUrl });
            clearRestoreTimeout();
            lastClosedTab = null;
            void hideRestoreBanner();
            sendResponse({ handled: true, action: 'restore-tab', restoredUrl: tabUrl });
        })
        .catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.debug(`${LOG_PREFIX} Failed to restore tab.`, { at: new Date().toISOString(), error: errorMessage });
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

        console.debug(`${LOG_PREFIX} Received CLOSE_TAB request.`, { at: new Date().toISOString(), tabId, url: tabUrl, title: tabTitle });

        chrome.tabs.remove(tabId)
            .then(() => {
                console.debug(`${LOG_PREFIX} Tab closed successfully.`, { at: new Date().toISOString(), tabId });
                return handleCloseTab(tabId, tabUrl, tabTitle);
            })
            .then(() => {
                sendResponse({ handled: true, action: 'close-tab' });
            })
            .catch((error: unknown) => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.debug(`${LOG_PREFIX} Failed to close tab.`, { at: new Date().toISOString(), tabId, error: errorMessage });
                sendResponse({ handled: false, error: errorMessage });
            });

        return true;
    }

    if (isTryRestoreMessage(message) || isRestoreTabMessage(message)) {
        console.debug(`${LOG_PREFIX} Received restore request.`);
        handleTryRestore(sendResponse);
        return true;
    }

    return false;
});

console.debug(`${LOG_PREFIX} Background service worker initialized.`);