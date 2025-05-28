// Массово проставляем локацию Шлак через дев-сервисы по ID параллели
// Для проставления локации в настройки параллели используйте groups_set_location.js
// Проверьте результат работы скрипта по отчету
clear();
let groupTemplateIds = splitString(`234567
345678`);
let location = 'slag' // можно поменять на home, ssm или mini
let win = await createWindow();
for (let groupTemplateId of groupTemplateIds) {
    log(groupTemplateId);
    await win.openPage(`https://foxford.ru/admin/dev_services?only_week_day_webinars_settings&select_group_template=${groupTemplateId}&${location}&auto_validate`);
    await win.waitForSuccess();
}
win.close();