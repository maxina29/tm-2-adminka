// Проставляем локацию «Мини-группа» в первых параллелях курсов
let courseIds=`10609
12345`.split('\n');
let tempWindow = await createWindow();
for (let courseId of courseIds){
log(courseId)
await tempWindow.openPage(`https://foxford.ru/admin/courses/${courseId}/groups`);
tempWindow.querySelector('[id^="location_selector_"][name="group_template[default_location_id]"]').value=8;
tempWindow.querySelector('[id^="format_selector_"][name="group_template[default_format_id]"]').value=1;
let opt=tempWindow.createElement('option'); opt.value=60; opt.innerHTML='magic'; 
let select=tempWindow.querySelector('[id^="studio_selector_"][name="group_template[default_studio_id]"]'); 
select.appendChild(opt); select.value=60;
select.closest('form').querySelector('[type="submit"]').click();
await tempWindow.waitForElement('.alert-success');
}
await tempWindow.close();
