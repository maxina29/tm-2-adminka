// Массовые одинаковые правки некоторых полей в edit мини-групп
// Оставьте только нужные строки или добавьте по аналогии свои
// Если нужно заполнять некоторые поля по-разному для разных курсов (например, полное название курса) - см. mass_different_change.js
// Если изменяется только одно поле, то можно использовать быстрый вариант - см. mass_easy_changes_on_courses_page.js
clear();
let courseIds = splitString(`10609
12345`);
let tempWindow = await createWindow();
for (let courseId of courseIds) {
    log(courseId)
    await tempWindow.openPage(`https://foxford.ru/admin/courses/${courseId}/edit`);
    let tempStr = tempWindow.querySelector('#course_name').value;
    tempWindow.querySelector('#course_name').value = tempStr.substring(0, tempStr.length - 4); // убираем (д) из названия
    tempWindow.querySelector('#course_landing_url').value = '';
    tempWindow.querySelector('#course_school_year_id').value = '14'; // 2025 - 26
    tempWindow.querySelector('#course_group_duration').value = '40';
    tempWindow.querySelector('#course_purchase_mode').value = 'enabled';
    tempWindow.querySelector('#course_predefined_full_price').value = '31490';
    tempWindow.querySelector('#course_standard_price').value = '31490';
    tempWindow.querySelector('#course_presale').checked = true;
    tempWindow.querySelector('#course_mini_group_users_limit').value = '8';
    tempWindow.querySelector('#course_published').checked = true;
    tempWindow.querySelector('#course_pin_top').checked = false;
    tempWindow.querySelector('#course_visible_in_list').checked = false;
    tempWindow.querySelector('#course_product_pack_id').value = ''; // id привязанной подписки
    tempWindow.querySelector('#course_producer_id').value = '1867'; // Катя Афиногенова
    tempWindow.querySelector('#course_mini_group_landing_feature_attributes_free_lesson').checked = '';
    tempWindow.querySelector('#course_name').closest('form').querySelector('[type="submit"]').click();
    await tempWindow.waitForSuccess();
}
await tempWindow.close();
