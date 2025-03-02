console.log("YouPinPlus is running...");

// Fetch exchange rate
async function fetchExchangeRate(targetCurrency) {
    try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/CNY");
        const data = await response.json();
        return data.rates[targetCurrency] || null;
    } catch (error) {
        console.error("❌ Error fetching exchange rate:", error);
        return null;
    }
}

// Request the user's selected currency
function getSelectedCurrency() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "getCurrency" }, (response) => {
            resolve(response.currency || "USD");
        });
    });
}

async function convertPrices() {
    const targetCurrency = await getSelectedCurrency();
    const exchangeRate = await fetchExchangeRate(targetCurrency);

    if (!exchangeRate) {
        console.warn("❌ Exchange rate not available. Stopping.");
        return;
    }

    const tbodyElement = document.querySelector("tbody.ant-table-tbody");

    if (tbodyElement) {
        console.log("✅ Found tbody:", tbodyElement);

        const rows = tbodyElement.querySelectorAll("tr.ant-table-row.ant-table-row-level-0");

        rows.forEach((row, index) => {
            const priceElement = row.querySelector(".price-box___es1Cs span");

            if (priceElement) {
                const priceCNY = parseFloat(priceElement.textContent.replace("¥", "").trim());

                if (!isNaN(priceCNY)) {
                    const priceConverted = (priceCNY * exchangeRate).toFixed(2);

                    console.log(`Row ${index + 1}: ¥${priceCNY} → ${priceConverted} ${targetCurrency}`);

                    // Check if conversion is already displayed
                    if (!priceElement.nextElementSibling || !priceElement.nextElementSibling.classList.contains("converted-price")) {
                        const convertedPriceElement = document.createElement("div");
                        convertedPriceElement.className = "converted-price";
                        convertedPriceElement.style.color = "grey";
                        convertedPriceElement.style.fontSize = "12px";
                        convertedPriceElement.style.marginTop = "2px";
                        convertedPriceElement.textContent = `${priceConverted} ${targetCurrency}`;
                        priceElement.parentNode.appendChild(convertedPriceElement);
                    }
                }
            }
        });
    }
}

// Run script on refresh
setInterval(convertPrices, 3000);
