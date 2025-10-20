function secondsToTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function timeNow() {
    const now = new Date();
    return now.toLocaleTimeString('en-GB', { hour12: false });
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

class TransactionsQuotePair {
    constructor(base) {
        this.base = base;
        this.usdtTransactions = [];
        this.usdcTransactions = [];
        this.usdtTransactionsUpdateTime = null;
        this.usdtLastTransactionUpdateTime = null;
        this.usdcTransactionsUpdateTime = null;
        this.usdcLastTransactionUpdateTime = null;
    }

    setTransactions(transactions, quote) {
        const now = new Date();
        const updateTime = now.toLocaleTimeString('en-GB', { hour12: false });

        if (quote.toUpperCase() === "USDC") {
            this.usdcTransactions = transactions;
            this.usdcTransactionsUpdateTime = updateTime;
            this.usdtLastTransactionUpdateTime = this.getLastTransactionUpdateTime(transactions);
        } else if (quote.toUpperCase() === "USDT") {
            this.usdtTransactions = transactions;
            this.usdtTransactionsUpdateTime = updateTime;
            this.usdcLastTransactionUpdateTime = this.getLastTransactionUpdateTime(transactions);
        } else {
            throw new Error(`Invalid quote: ${quote}`);
        }
    }

    getLastTransactionUpdateTime(transactions) {
        return transactions.length > 0 ? transactions[0].time : null;
    }

    hasBothQuotesTransactions() {
        return this.usdtTransactions.length > 0 && this.usdcTransactions.length > 0;
    }
}

class Spread {
    constructor() {
        this.base = null;
        this.best_buy_price = null;
        this.best_sell_price = null;
        this.last_transaction_time_in_buy = null;
        this.last_transaction_time_in_sell = null;
        this.buy_transactions = [];
        this.sell_transactions = [];
        this.absolute_profit = null;
        this.percent_profit = null;
        this.spread_priority = null;
        this.status_color = null;
        this.spread_statuses_history = Array(50).fill(0);
    }

    pushStatusToHistory(spread_priority) {
        this.spread_statuses_history.unshift(spread_priority);
        this.spread_statuses_history.pop();
    }

    getSpreadLifetime() {
        const now = new Date();
        const timeNow = now.toLocaleTimeString('en-GB', { hour12: false });

        const buyTimeSeconds = timeToSeconds(this.last_transaction_time_in_buy);
        const sellTimeSeconds = timeToSeconds(this.last_transaction_time_in_sell);
        const oldestTimeSeconds = Math.min(buyTimeSeconds, sellTimeSeconds);

        // конвертируем oldestTimeSeconds обратно в строку формата HH:MM:SS
        const oldestTime = secondsToTime(oldestTimeSeconds);

        return diffBetweenTimes(timeNow, oldestTime)
    }

    getSpreadLifetimeInSeconds() {
        return timeToSeconds(this.getSpreadLifetime())
    }

    calculateSpreadPriority() {
        if (this.percent_profit >= 0.12 && this.getSpreadLifetimeInSeconds() < 3)
            this.spread_priority = 99
        else if (this.percent_profit >= 0.12)
            this.spread_priority = 98
        else
            this.spread_priority = 97
    }

    statusToColor(statusCode) {
        if (statusCode === 99)
            return "rgba(0,255,0,0.16)"
        else if (statusCode === 98)
            return "rgba(128,128,128,0.27)"
        else if (statusCode === 97)
            return "rgba(255,0,0,0.22)"
        else
            return "rgba(18,15,15,0.28)"
    }

    getSpreadStatusColor() {
        return this.statusToColor(this.spread_priority)
    }
}

class Spreader {
    // this class works in one way only
    constructor() {

        this.usdtUsdcSpreads = new Map();
        this.usdcUsdtSpreads = new Map();
        // this.usdcUsdtSpreads =
    }

    findBestPriceInSide(transactions, side) {
        return transactions.find(order => order.side === side).price;
    }

    calculateSpreads(transactionsQuotePair) {
        if (transactionsQuotePair.hasBothQuotesTransactions()) {
            let usdtUsdcSpread = new Spread();
            let usdcUsdtSpread = new Spread();

            if (this.usdtUsdcSpreads.has(transactionsQuotePair.base))
                usdtUsdcSpread = this.usdtUsdcSpreads.get(transactionsQuotePair.base)
            if (this.usdcUsdtSpreads.has(transactionsQuotePair.base))
                usdcUsdtSpread = this.usdcUsdtSpreads.get(transactionsQuotePair.base)

            usdtUsdcSpread = this.calculateSpreadByDirection(usdtUsdcSpread, transactionsQuotePair, "usdt_to_usdc")
            usdcUsdtSpread = this.calculateSpreadByDirection(usdcUsdtSpread, transactionsQuotePair, "usdc_to_usdt")

            this.usdtUsdcSpreads.set(transactionsQuotePair.base, usdtUsdcSpread)
            this.usdcUsdtSpreads.set(transactionsQuotePair.base, usdcUsdtSpread)
        }
    }

    calculateSpreadByDirection(spread, transactionsQuotePair, direction) {
        spread.base = transactionsQuotePair.base;

        if (direction === 'usdt_to_usdc') {
            spread.best_buy_price = this.findBestPriceInSide(transactionsQuotePair.usdtTransactions, 'buy')
            spread.best_sell_price = this.findBestPriceInSide(transactionsQuotePair.usdcTransactions, 'sell')

            spread.last_transaction_time_in_buy = transactionsQuotePair.usdtLastTransactionUpdateTime
            spread.last_transaction_time_in_sell = transactionsQuotePair.usdcLastTransactionUpdateTime

            spread.buy_transactions = transactionsQuotePair.usdtTransactions
            spread.sell_transactions = transactionsQuotePair.usdcTransactions
        } else if (direction === 'usdc_to_usdt') {
            spread.best_buy_price = this.findBestPriceInSide(transactionsQuotePair.usdcTransactions, 'buy')
            spread.best_sell_price = this.findBestPriceInSide(transactionsQuotePair.usdtTransactions, 'sell')

            spread.last_transaction_time_in_buy = transactionsQuotePair.usdcLastTransactionUpdateTime
            spread.last_transaction_time_in_sell = transactionsQuotePair.usdtLastTransactionUpdateTime

            spread.buy_transactions = transactionsQuotePair.usdcTransactions
            spread.sell_transactions = transactionsQuotePair.usdtTransactions
        } else {
            throw new Error(`Invalid way to calculate spread: ${direction}`);
        }

        spread.absolute_profit = (spread.best_sell_price - spread.best_buy_price).toFixed(10)
        spread.percent_profit = ((spread.absolute_profit / spread.best_buy_price) * 100).toFixed(6)
        spread.time_diff = diffBetweenTimes(spread.last_transaction_time_in_buy, spread.last_transaction_time_in_sell)

        spread.calculateSpreadPriority()

        return spread;
    }
}

class Renderer {
    renderAvailableCurrencies(transactionPairList) {
        const availableCurrenciesDiv = document.getElementById('availableCurrencies');
        let allCurrencies = ""

        transactionPairList.forEach((value, key) => {
            allCurrencies += `${key} (${value.hasBothQuotesTransactions()})\n`;
        })

        availableCurrenciesDiv.innerHTML = allCurrencies;
    }

    updateSpreadStatuses(spread) {
        spread.calculateSpreadPriority()
        spread.status_color = spread.getSpreadStatusColor()
        spread.pushStatusToHistory(spread.spread_priority)
    }

    sortSpreads(spreads) {
        return new Map(
            [...spreads.entries()].sort((a, b) => {


                return parseFloat(b[1].percent_profit) - parseFloat(a[1].percent_profit)
            })
        );
    }

    renderSpreads(renderer) {
        let sortedUsdtUsdcSpreads = this.sortSpreads(spreader.usdtUsdcSpreads)
        let sortedUsdcUsdtSpreads = this.sortSpreads(spreader.usdcUsdtSpreads)

        renderer.renderSpread(sortedUsdtUsdcSpreads, "USDT-USDC");
        renderer.renderSpread(sortedUsdcUsdtSpreads, "USDC-USDT");
    }

    renderSpread(spreads, spreadType) {
        let domSelector = "usdtUsdcSpreadsInfo"
        let spreadName = "USDT → USDC"
        if (spreadType === "USDC-USDT") {
            domSelector = "usdcUsdtSpreadsInfo"
            spreadName = "USDC → USDT"
        }

        let spreadsInfoDiv = document.getElementById(domSelector)

        // allSpreads.sort((a, b) => b.usdt_usdc_arbitrage - a.usdt_usdc_arbitrage)

        let tableRows = '';

        spreads.forEach(spread => {

            this.updateSpreadStatuses(spread)

            // Общая строка для таблицы
            const rowHTML =
            `
            <tr style="background-color: ${spread.status_color};">
                <td><b>${spread.base}</b></td>
                <td>
                    ${spread.absolute_profit} 
                </td>
                <td>${spread.percent_profit}%</td>
                <td>${spread.getSpreadLifetime()}</td>
                <td>${spread.last_transaction_time_in_buy}</td>
                <td>${spread.last_transaction_time_in_sell}</td>
                <td>${timeNow()}</td>
                <td class="history-cell">
                  ${spread.spread_statuses_history
                    .map(statusCode => {
                        return `<div class="square" 
                                style="background-color:${spread.statusToColor(statusCode)}"></div>`;
                    })
                    .join('')}
                </td>
            </tr>
            `;

            tableRows += rowHTML;
        });

        const tableHTML = `
            <table style="border-collapse: collapse; width: 100%; border: 1px solid #aaa;">
                <thead>
                    <tr style="border: 1px solid #aaa; padding: 4px;">
                        <th>Base</th>
                        <th>${spreadName}</th>
                        <th>%</th>
                        <th>Lifetime</th>
                        <th>LTB</th>
                        <th>LTS</th>
                        <th>Now</th>
                        <th>History</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;

        spreadsInfoDiv.innerHTML = tableHTML;
    }
}

console.log('Dashboard loaded');

let transactionPairList = new Map();
let renderer = new Renderer();
let spreader = new Spreader();

setInterval(() => {

    renderer.renderAvailableCurrencies(transactionPairList);
    renderer.renderSpreads(renderer)

}, 500);

// Обработка сообщений от background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'fullOrderBookData') {

        // console.log('Received fullOrderBookData:');

        const { orderBookData, currencyInfo } = message.data;
        const { base, quote } = currencyInfo;

        if (base && quote) {
            transactionPairList.has(base) || transactionPairList.set(base, new TransactionsQuotePair(base))
            transactionPairList.get(base).setTransactions(orderBookData, quote)

            spreader.calculateSpreads(transactionPairList.get(base))

            console.log(transactionPairList)

            // renderAvailableCurrencies()
            // renderSpreads()
        } else {
            console.log(`Background JS message received error: base: ${base}, quote: ${quote}`)
        }
    }
});
