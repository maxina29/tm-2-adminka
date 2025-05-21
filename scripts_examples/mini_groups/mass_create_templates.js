// массовое заведение параллелей МГ с проставлением локации МГ
// рабочая таблица - https://disk.360.yandex.ru/i/qRDgjjgrOLaoQA 
// (вкладка Мини-группы)
clear();
let newTempalatesData = [
    // вставить параллели сюда
    { id: 15005, day: [2], time: ['18:00'], start: '10.09.2025', agent: 1620064, hidden: false, users: 12, active: false },
    { id: 15005, day: [3, 4], time: ['18:00'], start: '11.09.2025', agent: 1620064, hidden: false, users: 12, active: false },
    { id: 15005, day: [4, 5], time: ['18:00', '20:00'], start: '12.09.2025', agent: 1620064, hidden: false, users: 12, active: false },
    { id: 15005, day: [6], time: ['11:00'], start: '14.09.2025', agent: 2578272, hidden: false, users: 12, active: true },
];
let groupsWindow = await createWindow('adminka_groups');
let devServicesWindow = await createWindow('adminka_devs');
let finalOutput = '';
try {
    for (let template of newTempalatesData) {
        await groupsWindow.openPage(`https://foxford.ru/admin/courses/${template.id}/groups`);
        for (let num = 0; num < template.day.length; num++) {
            if (num != 0) { groupsWindow.querySelector('.add_nested_fields').click(); }
            while (groupsWindow.querySelectorAll('[id^="group_template_week_days_attributes_"][id*="_slot_time"]').length < num) { await sleep(100); }
            groupsWindow.querySelectorAll('[id^="group_template_week_days_attributes_"][id*="_slot_week_day"]')[num].value = template.day[num];
            let slotTime = groupsWindow.querySelectorAll('[id^="group_template_week_days_attributes_"][id*="_slot_time"]')[num];
            if (template.time.length == 1) { slotTime.value = template.time[0]; } else { slotTime.value = template.time[num]; }
        }
        groupsWindow.querySelector('[name="group_template[starts_at]"]').value = template.start;
        let firstLessonNumberElement = groupsWindow.querySelector('#group_template_first_lesson_number');
        if (template.from) { firstLessonNumberElement.value = template.from; }
        else { firstLessonNumberElement.value = firstLessonNumberElement.options[1].value; }
        if (template.agent) { groupsWindow.querySelector('[name="group_template[agent_id]"]').value = template.agent; }
        groupsWindow.querySelectorAll('[name="group_template[schedule_hidden]"]')[1].checked = template.hidden;
        groupsWindow.querySelector('[name="group_template[users_limit]"]').value = template.users;
        groupsWindow.querySelector('.btn-primary').click();
        await groupsWindow.waitForSuccess();
        let templatesSelect = groupsWindow.querySelector('#group_template_id');
        let templateDescription = templatesSelect[templatesSelect.selectedIndex].text;
        let currentTemplateOrder = templateDescription.substr(0, templateDescription.search('-') - 1);
        let templateId = templatesSelect.value;
        await groupsWindow.waitForElement('[id^="studio_selector_"]');
        groupsWindow.querySelector('[id^="location_selector_"]').value = 8;
        groupsWindow.querySelector('[id^="format_selector_"]').value = 1;
        let groupsOption = createElement('option');
        groupsOption.value = 60; groupsOption.innerHTML = 'magic';
        let groupsSelect = groupsWindow.querySelector('[id^="studio_selector_"]');
        groupsSelect.appendChild(groupsOption); groupsSelect.value = 60;
        while (groupsWindow.querySelectorAll('.btn-primary').length < 2) { await sleep(100); }
        groupsWindow.querySelectorAll('.btn-primary')[1].click();
        await groupsWindow.waitForSuccess();
        if (template.active) {
            await groupsWindow.waitForElement('.groups_page');
            let activateButton = groupsWindow.querySelector('.groups_page').childNodes[0].childNodes[1].childNodes[1].childNodes[1].childNodes[2];
            activateButton.removeAttribute('data-confirm');
            activateButton.click();
            await groupsWindow.waitForSuccess();
        }
        await devServicesWindow.openPage(`https://foxford.ru/admin/dev_services?only_week_day_webinars_settings&select_group_template=${templateId}&mini&auto_validate`);
        await devServicesWindow.waitForSuccess();
        let templateInfo = [currentTemplateOrder, templateId].join('\t')
        log(`Заведено: ${templateInfo}`);
        finalOutput += `${templateInfo}\n`;
    }
    clear()
    displayLog('Готово ;)');
}
catch (err) {
    clear()
    displayError(err);
}
finally {
    await devServicesWindow.close();
    log('Все заведенные параллели:')
    log(finalOutput)
}