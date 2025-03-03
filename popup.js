document.addEventListener("DOMContentLoaded", function () {
    const currencySelect = document.getElementById("currency");
    const mapButton = document.getElementById("mapButton");
    const mapDropdown = document.getElementById("mapDropdown");
    const mapItems = document.querySelectorAll(".map-item");

    const currencies = [
        { code: "USD", flag: "🇺🇸", symbol: "$" },
        { code: "EUR", flag: "🇪🇺", symbol: "€" },
        { code: "GBP", flag: "🇬🇧", symbol: "£" },
        { code: "CAD", flag: "🇨🇦", symbol: "C$" },
        { code: "AUD", flag: "🇦🇺", symbol: "A$" },
        { code: "JPY", flag: "🇯🇵", symbol: "¥" }
    ];

    // Default values
    const defaultMap = "Inferno"; // Default map name
    let selectedMap = defaultMap;

    // Load saved currency and map
    chrome.storage.sync.get(["selectedCurrency", "selectedMap"], (data) => {
        let selectedCurrency = data.selectedCurrency || "USD"; // Default to USD
        selectedMap = data.selectedMap || defaultMap; // Default to Inferno
        updateDropdown(selectedCurrency);
        mapButton.textContent = selectedMap; // Update button text
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

    // Toggle dropdown visibility on map button click
    mapButton.addEventListener("click", function () {
        mapDropdown.classList.toggle("visible");
    });

    // Map selection logic
    mapItems.forEach(item => {
        item.addEventListener("click", function () {
            const mapName = this.querySelector("span").textContent; // Get map name
            selectedMap = mapName;
            mapButton.textContent = selectedMap; // Update button text
            chrome.storage.sync.set({ selectedMap: selectedMap }); // Save in storage
            mapDropdown.classList.remove("visible"); // Hide dropdown
        });
    });
});
