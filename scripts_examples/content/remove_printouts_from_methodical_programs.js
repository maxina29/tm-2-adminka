// Зайти в отчет // https://metabase.foxford.ru/question/45736 и вбить ID УП
// Скачать выгрузку из metabase в формате .json
// Зайти на страницу с любой из распечаток (столбец link в отчете)
// Вставить туда скрипт (вместо data вставить текст скачанной выгрузки)

let data = [
    { "id УП": "246", "mmu-id": "6 573", "mmi-id": "312 052", "Название занятия": "Устный счёт. Цепочки", "position": "1", "Название файла": "Распечатка" },
    { "id УП": "246", "mmu-id": "6 573", "mmi-id": "312 053", "Название занятия": "Устный счёт. Цепочки", "position": "1", "Название файла": "Распечатки на весь год" },
    { "id УП": "246", "mmu-id": "6 574", "mmi-id": "62 089", "Название занятия": "Точка, прямая, кривая. Пересекающиеся и параллельные прямые", "position": "2", "Название файла": "Распечатка" },
];

let originalButton = currentWindow.querySelector('a.btn.btn-default[data-method="delete"][href*="preparation_file_items"]')
if (!originalButton) { displayError('Нужно запускать скрипт со страницы с любым привязанным подготовительным материалом'); }
let tempWindow = await createWindow('adminka_tmp');

// Временный контейнер для кнопок
const tempContainer = createElement('div');
tempContainer.style.position = 'fixed';
tempContainer.style.left = '-9999px';
currentWindow.body.appendChild(tempContainer);

try {
    for (let item of data) {
        // Создаем модифицированную кнопку
        const clone = originalButton.cloneNode(true);
        clone.removeAttribute('data-confirm');
        clone.target = 'adminka_tmp';

        // Форматируем ID
        const mmuId = item['mmu-id'].replace(/\s+/g, '');
        const mmiId = item['mmi-id'].replace(/\s+/g, '');
        clone.href = `/admin/methodical_materials/units/${mmuId}/preparation_file_items/${mmiId}`;
        log(`В процессе отвязки: ${mmuId}   ${mmiId}`)
        
        // Имитируем клик
        tempContainer.appendChild(clone);
        clone.click();
        tempContainer.removeChild(clone);

        // Ожидаем подтверждения
        await tempWindow.waitForSuccess();
    }
} catch (error) {
    displayError(error);
} finally {
    await tempWindow.close();
    await currentWindow.reload();
}