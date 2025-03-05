// очистить пачку курсов от привязанных к ним подписки (product_pack_id)
// не забудьте заранее сохранить отдельно ID привязанной подписки
clear();
let courseIds=`10609
12345`.split('\n');
let tempWindow = await createWindow();
for (let courseId of courseIds){
log(courseId);
await tempWindow.openPage(`https://foxford.ru/admin/mini_groups/${courseId}/edit`);
tempWindow.querySelector('#course_product_pack_id').value='';
tempWindow.querySelector('#course_name').closest('form').querySelector('[type="submit"]').click();
await tempWindow.waitForElement('.alert-success');
}
await tempWindow.close();