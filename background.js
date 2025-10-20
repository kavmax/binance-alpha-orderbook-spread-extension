// URL страницы dashboard.html в расширении
const DASHBOARD_URL = chrome.runtime.getURL('dashboard.html');

// Проверяет, существует ли вкладка с dashboard.html
function findOrCreateDashboardTab(callback) {
    chrome.tabs.query({ url: DASHBOARD_URL }, (tabs) => {
        if (chrome.runtime.lastError) {
            console.error('Ошибка поиска вкладок:', chrome.runtime.lastError.message);
            callback(null);
            return;
        }

        if (tabs.length > 0) {
            // Вкладка уже существует
            callback(tabs[0]);
        } else {
            // Создаём новую вкладку
            chrome.tabs.create({ url: DASHBOARD_URL }, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error('Ошибка создания вкладки:', chrome.runtime.lastError.message);
                    callback(null);
                    return;
                }
                callback(tab);
            });
        }
    });
}

// Обработка сообщений от content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'currencyInfo') {
        console.log('Получена информация о валютной паре:', message.data);

        // Находим или создаём вкладку с dashboard.html
        findOrCreateDashboardTab((tab) => {
            if (!tab) {
                console.warn('Не удалось найти или создать вкладку dashboard');
                sendResponse({ status: 'error' });
                return;
            }

            // Отправляем данные во вкладку dashboard.html
            chrome.tabs.sendMessage(tab.id, { type: 'fullOrderBookData', data: message.data }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Ошибка отправки в dashboard:', chrome.runtime.lastError.message);
                    sendResponse({ status: 'error' });
                    return;
                }
                console.log('Данные отправлены в dashboard:', response);
                sendResponse({ status: 'success', ok: true });
            });
        });
        return true; // Асинхронный ответ
    }
});