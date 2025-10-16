document.addEventListener('DOMContentLoaded', () => {
    chrome.runtime.sendMessage({ type: 'GET_ALL_ORDERBOOKS' }, data => {
        const container = document.getElementById('orderbooks');
        container.innerHTML = '';
        Object.entries(data).forEach(([tabId, orders]) => {
            const div = document.createElement('div');
            div.innerHTML = `<h3>Вкладка ${tabId}</h3><pre>${JSON.stringify(orders.slice(0, 5), null, 2)}</pre>`;
            container.appendChild(div);
        });
    });
});
