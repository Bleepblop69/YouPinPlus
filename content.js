
window.addEventListener('YPP_SELL_ORDER_REQUEST', (e) => processSellOrder(e.detail));
window.addEventListener('YPP_MARKET_GOODS_REQUEST', (e) => processMarketGoods(e.detail));
window.addEventListener('YPP_SELL_PAGE_REQUEST', (e) => processSellPage(e.detail));
window.addEventListener('YPP_BUY_PAGE_REQUEST', (e) => processBuyOrder(e.detail));
window.addEventListener('YPP_LEASE_PAGE_REQUEST', (e) => processLeasePage(e.detail));
window.addEventListener('YPP_INV_PAGE_REQUEST', (e) => processInvPage(e.detail));
window.addEventListener('YPP_MAIN_PAGE_REQUEST', (e) => processMainPage(e.detail));


let activeRequests = new Set();

window.addEventListener('message', (e) => {
    if (e.data['transferType'] !== 'YPP_INJECTION_SERVICE') return;

    const targetMappings = {
        'https://api.youpin898.com/api/homepage/pc/goods/market/queryOnSaleCommodityList': 'YPP_SELL_ORDER_REQUEST',
        'https://api.youpin898.com/api/homepage/pc/goods/market/querySaleTemplate': 'YPP_SELL_PAGE_REQUEST',
        'https://api.youpin898.com/api/youpin/bff/trade/purchase/order/getTemplatePurchaseOrderListPC': 'YPP_BUY_PAGE_REQUEST',
        'https://api.youpin898.com/api/youpin/pc/inventory/list': 'YPP_INV_PAGE_REQUEST',
        'https://api.youpin898.com/api/homepage/pc/goods/market/queryLeaseTemplate': 'YPP_LEASE_PAGE_REQUEST',
        'https://api.youpin898.com/api/youpin/commodity/adapter/public/csgo/template/page': 'YPP_MAIN_PAGE_REQUEST'
    };

    const eventType = targetMappings[e.data.url];
    if (!eventType) return;

    console.log(e.data);

    const key = `${e.data.url}-${e.data.status}`;

    if (!activeRequests.has(key)) {
        activeRequests.add(key);
        console.log(`[YPP] Request Intercepted: ${e.data.status} -> ${e.data.url}`);
        console.log("calling sell functions");

        // Dispatch event
        window.dispatchEvent(new CustomEvent(eventType, { detail: e.data }));

        // Remove request from active set after a short delay
        setTimeout(() => {
            activeRequests.delete(key);
            console.log(`[YPP] Cleared request key: ${key}`);
        }, 500); // Adjust delay if needed
    }
});

function injectCodeImmediately(code) {
    let a = document.createElement('a');

    let inner = `s.innerHTML=\`${code}\``;
    code = btoa(encodeURIComponent(code));
    inner = `s.innerHTML=decodeURIComponent(atob('${code}'))`;

    a.setAttribute('style', 'display: none !important;');
    a.setAttribute('onclick', `(function() { 
        let s = document.createElement('script');
        s.setAttribute('data-isl', 'injected-script');
        ${inner};
        document.children[0].appendChild(s); 
    })();`);

    a.click();
    a.remove();

    console.log('[YPP] Injected.');
}

function interceptNetworkRequests() {
    const open = window.XMLHttpRequest.prototype.open;
    console.log(open)
    const isNative = open.toString().indexOf('native code') != -1;
    console.log(isNative)
    if (!isNative) {
        window.XMLHttpRequest.prototype.open = function() {
            (this).addEventListener('load', (e) => {
                let current = e.currentTarget
                console.log("current: "+ current)
                function tryParseJSON(r) {
                    try {
                        return JSON.parse(r);
                    } catch (_) {
                        return {
                            data: { raw_content: r }
                        };
                    }
                }

                if (current.readyState == 4) {
                    window.postMessage({
                        transferType: 'YPP_INJECTION_SERVICE',
                        status: current.status,
                        url: current.responseURL,
                        data: tryParseJSON(current.responseText)
                    }, '*');
                }
            });

            return open.apply(this, arguments);
        };
    }
}

function addAnchorClipboardAction(a, text) {
    a.addEventListener('click', () => {
        navigator?.clipboard?.writeText(text).then(() => {
            console.debug(`[BuffGen] Copied: ${text}`);
        }).catch((e) => console.error('[BuffGen]', e));
    });
}

function addVariableText(a, text) {
    let initial = a.innerHTML
    a.addEventListener('click', () => {
        a.innerHTML = text
        setTimeout(() => {
            a.innerHTML = initial
        }, 1000);
    });
}

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
async function getSelectedCurrency() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "getCurrency" }, (response) => {
            resolve(response.currency || "USD");
        });
    });
}

// Function to handle map selection
document.querySelectorAll(".map-item").forEach(item => {
    item.addEventListener("click", function () {
        const selectedMap = this.querySelector("span").textContent.trim();
        console.log(`[YPP] Map selected: ${selectedMap}`);

        // Store selected map in Chrome storage
        chrome.storage.sync.set({ selectedMap }, () => {
            console.log(`[YPP] Stored selected map: ${selectedMap}`);
            processSellOrder(); // Re-run processing with new map
        });
    });
});


function searchFloatDB(datarow) {
    const itemName = encodeURIComponent(datarow.commodityHashName);
    const floatDBUrl = `https://floatdb.com/search?q=${itemName}`;
    console.log(`[YPP] Searching FloatDB for: ${itemName}`);
    window.open(floatDBUrl, "_blank");
}

// Modified processSellOrder function
async function processSellOrder(transferData, retryCount = 10, delay = 1000) {
    let data = transferData?.data?.Data || [];
    let attempts = 0;
    console.log(transferData);
    console.log(data);

    // Get user currency and exchange rate
    const targetCurrency = await getSelectedCurrency();
    const exchangeRate = await fetchExchangeRate(targetCurrency);

    if (!exchangeRate) {
        console.warn("❌ Exchange rate not available. Stopping.");
        return;
    }

    // Retrieve the selected map from storage
    chrome.storage.sync.get("selectedMap", (storedData) => {
        const selectedMap = storedData.selectedMap || "Inferno"; // Default to Inferno
        const formattedMapName = selectedMap.toLowerCase(); // Convert to lowercase for URL

        console.log(`[YPP] Selected map: ${selectedMap}, URL: steam://rungame/730/76561202255233023/+connect%${formattedMapName}.epidemic.gg`);

        const interval = setInterval(() => {
            const titles = document.querySelectorAll(".title___TIj4n" || ".ant-breadcrumb-link");
            titles.forEach((title, index) => {
                if (title.innerHTML.trim() !== "饰品市场") {
                    const translatedTitle = data[index]?.commodityHashName || "Default Title";
                    console.log(`Updating: ${title.innerHTML} → ${translatedTitle}`);
                    title.innerHTML = translatedTitle;
                } else {
                    console.log(`Skipping: ${title.innerHTML}`);
                }
            });

            const saleRows = document.querySelectorAll(".ant-table-row.ant-table-row-level-0");

            if (saleRows.length > 0) {
                console.log(`[YPP] Found ${saleRows.length} sale rows.`);
                const saleRowsData = Array.from(saleRows);

                saleRowsData.forEach(async (row, index) => {
                    let datarow = data[index] || {};
                    console.log(datarow);

                    const wearContainer = row.children[1];
                    const priceContainer = row.children[4];
                    const priceElement = priceContainer.firstChild;
                    const priceCNY = priceElement.textContent.replace("¥", "").trim();

                    // Only create buttons if datarow.actions is not empty
                    if (datarow.actions && datarow.actions.trim() !== "") {
                        // Prevent duplicate buttons
                        if (!wearContainer.querySelector(".inspect-btn-container")) {
                            const isSticker = datarow.typeName === "印花"; // Check if it's a sticker

                            // Create a container div for the buttons
                            const buttonContainer = document.createElement("div");
                            buttonContainer.className = "inspect-btn-container";
                            buttonContainer.style.display = "flex"; // Align buttons in a row
                            buttonContainer.style.gap = "5px"; // Add spacing between buttons
                            buttonContainer.style.marginTop = "5px"; // Add spacing from elements above

                            if (!isSticker) { // Skip Inspect In-Server for stickers
                                // Inspect In-Server Button

                                 // Search FloatDB Button
                                 const searchFloatDBButton = document.createElement("button");
                                 searchFloatDBButton.className = "search-floatdb-btn";
                                 searchFloatDBButton.textContent = "FloatDB";
                                 searchFloatDBButton.style.padding = "5px 10px";
                                 searchFloatDBButton.style.fontSize = "10px";
                                 searchFloatDBButton.style.backgroundColor = "#444";
                                 searchFloatDBButton.style.color = "white";
                                 searchFloatDBButton.style.border = "none";
                                 searchFloatDBButton.style.cursor = "pointer";
                                 searchFloatDBButton.style.borderRadius = "3px";
 
                                 searchFloatDBButton.addEventListener("click", () => {
                                    searchFloatDB(datarow)
                                 });
 
                                 buttonContainer.appendChild(searchFloatDBButton);
                                 buttonContainer.appendChild(searchFloatDBButton);


                                const inspectServerButton = document.createElement("button");
                                inspectServerButton.className = "inspect-btn";
                                inspectServerButton.textContent = "In-Server";
                                inspectServerButton.style.padding = "5px 10px";
                                inspectServerButton.style.fontSize = "10px";
                                inspectServerButton.style.backgroundColor = "#444";
                                inspectServerButton.style.color = "white";
                                inspectServerButton.style.border = "none";
                                inspectServerButton.style.cursor = "pointer";
                                inspectServerButton.style.borderRadius = "3px";

                                inspectServerButton.addEventListener("click", () => {
                                    const connectURL = `steam://rungame/730/76561202255233023/+connect%20${formattedMapName}.epidemic.gg`;
                                    console.log(`[YPP] Connecting to: ${connectURL}`);
                                    window.location.href = connectURL;
                                });

                                buttonContainer.appendChild(inspectServerButton);

                               
                            }

                            // Inspect In-Game Button (always added if datarow.actions is not empty)
                            const inspectGameButton = document.createElement("button");
                            inspectGameButton.className = "inspect-btn";
                            inspectGameButton.textContent = "In-Game";
                            inspectGameButton.style.padding = "5px 10px";
                            inspectGameButton.style.fontSize = "10px";
                            inspectGameButton.style.backgroundColor = "#444";
                            inspectGameButton.style.color = "white";
                            inspectGameButton.style.border = "none";
                            inspectGameButton.style.cursor = "pointer";
                            inspectGameButton.style.borderRadius = "3px";

                            inspectGameButton.addEventListener("click", () => {
                                const inspectLink = datarow.actions; // Get inspect link from datarow.actions
                                console.log(`[YPP] Inspecting item: ${inspectLink}`);
                                window.location.href = inspectLink; // Open the in-game inspect link
                            });

                            buttonContainer.appendChild(inspectGameButton);
                            wearContainer.appendChild(buttonContainer);
                        }
                    }

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
                            convertedPriceElement.style.fontWeight = "bold";
                            convertedPriceElement.textContent = `${priceConverted} ${targetCurrency}`;
                            priceElement.parentNode.appendChild(convertedPriceElement);
                        }
                    }
                });

                clearInterval(interval); // Stop retrying once rows are found
            } else {
                console.log(`[YPP] No rows found. Retrying... (${attempts + 1}/${retryCount})`);
                attempts++;

                if (attempts >= retryCount) {
                    console.log("[YPP] No sale rows found after maximum retries.");
                    clearInterval(interval);
                }
            }
        }, delay);
    });
}


async function processBuyOrder(transferData, retryCount = 10, delay = 1000) {
    let data = transferData?.data?.data.purchaseOrderResponseList || [];
    let attempts = 0;
    console.log(transferData);
    console.log(data);

    // Get user currency and exchange rate
    const targetCurrency = await getSelectedCurrency();
    const exchangeRate = await fetchExchangeRate(targetCurrency);

    if (!exchangeRate) {
        console.warn("❌ Exchange rate not available. Stopping.");
        return;
    }

    
    const interval = setInterval(() => {
        const saleRows = document.querySelectorAll(".ant-table-row.ant-table-row-level-0");
        if (saleRows.length > 0) {
            console.log(`[YPP] Found ${saleRows.length} sale rows.`);
            const saleRowsData = Array.from(saleRows);

            saleRowsData.forEach(async (row, index) => {
                let datarow = data[index] || {};
                console.log(datarow);
            
                const priceContainer = row.children[3];
                console.log(priceContainer)
                const priceElement = priceContainer.firstChild;
                const priceCNY = priceElement.textContent.replace("¥", "").trim();
            
                // Only create buttons if datarow.actions is not empty           
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
                        convertedPriceElement.style.fontWeight = "bold";
                        convertedPriceElement.textContent = `${priceConverted} ${targetCurrency}`;
                        priceElement.parentNode.appendChild(convertedPriceElement);
                    }
                }
            });

            clearInterval(interval); // Stop retrying once rows are found
        } else {
            console.log(`[YPP] No rows found. Retrying... (${attempts + 1}/${retryCount})`);
            attempts++;

            if (attempts >= retryCount) {
                console.log("[YPP] No sale rows found after maximum retries.");
                clearInterval(interval);
            }
        }
    }, delay);
}


async function processMainPage(transferData, retryCount = 10, delay = 1000) {
    console.log(transferData);
    let data = transferData?.data?.data.contents || [];

    let attempts = 0;

    console.log("You are on the sale page");

    // Get user currency and exchange rate
    const targetCurrency = await getSelectedCurrency();
    const exchangeRate = await fetchExchangeRate(targetCurrency);

    if (!exchangeRate) {
        console.warn("❌ Exchange rate not available. Stopping.");
        return;
    }

    const interval = setInterval(() => {
        const Listings = document.querySelectorAll(".each-common-product-box___Dxb3f");
        console.log(Listings);

        if (Listings.length > 0) {
            console.log(`[YPP] Found ${Listings.length} listings.`);

            Listings.forEach((listing, index) => {
                const priceContainer = listing.querySelector(".price___mNccC");
                const titleContainer = listing.querySelector(".footerTitle___GR3Eg");
                const rowdata = data[index];

                if (rowdata) {
                    // Update the title text
                    if (titleContainer) {
                        titleContainer.textContent = rowdata.commodityHashName || "Unknown Item";
                    }
                }

                if (priceContainer) {
                    // Remove old converted price if it exists
                    const existingConvertedPrice = priceContainer.querySelector(".converted-price");
                    if (existingConvertedPrice) {
                        existingConvertedPrice.remove();
                    }

                    const priceText = priceContainer.textContent.replace("¥", "").trim();
                    const priceCNY = parseFloat(priceText);

                    if (!isNaN(priceCNY)) {
                        const priceConverted = (priceCNY * exchangeRate).toFixed(2);
                        console.log(`¥${priceCNY} → ${priceConverted} ${targetCurrency}`);

                        // Create new converted price element
                        const convertedPriceElement = document.createElement("span");
                        convertedPriceElement.className = "converted-price";
                        convertedPriceElement.style.color = "grey";
                        convertedPriceElement.style.fontSize = "12px";
                        convertedPriceElement.style.marginLeft = "5px";
                        convertedPriceElement.style.fontWeight = "bold";
                        convertedPriceElement.textContent = `${priceConverted} ${targetCurrency}`;

                        priceContainer.appendChild(convertedPriceElement);
                    }
                }
            });

            clearInterval(interval); // Stop retrying once listings are found
        } else {
            console.log(`[YPP] No rows found. Retrying... (${attempts + 1}/${retryCount})`);
            attempts++;

            if (attempts >= retryCount) {
                console.log("[YPP] No sale rows found after maximum retries.");
                clearInterval(interval);
            }
        }
    }, delay);
}

async function processSellPage(transferData, retryCount = 10, delay = 1000) {
    console.log(transferData);
    let data = transferData?.data?.Data || [];

    let attempts = 0;

    console.log("You are on the sale page");

    // Get user currency and exchange rate
    const targetCurrency = await getSelectedCurrency();
    const exchangeRate = await fetchExchangeRate(targetCurrency);

    if (!exchangeRate) {
        console.warn("❌ Exchange rate not available. Stopping.");
        return;
    }

    const interval = setInterval(() => {
        const Listings = document.querySelectorAll(".each-common-product-box___W6KCr");
        console.log(Listings);

        if (Listings.length > 0) {
            console.log(`[YPP] Found ${Listings.length} listings.`);

            Listings.forEach((listing, index) => {
                const priceContainer = listing.querySelector(".price___mNccC");
                const titleContainer = listing.querySelector(".footerTitle___GR3Eg");
                const rowdata = data[index];

                if (rowdata) {
                    // Update the title text
                    if (titleContainer) {
                        titleContainer.textContent = rowdata.commodityHashName || "Unknown Item";
                    }
                }

                if (priceContainer) {
                    // Remove old converted price if it exists
                    const existingConvertedPrice = priceContainer.querySelector(".converted-price");
                    if (existingConvertedPrice) {
                        existingConvertedPrice.remove();
                    }

                    const priceText = priceContainer.textContent.replace("¥", "").trim();
                    const priceCNY = parseFloat(priceText);

                    if (!isNaN(priceCNY)) {
                        const priceConverted = (priceCNY * exchangeRate).toFixed(2);
                        console.log(`¥${priceCNY} → ${priceConverted} ${targetCurrency}`);

                        // Create new converted price element
                        const convertedPriceElement = document.createElement("span");
                        convertedPriceElement.className = "converted-price";
                        convertedPriceElement.style.color = "grey";
                        convertedPriceElement.style.fontSize = "12px";
                        convertedPriceElement.style.marginLeft = "5px";
                        convertedPriceElement.style.fontWeight = "bold";
                        convertedPriceElement.textContent = `${priceConverted} ${targetCurrency}`;

                        priceContainer.appendChild(convertedPriceElement);
                    }
                }
            });

            clearInterval(interval); // Stop retrying once listings are found
        } else {
            console.log(`[YPP] No rows found. Retrying... (${attempts + 1}/${retryCount})`);
            attempts++;

            if (attempts >= retryCount) {
                console.log("[YPP] No sale rows found after maximum retries.");
                clearInterval(interval);
            }
        }
    }, delay);
}

async function processLeasePage(transferData, retryCount = 10, delay = 1000) {
    console.log(transferData);
    let data = transferData?.data?.Data || [];

    let attempts = 0;

    console.log("You are on the sale page");

    // Get user currency and exchange rate
    const targetCurrency = await getSelectedCurrency();
    const exchangeRate = await fetchExchangeRate(targetCurrency);

    if (!exchangeRate) {
        console.warn("❌ Exchange rate not available. Stopping.");
        return;
    }

    const interval = setInterval(() => {
        const Listings = document.querySelectorAll(".each-common-product-box___xyWZd");
        console.log(Listings);

        if (Listings.length > 0) {
            console.log(`[YPP] Found ${Listings.length} listings.`);

            Listings.forEach((listing, index) => {
                const priceContainer = listing.querySelector(".price___mNccC");
                const titleContainer = listing.querySelector(".footerTitle___GR3Eg");
                const rowdata = data[index];

                if (rowdata) {
                    // Update the title text
                    if (titleContainer) {
                        titleContainer.textContent = rowdata.commodityHashName || "Unknown Item";
                    }
                }

                if (priceContainer) {
                    // Remove old converted price if it exists
                    const existingConvertedPrice = priceContainer.querySelector(".converted-price");
                    if (existingConvertedPrice) {
                        existingConvertedPrice.remove();
                    }

                    const priceText = priceContainer.textContent.replace("¥", "").trim();
                    const priceCNY = parseFloat(priceText);

                    if (!isNaN(priceCNY)) {
                        const priceConverted = (priceCNY * exchangeRate).toFixed(2);
                        console.log(`¥${priceCNY} → ${priceConverted} ${targetCurrency}`);

                        // Create new converted price element
                        const convertedPriceElement = document.createElement("span");
                        convertedPriceElement.className = "converted-price";
                        convertedPriceElement.style.color = "grey";
                        convertedPriceElement.style.fontSize = "12px";
                        convertedPriceElement.style.marginLeft = "5px";
                        convertedPriceElement.style.fontWeight = "bold";
                        convertedPriceElement.textContent = `${priceConverted} ${targetCurrency}/day`;

                        priceContainer.appendChild(convertedPriceElement);
                    }
                }
            });

            clearInterval(interval); // Stop retrying once listings are found
        } else {
            console.log(`[YPP] No rows found. Retrying... (${attempts + 1}/${retryCount})`);
            attempts++;

            if (attempts >= retryCount) {
                console.log("[YPP] No sale rows found after maximum retries.");
                clearInterval(interval);
            }
        }
    }, delay);
}

async function processInvPage(transferData, retryCount = 10, delay = 1000) {
    console.log(transferData);
    let data = transferData?.data?.data.itemsInfos || [];
    console.log(data)

    let attempts = 0;

    console.log("You are on the Inv page");

    // Get user currency and exchange rate
    const targetCurrency = await getSelectedCurrency();
    const exchangeRate = await fetchExchangeRate(targetCurrency);

    if (!exchangeRate) {
        console.warn("❌ Exchange rate not available. Stopping.");
        return;
    }

    const interval = setInterval(() => {
        const Listings = document.querySelectorAll(".each-common-product-box___u55qR");
        console.log(Listings);

        const elements = document.querySelectorAll(".nums___GwxOI");
        const totalInvValue = Array.from(elements).find(el => el.textContent.includes("¥"));

        console.log(totalInvValue)
        const totalInvValueText = totalInvValue.innerHTML.replace("¥", "").replace(/,/g, "").trim();
        console.log(totalInvValueText)
        const totalInvValueCNY = parseFloat(totalInvValueText);
        const existingConvertedPrice = totalInvValue.querySelector(".converted-price");
                    if (existingConvertedPrice) {
                        existingConvertedPrice.remove();
                    }
        if (!isNaN(totalInvValueCNY)) {
            const priceConverted = (totalInvValueCNY * exchangeRate).toFixed(2);
            console.log(`¥${totalInvValueCNY} → ${priceConverted} ${targetCurrency}`);

            // Create new converted price element
            const convertedPriceElement = document.createElement("span");
            convertedPriceElement.className = "converted-price";
            convertedPriceElement.style.color = "grey";
            convertedPriceElement.style.fontSize = "12px";
            convertedPriceElement.style.marginLeft = "5px";
            convertedPriceElement.style.fontWeight = "bold";
            convertedPriceElement.innerHTML = `${priceConverted} ${targetCurrency}`;

            totalInvValue.appendChild(convertedPriceElement);
        }


        if (Listings.length > 0) {
            console.log(`[YPP] Found ${Listings.length} listings.`);

            Listings.forEach((listing, index) => {
                const priceContainer = listing.querySelector(".price___mNccC");
                const titleContainer = listing.querySelector(".footerTitle___GR3Eg");
                const rowdata = data[index];


                if (rowdata) {
                    // Update the title text
                    if (titleContainer) {
                        titleContainer.textContent = rowdata.marketHashName || "Unknown Item";
                    }
                }

                if (priceContainer) {
                    // Remove old converted price if it exists
                    const existingConvertedPrice = priceContainer.querySelector(".converted-price");
                    if (existingConvertedPrice) {
                        existingConvertedPrice.remove();
                    }

                    const priceText = priceContainer.textContent.replace("¥", "").replace(/,/g, "").trim();
                    const priceCNY = parseFloat(priceText);

                    if (!isNaN(priceCNY)) {
                        const priceConverted = (priceCNY * exchangeRate).toFixed(2);
                        console.log(`¥${priceCNY} → ${priceConverted} ${targetCurrency}`);

                        // Create new converted price element
                        const convertedPriceElement = document.createElement("span");
                        convertedPriceElement.className = "converted-price";
                        convertedPriceElement.style.color = "grey";
                        convertedPriceElement.style.fontSize = "12px";
                        convertedPriceElement.style.marginLeft = "5px";
                        convertedPriceElement.style.fontWeight = "bold";
                        convertedPriceElement.textContent = `${priceConverted} ${targetCurrency}`;

                        priceContainer.appendChild(convertedPriceElement);
                    }
                }
            });

            clearInterval(interval); // Stop retrying once listings are found
        } else {
            console.log(`[YPP] No rows found. Retrying... (${attempts + 1}/${retryCount})`);
            attempts++;

            if (attempts >= retryCount) {
                console.log("[YPP] No sale rows found after maximum retries.");
                clearInterval(interval);
            }
        }
    }, delay);
}






// Start intercepting network requests
interceptNetworkRequests();

// Inject interception and observe tab changes
injectCodeImmediately(`
    ${interceptNetworkRequests.toString()}
    interceptNetworkRequests();
`);






function pStrCompare(first, second) {
    first = first.replace(/\s+/g, '');
    second = second.replace(/\s+/g, '');

    if (first === second) return 1;
    if (first.length < 2 || second.length < 2) return 0;

    let firstBigrams = {};
    for (let i = 0; i < first.length - 1; i++) {
        const bigram = first.substring(i, i + 2);
        firstBigrams[bigram] = firstBigrams[bigram] ? firstBigrams[bigram] + 1 : 1;
    }

    let intersectionSize = 0;
    for (let i = 0; i < second.length - 1; i++) {
        const bigram = second.substring(i, i + 2);
        const count = firstBigrams[bigram] ? firstBigrams[bigram] : 0;

        if (count > 0) {
            firstBigrams[bigram] = count - 1;
            intersectionSize ++;
        }
    }

    return (2.0 * intersectionSize) / (first.length + second.length - 2);
}

function build(tag, options = {}) {
    if (!tag || tag.length == 0) return null;

    // options = options ?? {};

    let result = `<${tag}`;

    // add common html attributes
    if (options.id && options.id.length > 0) {
        result += ` id="${options.id}"`;
    }

    if (options.class && options.class.length > 0) {
        result += ` class="${options.class}"`;
    }

    let styles = options.style;
    if (styles && Object.keys(styles).length > 0) {
        result += ' style="';
        let keys = Object.keys(styles);
        for (let l_Key of keys) {
            if (l_Key.length > 0) {
                result += `${l_Key}: ${styles[l_Key]};`;
            }
        }
        result += '"';
    }

    // add other additional attributes
    let attributes = options.attributes;
    if (attributes) {
        let keys = Object.keys(attributes);
        if (keys.length > 0) {
            for (let l_Key of keys) {
                if (l_Key && l_Key.length > 0) {
                    result += ` ${l_Key}`;

                    let value = attributes[l_Key];
                    if (value && value.length > 0) {
                        result += `="${value}"`;
                    }
                }
            }
        }
    }

    // Check if the tag can be self closed
    let selfClosing = /area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr/g.test(tag);

    let isPreContentSet = false;

    // If the tag cannot be self closed append pre content
    if (!selfClosing) {
        isPreContentSet = true;
        result += '>';
    }

    // add content, will disable selfClosing as self-closing tags cannot have content
    let content = options.content;
    if (Array.isArray(content) && content.length > 0) {
        for (let l_Content of content) {
            if (!l_Content || typeof l_Content != 'string' || l_Content.length == 0) continue;

            if (!isPreContentSet) {
                isPreContentSet = true;
                selfClosing = false;

                result += '>';
            }

            result += l_Content;
        }
    }

    return `${result}${selfClosing ? '/>' : `</${tag}>`}`;
}




injectCodeImmediately(`
    ${interceptNetworkRequests.toString()}
    interceptNetworkRequests();
`);