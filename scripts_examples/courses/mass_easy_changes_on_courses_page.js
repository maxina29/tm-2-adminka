// делает то же, что и mass_change_fields_on_edit_page.js, но другим способом (быстрее)
// меняет максимум одно поле в курсе за раз, но без открытия новых вкладок и с минимальной задержкой
// запускать на странице https://foxford.ru/admin/courses
// могут поддерживаться не все основные tag, перед массовым запуском проверить на нескольких курсах
// Проверить по выгрузке, что все изменения подтянулись 
let courseIds = splitString(`10609
12345`);
let tag = 'visible_in_list'; //         or 'school_year_id'
let newValue = 'true'; // or 'false'    or '14' for 2025-2026
for (let courseId of courseIds) {
    log(courseId);
    let elem = currentWindow.querySelector('span[id^=best]');
    let newElem = elem.cloneNode(true);
    newElem.setAttribute('data-bip-attribute', tag);
    newElem.setAttribute('data-bip-url', `/admin/courses/${courseId}`);
    newElem.setAttribute('id', `best_in_place_course_${courseId}_${tag}`);
    currentWindow.querySelector('tbody').appendChild(newElem);
    newElem.click();
    await sleep(100);
    newElem.querySelector('input').value = newValue;
    let submitButton = createElement('button');
    submitButton.type = 'submit';
    newElem.querySelector('form').appendChild(submitButton);
    submitButton.click();
    await sleep(900);
}
log('done');