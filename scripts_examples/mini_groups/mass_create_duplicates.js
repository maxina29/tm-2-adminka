// Массовое создание дубликатов мини-групп
clear();
let ids = `10609
12345`.split('\n');
let tempWindow = window.open('about:blank', 'adminka');;
for (let id of ids) {
    log(id);
    tempWindow.location.href = 'https://foxford.ru/admin/courses/' + id + '/course_duplicates/new';
    while (!tempWindow.document.querySelector('.my-btn.get-data')) { await sleep(100); }
    tempWindow.document.querySelector('.my-btn.get-data').classList.add('bot-approve');
    tempWindow.document.querySelector('.my-btn.get-data').click();
    tempWindow.document.querySelector('#course_duplicate_group_templates_attributes_0_week_days_attributes_0_slot_week_day').value = 1;
    tempWindow.document.querySelector('#course_duplicate_group_templates_attributes_0_week_days_attributes_0_slot_time').value = '01:00'
    tempWindow.document.querySelector('#course_duplicate_group_templates_attributes_0_starts_at').value = '08.09.2025';
    tempWindow.document.querySelector('#course_duplicate_group_templates_attributes_0_schedule_hidden').checked = true;
    tempWindow.document.querySelector('#course_duplicate_copy_groups').checked = false;
    while (!tempWindow.document.querySelector('#course_duplicate_group_templates_attributes_0_teacher_id').value) { await sleep(100); }
    tempWindow.document.querySelector('.btn.btn-default.btn-primary').click();
    while (!tempWindow.document.querySelector('.courses_table')) { await sleep(100); }
}
tempWindow.close();