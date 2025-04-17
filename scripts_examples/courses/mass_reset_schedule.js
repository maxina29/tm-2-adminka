// Массовое перестроение расписания первых параллелей курса с определенной даты
// Убедитесь, что в курсе стоит правильное расписание
// Проверить по отчетам
clear();
let courseIds = `10609
12345`.split('\n');
let tempWindow = await createWindow();
for (let courseId of courseIds) {
    log(courseId);
    await tempWindow.openPage(`https://foxford.ru/admin/courses/${courseId}/groups`);
    tempWindow.querySelector('#from_lesson_number').value = '1';
    tempWindow.querySelector('[id^="start_from_date_"]').value = '07.09.2025';
    tempWindow.querySelectorAll('.btn-primary')[2].click();
    await tempWindow.waitForSuccess();
}
await tempWindow.close();