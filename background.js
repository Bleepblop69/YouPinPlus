chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getCurrency") {
        chrome.storage.sync.get(["selectedCurrency"], (data) => {
            sendResponse({ currency: data.selectedCurrency || "USD" });
        });
        return true; // Required for async response
    }
});
