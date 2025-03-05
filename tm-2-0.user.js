// ==UserScript==
// @name         TestAdminka-refactored-demo
// @namespace    https://u.foxford.ngcdn.ru/
// @version      0.2-pre-3.3.15
// @description  Улучшенная версия админских инструментов
// @author       maxina29, wanna_get_out & deepseek
// @match        https://foxford.ru/admin*
// @grant        none
// @updateURL    https://github.com/maxina29/tm-2-adminka/raw/refs/heads/main/tm-2-0.user.js
// @downloadURL  https://github.com/maxina29/tm-2-adminka/raw/refs/heads/main/tm-2-0.user.js
// ==/UserScript==

const NO_LIVE_TEACHER_IDS = [2169, 2014, 1932, 1100, 1769, 1655, 1196, 2397, 2398, 557, 2399, 2401, 1571, 1387, 1875];
const CANCEL_GALINA_ID = 2363;
const SLAG_ID_SET = [5, 1, 27];
const MINI_GROUPS_ID_SET = [8, 1, 60];

// global variables;
let currentWindow;


class ManagedWindow {
    _nativeWindow = null;

    constructor(parent = window) {
        this._nativeWindow = this.#getWindow(parent);
        this.firstLessonNumber = 0;
        this.lastLessonNumber = null;
        this.jsLoggingConsole = this.createElement('textarea');
        this.jsCodeArea = this.createElement('textarea');
        return this.#setupProxy();
    }

    #getWindow(parent) {
        if (parent === null) return window;
        if (typeof parent === 'string') return window.open('about:blank', parent);
        return parent.open('about:blank');
    }

    // Проксируем основные свойства и методы
    #setupProxy() {
        const proxyHandler = {
            get: (target, prop) => {
                if (prop === 'nativeWindow') return target.nativeWindow;
                if (prop in target) return target[prop];
                const nativeWin = target._nativeWindow;
                if (prop in nativeWin) {
                    const value = nativeWin[prop];
                    return typeof value === 'function' ? value.bind(nativeWin) : value;
                }
                // Если свойство не найдено, возвращаем undefined
            },
            set: (target, prop, value) => {
                if (prop in target) {
                    target[prop] = value;
                    return true;
                }
                target._nativeWindow[prop] = value;
                return true;
            }
        };

        return new Proxy(this, proxyHandler);
    }

    async openPage(url) {
        if (this.closed) throw new Error('Окно закрыто');

        // Сброс состояния
        if (this.location.href !== 'about:blank') {
            this.location.replace('about:blank');
            await this.waitForElementDisappear('.loaded');
        }

        // Основная навигация
        if (url != 'about:blank') {
            this.location.href = url;
            await this.waitForElement('.loaded');
        }
        this.jsCodeArea = this.querySelector('#js_code');
        this.jsLoggingConsole = this.querySelector('#js_console');
        this.log('Эта страница была открыта скриптом, будьте осторожны)');

        return this;
    }

    checkPath(pattern) {
        const currentLocation = this.location.href;
        if (pattern instanceof RegExp) {
            return pattern.test(currentLocation);
        }
        return currentLocation === pattern;
    }

    // Дополнительные методы
    async close() {
        this._nativeWindow.close();
        log(`Окно закрыто: ${this.location.href}`);
    }

    async reload() {
        this.document.querySelector('.loaded').className = '';
        this.location.href = this.location.href;
    }

    async click(selector) {
        const element = await this.waitForElement(selector);
        element.click();
    }


    async waitForLoad() {
        const nativeWindow = this._nativeWindow;
        return new Promise(resolve => {
            if (nativeWindow.document?.readyState === 'complete') resolve();
            else nativeWindow.addEventListener('load', resolve);
        });
    }

    async waitForElement(selector, timeout = 30000, maxRetries = 20) {
        return executeWithRetry(async () => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                try {
                    const element = this.document.querySelector(selector);
                    if (element) {
                        log(`Элемент найден: ${selector}`);
                        return element;
                    }
                } catch (e) {
                    displayError(e, 'при поиске элемента');
                    await sleep(900);
                }
                await sleep(100);
            }
            throw new Error(`Элемент ${selector} не найден за ${timeout} мс`);
        }, maxRetries);
    }

    async waitForElementDisappear(selector, timeout = 30000, maxRetries = 20) {
        return executeWithRetry(async () => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                try {
                    const element = this.document.querySelector(selector);
                    if (!element) {
                        log(`Элемент исчез: ${selector}`);
                        return;
                    }
                } catch (e) {
                    displayError(e, 'при проверке элемента');
                    await sleep(900);
                }
                await sleep(100);
            }
            throw new Error(`Элемент ${selector} не исчез за ${timeout} мс`);
        }, maxRetries);
    }

    async waitForSuccess() {
        await self.waitForElement('.alert-success');
        let alertCloseButton = self.querySelector('.alert-success .close');
        alertCloseButton.click();
        await self.waitForElementDisappear('.alert-success');
    }

    async log(s) {
        if (s && s !== '[object Promise]') {
            this.jsLoggingConsole.value += s + '\n';
        }
    }

    querySelector(s) {
        return this.document.querySelector(s);
    }

    querySelectorAll(s) {
        return this.document.querySelectorAll(s);
    }

    async clearAll() {
        this.document.documentElement.innerHTML = '';
        this.document.head.innerHTML = '<link rel="stylesheet" media="all" href="https://assets-foxford-ru.ngcdn.ru/assets/admin-ae2dc560fd6ba1ec7257653c297ebb617601ca617c1b9e7306b37dcea79e795b.css">';
    }

    get document() {
        return this._nativeWindow.document;
    }

    get body() {
        return this.document.body;
    }

    get head() {
        return this.document.head;
    }

    createElement(tagName) {
        return this.document.createElement(tagName);
    }

}

async function executeWithRetry(codeToExecute, maxRetries = 10, delay = 1000) {
    let retries = 0;

    async function attempt() {
        try {
            await codeToExecute();
        } catch (error) {
            if (retries < maxRetries) {
                retries++;
                console.log(`Повторная попытка ${retries}/${maxRetries}...`);
                setTimeout(attempt, delay); // Повторяем попытку через указанное время
            } else {
                console.log(`Превышено максимальное количество попыток.`);
            }
        }
    }

    return await attempt(); // Начинаем первую попытку
}


// обновление стандартного сетера для select - теперь событие change будет учитывать и изменения через скрипт
const selectDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
Object.defineProperty(HTMLSelectElement.prototype, 'value', {
    get: selectDescriptor.get,
    set(val) {
        var old = this.value
        var res = selectDescriptor.set.call(this, val)
        if (old != val) this.dispatchEvent(new Event('change'))
        return res
    }
})
// Для элементов <input>
/*
const inputDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
Object.defineProperty(HTMLInputElement.prototype, 'value', {
    get: inputDescriptor.get,
    set: function (value) {
        const oldValue = this.value;
        inputDescriptor.set.call(this, value);
        if (oldValue !== value) {
            this.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
});
*/
// Для элементов <textarea>
const textareaDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
    get: textareaDescriptor.get,
    set: function (value) {
        const oldValue = this.value;
        textareaDescriptor.set.call(this, value);
        if (oldValue !== value) {
            this.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
});

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function checkBotApprove() {
    return currentWindow.querySelector('.bot-approve') !== null;
}

async function displayError(err, comment = '', time = 3000) {
    console.error(err);
    displayLog(`Ошибка ${comment}: ${err.message}`, 'danger', time);
}

async function displayLog(message, type = 'success', time = 3000) {
    try {
        currentWindow.log(message);
    }
    catch (e) {
        console.error('Логирование во внутреннюю консоль невозможно', e);
    }
    const displayAlert = createElement('div', `alert alert-${type}`, 'position:fixed; top:0%; width:100%; z-index:9999;');
    displayAlert.textContent = message;
    currentWindow.body.appendChild(displayAlert);
    setTimeout(() => displayAlert.remove(), time);
}

function log(s) {
    currentWindow.log(s);
}

function createButton(btnLabel, onClickFunction = null, className = '', isRealButton = true, isAsyncFunction = true) {
    if (onClickFunction == null) {
        onClickFunction = async () => { };
    }
    let button = createElement(isRealButton ? 'button' : 'a', `my-btn btn ${className}`, 'margin:2px;');
    button.textContent = btnLabel;
    button.onclick = onClickFunction;
    return button;
}

function createElement(elementTag, elementClassName = '', elementStyle = '') {
    let element = currentWindow.createElement(elementTag);
    element.className = elementClassName;
    element.style = elementStyle;
    return element;
}

function createFormElement(form, elementTag, elementText, elementID, placeholder = '', classes = true, beforeChild = null) {
    let div = createElement('div', 'form-group');
    let element = createElement(elementTag, `form-control ${elementTag}`);
    let label = createElement('label', 'control-label');
    if (classes == true) {
        element.className += ' col-sm-9';
        label.className += ' col-sm-3';
    }
    else {
        div.style = 'display:inline;';
    }
    element.id = elementID;
    element.placeholder = placeholder;
    label.htmlFor = elementID;
    label.id = 'lbl_' + elementID;
    label.textContent = elementText;
    div.append(label, element);
    if (beforeChild) {
        form.insertBefore(div, beforeChild);
    }
    else {
        form.appendChild(div);
    }
    return element;
}

// Создание окна
async function createWindow(parent = window) {
    return new ManagedWindow(parent);
}

async function copyFormData(sourceForm, targetForm, ignoreList = null) {
    if (!ignoreList) {
        ignoreList = [];
    }
    // Копирование простых полей
    const elements = targetForm.querySelectorAll('input, select, textarea');
    for (const element of elements) {
        let targetElement = null;
        try {
            targetElement = targetForm.querySelector(`#${element.id}`);
        }
        catch (SyntaxError) { }
        if (!targetElement) {
            targetElement = targetForm.querySelector(`[name="${element.name}"]`);
        }
        if (targetElement && element.name && ignoreList.indexOf(element.name) == -1 && ignoreList.indexOf(element.id) == -1 && targetElement.type != 'hidden' && targetElement.type != 'submit') {
            if (targetElement.type == 'checkbox') {
                targetElement.checked = element.checked;
            }
            else {
                targetElement.value = element.value;
            }
            log(`Скопировано поле: ${element.name}`);
        }
        else if (element.name) {
            log(`Элемент ${element.name} пропущен`);
        }
    }

    // Копирование файлов
    const fileInputs = sourceForm.querySelectorAll('input[type="file"]');
    for (const input of fileInputs) {
        const targetInput = targetForm.querySelector(`[name="${input.name}"]`);
        if (targetInput && input.files.length > 0) {
            const dt = new DataTransfer();
            dt.items.add(input.files[0]);
            targetInput.files = dt.files;
            log(`Скопирован файл: ${input.name}`);
        }
    }

    // Копирование iframe
    const iframes = sourceForm.querySelectorAll('iframe');
    for (const iframe of iframes) {
        const targetIframe = targetForm.querySelector(`iframe#${iframe.id}`);
        if (targetIframe) {
            await copyIframeContent(iframe, targetIframe);
            log(`Скопирован iframe: ${iframe.id}`);
        }
    }
}

async function copyIframeContent(sourceIframe, targetIframe) {
    return new Promise((resolve) => {
        const checkContent = () => {
            try {
                const sourceBody = sourceIframe.contentDocument?.body;
                const targetBody = targetIframe.contentDocument?.body;

                if (sourceBody && targetBody) {
                    targetBody.innerHTML = sourceBody.innerHTML;
                    log(`Содержимое iframe скопировано: ${sourceIframe.id}`);
                    resolve();
                } else {
                    setTimeout(checkContent, 100);
                }
            } catch (e) {
                setTimeout(checkContent, 100);
            }
        };
        checkContent();
    });
}

async function cloneResource(sourceWin, targetWin, editUrl, newUrl) {
    await sourceWin.openPage(editUrl);
    await targetWin.openPage(newUrl);

    const sourceForm = await sourceWin.waitForElement('form');
    const targetForm = await targetWin.waitForElement('form');

    await copyFormData(sourceForm, targetForm);
    await targetForm.querySelector('input[type="submit"]').click();

    await targetWin.waitForElement('.alert-success');
    log(`Ресурс успешно скопирован: ${newUrl}`);
}

function CSVToArray(CSV_string, delimiter = ',') {
    delimiter = (delimiter || ","); // user-supplied delimeter or default comma

    var pattern = new RegExp( // regular expression to parse the CSV values.
        ( // Delimiters:
            "(\\" + delimiter + "|\\r?\\n|\\r|^)" +
            // Quoted fields.
            "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
            // Standard fields.
            "([^\"\\" + delimiter + "\\r\\n]*))"
        ), "gi"
    );

    var rows = [[]]; // array to hold our data. First row is column headers.
    // array to hold our individual pattern matching groups:
    var matches = false; // false if we don't find any matches
    // Loop until we no longer find a regular expression match
    while (matches = pattern.exec(CSV_string)) {
        var matched_delimiter = matches[1]; // Get the matched delimiter
        // Check if the delimiter has a length (and is not the start of string)
        // and if it matches field delimiter. If not, it is a row delimiter.
        if (matched_delimiter.length && matched_delimiter !== delimiter) {
            // Since this is a new row of data, add an empty row to the array.
            rows.push([]);
        }
        var matched_value;
        // Once we have eliminated the delimiter, check to see
        // what kind of value was captured (quoted or unquoted):
        if (matches[2]) { // found quoted value. unescape any double quotes.
            matched_value = matches[2].replace(
                new RegExp("\"\"", "g"), "\""
            );
        } else { // found a non-quoted value
            matched_value = matches[3];
        }
        // Now that we have our value string, let's add
        // it to the data array.
        rows[rows.length - 1].push(matched_value);
    }
    return rows; // Return the parsed data Array
}

async function createJsConsoles() {
    currentWindow.jsCodeArea.rows = 1;
    currentWindow.jsCodeArea.cols = 1;
    currentWindow.jsCodeArea.id = 'js_code';
    currentWindow.jsCodeArea.style = 'min-height:75px; min-width:400px; max-width:1000px; max-height:500px;';
    currentWindow.jsCodeArea.placeholder = 'Место для JS-кода';

    function run_script() {
        function clear() {
            currentWindow.jsLoggingConsole.value = '';
        }
        try {
            // Wrap the code in a block that returns a value if log is called.
            const codeToExecute = `(async () => { ${currentWindow.jsCodeArea.value}
            })();`;
            const result = eval(codeToExecute);
            result.then(val => {
                if (val !== undefined) currentWindow.log(String(val));
            }).catch(e => currentWindow.log(String(e)));
        } catch (e) {
            currentWindow.log(String(e));
        }
    }

    const runButton = createButton('Запустить', run_script, 'btn-info');
    runButton.style = 'align-self: center; margin-left: 20px; margin-right:20px;';

    currentWindow.jsLoggingConsole.rows = 1;
    currentWindow.jsLoggingConsole.cols = 1;
    currentWindow.jsLoggingConsole.id = 'js_console';
    currentWindow.jsLoggingConsole.disabled = true;
    currentWindow.jsLoggingConsole.style = 'min-height:75px; min-width:400px; max-width:1000px; max-height:500px; background-color:white;';
    currentWindow.jsLoggingConsole.placeholder = 'Консоль';

    try {
        let body = currentWindow.body;
        let divForConsoles = createElement('div', '', 'display: flex; flex-direction: row; justify-content: center; position: sticky; top:0; background:white; z-index:1049;');
        divForConsoles.appendChild(currentWindow.jsCodeArea);
        divForConsoles.appendChild(runButton);
        divForConsoles.appendChild(currentWindow.jsLoggingConsole);
        body.insertBefore(divForConsoles, body.firstChild);

    } catch (e) {
        displayError(e, 'Не могу добавить некоторые поля');
    }
}


// регулярки для проверки текущей страницы админки
const pagePatterns = {
    // обучение - курсы
    courses: /admin\/courses($|\?|utf|q)/,
    coursesEdit: /admin\/courses\/\d*\/edit/,
    newCoursesEdit: /admin\/new_courses\/\d*\/edit/,
    miniGroupsEdit: /admin\/mini_groups\/\d*\/edit/, /* пока не используется */
    lessons: /lessons[#$]?$/,
    lessonsOrder: /lessons_order$/,
    groups: /groups([?#]|$)/,
    newDuplicates: /course_duplicates\/new$/,
    pdfCreate: /\/course_plans\/new/,
    pdfEdit: /course_plans\/\d*\/edit/,
    installments: /installments$/,
    // обучение - тесты
    trainingsTaskTemplates: /trainings\/\d*\/task_templates/,
    trainingsIndividualTasks: /trainings\/task_templates\/\d*\/individual_tasks/,
    // практика - задачи
    taskPreviewAnswers: /admin\/tasks\/\d*\/preview#ans/,
    // обучение - мероприятия
    eventsNew: /admin\/events\/new/,
    eventsEdit: /admin\/events\/\d*\/edit/,
    // практика - учебные программы
    methodicalBlockEdit: /methodical_materials\/programs\/[\d]*\/blocks\/\d*\/edit/,
    methodicalLinkCreateVideo: /methodical_materials\/units\/\d*\/link_items\/new#szh/,
    // эдш - типы продуктов
    gridsCreate: /externship\/product_types\/\d*\/grids\/new/,
    gridsEdit: /externship\/product_types\/\d*\/grids\/[\d]*\/edit/,
    individualItems: /externship\/product_types\/\d*\/individual\/items$/,
    individualItemsCreateMass: /externship\/product_types\/\d*\/individual\/items\/new_mass$/,
    // прочее
    devServices: /admin\/dev_services([?#]|$)/,
    massChange: 'https://foxford.ru/admin/mass_change',
    index: 'https://foxford.ru/admin',
    hasAnchor: /#/
};


(async function () {
    'use strict';
    currentWindow = await createWindow(null);
    currentWindow.waitForLoad();

    // создаем поле для js-кода, кнопку запуска и нашу консоль
    if (!currentWindow.checkPath(pagePatterns.taskPreviewAnswers)) {
        createJsConsoles();
        if (currentWindow.checkPath(pagePatterns.hasAnchor)) {
            let anchorElement;
            let anchor = currentWindow.location.href.slice(currentWindow.location.href.search('#'))
            try {
                anchorElement = currentWindow.querySelector(anchor);
            }
            catch (err) {
                try {
                    anchorElement = currentWindow.querySelector(`[name="${anchor.substring(1, 1000)}"]`);
                }
                catch (err) { displayError(err); }
            }

            anchorElement.scrollIntoView({ behavior: 'smooth' });
            currentWindow.scrollBy(0, -80);
        }
    }
    currentWindow.body.firstChild.className += ' loaded';

    /************************* Обучение - курсы *************************/

    // на странице со списком курсов
    if (currentWindow.checkPath(pagePatterns.courses)) {
        let idSearchButton = createButton('Найти по ID', async () => { }, 'btn-default', false);
        const idElement = currentWindow.querySelector('#q_id_eq');
        idSearchButton.href = 'https://foxford.ru/admin/courses?q%5Bid_eq%5D=' + idElement.value;
        idElement.style = 'width:52%;';
        idElement.parentNode.style = 'margin-right:-7pt;';
        idElement.onchange = function () { idSearchButton.href = 'https://foxford.ru/admin/courses?q%5Bid_eq%5D=' + idElement.value; }
        currentWindow.querySelector('.q_id_eq').appendChild(idSearchButton);
        log('Страница модифицирована')
    }
    // на странице редактирования курса (новый вариант или старый)
    if (currentWindow.checkPath(pagePatterns.coursesEdit) ||
        currentWindow.checkPath(pagePatterns.newCoursesEdit)) {
        let asyncElement = currentWindow.querySelector('#course_asynchronous');
        let teachersElement = currentWindow.querySelector('#course_merged_teacher_ids');
        let purchaseModeElement = currentWindow.querySelector('#course_purchase_mode');
        let publishedElement = currentWindow.querySelector('#course_published');
        let visibleInListElement = currentWindow.querySelector('#course_visible_in_list');
        let installmentElement = currentWindow.querySelector('#course_installment_enabled');
        let maternityCapitalElement = currentWindow.querySelector('#course_maternity_capital');
        let fullNameElement = currentWindow.querySelector('#course_full_name');
        let nameElement = currentWindow.querySelector('#course_name');
        let subtitleElement = currentWindow.querySelector('#course_subtitle');
        let visibleInCalendarElement = currentWindow.querySelector('#course_visible_in_calendar');
        asyncElement.onchange = checkAsynchronousCourse;
        teachersElement.onchange = () => { checkAsynchronousCourse(); checkCanceledCourse(); };
        purchaseModeElement.onchange = checkCanceledCourse;
        publishedElement.onchange = () => { checkAsynchronousCourse(); checkCanceledCourse(); };
        visibleInListElement.onchange = checkCanceledCourse;
        installmentElement.onchange = checkCanceledCourse;
        maternityCapitalElement.onchange = checkCanceledCourse;
        visibleInCalendarElement.onchange = checkCanceledCourse;
        let warningTeachersNoLive = createElement('div', '', 'color:orange;font-size: 11px; top: 3px');
        warningTeachersNoLive.hidden = true;
        warningTeachersNoLive.innerHTML = 'В неасинхронном курсе должны быть только живые преподаватели';
        currentWindow.querySelector(".course_merged_teacher_ids").childNodes[1].appendChild(warningTeachersNoLive);
        let warningAsyncNoLive = warningTeachersNoLive.cloneNode(true);
        currentWindow.querySelector('.course_asynchronous').firstChild.appendChild(warningAsyncNoLive);
        function checkAsynchronousCourse() {
            if (!asyncElement.checked && publishedElement.checked) {
                let noLiveTeachersInCourse = teachersElement.value.split(',').filter(x => { for (let i of NO_LIVE_TEACHER_IDS) { if (x == i) { return true } } return false });
                if (noLiveTeachersInCourse.length) {
                    // Преподаватель должен быть живой, так как курс асинхронный
                    warningTeachersNoLive.hidden = false; warningAsyncNoLive.hidden = false;
                }
                else { warningTeachersNoLive.hidden = true; warningAsyncNoLive.hidden = true; }
            }
            else { warningTeachersNoLive.hidden = true; warningAsyncNoLive.hidden = true; }
        }
        checkAsynchronousCourse();
        let warningTeacherCancel = createElement('div', '', 'color:orange;font-size: 11px; top: 3px');
        warningTeacherCancel.hidden = true;
        warningTeacherCancel.innerHTML = 'В отмененном курсе преподавателем не может быть других преподавателей, кроме Галины Отменной';
        let warningTeacherPurchashing = warningTeacherCancel.cloneNode(true); warningTeacherPurchashing.innerHTML = 'В отмененном курсе необходимо отключить приобретение';
        let warningPurchashingCancel = warningTeacherPurchashing.cloneNode(true);
        let warningTeacherPublished = warningTeacherCancel.cloneNode(true); warningTeacherPublished.innerHTML = 'Отмененный курс необходимо распубликовать';
        let warningPublishedCancel = warningTeacherPublished.cloneNode(true);
        let warningTeacherInList = warningTeacherCancel.cloneNode(true); warningTeacherInList.innerHTML = 'Отмененный курс необходимо убрать из каталога';
        let warningInListCancel = warningTeacherInList.cloneNode(true);
        let warningTeacherInstallments = warningTeacherCancel.cloneNode(true); warningTeacherInstallments.innerHTML = 'Необходимо отключить оплату по частям в отмененном курсе';
        let warningInstallmentsCancel = warningTeacherInstallments.cloneNode(true);
        let warningTeacherMatheriny = warningTeacherCancel.cloneNode(true); warningTeacherMatheriny.innerHTML = 'Необходимо отключить оплату маткапиталом в отмененном курсе';
        let warningMatherinyCancel = warningTeacherMatheriny.cloneNode(true);
        let warningTeacherCalendar = warningTeacherCancel.cloneNode(true); warningTeacherCalendar.innerHTML = 'Необходимо отключить отображение в календаре отмененного курса';
        let warningCalendarCancel = warningTeacherCalendar.cloneNode(true);
        let warningCourseName = warningTeacherCancel.cloneNode(true); warningCourseName.innerHTML = 'В названиях курса необходимо указать, что курс отменен';
        let saveReminder = warningTeacherCancel.cloneNode(true); saveReminder.innerHTML = 'Не забудьте сохранить изменения :)';
        currentWindow.querySelector(".course_merged_teacher_ids").childNodes[1].appendChild(warningTeacherCancel);
        currentWindow.querySelector(".course_merged_teacher_ids").childNodes[1].appendChild(warningTeacherPurchashing);
        currentWindow.querySelector(".course_purchase_mode").childNodes[1].appendChild(warningPurchashingCancel);
        currentWindow.querySelector(".course_merged_teacher_ids").childNodes[1].appendChild(warningTeacherPublished);
        publishedElement.parentNode.parentNode.appendChild(warningPublishedCancel);
        currentWindow.querySelector(".course_merged_teacher_ids").childNodes[1].appendChild(warningTeacherInList);
        visibleInListElement.parentNode.parentNode.appendChild(warningInListCancel);
        currentWindow.querySelector(".course_merged_teacher_ids").childNodes[1].appendChild(warningTeacherInstallments);
        installmentElement.parentNode.parentNode.appendChild(warningInstallmentsCancel);
        currentWindow.querySelector(".course_merged_teacher_ids").childNodes[1].appendChild(warningTeacherMatheriny);
        maternityCapitalElement.parentNode.parentNode.appendChild(warningMatherinyCancel);
        visibleInCalendarElement.parentNode.parentNode.appendChild(warningCalendarCancel);
        currentWindow.querySelector(".course_merged_teacher_ids").childNodes[1].appendChild(warningTeacherCalendar);
        const cancelButtonOnClick = () => {
            teachersElement.value = CANCEL_GALINA_ID;
            purchaseModeElement.value = 'disabled';
            let x = currentWindow.querySelector('#s2id_course_purchase_mode').firstChild.childNodes[1];
            x.innerHTML = x.innerHTML.replace('Включено', 'Отключено');
            publishedElement.checked = false;
            visibleInListElement.checked = false;
            installmentElement.checked = false;
            maternityCapitalElement.checked = false;
            visibleInCalendarElement.checked = false;
            let a = currentWindow.querySelectorAll('#s2id_course_merged_teacher_ids .select2-search-choice.ui-sortable-handle');
            for (let el of a) {
                if (el.outerHTML && el.innerHTML.match(/Отменная Г./)) { }
                else { el.hidden = true; }
            }
            saveReminder.hidden = false;
            if (nameElement.value.search('Отмен') == -1 && nameElement.value.search('НЕАКТУАЛЬН') == -1) {
                nameElement.value = 'Отмененный курс. ' + nameElement.value;
                nameElement.value = nameElement.value.substring(0, 35);
            }
            if (fullNameElement.value.search('Отмен') == -1 && nameElement.value.search('НЕАКТУАЛЬН') == -1) {
                fullNameElement.value = 'Отмененный курс. ' + fullNameElement.value;
                fullNameElement.value = fullNameElement.value.substring(0, 512);
            }
            if (subtitleElement.value.search('Отмен') == -1 && nameElement.value.search('НЕАКТУАЛЬН') == -1) {
                subtitleElement.value = 'Отмененный курс. ' + subtitleElement.value;
                subtitleElement.value = subtitleElement.value.substring(0, 57);
            }
            checkAsynchronousCourse();
            checkCanceledCourse();
        }
        let cancelCourseButton = createButton('Доотменить', cancelButtonOnClick, 'btn-default', false);
        cancelCourseButton.style = 'display:none';
        currentWindow.querySelector(".course_merged_teacher_ids").childNodes[1].appendChild(saveReminder);
        currentWindow.querySelector(".course_merged_teacher_ids").childNodes[1].appendChild(cancelCourseButton);
        function checkCanceledCourse() {
            let teachersList = teachersElement.value.split(',');
            let cancelTeachersList = teachersList.filter(x => { if (x == CANCEL_GALINA_ID) { return true } return false });
            let hasCancelGalinaInTeachers = cancelTeachersList.length > 0;
            if (hasCancelGalinaInTeachers) { // Галя, у нас отмена
                let hasProblems = false;
                // есть другие преподаватели кроме Галины
                if (teachersList.length > 1) { warningTeacherCancel.hidden = false; hasProblems = true; }
                else { warningTeacherCancel.hidden = true }
                // включено приобретение
                if (purchaseModeElement.value != 'disabled') { warningTeacherPurchashing.hidden = false; warningPurchashingCancel.hidden = false; hasProblems = true; }
                else { warningTeacherPurchashing.hidden = true; warningPurchashingCancel.hidden = true }
                // опубликован
                if (publishedElement.checked) { warningTeacherPublished.hidden = false; warningPublishedCancel.hidden = false; hasProblems = true; }
                else { warningTeacherPublished.hidden = true; warningPublishedCancel.hidden = true }
                // в каталоге
                if (visibleInListElement.checked) { warningTeacherInList.hidden = false; warningInListCancel.hidden = false; hasProblems = true; }
                else { warningTeacherInList.hidden = true; warningInListCancel.hidden = true }
                // оплата по частям
                if (installmentElement.checked) { warningTeacherInstallments.hidden = false; warningInstallmentsCancel.hidden = false; hasProblems = true; }
                else { warningTeacherInstallments.hidden = true; warningInstallmentsCancel.hidden = true }
                // оплата маткапиталом
                if (maternityCapitalElement.checked) { warningTeacherMatheriny.hidden = false; warningMatherinyCancel.hidden = false; hasProblems = true; }
                else { warningTeacherMatheriny.hidden = true; warningMatherinyCancel.hidden = true }
                // в календаре
                if (visibleInCalendarElement.checked) { warningTeacherCalendar.hidden = false; warningCalendarCancel.hidden = false; hasProblems = true; }
                else { warningTeacherCalendar.hidden = true; warningCalendarCancel.hidden = true }
                // имя без отмен
                if ((nameElement.value.search('Отмен') != -1 && nameElement.value.search('НЕАКТУАЛЬН') != -1) || (fullNameElement.value.search('Отмен') != -1 && fullNameElement.value.search('НЕАКТУАЛЬН') != -1)) { warningCourseName.hidden = false; hasProblems = true; }
                else { warningCourseName.hidden = true; }
                // хотя бы 1 не как надо
                if (hasProblems) { cancelCourseButton.style = ''; }
                else { cancelCourseButton.style = 'display:none'; }
            }
            else {
                warningTeacherCancel.hidden = true; warningTeacherPurchashing.hidden = true; warningPurchashingCancel.hidden = true;
                warningTeacherPublished.hidden = true; warningPublishedCancel.hidden = true; warningTeacherInList.hidden = true; warningInListCancel.hidden = true;
                warningTeacherInstallments.hidden = true; warningInstallmentsCancel.hidden = true; warningTeacherMatheriny.hidden = true; warningMatherinyCancel.hidden = true;
                warningTeacherCalendar.hidden = true; warningCalendarCancel.hidden = true; warningCourseName.hidden = true;
                cancelCourseButton.style = 'display:none';
            }
        }
        checkCanceledCourse();
        if (currentWindow.checkPath(pagePatterns.coursesEdit)) {
            log('Страница модифицирована');
        }
    }
    // на странице редактирования курса (новый вариант)
    if (currentWindow.checkPath(pagePatterns.newCoursesEdit)) {
        let buttonArea = createElement('div');
        let showButton = createButton('Продвинутые возможности', async () => { });
        let hideButton = createButton('Скрыть продвинутые возможности', async () => { });
        hideButton.hidden = true;
        let copyLandingButton = createButton('Скопировать данные для лендинга из другого курса (кроме цен)', async () => { });
        copyLandingButton.hidden = true;
        showButton.onclick = function () {
            showButton.hidden = true; copyLandingButton.hidden = false; hideButton.hidden = false;
        }
        hideButton.onclick = function () {
            showButton.hidden = false; copyLandingButton.hidden = true; hideButton.hidden = true;
        }
        // по хорошему обновить эту функцию или убрать совсем
        copyLandingButton.onclick = async () => {
            try {
                let isConfirmed = true;
                let hasBotApproval = checkBotApprove();
                if (!hasBotApproval()) {
                    isConfirmed = confirm('Внимание! Данные подставятся, но не будут сохранены автоматически. Проверьте правильность переноса, а потом нажмите «Сохранить»\n' +
                        'Перенесутся названия, подзаголовок, описание, экспресс-надпись, теги для каталога, адрес для редиректа, 3 буллита и 3 смысловых блока (не сработает на тренажерных курсах и курсах Ф.Учителю)\n' +
                        'НЕ переносятся цены, галочки, FAQ и PDF - программа');
                }
                if (!isConfirmed) { return }
                let originalCourseId = prompt('Введите ID курса, из которого нужно взять данные для лендинга');
                let secondaryWindow = await createWindow();
                await secondaryWindow.openPage('https://foxford.ru/admin/new_courses/' + originalCourseId + '/edit');
                await secondaryWindow.waitForElement('[name="course[landing_programs_attributes][2][body]"]');
                let textAttributesList = ['course_name', 'course_subtitle', 'course_full_name', 'course_description', 'course_promo_label', 'course_catalog_tag_ids',
                    'course_landing_url', 'course_timing_title', 'course_timing_description', 'course_landing_programs_attributes_0_title',
                    'course_landing_programs_attributes_1_title', 'course_landing_programs_attributes_2_title',
                    'course_landing_programs_attributes_0_body', 'course_landing_programs_attributes_1_body',
                    'course_landing_programs_attributes_2_body', 'course_landing_features_attributes_0_title',
                    'course_landing_features_attributes_1_title', 'course_landing_features_attributes_2_title',
                    'course_landing_features_attributes_0_body', 'course_landing_features_attributes_1_body', 'course_landing_features_attributes_2_body'];
                for (let attr of textAttributesList) {
                    currentWindow.querySelector(`#${attr}`).value = secondaryWindow.querySelector(`#${attr}`).value
                }
                await secondaryWindow.close();
                displayLog('Готово! Не забывайте сохранить изменения)');
            }
            catch (err) { displayError(err); }
        }
        buttonArea.appendChild(showButton); buttonArea.appendChild(copyLandingButton); buttonArea.appendChild(hideButton);
        let titleArea = currentWindow.querySelector('.courses');
        titleArea.insertBefore(buttonArea, titleArea.childNodes[1]);
        log('Страница модифицирована');
    }

    // на странице с программой
    if (currentWindow.checkPath(pagePatterns.lessons)) {
        let LessonTasksLinks = currentWindow.querySelectorAll('[href$="lesson_tasks"]');
        for (let tasksLink of LessonTasksLinks) {
            // добавляем к ссылке пустой поиск, чтобы всегда было побольше задач в выдаче
            tasksLink.href += '?q%5Bdisciplines_id_in%5D='
        }
        let status = createElement('div', 'my-status', 'display:none;');
        status.innerHTML = 'not-finished'; // статус выполнения функций для бота
        let div = createElement('div');
        let lessonIntervalForm = createElement('form');
        lessonIntervalForm.appendChild(status);
        let selectFirstLesson = createFormElement(lessonIntervalForm, 'select', 'Массовые правки вносятся с ', 'tm_from_lesson', '', false);
        let selectLastLesson = createFormElement(lessonIntervalForm, 'select', ' по ', 'tm_last_lesson', '', false);
        selectFirstLesson.style = 'margin:5pt; max-width:150px; display: inline;'; selectLastLesson.style = 'margin:5pt; max-width:150px; display: inline;';
        selectFirstLesson.onchange = async () => { currentWindow.firstLessonNumber = Number(selectFirstLesson.value); };
        selectLastLesson.onchange = async () => { currentWindow.lastLessonNumber = Number(selectLastLesson.value); };
        let spn = createElement('span');
        spn.innerHTML = '(включительно)';
        lessonIntervalForm.appendChild(spn);
        let lessonNumbersList = _.toArray(currentWindow.querySelector('.lessons-list').childNodes).map(lesson => { let lessonTitle = lesson.querySelector('.panel-title').innerHTML; let backspaceSecondIndex = lessonTitle.indexOf(' ', lessonTitle.indexOf(' ') + 1); return lessonTitle.substring(0, backspaceSecondIndex) });
        for (let lessonNumberIndex = 0; lessonNumberIndex < lessonNumbersList.length; lessonNumberIndex++) {
            let optionFirst = createElement('option'); let optionLast = createElement('option');
            optionFirst.value = lessonNumberIndex; optionFirst.innerHTML = lessonNumbersList[lessonNumberIndex]; selectFirstLesson.appendChild(optionFirst);
            optionLast.value = lessonNumberIndex; optionLast.innerHTML = lessonNumbersList[lessonNumberIndex]; selectLastLesson.appendChild(optionLast);
            const lessonDescription = currentWindow.querySelector('.lessons-list').childNodes[lessonNumberIndex].querySelector('textarea');
            // убираем по одной кавычке из описания с каждого края --- защита от гугл-таблиц
            lessonDescription.onchange = selfi => { let self = selfi.currentTarget; if (self.value[0] == '"') { self.value = self.value.substring(1, self.value.length) }; if (self.value[self.value.length - 1] == '"') { self.value = self.value.substring(0, self.value.length - 1) } }
        }
        selectFirstLesson.value = 0;
        selectLastLesson.value = lessonNumbersList.length - 1;
        let adminkaFeatures = createElement('div', 'adminka-features');
        let adminkaFeaturesTitle = createElement('p', '', 'display: inline;');
        adminkaFeaturesTitle.innerHTML = 'Для админов админки: ';
        adminkaFeatures.appendChild(adminkaFeaturesTitle);
        let contentFeatures = createElement('div', 'content-features');
        let contentFeaturesTitle = createElement('p', '', 'display: inline;');
        contentFeaturesTitle.innerHTML = 'Для админов контента: ';
        contentFeatures.appendChild(contentFeaturesTitle);
        let checkNoWebinarButton = createButton('Проставить «Без вебинара»', async () => { });
        let uncheckNoWebinarButton = createButton('Снять «Без вебинара»', async () => { });
        let clearDeadlineButton = createButton('Убрать дедлайны на задачи с РП', async () => { });
        let clearExtraTicksButton = createButton('Убрать галки с пустых домашек и конспектов', async () => { });
        let checkMissTicksButton = createButton('Проставить галки на непустые домашки и конспекты', async () => { });
        let deleteLessonsButton = createButton('Удалить занятия', async () => { }, 'remove-lessons');
        let makeFreeButton = createButton('Сделать бесплатным', async () => { });
        let makePaidButton = createButton('Сделать платным', async () => { });
        let lessonsFromCsvButton = createButton('Подгрузить программу из CSV - файла', async () => { }, 'csv-btn');
        checkNoWebinarButton.onclick = async () => {
            let isConfirmed = true;
            if (!checkBotApprove()) {
                isConfirmed = confirm('Галочка «Без вебинара» будет проставлена на выбранных занятиях, если есть возможность её поставить');
            }
            if (isConfirmed) {
                try {
                    log('Запущено проставление галок «Без вебинара»');
                    let lessonsList = currentWindow.querySelectorAll('[id^="edit_lesson_"]');
                    for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
                        let lessonElement = lessonsList[num];
                        let testCheckbox = lessonElement.querySelector('[name="lesson[test]"][type="checkbox"]');
                        if (testCheckbox !== null && !testCheckbox.checked) {
                            testCheckbox.checked = true;
                            let saveButton = lessonElement.querySelector('.btn-success');
                            saveButton.style = '';
                            saveButton.click();
                            let lessonNumAndId = lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
                            log(lessonNumAndId[1] + ' ' + lessonNumAndId[lessonNumAndId.length - 1]);
                            await currentWindow.waitForElement(`#${lessonElement.id} .btn-success:not([style=""])`);
                        }
                    }
                    displayLog('Завершено проставление галок «Без вебинара»');
                } catch (err) { displayError(err); }
            }
        }
        uncheckNoWebinarButton.onclick = async () => {
            let isConfirmed = true;
            if (!checkBotApprove()) {
                isConfirmed = confirm('Галочка «Без вебинара» будет снята на выбранных занятиях, если она там стоит');
            }
            if (isConfirmed) {
                try {
                    log('Запущено удаление галок «Без вебинара»');
                    let lessonsList = currentWindow.querySelectorAll('[id^="edit_lesson_"]');
                    for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
                        let lessonElement = lessonsList[num];
                        let testCheckbox = lessonElement.querySelector('[name="lesson[test]"][type="checkbox"]');
                        if (testCheckbox !== null && testCheckbox.checked) {
                            testCheckbox.checked = false;
                            let saveButton = lessonElement.querySelector('.btn-success');
                            saveButton.style = '';
                            saveButton.click();
                            let lessonNumAndId = lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
                            log(lessonNumAndId[1] + ' ' + lessonNumAndId[lessonNumAndId.length - 1]);
                            await currentWindow.waitForElement(`#${lessonElement.id} .btn-success:not([style=""])`);
                        }
                    }
                    displayLog('Завершено удаление галок «Без вебинара»');
                } catch (err) { displayError(err); }
            }
        }
        clearDeadlineButton.onclick = async () => {
            let isConfirmed = true;
            if (!checkBotApprove()) {
                isConfirmed = confirm('Дедлайны на задачи с ручной проверкой в указанных занятиях будут очищены');
            }
            if (isConfirmed) {
                try {
                    log('Запущено удаление дедлайнов');
                    let lessonsList = currentWindow.querySelectorAll('[id^="edit_lesson_"]');
                    for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
                        let lessonElement = lessonsList[num];
                        let deadlineCheckbox = lessonElement.querySelector('[name="lesson[tasks_deadline]');
                        if (deadlineCheckbox !== null && deadlineCheckbox.value) {
                            deadlineCheckbox.value = '';
                            let saveButton = lessonElement.querySelector('.btn-success');
                            saveButton.style = '';
                            saveButton.click();
                            let lessonNumAndId = lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
                            log(lessonNumAndId[lessonNumAndId.length - 1]);
                            await currentWindow.waitForElement(`#${lessonElement.id} .btn-success:not([style=""])`);
                        }
                    }
                    displayLog('Завершено удаление дедлайнов');
                } catch (err) { displayError(err); }
            }
        }
        clearExtraTicksButton.onclick = async () => {
            let isConfirmed = true
            let hasBotApproval = checkBotApprove();
            if (!hasBotApproval()) {
                isConfirmed = confirm('Галки у пустых домашек и конспектов в указанных занятиях будут удалены');
            }
            if (isConfirmed) {
                try {
                    log('Запущено удаление галочек');
                    let lessonsList = currentWindow.querySelectorAll('[id^="edit_lesson_"]');
                    for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
                        let lessonElement = lessonsList[num];
                        let redLinkElements = lessonElement.querySelectorAll('.red_link');
                        let hasChanges = false;
                        for (let redLinkElement of redLinkElements) {
                            let taskRedElement = redLinkElement.innerHTML.match('задач');
                            let conspectRedElenent = redLinkElement.innerHTML.match('раздел');
                            if (taskRedElement !== null) {
                                let taskCheckbox = lessonElement.querySelector('[name="lesson[task_expected]"][type="checkbox"]');
                                if (taskCheckbox !== null && taskCheckbox.checked) {
                                    taskCheckbox.checked = '';
                                    hasChanges = true;
                                }
                            }
                            if (conspectRedElenent !== null) {
                                let conspectCheckbox = lessonElement.querySelector('[name="lesson[conspect_expected]"][type="checkbox"]');
                                if (conspectCheckbox !== null && conspectCheckbox.checked) {
                                    conspectCheckbox.checked = '';
                                    hasChanges = true;
                                }
                            }
                        }
                        if (hasChanges) {
                            let saveButton = lessonElement.querySelector('.btn-success');
                            saveButton.style = '';
                            saveButton.click();
                            let lessonNumAndId = lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
                            let lessonId = lessonNumAndId[lessonNumAndId.length - 1];
                            log(lessonId);
                            await currentWindow.waitForElement(`#${lessonElement.id} .btn-success:not([style=""])`);
                        }
                    }
                    displayLog('Завершено удаление галочек');
                } catch (err) { displayError(err); }
            }
        }
        checkMissTicksButton.onclick = async () => {
            let isConfirmed = true;
            let hasBotApproval = checkBotApprove();
            if (!hasBotApproval()) {
                isConfirmed = confirm('Галки у непустых домашек и конспектов в указанных занятиях будут проставлены');
            }
            if (isConfirmed) {
                try {
                    log('Запущено проставление галочек');
                    let lessonsList = currentWindow.querySelectorAll('[id^="edit_lesson_"]');
                    for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
                        let lessonElement = lessonsList[num];
                        let greenLinkElements = lessonElement.querySelectorAll('.green_link');
                        let hasChanges = false;
                        for (let greenLinkElement of greenLinkElements) {
                            let taskGreenElement = greenLinkElement.innerHTML.match('задач');
                            let conspectGreenElenent = greenLinkElement.innerHTML.match('раздел');
                            if (taskGreenElement !== null) {
                                let taskCheckbox = lessonElement.querySelector('[name="lesson[task_expected]"][type="checkbox"]');
                                if (taskCheckbox !== null && !taskCheckbox.checked) {
                                    taskCheckbox.checked = true;
                                    hasChanges = true;
                                }
                            }
                            if (conspectGreenElenent !== null) {
                                let conspectCheckbox = lessonElement.querySelector('[name="lesson[conspect_expected]"][type="checkbox"]');
                                if (conspectCheckbox !== null && !conspectCheckbox.checked) {
                                    conspectCheckbox.checked = true;
                                    hasChanges = true;
                                }
                            }
                        }
                        if (hasChanges) {
                            let saveButton = lessonElement.querySelector('.btn-success');
                            saveButton.style = '';
                            saveButton.click();
                            let lessonNumAndId = lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
                            let lessonId = lessonNumAndId[lessonNumAndId.length - 1];
                            log(lessonId);
                            await currentWindow.waitForElement(`#${lessonElement.id} .btn-success:not([style=""])`);
                        }
                    }
                    log('Завершено проставление галочек');
                } catch (err) { displayError(err); }
            }
        }
        deleteLessonsButton.onclick = async () => {
            let isReadWarning = true;
            let isConfirmed = true;
            let hasBotApproval = checkBotApprove();
            if (!hasBotApproval) {
                isReadWarning = confirm('Внимание! Занятия в выбранном диапазоне будут удалены невозвратно\nЕсли вы указали все уроки, то после удаления курс будет автоматически распубликован');
                if (isReadWarning) {
                    isConfirmed = confirm('Для работы скрипта будет временно открыта новая вкладка\nРекомендуется заранее перенести все удаляемые занятия в конец курса\nЗанятия должны стоять будущей датой чтобы админка могла их удалить')
                }
            }
            if (isReadWarning && isConfirmed) {
                let secondaryWindow = await createWindow('adminka_011');
                let lessonsList = currentWindow.querySelectorAll('.lessons-list .row.lesson');
                for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
                    let deleteButton = lessonsList[num].querySelector('.btn-danger');
                    deleteButton.removeAttribute('data-confirm');
                    deleteButton.target = 'adminka_011'; deleteButton.click();
                    await secondaryWindow.waitForElement('.alert');
                    let alert = secondaryWindow.querySelector('.alert');
                    if (alert.className.match('danger')) {
                        log(lessonNumbersList[num] + '\t' + alert.innerHTML.replace(/<button(.*?)\/button>/, ''))
                    }
                    else {
                        log(lessonNumbersList[num]);
                    }
                    secondaryWindow.openPage('about:blank');
                    await sleep(100);
                }
                secondaryWindow.close();
                status.innerHTML = 'done';
                if (hasBotApproval) {
                    log('Процесс окончен');
                }
                else {
                    log('Процесс окончен, страница обновится через 5 секунд')
                    await sleep(5000);
                    currentWindow.reload();
                }
            }
        }
        makeFreeButton.onclick = async () => {
            let isConfirmed = true;
            let hasBotApproval = checkBotApprove();
            if (!hasBotApproval) {
                isConfirmed = confirm('Галочка «Бесплатный» будет проставлена на выбранных занятиях');
            }
            if (isConfirmed) {
                log('Запущено проставление галок «Бесплатный»');
                let lessonsList = document.querySelectorAll('[id^="edit_lesson_"]');
                for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
                    let lessonElement = lessonsList[num];
                    let freeCheckbox = lessonElement.querySelector('[name="lesson[free][type="checkbox"]"]');
                    if (freeCheckbox) {
                        freeCheckbox.checked = true;
                        let saveButton = lessonElement.querySelector('.btn-success');
                        saveButton.style = '';
                        saveButton.click();
                        let d = lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
                        log(d[1] + ' ' + d[d.length - 1]);
                        await currentWindow.waitForElement(`#${lessonElement.id} .btn-success:not([style=""])`);
                    }
                    log('Завершено проставление галок «Бесплатный»');
                };
                try { free(); } catch (e) { log(e); }
            }
            let x = document.querySelector('.course-settings').parentNode;
            x.insertBefore(div, x.childNodes[2]);
        }
        makePaidButton.onclick = async () => {
            let todo = confirm('Галочка «Бесплатный» будет снята на выбранных занятиях');
            if (todo) {
                let sleeptime;
                if (-document.getElementById('tm_from_lesson').value + document.getElementById('tm_last_lesson').value < 150) { sleeptime = 100; }
                else { sleeptime = parseInt(prompt('Укажите время задержки между сохранениями в милисекундах', 100)); }
                async function free() {
                    log('Запущено удаление галок «Бесплатный»');
                    log('Подготовка');
                    let a = document.getElementsByName('lesson[free]');
                    for (let i = 1; i <= a.length / 2 - 1; i += 1) {
                        a[2 * i + 1].className += ' lesson_free_checkbox';
                    }
                    let b = document.querySelectorAll('[id^="edit_lesson_"]');
                    for (let j = Number(document.getElementById('tm_from_lesson').value); j <= document.getElementById('tm_last_lesson').value; j++) {
                        let i = b[j];
                        let c = i.getElementsByClassName('lesson_free_checkbox');
                        if (c.length) {
                            c[0].checked = false;
                            let btn = i.getElementsByClassName('btn-success')[0];
                            btn.style = '';
                            btn.click();
                            let d = i.getElementsByClassName('panel-title')[0].innerHTML.match(/\b\d+\b/g);
                            log(d[1] + ' ' + d[d.length - 1]);
                            if (!isNaN(sleeptime)) { await sleep(sleeptime); } else { await sleep(100); }
                        }
                    }
                    log('Завершено удаление галок «Бесплатный»');
                };
                try { free(); } catch (e) { log(e); }
            }
            let x = document.getElementsByClassName('course-settings')[0].parentNode;
            x.insertBefore(div, x.childNodes[2]);
        }
        lessonsFromCsvButton.onclick = async () => {
            //showButton.hidden = true; hideButton.hidden = true;
            adminkaFeatures.hidden = true; contentFeatures.hidden = true;
            // programm ////////
            let inp = document.createElement('input'); inp.type = 'file'; inp.accept = "text/csv"; inp.required = 'required';
            let btn = createButton('Готово', async () => { });
            btn.onclick = async function () {
                let todo = true;
                let hasBotApproval = checkBotApprove();
                if (!hasBotApproval) {
                    todo = confirm('Названия и описания выбранных занятий будут заменены на новые, старые названия будут утеряны безвозвратно');
                }
                if (!todo) { return }
                let reader = new FileReader();
                reader.onload = async function () {
                    let allRows = CSVToArray(reader.result);
                    let k = Number(selectFirstLesson.value);
                    let n = Number(selectLastLesson.value);
                    let a = document.querySelectorAll('.row.lesson');
                    let b = _.toArray(a).slice(1);
                    let z = -1;
                    for (var singleRow = 0; singleRow < Math.min(allRows.length, n - k + 1); singleRow++) {
                        let i = singleRow + k;
                        let rowCells = allRows[singleRow];
                        for (var rowCell = 0; rowCell < rowCells.length; rowCell++) {
                            // log(rowCells[rowCell]);
                            if (rowCell == 0 && rowCells[rowCell]) {
                                document.getElementsByName('lesson[name]')[i + 1].value = rowCells[rowCell];
                            }
                            if (rowCell == 1 && rowCells[rowCell]) {
                                document.getElementsByName('lesson[themes_as_text]')[i + 1].value = rowCells[rowCell];
                            }
                            // /*
                            if (rowCell == 2 && rowCells[rowCell]) {
                                try {
                                    //document.getElementsByName('lesson[video_url]')[i+1].value=rowCells[rowCell];
                                    document.getElementsByName('lesson[name]')[i + 1].parentNode.parentNode.parentNode.parentNode.querySelectorAll('[name="lesson[video_url]"]')[0].value = rowCells[rowCell];
                                }
                                catch (e) {
                                    //log(e);
                                    //
                                }
                            }
                            // */
                        }
                        if (b[i].innerHTML.match(/Нулевое/)) { z = i }
                        else {
                            document.getElementsByClassName('btn-success')[i + 3].style = '';
                            document.getElementsByClassName('btn-success')[i + 3].click();
                        }
                        log(i + 1);
                        await sleep(100);
                    }
                    if (z != -1) {
                        document.getElementsByClassName('btn-success')[z + 3].style = '';
                        document.getElementsByClassName('btn-success')[z + 3].click();
                    }
                    log('Готово')
                    alert('Готово')
                };
                reader.onerror = function () {
                    alert(reader.error);
                };
                reader.readAsText(inp.files[0])

            }
            div.appendChild(inp); div.appendChild(btn);
        }
        div.appendChild(lessonIntervalForm); div.appendChild(adminkaFeatures); div.appendChild(contentFeatures);
        adminkaFeatures.appendChild(lessonsFromCsvButton); adminkaFeatures.appendChild(checkNoWebinarButton); adminkaFeatures.appendChild(uncheckNoWebinarButton); adminkaFeatures.appendChild(clearDeadlineButton); contentFeatures.appendChild(clearExtraTicksButton); contentFeatures.appendChild(checkMissTicksButton);
        adminkaFeatures.appendChild(deleteLessonsButton); adminkaFeatures.appendChild(makeFreeButton); adminkaFeatures.appendChild(makePaidButton);
        let x;
        try {
            x = document.getElementsByClassName('course-settings')[0].parentNode;
        }
        catch {
            x = document.getElementsByClassName('lesson_course_id')[0].parentNode.parentNode;
        }
        x.insertBefore(div, x.childNodes[2]);
        if (window.location.href.match('#csv')) { document.querySelector('.csv-btn').classList.add('bot-approve'); btn_show_onclick(); btn_csv_onclick(); }
        log('Страница модифицирована');
    }
    // на странице изменения порядка уроков
    if (currentWindow.checkPath(pagePatterns.lessonsOrder)) {
        let checkbox0 = document.getElementsByClassName('checkbox')[0].firstChild.firstChild;
        let checkbox1 = document.getElementsByClassName('checkbox')[1].firstChild.firstChild;
        let div = document.createElement('div');
        let btn_show = document.createElement('button');
        btn_show.innerHTML = 'Продвинутые возможности';
        let btn_hide = document.createElement('button'); btn_hide.hidden = true;
        btn_hide.innerHTML = 'Скрыть продвинутые возможности';
        let btn_masstime = document.createElement('button'); btn_masstime.hidden = true;
        btn_masstime.innerHTML = 'Массовое проставление одного времени';
        btn_show.onclick = function () {
            btn_show.hidden = true; btn_masstime.hidden = false; btn_hide.hidden = false;
        }
        btn_hide.onclick = function () {
            btn_show.hidden = false; btn_masstime.hidden = true; btn_hide.hidden = true;
        }
        btn_masstime.onclick = function () {
            async function masssettime() {
                log('Запущено проставление дат');
                let today = new Date();
                let date = prompt("Введите дату, которую нужно проставить у всех безвебинарных занятий:", (today.getDate() - 1) + "." + (today.getMonth() + 1) + "." + today.getFullYear() + ' ' + today.getHours() + ':00');
                //log(1);
                let sleeptime = parseInt(prompt('Укажите время задержки между нажатиями на кнопки в милисекундах\nПри слишком маленькой задержке данные могут не успеть сохраниться', 300));
                if (checkbox0.checked) { checkbox0.click(); }
                if (!checkbox1.checked) { checkbox1.click(); }
                if (!isNaN(sleeptime)) { await sleep(sleeptime); } else { await sleep(300); }
                let a = document.getElementsByClassName('btn-link');
                if (!date || !sleeptime) { log('Проставление дат отменено'); return; };
                for (let index = 0, len = a.length; index < len; ++index) {
                    log(index + 1); a[index].click();
                    if (!isNaN(sleeptime)) { await sleep(sleeptime); } else { await sleep(300); }
                    document.querySelectorAll('[id^="date"]')[0].value = date;
                    document.getElementsByClassName('btn-primary')[0].click();
                    if (!isNaN(sleeptime)) { await sleep(sleeptime); } else { await sleep(300); }
                }
                log('Завершено проставление дат');
            }
            try { masssettime(); } catch (e) { log(e); }
        }
        div.appendChild(btn_show); div.appendChild(btn_masstime); div.appendChild(btn_hide);
        let x = document.getElementsByClassName('lessons-order-page')[0];
        x.insertBefore(div, x.childNodes[2]);
        log('Страница модифицирована');
    }

    // на странице с расписанием
    if (currentWindow.checkPath(pagePatterns.groups)) {
        let mcid = window.location.href.match(/\d+/)[0];
        let div = document.createElement('div');
        let btn_return_moderators = document.createElement('button');
        btn_return_moderators.innerHTML = 'Вернуть модераторов'; btn_return_moderators.hidden = false;
        div.appendChild(btn_return_moderators);
        let btn_show = document.createElement('button');
        btn_show.innerHTML = 'Продвинутые возможности';
        let btn_hide = document.createElement('button'); btn_hide.hidden = true;
        btn_hide.innerHTML = 'Скрыть продвинутые возможности';
        let btn_masscopy = document.createElement('button'); btn_masscopy.hidden = true;
        btn_masscopy.innerHTML = 'Массовое копирование занятий из другого курса в этот курс';
        let btn_prs = document.createElement('button'); btn_prs.hidden = false; btn_prs.className = 'reset-btn';
        btn_prs.innerHTML = '↑ Перестроить ↑';
        let btn_group_lessons;
        btn_show.onclick = function () {
            btn_show.hidden = true; btn_masscopy.hidden = false; btn_group_lessons.hidden = false; btn_hide.hidden = false;
        }
        btn_hide.onclick = function () {
            btn_show.hidden = false; btn_masscopy.hidden = true; btn_group_lessons.hidden = true; btn_hide.hidden = true;
        }
        btn_masscopy.onclick = function () {
            let cid = prompt('Процесс будет запущен в отдельной вкладке, не закрывайте ее до завершения процесса\nБудут скопированы все вебинарные занятия из другого курса в этот курс\nМожет потребоваться разрешение показывать сайту всплывающие окна\nВведите ID курса из которого необходимо скопировать записи:');
            if (parseInt(cid)) {
                btn_masscopy.disabled = true; btn_masscopy.style = 'color:gray';
                async function masscopygroups() {
                    let sleeptime = parseInt(prompt('Укажите время задержки между вводом данных в девсервис в милисекундах\nВажно, чтобы за это время страница дев-сервисов успевала прогрузиться', 6000));
                    log('В процессе переноса записей из курса ' + cid);
                    let win1 = window.open('about:blank', 'adminka_course_from');
                    let win2 = window.open('about:blank', 'adminka_dev_services');
                    win1.location.href = 'https://foxford.ru/admin/courses/' + cid + '/groups';
                    win2.location.href = 'https://foxford.ru/admin/dev_services';
                    await sleep(10000);
                    let res0 = document.querySelectorAll('[id^="group_"][id$="_toolbar"]');
                    let res1 = win1.document.querySelectorAll('[id^="group_"][id$="_toolbar"]');
                    if (res0.length != res1.length && res0.length != res1.length + 1) { log('Количество занятий в курсах отличается больше, чем на 1, перенос отменён'); }
                    else {
                        let skipgroup = null;
                        if (res0.length == res1.length + 1) {
                            skipgroup = parseInt(prompt('В курсе на 1 занятие больше, чем в исходном, укажите номер занятия, которое нужно пропустить:'));
                        }
                        if (res0.length == res1.length + 1 && (skipgroup > res0.length || skipgroup == null || isNaN(skipgroup))) {
                            log('Занятия, которое нужно пропустить, не существует, перенос отменен');
                        }
                        else if (res0.length == res1.length || res0.length == res1.length + 1) {
                            log('Буду переносить');
                            //res[i].firstChild.firstChild.innerHTML --- статус i-го занятия «Без вебинара»/«Запись»/«Без записи»/«Вебинар»
                            for (let i = 0; i < res0.length; i++) {
                                if (i + 1 != skipgroup) {
                                    let id0 = res0[i].id.match(/\d+/)[0];
                                    let id1 = null;
                                    if (res0.length == res1.length) {
                                        id1 = res1[i].id.match(/\d+/)[0];
                                    }
                                    else {
                                        if (i + 1 > skipgroup) {
                                            id1 = res1[i - 1].id.match(/\d+/)[0];
                                        }
                                        else {
                                            id1 = res1[i].id.match(/\d+/)[0];
                                        }
                                    }
                                    let x = win1.document.getElementById('group_' + id1);
                                    let lbl = x.getElementsByClassName('col-sm-3 control-label')[0].innerHTML;
                                    if (lbl.includes('(копия занятия')) {
                                        id1 = lbl.substring(15, 1000).match(/\d+/)[0];
                                    }
                                    if (res0[i].firstChild.firstChild.innerHTML == 'Без вебинара') { continue; }
                                    log(id0 + ' <- ' + id1);
                                    win2.document.getElementById('change_original_group_group_id').value = id0;
                                    win2.document.getElementById('change_original_group_original_group_id').value = id1;
                                    let arr = win2.document.getElementsByClassName('col-sm-6');
                                    for (let i of arr) {
                                        if (i.getElementsByTagName('h4')[0].innerHTML == 'Изменение копии группы') {
                                            i.getElementsByClassName('btn')[0].click();
                                            break;
                                        }
                                    }
                                    if (!isNaN(sleeptime)) { await sleep(sleeptime); } else { await sleep(6000); }
                                    let alert = win2.document.getElementsByClassName('alert')[0];
                                    try { log(alert.innerHTML.replace(/<button(.*?)\/button>/, '')); } catch (e) { log(e); }
                                }
                            }
                            log('Копирование записей завершено, через 10 секунд страница будет перезагружена');
                            await sleep(10000);
                            window.location.reload();
                        }
                        else {
                            log('Количество занятий в курсах не совадает, перенос отменен');
                        }
                    }
                    win1.close();
                    win2.close();
                }
                try { masscopygroups(); } catch (e) { log(e); }
            }
        }
        let btn_prs_onclick = async function () {
            btn_prs.style = 'display:none';
            let a = document.getElementsByClassName('groups_table')[0].getElementsByTagName('tr');
            let k = false;
            let md = '01.01.1990';
            let tn = 0;
            for (let i = 3; i < a.length - 2; i++) {
                if (a[i].querySelectorAll('[id^="starts_at_"]').length == 0) {
                    a[i].hidden = true;
                }
                else if (a[i].querySelectorAll('[id^="starts_at_"]').length != 0 && k == false) {
                    k = true;
                    let s = a[i].querySelectorAll('[id^="starts_at_"]')[0].value;
                    md = s.slice(0, s.search(/ /));
                    s = a[i].querySelector('.lesson_number a[href]').innerHTML;
                    tn = s.substring(s.search(' ') + 1, s.search(/\(/) - 1);
                }
            }
            a[0].parentNode.insertBefore(a[a.length - 1], a[0]);
            a[0].parentNode.insertBefore(a[a.length - 1], a[1]);
            document.querySelector('#from_lesson_number').value = tn;
            document.querySelector('[id^=start_from_date_]').value = md;
            if (document.querySelectorAll('.bot-approve').length) {
                while (!document.querySelectorAll('.rasp_checked').length) { await sleep(100); }
                await sleep(500);
                if (!document.querySelectorAll('.alert-no-rasp-groups').length) {
                    document.querySelector('.btn.btn-primary[value="Перестроить"]').click();
                }
            }
            log('Прошедшие занятия скрыты, данные для перестроения параллели перенесены вверх страницы');
        }
        btn_prs.onclick = btn_prs_onclick;
        let btn_group_lessons_onclick = async () => {
            let hasBotApproval = checkBotApprove();
            btn_group_lessons_onclick.style = 'display:none';
            let todoshka = true;
            if (!hasBotApproval) {
                todoshka = confirm('Можно использовать если \n - ВСЕ групповые встречи стоят после ближайшего занятия по расписанию \n - на 20:00 ничего не стоит или стоят ТОЛЬКО прошлые групповые встречи \nСтраница программы будет открыта в новой вкладке, не закрывайте ее заранее\nЕсли страница не открываются, разрешите сайту работать со всплывающими окнами\nСкрипт НЕ работает, если первым занятием стоит вводное или пробник на ту же ДАТУ, что и следующее занятие (можно поменять на другую ДАТУ и сработает, время не учитывается)');
            }
            if (todoshka) {
                let href = window.location.href;
                let win = window.open('about:blank', 'adminka_lessons');
                //win.blur(); window.focus();
                win.location.href = href.substring(0, href.search(/groups/) - 1) + '/lessons';
                while (!win.document.querySelectorAll('#lesson_name').length || _.toArray(win.document.querySelectorAll('#lesson_name')).map(i => i.value).filter(i => i.search(/Группов/) != -1).length < 3) { await sleep(500); }
                let all_lessons = _.toArray(win.document.querySelectorAll('#lesson_name')).map(i => i.value);
                let group_lessons = all_lessons.filter(i => i.search(/Группов/) != -1);
                let ind = [];
                for (let i of group_lessons) {
                    ind.push(all_lessons.indexOf(i) - 1);
                }
                win.close();
                await sleep(100);
                log(ind);
                let a = document.getElementsByName('group[starts_at]');
                let a_t = document.querySelectorAll('[id^=group_][id$=_toolbar]');
                let delta = a_t.length - a.length;
                let b = _.toArray(a).map(i => i.value);
                b = b.filter(x => !(x.includes('20:00')));
                let k = 0;
                let t = 0;
                for (let index = 0, len = a.length; index < len; ++index) {
                    let x = a[index].parentNode.parentNode.parentNode.getElementsByClassName('btn-default');
                    if (a[index].parentNode.parentNode.parentNode.parentNode.parentNode.innerHTML.search('Обычное') == -1 && index != 0) { k += 1 };
                    if (index == ind[0] - delta || index == ind[1] - delta || index == ind[2] - delta) { k += 1; t = 1; }
                    while (index != 0 && b[index - k] == b[index - k - 1]) { k -= 1 }
                    log(index + 1 + ' ' + b[index - k] + ' ' + t);
                    if (t == 0) {
                        a[index].value = b[index - k];
                    }
                    else {
                        a[index].value = b[index - k].slice(0, b[index - k].length - 5) + '20:00';
                        a[index].parentNode.parentNode.parentNode.querySelector('#group_duration').value = 45;
                        t = 0;
                    }
                    x[x.length - 1].click();
                    await sleep(100);
                }
                log("Готово) Проверьте, что все сохранилось в админке (может занять некоторое время)")
            }
        }
        btn_group_lessons = createButton('Проставить групповые встречи', btn_group_lessons_onclick, 'set-group-lessons');
        btn_group_lessons.hidden = true;
        div.appendChild(btn_show); div.appendChild(btn_masscopy); div.appendChild(btn_group_lessons); div.appendChild(btn_hide); div.appendChild(btn_prs);
        let x = document.getElementsByClassName('container-fluid')[1].childNodes[2];
        x.insertBefore(div, x.firstChild);
        function join_short(a, sym = ', ', end = ' и еще в ', cou = 3) {
            let k = '';
            if (a.length > cou) { k = end + (a.length - cou) }
            if (a.length) { k = a.slice(0, cou).join(sym) + k }
            return k;
        }
        async function check_async_otmena() {
            try {
                let course_info;
                let res = 0;
                fetch("https://foxford.ru/api/courses/" + mcid + "/landing")
                    .then((response) => response.json())
                    .then((json) => { course_info = json; res = 1; });
                while (!res) { await sleep(100); }
                let otmena_groups = [];
                let ne_otmena_groups = [];
                let ne_shlak_groups = [];
                let no_live_groups = [];
                for (let i of document.getElementsByClassName('first_column')) {
                    let lid = i.firstChild.name;
                    let teacher = i.parentNode.querySelector('#group_teacher_id');
                    let location = i.parentNode.querySelector('[name="group[reservation_attributes][location_id]"]');
                    let b = [];
                    if (teacher && teacher.value == CANCEL_GALINA_ID) { otmena_groups.push(lid); }
                    else if (teacher) { ne_otmena_groups.push(lid); }
                    if (teacher) {
                        b = [teacher.value].filter(x => { for (let i of NO_LIVE_TEACHER_IDS) { if (x == i) { return true } } return false });
                    }
                    if (b.length) { no_live_groups.push(lid); }
                    if (location && location.value != SLAG_ID_SET[0] && !(location.hasAttribute('disabled'))) { ne_shlak_groups.push(lid); }
                    let span = document.createElement('span'); span.innerHTML = 'id: ' + lid; span.className = "label label-default";
                    i.childNodes[1].appendChild(document.createElement('br')); i.childNodes[1].appendChild(span);
                }
                let template_teacher = document.querySelectorAll('#group_template_teacher_id')[1].value;
                let otmena_msg = '';
                if (template_teacher == CANCEL_GALINA_ID) { otmena_msg = 'В настройках параллели указана Галина Отменная' }
                else if (otmena_groups.length) { otmena_msg = 'В занятиях ' + join_short(otmena_groups) + ' указана Галина Отменная' }
                else if (course_info.teachers.length && course_info.teachers[0].alias_url == "otmennaya-galina") { otmena_msg = 'Преподавателем курса указана Галина Отменная' }
                if (otmena_msg) {
                    let otmena_warning = [];
                    let has_easy_error = false;
                    let template_location = document.getElementsByName('group_template[default_location_id]')[0].value;
                    if (template_teacher != CANCEL_GALINA_ID) { otmena_warning.push('в настройках параллели указать Галину Отменную'); has_easy_error = true; }
                    if (template_location != SLAG_ID_SET[0]) { otmena_warning.push('в настройках параллели проставить Шлак'); has_easy_error = true; }
                    if (ne_otmena_groups.length) { otmena_warning.push('в занятиях ' + join_short(ne_otmena_groups) + ' проставить Галину Отменную'); has_easy_error = true; }
                    if (ne_shlak_groups.length) { otmena_warning.push('в занятиях ' + join_short(ne_shlak_groups) + ' проставить Шлак'); has_easy_error = true; }
                    if (!document.querySelectorAll('tbody')[0].innerHTML.match(/Всего: 0/)) { otmena_warning.push('перевести учеников на другие параллели или курсы') }
                    if (otmena_warning.length) {
                        let alert = document.createElement('div');
                        alert.className = 'alert alert-info';
                        alert.style = 'margin-top:10pt;';
                        alert.innerHTML = otmena_msg + '<br>Чтобы отменить параллель до конца, нужно<br>— ' + otmena_warning.join(',<br>— ') + '<br>';
                        document.querySelector('#course_data').parentNode.insertBefore(alert, document.querySelector('#course_data'));
                        let btn = document.createElement('a');
                        btn.className = 'btn btn-default';
                        btn.innerHTML = 'Проставить везде Галину Отменную и Шлак';
                        btn.onclick = async function () {
                            btn.disabled = true; btn.innerHTML = 'В процессе'; btn.style = 'color:gray';
                            let a = new Set(ne_otmena_groups.concat(ne_shlak_groups));
                            for (let i of a) {
                                log(i);
                                let el = document.querySelector('[name="' + i + '"]').parentNode.parentNode;
                                try {
                                    el.querySelector('#group_teacher_id').value = CANCEL_GALINA_ID;
                                } catch (er) { console.log(er); }
                                try {
                                    el.querySelector('[name="group[reservation_attributes][location_id]"]').value = SLAG_ID_SET[0];
                                    el.querySelector('[name="group[reservation_attributes][format_id]"]').value = SLAG_ID_SET[1];
                                    el.querySelector('[name="group[reservation_attributes][studio_id]"]').value = SLAG_ID_SET[2];
                                } catch (er) { console.log(er); }
                                let ar = el.querySelectorAll('.btn-default'); ar[ar.length - 1].click();
                                while (!el.querySelector('.alert-success')) { await sleep(100); }
                            }
                            document.querySelectorAll('#group_template_teacher_id')[1].value = CANCEL_GALINA_ID;
                            document.querySelector('[name="group_template[default_location_id]"]').value = SLAG_ID_SET[0];
                            document.querySelector('[name="group_template[default_format_id]"]').value = SLAG_ID_SET[1];
                            document.querySelector('[name="group_template[default_studio_id]"]').value = SLAG_ID_SET[2];
                            document.querySelectorAll('.btn-primary')[1].click();
                        }
                        if (has_easy_error) { alert.appendChild(btn); }
                    }
                }
                if (course_info.asynchronous == false) {
                    let no_live_msg = '';
                    let alert = document.createElement('div');
                    alert.className = 'alert alert-info';
                    alert.style = 'margin-top:10pt;';
                    if (no_live_groups.length) {
                        no_live_msg = 'В занятиях ' + join_short(no_live_groups) + ' указан неживой преподаватель, хотя курс не является асинхронным<br>';
                        let btn = document.createElement('a');
                        btn.className = 'btn btn-default';
                        btn.innerHTML = 'Проставить преподавателя из настроек параллели';
                        btn.onclick = async function () {
                            btn.disabled = true; btn.innerHTML = 'В процессе'; btn.style = 'color:gray';
                            for (let i of no_live_groups) {
                                log(i);
                                let el = document.querySelector('[name="' + i + '"]').parentNode.parentNode;
                                el.querySelector('#group_teacher_id').value = template_teacher;
                                let ar = el.querySelectorAll('.btn-default'); ar[ar.length - 1].click();
                                while (!el.querySelector('.alert-success')) { await sleep(100); }
                            }
                            log('Готово');
                            window.location.href += '';
                        }
                        alert.innerHTML = no_live_msg;
                        alert.appendChild(btn);
                    }
                    let b = [template_teacher].filter(x => { for (let i of NO_LIVE_TEACHER_IDS) { if (x == i) { return true } } return false });
                    if (b.length) {
                        no_live_msg = 'В настройках параллели указан неживой преподаватель, хотя курс не является асинхронным';
                        alert.innerHTML = no_live_msg;
                    }
                    if (no_live_msg) {
                        document.querySelector('#course_data').parentNode.insertBefore(alert, document.querySelector('#course_data'));
                    }
                }
            }
            catch (e) {
                log('Возникла ошибка при обработке неживых преподавателей в живом курсе\n' + e);
            }
        }
        check_async_otmena();
        // полная нумерация занятия при создании параллели от @wanna_get_out
        let full_numeration_creation = async function () {
            let elements = window.document.querySelectorAll('.lesson_number a[href]');
            let texts = [];
            for (let i = 0; i < elements.length; i++) {
                texts.push(elements[i].textContent)
            }

            const selectElement = window.document.getElementById('group_template_first_lesson_number');

            for (let i = 1; i < selectElement.options.length; i++) {
                selectElement.options[i].textContent = texts[i - 1];
            }
        }
        full_numeration_creation();
        // занятия не по расписанию от @wanna_get_out
        let no_rasp_groups = async function () {
            // Возвращает список дней недели
            function getWeekdays() {
                const blocks = [];
                const times = [];

                for (let i = 0; i < 7; i++) {
                    let element = document.querySelector
                        ('#' + `group_template_week_days_attributes_${i}_slot_week_day` + ' option[selected]')
                    let element_time = document.querySelector
                        ('#edit_group_template #' + `group_template_week_days_attributes_${i}_slot_time`)
                    if (element) {
                        blocks.push(Number(element.value));
                    }
                    if (element_time) {
                        times.push(element_time.value.split(':'))
                    }
                }
                return [blocks, times]
            }

            // Список с датами уроков по расписанию
            function trueLesssonDates() {
                const days = [];
                const startDate = new Date(window.document.querySelectorAll('[id*="starts_at_date"]')[1].value.split('.').reverse());
                let landingLessonCount = window.document.querySelectorAll('.lesson_number').length;
                const [weekdays, weekday_times] = getWeekdays();

                // Создаем копиию начальной даты, чтобы не изменять исходную
                let date = new Date(startDate);
                // Переводим дату к нужному времени
                date.setHours(weekday_times[0][0], weekday_times[0][1], 0, 0);
                // получаем максимальную дату
                let allLessonsStartDate = Array.from(window.document.querySelectorAll('[id*="starts_at_"]')).slice(2);
                let maxDate = new Date(Math.max(...allLessonsStartDate.map(x => new Date(x.value.split(' ')[0].split('.').reverse()))));
                maxDate.setHours(23, 59, 59, 999);
                //while (landingLessonCount >= 0) {
                while (date <= maxDate) {
                    for (let i = 0; i < weekdays.length; i++) {
                        // Если день недели есть в списке дней недели и он i-ый
                        if (weekdays[i] == Number(date.getDay())) {
                            let temp_date = new Date(date);
                            temp_date.setHours(weekday_times[i][0], weekday_times[i][1], 0, 0)
                            days.push(Number(temp_date));
                            landingLessonCount--; // Уменьшаем счётчик уроков
                        }
                    }
                    // Увеличиваем дату на один день
                    date.setDate(date.getDate() + 1);

                }
                return days;
            }

            // const weekdays = getWeekdays();
            let trueLessons = trueLesssonDates();

            // Получаем все уроки с лендинга
            let allLessonsStartDate = Array.from(window.document.querySelectorAll('[id*="starts_at_"]')).slice(2);
            const bgColorEven = '#ff869d';
            const bgColorOdd = '#ffb6c4';
            let lessonsCount = 0;

            // Проходим циклом по всем датам уроков
            for (let i = 0; i < allLessonsStartDate.length; i++) {
                // Преобразовываем дату с лендинга в человеческую
                let date = new Date(allLessonsStartDate[i].value.split(' ')[0].split('.').reverse());
                let time = allLessonsStartDate[i].value.split(' ')[1].split(':');
                date.setHours(time[0], time[1], 0, 0);
                date = Number(date);
                // Ищем совпадение даты лендинга с датой по расписанию
                if (!trueLessons.includes(date)) {
                    // Если не совпадает с расписанием (перенос, переназначение), красим родительский элемент (родительского элемента родительского элемента...) в цвет
                    let parent = allLessonsStartDate[i].parentElement.parentElement.parentElement.parentElement;
                    if (lessonsCount % 2 == 0) {
                        parent.style.backgroundColor = bgColorEven;
                    } else {
                        parent.style.backgroundColor = bgColorOdd;
                    }
                    lessonsCount += 1;
                }
                else {
                    let parent = allLessonsStartDate[i].parentElement.parentElement.parentElement.parentElement;
                    parent.style.backgroundColor = '';
                }
            }
            // выводим предупреждение
            if (lessonsCount) {
                let msg = `В данной параллели занятий не по расписанию: ${lessonsCount}`;

                let alert = document.querySelector('.alert-no-rasp-groups');
                if (!alert) {
                    alert = document.createElement('div');
                    alert.className = 'alert alert-no-rasp-groups';
                    alert.style = 'margin-top: 10pt;';
                }
                alert.innerHTML = msg

                document.querySelector('#course_data').parentNode.insertBefore(alert, document.querySelector('#course_data'));
                alert.style.backgroundColor = bgColorOdd;
            }
            else { // lessonsCount = 0
                if (document.querySelectorAll('.alert-no-rasp-groups').length) { document.querySelector('.alert-no-rasp-groups').remove(); }
            }
            document.body.firstChild.className += ' rasp_checked';
        }
        no_rasp_groups();
        let all_save_btns = document.querySelectorAll('.btn-default[value="Сохранить"]');
        for (let save_btn of all_save_btns) { save_btn.addEventListener('click', no_rasp_groups); }
        //
        let set_all_duration_at_ = async function (x = 40) {
            let a = document.getElementsByClassName('groups_table')[0].getElementsByTagName('tr');
            let code = `<div class="form-group integer optional group_duration"><label class="col-sm-3 control-label integer optional" for="group_duration">Длительность</label><div class="col-sm-9"><input class="form-control numeric integer optional" type="number" step="1" value="` + x + `" name="group[duration]" id="group_duration"><p class="help-block">мин.</p></div></div>`
            for (let i = 3; i < a.length - 2; i++) {
                if (a[i].querySelectorAll('.form-group.group_duration').length) {
                    a[i].querySelector('.form-group.group_duration').outerHTML = code;
                }
                else {
                    let ar = a[i].querySelectorAll('.form-group');
                    ar[ar.length - 1].outerHTML = code + ar[ar.length - 1].outerHTML;
                }
                a[i].querySelector('.btn-default[type=submit]').click();
            }
        }
        // Возвращаем модераторов в группу от @wanna_get_out
        async function returnModeratorsOnClick() {
            const ssmId = '4789'
            // Находим все элементы с id="group_reservation_attributes_admin_id"
            const selectElements = document.querySelectorAll('#group_reservation_attributes_admin_id');

            selectElements.forEach(async (selectElement) => {
                // Пропускаем обработку, если найден элемент <p class="form-control-static">
                // Значит, занятие уже прошло и изменение недоступно
                const formGroup = selectElement.closest('.form-group');
                if (formGroup && formGroup.querySelector('.form-control-static')) {
                    return; // Пропускаем текущий блок
                }

                if (selectElement.value === ssmId) {
                    // Устанавливаем значение "Не выбран" для текущего <select>
                    selectElement.value = ""; // Устанавливаем значение пустой строки, что соответствует "Не выбран"

                    // Обновляем пользовательский интерфейс select2
                    const select2Container = selectElement.closest('.select2-container');
                    if (select2Container) {
                        const chosenText = select2Container.querySelector('.select2-chosen');
                        if (chosenText) {
                            chosenText.textContent = "Не выбран"; // Обновляем текст отображаемого значения
                        }
                    }

                    // Находим кнопку "Сохранить" внутри текущего элемента формы
                    const form = selectElement.closest('form');
                    if (form) {
                        const saveButton = form.querySelector('input[type="submit"][name="commit"]');
                        if (saveButton) {
                            // Нажимаем на кнопку "Сохранить"
                            saveButton.click();

                            // Обновляем отображение select2, чтобы изменения сразу отображались
                            $(selectElement).trigger('change'); // Используем jQuery для обновления select2
                        }
                    } else {
                        console.error('Форма не найдена для текущего элемента select.');
                    }

                }
                await sleep(500)
            });
            log("Готово! Формат ССМ заменён на модераторов");

            // Создаем всплывающее уведомление
            const notification = document.createElement('div');
            notification.textContent = "Настройки модераторов были изменены! Обновите страницу";
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.right = '20px';
            notification.style.backgroundColor = '#4CAF50'; // Зеленый цвет
            notification.style.color = 'white';
            notification.style.padding = '10px';
            notification.style.borderRadius = '5px';
            notification.style.zIndex = '1000';

            document.body.appendChild(notification);

            // Удаляем уведомление через 3 секунды
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
        btn_return_moderators.onclick = returnModeratorsOnClick;

        if (window.location.href.match('#reset_schedule')) { document.querySelector('.reset-btn').classList.add('bot-approve'); btn_prs_onclick(); }
        if (window.location.href.match('#duration40')) { set_all_duration_at_(40); }
        log('Страница модифицирована');
    }

    // на странице создания дубликата
    if (currentWindow.checkPath(pagePatterns.newDuplicates)) {
        let div = document.createElement('div');
        let my_btn;
        let war = document.createElement('p');
        war.style = 'color:orange';
        const get_data_full = async () => {
            let hasBotApproval = checkBotApprove();
            my_btn.style = 'display:none';
            //let todoshka;
            //if (!document.querySelector('.bot-approve')){
            let todoshka = true;
            if (!hasBotApproval) {
                todoshka = confirm('Страницы курса будут открыты в новых вкладках, не закрывайте их заранее\nЕсли страницы не открываются, разрешите сайту работать со всплывающими окнами');
            }
            //else{
            //    todoshka = true;
            //}
            if (todoshka) {
                async function get_data() {
                    log('грузим данные');
                    let href = window.location.href;
                    let win = window.open('about:blank', 'adminka_groups');
                    let has_webinars = false;
                    let has_conv = false;
                    win.blur(); window.focus();
                    win.location.href = href.substring(0, href.length - 21) + '/groups';
                    while (win.document.getElementsByName('from_lesson_number').length < 1) {
                        await sleep(100);
                    }
                    let res = win.document.querySelectorAll('[id^="group_"][id$="_toolbar"]');
                    for (let i = 0; i < res.length; i++) {
                        if (res[i].firstChild.firstChild.innerHTML == 'Вебинар' || res[i].firstChild.firstChild.innerHTML == 'Мини-группа') { has_webinars = true; break; }
                        if (res[i].firstChild.firstChild.innerHTML == 'Конвертируется') { has_conv = true; break; }
                    }
                    let teacher = win.document.getElementsByName('group_template[teacher_id]')[1].value;
                    let vmestim = win.document.getElementsByName('group_template[users_limit]')[1].value;
                    win.location.href = href.substring(0, href.length - 21) + '/edit';
                    while (!win.document.getElementById('course_product_pack_id') || !win.document.querySelector('#course_maternity_capital')) {
                        await sleep(100);
                    }
                    if (win.document.getElementById('course_product_pack_id').value) { war.innerHTML += 'Привязана подписка! '; }
                    if (win.document.getElementById('course_description').value.length > 260) { war.innerHTML += 'Описание длиннее 260 символов! '; }
                    if (win.document.querySelector('#course_maternity_capital').checked) { war.innerHTML += 'Включена оплата маткапиталом! '; }
                    if (war.innerHTML != '') { war.innerHTML = 'Может не получиться создать дубликат! ' + war.innerHTML; }
                    if (has_webinars) { if (war.innerHTML != '') { war.innerHTML += '<br>' }; war.innerHTML += 'В курсе есть будущие занятия'; }
                    if (has_conv) { if (war.innerHTML != '') { war.innerHTML += '<br>' }; war.innerHTML += 'В курсе есть несконвертированные занятия'; }
                    document.getElementById('course_duplicate_group_templates_attributes_0_teacher_id').value = teacher;
                    document.getElementById('course_duplicate_group_templates_attributes_0_users_limit').value = vmestim;
                    win.close();
                    log('готово)')
                }
                get_data();
            }
        }
        my_btn = createButton('Подтянуть данные из курса', get_data_full, 'get-data');
        div.appendChild(my_btn); div.appendChild(war);
        let x = document.getElementsByTagName('h3')[0].parentNode;
        x.insertBefore(div, x.childNodes[1]);
        let form = document.createElement('form');
        form.id = 'my_form';
        let lbl = document.createElement('label');
        lbl.innerHTML = 'Количество дубликатов';
        lbl.for = 'my_counter';
        let inp = document.createElement('input');
        inp.id = 'my_counter';
        inp.type = 'number';
        //inp.placeholder = '1 ... 10';
        inp.min = 1;
        inp.max = 100;
        form.appendChild(lbl);
        form.appendChild(inp);
        form.style = 'margin-top:15pt;';
        inp.style = 'margin-left:15pt; margin-right: 15pt;';
        document.querySelector('#new_course_duplicate').parentNode.appendChild(form);
        let btn_mass_create = document.createElement('a');
        btn_mass_create.className = 'btn btn-primary';
        btn_mass_create.innerHTML = 'Создать пачку дубликатов';
        btn_mass_create.onclick = create_pack_dubli;
        form.onsubmit = create_pack_dubli;
        async function create_pack_dubli() {
            if (inp.value) {
                if (inp.value < 1 || inp.value > 50) {
                    alert('За один раз можно завести от 1 до 50 дубликатов')
                }
                else {
                    let todo = confirm('Будет создано ' + inp.value + ' одинаковых дубликатов')
                    if (todo) {
                        let win = window.open('about:blank', 'adminka_tmp')
                        let main_btn = document.getElementsByClassName('btn btn-default btn-primary')[0];
                        main_btn.removeAttribute('data-disable-with');
                        main_btn.target = 'adminka_tmp';
                        document.querySelector('#new_course_duplicate').target = 'adminka_tmp';
                        for (let i = 0; i < inp.value; i++) {
                            log(i + 1);
                            main_btn.click(); await sleep(100);
                            while (!win.document.getElementsByClassName('alert alert-success').length) { await sleep(100); }
                            win.location.href = 'about:blank';
                            while (win.document.getElementsByClassName('alert alert-success').length) { await sleep(100); }
                        }
                        win.close();
                        log('Курсы созданы')
                        await sleep(5000);
                        window.location.href = 'https://foxford.ru/admin/courses?q%5Bid_eq%5D=';
                    }
                }
            }
            else {
                alert('Укажите количество курсов')
            }
        }
        form.appendChild(btn_mass_create);
        log('Страница модифицирована');
    }

    // на странице создания или редактирования pdf-программы
    if (currentWindow.checkPath(pagePatterns.pdfCreate) ||
        currentWindow.checkPath(pagePatterns.pdfEdit)) {
        let div = document.createElement('div');
        let btn_show = document.createElement('button');
        btn_show.innerHTML = 'Продвинутые возможности';
        let btn_hide = document.createElement('button'); btn_hide.hidden = true;
        btn_hide.innerHTML = 'Скрыть продвинутые возможности';
        let btn_copypdf = document.createElement('button'); btn_copypdf.hidden = true;
        btn_copypdf.innerHTML = 'Скопировать PDF-программу из другого курса';
        let btn_clearpdf = document.createElement('button'); btn_clearpdf.hidden = true;
        btn_clearpdf.innerHTML = 'Очистить PDF-программу';
        let btn_createpdf = document.createElement('button'); btn_createpdf.hidden = true;
        btn_createpdf.innerHTML = 'Загрузить PDF-программу из CSV-файла';
        btn_show.onclick = function () {
            btn_show.hidden = true; btn_copypdf.hidden = false; btn_clearpdf.hidden = false; btn_createpdf.hidden = false; btn_hide.hidden = false;
        }
        btn_hide.onclick = function () {
            btn_show.hidden = false; btn_copypdf.hidden = true; btn_clearpdf.hidden = true; btn_createpdf.hidden = true; btn_hide.hidden = true;
        }
        btn_copypdf.onclick = function () {
            async function copypdf() {
                if (document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_name"]').length > 1) {
                    alert('Удалите или очистите текущую PDF-программу, после этого можно будет загрузить новую');
                    return;
                }
                let todo = confirm('Будет добавлена pdf-программа из другого курса\n' +
                    'Не забудьте проверить опубликованность на лендинге после выполнения скрипта\n' +
                    'Не закрывайте новую вкладку до окончания работы скрипта');
                if (!todo) { return; }
                let d = 0;
                let cid = prompt('Введите ID курса');
                let win = window.open('about:blank', 'adminka_pdf');
                win.location.href = 'https://foxford.ru/admin/courses/' + cid + '/edit';
                while (win.document.getElementsByClassName('dropdown-menu-right').length < 2) { await sleep(100); }
                let x = win.document.getElementsByClassName('dropdown-menu-right')[1];
                for (let li of x.childNodes) {
                    if (li.firstChild.innerHTML == 'Программа (PDF)') { li.firstChild.click(); }
                }
                let del_btns = document.getElementsByClassName('btn-danger');
                for (let rb of del_btns) {
                    if (rb.innerHTML == 'Удалить раздел') { rb.click(); d += 1; }
                }
                let add_btns = document.getElementsByClassName('btn-success');
                let btn_add;
                for (let gb of add_btns) {
                    if (gb.innerHTML == 'Добавить раздел программы') { btn_add = gb; }
                }
                while (!win.document.getElementById('course_plan_published')) { await sleep(100); }
                let razdels = win.document.getElementsByClassName('sortable')[0].childNodes;
                let m = 0;
                for (let k = 0; k < razdels.length; k++) {
                    btn_add.click(); // создаем новый раздел
                    await sleep(100);
                    let i = razdels[k];
                    let attrs = ['[id^="course_plan_course_plan_blocks_attributes_"][id*="_header"]', '[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]', '[id^="course_plan_course_plan_blocks_attributes_"][id*="_description"]'];
                    for (let attr of attrs) {
                        document.querySelectorAll(attr)[k + 1].value = i.querySelectorAll(attr)[0].value; // заполняем поля из массива attrs
                    }
                    let themes = i.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_name"]');
                    for (let j = 0; j < themes.length; j++) {
                        let name = themes[j];
                        if (j != 0) { document.getElementsByClassName('btn-success')[k + d].click(); }
                        let attr = '[id^="course_plan_course_plan_blocks_attributes_"][id*="_name"]';
                        document.querySelectorAll(attr)[m + 1].value = i.querySelectorAll(attr)[j].value;
                        m += 1;
                    }
                }
                document.getElementById('course_plan_published').checked = win.document.getElementById('course_plan_published').checked;
                log('все');
                win.close();
                document.getElementsByClassName('btn-primary')[0].click();
            }
            try { copypdf(); } catch (e) { log(e); }
        }
        btn_clearpdf.onclick = function () {
            async function clearpdf() {
                let todo = confirm('Текущая PDF-программа будет очищена и убрана с лендинга');
                if (!todo) { return; }
                let d = 0;
                let del_btns = document.getElementsByClassName('btn-danger');
                for (let rb of del_btns) {
                    if (rb.innerHTML == 'Удалить раздел') { rb.click(); d += 1; }
                }
                let add_btns = document.getElementsByClassName('btn-success');
                let btn_add;
                for (let gb of add_btns) {
                    if (gb.innerHTML == 'Добавить раздел программы') { btn_add = gb; }
                }
                btn_add.click(); // создаем новый раздел
                await sleep(100);
                let attrs = ['[id^="course_plan_course_plan_blocks_attributes_"][id*="_header"]', '[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]', '[id^="course_plan_course_plan_blocks_attributes_"][id*="_description"]'];
                for (let attr of attrs) {
                    let arr = document.querySelectorAll(attr);
                    arr[arr.length - 1].value = 1;
                }
                let attr = '[id^="course_plan_course_plan_blocks_attributes_"][id*="_name"]';
                let arr = document.querySelectorAll(attr)
                arr[arr.length - 1].value = 1;
                document.getElementById('course_plan_published').checked = false;
                log('все');
                document.getElementsByClassName('btn-primary')[0].click();
            }
            try { clearpdf(); } catch (e) { log(e); }
        }
        btn_createpdf.onclick = function () {
            async function createpdf() {
                if (document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_name"]').length > 1) {
                    alert('Удалите или очистите текущую PDF-программу, после этого можно будет загрузить новую');
                    return;
                }
                btn_show.hidden = true; btn_copypdf.hidden = true; btn_clearpdf.hidden = true; btn_createpdf.hidden = true; btn_hide.hidden = true;
                let inp = document.createElement('input'); inp.type = 'file'; inp.accept = "text/csv"; inp.required = 'required';
                let btn = document.createElement('button'); btn.innerHTML = 'Готово';
                btn.onclick = async function () {
                    let reader = new FileReader();
                    reader.onload = function () {
                        let allRows = CSVToArray(reader.result);
                        //var allRows = reader.result.split(/\r?\n|\r/);
                        let k = 0;
                        let n = 0;
                        let m = 0;
                        for (var singleRow = 0; singleRow < allRows.length; singleRow++) {
                            //var rowCells = allRows[singleRow].split(',');
                            let rowCells = allRows[singleRow];
                            for (var rowCell = 0; rowCell < rowCells.length; rowCell++) {
                                //log(rowCells[rowCell]);
                                if (rowCells[rowCell] != '') {
                                    let x
                                    try {
                                        x = rowCells[rowCell].trim().replaceAll('\n', ' ');
                                    }
                                    catch {
                                        x = rowCells[rowCell]
                                    }
                                    if (rowCell == 0) {
                                        if (document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]')[k].value == '') {
                                            document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]')[k].value = 0;
                                        }
                                        if (singleRow != 0) {
                                            document.getElementsByClassName('btn-success')[k + 1].click();
                                            k += 1
                                            n = 0
                                        }
                                        document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_header"]')[k].value = x;
                                    }
                                    if (rowCell == 1) {
                                        document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]')[k].value = x;
                                    }
                                    if (rowCell == 2) {
                                        if (x.length > 270) {
                                            x = x.substring(0, 270);
                                            log('Сократил описание раздела ' + (k + 1) + ' до 270 символов')
                                        }
                                        document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_description"]')[k].value = x;
                                    }
                                    if (rowCell == 3) {
                                        if (n != 0) {
                                            document.getElementsByClassName('btn-success')[k].click();
                                        }
                                        document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_name"]')[m].value = x;
                                        n += 1
                                        m += 1
                                    }
                                }
                            }
                        }
                        if (document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]')[k].value == '') {
                            document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]')[k].value = 0;
                        }
                        log('Готово, не забудьте сохранить изменения')
                    };
                    reader.onerror = function () {
                        alert(reader.error);
                    };
                    reader.readAsText(inp.files[0])

                }
                div.appendChild(inp); div.appendChild(btn);
            }
            try { createpdf(); } catch (e) { log(e); }
        }
        div.appendChild(btn_show); div.appendChild(btn_copypdf); div.appendChild(btn_clearpdf); div.appendChild(btn_createpdf); div.appendChild(btn_hide);
        let x = document.getElementsByTagName('h3')[0].parentNode;
        x.insertBefore(div, x.childNodes[1]);
        log('Страница модифицирована');
    }

    // на странице с оплатами по частям курса
    if (currentWindow.checkPath(pagePatterns.installments)) {
        let div = document.createElement('div');
        let btn_massprolong = document.createElement('button');
        btn_massprolong.innerHTML = 'Все части только для пролонгации';
        btn_massprolong.onclick = function () {
            let todo = confirm('Процесс будет запущен в отдельной вкладке, не закрывайте ее до завершения процесса\nВо все части будет проставлена галочка «Только для пролонгации»\nМожет потребоваться разрешение показывать сайту всплывающие окна');
            if (todo) {
                btn_massprolong.disabled = true; btn_massprolong.style = 'color:gray';
                async function massprolong() {
                    //let sleeptime = parseInt(prompt('Укажите время прогрузки страницы с частью в милисекундах\nВажно, чтобы за это время страница успевала прогрузиться', 3000));
                    log('В процессе проставления галочек');
                    let cid = window.location.href.match(/\d+/)[0];
                    let win = await createWindow('adminka_installments_edit_' + cid)
                    let trs = document.getElementsByTagName('tr');
                    for (let i = 1; i < trs.length; i++) {
                        let tr = trs[i];
                        let tds = tr.getElementsByTagName('td');
                        let id = tds[0].innerHTML;
                        let prol = tds[3].innerHTML;
                        if (prol == 'Нет') {
                            log(id);
                            await win.openPage(window.location.href + '/' + id + '/edit');
                            win.document.getElementById('course_installment_only_prolongation').checked = true;
                            win.document.getElementsByClassName('btn-primary')[0].click();
                            await win.waitForElement('.alert-success');
                        }
                    }
                    log('Галочки проставлены, через 10 секунд страница будет перезагружена');
                    win.close();
                    await sleep(10000);
                    window.location.reload();
                }
                try { massprolong(); } catch (e) { log(e); }
            }
        }
        div.appendChild(btn_massprolong);
        let x = document.getElementsByClassName('toolbar')[0];
        x.insertBefore(div, x.firstChild);
        log('Страница модифицирована');
    }

    /************************* Обучение - тесты *************************/

    if (currentWindow.checkPath(pagePatterns.taskPreviewAnswers)) {
        await currentWindow.waitForElement('button[tabindex="2"] span');
        currentWindow.querySelector('button[tabindex="2"] span').click();
        while (!currentWindow.evaluate("//button[contains(., 'Посмотреть ответ')]", currentWindow.document, null, XPathResult.ANY_TYPE, null).iterateNext()) { await sleep(100); }
        currentWindow.evaluate("//button[contains(., 'Посмотреть ответ')]", currentWindow.document, null, XPathResult.ANY_TYPE, null).iterateNext().click();
    }
    if (currentWindow.checkPath(pagePatterns.trainingsTaskTemplates)) {
        let previewLinks = currentWindow.querySelectorAll('a[href$="preview"]');
        for (let linkElement of previewLinks) {
            linkElement.href += '#ans';
        }
        let createTaskButton = currentWindow.querySelector('.btn-success[href$="task_templates"]');
        const massTasksButtonOnClick = async () => {
            currentWindow.jsCodeArea.value = `// поменяйте id на нужные ниже
    let taskIds = \`1
    2
    3\`.split('\\n');
    let trainingsWindow = await createWindow('adminka_trainings');
    let createButton = currentWindow.querySelector('.btn-success[href$="task_templates"]');
    createButton.target = 'adminka_trainings';
    for (let taskId of taskIds) {
        log(taskId);
        createButton.click();
        await trainingsWindow.waitForElementDisappear('.alert-success');
        await trainingsWindow.waitForElement('.loaded');
        let individualTasksLinks = trainingsWindow.querySelectorAll('#edit_task_template .btn[href$="individual_tasks"]');
        individualTasksLinks[individualTasksLinks.length - 1].click();
        await trainingsWindow.waitForElement('.trainings_individual_tasks');
        let addButton = trainingsWindow.querySelectorAll('.task_table')[1].childNodes[1].firstChild.querySelector('a[title="Привязать"]');
        addButton.href = addButton.href.substr(0, addButton.href.search('=') + 1) + taskId;
        addButton.click();
        await trainingsWindow.waitForElement('.alert-success');
        await trainingsWindow.openPage('about:blank');
    }
    trainingsWindow.close();
    displayLog('Задачи привязаны, обновите страницу');`;
        }
        let massTasksButton = createButton('Привязать задачи массово', massTasksButtonOnClick, 'btn-default', false);
        createTaskButton.parentNode.insertBefore(massTasksButton, createTaskButton.nextSibling);
    }

    /************************* Практика - задачи ************************/

    if (currentWindow.checkPath(pagePatterns.trainingsIndividualTasks)) {
        currentWindow.body.firstChild.className += ' trainings_individual_tasks';
    }

    /********************** Обучение - мероприятия **********************/

    if (currentWindow.checkPath(pagePatterns.eventsEdit) ||
        currentWindow.checkPath(pagePatterns.eventsNew)) {
        let pred = document.createElement('div');
        pred.innerHTML = 'Неактуальный цикл мероприятий'
        let cycles = document.getElementById('event_series_id');
        let good = ['Подготовка к ЕГЭ', 'Подготовка к ОГЭ', 'Домашняя школа', 'Родителям', 'Поступление', 'Профориентация', 'Другое', 'Вне циклов', 'Семинары для учителей', 'Подготовка к ОГЭ для учителей', 'Вебинары с Федеральным подростковым центром', 'Подготовка к ЕГЭ для учителей'];
        for (let i of cycles.childNodes) {
            if (i == '[object HTMLOptionElement]') {
                i.className += 'value' + i.value;
                if (i.selected) { i.className += ' selected'; }
                if (good.indexOf(i.innerHTML) != -1) { i.className += ' good'; }
                else { i.innerHTML = '<del> x ' + i.innerHTML + '</del>'; i.className += ' bad'; }
            }
        }
        cycles.getElementsByClassName('value')[0].innerHTML = '!!! Bce aктyaльныe циклы yкaзaны вышe !!!';
        cycles.insertBefore(cycles.getElementsByClassName('selected')[0], cycles.getElementsByClassName('value')[0]);
        cycles.insertBefore(cycles.getElementsByClassName('value')[0], cycles.getElementsByClassName('selected')[0]);
        for (let elem of cycles.getElementsByClassName('good')) { cycles.insertBefore(elem, cycles.getElementsByClassName('value')[0]); }
        if (cycles.selectedOptions[0].className.indexOf('bad') != -1 && isEventsEditPage.length) { pred.hidden = false }
        else { pred.hidden = true }
        cycles.onchange = function () {
            if (cycles.selectedOptions[0].className.indexOf('bad') != -1) { pred.hidden = false }
            else { pred.hidden = true }
        }
        pred.style = 'color:orange;font-size: 11px; top: 3px';
        document.getElementsByClassName('event_series')[0].childNodes[1].appendChild(pred);
        log('Страница модифицирована');
    }

    /******************* Практика - учебные программы *******************/

    if (currentWindow.checkPath(pagePatterns.methodicalBlockEdit)) {
        let pensils = currentWindow.querySelectorAll('.glyphicon.glyphicon-pencil');
        for (let pensilElement of pensils) {
            pensilElement = pensilElement.parentNode;
            let videoLinkElement = pensilElement.cloneNode(true);
            let editHref = pensilElement.href;
            let uid = editHref.slice(editHref.search(/units/) + 6, editHref.search(/edit/) - 1);
            videoLinkElement.firstChild.className = 'glyphicon glyphicon-film';
            videoLinkElement.href = "/admin/methodical_materials/units/" + uid + "/link_items/new#szh"
            pensilElement.parentNode.insertBefore(videoLinkElement, pensilElement.nextSibling);
        }
    }
    if (currentWindow.checkPath(pagePatterns.methodicalLinkCreateVideo)) {
        currentWindow.querySelector('#methodical_materials_items_link_item_link_attributes_name').value = 'Сжатый видеоурок с повторением пройденной теории. Смотреть его необязательно, но к нему всегда можно вернуться, чтобы освежить знания или закрепить пройденный материал.';
    }

    /*********************** ЭДШ - типы продуктов ***********************/

    // сетки расписания
    if (currentWindow.checkPath(pagePatterns.gridsCreate) ||
        currentWindow.checkPath(pagePatterns.gridsEdit)) {
        displayLog(`Скрипты для сеток расписания отключены, так как:
        1) Гугл украл нашу табличку;
        2) Изменился внешний вид сетки расписния в админке.
Будем делать заново в следующем сезоне(`, 'danger', 10000)
    }
    // индивидуальные траектории ДШ
    if (currentWindow.checkPath(pagePatterns.individualItems)) {
        let toolbar = currentWindow.querySelector('.toolbar');
        let massIndividualButton = createButton('Привязать элементы массово', async () => { }, 'btn-success', false);
        massIndividualButton.href = toolbar.firstChild.href + '_mass';
        massIndividualButton.style = "margin-left:5pt";
        toolbar.appendChild(massIndividualButton);
        log('Страница модифицирована');
    }
    if (currentWindow.checkPath(pagePatterns.individualItemsCreateMass)) {
        let secondaryWindow = await createWindow();
        await secondaryWindow.openPage(currentWindow.location.href.substring(0, currentWindow.location.href.length - 5)); //, 'adminka_mass_new_ind_items_temp')
        currentWindow.clearAll();
        let form = createElement('form', 'simple_form form-horizontal inputs-sm', 'margin:20px')
        let gradeElement = createFormElement(form, 'select', 'Класс <abbr class="astr" title="Обязательное поле">*</abbr>', 'mass_externship_product_type_grade_course_product_type_grade_id');
        let typeElement = createFormElement(form, 'select', 'Тип элемента <abbr class="astr" title="Обязательное поле">*</abbr>', 'mass_externship_product_type_grade_course_resource_type');
        let idsElement = createFormElement(form, 'textarea', 'ID курсов <abbr class="astr" title="Обязательное поле">*', 'mass_course_input', 'Можно указать через пробел, запятую или в столбик');
        let massAppendButton = createButton('Запустить массовое добавление', async () => { }, 'btn-default btn-primary form-control', false);
        let hugeConsole = createElement('div', 'textarea', 'border: 2px solid #eee; border-radius: 15px; padding: 10px; margin-top: 20px; margin-bottom: 20px;')
        function huge_log(s) {
            hugeConsole.innerHTML += s + '<br>';
        }
        log = huge_log;
        log('Пока можно массово добавлять только курсы, скрипт не проверяет опубликованность курсов, проверьте её по отчету<br>' +
            'Процесс будет происходить в отдельной вкладке, не закрывайте её')
        let backButton = createButton('Вернуться назад', async () => { secondaryWindow.close(); currentWindow.history.go(-1); return false; }, 'btn-default', false);
        form.appendChild(massAppendButton);
        form.appendChild(hugeConsole);
        form.appendChild(backButton);
        currentWindow.body.appendChild(form);
        currentWindow.head.innerHTML = secondaryWindow.head.innerHTML;
        await secondaryWindow.log('Эта страница нужна для работы массовых внесений данных в админку. Внесение данных доступно на другой вкладке');
        Array.from(secondaryWindow.querySelectorAll('input')).map(el => { el.disabled = true });
        Array.from(secondaryWindow.querySelectorAll('select')).map(el => { el.disabled = true });
        currentWindow.querySelector('#mass_externship_product_type_grade_course_product_type_grade_id').innerHTML = secondaryWindow.querySelector('#externship_product_type_grade_course_product_type_grade_id').innerHTML;
        let res_type = currentWindow.querySelector('#mass_externship_product_type_grade_course_resource_type');
        res_type.innerHTML = await secondaryWindow.querySelector('#externship_product_type_grade_course_resource_type').innerHTML;
        res_type.disabled = true;
        idsElement.rows = 1; idsElement.cols = 1;
        idsElement.style = 'min-height:50px';
        massAppendButton.onclick = async function () {
            backButton.onclick = () => { let todo = confirm('Запущенный процесс будет прерван'); if (todo) { secondaryWindow.close(); currentWindow.history.go(-1); return false; } };
            let idsList = idsElement.value.split(/[ \n,;]/).filter(x => x != '');
            if (secondaryWindow.closed) {
                secondaryWindow = await createWindow();
                await secondaryWindow.openPage(currentWindow.location.href.substring(0, currentWindow.location.href.length - 5));
            }
            for (let productID of idsList) {
                await secondaryWindow.openPage(currentWindow.location.href.substring(0, currentWindow.location.href.length - 5));
                try {
                    secondaryWindow.querySelector('#externship_product_type_grade_course_product_type_grade_id').value = gradeElement.value;
                    secondaryWindow.querySelector('#externship_product_type_grade_course_resource_type').value = typeElement.value;
                    secondaryWindow.querySelector('#course_input').value = productID;
                    secondaryWindow.querySelector('.btn-primary').click();
                    await secondaryWindow.waitForElement('.alert');
                    let alert = secondaryWindow.querySelector('.alert');
                    let col;
                    if (alert.className.match('danger')) { col = 'red' } else { col = 'green' }
                    try { log(productID + `   <span style = 'color:${col}'>` + alert.innerHTML.replace(/<button(.*?)\/button>/, '') + '</span>'); } catch (e) { log(productID + `   <span style = 'color:${col}'>` + e + '</span>'); }
                }
                catch (e) { log(productID + '\t' + e); }
            }
            // win.close();
            backButton.onclick = () => { secondaryWindow.close(); currentWindow.history.go(-1); return false; };
            displayLog('Процесс привязки завершен, не забудьте проверить логи выше. Закрыть текущую страницу рекомендуется с помощью кнопки ниже.');
            await secondaryWindow.log('Эта страница нужна для работы массовых внесений данных в админку. Внесение данных доступно на другой вкладке');
            Array.from(secondaryWindow.querySelectorAll('input')).map(el => { el.disabled = true });
            Array.from(secondaryWindow.querySelectorAll('select')).map(el => { el.disabled = true });
        }
        log('Страница создана');
    }

    /****************************** Прочее ******************************/

    // на странице дев-сервисов
    if (currentWindow.checkPath(pagePatterns.devServices)) {
        async function test_adminka() {
            let arr = document.querySelectorAll('div.col-sm-6');
            let only_copy = false;
            let only_week_day_webinars_settings = false;
            let only_copy_href = currentWindow.location.href.match(/\?only_copy/) || [];
            let only_week_day_webinars_settings_href = currentWindow.location.href.match(/\?only_week_day_webinars_settings/) || [];
            if (only_copy_href.length) { only_copy = true; }
            if (only_week_day_webinars_settings_href.length) { only_week_day_webinars_settings = true; }
            for (let i of arr) {
                if (!i.getElementsByTagName('h4').length || !i.getElementsByTagName('h4')[0]) {
                    if (only_copy || only_week_day_webinars_settings) {
                        i.parentNode.style = 'display:none;'
                    }
                }
                else if (i.getElementsByTagName('h4')[0].innerHTML == 'Обновление настроек всех вебинаров для курсов') {
                    if (only_copy) {
                        i.parentNode.style = 'display:none;'
                    }
                    if (only_week_day_webinars_settings) {
                        log('magic mode ;)');
                        i.className += ' only-week-day-webinar-settings-main';
                    }
                    let btn1 = createButton('Мини-группы', () => { }, 'mini');
                    let btn2 = createButton('Шлак', () => { }, 'slag');
                    let btn3 = createButton('Дом', () => { }, 'home');
                    let btn4 = createButton('ССМ', () => { }, 'ssm');
                    btn1.onclick = function () {
                        try {
                            document.getElementById('week_day_webinars_settings_all_days').checked = 'checked';
                            document.getElementById('week_day_webinars_settings_location_id').value = MINI_GROUPS_ID_SET[0];
                            document.getElementById('week_day_webinars_settings_location_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_location_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_format_id').value = MINI_GROUPS_ID_SET[1];
                            document.getElementById('week_day_webinars_settings_format_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_format_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_studio_id').value = MINI_GROUPS_ID_SET[2];
                            document.getElementById('week_day_webinars_settings_studio_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_studio_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_admin_id').value = '';
                            log('Локация Мини-группы');
                        }
                        catch (e) { log(e); }
                    }
                    btn2.onclick = function () {
                        try {
                            document.getElementById('week_day_webinars_settings_all_days').checked = 'checked';
                            document.getElementById('week_day_webinars_settings_location_id').value = SLAG_ID_SET[0];
                            document.getElementById('week_day_webinars_settings_location_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_location_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_format_id').value = SLAG_ID_SET[1];
                            document.getElementById('week_day_webinars_settings_format_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_format_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_studio_id').value = SLAG_ID_SET[2];
                            document.getElementById('week_day_webinars_settings_studio_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_studio_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_admin_id').value = '';
                            log('Локация Шлак');
                        }
                        catch (e) { log(e); }
                    }
                    btn3.onclick = function () {
                        try {
                            document.getElementById('week_day_webinars_settings_all_days').checked = 'checked';
                            document.getElementById('week_day_webinars_settings_location_id').value = 4;
                            document.getElementById('week_day_webinars_settings_location_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_location_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_format_id').value = 1;
                            document.getElementById('week_day_webinars_settings_format_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_format_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_studio_id').value = 1;
                            document.getElementById('week_day_webinars_settings_studio_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_studio_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_admin_id').value = '';
                            log('Локация Дом');
                        }
                        catch (e) { log(e); }
                    }
                    btn4.onclick = function () {
                        try {
                            document.getElementById('week_day_webinars_settings_all_days').checked = 'checked';
                            document.getElementById('week_day_webinars_settings_location_id').value = 4;
                            document.getElementById('week_day_webinars_settings_location_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_location_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_format_id').value = 6;
                            document.getElementById('week_day_webinars_settings_format_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_format_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_studio_id').value = 1;
                            document.getElementById('week_day_webinars_settings_studio_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_studio_id').style = 'display:none;';
                            document.getElementById('week_day_webinars_settings_admin_id').value = 4789;
                            document.getElementById('week_day_webinars_settings_admin_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_admin_id').style = 'display:none;';
                            log('Локация ССМ');
                        }
                        catch (e) { log(e); }
                    }
                    i.insertBefore(btn4, i.childNodes[1]);
                    i.insertBefore(btn3, i.childNodes[1]);
                    i.insertBefore(btn2, i.childNodes[1]);
                    i.insertBefore(btn1, i.childNodes[1]);
                    log('Страница модифицирована');
                    //break;
                }
                else if (i.getElementsByTagName('h4')[0].innerHTML == 'Изменение копии группы') {
                    if (only_copy) {
                        log('magic mode ;)');
                        i.className += ' only-copy-main';
                    }
                    if (only_week_day_webinars_settings) {
                        i.parentNode.style = 'display:none;'
                    }
                }
                else if (only_copy || only_week_day_webinars_settings) {
                    i.parentNode.style = 'display:none;'
                }
            }
            if (only_copy || only_week_day_webinars_settings) {
                let arr = document.querySelectorAll('hr');
                for (let i of arr) {
                    i.style = 'display:none;';
                }
            }
            if (only_copy) {
                try {
                    let tmp = currentWindow.location.href.slice(currentWindow.location.href.search(/change_original_group_group_id/) + 31);
                    let tmp_int = tmp.search('&');
                    if (tmp_int == -1) { tmp_int = 100; }
                    document.querySelector('#change_original_group_group_id').value = tmp.slice(0, tmp_int);
                } catch (e) { }
                try {
                    let tmp = currentWindow.location.href.slice(currentWindow.location.href.search(/change_original_group_original_group_id/) + 40);
                    let tmp_int = tmp.search('&');
                    if (tmp_int == -1) { tmp_int = 100; }
                    document.querySelector('#change_original_group_original_group_id').value = tmp.slice(0, tmp_int);
                } catch (e) { }
                if ((currentWindow.location.href.match(/auto_validate/) || []).length) {
                    document.querySelector('.only-copy-main [type=submit]').click();
                }
            }
            if (only_week_day_webinars_settings) {
                try {
                    let tmp = currentWindow.location.href.slice(currentWindow.location.href.search(/select_course/) + 14);
                    let tmp_int = tmp.search('&');
                    if (tmp_int == -1) { tmp_int = 100; }
                    document.querySelector('#select_course').value = tmp.slice(0, tmp_int);
                } catch (e) { log(e) }
                try {
                    let tmp = currentWindow.location.href.slice(currentWindow.location.href.search(/select_group_template/) + 22);
                    let tmp_int = tmp.search('&');
                    if (tmp_int == -1) { tmp_int = 100; }
                    let tmp_value = tmp.slice(0, tmp_int);
                    let tmp_num = Number(tmp_value);
                    if (tmp_num > 0) {
                        let select = document.querySelector('#select_group_template');
                        let opt = document.createElement('option');
                        opt.value = tmp_value; opt.innerHTML = tmp_value;
                        select.appendChild(opt); select.value = tmp_value;
                    }
                } catch (e) { log(e) }
                if ((currentWindow.location.href.match(/ssm/) || []).length) {
                    document.querySelector('.ssm').click();
                }
                if ((currentWindow.location.href.match(/mini/) || []).length) {
                    document.querySelector('.mini').click();
                }
                if ((currentWindow.location.href.match(/home/) || []).length) {
                    document.querySelector('.home').click();
                }
                if ((currentWindow.location.href.match(/slag/) || []).length) {
                    document.querySelector('.slag').click();
                }
                if ((currentWindow.location.href.match(/auto_validate/) || []).length) {
                    document.querySelector('.only-week-day-webinar-settings-main [type=submit]').click();
                }
            }
        }
        //setInterval(500,test_adminka);
        test_adminka();
    }

    // на странице массового редактирования
    if (currentWindow.checkPath(pagePatterns.massChange)) {
        currentWindow.clearAll();
        const inputDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        Object.defineProperty(HTMLInputElement.prototype, 'value', {
            get: inputDescriptor.get,
            set: function (value) {
                const oldValue = this.value;
                inputDescriptor.set.call(this, value);
                if (oldValue !== value) {
                    this.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
        createJsConsoles();
        currentWindow.log('Эта страница создана для работы массового изменения в админке, не закрывайте её');
        let form = createElement('form');
        let urlInputElement = createFormElement(form, 'input', 'URL', 'target_url', 'Some link with some {id}');
        let loadButton = createButton('Подгрузить данные из админки', async () => { }, 'load-btn btn-primary', false);
        loadButton.tabIndex = '0';
        form.appendChild(loadButton);
        urlInputElement.style = 'width:100%';
        urlInputElement.addEventListener('change', async () => {
            // Пример кода внутри обработчика кнопки:
            let urlPattern = /\{(\w+)\}/g; // Поиск всех вхождений вида {id}
            let url = urlInputElement.value;
            let matches;
            let ids = [];

            while ((matches = urlPattern.exec(url)) !== null) {
                ids.push(matches[1]); // matches[1] содержит текст внутри {}
            }

            let oldIdElements = currentWindow.querySelectorAll('[id^="data_for_"]');
            for (let oldElement of oldIdElements) {
                oldElement.parentNode.style = 'display:none;';
            }

            // Для каждого ID создаем textarea:
            ids.forEach(id => {
                let idElement = currentWindow.querySelector(`#data_for_${id}`);
                if (!idElement) {
                    createFormElement(form, 'textarea', `Данные для ${id}`, `data_for_${id}`, `Строки данных для ${id}`, true, loadButton);
                }
                else {
                    idElement.parentNode.style = '';
                }
            });
        })
        urlInputElement.value = 'https://foxford.ru/admin/courses/{course_ids}/edit';
        const loadButtonOnClick = async () => {
            loadButton.className += ' disabled';
            urlInputElement.disabled = 'disabled';
            urlInputElement.title = 'Чтобы поменять ссылку, обновите страницу';
            let secondaryWindow = await createWindow('adminka_mass_change_temp');
            let urlPattern = /\{(\w+)\}/g; // Поиск всех вхождений вида {id}
            let url = urlInputElement.value;
            let matches;
            let patternIds = [];

            while ((matches = urlPattern.exec(url)) !== null) {
                patternIds.push(matches[1]); // matches[1] содержит текст внутри {}
            }
            for (let patternId of patternIds) {
                url = url.replace(`\{${patternId}\}`, currentWindow.querySelector(`#data_for_${patternId}`).value.split('\n')[0])
            }
            await secondaryWindow.openPage(url);
            // await secondaryWindow.log('Это вспомогательная страница для массовых правок в админке, не закрывайте её')
            const elements = secondaryWindow.querySelectorAll('input[id], select[id], textarea[id]');
            for (let element of elements) {
                let elementId = element.id;
                if (elementId && element.name && element.type != 'hidden' && element.type != 'submit') {
                    let checkbox = createFormElement(form, 'input', elementId, elementId, '');
                    checkbox.type = 'checkbox';
                    checkbox.className = '';
                    checkbox.style = 'background-color:#fff; width: 12%;';
                    checkbox.id = `checkbox_${elementId}`;
                    checkbox.parentNode.style = 'display: block;';
                    let clonedSelect = element.cloneNode(true);
                    clonedSelect.style = 'color: #aaa; display: inline;';
                    if (clonedSelect.type != 'checkbox') {
                        clonedSelect.style.width = '60%';
                    }
                    checkbox.parentNode.appendChild(clonedSelect);
                    checkbox.addEventListener('change', async () => {
                        if (checkbox.checked) {
                            clonedSelect.style.color = '#000';
                        }
                        else {
                            clonedSelect.style.color = '#aaa';
                        }
                    })
                }
            }
            secondaryWindow.close();
        }
        loadButton.addEventListener('keydown', loadButtonOnClick);
        loadButton.addEventListener('click', loadButtonOnClick);
        currentWindow.body.appendChild(form);
        currentWindow.log('Страница создана');
    }
    // на главной странице админки
    if (currentWindow.checkPath(pagePatterns.index)) {
        document.querySelector('.main-page').childNodes[1].innerHTML += '<br>Установлены скрипты Tampermonkey (v.0.2-pre-3.3.15 от 3 марта 2025)'
        currentWindow.log('Страница модифицирована');
    }
})();

