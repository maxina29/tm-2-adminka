// Удаляет все подготовительные материалы из курса
// (из выбранных занятий в поле «Массовые правки вносятся с Занятие N по Занятие M (включительно)»)
clear();
let preparationWindow = await createWindow('adminka_podg');
let lessonsList = currentWindow.querySelectorAll('[id^="edit_lesson_"]');
for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
    let lessonElement = lessonsList[num];
    try {
        let preparationButton = _.toArray(lessonElement.querySelectorAll('.btn.btn-default')).filter(x => x.innerHTML.match(/Подготовительные материалы/))[0];
        preparationButton.target = 'adminka_podg';
        log(num);
        preparationButton.click();
        await preparationWindow.waitForElement('.loaded');
        let removeButtons = preparationWindow.querySelectorAll('.remove_fields');
        for (let removeButton of removeButtons) {
            removeButton.click();
        }
        preparationWindow.querySelector('#lesson_preparation_text').value = '';
        await preparationWindow.waitForElementDisappear('.nested-fields:not([style])');
        preparationWindow.querySelector('.btn-primary').click();
        await preparationWindow.waitForSuccess();
        await preparationWindow.openPage('about:blank');
    }
    catch (err) {
        //log('no podg_materials in lesson')
    }
}
await preparationWindow.close();
displayLog('Готово');