// Меняем массово полное название курса
// Вместо course_full_name можно использовать любые ID текстовых полей со страницы /edit, в любом количестве
clear();
let coursesInfo = {
    10609: { 'course_full_name': 'Тестовый курс 1' },
    12345: { 'course_full_name': 'Тестовый курс 2' },
}
let tempWindow = await createWindow();
for (let courseId in coursesInfo) {
    log(courseId);
    await tempWindow.openPage(`https://foxford.ru/admin/mini_groups/${courseId}/edit`);
    let courseInfo = coursesInfo[courseId];
    for (let selector in courseInfo) {
        tempWindow.querySelector(`#${selector}`).value = courseInfo[selector];
    }
    tempWindow.querySelector(`#course_name`).closest('form').querySelector('[type="submit"]').click();
    await tempWindow.waitForElement('.alert-success');
}
await tempWindow.close();