
// массовое заведение параллелей классических курсов
// рабочая таблица - https://disk.360.yandex.ru/i/qRDgjjgrOLaoQA 
// (вкладка Курсы)
clear();
let newTempalatesData = [
    // вставить параллели сюда
    { id: 10609, day: [1], time: ['15:00'], start: '01.09.2024', teacher: 1932, hidden: false, users: 100 },
    { id: 10609, day: [1, 3], time: ['15:00', '16:00'], start: '01.09.2024', teacher: 1932, hidden: false, users: 200 },
    { id: 10609, day: [1, 3], time: ['15:00'], start: '07.09.2024', from: 3, teacher: 1875, hidden: false, users: 300 },
];
let groupsWindow = await createWindow('adminka_groups');
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
        groupsWindow.querySelector('[name="group_template[teacher_id]"]').value = template.teacher;
        groupsWindow.querySelectorAll('[name="group_template[schedule_hidden]"]')[1].checked = template.hidden;
        groupsWindow.querySelector('[name="group_template[users_limit]"]').value = template.users;
        groupsWindow.querySelector('.btn-primary').click();
        await groupsWindow.waitForSuccess();
        let templatesSelect = groupsWindow.querySelector('#group_template_id');
        let templateDescription = templatesSelect[templatesSelect.selectedIndex].text;
        let currentTemplateOrder = templateDescription.substr(0, templateDescription.search('-') - 1);
        let templateId = templatesSelect.value;
        let templateInfo = [currentTemplateOrder, templateId].join('\t')
        log(`Заведено: ${templateInfo}`);
        finalOutput += `${templateInfo}\n`;
    }
    clear()
    displayLog('Готово ;)');
}
catch (err) {
    displayError(err);
}
finally {
    log('Все заведенные параллели:')
    log(finalOutput)
}