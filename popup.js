document.addEventListener("DOMContentLoaded", function () {
    const currencySelect = document.getElementById("currency");
    const currencies = [
        { code: "USD", flag: "🇺🇸", symbol: "$" },
        { code: "EUR", flag: "🇪🇺", symbol: "€" },
        { code: "GBP", flag: "🇬🇧", symbol: "£" },
        { code: "CAD", flag: "🇨🇦", symbol: "C$" },
        { code: "AUD", flag: "🇦🇺", symbol: "A$" },
        { code: "JPY", flag: "🇯🇵", symbol: "¥" }
    ];

    // Load saved currency
    chrome.storage.sync.get("selectedCurrency", (data) => {
        let selectedCurrency = data.selectedCurrency || "USD"; // Default to USD
        updateDropdown(selectedCurrency);
    });

    // Update dropdown order when currency changes
    currencySelect.addEventListener("change", function () {
        const newCurrency = this.value;
        chrome.storage.sync.set({ selectedCurrency: newCurrency });
        updateDropdown(newCurrency);
    });

    function updateDropdown(selectedCurrency) {
        // Sort currencies: selected one first, others below
        let sortedCurrencies = currencies.filter(c => c.code !== selectedCurrency);
        sortedCurrencies.unshift(currencies.find(c => c.code === selectedCurrency));

        // Rebuild the dropdown
        currencySelect.innerHTML = sortedCurrencies
            .map(c => `<option value="${c.code}">${c.flag} ${c.code} - ${c.symbol}</option>`)
            .join("");
    }
});
