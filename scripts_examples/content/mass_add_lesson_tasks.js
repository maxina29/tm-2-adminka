// массовое добавление домашних заданий по data в формате
// id урока: 'номера задач через пробелы',
// выгрузку id уроков можно взять из отчета
// https://metabase.foxford.ru/question/28411
let data = {
    327200: '204837 37659   205591 109398',
    327201: '213222 205531  290653 290653 290662 290663',
    327202: '72241 374566 374567',
}
clear();
let lessonTasksWindow = await createWindow();
let tempWindow = await createWindow('adminka_tmp');
for (let lessonId in data) {
    log(`Начинаю урок ${lessonId}`)
    await lessonTasksWindow.openPage(`https://foxford.ru/admin/lessons/${lessonId}/lesson_tasks?q%5Bdisciplines_id_in%5D=`);
    let tbody = lessonTasksWindow.querySelector('.task_table tbody:not(.sortable)');
    let tasks = new Set(data[lessonId].split(/\s+/));
    for (let num = 25; num < tasks.length; num++) {
        let tr = tbody.firstChild.cloneNode(true);
        tbody.appendChild(tr);
    }
    let trs = tbody.childNodes;
    let num = 0
    for (let taskId of tasks) {
        let btn = trs[num].querySelector('a.btn-default[rel]');
        btn.href = btn.href.substr(0, btn.href.search('=') + 1) + taskId;
        btn.target = 'adminka_tmp'
        btn.click();
        await tempWindow.waitForSuccess();
        await tempWindow.openPage('about:blank');
        log(taskId);
        num++;
    }
}
await tempWindow.close();
await lessonTasksWindow.close();