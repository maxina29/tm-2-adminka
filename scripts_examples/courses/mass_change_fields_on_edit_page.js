// Массовые одинаковые правки некоторых полей в edit курсов
// Оставьте только нужные строки или добавьте по аналогии свои
// Если нужно заполнять некоторые поля по-разному для разных курсов (например, полное название курса) - см. mass_different_change.js
// Если изменяется только одно поле, то можно использовать быстрый вариант - см. mass_easy_changes_on_courses_page.js
let courseIds = splitString(`10609
12345`);
let tempWindow = await createWindow();
for (let courseId of courseIds) {
    log(courseId)
    await tempWindow.openPage(`https://foxford.ru/admin/courses/${courseId}/edit`);
    let tempStr = tempWindow.querySelector('#course_name').value;
    tempWindow.querySelector('#course_name').value = tempStr.substring(0, tempStr.length - 4); // убираем (д) из названия
    tempStr = tempWindow.querySelector('#course_subtitle').value;
    tempWindow.querySelector('#course_subtitle').value = tempStr.replace('2025', '2026');
    tempStr = tempWindow.querySelector('#course_full_name').value;
    tempWindow.querySelector('#course_full_name').value = tempStr.replace('2025', '2026');
    tempWindow.querySelector('#course_course_type_id').value = '2' // тип курса - экспресс
    tempWindow.querySelector('#course_product_segment_tag_id').value = '1112'; // курсы за младший класс ДШ
    tempWindow.querySelector('#course_creation_with_master_course').checked = true; // галочка «Такого продукта раньше не было»
    tempWindow.querySelector('#course_promo_label').value = '';
    tempWindow.querySelector('#course_school_year_id').value = '14'; // 2025 - 26
    tempWindow.querySelector('#course_purchase_mode').value = 'enabled';
    tempWindow.querySelector('#course_predefined_full_price').value = '31490';
    tempWindow.querySelector('#course_standard_price').value = '31490';
    tempWindow.querySelector('#course_has_essay').checked = true;
    tempWindow.querySelector('#course_timing_title').value = '';
    tempWindow.querySelector('#course_timing_description').value = '';
    tempWindow.querySelector('#course_published').checked = true;
    tempWindow.querySelector('#course_pin_top').checked = false;
    tempWindow.querySelector('#course_visible_in_list').checked = false;
    tempWindow.querySelector('#course_visible_in_calendar').checked = false;
    tempWindow.querySelector('#course_producer_id').value = '1437'; // Аня Разгребельская
    tempWindow.querySelector('#course_name').closest('form').querySelector('[type="submit"]').click();
    await tempWindow.waitForSuccess();
}