
function getOrderBookData() {
    let orderBookData = [];

    // get orderbook container
    const container = document.querySelector('.ReactVirtualized__Grid__innerScrollContainer');
    if (!container) {
        console.log("[spr]",'Контейнер не найден');
        return [];
    }

    const rows = container.querySelectorAll('div[role="gridcell"]');
    const times = [];

    rows.forEach(row => {
        const cells = row.querySelectorAll('.flex-1');  // Первая колонка с временем

        if (cells.length === 0) {
            return;
        }

        orderBookData.push({
            "time": cells[0].innerText.trim(),
            "price": cells[1].innerText.trim(),
            "amount": cells[2].innerText.trim(),
            "side": cells[1].style.color.includes('Buy') ? 'buy' : 'sell'
        })
    });

    return orderBookData;
}

function getCurrencyInfo() {
    const headerContainer = document.querySelector('.flex.items-center.justify-between.text-TertiaryText');
    if (!headerContainer) {
        console.log("[spr]",'Заголовки таблицы не найдены');
        return { base: null, quote: null };
    }

    const headerCells = headerContainer.querySelectorAll('.flex-1');
    if (headerCells.length < 3) {
        console.log("[spr]",'Недостаточно колонок в заголовках');
        return { base: null, quote: null };
    }

    // Извлечение текста из второй (Price) и третьей (Amount) колонок
    const priceText = headerCells[1].textContent.trim(); // Price(USDT)
    const amountText = headerCells[2].textContent.trim(); // Amount(PUP)

    // Извлечение валюты из текста в скобках
    const quoteMatch = priceText.match(/Price\((\w+)\)/);
    const baseMatch = amountText.match(/\((\w+)\)/);

    const quote = quoteMatch ? quoteMatch[1] : null;
    const base = baseMatch ? baseMatch[1] : null;

    if (!base || !quote) {
        console.warn('Не удалось извлечь валюты из заголовков', { priceText, amountText });
    }

    return {
        base: base || 'Unknown',
        quote: quote || 'Unknown'
    };
}


// Периодическая отправка данных каждые 500 мс
setInterval(() => {
    if (chrome.runtime && chrome.runtime.id) {
        const fullOrderBookData = {
            "orderBookData": getOrderBookData(),
            "currencyInfo": getCurrencyInfo(),
        };
        console.log('[spr]', fullOrderBookData);

        chrome.runtime.sendMessage({ type: 'fullOrderBookData', data: fullOrderBookData }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Ошибка отправки:', chrome.runtime.lastError.message);
                return;
            }
            console.log('Данные отправлены в background.js:', response);
        });
    } else {
        console.warn('Контекст расширения недействителен');
    }
}, 500);

setInterval(() => {
    console.clear()
}, 10000)
