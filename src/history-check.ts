type HistoryMainModule = {
    main: () => void;
};

(async () => {
    try {
        const src = chrome.runtime.getURL('src/history-main.js');
        const historyMain = await import(src) as HistoryMainModule;
        historyMain.main();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[BackAsClose][Bootstrap] Failed to load content module.', { message });
    }
})();