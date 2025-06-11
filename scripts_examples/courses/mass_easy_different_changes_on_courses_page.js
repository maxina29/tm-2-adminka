// делает то же, что и mass_different_change.js, но другим способом (быстрее)
// меняет максимум одно поле в курсе за раз, но без открытия новых вкладок и с минимальной задержкой
// запускать на странице https://foxford.ru/admin/courses
// могут поддерживаться не все основные tag, перед массовым запуском проверить на нескольких курсах
// объект дата лучше создать формулами в яндекс/гугл-таблицах
// Проверить по выгрузке, что все изменения подтянулись 
let data = {
    10609: 'https://foxford.ru/catalog',
    12345: 'https://foxford.ru/catalog/1-klass',
}
let tag = 'landing_url'; //         or 'full_name'
for (let courseId in data) {
    log(`${courseId} - ${data[courseId]}`);
    let elem = currentWindow.querySelector('span[id^=best]');
    let newElem = elem.cloneNode(true);
    newElem.setAttribute('data-bip-attribute', tag);
    newElem.setAttribute('data-bip-url', `/admin/courses/${courseId}`);
    newElem.setAttribute('id', `best_in_place_course_${courseId}_${tag}`);
    currentWindow.querySelector('tbody').appendChild(newElem);
    newElem.click();
    await sleep(100);
    newElem.querySelector('input').value = data[courseId];
    let submitButton = createElement('button');
    submitButton.type = 'submit';
    newElem.querySelector('form').appendChild(submitButton);
    submitButton.click();
    await sleep(900);
}