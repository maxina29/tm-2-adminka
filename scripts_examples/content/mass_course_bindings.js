// массовая привязка курсов к УП в формате
// [id УП, id курса]
// запускаем с любой страницы
let pairs = [
    [317, 14997],
    [719, 15111],
];
let bindingWindow = await createWindow();
let tempWindow = await createWindow('adminka_tmp');
let url = `https://foxford.ru/admin/methodical_materials/programs/${pairs[0][0]}/course_bindings?q%5Bdiscipline_id_eq%5D=`;
await bindingWindow.openPage(url);
let submitButton = bindingWindow.querySelector('a[title="Привязать"]');
submitButton.target = 'adminka_tmp';
for (let pair of pairs) {
    let methodicalProgramId = pair[0];
    let courseId = pair[1];
    log(`УП ${methodicalProgramId}, курс ${courseId}`);
    submitButton.href = `/admin/methodical_materials/programs/${methodicalProgramId}/course_bindings?course_id=${courseId}`;
    submitButton.click();
    await tempWindow.waitForSuccess();
    await tempWindow.openPage('about:blank');
}
await bindingWindow.close(); 