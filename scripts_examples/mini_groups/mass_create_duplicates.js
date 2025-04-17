// Массовое создание пачки дубликатов разных мини-групп
// Если возникает ошибка 422, проверьте, не привязана ли к курсу подписка и отвяжите ее 
// (можно через mass_change_fields_on_edit_page.js очистить поле #course_product_pack_id)
// Иногда также может не получаться из-за описания длинее 260 символов (пока встречалось редко, поэтому правим руками)
// После создания дублей можно 
// - поменять массово разные поля (mass_change_fields_on_edit_page.js)
// - массово проставить локацию МГ на странице groups (groups_set_location_mini.js)
// - массово проставить локацию МГ в занятиях через дев-сервисы (dev_services_mass_location.js)
// - массово перестроить параллели (mass_reset_schedule.js)
clear();
let courseIds = `10609
12345`.split('\n');
let tempWindow = await createWindow();
for (let courseId of courseIds) {
    log(courseId);
    await tempWindow.openPage(`https://foxford.ru/admin/courses/${courseId}/course_duplicates/new`);
    await tempWindow.waitForElement('.my-btn.get-data');
    tempWindow.querySelector('.my-btn.get-data').classList.add('bot-approve');
    tempWindow.querySelector('.my-btn.get-data').click();
    tempWindow.querySelector('#course_duplicate_group_templates_attributes_0_week_days_attributes_0_slot_week_day').value = 1; // 1-пн, 2-вт, и т.д., 0-вс
    tempWindow.querySelector('#course_duplicate_group_templates_attributes_0_week_days_attributes_0_slot_time').value = '01:00'
    tempWindow.querySelector('#course_duplicate_group_templates_attributes_0_starts_at').value = '08.09.2025';
    tempWindow.querySelector('#course_duplicate_group_templates_attributes_0_schedule_hidden').checked = true; // расписание скрыто
    tempWindow.querySelector('#course_duplicate_copy_groups').checked = false; // копировать прошедшие материалы 
    tempWindow.querySelector('#course_duplicate_video_available_on_schedule').checked = false; // сбросить стейт вебинаров 
    tempWindow.querySelector('#course_duplicate_asynchronous_access').checked = false; // асинхронный доступ
    while (!tempWindow.querySelector('#course_duplicate_group_templates_attributes_0_teacher_id').value) { await sleep(100); }
    tempWindow.querySelector('.btn.btn-default.btn-primary').click();
    await tempWindow.waitForSuccess();
}
await tempWindow.close();