// Меняем массово разные поля в курсах по-разному
// Вместо product_pack_business_segment_tag_id и product_pack_product_segment_tag_id можно использовать любые ID текстовых полей со страницы /edit, в любом количестве
// Сгенерируйте подобный объект через формулы в яндекс/гугл-таблицах
let productPacksInfo = {
    9932: { 'product_pack_business_segment_tag_id': '683', 'product_pack_product_segment_tag_id': '1018' },
    12527: { 'product_pack_business_segment_tag_id': '681', 'product_pack_product_segment_tag_id': '713' },
}
let tempWindow = await createWindow();
for (let productPackId in productPacksInfo) {
    log(productPackId);
    await tempWindow.openPage(`https://foxford.ru/admin/product_packs/${productPackId}/edit`);
    let productPackInfo = productPacksInfo[productPackId];
    for (let selector in productPackInfo) {
        tempWindow.querySelector(`#${selector}`).value = productPackInfo[selector];
    }
    tempWindow.querySelector(`#product_pack_name`).closest('form').querySelector('[type="submit"]').click();
    await tempWindow.waitForSuccess();
}