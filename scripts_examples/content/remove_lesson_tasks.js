// Очищаем всю домашку из курса 
// (из выбранных занятий в поле «Массовые правки вносятся с Занятие N по Занятие M (включительно)»)
// Запускать на странице /lessons
clear();
let homeworkWindow = await createWindow('adminka-lt');
let lessonsList = currentWindow.querySelectorAll('[id^="edit_lesson_"]');
for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
    let lessonElement = lessonsList[num];
    let greenLinkTaskElement = lessonElement.querySelector('.green_link[href*="lesson_tasks"]')
    if (greenLinkTaskElement != null) {
        log(num + 1);
        greenLinkTaskElement.target = 'adminka-lt';
        greenLinkTaskElement.click();
        await homeworkWindow.waitForElement('.remove-all-tasks');
        homeworkWindow.querySelector('.remove-all-tasks').click();
        await homeworkWindow.waitForElement('.remove-all-tasks[disabled]')
        await homeworkWindow.openPage('about:blank');
    }
}
await homeworkWindow.close();
await currentWindow.reload();