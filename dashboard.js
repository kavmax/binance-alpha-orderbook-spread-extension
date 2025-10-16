console.log('Dashboard loaded');

class TradingPair {
    constructor(base, quote) {
        this.base = base;
        this.quote = quote;
        this.orderBookData = [];
    }
}

class Spread {
    constructor(base, usdt_usdc, usdt_usdc_arbitrage, usdc_usdt, usdc_usdt_arbitrage) {
        this.base = base;
        this.usdt_usdc = usdt_usdc;
        this.usdt_usdc_arbitrage = usdt_usdc_arbitrage;
        this.usdc_usdt = usdc_usdt;
        this.usdc_usdt_arbitrage = usdc_usdt_arbitrage;
    }
}

// ["base"]["quote"] = orderBookData
let orderBooks = {};

// Обработка сообщений от background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'fullOrderBookData') {

        // console.log('Received fullOrderBookData:');

        const { orderBookData, currencyInfo } = message.data;
        const { base, quote } = currencyInfo;

        if (base && quote) {
            if (!orderBooks[base]) orderBooks[base] = {};
            orderBooks[base][quote] = orderBookData
            let now = new Date()
            orderBooks[base]["update_time"] = now.toLocaleTimeString("en-GB", {hour12: false})

            // console.log(`Received orderbook data for ${base} ${quote}:`, orderBooks[base]);
            renderAvailableCurrencies()
            renderSpreads()
        } else {
            console.log(`Background JS message received: base: ${base}, quote: ${quote}`)
        }
    }
});

function renderAvailableCurrencies() {
    const availableCurrenciesDiv = document.getElementById('availableCurrencies');
    let allCurrencies = ""

    for (const [base, quotes] of Object.entries(orderBooks)) {
        const quoteNames = Object.keys(quotes).join(', ');
        allCurrencies += `${base} (${quoteNames})\n`;
    }

    availableCurrenciesDiv.innerHTML = allCurrencies;
}

function findLastSidePrice(orderBookData, side) {
    if (side === 'buy' || side === 'sell') {
        return orderBookData.find(order => order.side === side).price;
    }
}

function calculateArbitrageSpread(usdt_data, usdc_data) {
    buy_price_usdt = findLastSidePrice(usdt_data, 'buy')
    sell_price_usdc = findLastSidePrice(usdc_data, 'sell')

    const absolute_profit = sell_price_usdc - buy_price_usdt
    const profit_percent = (absolute_profit / buy_price_usdt) * 100

    return (absolute_profit / buy_price_usdt) * 100
}

function calculateSpread(usdt_data, usdc_data) {

    buy_price_usdt = findLastSidePrice(usdt_data, 'buy')
    sell_price_usdc = findLastSidePrice(usdc_data, 'sell')

    return sell_price_usdc - buy_price_usdt
}

function timeToSeconds(timeStr) {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
}

function diffBetweenTimes(t1, t2) {
    const diff = Math.abs(timeToSeconds(t1) - timeToSeconds(t2));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calculateAllSpreads() {
    allSpreads = []
    for (const [base, quotes] of Object.entries(orderBooks)) {
        const hasUSDT = "USDT" in quotes;
        const hasUSDC = "USDC" in quotes;

        if (hasUSDT && hasUSDC) {

            usdt_usdc_spread = calculateSpread(quotes["USDT"], quotes["USDC"])
            usdt_usdc_percent_spread = calculateArbitrageSpread(quotes["USDT"], quotes["USDC"])

            usdc_usdt_spread = calculateSpread(quotes["USDC"], quotes["USDT"])
            usdc_usdt_percent_spread = calculateArbitrageSpread(quotes["USDC"], quotes["USDT"])

            time_diff_full = diffBetweenTimes(quotes["USDT"][0].time, quotes["USDC"][0].time)

            allSpreads.push({
                "usdt_usdc": usdt_usdc_spread,
                "usdt_usdc_arbitrage": usdt_usdc_percent_spread,
                "usdc_usdt": usdc_usdt_spread,
                "usdc_usdt_arbitrage": usdc_usdt_percent_spread,
                "base": base,
                "time_diff_full": `${time_diff_full} | ${quotes["USDT"][0].time} | ${quotes["USDC"][0].time}`,
                "time_diff": time_diff_full

            })
        } else if (hasUSDT) {
            console.log(`${base} имеет только USDT`);
        } else if (hasUSDC) {
            console.log(`${base} имеет только USDC`);
        } else {
            console.log(`${base} не имеет ни USDT, ни USDC`);
        }
    }
    return allSpreads
}

function renderSpreads() {
    spreadsInfoDiv = document.getElementById('spreadsInfo')

    allSpreads = calculateAllSpreads()
    allSpreads.sort((a, b) => b.usdt_usdc_arbitrage - a.usdt_usdc_arbitrage)

    // Разделим на 2 таблицы
    let tableRows = '';

    allSpreads.forEach(spread => {
        // Преобразуем строку "HH:MM:SS" в секунды
        const [hours, minutes, seconds] = spread.time_diff.split(':').map(Number);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;

        let rowStyle = "background-color: rgba(255, 0, 0, 0.10);"
        if (totalSeconds <= 60 && spread.usdt_usdc_arbitrage >= 0.12)
            rowStyle = "background-color: rgba(0, 255, 0, 0.15);";
        else if (totalSeconds <= 60)
            rowStyle = "background-color: rgba(128, 128, 128, 0.15);";

        // Общая строка для таблицы
        const rowHTML = `
            <tr style="${rowStyle}">
                <td><b>${spread.base}</b></td>
                <td>
                    ${spread.usdt_usdc} 
                </td>
                <td>${spread.usdt_usdc_arbitrage.toFixed(6)}%</td>
                <td>${spread.time_diff_full}</td>
                <td>${spread.usdc_usdt}</td>
            </tr>
        `;

        tableRows += rowHTML;
    });

    // Две таблицы
    const tableHTML = `
        <table style="border-collapse: collapse; width: 100%; border: 1px solid #aaa;">
            <thead>
                <tr style="border: 1px solid #aaa; padding: 4px;">
                    <th>Base</th>
                    <th>USDT → USDC Spread</th>
                    <th>%</th>
                    <th>USDT → USDC Time Diff</th>
                    <th>USDC → USDT Spread</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
    `;

    spreadsInfoDiv.innerHTML = tableHTML;
}
