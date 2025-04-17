// Массово проставляем локацию Шлак через дев-сервисы по ID параллели
// Для проставления локации в настройки параллели используйте groups_set_location_mini.js
// Проверьте результат работы скрипта по отчету
// В ссылке slag можно поменять на home или ssm
clear();
let groupTemplateIds = `234567
345678`.split('\n');
let win = await createWindow();
for (let groupTemplateId of groupTemplateIds) {
    log(groupTemplateId);
    await win.openPage(`https://foxford.ru/admin/dev_services?only_week_day_webinars_settings&select_group_template=${groupTemplateId}&slag&auto_validate`);
    await win.waitForSuccess();
}
win.close();