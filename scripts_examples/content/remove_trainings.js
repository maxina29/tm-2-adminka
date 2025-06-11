// Удаляет все тесты из курса
// Как из занятий типа «Тест», так и из занятий типа «Перевернутое»
// (из выбранных занятий в поле «Массовые правки вносятся с Занятие N по Занятие M (включительно)»)
let trainingWindow = await createWindow('adminka-tr');
let lessonsList = currentWindow.querySelectorAll('[id^="edit_lesson_"]');
for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
    let lessonElement = lessonsList[num];
    let greenLinkTrainingElement = lessonElement.querySelector('.green_link[href*="trainings"]')
    if (greenLinkTrainingElement != null) {
        log(num + 1);
        greenLinkTrainingElement.target = 'adminka-tr';
        greenLinkTrainingElement.click();
        await trainingWindow.waitForElement('.loaded');
        let deleteButton = trainingWindow.querySelector('[data-method="delete"][title="Отвязать"]');
        deleteButton.click();
        await trainingWindow.waitForSuccess();
        await trainingWindow.openPage('about:blank');
    }
}
await currentWindow.reload();