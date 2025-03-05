// Массовые одинаковые правки некоторых полей в edit мини-групп
// Если нужно заполнять некоторые поля по-разному для разных курсов (например, полное название курса) - см. mass_change_full_name.js
clear();
let courseIds = `10609
12345`.split('\n');
let tempWindow = await createWindow();
for (let i of courseIds) {
    log(i)
    await tempWindow.openPage(`https://foxford.ru/admin/mini_groups/${i}/edit`);
    let tempStr = tempWindow.querySelector('#course_name').value;
    tempWindow.querySelector('#course_name').value = tempStr.substring(0, tempStr.length - 4); // убираем (д) из названия
    tempWindow.querySelector('#course_school_year_id').value = '14'; // 2025 - 26
    tempWindow.querySelector('#course_group_duration').value = '40';
    tempWindow.querySelector('#course_purchase_mode').value = 'enabled';
    tempWindow.querySelector('#course_predefined_full_price').value = '31490';
    tempWindow.querySelector('#course_standard_price').value = '31490';
    tempWindow.querySelector('#course_presale').checked = 'checked';
    tempWindow.querySelector('#course_mini_group_users_limit').value = '8';
    tempWindow.querySelector('#course_published').checked = 'checked';
    tempWindow.querySelector('#course_pin_top').checked = '';
    tempWindow.querySelector('#course_visible_in_list').checked = '';
    tempWindow.querySelector('#course_producer_id').value = '1867'; // Катя Афиногенова
    tempWindow.querySelector('#course_name').closest('form').querySelector('[type="submit"]').click();
    await tempWindow.waitForElement('.alert-success');
}
await tempWindow.close();
