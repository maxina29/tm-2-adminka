// Меняем массово разные поля в курсах по-разному
// Вместо course_full_name и course_description можно использовать любые ID текстовых полей со страницы /edit, в любом количестве
// Сгенерируйте подобный объект через формулы в яндекс/гугл-таблицах
// Если изменения во всех курсах одинаковые, можно использовать mass_change_fields_on_edit_page.js
// Если изменяется только одно поле, то можно использовать быстрый вариант - см. mass_easy_different_changes_on_courses_page.js
let coursesInfo = {
    10609: { 'course_full_name': 'Тестовый курс 1', 'course_description': 'Тестовое описание 1' },
    12345: { 'course_full_name': 'Тестовый курс 2', 'course_description': 'Тестовое описание 2' },
}
let tempWindow = await createWindow();
for (let courseId in coursesInfo) {
    log(courseId);
    await tempWindow.openPage(`https://foxford.ru/admin/courses/${courseId}/edit`);
    let courseInfo = coursesInfo[courseId];
    for (let selector in courseInfo) {
        tempWindow.querySelector(`#${selector}`).value = courseInfo[selector];
    }
    tempWindow.querySelector(`#course_name`).closest('form').querySelector('[type="submit"]').click();
    await tempWindow.waitForSuccess();
}