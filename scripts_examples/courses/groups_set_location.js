// Проставляем локацию «Шлак» в первых параллелях курсов
// Для проставления локации в занятия через дев-сервисы используйте dev_services_mass_mini_location.js
clear();
let courseIds = `10609
12345`.split('\n');
let locationSet = SLAG_ID_SET; // можно указать MINI_GROUPS_ID_SET, HOME_ID_SET, SSM_ID_SET
let tempWindow = await createWindow();
for (let courseId of courseIds) {
    log(courseId)
    await tempWindow.openPage(`https://foxford.ru/admin/courses/${courseId}/groups`);
    tempWindow.querySelector('[id^="location_selector_"][name="group_template[default_location_id]"]').value = locationSet[0];
    tempWindow.querySelector('[id^="format_selector_"][name="group_template[default_format_id]"]').value = locationSet[1];
    let optionElement = tempWindow.createElement('option');
    optionElement.value = locationSet[2];
    optionElement.innerHTML = 'не нужна (мини-группы)';
    let selectElement = tempWindow.querySelector('[id^="studio_selector_"][name="group_template[default_studio_id]"]');
    selectElement.appendChild(optionElement);
    selectElement.value = locationSet[2];
    selectElement.closest('form').querySelector('[type="submit"]').click();
    await tempWindow.waitForSuccess();
}
await tempWindow.close();
