// Проставляем локацию «Мини-группа» в первых параллелях курсов
// Для проставления локации в занятия через дев-сервисы используйте dev_services_mass_mini_location.js
let courseIds = `10609
12345`.split('\n');
let tempWindow = await createWindow();
for (let courseId of courseIds) {
    log(courseId)
    await tempWindow.openPage(`https://foxford.ru/admin/courses/${courseId}/groups`);
    tempWindow.querySelector('[id^="location_selector_"][name="group_template[default_location_id]"]').value = 8;
    tempWindow.querySelector('[id^="format_selector_"][name="group_template[default_format_id]"]').value = 1;
    let optionElement = tempWindow.createElement('option');
    optionElement.value = 60;
    optionElement.innerHTML = 'не нужна (мини-группы)';
    let selectElement = tempWindow.querySelector('[id^="studio_selector_"][name="group_template[default_studio_id]"]');
    selectElement.appendChild(optionElement);
    selectElement.value = 60;
    selectElement.closest('form').querySelector('[type="submit"]').click();
    await tempWindow.waitForElement('.alert-success');
}
await tempWindow.close();
