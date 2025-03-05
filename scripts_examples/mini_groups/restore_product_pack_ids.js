// Вернуть удаленную ранее подписку
clear();
let coursesInfo = {
    10609: { 'course_product_pack_id': 12853 },
    12345: { 'course_product_pack_id': 12862 },
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
tempWindow.close();