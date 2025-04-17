// Массовые одинаковые правки некоторых полей в edit курсов
// Оставьте только нужные строки или добавьте по аналогии свои
// Если нужно заполнять некоторые поля по-разному для разных курсов (например, полное название курса) - см. mass_different_change.js
// Если изменяется только одно поле, то можно использовать быстрый вариант - см. mass_easy_changes_on_courses_page.js
clear();
let courseIds = `10609
12345`.split('\n');
let tempWindow = await createWindow();
for (let courseId of courseIds) {
    log(courseId)
    await tempWindow.openPage(`https://foxford.ru/admin/courses/${courseId}/edit`);
    let tempStr = tempWindow.querySelector('#course_name').value;
    tempWindow.querySelector('#course_name').value = tempStr.substring(0, tempStr.length - 4); // убираем (д) из названия
    tempStr = tempWindow.querySelector('#course_subtitle').value;
    wtempWindowin.querySelector('#course_subtitle').value = tempStr.replace('2025', '2026');
    tempStr = tempWindow.querySelector('#course_full_name').value;
    wtempWindowin.querySelector('#course_full_name').value = tempStr.replace('2025', '2026');
    tempWindow.querySelector('#course_promo_label').value = '';
    tempWindow.querySelector('#course_school_year_id').value = '14'; // 2025 - 26
    tempWindow.querySelector('#course_purchase_mode').value = 'enabled';
    tempWindow.querySelector('#course_predefined_full_price').value = '31490';
    tempWindow.querySelector('#course_standard_price').value = '31490';
    tempWindow.querySelector('#course_has_essay').checked = 'checked';
    tempWindow.querySelector('#course_published').checked = 'checked';
    tempWindow.querySelector('#course_timing_title').value = '';
    tempWindow.querySelector('#course_timing_description').value = '';
    tempWindow.querySelector('#course_pin_top').checked = '';
    tempWindow.querySelector('#course_visible_in_list').checked = '';
    tempWindow.querySelector('#course_producer_id').value = '1867'; // Катя Афиногенова
    tempWindow.querySelector('#course_name').closest('form').querySelector('[type="submit"]').click();
    await tempWindow.waitForSuccess();
}
await tempWindow.close();
