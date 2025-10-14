// ==UserScript==
// @name         Metabase Data Exporter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Загружает данные с Metabase и отправляет на Foxford
// @author       maxina29
// @match        https://metabase.foxford.ru/question/*?get_data
// @grant        none
// @updateURL    https://foxford.ru/tampermoney_script_metabase.user.js
// @downloadURL  https://foxford.ru/tampermoney_script_metabase.user.js
// ==/UserScript==

(function() {
    'use strict';

    function sendDataToFoxford(data) {
        console.log('Отправка данных...');
        if (window.opener) {
            window.opener.postMessage({
                type: 'FROM_METABASE_CSV_DATA',
                payload: data
            }, 'https://foxford.ru');
        }
        window.close();
    }

    console.log('Получение данных...');
    fetch(`https://metabase.foxford.ru/api/card/${window.location.href.match(/\d+/)[0]}/query/csv`, {
        method: 'POST'
    })
        .then(response => {
        if (!response.ok) {
            throw new Error(`Ошибка сети: ${response.status}`);
        }
        return response.text();
    })
        .then(data => {
        console.log('Данные успешно загружены');
        sendDataToFoxford(data);
    })
        .catch(error => {
        console.error('Ошибка загрузки данных:', error);
    });
})();