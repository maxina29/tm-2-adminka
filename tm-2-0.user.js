// ==UserScript==
// @name         TestAdminka
// @namespace    https://uploads-foxford-ru.ngcdn.ru/
// @version      0.2.0.101
// @description  Улучшенная версия админских инструментов
// @author       maxina29, wanna_get_out && deepseek
// @match        https://foxford.ru/admin*
// @grant        none
// @updateURL    https://foxford.ru/tampermoney_script_adminka.user.js
// @downloadURL  https://foxford.ru/tampermoney_script_adminka.user.js
// ==/UserScript==

const NO_LIVE_TEACHER_IDS = [2169, 2014, 1932, 1100, 1769, 1655, 1196, 2397, 2398, 557, 2399, 2401, 1571, 1387, 1875];
const MINI_GROUPS_TEACHER_ID = 1361;
const TRAINING_COURSE_TEACHER_ID = 1100;
const CANCEL_GALINA_ID = 2363;
const CANCEL_MG_TAG_ID = 1496;
const SLAG_ID_SET = [5, 1, 27, ''];
const MINI_GROUPS_ID_SET = [8, 1, 60, ''];
const HOME_ID_SET = [4, 1, 1, ''];
const SSM_ID_SET = [4, 6, 1, 4789];
const METABASE_URL = 'https://metabase.foxford.ru';
const FOXFORD_URL = 'https://foxford.ru';
const SECRET_PAGE = /admin\/courses\/15005\/lesson_packs\/new/;
const LESSON_TYPE_MAP = {
    "Нулевое": "zero",
    "Обычное": "regular",
    "Тест": "training",
    "Видео": "video",
    "Пробный экзамен": "exam_rehearsal",
    "Только задачи": "only_tasks",
    "Перевёрнутое": "flipped"
};

// global variables;
let currentWindow;


class ManagedWindow {
    _nativeWindow = null;
    _isVirtual = false;

    constructor(parent = currentWindow, htmlContent = null) {
        this._isVirtual = (htmlContent !== null);
        if (this._isVirtual) this._nativeWindow = this.#createVirtualWindow(htmlContent);
        else { this._nativeWindow = this.#getWindow(parent); }
        this.firstLessonNumber = 0;
        this.lastLessonNumber = null;
        this.jsLoggingConsole = this.createElement('textarea');
        this.jsCodeArea = this.createElement('textarea');
        this.isRunningScript = false;
        this.subwindows = [];
        this.searchParams = new URLSearchParams(this._nativeWindow.location.search);
        return this.#setupProxy();
    }

    #createVirtualWindow(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const virtualWindow = {
            document: doc, closed: false, location: { replace: () => { }, href: 'virtual://window' },
            addEventListener: () => { }, removeEventListener: () => { },
            open: () => { return new ManagedWindow(this, null); }, close: () => { this.closed = true; }
        };
        return virtualWindow;
    }

    #getWindow(parent) {
        if (parent === null) return window;
        if (typeof parent === 'string') {
            if (!currentWindow.subwindows) currentWindow.subwindows = [];
            currentWindow.subwindows.push(this);
            return window.open('about:blank', parent);
        }
        if (!parent.subwindows) parent.subwindows = [];
        parent.subwindows.push(this);
        return parent.open('about:blank');
    }

    // Проксируем основные свойства и методы
    #setupProxy() {
        const proxyHandler = {
            get: (target, prop) => {
                if (prop === 'nativeWindow') return target.nativeWindow;
                if (prop === 'isVirtual') return target._isVirtual;
                if (prop in target) return target[prop];
                const nativeWin = target._nativeWindow;
                if (prop in nativeWin) {
                    const value = nativeWin[prop];
                    return typeof value === 'function' ? value.bind(nativeWin) : value;
                }
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

    async openPage(url, params = {}) {
        if (this._isVirtual) {
            // Виртуальное окно
            try {
                const method = params.method || 'GET';
                const headers = params.headers || {};
                const body = params.body || null;
                const credentials = params.credentials || 'include';
                if (method !== 'GET' && method !== 'HEAD') {
                    const csrfToken = this.getCSRFToken();
                    if (csrfToken && !headers['X-CSRF-Token']) headers['X-CSRF-Token'] = csrfToken;
                }
                let response = await executeWithRetry(async () => {
                    return await fetch(url, { method: method, headers: headers, body: body, credentials: credentials });
                }, 10, 3000);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.log(errorText);
                    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
                }
                const html = await response.text();
                const parser = new DOMParser();
                const newDoc = parser.parseFromString(html, 'text/html');
                this._nativeWindow.document = newDoc;
                this._nativeWindow.location.href = url;
                this.document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
                log(`[VIRTUAL] Cтраница загружена: ${url}`);
                return this;
            } catch (error) {
                log(`[VIRTUAL] Ошибка загрузки страницы ${url}: ${error.message}`);
                throw error;
            }
        } else {
            // Реальное окно
            if (Object.keys(params).length > 0) {
                console.warn('Параметры openPage игнорируются в реальном режиме. Используется стандартная навигация.');
            }
            if (this.closed) throw new Error('Окно закрыто');
            if (this.location.href !== 'about:blank') {
                this.location.replace('about:blank');
                await sleep(100);
                await this.waitForElementDisappear('.loaded');
            }
            if (url != 'about:blank') {
                this.location.href = url;
                await sleep(100);
                await this.waitForElement('.loaded');
                this.jsCodeArea = this.querySelector('#js_code');
                this.jsLoggingConsole = this.querySelector('#js_console');
                this.log('Эта страница была открыта скриптом, будьте осторожны)');
            }
            return this;
        }
    }

    async postFormData(url, fields = {}, params = {}) {
        let {
            includeDefaultFields = true,
            headers = { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': this.getCSRFToken() },
            successAlertIsNessesary = true,
            fileFields = []
        } = params;
        let defaultFields = {};
        if (includeDefaultFields) defaultFields = { 'authenticity_token': this.getCSRFToken(), 'utf8': '✓' };
        const allFields = { ...defaultFields, ...fields };
        const hasFiles = fileFields.length > 0;
        let body;
        if (hasFiles) {
            const formData = new FormData();
            for (const [name, value] of Object.entries(allFields)) {
                if (!fileFields.includes(name)) {
                    if (Array.isArray(value)) value.forEach(v => formData.append(name, v));
                    else formData.append(name, value);
                }
            }
            for (const fieldName of fileFields) {
                if (fields[fieldName]) {
                    try {
                        const fileUrl = fields[fieldName];
                        const response = await fetch(fileUrl);
                        if (!response.ok) throw new Error(`Ошибка загрузки файла: ${response.status}`);
                        const blob = await response.blob();
                        const fileName = fields[`${fieldName}_name`] || fileUrl.split('/').pop() || 'file';
                        formData.append(fieldName, blob, fileName);
                        log(`Файл загружен: ${fileName} (${blob.size} bytes)`);
                    } catch (error) {
                        throw new Error(`Ошибка загрузки файла для поля ${fieldName}: ${error.message}`);
                    }
                }
            }
            body = formData;
        } else {
            let urlParams = new URLSearchParams();
            for (const [name, value] of Object.entries(allFields)) {
                if (Array.isArray(value)) value.forEach(v => urlParams.append(name, v));
                else urlParams.append(name, value);
            }
            body = urlParams;
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        await this.openPage(url, { method: 'POST', headers: headers, body: body });
        if (successAlertIsNessesary) {
            try { await this.waitForSuccess(true); }
            catch (error) {
                log(error.message);
                await sleep(500);
                log('Повторная попытка...')
                await this.openPage(url, { method: 'POST', headers: headers, body: body });
                await this.waitForSuccess(true);
            }
        }
    }

    async postFormDataJSON(url, payload = {}, params = { checkJSONresponse: true }) {
        let {
            method = 'POST',
            headers = {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.getCSRFToken(),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body = payload ? JSON.stringify(payload) : null
        } = params;
        await this.openPage(url, { method: method, headers: headers, body: body });
        if (params.checkJSONresponse) await this.checkJSONresponse();
    }

    async checkJSONresponse() {
        let json = JSON.parse(this.document.body.innerHTML);
        if (json.result === true) {
            return true;
        }
        throw new Error(json.errors);
    }

    getCSRFToken() {
        try {
            const metaToken = currentWindow.document.querySelector('meta[name="csrf-token"]');
            if (metaToken) return metaToken.getAttribute('content');
            return null;
        } catch (error) { return null; }
    }

    getElementValue(selector) { return this.querySelector(selector).value; }

    checkPath(pattern) {
        const currentLocation = this.location.href;
        if (pattern instanceof RegExp) return pattern.test(currentLocation);
        return currentLocation === pattern;
    }

    async close() {
        if (!this._nativeWindow.closed) {
            this._nativeWindow.close();
            if (this.location) log(`Окно закрыто: ${this.location.href}`);
            else log(`Окно закрыто`);
        }
    }

    async reload() {
        await this.closeSubwindows();
        this.document.querySelector('.loaded').className = '';
        this.location.href = this.location.href;
    }

    async click(selector) {
        if (!this._isVirtual) {
            const element = await this.waitForElement(selector);
            element.click();
        }
    }


    async waitForLoad() {
        const nativeWindow = this._nativeWindow;
        return new Promise(resolve => {
            if (nativeWindow.document?.readyState === 'complete') resolve();
            else nativeWindow.addEventListener('load', resolve);
        });
    }

    async waitForElement(selector, timeout = 30000, maxRetries = 20) {
        if (this._isVirtual) return this.querySelector(selector);
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

    async waitForSuccess(skipDangerAlert = false) {
        await this.waitForElement('.alert:not(.alert-dismissible):not(.alert-warning):not(.custom-alert)');
        let successAlert = this.querySelector('.alert-success:not(.alert-dismissible):not(.custom-alert)');
        if (successAlert) {
            let alertCloseButton = successAlert.querySelector('.close');
            if (!this._isVirtual) {
                alertCloseButton.click();
                await this.waitForElementDisappear('.alert-success:not(.alert-dismissible)');
            }
        }
        else if (this.querySelector('.alert-danger:not(.alert-dismissible)') &&
            (skipDangerAlert == false || this._isVirtual)
        ) {
            let errorMessage = this.querySelector('.alert-danger:not(.alert-dismissible)').innerHTML;
            if (errorMessage.search('</button>') != -1) {
                errorMessage = errorMessage.substring(errorMessage.search('</button>') + 9);
            }
            if (skipDangerAlert == false) throw new Error(`${errorMessage}`);
            else displayLog(`Пропускаю: ${errorMessage}`, 'warning');
        }
        else if (!this.querySelector('.alert-danger:not(.alert-dismissible)') && !this._isVirtual) {
            await sleep(500);
            await this.waitForSuccess(skipDangerAlert = skipDangerAlert);
        }
        else throw new Error('Не удалось найти алерт');
    }

    async waitForAnyElement(selectors, timeout = 30000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            for (let selector of selectors) {
                let element = this.querySelector(selector);
                if (element) {
                    log(`Найден элемент ${selector}`)
                    return { element, selector };
                }
            }
            await sleep(100);
        }
        throw new Error(`Ни один из элементов не найден за ${timeout} мс`);
    }

    async log(s) {
        if (s && s !== '[object Promise]') this.jsLoggingConsole.value += `${s}\n`;
    }

    querySelector(s) { return this.document.querySelector(s); }

    querySelectorAll(s) { return this.document.querySelectorAll(s); }

    async clearAll() {
        this.document.documentElement.innerHTML = '';
        this.document.head.innerHTML =
            `<link rel="stylesheet" media="all" href="https://assets-foxford-ru.ngcdn.ru/assets/` +
            `admin-ae2dc560fd6ba1ec7257653c297ebb617601ca617c1b9e7306b37dcea79e795b.css">`;
    }

    get document() { return this._nativeWindow.document; }

    get body() { return this.document.body; }

    get head() { return this.document.head; }

    createElement(tagName) { return this.document.createElement(tagName); }

    addStyle(style) {
        const sheet = new CSSStyleSheet();
        sheet.insertRule(style);
        this.document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }

    updateFormFields(form, fields) {
        for (const input of form.querySelectorAll('input:not(.protected)')) input.remove();
        for (const [name, value] of Object.entries(fields)) {
            let input = form.querySelector(`[name="${name}"]`);
            input = createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
            input.value = value;
        }
    }

    async closeSubwindows() {
        for (let win of this.subwindows) await win.close();
        this.subwindows = [];
    }

}

async function executeWithRetry(codeToExecute, maxRetries = 10, delay = 1000) {
    let retries = 0;

    async function attempt() {
        try {
            return await codeToExecute(); // Возвращаем результат
        } catch (error) {
            if (retries < maxRetries) {
                retries++;
                console.log(`Повторная попытка ${retries}/${maxRetries}...`);
                await sleep(delay);
                // Рекурсивно повторяем попытку
                return attempt();
            } else {
                console.log("Превышено максимальное количество попыток.");
                throw error; // Отклоняем промис
            }
        }
    }

    return attempt(); // Запускаем первую попытку
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
        if (oldValue !== value) this.dispatchEvent(new Event('change', { bubbles: true }));
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
        if (oldValue !== value) this.dispatchEvent(new Event('change', { bubbles: true }));
    }
});

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function checkBotApprove() { return currentWindow.querySelector('.bot-approve') !== null; }

async function displayError(err, comment = '', time = 3000) {
    console.error(err);
    currentWindow.lastError = err;
    displayLog(`Ошибка ${comment}: ${err.message}`, 'danger', time);
}

async function displayLog(message, type = 'success', time = 3000) {
    try { currentWindow.log(message); }
    catch (e) { console.error('Логирование во внутреннюю консоль невозможно', e); }
    const displayAlert = createElement(
        'div', `alert alert-${type} custom-alert`, 'position:fixed; top:0%; width:100%; z-index:9999;'
    );
    displayAlert.textContent = message;
    currentWindow.body.appendChild(displayAlert);
    setTimeout(() => displayAlert.remove(), time);
}

function log(s) {
    currentWindow.log(s);
}

function createButton(btnLabel, onClickFunction = null, className = '', isRealButton = true, isAsyncFunction = true) {
    if (onClickFunction == null) onClickFunction = async () => { };
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

function createWarningElement(text) {
    const element = createElement('div', '', 'color:orange;font-size: 11px; top: 3px');
    element.hidden = true;
    element.innerHTML = text;
    return element;
}

function createFormElement(
    form, elementTag, elementText, elementID, placeholder = '', classes = true, beforeChild = null
) {
    let div = createElement('div', 'form-group');
    let element = createElement(elementTag, `form-control ${elementTag}`);
    let label = createElement('label', 'control-label');
    if (classes == true) {
        element.className += ' col-sm-9';
        label.className += ' col-sm-3';
    }
    else div.style = 'display:inline;';
    element.id = elementID;
    element.placeholder = placeholder;
    label.htmlFor = elementID;
    label.id = 'lbl_' + elementID;
    label.textContent = elementText;
    div.append(label, element);
    if (beforeChild) form.insertBefore(div, beforeChild);
    else form.appendChild(div);
    return element;
}

function createFileInput(format = 'text/csv') {
    let inp = createElement('input');
    inp.type = 'file';
    inp.accept = format;
    inp.required = true;
    return inp;
}

async function createWindow(arg = window) {
    if (typeof arg === 'object' && arg !== null) {
        const {
            parent = currentWindow,
            htmlContent = null,
            name = null,
            isVirtual = (htmlContent !== null),
        } = arg;
        if (htmlContent !== null) {
            return new ManagedWindow(parent, htmlContent);
        } else if (isVirtual) {
            return new ManagedWindow(parent, '');
        }
        else if (name) {
            return new ManagedWindow(name);
        } else {
            return new ManagedWindow(parent);
        }
    }
    if (arg === -1) {
        return new ManagedWindow(currentWindow, '');
    }
    // Остальная логика для строк, null или undefined
    return new ManagedWindow(arg);
}

function applyReplaceRules(str, replaceRules = []) {
    let result = str;
    for (const [key, value] of Object.entries(replaceRules)) result = result.replace(key, value);
    return result;
}

async function copyFormData(sourceForm, targetForm, params = null) {
    // params = {'replaceRules': {'task': 'tasks_code'}, 'ignoreList': ['courses[name]', 'courses_id'] }
    const ignoreList = params?.ignoreList || [];
    const replaceRules = params?.replaceRules || {};
    const elements = sourceForm.querySelectorAll('input, select, textarea');
    for (const element of elements) {
        if (shouldSkipElement(element, ignoreList)) continue;
        const targetElement = findFormElement(targetForm, element, replaceRules);
        if (targetElement) {
            copyElementValue(element, targetElement);
            log(`Скопировано поле: ${element.name}`);
        }
    }
    const fileInputs = sourceForm.querySelectorAll('input[type="file"]');
    for (const input of fileInputs) {
        const targetInput = findFormElement(targetForm, input, replaceRules);
        if (targetInput) copyFileElement(input, targetInput);
    }
    const iframes = sourceForm.querySelectorAll('iframe');
    for (const iframe of iframes) {
        const targetIframe = findFormElement(targetForm, iframe, replaceRules);
        if (targetIframe) await copyIframeContent(iframe, targetIframe);
    }
    await processDynamicFields(sourceForm, targetForm, params);
}

function shouldSkipElement(element, ignoreList) {
    return ignoreList.includes(element.name) ||
        ignoreList.includes(element.id) ||
        element.classList.contains('protected');
}

async function processDynamicFields(sourceForm, targetForm, params = null) {
    const ignoreList = params?.ignoreList || [];
    const replaceRules = params?.replaceRules || {};
    const associations = new Set();
    const allFields = sourceForm.querySelectorAll('input, select, textarea, iframe');
    for (const field of allFields) {
        const fieldId = field.id;
        if (!fieldId || ignoreList.includes(fieldId)) continue;
        if (fieldId.includes('_attributes_')) {
            const prefix = fieldId.split('_attributes_')[0];
            // Разбиваем на части и берем последние 1-3 части как возможную ассоциацию
            const parts = prefix.split('_');
            for (let i = 1; i <= 3; i++) {
                if (parts.length > i) {
                    const candidate = parts.slice(-i).join('_');
                    associations.add(candidate);
                }
            }
        }
    }

    // Для каждой возможной ассоциации
    for (const association of associations) {
        const sourceFields = {};
        const fieldRegex = new RegExp(`${association}_attributes_(\\d+)_(.+)`);
        for (const field of allFields) {
            const fieldId = field.id;
            const match = fieldId.match(fieldRegex);
            if (match) {
                const [, index, fieldName] = match;
                if (!sourceFields[index]) sourceFields[index] = {};
                sourceFields[index][fieldName] = field;
            }
        }
        if (!Object.keys(sourceFields).length) continue;
        const addButton = targetForm.querySelector(`.btn-success[data-association="${association}"]`);
        if (!addButton) continue;
        const indexes = Object.keys(sourceFields);
        const createdGroups = [];
        for (let i = 0; i < indexes.length; i++) {
            addButton.click();
            await waitForAddedNode({ parent: targetForm, recursive: true, includeIframes: true, minWait: 300 });
            const allGroups = targetForm.querySelectorAll(`[id*="${association}_attributes_"]`);
            const newGroup = allGroups[allGroups.length - 1].closest('.fields');
            if (newGroup && !createdGroups.includes(newGroup)) createdGroups.push(newGroup);
            else displayLog("Не удалось найти новую группу после клика", 'warning');
        }
        for (let i = 0; i < indexes.length; i++) {
            const sourceGroup = sourceFields[indexes[i]];
            const targetGroup = createdGroups[i];
            if (!targetGroup || !sourceGroup) continue;
            for (const [fieldName, sourceElement] of Object.entries(sourceGroup)) {
                const transformedFieldName = applyReplaceRules(fieldName, replaceRules);
                const targetElement = findTargetElement(targetGroup, association, transformedFieldName);
                if (!targetElement) {
                    displayLog(`Не найден элемент для ${association} и ${fieldName}`, 'warning');
                    continue;
                }
                await copyFieldData(sourceElement, targetElement);
            }
        }
    }
}

function findFormElement(form, sourceElement, replaceRules = {}) {
    let targetElement = null;
    if (sourceElement.id) {
        try { targetElement = form.querySelector(`#${applyReplaceRules(sourceElement.id, replaceRules)}`); }
        catch { }
    }
    if (!targetElement && sourceElement.name) {
        const newName = applyReplaceRules(sourceElement.name, replaceRules);
        targetElement = form.querySelector(`[name="${newName}"]`);
    }
    return targetElement;
}

function findTargetElement(group, association, fieldName) {
    return group.querySelector(`[id*="${association}_attributes_"][id$="${fieldName}"]`);
}

async function copyFieldData(sourceElement, targetElement) {
    if (sourceElement.tagName !== targetElement.tagName || sourceElement.type !== targetElement.type) {
        displayLog('Элементы разного типа', 'warning');
        return;
    }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(sourceElement.tagName)) {
        if (sourceElement.type === 'file') copyFileElement(sourceElement, targetElement);
        else copyElementValue(sourceElement, targetElement);
    }
    else if (sourceElement.tagName === 'IFRAME') await copyIframeContent(sourceElement, targetElement);
    else displayLog('Неизвестный вид элемента', 'warning');
}

function copyElementValue(source, target) {
    if (target.type === 'checkbox' || target.type === 'radio') target.checked = source.checked;
    else if (source.tagName === 'SELECT' && source.multiple) {
        if (target.tagName === 'SELECT' && target.multiple) {
            const selectedValues = new Set(Array.from(source.selectedOptions).map(opt => opt.value));
            Array.from(target.options).forEach(opt => opt.selected = false);
            const existingOptions = new Map();
            Array.from(target.options).forEach(opt => { existingOptions.set(opt.value, opt); });
            Array.from(source.options).forEach(sourceOption => {
                if (!existingOptions.has(sourceOption.value)) {
                    const newOption = new Option(
                        sourceOption.text,
                        sourceOption.value
                    );
                    target.add(newOption);
                    existingOptions.set(sourceOption.value, newOption);
                }
            });
            Array.from(target.options).forEach(opt => {
                if (selectedValues.has(opt.value)) {
                    opt.selected = true;
                }
            });
        }
    } else target.value = source.value;
}

function copyFileElement(sourceInput, targetInput) {
    if (sourceInput.files.length > 0) {
        const dt = new DataTransfer();
        for (const file of sourceInput.files) dt.items.add(file);
        targetInput.files = dt.files;
    }
}


function waitForAddedNode({ parent = document, recursive = true, includeIframes = true, minWait = 300 }) {
    return new Promise(resolve => {
        const startTime = Date.now();
        let observer;
        const check = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= minWait) {
                if (observer) observer.disconnect();
                resolve();
            } else setTimeout(check, 50);
        };
        observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    observer.disconnect();
                    check();
                    return;
                }
            }
        });
        observer.observe(parent, { childList: true, subtree: recursive });
        if (includeIframes) {
            const iframes = parent.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    if (iframe.contentDocument) {
                        observer.observe(iframe.contentDocument.body, { childList: true, subtree: true });
                    }
                } catch (e) { } // Игнорируем ошибки CORS
            }
        }
        // Гарантированное завершение
        setTimeout(() => {
            observer.disconnect();
            resolve();
        }, Math.max(minWait, 1000));
    });
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
                } else setTimeout(checkContent, 100);
            } catch (e) { setTimeout(checkContent, 100); }
        };
        checkContent();
    });
}

async function cloneResource(sourceWin, targetWin, editUrl, newUrl, params = null) {
    // params = {'isNotFormSubmit': false},
    await sourceWin.openPage(editUrl);
    await targetWin.openPage(newUrl);
    const sourceForm = await sourceWin.waitForElement('form');
    const targetForm = await targetWin.waitForElement('form');
    await copyFormData(sourceForm, targetForm, params);
    let isNotFormSubmit = params?.isNotFormSubmit || false;
    if (!isNotFormSubmit) {
        await targetForm.querySelector('input[type="submit"]').click();
        await targetWin.waitForSuccess();
    }
    log(`Ресурс успешно скопирован из ${editUrl} в ${newUrl}`);
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

async function getCsvFromMetabase(question_id, timeout = 10000) {
    return new Promise((resolve, reject) => {
        let tempWindow = window.open(`${METABASE_URL}/question/${question_id}?get_data`, 'metabaseWindow');

        function messageHandler(event) {
            if (event.origin !== METABASE_URL) return;
            if (event.data.type === 'FROM_METABASE_CSV_DATA') {
                cleanup();
                resolve(event.data.payload);
            }
        }

        function cleanup() {
            window.removeEventListener('message', messageHandler);
            if (timeoutId) clearTimeout(timeoutId);
            if (tempWindow) tempWindow.close();
        }

        const timeoutId = setTimeout(() => {
            cleanup();
            displayError(new Error(
                `Для работы скрипта необходимо:\n` +
                `1) авторизоваться в ${METABASE_URL}/\n` +
                `2) установить скрипт ${FOXFORD_URL}/tampermoney_script_metabase.user.js`
            ));
            resolve('');
        }, timeout);
        window.addEventListener('message', messageHandler);
    });
}

function setCsvFileByContent(fileInput, csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], 'fake_file.csv', { type: 'text/csv' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
}

async function createJsConsoles() {
    currentWindow.jsCodeArea.rows = 1;
    currentWindow.jsCodeArea.cols = 1;
    currentWindow.jsCodeArea.id = 'js_code';
    currentWindow.jsCodeArea.style = 'min-height:75px; min-width:400px; max-width:1000px; max-height:500px;';
    currentWindow.jsCodeArea.placeholder = 'Место для JS-кода';

    function run_script() {
        if (currentWindow.isRunningScript == true) {
            displayLog('Скрипт уже запущен, если хотите запустить другой, обновите страницу', 'danger');
            return
        }

        function clear() { currentWindow.jsLoggingConsole.value = ''; }

        try {
            clear();
            const codeToExecute = `
                (async () => {
                    try {
                        currentWindow.isRunningScript = true;
                        ${currentWindow.jsCodeArea.value}
                        displayLog('Выполнение скрипта завершено', 'success', 1000);
                    } catch (e) { displayError(e, 'при выполнении скрипта'); } 
                    finally {
                        await currentWindow.closeSubwindows();
                        currentWindow.isRunningScript = false; 
                    }
                })();`;
            const result = eval(codeToExecute);
            result.then(val => {
                if (val !== undefined) currentWindow.log(String(val));
            }).catch(e => currentWindow.log(String(e)));
        } catch (e) { currentWindow.log(String(e)); }
    }

    const runButton = createButton('Запустить', run_script, 'btn-info');
    runButton.style = 'align-self: center; margin-left: 20px; margin-right:20px;';
    currentWindow.jsLoggingConsole.rows = 1;
    currentWindow.jsLoggingConsole.cols = 1;
    currentWindow.jsLoggingConsole.id = 'js_console';
    currentWindow.jsLoggingConsole.disabled = true;
    currentWindow.jsLoggingConsole.style =
        'min-height:75px; min-width:400px; max-width:1000px; max-height:500px; background-color:white;';
    currentWindow.jsLoggingConsole.placeholder = 'Консоль';
    try {
        let body = currentWindow.body;
        let divForConsoles = createElement(
            'div', '',
            `display: flex; flex-direction: row; justify-content: center; position: sticky; top:0; 
                background:white; z-index:1049;`
        );
        divForConsoles.appendChild(currentWindow.jsCodeArea);
        divForConsoles.appendChild(runButton);
        divForConsoles.appendChild(currentWindow.jsLoggingConsole);
        body.insertBefore(divForConsoles, body.firstChild);
    } catch (e) { displayError(e, 'Не могу добавить некоторые поля'); }
}

function splitString(str) { return str.split(/[\s,.;]+/).filter(Boolean); }

function getBaseUrl(url) {
    // Находим первое число в URL и оставляем все до него включительно
    const match = url.match(/^(.*?\d+)/);
    return match ? match[1] : url;
}

async function fillFormFromSearchParams() {
    const stopParams = ['only_copy', 'only_week_day_webinars_settings', 'utf8', 'commit'];
    const params = currentWindow.searchParams;
    if (stopParams.some(param => params.has(param)) || params.size == 0) return;
    const formId = params.get('form_id');
    const formAction = params.get('form_action');
    let form;
    if (formId) form = currentWindow.querySelector(`form#${formId}`);
    else if (formAction) form = currentWindow.querySelector(`form[action="${formAction}"]`);
    else form = currentWindow.querySelector('form');
    if (!form) {
        const errorMsg = formId ? `Форма с ID "${formId}"` :
            formAction ? `Форма с action "${formAction}"` : "Ни одна форма";
        displayError(`${errorMsg} не найдена`);
        return;
    }
    else log('Начинаю автозаполнение формы');
    for (const [param, value] of params.entries()) {
        if (['form_id', 'form_action', 'action', 'action_target', 'button', 'auto_submit'].includes(param)) continue;
        const field = form.querySelector(`#${param}:not(.protected)`);
        if (field) fillFieldByType(field, value);
    }
    const action = params.get('action');
    const actionTarget = params.get('action_target');
    const buttonClass = params.get('button');
    const autoSubmit = params.has('auto_submit');
    if (action === 'click' && actionTarget) {
        const element = form.querySelector(`#${actionTarget}`) || currentWindow.querySelector(`#${actionTarget}`);
        log(`Нажимаю на элемент #${actionTarget}`);
        if (element) element.click();
    }
    else if (action === 'click' && buttonClass) {
        const button = form.querySelector(`.${buttonClass}`) || currentWindow.querySelector(`.${buttonClass}`);
        log(`Нажимаю на кнопку .${buttonClass}`);
        if (button) button.click();
    }
    if (action === 'submit' || autoSubmit) {
        const submitButton = form.querySelector('input[type="submit"], button[type="submit"]');
        log(`Автоматическа отправка формы`);
        if (submitButton) submitButton.click();
        else form.submit();
    }
}

function fillFieldByType(field, value) {
    const tagName = field.tagName;
    const type = field.type ? field.type.toLowerCase() : '';
    try {
        if (tagName === 'SELECT' && field.multiple) {
            const values = value.split(',');
            values.forEach(val => {
                if (!Array.from(field.options).some(opt => opt.value === val)) {
                    const newOption = new Option(val, val);
                    field.add(newOption);
                }
            });
            Array.from(field.options).forEach(option => { option.selected = values.includes(option.value); });
        }
        else if (tagName === 'SELECT') {
            if (!Array.from(field.options).some(opt => opt.value === value)) {
                const newOption = new Option(value, value);
                field.add(newOption);
            }
            field.value = value;
        }
        else if (type === 'checkbox') field.checked = ['1', 'true', 'on'].includes(value.toLowerCase());
        else if (type === 'radio') {
            const radioGroup = field.form.querySelectorAll(`[name="${field.name}"][type="radio"]`);
            radioGroup.forEach(radio => { radio.checked = (radio.value === value); });
        }
        else if (type === 'file') displayLog('Файловые поля не могут быть заполнены через URL параметры', 'warning');
        else field.value = value;
        const changeEvent = new Event('change', { bubbles: true });
        field.dispatchEvent(changeEvent);
        log(`Заполнено поле ${field.id}: ${value}`);
    } catch (e) { displayError(e, `Ошибка при заполнении поля ${field.id}`); }
}

function matchNumber(str) { return str.match(/\d+/g)[0]; }

function getTableLinks(virtualWindow, tableSelector = '.table', elementSelector = 'a[href$="edit"]') {
    return Array.from(virtualWindow.querySelectorAll(`${tableSelector} tbody tr ${elementSelector}`))
        .map(link => link.href);
}

function getTableTexts(virtualWindow, elementSelector = '') {
    return Array.from(virtualWindow.querySelectorAll(`.table tbody tr ${elementSelector}`))
        .map(element => element.textContent);
}

async function copyMethodicalRecomendationItems(virtualWindow, sourceUnitLink, targetUnitLink, tabName, tabTitle) {
    await virtualWindow.openPage(`${sourceUnitLink}?tab=${tabName}`);
    let sourceLinks = getTableLinks(virtualWindow, '.table', 'a[data-method="delete"]');
    let appendTextLink = targetUnitLink.replace(/\/blocks\/\d+(\/units\/\d+)\/edit$/, `$1/${tabName}_items`);
    if (sourceLinks.length > 0) { log(`-- Копирую ${tabTitle} --`); }
    for (let sourceLink of sourceLinks) {
        await virtualWindow.openPage(`${sourceLink}/edit`);
        let sourceText = virtualWindow.getElementValue(
            `#methodical_materials_items_${tabName}_item_text_attachment_attributes_content`
        );
        await virtualWindow.postFormData(
            appendTextLink,
            { [`methodical_materials_items_${tabName}_item[text_attachment_attributes][content]`]: sourceText }
        );
    }
}

async function сopyMethodicalFileItems(virtualWindow, sourceUnitLink, targetUnitLink, tabName, tabTitle, options = {}) {
    let { hasUserDownloadable = false } = options;
    await virtualWindow.openPage(`${sourceUnitLink}?tab=${tabName}`);
    let sourceLinks = getTableLinks(virtualWindow, '.table', 'a[data-method="delete"]');
    let sourceFileLinks = getTableLinks(virtualWindow, '.table', 'a[target="_blank"]');
    let appendFileLink = targetUnitLink.replace(/\/blocks\/\d+(\/units\/\d+)\/edit$/, `$1/${tabName}_items`);
    if (sourceLinks.length > 0) { log(`-- Копирую ${tabTitle} --`); }
    for (let ind = 0; ind < sourceLinks.length; ind++) {
        let sourceLink = sourceLinks[ind];
        let sourceFileLink = sourceFileLinks[ind];
        await virtualWindow.openPage(`${sourceLink}/edit`);
        let sourceName = virtualWindow.getElementValue(
            `#methodical_materials_items_${tabName}_item_attachment_attributes_name`
        );
        let fields = {
            [`methodical_materials_items_${tabName}_item[attachment_attributes][name]`]: sourceName,
            [`methodical_materials_items_${tabName}_item[attachment_attributes][file]`]: sourceFileLink
        };
        if (!hasUserDownloadable) {
            let sourceUserDownloadable = virtualWindow.getElementValue(
                `#methodical_materials_items_${tabName}_item_user_downloadable`
            );
            fields[`methodical_materials_items_${tabName}_item[user_downloadable]`] = sourceUserDownloadable;
        }
        await virtualWindow.postFormData(
            appendFileLink, fields,
            { fileFields: [`methodical_materials_items_${tabName}_item[attachment_attributes][file]`] }
        );
    }
}

async function copyMethodicalMaterials(virtualWindow, sourceUnitLink, targetUnitLink, settings) {
    if (settings['Задачи'] || settings['Рекомендованность к ДЗ']) {
        await virtualWindow.openPage(`${sourceUnitLink}?tab=task`);
        let sourceTaskLinks = getTableLinks(virtualWindow);
        let sourceTaskRecommendations = getTableTexts(virtualWindow, '.homework_recommendation_text');
        if (settings['Задачи']) {
            if (sourceTaskLinks.length > 0) { log('-- Копирую задачи --'); }
            for (let taskLink of sourceTaskLinks) {
                let taskId = matchNumber(taskLink);
                let appendTaskLink = targetUnitLink.replace(
                    /\/blocks\/\d+(\/units\/\d+)\/edit$/, `$1/task_bindings?task_id=${taskId}`
                );
                await virtualWindow.postFormData(appendTaskLink, {}, { successAlertIsNessesary: false });
            }
        }
        if (settings['Рекомендованность к ДЗ']) {
            await virtualWindow.openPage(`${targetUnitLink}?tab=task`);
            let targetTaskRecommendationLinks = getTableLinks(
                virtualWindow, '.table', 'a[href$="toggle_homework_recommendation"]'
            );
            let targetTaskRecommendations = getTableTexts(virtualWindow, '.homework_recommendation_text');
            if (sourceTaskRecommendations.length != targetTaskRecommendations.length) {
                displayLog('Количество задач в ДЗ в уроках не совпадает, пропускаем их', 'warning');
            }
            else {
                log('-- Проверяю рекомендованность к ДЗ --');
                for (let taskInd = 0; taskInd < sourceTaskRecommendations.length; taskInd++) {
                    if (sourceTaskRecommendations[taskInd] != targetTaskRecommendations[taskInd]) {
                        await virtualWindow.postFormDataJSON(
                            targetTaskRecommendationLinks[taskInd], { checkJSONresponse: false }
                        );
                    }
                }
            }
        }
    }
    if (settings['Рекомендации (методические)']) {
        await copyMethodicalRecomendationItems(
            virtualWindow, sourceUnitLink, targetUnitLink, 'text', 'рекомендации (методические)'
        );
    }
    if (settings['Презентации']) {
        await сopyMethodicalFileItems(virtualWindow, sourceUnitLink, targetUnitLink, 'presentation', 'презентации');
    }
    if (settings['Файлы (методические)']) {
        await сopyMethodicalFileItems(virtualWindow, sourceUnitLink, targetUnitLink, 'file', 'файлы (методические)');
    }
    if (settings['Рекомендации (подготовительные)']) {
        await copyMethodicalRecomendationItems(
            virtualWindow, sourceUnitLink, targetUnitLink, 'preparation_text', 'рекомендации (подготовительные)'
        );
    }
    if (settings['Ссылки']) {
        await virtualWindow.openPage(`${sourceUnitLink}?tab=link`);
        let sourceLinkLinks = getTableLinks(virtualWindow, '.table', 'a[data-method="delete"]');
        let appendLinkLink = targetUnitLink.replace(/\/blocks\/\d+(\/units\/\d+)\/edit$/, '$1/link_items');
        if (sourceLinkLinks.length > 0) { log('-- Копирую ссылки --'); }
        for (let linkLink of sourceLinkLinks) {
            await virtualWindow.openPage(`${linkLink}/edit`);
            let linkName = virtualWindow.getElementValue(
                '#methodical_materials_items_link_item_link_attributes_name'
            );
            let linkUrl = virtualWindow.getElementValue(
                '#methodical_materials_items_link_item_link_attributes_url'
            );
            let fields = {
                'methodical_materials_items_link_item[link_attributes][name]': linkName,
                'methodical_materials_items_link_item[link_attributes][url]': linkUrl
            };
            await virtualWindow.postFormData(appendLinkLink, fields);
        }
    }
    if (settings['Файлы (подготовительные)']) {
        await сopyMethodicalFileItems(
            virtualWindow, sourceUnitLink, targetUnitLink, 'preparation_file', 'файлы (подготовительные)',
            { hasUserDownloadable: true }
        );
    }
}

// Генерация уведомлений от @wanna_get_out
function alertManager() {
    const managerId = 'alert-manager-container';
    const headerId = 'script_header';

    let scriptHeader = currentWindow.querySelector(`#${headerId}`);

    if (!scriptHeader) {
        scriptHeader = currentWindow.createElement('div');
        scriptHeader.id = headerId;
        scriptHeader.style.cssText = `
            display: flex; 
            flex-direction: column; 
            position: sticky; 
            top: 0px; 
            background: white; 
            z-index: 1049; 
            max-height: 33vh; 
            overflow-y: auto;
        `;

        const jsConsole = currentWindow.querySelector('#js-console');
        if (jsConsole) {
            scriptHeader.appendChild(jsConsole);
        } else {
            const consoleContainer = currentWindow.createElement('div');
            consoleContainer.id = 'js-console';
            consoleContainer.style.cssText = 'display: flex; flex-direction: row; justify-content: center;';
            scriptHeader.appendChild(consoleContainer);
        }
        currentWindow.body.insertBefore(scriptHeader, currentWindow.body.firstChild);
    }

    let container = currentWindow.querySelector(`#${managerId}`);

    if (!container) {
        container = currentWindow.createElement('div');
        container.id = managerId;
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        container.style.marginTop = '10px';

        scriptHeader.appendChild(container);
    }

    return {
        addAlert: (message, bgColor = '#ffb6c4', alertClass = 'custom-alert') => {
            const existingAlert = container.querySelector(`.${alertClass}`);
            if (existingAlert) existingAlert.remove();

            const alert = currentWindow.createElement('div');
            alert.className = alertClass;
            alert.style.padding = '10px';
            alert.style.borderRadius = '4px';
            alert.style.backgroundColor = bgColor;
            alert.style.textAlign = 'center';
            alert.textContent = message;

            container.appendChild(alert);
        },

        removeAlert: (alertClass = 'custom-alert') => {
            const alert = container.querySelector(`.${alertClass}`);
            if (alert) alert.remove();
        }
    };
}

// регулярки для проверки текущей страницы админки
const pagePatterns = {
    // обучение - курсы
    courses: /admin\/courses([?#]|$)/,
    coursesEdit: /admin\/courses\/\d*\/edit/,
    coursesNew: /admin\/courses\/new/,
    miniGroupsEdit: /admin\/mini_groups\/\d*\/edit/, /* пока не используется */
    miniGroupsNew: /admin\/mini_groups\/new/,
    lessons: /lessons([?#]|$)/,
    lessonsOrder: /lessons_order$/,
    lessonTasks: /admin\/lessons\/\d*\/lesson_tasks/,
    groups: /groups([?#]|$)/,
    newDuplicates: /course_duplicates\/new$/,
    pdfCreate: /\/course_plans\/new/,
    pdfEdit: /course_plans\/\d*\/edit/,
    installments: /installments$/,
    // обучение - тесты
    trainingsTaskTemplates: /trainings\/\d*\/task_templates/,
    trainingsIndividualTasks: /trainings\/task_templates\/\d*\/individual_tasks/,
    // обучение - мероприятия
    eventsNew: /admin\/events\/new/,
    eventsEdit: /admin\/events\/\d*\/edit/,
    // практика - задачи
    taskPreviewAnswers: /admin\/tasks\/\d*\/preview#ans/,
    tasksEdit: /admin\/tasks\/(?:codes\/|essays\/)?\d*\/edit/,
    // практика - учебные программы
    methodicalBlockEdit: /methodical_materials\/programs\/[\d]*\/blocks\/\d*\/edit/,
    methodicalLinkCreateVideo: /methodical_materials\/units\/\d*\/link_items\/new#szh/,
    // пользователи - учащиеся
    usersCoursesReplace: /admin\/users_courses\/\d*\/replace/,
    massCourseAccess: /admin\/mass_course_access$/,
    // эдш - типы продуктов
    gridsCreate: /externship\/product_types\/\d*\/grids\/new/,
    gridsEdit: /externship\/product_types\/\d*\/grids\/\d*\/edit/,
    individualItems: /externship\/product_types\/\d*\/individual\/items$/,
    individualItemsCreateMass: /externship\/product_types\/\d*\/individual\/items\/new_mass$/,
    // прочее
    devServices: /admin\/dev_services([?#]|$)/,
    webinar: /admin\/courses\/\d*\/groups\/\d*$/,
    eventWebinar: /admin\/events\/\d*/,
    massChange: `${FOXFORD_URL}/admin/mass_change`,
    secretPage: SECRET_PAGE,
    index: `${FOXFORD_URL}/admin`,
    hasAnchor: /#/
};

(async function () {
    'use strict';
    currentWindow = await createWindow(null);
    currentWindow.waitForLoad();

    // создаем поле для js-кода, кнопку запуска и нашу консоль
    if (!currentWindow.checkPath(pagePatterns.taskPreviewAnswers) &&
        !currentWindow.checkPath(pagePatterns.webinar) &&
        !currentWindow.checkPath(pagePatterns.eventWebinar)
    ) {
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
            try {
                anchorElement.scrollIntoView({ behavior: 'smooth' });
                currentWindow.scrollBy(0, -80);
            }
            catch (err) {
                console.log(`no ${anchor} on page`);
            }

        }
    }
    currentWindow.body.firstChild.className += ' loaded';
    currentWindow.body.firstChild.id = 'js-console';

    /************************* Обучение - курсы *************************/

    // на странице со списком курсов
    if (currentWindow.checkPath(pagePatterns.courses)) {
        let idSearchButton = createButton('Найти по ID', async () => { }, 'btn-default', false);
        const idElement = currentWindow.querySelector('#q_id_eq');
        idSearchButton.href = '/admin/courses?q%5Bid_eq%5D=' + idElement.value;
        idElement.style = 'width:52%;';
        idElement.parentNode.style = 'margin-right:-7pt;';
        idElement.onchange = function () {
            idSearchButton.href = `/admin/courses?q%5Bid_eq%5D=${idElement.value}`;
        }
        currentWindow.querySelector('.q_id_eq').appendChild(idSearchButton);
        log('Страница модифицирована')
    }
    // на странице редактирования курса
    if (currentWindow.checkPath(pagePatterns.coursesEdit) ||
        currentWindow.checkPath(pagePatterns.miniGroupsEdit)
    ) {
        const elements = {
            async: currentWindow.querySelector('#course_asynchronous'),
            teachers: currentWindow.querySelector('#course_merged_teacher_ids'),
            tags: currentWindow.querySelector('#course_tag_ids'),
            purchaseMode: currentWindow.querySelector('#course_purchase_mode'),
            published: currentWindow.querySelector('#course_published'),
            visibleInList: currentWindow.querySelector('#course_visible_in_list'),
            installment: currentWindow.querySelector('#course_installment_enabled'),
            maternityCapital: currentWindow.querySelector('#course_maternity_capital'),
            fullName: currentWindow.querySelector('#course_full_name'),
            name: currentWindow.querySelector('#course_name'),
            subtitle: currentWindow.querySelector('#course_subtitle'),
            visibleInCalendar: currentWindow.querySelector('#course_visible_in_calendar')
        };
        if (elements.async) elements.async.onchange = checkAsynchronousCourse;
        [elements.teachers, elements.published].forEach(element => {
            if (element) element.onchange = () => { checkAsynchronousCourse(); checkCanceledCourse(); }
        });
        [
            elements.purchaseMode, elements.visibleInList, elements.installment,
            elements.maternityCapital, elements.visibleInCalendar, elements.tags
        ].forEach(element => { if (element) element.onchange = checkCanceledCourse; });

        const warningTexts = {
            asyncNoLive: 'В неасинхронном курсе должны быть только живые преподаватели',
            cancelPurchashing: 'В отмененном курсе необходимо отключить приобретение',
            cancelPublished: 'Отмененный курс необходимо распубликовать',
            cancelInList: 'Отмененный курс необходимо убрать из каталога',
            cancelInstallments: 'Необходимо отключить оплату по частям в отмененном курсе',
            cancelMaternityCapital: 'Необходимо отключить оплату маткапиталом в отмененном курсе',
            cancelVisibleInCalendar: 'Необходимо отключить отображение в календаре отмененного курса',
            cancelNames: 'В названиях курса необходимо указать, что курс отменен',
            cancelTags: 'В тегах курса не должно быть тегов',
        };
        const teacherWarnings = {
            saveReminder: createWarningElement('Не забудьте сохранить изменения :)'),
        };
        if (elements.teachers) {
            teacherWarnings.cancelTeacher = createWarningElement(
                'В отмененном курсе преподавателем не может быть других преподавателей, кроме Галины Отменной'
            );
        }
        else {
            teacherWarnings.cancelTeacher = createWarningElement(
                'В отмененном курсе не может быть других тегов, кроме Отменённая МГ'
            );
        }
        const warnings = {};
        for (let key in warningTexts) {
            teacherWarnings[key] = createWarningElement(warningTexts[key]);
            warnings[key] = createWarningElement(warningTexts[key]);
        }
        for (let key in teacherWarnings) {
            if (elements.teachers) elements.teachers.parentNode.append(teacherWarnings[key]);
            else elements.tags.parentNode.append(teacherWarnings[key]);
        }
        if (elements.async) elements.async.parentNode.after(warnings.asyncNoLive);
        elements.purchaseMode.after(warnings.cancelPurchashing);
        elements.published.parentNode.after(warnings.cancelPublished);
        elements.visibleInList.parentNode.after(warnings.cancelInList);
        elements.installment.parentNode.after(warnings.cancelInstallments);
        elements.maternityCapital.parentNode.after(warnings.cancelMaternityCapital);
        elements.visibleInCalendar.parentNode.after(warnings.cancelVisibleInCalendar);
        elements.fullName.after(warnings.cancelNames);
        elements.tags.after(warnings.cancelTags);

        function checkAsynchronousCourse() {
            if (!elements.async.checked && elements.published.checked) {
                let noLiveTeachersInCourse = elements.teachers.value.split(',').filter(x => {
                    for (let i of NO_LIVE_TEACHER_IDS) {
                        if (x == i) return true;
                    }
                    return false;
                });
                if (noLiveTeachersInCourse.length) {
                    // Преподаватель должен быть живой, так как курс асинхронный
                    teacherWarnings.asyncNoLive.hidden = false; warnings.asyncNoLive.hidden = false;
                }
                else { teacherWarnings.asyncNoLive.hidden = true; warnings.asyncNoLive.hidden = true; }
            }
            else { teacherWarnings.asyncNoLive.hidden = true; warnings.asyncNoLive.hidden = true; }
        }
        if (elements.teachers) checkAsynchronousCourse();
        const cancelButtonOnClick = () => {
            if (elements.teachers) {
                elements.teachers.value = CANCEL_GALINA_ID;
                elements.tags.value = '';
            }
            else elements.tags.value = CANCEL_MG_TAG_ID;
            elements.purchaseMode.value = 'disabled';
            let x = currentWindow.querySelector('#s2id_course_purchase_mode').firstChild.childNodes[1];
            x.innerHTML = x.innerHTML.replace('Включено', 'Отключено');
            elements.published.checked = false;
            elements.visibleInList.checked = false;
            elements.installment.checked = false;
            elements.maternityCapital.checked = false;
            elements.visibleInCalendar.checked = false;
            let a = currentWindow.querySelectorAll(
                '#s2id_course_merged_teacher_ids .select2-search-choice.ui-sortable-handle'
            );
            for (let el of a) {
                if (el.outerHTML && el.innerHTML.match(/Отменная Г./)) { }
                else { el.hidden = true; }
            }
            teacherWarnings.saveReminder.hidden = false;
            if (elements.name.value.search('Отмен') == -1 && elements.name.value.search('НЕАКТУАЛЬН') == -1) {
                elements.name.value = 'Отмененный курс. ' + elements.name.value;
                elements.name.value = elements.name.value.substring(0, 35);
            }
            if (elements.fullName.value.search('Отмен') == -1 && elements.name.value.search('НЕАКТУАЛЬН') == -1) {
                elements.fullName.value = 'Отмененный курс. ' + elements.fullName.value;
                elements.fullName.value = elements.fullName.value.substring(0, 512);
            }
            if (elements.subtitle.value.search('Отмен') == -1 && elements.name.value.search('НЕАКТУАЛЬН') == -1) {
                elements.subtitle.value = 'Отмененный курс. ' + elements.subtitle.value;
                elements.subtitle.value = elements.subtitle.value.substring(0, 57);
            }
            if (elements.teachers) checkAsynchronousCourse();
            checkCanceledCourse();
        }
        let cancelCourseButton = createButton('Доотменить', cancelButtonOnClick, 'btn-default', false);
        cancelCourseButton.style = 'display:none';
        if (elements.teachers) elements.teachers.parentNode.append(cancelCourseButton);
        else elements.tags.parentNode.append(cancelCourseButton);
        function checkCanceledCourse() {
            let isCanceled = false;
            let manyItems = false;
            if (elements.teachers) {
                let teachersList = elements.teachers.value.split(',');
                let cancelTeachersList = teachersList.filter(x => {
                    if (x == CANCEL_GALINA_ID) return true;
                    return false;
                });
                isCanceled = cancelTeachersList.length > 0;
                manyItems = teachersList.length > 1;
            }
            else {
                let tagsList = Array.from(elements.tags.selectedOptions).map(x => x.value);
                let cancelTagsList = tagsList.filter(x => {
                    if (x == CANCEL_MG_TAG_ID) return true;
                    return false;
                });
                isCanceled = cancelTagsList.length > 0;
                manyItems = tagsList.length > 1;
            }
            if (isCanceled) { // Галя, у нас отмена
                let hasProblems = false;
                // есть другие преподаватели кроме Галины
                if (manyItems) { teacherWarnings.cancelTeacher.hidden = false; hasProblems = true; }
                else { teacherWarnings.cancelTeacher.hidden = true; }
                // проставлены теги
                if (elements.teachers && elements.tags.selectedOptions.length > 0) {
                    teacherWarnings.cancelTags.hidden = false;
                    warnings.cancelTags.hidden = false;
                    hasProblems = true;
                }
                else { teacherWarnings.cancelTags.hidden = true; warnings.cancelTags.hidden = true; }
                // включено приобретение
                if (elements.purchaseMode.value != 'disabled') {
                    teacherWarnings.cancelPurchashing.hidden = false;
                    warnings.cancelPurchashing.hidden = false;
                    hasProblems = true;
                }
                else { teacherWarnings.cancelPurchashing.hidden = true; warnings.cancelPurchashing.hidden = true }
                // опубликован
                if (elements.published.checked) {
                    teacherWarnings.cancelPublished.hidden = false;
                    warnings.cancelPublished.hidden = false;
                    hasProblems = true;
                }
                else { teacherWarnings.cancelPublished.hidden = true; warnings.cancelPublished.hidden = true }
                // в каталоге
                if (elements.visibleInList.checked) {
                    teacherWarnings.cancelInList.hidden = false;
                    warnings.cancelInList.hidden = false;
                    hasProblems = true;
                }
                else { teacherWarnings.cancelInList.hidden = true; warnings.cancelInList.hidden = true }
                // оплата по частям
                if (elements.installment.checked) {
                    teacherWarnings.cancelInstallments.hidden = false;
                    warnings.cancelInstallments.hidden = false;
                    hasProblems = true;
                }
                else { teacherWarnings.cancelInstallments.hidden = true; warnings.cancelInstallments.hidden = true }
                // оплата маткапиталом
                if (elements.maternityCapital.checked) {
                    teacherWarnings.cancelMaternityCapital.hidden = false;
                    warnings.cancelMaternityCapital.hidden = false;
                    hasProblems = true;
                }
                else {
                    teacherWarnings.cancelMaternityCapital.hidden = true;
                    warnings.cancelMaternityCapital.hidden = true;
                }
                // в календаре
                if (elements.visibleInCalendar.checked) {
                    teacherWarnings.cancelVisibleInCalendar.hidden = false;
                    warnings.cancelVisibleInCalendar.hidden = false;
                    hasProblems = true;
                }
                else {
                    teacherWarnings.cancelVisibleInCalendar.hidden = true;
                    warnings.cancelVisibleInCalendar.hidden = true;
                }
                // имя без отмен
                if ((elements.name.value.search('Отмен') == -1 && elements.name.value.search('НЕАКТУАЛЬН') == -1) ||
                    (
                        elements.fullName.value.search('Отмен') == -1 &&
                        elements.fullName.value.search('НЕАКТУАЛЬН') == -1
                    )
                ) {
                    teacherWarnings.cancelNames.hidden = false;
                    warnings.cancelNames.hidden = false;
                    hasProblems = true;
                }
                else { teacherWarnings.cancelNames.hidden = true; warnings.cancelNames.hidden = true; }
                // хотя бы 1 не как надо
                if (hasProblems) { cancelCourseButton.style = ''; }
                else { cancelCourseButton.style = 'display:none'; }
            }
            else {
                teacherWarnings.cancelTeacher.hidden = true; teacherWarnings.cancelPurchashing.hidden = true;
                warnings.cancelPurchashing.hidden = true;
                teacherWarnings.cancelPublished.hidden = true; warnings.cancelPublished.hidden = true;
                teacherWarnings.cancelInList.hidden = true; warnings.cancelInList.hidden = true;
                teacherWarnings.cancelInstallments.hidden = true; warnings.cancelInstallments.hidden = true;
                teacherWarnings.cancelMaternityCapital.hidden = true; warnings.cancelMaternityCapital.hidden = true;
                teacherWarnings.cancelVisibleInCalendar.hidden = true; warnings.cancelVisibleInCalendar.hidden = true;
                teacherWarnings.cancelNames.hidden = true; warnings.cancelNames.hidden = true;
                cancelCourseButton.style = 'display:none';
            }
        }
        checkCanceledCourse();
        let buttonArea = createElement('div');
        let copyLandingButton = createButton(
            'Скопировать данные для лендинга из другого курса (кроме цен)', async () => { }
        );
        copyLandingButton.hidden = false;
        // по хорошему обновить эту функцию или убрать совсем
        copyLandingButton.onclick = async () => {
            try {
                let isConfirmed = true;
                let hasBotApproval = checkBotApprove();
                if (!hasBotApproval) {
                    isConfirmed = confirm(
                        'Внимание! Данные подставятся, но не будут сохранены автоматически. Проверьте правильность ' +
                        'переноса, а потом нажмите «Сохранить»\nПеренесутся названия, подзаголовок, описание, ' +
                        'экспресс-надпись, теги для каталога, адрес для редиректа, 3 буллита и 3 смысловых блока ' +
                        '(не сработает на тренажерных курсах и курсах Ф.Учителю)\nНЕ переносятся цены, галочки, FAQ ' +
                        'и PDF - программа'
                    );
                }
                if (!isConfirmed) { return }
                let originalCourseId = prompt('Введите ID курса, из которого нужно взять данные для лендинга');
                let secondaryWindow = await createWindow();
                await secondaryWindow.openPage(`/admin/courses/${originalCourseId}/edit`);
                await secondaryWindow.waitForElement('[name="course[landing_programs_attributes][2][body]"]');
                let textAttributesList = ['course_name', 'course_subtitle', 'course_full_name', 'course_description',
                    'course_promo_label', 'course_catalog_tag_ids',
                    'course_landing_url', 'course_timing_title', 'course_timing_description',
                    'course_landing_programs_attributes_0_title',
                    'course_landing_programs_attributes_1_title', 'course_landing_programs_attributes_2_title',
                    'course_landing_programs_attributes_0_body', 'course_landing_programs_attributes_1_body',
                    'course_landing_programs_attributes_2_body', 'course_landing_features_attributes_0_title',
                    'course_landing_features_attributes_1_title', 'course_landing_features_attributes_2_title',
                    'course_landing_features_attributes_0_body', 'course_landing_features_attributes_1_body',
                    'course_landing_features_attributes_2_body'];
                for (let attr of textAttributesList) {
                    currentWindow.querySelector(`#${attr}`).value = secondaryWindow.querySelector(`#${attr}`).value
                }
                await secondaryWindow.close();
                displayLog('Готово! Не забывайте сохранить изменения)');
            }
            catch (err) { displayError(err); }
        }
        buttonArea.appendChild(copyLandingButton);
        let titleArea = currentWindow.querySelector('.courses');
        titleArea.insertBefore(buttonArea, titleArea.childNodes[1]);
        log('Страница модифицирована');
    }
    // на странице создания курса
    if (currentWindow.checkPath(pagePatterns.coursesNew) ||
        currentWindow.checkPath(pagePatterns.miniGroupsNew)
    ) {
        let mainDiv = createElement('div', 'form-group boolean optional create-course-tm-options');
        let col12Div = createElement('div', 'col-sm-12');
        let checkboxDiv = createElement('div', 'checkbox');
        let labelElement = createElement('label');
        let checkboxInput = createElement('input');
        let checkboxSpan = createElement('span');
        let helpBlock = createElement('div', 'help-block', 'display:none;');
        checkboxInput.type = 'checkbox';
        checkboxSpan.innerHTML = 'Создать несколько одинаковых курсов';
        helpBlock.innerHTML =
            'Чтобы создать несколько одинаковых курсов, нажимай на «Создать курс» с зажатой клавишей Cmd(Mac) / ' +
            'Ctrl(Win) нужное количество раз. Форма выше не очистится, в нее можно будет внести правки и затем ' +
            'создать еще несколько курсов таким же способом';
        mainDiv.appendChild(col12Div);
        col12Div.appendChild(checkboxDiv);
        checkboxDiv.appendChild(labelElement);
        labelElement.appendChild(checkboxInput);
        labelElement.appendChild(checkboxSpan);
        col12Div.appendChild(helpBlock);
        let saveButtons = document.querySelectorAll('[data-disable-with]');
        checkboxInput.addEventListener('change', async () => {
            if (checkboxInput.checked) {
                helpBlock.style = '';
                for (let saveButton of saveButtons) saveButton.removeAttribute('data-disable-with');
            }
            else {
                helpBlock.style = 'display:none;';
                for (let saveButton of saveButtons) saveButton.setAttribute('data-disable-with', 'Курс создается');
            }
        });
        let formActionArea = currentWindow.querySelector('.form_actions');
        formActionArea.parentNode.insertBefore(mainDiv, formActionArea);
        log('Страница модифицирована');
    }

    // на странице с программой
    if (currentWindow.checkPath(pagePatterns.lessons)) {
        let lessonTasksLinks = currentWindow.querySelectorAll('[href$="lesson_tasks"]');
        for (let tasksLink of lessonTasksLinks) {
            // добавляем к ссылке пустой поиск, чтобы всегда было побольше задач в выдаче
            tasksLink.href += '?q%5Bdisciplines_id_in%5D='
        }
        let status = createElement('div', 'my-status', 'display:none;');
        status.innerHTML = 'not-finished'; // статус выполнения функций для бота
        let div = createElement('div');
        let lessonIntervalForm = createElement('form');
        lessonIntervalForm.appendChild(status);
        let selectFirstLesson = createFormElement(
            lessonIntervalForm, 'select', 'Массовые правки вносятся с ', 'tm_from_lesson', '', false
        );
        let selectLastLesson = createFormElement(lessonIntervalForm, 'select', ' по ', 'tm_last_lesson', '', false);
        selectFirstLesson.style = 'margin:5pt; max-width:150px; display: inline;';
        selectLastLesson.style = 'margin:5pt; max-width:150px; display: inline;';
        selectFirstLesson.onchange = async () => { currentWindow.firstLessonNumber = Number(selectFirstLesson.value); };
        selectLastLesson.onchange = async () => { currentWindow.lastLessonNumber = Number(selectLastLesson.value); };
        let spn = createElement('span');
        spn.innerHTML = '(включительно)';
        lessonIntervalForm.appendChild(spn);
        let lessonNumbersList = Array.from(currentWindow.querySelectorAll('.lessons-list .lesson')).map(
            lesson => {
                let lessonTitle = lesson.querySelector('.panel-title').innerHTML;
                let backspaceSecondIndex = lessonTitle.indexOf(' ', lessonTitle.indexOf(' ') + 1);
                return lessonTitle.substring(0, backspaceSecondIndex)
            }
        );
        for (let lessonNumberIndex = 0; lessonNumberIndex < lessonNumbersList.length; lessonNumberIndex++) {
            let optionFirst = createElement('option'); let optionLast = createElement('option');
            optionFirst.value = lessonNumberIndex; optionFirst.innerHTML = lessonNumbersList[lessonNumberIndex];
            selectFirstLesson.appendChild(optionFirst);
            optionLast.value = lessonNumberIndex; optionLast.innerHTML = lessonNumbersList[lessonNumberIndex];
            selectLastLesson.appendChild(optionLast);
            const lessonDescription =
                currentWindow.querySelectorAll('.lessons-list .lesson')[lessonNumberIndex].querySelector('textarea');
            // убираем по одной кавычке из описания с каждого края --- защита от гугл-таблиц
            lessonDescription.onchange = selfi => {
                let self = selfi.currentTarget;
                if (self.value[0] == '"') self.value = self.value.substring(1, self.value.length);
                if (self.value[self.value.length - 1] == '"') {
                    self.value = self.value.substring(0, self.value.length - 1)
                }
            }
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
                isConfirmed = confirm(
                    'Галочка «Без вебинара» будет проставлена на выбранных занятиях, если есть возможность её поставить'
                );
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
                            let lessonNumAndId =
                                lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
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
                            let lessonNumAndId =
                                lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
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
                        let deadlineCheckbox = lessonElement.querySelector('[name="lesson[tasks_deadline]"]');
                        if (deadlineCheckbox !== null && deadlineCheckbox.value) {
                            deadlineCheckbox.value = '';
                            let saveButton = lessonElement.querySelector('.btn-success');
                            saveButton.style = '';
                            saveButton.click();
                            let lessonNumAndId =
                                lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
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
            if (!hasBotApproval) {
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
                                let taskCheckbox =
                                    lessonElement.querySelector('[name="lesson[task_expected]"][type="checkbox"]');
                                if (taskCheckbox !== null && taskCheckbox.checked) {
                                    taskCheckbox.checked = '';
                                    hasChanges = true;
                                }
                            }
                            if (conspectRedElenent !== null) {
                                let conspectCheckbox =
                                    lessonElement.querySelector('[name="lesson[conspect_expected]"][type="checkbox"]');
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
                            let lessonNumAndId =
                                lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
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
            if (!hasBotApproval) {
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
                                let taskCheckbox =
                                    lessonElement.querySelector('[name="lesson[task_expected]"][type="checkbox"]');
                                if (taskCheckbox !== null && !taskCheckbox.checked) {
                                    taskCheckbox.checked = true;
                                    hasChanges = true;
                                }
                            }
                            if (conspectGreenElenent !== null) {
                                let conspectCheckbox =
                                    lessonElement.querySelector('[name="lesson[conspect_expected]"][type="checkbox"]');
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
                            let lessonNumAndId =
                                lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
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
                isReadWarning = confirm(
                    'Внимание! Занятия в выбранном диапазоне будут удалены невозвратно\n' +
                    'Если вы указали все уроки, то после удаления курс будет автоматически распубликован'
                );
                if (isReadWarning) {
                    isConfirmed = confirm(
                        'Для работы скрипта будет временно открыта новая вкладка\n' +
                        'Рекомендуется заранее перенести все удаляемые занятия в конец курса\n' +
                        'Занятия должны стоять будущей датой чтобы админка могла их удалить'
                    );
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
                    await currentWindow.reload();
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
                    let freeCheckbox = lessonElement.querySelector('[name="lesson[free]"][type="checkbox"]');
                    if (freeCheckbox) {
                        freeCheckbox.checked = true;
                        let saveButton = lessonElement.querySelector('.btn-success');
                        saveButton.style = '';
                        saveButton.click();
                        let d = lessonElement.querySelector('.panel-title').innerHTML.match(/\b\d+\b/g);
                        log(d[1] + ' ' + d[d.length - 1]);
                        await currentWindow.waitForElement(`#${lessonElement.id} .btn-success:not([style=""])`);
                    }
                };
                log('Завершено проставление галок «Бесплатный»');
            }
            let x = document.querySelector('.course-settings').parentNode;
            x.insertBefore(div, x.childNodes[2]);
        }
        makePaidButton.onclick = async () => {
            let todo = confirm('Галочка «Бесплатный» будет снята на выбранных занятиях');
            if (todo) {
                let sleeptime;
                if (-currentWindow.firstLessonNumber + currentWindow.lastLessonNumber < 150) { sleeptime = 100; }
                else { sleeptime = parseInt(prompt('Укажите время задержки между сохранениями в милисекундах', 100)); }
                async function free() {
                    log('Запущено удаление галок «Бесплатный»');
                    log('Подготовка');
                    let a = document.getElementsByName('lesson[free]');
                    for (let i = 1; i <= a.length / 2 - 1; i += 1) {
                        a[2 * i + 1].className += ' lesson_free_checkbox';
                    }
                    let b = document.querySelectorAll('[id^="edit_lesson_"]');
                    for (let num = currentWindow.firstLessonNumber; num <= currentWindow.lastLessonNumber; num++) {
                        let i = b[num];
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
            adminkaFeatures.hidden = true; contentFeatures.hidden = true;
            let inp = createFileInput('text/csv');
            let btn = createButton('Готово');
            btn.onclick = async function () {
                let todo = true;
                let hasBotApproval = checkBotApprove();
                if (!hasBotApproval) {
                    todo = confirm(
                        'Названия и описания выбранных занятий будут заменены на новые, старые названия будут ' +
                        'утеряны безвозвратно'
                    );
                }
                if (!todo) { return }
                let reader = new FileReader();
                reader.onload = async function () {
                    let allRows = CSVToArray(reader.result);
                    let k = currentWindow.firstLessonNumber;
                    let n = currentWindow.lastLessonNumber;
                    let lessonRows = currentWindow.querySelectorAll('.row.lesson');
                    let lessons = Array.from(lessonRows).slice(1);
                    let z = -1;
                    for (var singleRow = 0; singleRow < Math.min(allRows.length, n - k + 1); singleRow++) {
                        let i = singleRow + k;
                        let rowCells = allRows[singleRow];
                        for (var rowCell = 0; rowCell < rowCells.length; rowCell++) {
                            if (rowCell == 0 && rowCells[rowCell]) {
                                currentWindow.querySelectorAll('[name="lesson[name]"]')[i + 1].value =
                                    rowCells[rowCell];
                            }
                            if (rowCell == 1 && rowCells[rowCell]) {
                                currentWindow.querySelectorAll('[name="lesson[themes_as_text]"]')[i + 1].value =
                                    rowCells[rowCell];
                            }
                            if (rowCell == 2 && rowCells[rowCell]) {
                                try {
                                    currentWindow.querySelectorAll('[name="lesson[name]"]')[i + 1]
                                        .parentNode.parentNode.parentNode.parentNode
                                        .querySelectorAll('[name="lesson[video_url]"]')[0].value = rowCells[rowCell];
                                }
                                catch (e) {
                                }
                            }
                        }
                        if (lessons[i].innerHTML.match(/Нулевое/)) { z = i }
                        else {
                            currentWindow.querySelectorAll('.btn-success')[i + 3].style = '';
                            currentWindow.querySelectorAll('.btn-success')[i + 3].click();
                        }
                        log(i + 1);
                        await sleep(100);
                    }
                    if (z != -1) {
                        currentWindow.querySelectorAll('.btn-success')[z + 3].style = '';
                        currentWindow.querySelectorAll('.btn-success')[z + 3].click();
                    }
                    displayLog('Готово');
                };
                reader.onerror = function () {
                    displayError(reader.error);
                };
                reader.readAsText(inp.files[0])

            }
            div.appendChild(inp); div.appendChild(btn);
        }
        div.appendChild(lessonIntervalForm); div.appendChild(adminkaFeatures); div.appendChild(contentFeatures);
        adminkaFeatures.appendChild(lessonsFromCsvButton); adminkaFeatures.appendChild(checkNoWebinarButton);
        adminkaFeatures.appendChild(uncheckNoWebinarButton); adminkaFeatures.appendChild(clearDeadlineButton);
        contentFeatures.appendChild(clearExtraTicksButton); contentFeatures.appendChild(checkMissTicksButton);
        adminkaFeatures.appendChild(deleteLessonsButton); adminkaFeatures.appendChild(makeFreeButton);
        adminkaFeatures.appendChild(makePaidButton);
        let x;
        try {
            x = document.getElementsByClassName('course-settings')[0].parentNode;
        }
        catch {
            x = document.getElementsByClassName('lesson_course_id')[0].parentNode.parentNode;
        }
        x.insertBefore(div, x.childNodes[2]);
        if (currentWindow.checkPath(/#csv/)) {
            document.querySelector('.csv-btn').classList.add('bot-approve');
            btn_show_onclick();
            btn_csv_onclick();
        }
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
                let date = prompt(
                    "Введите дату, которую нужно проставить у всех безвебинарных занятий:",
                    `${today.getDate() - 1}.${today.getMonth() + 1}.${today.getFullYear()} ${today.getHours()}:00'`
                );
                //log(1);
                let sleeptime = parseInt(prompt(
                    'Укажите время задержки между нажатиями на кнопки в милисекундах\nПри слишком маленькой ' +
                    'задержке данные могут не успеть сохраниться',
                    300
                ));
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
    // на странице с домашними заданиями урока
    if (currentWindow.checkPath(pagePatterns.lessonTasks)) {
        let removeButton = createButton('Отвязать все задачи', async () => { }, 'remove-all-tasks btn-danger');
        let toolbar = currentWindow.querySelector('.lesson_tasks_page .toolbar')
        toolbar.appendChild(removeButton);
        let taskRows = currentWindow.querySelectorAll('.task_first .task_table tbody tr');
        removeButton.onclick = async () => {
            let tempWindow = await createWindow('adminka-hw-tmp');
            for (let num = taskRows.length - 1; num >= 0; num--) {
                // обратный порядок, чтобы сначала удалились необязательные задачи, потом обязательные, иначе ошибка
                log(num + 1);
                let taskRow = taskRows[num];
                let deleteButton = taskRow.querySelector('[data-method="delete"]');
                deleteButton.removeAttribute('data-confirm');
                deleteButton.target = 'adminka-hw-tmp';
                deleteButton.click();
                await tempWindow.waitForSuccess();
                await tempWindow.openPage('about:blank');
            }
            await tempWindow.close();
            await currentWindow.reload();
        };
        if (taskRows.length == 0) {
            removeButton.disabled = true;
        }
    }

    // на странице с расписанием
    if (currentWindow.checkPath(pagePatterns.groups) && true) {
        group_template_id.classList.add('protected');

        // Автоматическая простановка преподавателя для МГ и тренажерных курсов
        let courseTypeId = course_data.dataset.courseTypeId;
        if (['5', '6'].includes(courseTypeId)) {
            let newTemplateTeacher = currentWindow.querySelector('.new_group_template #group_template_teacher_id');
            newTemplateTeacher.value = courseTypeId == '5' ? MINI_GROUPS_TEACHER_ID : TRAINING_COURSE_TEACHER_ID;
            newTemplateTeacher.style = 'cursor: not-allowed;';
            newTemplateTeacher.previousElementSibling.style = 'display: none;';
            newTemplateTeacher.dispatchEvent(new Event('change'));
            newTemplateTeacher.setAttribute('readonly', 'true');
        }

        // Подготовка страницы
        currentWindow.querySelector('[data-target="#new_group_template"]')
            .classList.replace('btn-default', 'btn-success');
        let lessonRows = Array.from(currentWindow.querySelectorAll('.groups_list .panel[id^="group_"]'));
        for (let lessonRow of lessonRows) {
            lessonRow.classList.add('lesson_row');
            let headingRow = lessonRow.querySelector('.panel-heading');
            let lessonNumberElem = headingRow.querySelector('.lesson_number');
            let lessonHref = lessonNumberElem.querySelector('a').href;
            let lessonId = lessonHref.slice(lessonHref.search('=') + 1);
            let lessonTypeSpan = headingRow.querySelector('span');
            lessonTypeSpan.classList.add('lesson_type');
            let lessonTypeText = lessonTypeSpan.textContent.trim();
            let lessonType = LESSON_TYPE_MAP[lessonTypeText];
            if (lessonType) lessonRow.classList.add(lessonType);
            else log(`Неизвестный тип урока: ${lessonTypeText}`);
            let lessonIdSpan = createElement('span', 'label label-default');
            lessonIdSpan.innerHTML = `id: ${lessonId}`;
            lessonTypeSpan.after(createElement('br'), lessonIdSpan);
            let actionButtons = lessonRow.querySelector('.actions_btn');
            let lessonHeader = actionButtons.closest('.form-group');
            lessonHeader.classList.add('lesson_header');
            let webinarNameElement = lessonHeader.querySelector('label');
            let webinarName = webinarNameElement.textContent.trim();
            if (webinarName.includes('копия')) lessonRow.classList.add('copy');
            else lessonRow.classList.add('original');
            let webinarButton = lessonHeader.querySelector('.actions_btn>a');
            let webinarLabel = webinarButton.textContent.trim();
            if (webinarButton.classList.contains('disabled') && webinarLabel == 'Без вебинара') {
                lessonRow.classList.add('no_webinar');
            }
            else {
                lessonRow.classList.add('has_webinar');
                let statusButton = actionButtons.querySelector(
                    '.actions_btn .btn-group:last-child .dropdown-menu li:last-of-type a'
                );
                statusButton.classList.add('status_btn');
                let statusLabel = statusButton.textContent.trim();
                let webinarStatus = statusLabel.split(': ')[1];
                lessonRow.classList.add(webinarStatus);
            }
            if (lessonRow.querySelector('[id^="starts_at_"]')) {
                lessonRow.classList.add('has_starts_at');
            }
            else {
                lessonRow.classList.add('no_starts_at');
            }
        }
        let adminButtons = createElement('div', 'adminButtons');
        let groupsPage = currentWindow.querySelector('.groups_page');
        groupsPage.prepend(adminButtons);

        // Кнопка «↑ Перестроить ↑»
        async function rebuildUpButtonOnClick() {
            rebuildUpButton.style = 'display:none';
            let hasFutureLesson = false;
            let nextLessonDate = '01.01.1990';
            let nextLessonNumber = 0;
            for (let lessonRow of lessonRows) {
                if (lessonRow.classList.contains('no_starts_at') &&
                    !lessonRow.classList.contains('started') &&
                    !lessonRow.classList.contains('ready_to_start')
                ) {
                    lessonRow.hidden = true;
                }
                else if (lessonRow.classList.contains('created') && hasFutureLesson == false) {
                    hasFutureLesson = true;
                    let startsAtValue = lessonRow.querySelector('[id^="starts_at_"]').value;
                    nextLessonDate = startsAtValue.split(' ')[0];
                    let lessonNumberText = lessonRow.querySelector('.lesson_number a[href]').innerHTML;
                    nextLessonNumber = lessonNumberText.match(/\d+/)[0];
                }
            }
            let groupsList = currentWindow.querySelector('.groups_list');
            groupsList.before(groupsList.nextSibling);
            currentWindow.querySelector('#from_lesson_number').value = nextLessonNumber;
            currentWindow.querySelector('[id^=start_from_date_]').value = nextLessonDate;
            if (currentWindow.querySelector('.bot-approve')) {
                while (!currentWindow.querySelector('.rasp_checked')) { await sleep(100); }
                if (!currentWindow.querySelector('.alert-no-rasp-groups')) {
                    currentWindow.querySelector('.btn.btn-primary[value="Перестроить"]').click();
                }
            }
            log('Прошедшие занятия скрыты, данные для перестроения параллели перенесены вверх страницы');
        }
        let rebuildUpButton = createButton('↑ Перестроить ↑', rebuildUpButtonOnClick, 'reset-btn');
        adminButtons.appendChild(rebuildUpButton);
        if (currentWindow.checkPath(/#reset_schedule/)) {
            rebuildUpButton.classList.add('bot-approve');
            rebuildUpButton.click();
        }

        // Проверка, что все занятия по расписанию от @wanna_get_out
        let checkGroupsOnSchedule = async function () {

            // Возвращает список дней недели
            function getWeekdays() {
                const blocks = [];
                const times = [];
                for (let i = 0; i < 7; i++) {
                    let element = currentWindow.querySelector
                        (`#group_template_week_days_attributes_${i}_slot_week_day option[selected]`);
                    let timeElement = currentWindow.querySelector
                        (`#edit_group_template #group_template_week_days_attributes_${i}_slot_time`);
                    if (element) blocks.push(Number(element.value));
                    if (timeElement) times.push(timeElement.value.split(':'));
                }
                return [blocks, times]
            }

            // Список с датами уроков по расписанию
            function trueLesssonDates() {
                const days = [];
                const startDateElement = currentWindow.querySelector('#edit_group_template [id*="starts_at_date"]');
                const startDate = new Date(startDateElement.value.split('.').reverse());
                const [weekdays, weekdayTimes] = getWeekdays();

                // Создаем копиию начальной даты, чтобы не изменять исходную
                let date = new Date(startDate);
                date.setHours(weekdayTimes[0][0], weekdayTimes[0][1], 0, 0);

                let startsAtElements = lessonRows.map(x => x.querySelector('[id*="starts_at_"]')).filter(Boolean);
                let maxDate = new Date(
                    Math.max(...startsAtElements.map(el => new Date(el.value.split(' ')[0].split('.').reverse())))
                );
                maxDate.setHours(23, 59, 59, 999);
                while (date <= maxDate) {
                    for (let i = 0; i < weekdays.length; i++) {
                        // Если день недели есть в списке дней недели и он i-ый
                        if (weekdays[i] == Number(date.getDay())) {
                            let tempDate = new Date(date);
                            tempDate.setHours(weekdayTimes[i][0], weekdayTimes[i][1], 0, 0)
                            days.push(Number(tempDate));
                        }
                    }
                    // Увеличиваем дату на один день
                    date.setDate(date.getDate() + 1);

                }
                return days;
            }
            let trueLessons = trueLesssonDates();

            // Получаем все уроки с лендинга
            let allLessonsStartDate = Array.from(currentWindow.querySelectorAll('[id*="starts_at_"]')).slice(2);
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
                    // Если не совпадает с расписанием (перенос, переназначение), красим родительский элемент 
                    // (родительского элемента родительского элемента...) в цвет
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
            const alerts = alertManager()
            if (lessonsCount) {
                alerts.addAlert(
                    `В данной параллели занятий не по расписанию: ${lessonsCount}`,
                    bgColorOdd,
                    'no-rasp-alert'
                );
            } else {
                alerts.removeAlert('no-rasp-alert');
            }
            currentWindow.body.firstChild.className += ' rasp_checked';
        }
        let saveButtons = currentWindow.querySelectorAll('.btn-default[value="Сохранить"]');
        for (let saveButton of saveButtons) saveButton.addEventListener('click', checkGroupsOnSchedule);
        checkGroupsOnSchedule();

        log('Страница модифицирована');
    //}
    //if (currentWindow.checkPath(pagePatterns.groups) && false) {
        let mcid = window.location.href.match(/\d+/)[0];
        let btn_return_moderators = document.createElement('button');
        btn_return_moderators.innerHTML = 'Вернуть модераторов'; btn_return_moderators.hidden = false;
        adminButtons.appendChild(btn_return_moderators);
        let btn_show = document.createElement('button');
        btn_show.innerHTML = 'Продвинутые возможности';
        let btn_hide = document.createElement('button'); btn_hide.hidden = true;
        btn_hide.innerHTML = 'Скрыть продвинутые возможности';
        let btn_masscopy = document.createElement('button'); btn_masscopy.hidden = true;
        btn_masscopy.innerHTML = 'Массовое копирование занятий из другого курса в этот курс';

        let btn_group_lessons;
        btn_show.onclick = function () {
            btn_show.hidden = true; btn_masscopy.hidden = false; btn_group_lessons.hidden = false;
            btn_hide.hidden = false;
        }
        btn_hide.onclick = function () {
            btn_show.hidden = false; btn_masscopy.hidden = true; btn_group_lessons.hidden = true;
            btn_hide.hidden = true;
        }
        btn_masscopy.onclick = function () {
            let cid = prompt(
                'Процесс будет запущен в отдельной вкладке, не закрывайте ее до завершения процесса\n' +
                'Будут скопированы все вебинарные занятия из другого курса в этот курс\n' +
                'Может потребоваться разрешение показывать сайту всплывающие окна\n' +
                'Введите ID курса из которого необходимо скопировать записи:'
            );
            if (parseInt(cid)) {
                btn_masscopy.disabled = true; btn_masscopy.style = 'color:gray';
                async function masscopygroups() {
                    let sleeptime = parseInt(prompt(
                        'Укажите время задержки между вводом данных в девсервис в милисекундах\n' +
                        'Важно, чтобы за это время страница дев-сервисов успевала прогрузиться',
                        6000
                    ));
                    log('В процессе переноса записей из курса ' + cid);
                    let win1 = window.open('about:blank', 'adminka_course_from');
                    let win2 = window.open('about:blank', 'adminka_dev_services');
                    win1.location.href = `/admin/courses/${cid}/groups`;
                    win2.location.href = '/admin/dev_services';
                    await sleep(10000);
                    let res0 = document.querySelectorAll('[id^="group_"][id$="_toolbar"]');
                    let res1 = win1.document.querySelectorAll('[id^="group_"][id$="_toolbar"]');
                    if (res0.length != res1.length && res0.length != res1.length + 1) {
                        log('Количество занятий в курсах отличается больше, чем на 1, перенос отменён');
                    }
                    else {
                        let skipgroup = null;
                        if (res0.length == res1.length + 1) {
                            skipgroup = parseInt(prompt(
                                'В курсе на 1 занятие больше, чем в исходном, укажите номер занятия, которое нужно ' +
                                'пропустить:'
                            ));
                        }
                        if (res0.length == res1.length + 1 &&
                            (skipgroup > res0.length || skipgroup == null || isNaN(skipgroup))
                        ) {
                            log('Занятия, которое нужно пропустить, не существует, перенос отменен');
                        }
                        else if (res0.length == res1.length || res0.length == res1.length + 1) {
                            log('Буду переносить');
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
                                    try { log(alert.innerHTML.replace(/<button(.*?)\/button>/, '')); }
                                    catch (e) { log(e); }
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

        let btn_group_lessons_onclick = async () => {
            let hasBotApproval = checkBotApprove();
            btn_group_lessons_onclick.style = 'display:none';
            let todoshka = true;
            if (!hasBotApproval) {
                todoshka = confirm(
                    'Можно использовать если\n - ВСЕ групповые встречи стоят после ближайшего занятия по ' +
                    'расписанию\n - на 20:00 ничего не стоит или стоят ТОЛЬКО прошлые групповые встречи\nСтраница ' +
                    'программы будет открыта в новой вкладке, не закрывайте ее заранее\nЕсли страница не ' +
                    'открываются, разрешите сайту работать со всплывающими окнами\nСкрипт НЕ работает, если первым ' +
                    'занятием стоит вводное или пробник на ту же ДАТУ, что и следующее занятие (можно поменять на ' +
                    'другую ДАТУ и сработает, время не учитывается)'
                );
            }
            if (todoshka) {
                let href = window.location.href;
                let win = window.open('about:blank', 'adminka_lessons');
                //win.blur(); window.focus();
                win.location.href = href.substring(0, href.search(/groups/) - 1) + '/lessons';
                while (!win.document.querySelectorAll('#lesson_name').length ||
                    Array.from(win.document.querySelectorAll('#lesson_name')).map(i => i.value)
                        .filter(i => i.search(/Группов/) != -1).length < 3
                ) { await sleep(500); }
                let all_lessons = Array.from(win.document.querySelectorAll('#lesson_name')).map(i => i.value);
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
                let b = Array.from(a).map(i => i.value);
                b = b.filter(x => !(x.includes('20:00')));
                let k = 0;
                let t = 0;
                for (let index = 0, len = a.length; index < len; ++index) {
                    let x = a[index].parentNode.parentNode.parentNode.getElementsByClassName('btn-default');
                    if (
                        a[index].parentNode.parentNode.parentNode.parentNode.parentNode.innerHTML
                            .search('Обычное') == -1 &&
                        index != 0
                    ) { k += 1 };
                    if (index == ind[0] - delta || index == ind[1] - delta || index == ind[2] - delta) {
                        k += 1;
                        t = 1;
                    }
                    while (index != 0 && b[index - k] == b[index - k - 1]) k -= 1
                    log(index + 1 + ' ' + b[index - k] + ' ' + t);
                    if (t == 0) a[index].value = b[index - k];
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
        btn_group_lessons = createButton(
            'Проставить групповые встречи', btn_group_lessons_onclick, 'set-group-lessons'
        );
        btn_group_lessons.hidden = true;
        let btn_dop_sam_lessons_onclick = async () => {
            function isValidTime(timeString) {
                const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
                return timeRegex.test(timeString);
            }
            let dopTime = prompt('Укажи время допзанятий в формате 13:00');
            if (!isValidTime(dopTime)) {
                log('Выполнение скрипта отменено, неверный формат времени');
                return;
            }
            let href = currentWindow.location.href;
            let tempWindow = await createWindow('adminka_lessons');
            await tempWindow.openPage(`${getBaseUrl(href)}/lessons`);
            let lessonElements = tempWindow.querySelectorAll('.lessons-list .lesson');
            let lessonNames = Array.from(lessonElements).map(i => i.querySelector('#lesson_name').value);
            let lessonWithoutVideo = Array.from(lessonElements).map(i => i.querySelector('#lesson_video_url') == null);
            let dopLessonNames = lessonNames.filter(i =>
                i.search(/📝Дополнительный разбор/) != -1 || i.search(/📝 Дополнительный разбор/) != -1 ||
                i.search(/✒️Аудиодиктант/) != -1 || i.search(/✒️ Аудиодиктант/) != -1
            );
            let dopLessonInd = dopLessonNames.map(i => lessonNames.indexOf(i));
            let noVideoInd = [];
            lessonWithoutVideo.forEach((value, index) => {
                if (value === true) {
                    noVideoInd.push(index);
                }
            });
            await tempWindow.close();
            log(dopLessonInd);
            let startsAtElements = currentWindow.querySelectorAll('[name="group[starts_at]"]');
            let startsAtValues = [];
            for (let el of startsAtElements) {
                if (!startsAtValues.includes(el.value)) startsAtValues.push(el.value);
            }
            let k = 0;
            for (let i = 0; i < startsAtElements.length; i++) {
                if (dopLessonInd.includes(i)) {
                    k++;
                    startsAtElements[i].value = startsAtValues[i - k].replace(/\d\d:00$/, `${dopTime}`);
                }
                else if (noVideoInd.includes(i)) {
                    k++;
                    startsAtElements[i].value = startsAtValues[i - k];
                }
                else {
                    startsAtElements[i].value = startsAtValues[i - k];
                }
                let submitButton = startsAtElements[i].closest('.groups_list').querySelector('[type="submit"]');
                submitButton.click();
                await sleep(100);
            }
            displayLog('Выполнение скрипта завершено');
        }
        let btn_dop_sam_lessons = createButton(
            'Проставить доп. занятия (тариф Самостоятельный)', btn_dop_sam_lessons_onclick, 'set-dop-sam-lessons'
        );
        btn_dop_sam_lessons.hidden = true;
        adminButtons.appendChild(btn_show); adminButtons.appendChild(btn_masscopy); adminButtons.appendChild(btn_group_lessons);
        adminButtons.appendChild(btn_dop_sam_lessons); adminButtons.appendChild(btn_hide);
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
                fetch("/api/courses/" + mcid + "/landing")
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
                        b = [teacher.value].filter(x => {
                            for (let i of NO_LIVE_TEACHER_IDS) {
                                if (x == i) return true;
                            }
                            return false;
                        });
                    }
                    if (b.length) { no_live_groups.push(lid); }
                    if (location && location.value != SLAG_ID_SET[0] && !(location.hasAttribute('disabled'))) {
                        ne_shlak_groups.push(lid);
                    }
                }
                let template_teacher = document.querySelectorAll('#group_template_teacher_id')[1].value;
                let otmena_msg = '';
                if (template_teacher == CANCEL_GALINA_ID) {
                    otmena_msg = 'В настройках параллели указана Галина Отменная'
                }
                else if (otmena_groups.length) {
                    otmena_msg = 'В занятиях ' + join_short(otmena_groups) + ' указана Галина Отменная'
                }
                else if (course_info.teachers.length && course_info.teachers[0].alias_url == "otmennaya-galina") {
                    otmena_msg = 'Преподавателем курса указана Галина Отменная'
                }
                if (otmena_msg) {
                    let otmena_warning = [];
                    let has_easy_error = false;
                    let template_location = document.getElementsByName('group_template[default_location_id]')[0].value;
                    if (template_teacher != CANCEL_GALINA_ID) {
                        otmena_warning.push('в настройках параллели указать Галину Отменную');
                        has_easy_error = true;
                    }
                    if (template_location != SLAG_ID_SET[0]) {
                        otmena_warning.push('в настройках параллели проставить Шлак');
                        has_easy_error = true;
                    }
                    if (ne_otmena_groups.length) {
                        otmena_warning.push(`в занятиях ${join_short(ne_otmena_groups)} проставить Галину Отменную`);
                        has_easy_error = true;
                    }
                    if (ne_shlak_groups.length) {
                        otmena_warning.push('в занятиях ' + join_short(ne_shlak_groups) + ' проставить Шлак');
                        has_easy_error = true;
                    }
                    if (!document.querySelectorAll('tbody')[0].innerHTML.match(/Всего: 0/)) {
                        otmena_warning.push('перевести учеников на другие параллели или курсы');
                    }
                    if (otmena_warning.length) {
                        let alert = document.createElement('div');
                        alert.className = 'alert alert-info';
                        alert.style = 'margin-top:10pt;';
                        alert.innerHTML =
                            `${otmena_msg}<br>
                            Чтобы отменить параллель до конца, нужно<br>
                            — ${otmena_warning.join(',<br>— ')}<br>`;
                        document.querySelector('#course_data').before(alert);
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
                                    el.querySelector('[name="group[reservation_attributes][location_id]"]').value =
                                        SLAG_ID_SET[0];
                                    el.querySelector('[name="group[reservation_attributes][format_id]"]').value =
                                        SLAG_ID_SET[1];
                                    el.querySelector('[name="group[reservation_attributes][studio_id]"]').value =
                                        SLAG_ID_SET[2];
                                } catch (er) { console.log(er); }
                                let ar = el.querySelectorAll('.btn-default'); ar[ar.length - 1].click();
                                while (!el.querySelector('.alert-success')) { await sleep(100); }
                            }
                            document.querySelectorAll('#group_template_teacher_id')[1].value = CANCEL_GALINA_ID;
                            document.querySelector('[name="group_template[default_location_id]"]').value =
                                SLAG_ID_SET[0];
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
                        no_live_msg =
                            `В занятиях ${join_short(no_live_groups)} указан неживой преподаватель, 
                            хотя курс не является асинхронным<br>`;
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
                    let b = [template_teacher].filter(x => {
                        for (let i of NO_LIVE_TEACHER_IDS) {
                            if (x == i) return true;
                        }
                        return false;
                    });
                    if (b.length) {
                        no_live_msg =
                            'В настройках параллели указан неживой преподаватель, хотя курс не является асинхронным';
                        alert.innerHTML = no_live_msg;
                    }
                    if (no_live_msg) {
                        document.querySelector('#course_data').before(alert);
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

        function templateStartDateChecker() {

            function checkDates() {
                const templateStartsAtInput = [
                    ...currentWindow.querySelectorAll('input[name="group_template[starts_at]"]')
                ].pop();
                if (!templateStartsAtInput) return;
                const templateDate = templateStartsAtInput.value.trim();
                let foundElement = currentWindow.querySelector('.lesson_row.has_webinar.original');

                if (!foundElement) return;
                const lessonInput = foundElement.querySelector('input[name="group[starts_at]"]');
                if (!lessonInput) return;
                const lessonDate = lessonInput.value.trim();
                if (!templateDate || !lessonDate) return;

                const parse = str => {
                    const [d, m, y] = str.split(' ')[0].split('.').map(Number);
                    return new Date(y, m - 1, d);
                };
                const showWarning = parse(templateDate).getTime() !== parse(lessonDate).getTime();

                const alerts = alertManager()
                const msg = 'Дата старта параллели не совпадает с датой старта первого занятия'
                if (showWarning) {
                    alerts.addAlert(
                        `Дата старта параллели не совпадает с датой старта первого занятия`,
                        '#ffb6c4',
                        msg
                    );
                } else {
                    alerts.removeAlert('date-mismatch-warning');
                }
            }

            checkDates();
        }

        templateStartDateChecker();

        async function changeWebinarLocations() {
            const MINI_GROUP_BUTTONS = [
                { text: 'Мини-группы', location: 'mini', locationId: MINI_GROUPS_ID_SET },
                { text: 'Шлак', location: 'slag', locationId: SLAG_ID_SET },
            ];
            const WEBINAR_GROUP_BUTTONS = [
                { text: 'Шлак', location: 'slag', locationId: SLAG_ID_SET },
                { text: 'Дом', location: 'home', locationId: HOME_ID_SET },
                { text: 'ССМ', location: 'ssm', locationId: SSM_ID_SET }
            ];

            const container = currentWindow.querySelector('.adminButtons');
            const miniGroupFlag = Boolean(currentWindow.querySelector('input[name="group_template[agent_id]"]'));
            if (!miniGroupFlag) {
                initButtons(WEBINAR_GROUP_BUTTONS);
            }
            else if (!container) {
                displayLog('Контейнер для кнопок не найден', 'danger');
            } else {
                initButtons(MINI_GROUP_BUTTONS);
            }

            function initButtons(BUTTONS) {
                BUTTONS.forEach(config => {
                    const btn = createLocationButton(config);
                    container.append(btn);
                });
            }

            function createLocationButton({ text, location, locationId }) {
                const btn = createButton(text, async () => { })
                btn.dataset.location = location;
                btn.dataset.locationId = JSON.stringify(locationId);
                btn.addEventListener('click', handleButtonClick);
                return btn;
            }

            async function handleButtonClick({ target }) {
                const location = target.dataset.location;
                const locationId = JSON.parse(target.dataset.locationId);
                const groupTemplateId = getGroupTemplateId();

                if (!groupTemplateId) {
                    alert('Не удалось получить ID параллели!');
                    return;
                }

                const url = buildUrl(groupTemplateId, location);
                await openAndCloseWindow(url);
                await changeGroupTemplateLocations(location, locationId);
            }

            async function changeGroupTemplateLocations(location, locationId) {
                currentWindow.querySelector('[id^="location_selector_"][name="group_template[default_location_id]"]')
                    .value = locationId[0];
                currentWindow.querySelector('[id^="format_selector_"][name="group_template[default_format_id]"]')
                    .value = locationId[1];
                await sleep(1500);
                let groupwebinar = currentWindow.querySelector('select[name="group_template[default_studio_id]"]');
                groupwebinar.value = locationId[2];
                groupwebinar.closest('form').querySelector('[type="submit"]').click();
            }

            function getGroupTemplateId() {
                return currentWindow.group_template_id.value;
            }

            function buildUrl(groupTemplateId, location) {
                const baseUrl = '/admin/dev_services';
                const params = new URLSearchParams({
                    only_week_day_webinars_settings: true,
                    select_group_template: groupTemplateId,
                    location: location,
                    auto_validate: true
                });
                log(`${baseUrl}?${params}`);
                return `${baseUrl}?${params}`;
            }

            // Открытие новой вкладки
            async function openAndCloseWindow(url) {
                let win = await createWindow();
                await win.openPage(url);
                await win.waitForSuccess();
                if (!win.closed) win.close();
            }
        }
        changeWebinarLocations();

        //
        let set_all_duration_at_ = async function (x = 40) {
            let a = document.getElementsByClassName('groups_table')[0].getElementsByTagName('tr');
            let code =
                `<div class="form-group integer optional group_duration">
                    <label class="col-sm-3 control-label integer optional" for="group_duration">Длительность</label>
                    <div class="col-sm-9">
                        <input class="form-control numeric integer optional" type="number" step="1" value="${x}" 
                            name="group[duration]" id="group_duration">
                        <p class="help-block">мин.</p>
                    </div>
                </div>`
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
                if (selectElement.disabled) {
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

        if (window.location.href.match('#duration40')) { set_all_duration_at_(40); }
    }

    // на странице создания дубликата
    if (currentWindow.checkPath(pagePatterns.newDuplicates)) {
        let containerElement = createElement('div');
        let myButton = createButton('Подтянуть данные из курса', async () => { }, 'get-data');
        let warningElement = createElement('p', '', 'color:orange');
        const get_data_full = async () => {
            let isConfirmed = true;
            let hasBotApproval = checkBotApprove();
            if (!hasBotApproval) {
                isConfirmed = confirm(
                    'Страницы курса будут открыты в новых вкладках, не закрывайте их заранее\n' +
                    'Если страницы не открываются, разрешите сайту работать со всплывающими окнами'
                );
            }
            if (isConfirmed) {
                myButton.style = 'display:none';
                log('Ищем данные');
                let href = currentWindow.location.href;
                let tempWindow = await createWindow('adminka_groups');
                let hasWebinars = false;
                let isConverting = false;
                await tempWindow.openPage(`${getBaseUrl(href)}/groups`);
                let groupToolbars = tempWindow.querySelectorAll('[id^="group_"][id$="_toolbar"]');
                for (let toolbar of groupToolbars) {
                    if (toolbar.firstChild.firstChild.innerHTML in ['Вебинар', 'Мини-группа']) {
                        hasWebinars = true;
                        break;
                    }
                    if (toolbar.firstChild.firstChild.innerHTML == 'Конвертируется') {
                        isConverting = true;
                        break;
                    }
                }
                let teacherIdInput = await tempWindow.waitForElement(
                    '#edit_group_template [name="group_template[teacher_id]"]'
                );
                let usersLimitInput = await tempWindow.waitForElement(
                    '#edit_group_template [name="group_template[users_limit]"]'
                );
                let teacherId = teacherIdInput.value;
                let usersLimit = usersLimitInput.value;
                await tempWindow.openPage(`${getBaseUrl(href)}/edit`);
                if (tempWindow.querySelector('#course_product_pack_id').value) {
                    warningElement.innerHTML += 'Привязана подписка! ';
                }
                if (tempWindow.querySelector('#course_description').value.length > 260) {
                    warningElement.innerHTML += 'Описание длиннее 260 символов! ';
                }
                if (tempWindow.querySelector('#course_maternity_capital').checked) {
                    warningElement.innerHTML += 'Включена оплата маткапиталом! ';
                }
                if (warningElement.innerHTML) {
                    warningElement.innerHTML = `Может не получиться создать дубликат! ${warningElement.innerHTML}`;
                }
                if (hasWebinars) {
                    if (warningElement.innerHTML) {
                        warningElement.innerHTML += '<br>';
                    }
                    warningElement.innerHTML += 'В курсе есть будущие занятия';
                }
                if (isConverting) {
                    if (warningElement.innerHTML) {
                        warningElement.innerHTML += '<br>';
                    }
                    warningElement.innerHTML += 'В курсе есть несконвертированные занятия';
                }
                let teacherIdTarget = await currentWindow.waitForElement(
                    '#course_duplicate_group_templates_attributes_0_teacher_id'
                );
                let usersLimitTarget = await currentWindow.waitForElement(
                    '#course_duplicate_group_templates_attributes_0_users_limit'
                );
                usersLimitTarget.value = usersLimit;
                teacherIdTarget.value = teacherId;
                currentWindow.querySelector('#s2id_course_duplicate_group_templates_attributes_0_teacher_id')
                    .style.display = 'none';
                currentWindow.querySelector('#course_duplicate_group_templates_attributes_0_teacher_id')
                    .style.display = '';
                await tempWindow.close();
                if (!hasBotApproval) displayLog('Данные подгружены)');
            }
        }
        myButton.onclick = get_data_full;
        containerElement.append(myButton);
        containerElement.append(warningElement);
        let duplicateForm = currentWindow.querySelector('#new_course_duplicate');
        duplicateForm.before(containerElement);
        let myForm = createElement('form', 'form-horizontal inputs-sm');
        myForm.id = 'my_form';
        let amountElement = createFormElement(myForm, 'input', 'Количество дубликатов', 'duplicates_amount');
        amountElement.type = 'number';
        amountElement.min = 1;
        amountElement.max = 100;
        myForm.style = 'margin-top:15pt;';
        myForm.onsubmit = createDuplicates;
        duplicateForm.after(myForm);
        let massCreateButton = createButton('Создать пачку дубликатов', createDuplicates, 'btn-primary', false);
        async function createDuplicates() {
            let duplicatesAmount = Number(amountElement.value);
            if (!duplicatesAmount) {
                alert('Укажите количество задач');
                return;
            }
            if (duplicatesAmount < 1 || duplicatesAmount > 50) {
                alert('За один раз можно завести от 1 до 50 дубликатов');
                return;
            }
            let isConfirmed = confirm(`Будет создано ${duplicatesAmount} одинаковых дубликатов`)
            if (isConfirmed) {
                let submitWindow = await createWindow('adminka_duplicates');
                let submitButton = currentWindow.querySelector('.btn-primary[value="Создать дубликат курса"]');
                submitButton.removeAttribute('data-disable-with');
                submitButton.target = 'adminka_duplicates';
                duplicateForm.target = 'adminka_duplicates';
                for (let i = 0; i < duplicatesAmount; i++) {
                    log(i + 1);
                    submitButton.click(); await sleep(100);
                    await submitWindow.waitForSuccess();
                    await submitWindow.openPage('about:blank');
                }
                submitWindow.close();
                log('Курсы созданы')
                await sleep(5000);
                currentWindow.openPage('/admin/courses?q%5Bid_eq%5D=');
            }
        }
        myForm.append(massCreateButton);
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
            btn_show.hidden = true; btn_copypdf.hidden = false; btn_clearpdf.hidden = false;
            btn_createpdf.hidden = false; btn_hide.hidden = false;
        }
        btn_hide.onclick = function () {
            btn_show.hidden = false; btn_copypdf.hidden = true; btn_clearpdf.hidden = true; btn_createpdf.hidden = true;
            btn_hide.hidden = true;
        }
        btn_copypdf.onclick = function () {
            async function copypdf() {
                if (document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_name"]')
                    .length > 1
                ) {
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
                win.location.href = '/admin/courses/' + cid + '/edit';
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
                    let attrs = [
                        '[id^="course_plan_course_plan_blocks_attributes_"][id*="_header"]',
                        '[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]',
                        '[id^="course_plan_course_plan_blocks_attributes_"][id*="_description"]'
                    ];
                    for (let attr of attrs) {
                        document.querySelectorAll(attr)[k + 1].value = i.querySelectorAll(attr)[0].value;
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
                document.getElementById('course_plan_published').checked =
                    win.document.getElementById('course_plan_published').checked;
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
                let attrs = [
                    '[id^="course_plan_course_plan_blocks_attributes_"][id*="_header"]',
                    '[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]',
                    '[id^="course_plan_course_plan_blocks_attributes_"][id*="_description"]'
                ];
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
                if (document.querySelectorAll('[id^="course_plan_course_plan_blocks_attributes_"][id*="_name"]')
                    .length > 1
                ) {
                    alert('Удалите или очистите текущую PDF-программу, после этого можно будет загрузить новую');
                    return;
                }
                btn_show.hidden = true; btn_copypdf.hidden = true; btn_clearpdf.hidden = true;
                btn_createpdf.hidden = true; btn_hide.hidden = true;
                let inp = document.createElement('input'); inp.type = 'file'; inp.accept = "text/csv";
                inp.required = 'required';
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
                                        if (
                                            document.querySelectorAll(
                                                '[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]'
                                            )[k].value == ''
                                        ) {
                                            document.querySelectorAll(
                                                '[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]'
                                            )[k].value = 0;
                                        }
                                        if (singleRow != 0) {
                                            document.getElementsByClassName('btn-success')[k + 1].click();
                                            k += 1
                                            n = 0
                                        }
                                        document.querySelectorAll(
                                            '[id^="course_plan_course_plan_blocks_attributes_"][id*="_header"]'
                                        )[k].value = x;
                                    }
                                    if (rowCell == 1) {
                                        document.querySelectorAll(
                                            '[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]'
                                        )[k].value = x;
                                    }
                                    if (rowCell == 2) {
                                        if (x.length > 270) {
                                            x = x.substring(0, 270);
                                            log('Сократил описание раздела ' + (k + 1) + ' до 270 символов')
                                        }
                                        document.querySelectorAll(
                                            '[id^="course_plan_course_plan_blocks_attributes_"][id*="_description"]'
                                        )[k].value = x;
                                    }
                                    if (rowCell == 3) {
                                        if (n != 0) {
                                            document.getElementsByClassName('btn-success')[k].click();
                                        }
                                        document.querySelectorAll(
                                            '[id^="course_plan_course_plan_blocks_attributes_"][id*="_name"]'
                                        )[m].value = x;
                                        n += 1
                                        m += 1
                                    }
                                }
                            }
                        }
                        if (
                            document.querySelectorAll(
                                '[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]'
                            )[k].value == ''
                        ) {
                            document.querySelectorAll(
                                '[id^="course_plan_course_plan_blocks_attributes_"][id*="_hours"]'
                            )[k].value = 0;
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
        div.appendChild(btn_show); div.appendChild(btn_copypdf); div.appendChild(btn_clearpdf);
        div.appendChild(btn_createpdf); div.appendChild(btn_hide);
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
            let todo = confirm(
                'Процесс будет запущен в отдельной вкладке, не закрывайте ее до завершения процесса\n' +
                'Во все части будет проставлена галочка «Только для пролонгации»\n' +
                'Может потребоваться разрешение показывать сайту всплывающие окна'
            );
            if (todo) {
                btn_massprolong.disabled = true; btn_massprolong.style = 'color:gray';
                async function massprolong() {
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
                            await win.waitForSuccess();
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

    if (currentWindow.checkPath(pagePatterns.tasksEdit)) {
        await currentWindow.waitForElement('[id$="_paper_trail_event_minor_update"]');
        currentWindow.querySelector('[id$="_paper_trail_event_minor_update"]').click();
    }
    if (currentWindow.checkPath(pagePatterns.taskPreviewAnswers)) {
        await currentWindow.waitForElement('button[tabindex="2"] span');
        currentWindow.querySelector('button[tabindex="2"] span').click();
        while (!currentWindow.document.evaluate(
            "//button[contains(., 'Посмотреть ответ')]",
            currentWindow.document,
            null,
            XPathResult.ANY_TYPE,
            null
        ).iterateNext()) { await sleep(100); }
        currentWindow.document.evaluate(
            "//button[contains(., 'Посмотреть ответ')]",
            currentWindow.document,
            null,
            XPathResult.ANY_TYPE,
            null
        ).iterateNext().click();
    }
    if (currentWindow.checkPath(pagePatterns.trainingsTaskTemplates)) {
        let previewLinks = currentWindow.querySelectorAll('a[href$="preview"]');
        for (let linkElement of previewLinks) {
            linkElement.href += '#ans';
        }
        const massTasksButtonOnClick = async () => {
            currentWindow.jsCodeArea.value = `// поменяйте id на нужные ниже
let taskIds = splitString(\`
1
2
3
\`);
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
    let addButton = trainingsWindow.querySelectorAll('.task_table')[1].childNodes[1].firstChild
        .querySelector('a[title="Привязать"]');
    addButton.href = addButton.href.substr(0, addButton.href.search('=') + 1) + taskId;
    addButton.click();
    await trainingsWindow.waitForSuccess();
    await trainingsWindow.openPage('about:blank');
}
await currentWindow.reload();`;
        }
        const massDeleteButtonOnClick = async () => {
            let todo = confirm('Точно удалить все задачи?');
            if (todo) {
                let tempWindow = await createWindow('remove-tasks-from-training');
                let deleteButtons = currentWindow.querySelectorAll(
                    'a.btn-danger[href^="/admin/trainings/"][href*="/task_templates/"]'
                );
                for (let button of deleteButtons) {
                    button.removeAttribute('data-confirm');
                    button.target = 'remove-tasks-from-training';
                    button.click();
                    await tempWindow.waitForSuccess();
                    await tempWindow.openPage('about:blank');
                }
                await tempWindow.close();
                await currentWindow.reload();
            }
            else log('Операция отменена');
        }
        let massTasksButton = createButton('Привязать задачи массово', massTasksButtonOnClick, 'btn-default', false);
        let massDeleteButton = createButton('Отвязать все задачи', massDeleteButtonOnClick, 'btn-danger', false);
        let createTaskButton = currentWindow.querySelector('.btn-success[href$="task_templates"]');
        createTaskButton.after(massDeleteButton);
        createTaskButton.after(massTasksButton);
    }

    /********************** Обучение - мероприятия **********************/

    if (currentWindow.checkPath(pagePatterns.eventsEdit) ||
        currentWindow.checkPath(pagePatterns.eventsNew)) {
        let seriesWarning = createWarningElement('Неактуальный цикл мероприятий');
        let seriesElement = currentWindow.querySelector('#event_series_id');
        let goodSeries = [
            'Подготовка к ЕГЭ', 'Подготовка к ОГЭ', 'Домашняя школа', 'Родителям', 'Поступление', 'Профориентация',
            'Другое', 'Вне циклов', 'Семинары для учителей', 'Подготовка к ОГЭ для учителей',
            'Вебинары с Федеральным подростковым центром', 'Подготовка к ЕГЭ для учителей',
            'Как готовить к олимпиадам?',
        ];
        for (let optionElement of seriesElement.children) {
            if (goodSeries.includes(optionElement.textContent)) optionElement.className += ' good';
            else {
                optionElement.textContent = `x ${optionElement.textContent}`;
                optionElement.classList.add('bad');
            }
        }
        seriesElement.querySelector('[value=""]').textContent = '!!! Bce aктyaльныe циклы yкaзaны вышe !!!';
        let selectedOption = seriesElement.selectedOptions[0];
        seriesElement.prepend(selectedOption);
        seriesElement.prepend(...seriesElement.querySelectorAll('.good'), seriesElement.querySelector('[value=""]'));
        if (currentWindow.checkPath(pagePatterns.eventsEdit) && selectedOption.className.includes('bad')) {
            seriesWarning.hidden = false;
        }
        else seriesWarning.hidden = true;
        seriesElement.onchange = function () {
            if (seriesElement.selectedOptions[0].className.includes('bad')) seriesWarning.hidden = false;
            else seriesWarning.hidden = true;
        }
        seriesElement.after(seriesWarning);
        currentWindow.addStyle(`
        .bad {
            text-decoration: line-through;
            color: #999; /* Серый цвет для большей наглядности */
        }`);
        log('Страница модифицирована');
    }

    /************************* Практика - задачи ************************/

    if (currentWindow.checkPath(pagePatterns.trainingsIndividualTasks)) {
        currentWindow.body.firstChild.className += ' trainings_individual_tasks';
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
        currentWindow.querySelector('#methodical_materials_items_link_item_link_attributes_name').value =
            'Сжатый видеоурок с повторением пройденной теории. Смотреть его необязательно, но к нему всегда можно ' +
            'вернуться, чтобы освежить знания или закрепить пройденный материал.';
    }

    /********************** Пользователи - учащиеся *********************/

    // на странице замены курса
    if (currentWindow.checkPath(pagePatterns.usersCoursesReplace)) {
        let idSearchButton = createButton('Найти по ID', async () => { }, 'btn-default', false);
        const idElement = q_id_eq;
        idSearchButton.href =
            `${window.location.pathname}?q%5Bid_eq%5D=${idElement.value}` +
            `&q%5Bg%5D%5B%23%3CRansack%3A%3ANodes%3A%3AGrouping%3A0x00007d7c85b668c0%3E%5D%5Bid_not_null%5D=false`;
        idElement.style = 'width:52%;';
        idElement.parentNode.style = 'margin-right:-7pt;';
        idElement.onchange = function () {
            idSearchButton.href =
                `${window.location.pathname}?q%5Bid_eq%5D=${idElement.value}` +
                `&q%5Bg%5D%5B%23%3CRansack%3A%3ANodes%3A%3AGrouping%3A0x00007d7c85b668c0%3E%5D%5Bid_not_null%5D=false`;
        }
        currentWindow.querySelector('.q_id_eq').appendChild(idSearchButton);
        log('Страница модифицирована')
    }

    // на странице массового добавления доступов
    if (currentWindow.checkPath(pagePatterns.massCourseAccess)) {
        let satelliteAccessButton = createButton(
            'Выдать доступ к спутникам и СИ по отчету', () => { }, 'btn-default', false
        );
        new_admin_mass_course_access_form.before(satelliteAccessButton);
        satelliteAccessButton.onclick = async () => {
            let csvContent = await getCsvFromMetabase('49105');
            if (csvContent) {
                let fullCsvArray = CSVToArray(csvContent).slice(1, -1);
                log(`Нужно выдать ${fullCsvArray.length} записей`);
                let accessData = generateAccessData(fullCsvArray);
                console.log(accessData);
                currentWindow.document.accessData = accessData;
                let tempWindow = await createWindow('access_temp_window');
                currentWindow.querySelector('form').target = 'access_temp_window';
                let submitButton = currentWindow.querySelector('input[type="submit"]');
                submitButton.removeAttribute('data-disable-with');
                for (let key in accessData) {
                    let accessDataElement = accessData[key];
                    let accessType = accessDataElement[0][2];
                    let accessFinishesAt = accessDataElement[0][3];
                    let accessArray = accessDataElement.map(subArray => subArray.slice(0, 2).join(','));
                    let accessCsvContent = accessArray.join('\n');
                    log(`Выдача ${accessArray.length} доступов ${accessType} ${accessFinishesAt}`);
                    admin_mass_course_access_form_access_type.value = accessType;
                    admin_mass_course_access_form_access_finishes_at.value = accessFinishesAt;
                    setCsvFileByContent(admin_mass_course_access_form_csv_file, accessCsvContent);
                    admin_mass_course_access_form_access_change_description.value = 'Подарок от “Фоксфорда”';
                    submitButton.click();
                    await tempWindow.waitForElement('.loaded');
                    await tempWindow.openPage('about:blank');
                }
                await tempWindow.close();
                displayLog('Доступы выданы');

                function generateAccessData(arr) {
                    let maxSize = 5000;
                    arr.sort((a, b) => {
                        if (a[2] === b[2]) { return a[3].localeCompare(b[3]); }
                        return a[2].localeCompare(b[2]);
                    });
                    if (arr.length > maxSize) {
                        displayLog(
                            `Будет выдано ${maxSize} доступов из ${arr.length}, запустите скрипт повторно через ` +
                            `10 минут`,
                            'warning'
                        );
                    }
                    const limited = arr.slice(0, maxSize);
                    const result = {};
                    for (const item of limited) {
                        const key = `${item[2]}_${item[3]}`;
                        if (!result[key]) {
                            result[key] = [];
                        }
                        result[key].push(item);
                    }

                    return result;
                }
            }
            else {
                log('Выполнение скрипта прервано, данные отсутствуют');
            }
        }
        log('Страница модифицирована')
    }

    /*********************** ЭДШ - типы продуктов ***********************/

    // сетки расписания
    if (currentWindow.checkPath(pagePatterns.gridsCreate) ||
        currentWindow.checkPath(pagePatterns.gridsEdit)) {
        let gridCodeButton = createButton('Внести параллели', () => { }, "btn btn-info", false);
        gridCodeButton.onclick = () => {
            currentWindow.jsCodeArea.value = `let data = [
    // Строки из таблицы в формате
    // [ID предмета, ID курса, ID параллели, Набор 'base'/'additional', 
    //     Автор образовательной методики 'default'/'peterson', 
    //     Тип курса 'default'/'flipped'/'mini_class', Уникальный ID]

];

const miniTimeSleep = 0; // на случай если нужна задержка, можно поставить 100
let lastValues = {};
const filledData = [];
for (const row of data) {
    const filledRow = [];
    for (let i = 0; i < 7; i++) {
        if (row[i] !== undefined && row[i] !== '') {
            lastValues[i] = row[i];
        }
        else if (i == 2) {
            throw Error(\`ID параллели обязателен для заполнения\`);
        }
        else if (lastValues[i] === undefined || lastValues[i] === '') {
            throw Error(\`Для первой строки обязательны для заполнения все поля\`);
        }
        filledRow[i] = lastValues[i];
    }
    filledData.push(filledRow);
}
const groups = {};
for (const row of filledData) {
    const [disId, couId, templId, group, math, type, uniqId] = row;
    const disProId = \`$\{disId}_$\{uniqId}\`;
    if (!groups[group]) groups[group] = {};
    if (!groups[group][disProId]) groups[group][disProId] = {};
    if (!groups[group][disProId][couId]) groups[group][disProId][couId] = {
        templates: [],
        type,
        maths: math === 'both' ? ['default', 'peterson'] : [math]
    };
    groups[group][disProId][couId].templates.push(templId);
}

// переключение вкладок
async function switchTab(tabName) {
    try {
        currentWindow.querySelector(\`.nav-tabs a[href="#$\{tabName}"]\`).click();
        await currentWindow.waitForElement(\`.nav-tabs .active a[href="#$\{tabName}"]\`)
    }
    catch {
        displayLog(\`Не могу переключиться на вкладку $\{tabName}\`, 'danger')
    }
}
async function addSomething(selector, name) {
    try {
        currentWindow.querySelector(selector).click();
        await sleep(miniTimeSleep);
    }
    catch {
        displayLog(\`Не могу добавить $\{name}\`, 'danger')
    }
}
async function addGroup() {
    await addSomething('.tab-pane.active .add_nested_fields[data-association="groups"]', 'группу');
}
const lastGroupSelector = '.tab-pane.active .fields:not([style]) .group:last-of-type';
async function addDiscipline() {
    await addSomething(
        \`$\{lastGroupSelector} .add_nested_fields[data-association="discipline_groups"]\`, 
        'дисциплину'
    );
}
async function addCourse() {
    await addSomething(
        \`$\{lastGroupSelector} .fields:last-of-type .add_nested_fields[data-association="items"]\`, 
        'курс'
    );
}

for (const [groupType, disciplines] of Object.entries(groups)) {
    // Набор
    await switchTab(groupType);
    let groupElem = currentWindow.querySelector(lastGroupSelector);
    if (!groupElem) {
        await addGroup();
        groupElem = currentWindow.querySelector(lastGroupSelector);
    }
    groupElem.querySelector('input[id$="_title"]').value = groupType === 
        'base' ? 'Базовый набор' : 'Дополнительный набор';

    for (const [disProId, courses] of Object.entries(disciplines)) {
        // Дисциплина
        await addDiscipline();
        const disId = disProId.split('_')[0];
        const disElem = groupElem.querySelector('.fields:last-of-type');
        const disSelect = disElem.querySelector('select[id$="_discipline_id"]');
        disSelect.value = disId;

        for (const [courseId, courseData] of Object.entries(courses)) {
            for (const mathType of courseData.maths) {
                await addCourse();
                const courseRows = disElem.querySelectorAll('tr.fields');
                const courseRow = courseRows[courseRows.length - 1];
                console.log(courseRow);
                // ID курса
                const courseInput = courseRow.querySelector('input[id$="_resource_id"]');
                courseInput.value = courseId;
                courseRow.querySelector(\`#s2id_$\{courseInput.id}\`).style = 'display:none';
                courseInput.style = '';
                // Автор методики
                courseRow.querySelector('select[id$="_author_type"]').value = mathType;
                // Тип курса
                courseRow.querySelector('select[id$="_course_type"]').value = courseData.type;

                // Параллели
                const tplSelect = courseRow.querySelector('select[id$="_group_template_ids"]');
                for (const tplId of courseData.templates) {
                    const option = document.createElement('option');
                    option.value = tplId;
                    option.text = tplId;
                    option.selected = true;
                    tplSelect.appendChild(option);
                }
                courseRow.querySelector(\`#s2id_$\{tplSelect.id}\`).style = 'display:none';
                tplSelect.style = '';
            }
        }
    }
}
displayLog('Готово! Проверьте данные и сохраните');`
        };
        const container = document.createElement('div');
        let a = document.querySelector('.externship_schedule_grids_page');
        a.insertBefore(container, a.firstChild);
        container.appendChild(gridCodeButton);
        log('Страница модифицирована');
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
        await secondaryWindow.openPage(
            currentWindow.location.href.substring(0, currentWindow.location.href.length - 5)
        );
        currentWindow.clearAll();
        let form = createElement('form', 'simple_form form-horizontal inputs-sm', 'margin:20px')
        let gradeElement = createFormElement(
            form, 'select', 'Класс *', 'mass_externship_product_type_grade_course_product_type_grade_id'
        );
        let typeElement = createFormElement(
            form, 'select', 'Тип элемента *', 'mass_externship_product_type_grade_course_resource_type'
        );
        let idsElement = createFormElement(
            form, 'textarea', 'ID курсов *', 'mass_course_input', 'Можно указать через пробел, запятую или в столбик'
        );
        let massAppendButton = createButton(
            'Запустить массовое добавление', async () => { }, 'btn-default btn-primary form-control', false
        );
        let hugeConsole = createElement(
            'div', 'textarea',
            'border: 2px solid #eee; border-radius: 15px; padding: 10px; margin-top: 20px; margin-bottom: 20px;'
        )
        function huge_log(s) {
            hugeConsole.innerHTML += s + '<br>';
        }
        log = huge_log;
        log('Пока можно массово добавлять только курсы, скрипт не проверяет опубликованность курсов, проверьте её ' +
            'по отчету<br>Процесс будет происходить в отдельной вкладке, не закрывайте её')
        let backButton = createButton(
            'Вернуться назад',
            async () => { secondaryWindow.close(); currentWindow.history.go(-1); return false; },
            'btn-default',
            false
        );
        form.appendChild(massAppendButton);
        form.appendChild(hugeConsole);
        form.appendChild(backButton);
        currentWindow.body.appendChild(form);
        currentWindow.head.innerHTML = secondaryWindow.head.innerHTML;
        await secondaryWindow.log(
            'Эта страница нужна для работы массовых внесений данных в админку. Внесение данных доступно на другой ' +
            'вкладке'
        );
        Array.from(secondaryWindow.querySelectorAll('input')).map(el => { el.disabled = true });
        Array.from(secondaryWindow.querySelectorAll('select')).map(el => { el.disabled = true });
        currentWindow.querySelector('#mass_externship_product_type_grade_course_product_type_grade_id').innerHTML =
            secondaryWindow.querySelector('#externship_product_type_grade_course_product_type_grade_id').innerHTML;
        let res_type = currentWindow.querySelector('#mass_externship_product_type_grade_course_resource_type');
        res_type.innerHTML =
            await secondaryWindow.querySelector('#externship_product_type_grade_course_resource_type').innerHTML;
        res_type.disabled = true;
        idsElement.rows = 1; idsElement.cols = 1;
        idsElement.style = 'min-height:50px';
        massAppendButton.onclick = async function () {
            backButton.onclick = () => {
                let todo = confirm('Запущенный процесс будет прерван');
                if (todo) { secondaryWindow.close(); currentWindow.history.go(-1); return false; }
            };
            let idsList = idsElement.value.split(/[ \n,;]/).filter(x => x != '');
            if (secondaryWindow.closed) {
                secondaryWindow = await createWindow();
                await secondaryWindow.openPage(
                    currentWindow.location.href.substring(0, currentWindow.location.href.length - 5)
                );
            }
            for (let productID of idsList) {
                await secondaryWindow.openPage(
                    currentWindow.location.href.substring(0, currentWindow.location.href.length - 5)
                );
                try {
                    secondaryWindow.querySelector(
                        '#externship_product_type_grade_course_product_type_grade_id'
                    ).value = gradeElement.value;
                    secondaryWindow.querySelector('#externship_product_type_grade_course_resource_type').value =
                        typeElement.value;
                    secondaryWindow.querySelector('#course_input').value = productID;
                    secondaryWindow.querySelector('.btn-primary').click();
                    await secondaryWindow.waitForElement('.alert');
                    let alert = secondaryWindow.querySelector('.alert');
                    let col;
                    if (alert.className.match('danger')) { col = 'red' } else { col = 'green' }
                    try {
                        log(`${productID}   <span style = 'color:${col}'>
                            ${alert.innerHTML.replace(/<button(.*?)\/button>/, '')}</span>`);
                    }
                    catch (e) { log(productID + `   <span style = 'color:${col}'>` + e + '</span>'); }
                }
                catch (e) { log(productID + '\t' + e); }
            }
            // win.close();
            backButton.onclick = () => { secondaryWindow.close(); currentWindow.history.go(-1); return false; };
            displayLog(
                'Процесс привязки завершен, не забудьте проверить логи выше. Закрыть текущую страницу рекомендуется ' +
                'с помощью кнопки ниже.'
            );
            await secondaryWindow.log(
                'Эта страница нужна для работы массовых внесений данных в админку. Внесение данных доступно на ' +
                'другой вкладке'
            );
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
            let only_copy = currentWindow.checkPath(/\?only_copy/);
            let only_week_day_webinars_settings = currentWindow.checkPath(/\?only_week_day_webinars_settings/);
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
                            document.getElementById('week_day_webinars_settings_location_id').value =
                                MINI_GROUPS_ID_SET[0];
                            document.getElementById('week_day_webinars_settings_location_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_location_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_format_id').value =
                                MINI_GROUPS_ID_SET[1];
                            document.getElementById('week_day_webinars_settings_format_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_format_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_studio_id').value =
                                MINI_GROUPS_ID_SET[2];
                            document.getElementById('week_day_webinars_settings_studio_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_studio_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_admin_id').value =
                                MINI_GROUPS_ID_SET[3];
                            document.getElementById('week_day_webinars_settings_admin_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_admin_id').style = 'display:none;';
                            log('Локация Мини-группы');
                        }
                        catch (e) { log(e); }
                    }
                    btn2.onclick = function () {
                        try {
                            document.getElementById('week_day_webinars_settings_all_days').checked = 'checked';
                            document.getElementById('week_day_webinars_settings_location_id').value = SLAG_ID_SET[0];
                            document.getElementById('week_day_webinars_settings_location_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_location_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_format_id').value = SLAG_ID_SET[1];
                            document.getElementById('week_day_webinars_settings_format_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_format_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_studio_id').value = SLAG_ID_SET[2];
                            document.getElementById('week_day_webinars_settings_studio_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_studio_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_admin_id').value = SLAG_ID_SET[3];
                            document.getElementById('week_day_webinars_settings_admin_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_admin_id').style = 'display:none;';
                            log('Локация Шлак');
                        }
                        catch (e) { log(e); }
                    }
                    btn3.onclick = function () {
                        try {
                            document.getElementById('week_day_webinars_settings_all_days').checked = 'checked';
                            document.getElementById('week_day_webinars_settings_location_id').value = HOME_ID_SET[0];
                            document.getElementById('week_day_webinars_settings_location_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_location_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_format_id').value = HOME_ID_SET[1];
                            document.getElementById('week_day_webinars_settings_format_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_format_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_studio_id').value = HOME_ID_SET[2];
                            document.getElementById('week_day_webinars_settings_studio_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_studio_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_admin_id').value = HOME_ID_SET[3];
                            document.getElementById('week_day_webinars_settings_admin_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_admin_id').style = 'display:none;';
                            log('Локация Дом');
                        }
                        catch (e) { log(e); }
                    }
                    btn4.onclick = function () {
                        try {
                            document.getElementById('week_day_webinars_settings_all_days').checked = 'checked';
                            document.getElementById('week_day_webinars_settings_location_id').value = SSM_ID_SET[0];
                            document.getElementById('week_day_webinars_settings_location_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_location_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_format_id').value = SSM_ID_SET[1];
                            document.getElementById('week_day_webinars_settings_format_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_format_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_studio_id').value = SSM_ID_SET[2];
                            document.getElementById('week_day_webinars_settings_studio_id').style = '';
                            document.getElementById('s2id_week_day_webinars_settings_studio_id').style =
                                'display:none;';
                            document.getElementById('week_day_webinars_settings_admin_id').value = SSM_ID_SET[3];
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
                    let tmp = currentWindow.location.href.slice(
                        currentWindow.location.href.search(/change_original_group_group_id/) + 31
                    );
                    let tmp_int = tmp.search('&');
                    if (tmp_int == -1) { tmp_int = 100; }
                    document.querySelector('#change_original_group_group_id').value = tmp.slice(0, tmp_int);
                } catch (e) { }
                try {
                    let tmp = currentWindow.location.href.slice(
                        currentWindow.location.href.search(/change_original_group_original_group_id/) + 40
                    );
                    let tmp_int = tmp.search('&');
                    if (tmp_int == -1) { tmp_int = 100; }
                    document.querySelector('#change_original_group_original_group_id').value = tmp.slice(0, tmp_int);
                } catch (e) { }
                if (currentWindow.checkPath(/auto_validate/)) {
                    document.querySelector('.only-copy-main [type=submit]').click();
                }
            }
            if (only_week_day_webinars_settings) {
                try {
                    let tmp = currentWindow.location.href.slice(
                        currentWindow.location.href.search(/select_course/) + 14
                    );
                    let tmp_int = tmp.search('&');
                    if (tmp_int == -1) { tmp_int = 100; }
                    document.querySelector('#select_course').value = tmp.slice(0, tmp_int);
                } catch (e) { log(e) }
                try {
                    let tmp = currentWindow.location.href.slice(
                        currentWindow.location.href.search(/select_group_template/) + 22
                    );
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
                if (currentWindow.checkPath(/ssm/)) {
                    document.querySelector('.ssm').click();
                }
                if (currentWindow.checkPath(/mini/)) {
                    document.querySelector('.mini').click();
                }
                if (currentWindow.checkPath(/home/)) {
                    document.querySelector('.home').click();
                }
                if (currentWindow.checkPath(/slag/)) {
                    document.querySelector('.slag').click();
                }
                if (currentWindow.checkPath(/auto_validate/)) {
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
                    createFormElement(
                        form,
                        'textarea',
                        `Данные для ${id}`,
                        `data_for_${id}`,
                        `Строки данных для ${id}`,
                        true,
                        loadButton
                    );
                }
                else {
                    idElement.parentNode.style = '';
                }
            });
        })
        urlInputElement.value = '/admin/courses/{course_ids}/edit';
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
                url = url.replace(
                    `\{${patternId}\}`, currentWindow.querySelector(`#data_for_${patternId}`).value.split('\n')[0]
                )
            }
            await secondaryWindow.openPage(url);
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
    // на секретной странице
    if (currentWindow.checkPath(pagePatterns.secretPage)) {
        function createCollapsibleSection(parent, title, level = 0) {
            const button = createButton(
                `▼ ${title}`, () => { }, `collapsible active section-header section-level-${level}`, true
            );
            button.type = 'button';
            button.style = `margin-left: 0; width: ${98 - 6 * level}vw;`;
            if (level != 0) {
                button.style.padding = '8pt';
                button.style.backgroundColor = '#f4f4ff';
            }
            else if (level == 0) {
                button.style.marginTop = '18pt';
            }
            const outside = createElement('div', `outside-collapsible section-outside section-level-${level}`);
            const content = createElement('div', `inside-collapsible section-content section-level-${level}`);
            parent.append(outside)
            outside.append(button);
            outside.append(content);
            button.addEventListener('click', () => {
                button.classList.toggle('active');
                if (button.classList.contains('active')) {
                    button.innerHTML = `▼ ${title}`;
                    button.style.color = '#000';
                }
                else {
                    button.innerHTML = `▶ ${title}`;
                    button.style.color = '#777';
                }
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            });
            return content;
        }
        function buildSectionsRecursive(parent, structure, currentLevel = 0) {
            let variables = {};
            structure.forEach(sectionConfig => {
                let sectionElement = createCollapsibleSection(parent, sectionConfig.title, currentLevel);
                variables[sectionConfig.key] = sectionElement;
                if (sectionConfig.children) {
                    let childVariables = buildSectionsRecursive(sectionElement, sectionConfig.children, currentLevel + 1);
                    Object.assign(variables, childVariables);
                }
            });
            return variables;
        }
        let sections;
        function createActionButton(scriptObj, key = '') {
            let className = key.toLowerCase();
            let description = scriptObj.description ? scriptObj.description : '';
            const button = createButton(scriptObj.name, () => {
                currentWindow.jsCodeArea.value = `// ${scriptObj.name}\n`;
                if (description) currentWindow.jsCodeArea.value += `// ${description.replace(/\n\s*/ig, '\n// ')}\n`;
                currentWindow.jsCodeArea.value += `${scriptObj.code}`;
            }, `btn btn-default script-btn ${className}`, false);
            button.title = description.replace(/\n\s*/ig, '; ');
            sections[scriptObj.parent].appendChild(button);
            return button;
        }
        function hideorShowAll(toShow) {
            document.querySelectorAll('.my-btn:not(.btn-info), .outside-collapsible').forEach(
                btn => btn.style.display = toShow ? 'inline-block' : 'none'
            );
        }
        function showParentElements(node) {
            if (!node) return;
            node.style.display = 'inline-block';
            if (node.firstElementChild) node.firstElementChild.style.display = 'inline-block';
            showParentElements(node.parentElement.closest('.outside-collapsible'));
        }
        function showChildElements(node) {
            if (node.classList.contains('script-btn')) return;
            const elems = node.parentElement.querySelectorAll('.outside-collapsible, .my-btn');
            console.log(elems);
            elems.forEach(elem => {
                elem.style.display = 'inline-block';
            })
        }

        [
            '.courses_lesson_pack_lesson_count',
            '.courses_lesson_pack_price',
            '.courses_lesson_pack_maternity_capital'
        ].forEach(selector => {
            currentWindow.querySelector(selector)?.remove();
        });
        ['utf8', 'authenticity_token'].forEach(name => {
            currentWindow.querySelector(`[name = "${name}"]`)?.classList.add('protected');
        });
        currentWindow.querySelector('h3').innerHTML = 'Секретная страница';
        const form = currentWindow.querySelector('form');
        form.id = 'form';
        const div = createElement('div');
        div.innerHTML = 'На этой странице можно найти самые разные скрипты)';
        const searchInput = createElement('input', 'form-control', 'margin: 10px 0; padding: 5px;');
        searchInput.placeholder = 'Поиск скриптов...';
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            if (term) hideorShowAll(false);
            else hideorShowAll(true);
            document.querySelectorAll('.my-btn:not(.btn-info)').forEach(btn => {
                console.log(btn.textContent, '123', term)
                if (btn.textContent.toLowerCase().includes(term)) {
                    btn.style.display = 'inline-block';
                    showParentElements(btn);
                    showChildElements(btn);
                }
            });
        });
        form.before(searchInput);
        form.prepend(div);
        const originalButton = form.querySelector('[type="submit"]');
        originalButton.removeAttribute('data-disable-with');
        originalButton.style = 'display: none;';
        originalButton.classList.add('protected');

        const sectionsStructure = [
            {
                title: 'Коды для админов админки',
                key: 'admin',
                children: [
                    { title: 'Курсы / courses', key: 'adminCourses' },
                    { title: 'Программа / lessons', key: 'adminLessons' },
                    { title: 'Изменение порядка уроков / lessons_order', key: 'lessonsOrder' },
                    { title: 'Расписание / groups', key: 'groups' },
                    { title: 'Календарь каникул / holidays_calendar', key: 'holidays' },
                    { title: 'Преподаватели / teachers', key: 'teachers' },
                    { title: 'Акции с промокодами / marketing/code_campaigns', key: 'codeCampaigns' },
                    { title: 'Комплекты занятий / product_packs', key: 'productPacks' }
                ]
            },
            {
                title: 'Коды для админов контента',
                key: 'content',
                children: [
                    { title: 'Курсы / courses', key: 'contentCourses' },
                    { title: 'Программа / lessons', key: 'contentLessons' },
                    { title: 'Тесты / trainings', key: 'trainings' },
                    { title: 'Задачи / tasks', key: 'tasks' },
                    { title: 'Учебные программы / methodical_materials/programs', key: 'methodicalPrograms' }
                ]
            }
        ];
        const SCRIPTS = {
            REP: {
                name: 'Проставление галки «Репетиторская»',
                code: `let taskIds = splitString(\`
000000
000000
000000
\`);
let win = await createWindow(-1);
for (let taskId of taskIds) {
    log(taskId);
    let url = \`/admin/tasks/$\{taskId}\`;
    let fields = {
        '_method': 'patch',
        'task[coach]': true,
        'task[paper_trail_event]': 'minor_update'
    };
    await win.postFormData(url, fields);
}`,
                parent: 'tasks'
            },
            TARIFF: {
                name: 'Добавление связанных продуктов в курсы',
                code: `let pairs = [
    // [course_id, resource_id],
    [10609, 12480],
];
let win = await createWindow(-1);
for (let [courseId, resourceId] of pairs) {
    log(\`$\{courseId} <- $\{resourceId}\`);
    let url = \`/admin/courses/$\{courseId}/connections/tariffs\`;
    let fields = {
        'courses_connection_tariff[resource_type]': 'ProductPack',
        'courses_connection_tariff[resource_id]': resourceId,
        'courses_connection_tariff[tariff_type]': 'premium',
    };
    await win.postFormData(url, fields);
}`,
                parent: 'adminCourses'
            },
            TASK_INPUT: {
                name: 'Создать задачу (поле ввода)',
                code: `let win = await createWindow(-1);
let url = \`/admin/tasks\`;
let fields = {
    'task[name]': 'Вопрос №1',
    'task[task_difficulty_id]': '8', // сложность 3
    'task[discipline_ids][]': ['3'], // физика
    'task[author_id]': '1236', // Краюшкина
    'task[published]': true,
    'task[content]': \`<p><strong>Текст задачи</strong></p>\`,
    'task[text_questions_attributes][0][question_type_id]': '1', 
    // ответ
    'task[text_questions_attributes][0][text_answers_attributes][0][content]': '0' 
};
await win.postFormData(url, fields);`,
                parent: 'tasks'
            },
            TASK_SELF: {
                name: 'Создать задачу (самооценка)',
                code: `let win = await createWindow(-1);
let url = \`/admin/tasks\`;
let fields = {
    'task[name]': 'Вопрос №1',
    'task[task_difficulty_id]': '8', // сложность 3 
    'task[discipline_ids][]': ['3'], // физика
    'task[author_id]': '1236', // Краюшкина
    'task[published]': true,
    'task[content]': \`<p><strong>Текст задачи</strong></p>\`,
    'task[self_rate_questions_attributes][0][question_type_id]': '10',
    'task[self_rate_questions_attributes][0][self_rate_answers_attributes][0][content]': 'Все верно',
    'task[self_rate_questions_attributes][0][self_rate_answers_attributes][0][correct_ratio]': '100',
    'task[self_rate_questions_attributes][0][self_rate_answers_attributes][1][content]': 'Ничего не верно',
    'task[self_rate_questions_attributes][0][self_rate_answers_attributes][1][correct_ratio]': '0'
};
await win.postFormData(url, fields);`,
                parent: 'tasks'
            },
            TASK_SET: {
                name: 'Создать задачу (пересечение множеств)',
                code: `let win = await createWindow(-1);
let url = \`/admin/tasks\`;
let fields = {
    'task[name]': 'Вопрос №1',
    'task[task_difficulty_id]': '8', // сложность 3
    'task[discipline_ids][]': ['3'], // физика
    'task[author_id]': '1236', // Краюшкина
    'task[published]': true,
    'task[content]': \`<p><strong>Текст задачи</strong></p>\`,
    'task[links_questions_attributes][0][question_type_id]': '4',
    // A1 <-> Б1 и так далее
    'task[links_questions_attributes][0][linked_answers_attributes][0][content]': 'A1',
    'task[links_questions_attributes][0][linked_answers_attributes][0][simple_answer_attributes][content]': 'Б1',
    'task[links_questions_attributes][0][linked_answers_attributes][1][content]': 'A2',
    'task[links_questions_attributes][0][linked_answers_attributes][1][simple_answer_attributes][content]': 'Б2',
    'task[links_questions_attributes][0][linked_answers_attributes][2][content]': 'A3',
    'task[links_questions_attributes][0][linked_answers_attributes][2][simple_answer_attributes][content]': 'Б3',
    'task[links_questions_attributes][0][linked_answers_attributes][3][content]': 'A4',
    'task[links_questions_attributes][0][linked_answers_attributes][3][simple_answer_attributes][content]': 'Б4',
};
await win.postFormData(url, fields);`,
                parent: 'tasks'
            },
            TEACHERS_EDIT: {
                name: 'Отредактировать карточки преподавателей',
                description: `Можно оставить только те поля, которые нужно изменить
                    Можно добавлять другие поля из формы`,
                code: `let teachersData = {
    2043: {
        'teacher[last_name]': 'тестовна',
        'teacher[first_name]': 'теста',
        'teacher[description]': 'Описание',
        'teacher[pdf_description]': 'Подробное описание',
        'teacher[short_description]': 'Короткое описание',
        'teacher[about]': 'О себе',
        'teacher[video_presentation_url]': 'https://test.ru',
    },
};
let basicFields = {
    '_method': 'patch',
};
let win = await createWindow(-1);
for (let teacherId in teachersData) {
    log(teacherId);
    let url = \`/admin/teachers/$\{teacherId}\`;
    let fields = Object.assign({}, basicFields, teachersData[teacherId]);
    await win.postFormData(url, fields);
}`,
                parent: 'teachers'
            },
            USERS_TEACHERS: {
                name: 'Связать аккаунты агентов и карточки преподавателей',
                code: `let userTeachers = [
    // [user_id, teacher_id],
    [12345678, 2043],
];
let basicFields = {
    '_method': 'patch',
};
let win = await createWindow(-1);
for (let [userId, teacherId] of userTeachers) {
    log(\`$\{userId} <- $\{teacherId}\`);
    let url = \`/admin/users/$\{userId}\`;
    let customFields = { 'user[teacher_id]': teacherId };
    let fields = Object.assign({}, basicFields, customFields);
    await win.postFormData(url, fields);
}`,
                parent: 'teachers'
            },
            TEACHERS_CREATE: {
                name: 'Создать карточки преподавателей',
                code: `let teachersData = [
    'Фамилия1 Имя1',
    'Фамилия2 Имя2',
];
let win = await createWindow(-1);
for (let teacherFullName of teachersData) {
    log(teacherFullName);
    let [teacherLastName, teacherFirstName] = teacherFullName.trim().split(' ');
    let fields = {
        'teacher[last_name]': teacherLastName,
        'teacher[first_name]': teacherFirstName,
    };
    let url = \`/admin/teachers\`;
    await win.postFormData(url, fields);
}`,
                parent: 'teachers'
            },
            LESSONS_FREE: {
                name: 'Сделать уроки бесплатными',
                code: `let pairs = [
    // [course_id, lesson_id],
    [10609, 293615],
    [10609, 308300],
];
let win = await createWindow(-1);
for (let [courseId, lessonId] of pairs) {
    log(\`$\{courseId}, $\{lessonId}\`);
    let url = \`/admin/courses/$\{courseId}/lessons/$\{lessonId}\`;
    let fields = {
        '_method': 'patch',
        'lesson[free]': true,
    };
    await win.postFormData(url, fields, { successAlertIsNessesary: false });
}`,
                parent: 'adminLessons'
            },
            LESSONS_EXCLUDED_FROM_PROGRESS_PAGE: {
                name: 'Не учитывать уроки в успеваемости',
                code: `// ${METABASE_URL}/question/46496?course=10609
let pairs = [
    // [course_id, lesson_id],
    [10609, 293615],
    [10609, 308300],
];
let win = await createWindow(-1);
for (let [courseId, lessonId] of pairs) {
    log(\`$\{courseId}, $\{lessonId}\`);
    let url = \`/admin/courses/$\{courseId}/lessons/$\{lessonId}\`;
    let fields = {
        '_method': 'patch',
        'lesson[excluded_from_progress_page]': true,
    };
    await win.postFormData(url, fields, { successAlertIsNessesary: false });
}`,
                parent: 'contentLessons'
            },
            LESSONS_REORDER: {
                name: 'Переместить уроки в конец курса (для удаления)',
                description: 'Уроки перенесутся на 10000 место',
                code: `let pairs = [
    // [course_id, lesson_id],
    [10609, 338032],
];
let win = await createWindow(-1);
for (let [courseId, lessonId] of pairs) {
    log(\`$\{courseId}, $\{lessonId}\`);
    let url = \`/admin/courses/$\{courseId}/lessons/$\{lessonId}/reorder\`;
    let fields = {
        'new_index': '10000',
        'reorganize_dates': 'false',
    };
    await win.postFormData(url, fields, { successAlertIsNessesary: false });
}`,
                parent: 'adminLessons'
            },
            LESSONS_DELETE: {
                name: 'Удалить уроки',
                description: `Должны быть будущей датой и желательно в конце курса
                    (можно перенести в конец другим скриптом)`,
                code: `let pairs = [
    // [course_id, lesson_id],
    [10609, 338032],
];
let win = await createWindow(-1);
for (let [courseId, lessonId] of pairs) {
    log(\`$\{courseId}, $\{lessonId}\`);
    let url = \`/admin/courses/$\{courseId}/lessons/$\{lessonId}\`;
    let fields = {
        '_method': 'delete',
    };
    await win.postFormData(url, fields);
}`,
                parent: 'adminLessons'
            },
            LESSONS_DELETE_SOFT: {
                name: '«Удалить» неудаляемый урок',
                description: 'Переведите все параллели этого занятия в finished/шлак заранее',
                code: `let pairs = [
    // [course_id, lesson_id],
    [10609, 500859],
];
let win = await createWindow(-1);
for (let [courseId, lessonId] of pairs) {
    log(\`$\{courseId}, $\{lessonId}\`);
    let url = \`/admin/courses/$\{courseId}/lessons/$\{lessonId}\`;
    let fields = {
        '_method': 'patch',
        'lesson[course_id]': '9118',
    };
    await win.postFormData(url, fields, { successAlertIsNessesary: false });
}`,
                parent: 'adminLessons'
            },
            LESSONS_VIDEO: {
                name: 'Подгрузить ролики в уроки ПК/видео',
                code: `let pairs = [
    // [course_id, lesson_id, video_url],
    [10609, 334928, 'https://kinescope.io/u53tsTBCQNZDaNCMuJHK11111N'],
];
let win = await createWindow(-1);
for (let [courseId, lessonId, videoUrl] of pairs) {
    log(\`$\{courseId}, $\{lessonId} <- $\{videoUrl}\`);
    let url = \`/admin/courses/$\{courseId}/lessons/$\{lessonId}\`;
    let fields = {
        '_method': 'patch',
        'lesson[video_url]': videoUrl,
    };
    await win.postFormData(url, fields, { successAlertIsNessesary: false });
}`,
                parent: 'contentLessons'
            },
            LESSONS_DESCRIPTION: {
                name: 'Поменять описания уроков',
                code: `// ${METABASE_URL}/question/46496?course=10609
let pairs = [
    // [course_id, lesson_id, description],
    [10609, 334874, \`Описание урока\`],
];
let win = await createWindow(-1);
for (let [courseId, lessonId, lessonName] of pairs) {
    log(\`$\{courseId}, $\{lessonId}\`);
    let url = \`/admin/courses/$\{courseId}/lessons/$\{lessonId}\`;
    let fields = {
        '_method': 'patch',
        'lesson[themes_as_text]': lessonName,
    };
    await win.postFormData(url, fields, { successAlertIsNessesary: false });
}`,
                parent: 'adminLessons'
            },
            LESSONS_PREPARATION_LINKS: {
                name: 'Добавление ссылки в подготовительные материалы',
                code: `// ${METABASE_URL}/question/46496?course=10609
let lessonIds = splitString(\`
000000
000000
000000
\`);
let linkName = 'Ссылка на распечатки';
let linkUrl = 'https://foxford.yonote.ru/share/fedaa471-6cc8-4923-a50f-dd28a919c266/doc/matematika-mi-moro-Tk8Le2S5ar';
let win = await createWindow(-1);
for (let lessonId of lessonIds) {
    log(lessonId);
    let url = \`/admin/lessons/$\{lessonId}/preparation_materials\`;
    let fields = {
        '_method': 'patch',
        'lesson[material_links_attributes][0][name]': linkName,
        'lesson[material_links_attributes][0][url]': linkUrl,
    };
    await win.postFormData(url, fields);
}`,
                parent: 'contentLessons'
            },
            GROUP_CHANGE_DATES: {
                name: 'Изменить даты начала занятий',
                description: `в курсах с асинхронным доступом сохраняет статус finished
                    можно поставить только будущую дату`,
                code: `// ${METABASE_URL}/question/49703?course=10609
let pairs = [
    // [course_id, group_id, starts_at]
    [10609, 734410, '01.10.2026 10:00'],
];
let win = await createWindow(-1);
for (let [courseId, groupId, startsAt] of pairs) {
    log(\`$\{courseId} -> $\{groupId}, $\{startsAt}\`);
    let url = \`/admin/courses/$\{courseId}/groups/$\{groupId}\`;
    let fields = {
        '_method': 'patch',
        'group[starts_at]': startsAt,
    };
    await win.postFormData(url, fields, { successAlertIsNessesary: false });
}`,
                parent: 'groups'
            },
            RESET_SCHEDULE: {
                name: 'Перестроить параллели',
                code: `// ${METABASE_URL}/question/46579
let pairs = [
    // [group_template_id, from_lesson_number, start_from_date],
    [18068,132,'04.09.2026'],
    [26074,74,'07.09.2026'],
];
let win = await createWindow(-1);
for (let [groupTemplateId, fromLessonNumber, startFromDate] of pairs) {
    log(\`$\{groupTemplateId}, $\{fromLessonNumber} <- $\{startFromDate}\`);
    let url = \`/admin/group_templates/$\{groupTemplateId}/reset_schedule\`;
    let fields = {
        'from_lesson_number': fromLessonNumber,
        'start_from_date': startFromDate
    };
    await win.postFormData(url, fields);
}`,
                parent: 'groups'
            },
            GROUP_TEMPLATES_EDIT: {
                name: 'Изменить настройки параллели',
                code: `// https://disk.360.yandex.ru/i/MPt5jaaU-LXpDw
let templatesData = [
    // заменить на нужные данные в формате
    // {
    //     'course_id': 10609,
    //     'group_template_id': 18068,
    //     'week_day_slots': [2, 3],
    //     'time_slots': ['8:00:00', '9:00'],
    //     'starts_at': '02.09.2025',
    //     'teacher_id': 2063,
    //     'agent_id': 12345,
    //     'users_limit': 150,
    //     'destroy': [1234, 2345],
    //     'destroy_info': ['(1,08:00)', '(3,05:00)'],
    //     'location':[5, 1, 27]
    // },
    
];
let basicFields = {
    '_method': 'patch',
    'reset_schedule_reason': 'other',
    'group_template[schedule_hidden]': false,
};
let win = await createWindow(-1);

function normalizeTime(timeStr) { // убираем секунды и добавляем ведущий 0
    return timeStr.split(':').slice(0, 2).join(':').replace(/^(\d{1}):/, '0$1:');
}
function parseDestroyInfo(str) {
    let match = str.match(/\\((\\d+),(\\d{1,2}:\\d{2})(:\\d{2})?\\)/);
    if (!match) return null;
    return {
        day: parseInt(match[1]),
        time: normalizeTime(match[2])
    };
}
function add3HoursWithDay(day, timeStr) {
    let [hours, minutes] = timeStr.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes + 180;
    let daysToAdd = Math.floor(totalMinutes / (24 * 60));
    totalMinutes %= 24 * 60;
    let newHours = Math.floor(totalMinutes / 60);
    let newMinutes = totalMinutes % 60;
    let newDay = (day + daysToAdd) % 7;
    return {
        day: newDay,
        time: \`$\{String(newHours).padStart(2, '0')}:$\{String(newMinutes).padStart(2, '0')}\`
    };
}

for (let templateData of templatesData) {
    log(\`$\{templateData.course_id}, $\{templateData.group_template_id}\`);
    let url = 
        \`/admin/courses/$\{templateData.course_id}/group_templates/$\{templateData.group_template_id}\`;
    let slotsMap = new Map();
    if (templateData.week_day_slots) {
        for (let i = 0; i < templateData.week_day_slots.length; i++) {
            let day = templateData.week_day_slots[i];
            let time = normalizeTime(
                templateData.time_slots[Math.min(i, templateData.time_slots.length - 1)]
            );
            let key = \`$\{day}-$\{time}\`;
            slotsMap.set(key, { type: 'active', day, time });
        }
    }
    let destroySlots = [];
    if (templateData.destroy && templateData.destroy_info) {
        for (let i = 0; i < templateData.destroy.length; i++) {
            let id = templateData.destroy[i];
            let info = parseDestroyInfo(templateData.destroy_info[i]);
            if (!info) continue;
            let adjusted = add3HoursWithDay(info.day, info.time);
            let key = \`$\{adjusted.day}-$\{adjusted.time}\`;
            if (slotsMap.has(key)) {
                slotsMap.get(key).id = id;
            } else {
                destroySlots.push({ id, day: adjusted.day, time: adjusted.time });
            }
        }
    }
    let dynamicFields = {};
    let slotIndex = 0;
    for (let [key, slot] of slotsMap.entries()) {
        dynamicFields[\`group_template[week_days_attributes][$\{slotIndex}][slot][week_day]\`] = slot.day;
        dynamicFields[\`group_template[week_days_attributes][$\{slotIndex}][slot][time]\`] = slot.time;
        if (slot.id) { // если слот с таким временем уже есть, сохраняем его через id
            dynamicFields[\`group_template[week_days_attributes][$\{slotIndex}][id]\`] = slot.id;
        }
        slotIndex++;
    }
    for (let slot of destroySlots) {
        dynamicFields[\`group_template[week_days_attributes][$\{slotIndex}][_destroy]\`] = '1';
        dynamicFields[\`group_template[week_days_attributes][$\{slotIndex}][id]\`] = slot.id;
        slotIndex++;
    }
    if (templateData.destroy && !templateData.destroy_info) {
        for (let id of templateData.destroy) {
            dynamicFields[\`group_template[week_days_attributes][$\{slotIndex}][_destroy]\`] = '1';
            dynamicFields[\`group_template[week_days_attributes][$\{slotIndex}][id]\`] = id;
            slotIndex++;
        }
    }
    let params = ['starts_at', 'teacher_id', 'agent_id', 'users_limit'];
    for (let param of params) {
        if (templateData[param]) {
            dynamicFields[\`group_template[$\{param}]\`] = templateData[param];
        }
    }
    if (templateData.location) {
        let locationFields = {
            0: 'group_template[default_location_id]',
            1: 'group_template[default_format_id]',
            2: 'group_template[default_studio_id]',
            3: 'group_template[default_admin_id]'
        };
        for (let i = 0; i < templateData.location.length; i++) {
            if (i < 4) {
                dynamicFields[locationFields[i]] = templateData.location[i];
            }
        }
    }
    await win.postFormData(url, Object.assign({}, basicFields, dynamicFields));
}`,
                parent: 'groups'
            },
            LOCATION_EDIT: {
                name: 'Изменить локации',
                description: 'в настройках параллели и всех занятиях, соответствующих определенному слоту',
                code: `// https://disk.360.yandex.ru/i/CFYefGrjHdfGIg
// ${METABASE_URL}/question/47547?teacher_id=2363&school_year=2025
let templatesData = [
    // вставить из таблицы
    { 'course_id': 10609, 'group_template_id': 26074, 'slot_id': 44141, 'location': [5, 1, 27] },

];
let basicFieldsTemplate = {
    '_method': 'patch',
    'reset_schedule_reason': 'other',
    'group_template[schedule_hidden]': false,
};
let basicFieldsDev = {
    '_method': 'put'
}
let win = await createWindow(-1);
let locationFields = {
    0: 'location_id',
    1: 'format_id',
    2: 'studio_id',
    3: 'admin_id'
};
for (let templateData of templatesData) {
    log(\`Курс $\{templateData.course_id}, параллель $\{templateData.group_template_id}\`);
    if (templateData.slot_id) log(\`Слот $\{templateData.slot_id}\`); 
    let urlTemplate = \`/admin/courses/$\{templateData.course_id}/group_templates/$\{templateData.group_template_id}\`;
    let dynamicFieldsTemplate = {};
    for (let i = 0; i < templateData.location.length; i++) {
        dynamicFieldsTemplate[\`group_template[default_$\{locationFields[i]}]\`] = templateData.location[i];
    }
    await win.postFormData(urlTemplate, Object.assign({}, basicFieldsTemplate, dynamicFieldsTemplate));
    let urlDev = '/admin/dev_services/week_day_webinars_settings';
    let dynamicFieldsDev = {
        'week_day_webinars_settings[group_template_id]': templateData.group_template_id
    };
    if (templateData.slot_id) {
        dynamicFieldsDev['week_day_webinars_settings[week_day_id]'] = templateData.slot_id;
    }
    else {
        dynamicFieldsDev['week_day_webinars_settings[all_days]'] = 'true';
    }
    for (let i = 0; i < templateData.location.length; i++) {
        dynamicFieldsDev[\`week_day_webinars_settings[$\{locationFields[i]}]\`] = templateData.location[i];
    }
    await win.postFormData(urlDev, Object.assign({}, basicFieldsDev, dynamicFieldsDev));
}`,
                parent: 'groups'
            },
            UP_DUPLICATE: {
                name: 'Скопировать материалы между УП',
                description: 'Указать true или false для каждого материала',
                code: `let sourceId = 733; // ID УП откуда
let targetId = 1162; // ID УП куда
let settings = {
    'Модули + уроки': true,
    'Задачи': true,
    'Рекомендованность к ДЗ': true,
    'Рекомендации (методические)': true,
    'Презентации': true,
    'Файлы (методические)': true,
    'Рекомендации (подготовительные)': true,
    'Ссылки': true,
    'Файлы (подготовительные)': true
};
let virtualWindow = await createWindow(-1);
let hasConstraint = false;

function getBlockLinks(virtualWindow) { return getTableLinks(virtualWindow, '.methodical_materials_blocks_table'); }
async function getBlocks(virtualWindow) {
    let blocks = [];
    let blockLinks = getBlockLinks(virtualWindow);
    for (let blockLink of blockLinks) {
        await virtualWindow.openPage(blockLink);
        blocks.push({
            link: blockLink, name: virtualWindow.getElementValue('#methodical_materials_block_name'),
            unitLinks: getTableLinks(virtualWindow), unitNames: getTableTexts(virtualWindow),
        });
    }
    return blocks;
}

log('-- Ищу уроки в первой УП --');
await virtualWindow.openPage(\`/admin/methodical_materials/programs/$\{sourceId}/edit\`);
let sourceBlocks = await getBlocks(virtualWindow);
log('-- Ищу модули во второй УП --');
await virtualWindow.openPage(\`/admin/methodical_materials/programs/$\{targetId}/edit\`);
let targetBlockLinks = getBlockLinks(virtualWindow);
/****************************************************************/
if (settings['Модули + уроки']) {
    if (targetBlockLinks.length != 0) { displayLog('УП не пустой, создание уроков невозможно', 'warning'); }
    else {
        log('-- Создаю модули --');
        for (let block of sourceBlocks) {
            await virtualWindow.postFormData(
                \`/admin/methodical_materials/programs/$\{targetId}/blocks\`,
                { 'methodical_materials_block[name]': block.name }
            );
        }
        await virtualWindow.openPage(\`/admin/methodical_materials/programs/$\{targetId}/edit\`);
        targetBlockLinks = getBlockLinks(virtualWindow);
        /****************************************************************/
        if (targetBlockLinks.length != sourceBlocks.length) { log('Создались не все модули, что-то пошло не так)'); }
        else {
            log('-- Создаю уроки --');
            for (let blockInd = 0; blockInd < sourceBlocks.length; blockInd++) {
                let sourceBlock = sourceBlocks[blockInd];
                let targetBlockLink = targetBlockLinks[blockInd];
                for (let linkInd = 0; linkInd < sourceBlock.unitLinks.length; linkInd++) {
                    let unitName = sourceBlock.unitNames[linkInd];
                    let createUnitLink = targetBlockLink.replace(/\\/programs\\/\\d+(\\/blocks\\/\\d+)\\/edit$/, '$1/units');
                    await virtualWindow.postFormData(createUnitLink, { 'methodical_materials_unit[name]': unitName });
                }
            }
        }
    }
}
/****************************************************************/
await virtualWindow.openPage(\`/admin/methodical_materials/programs/$\{targetId}/edit\`);
let targetBlocks = await getBlocks(virtualWindow);
if (sourceBlocks.length != targetBlocks.length) {
    displayLog('Количество модулей не совпадает, выполнение скрипта невозможно', 'danger');
    hasConstraint = true;
}
else {
    for (let blockInd = 0; blockInd < sourceBlocks.length; blockInd++) {
        if (sourceBlocks[blockInd].unitLinks.length != targetBlocks[blockInd].unitLinks.length) {
            displayLog(
                \`Количество уроков в модуле $\{blockInd + 1} не совпадает, выполнение скрипта невозможно\`, 'danger'
            );
            hasConstraint = true;
            break;
        }
    }
}
/****************************************************************/
if (!hasConstraint) {
    log('-- Начинаю обработку --');
    for (let blockInd = 0; blockInd < sourceBlocks.length; blockInd++) {
        for (let unitInd = 0; unitInd < sourceBlocks[blockInd].unitLinks.length; unitInd++) {
            let sourceUnitLink = sourceBlocks[blockInd].unitLinks[unitInd];
            let targetUnitLink = targetBlocks[blockInd].unitLinks[unitInd];
            log(\`$\{sourceUnitLink} -> $\{targetUnitLink}\`);
            await copyMethodicalMaterials(virtualWindow, sourceUnitLink, targetUnitLink, settings);
        }
    }
}`,
                parent: 'methodicalPrograms'
            },
            UP_MODULES_DUPLICATE: {
                name: 'Скопировать материалы между модулями УП',
                description: 'Указать true или false для каждого материала',
                code: `let sourceIds = [733, 3101]; // [ID УП, ID модуля] откуда
let targetIds = [1162, 4083]; // [ID УП, ID модуля] куда
let settings = {
    'Уроки': true,
    'Задачи': true,
    'Рекомендованность к ДЗ': true,
    'Рекомендации (методические)': true,
    'Презентации': true,
    'Файлы (методические)': true,
    'Рекомендации (подготовительные)': true,
    'Ссылки': true,
    'Файлы (подготовительные)': true
};
let virtualWindow = await createWindow(-1);

async function getBlock(virtualWindow, programId, blockId) {
    let blockLink = \`/admin/methodical_materials/programs/$\{programId}/blocks/$\{blockId}/edit\`;
    await virtualWindow.openPage(blockLink);
    return {
        link: blockLink, name: virtualWindow.getElementValue('#methodical_materials_block_name'),
        unitLinks: getTableLinks(virtualWindow), unitNames: getTableTexts(virtualWindow)
    };
}

log('-- Получаю данные исходного модуля --');
let sourceBlock = await getBlock(virtualWindow, sourceIds[0], sourceIds[1]);
log('-- Получаю данные целевого модуля --');
let targetBlock = await getBlock(virtualWindow, targetIds[0], targetIds[1]);
/****************************************************************/
if (settings['Уроки'] && targetBlock.unitLinks.length === 0) {
    log('-- Создаю уроки в целевом модуле --');
    for (let unitName of sourceBlock.unitNames) {
        let createUnitLink = targetBlock.link.replace(/\\/programs\\/\\d+(\\/blocks\\/\\d+)\\/edit$/, '$1/units');
        await virtualWindow.postFormData(createUnitLink, { 'methodical_materials_unit[name]': unitName });
    }
    targetBlock = await getBlock(virtualWindow, targetIds[0], targetIds[1]);
}
/****************************************************************/
if (sourceBlock.unitLinks.length !== targetBlock.unitLinks.length) {
    displayLog(\`Количество уроков не совпадает. Выполнение скрипта невозможно\`, 'danger');
}
else {
    log('-- Начинаю обработку --');
    for (let unitInd = 0; unitInd < sourceBlock.unitLinks.length; unitInd++) {
        let sourceUnitLink = sourceBlock.unitLinks[unitInd];
        let targetUnitLink = targetBlock.unitLinks[unitInd];
        log(\`Обрабатываю урок $\{unitInd + 1}: $\{sourceUnitLink} -> $\{targetUnitLink}\`);
        await copyMethodicalMaterials(virtualWindow, sourceUnitLink, targetUnitLink, settings);
    }
}`,
                parent: 'methodicalPrograms'
            },
            UP_TAGING: {
                name: 'Тегирование УП',
                code: `// Выгрузить тегирование из курса:
// ${METABASE_URL}/question/48991
let methodicalProgramId = 738; // ID УП
let resultIds = splitString(\`
8219
8249
8252
\`);
let win = await createWindow(-1);
for (let resultId of resultIds) {
    log(resultId);
    let url = \`/admin/methodical_materials/programs/$\{methodicalProgramId}/rubricator_results\`;
    let fields = {
        'result_id': resultId,
    };
    await win.postFormData(url, fields, { successAlertIsNessesary: false });
}`,
                parent: 'methodicalPrograms'
            },
            COURSE_TAGING: {
                name: 'Тегирование курсов',
                code: `// Выгрузить тегирование из курса:
// ${METABASE_URL}/question/48991
let courseId = 10609; // ID курса куда переносим
let resultIds = splitString(\`
8219
8249
8252
\`);
let win = await createWindow(-1);
for (let resultId of resultIds) {
    log(resultId);
    let url = \`/admin/courses/$\{courseId}/rubricator_results\`;
    let fields = {
        'result_id': resultId,
    };
    await win.postFormData(url, fields, { successAlertIsNessesary: false });
}`,
                parent: 'contentCourses'
            },
            PROMO_CODE_DELETE: {
                name: 'Удалить промокоды',
                code: `// ${METABASE_URL}/question/49702?code_campaign_id=33050
let promoIds = splitString(\`
23982547
23982626
\`);
let codeCampaignId = 33050; 
let win = await createWindow(-1);
for (let promoId of promoIds) {
    log(\`$\{codeCampaignId}, $\{promoId}\`);
    let url = \`/admin/marketing/code_campaigns/$\{codeCampaignId}/promo_codes/$\{promoId}\`;
    let fields = {
        '_method': 'delete',
    };
    await win.postFormData(url, fields);
}`,
                parent: 'codeCampaigns'
            },
            PRODUCT_PACK_APPEND_COURSES: {
                name: 'Привязка курсов к пакам',
                description: `укажите accessType: premium или standard для паков;
                    specific_date_premium или specific_date_standard для подписок`,
                code: `let accessType = 'premium';
const productPackData = {
    // productPackId : [courseId, courseId, ...],
    8593: [10609, 15005, 12345, 12346],
    12527: splitString(\`10609 15005\`),
};
let fields = {
    '_method': 'post',
};
let win = await createWindow(-1);
for (let productPackId in productPackData) {
    for (let courseId of productPackData[productPackId]) {
        log(\`$\{productPackId} <- $\{courseId}\`);
        let url = \`/admin/product_packs/$\{productPackId}/product_pack_items?\` +
            \`product_pack_item%5Baccess_name%5D=$\{accessType}&product_pack_item%5Bresource_id%5D=$\{courseId}\` +
            \`&product_pack_item%5Bresource_type%5D=Course\`;
        await win.postFormData(url, fields);
    }
}`,
                parent: 'productPacks'
            },
            HOLIDAYS_DSH_1_8: {
                name: 'Проставление каникул ДШ 1-8 кл. (2025-2026)',
                code: `let courseIds = splitString(\`
10609
\`);
let win = await createWindow(-1);
for (let courseId of courseIds) {
    log(courseId);
    let url = \`/admin/courses/$\{courseId}/holidays_calendar\`;
    let fields = {
        '_method': 'patch',
        'holidays[]': [
            '2025-10-06 — 2025-10-10',
            '2025-11-03 — 2025-11-04',
            '2025-11-17 — 2025-11-21',
            '2025-12-29 — 2026-01-09',
            '2026-02-23 — 2026-02-27',
            '2026-03-09 — 2026-03-09',
            '2026-04-06 — 2026-04-10',
            '2026-05-01 — 2026-05-01',
        ]
    }
    await win.postFormData(url, fields);
}`,
                parent: 'holidays'
            },
            ADD_LESSONS: {
                name: 'Добавить одинаковые уроки в курсы',
                description: 'Не более 30 занятий за один запуск скрипта',
                code: `let courseIds = splitString(\`
10609
15005
\`);
let lessonCount = 1; // количество добавляемых занятий в каждый курс
let lessonName = 'Название занятия';
let lessonDescription = \`Описание занятия\`;
let lessonFree = true; // true - занятие бесплатное, false - платное
let lessonTest = false // true - занятие без вебинара, false - обычное
let lessonType = 'regular'; // 'Нулевое': 'zero', 'Обычное': 'regular', 'Тест': 'training', 'Видео': 'video', 
// 'Пробный экзамен': 'exam_rehearsal', 'Только задачи': 'only_tasks', 'Перевёрнутое': 'flipped'
let win = await createWindow(-1);
for (let courseId of courseIds) {
    log(\`$\{courseId}\`);
    let url = \`/admin/courses/$\{courseId}/lessons\`;
    let fields = {
        'lesson[course_id]': courseId,
        'lesson[name]': lessonName,
        'lesson[themes_as_text]': lessonDescription,
        'lesson[free]': lessonFree,
        'lesson[test]': lessonTest,
        'lesson[lesson_type]': lessonType,
        'new_lesson_count': lessonCount,
    };
    await win.postFormData(url, fields);
}`,
                parent: 'adminLessons'
            },
            REPLACE_TEACHER_IN_GROUPS: {
                name: 'Изменить преподавателя в занятиях',
                description: 'работает в том числе в прошедших уроках',
                code: `// ${METABASE_URL}/question/49703?course=10609
let pairs = [
    // [course_id, group_id, teacher_id]
    [10609, 734410, 2363],
];
let win = await createWindow(-1);
for (let [courseId, groupId, teacherId] of pairs) {
    log(\`$\{courseId} -> $\{groupId}, $\{teacherId}\`);
    let url = \`/admin/courses/$\{courseId}/groups/$\{groupId}\`;
    let fields = {
        '_method': 'patch',
        'group[teacher_id]': teacherId,
    };
    await win.postFormData(url, fields, { successAlertIsNessesary: false });
}`,
                parent: 'groups'
            },
            CHANGE_GROUP_DATES: {
                name: 'Поменять даты в занятиях без вебинара',
                description: `можно проставить в том числе прошедшую дату
                    можно указать занятия во всех параллелях или оставить только часть`,
                code: `// ${METABASE_URL}/question/51042
let starts_at = '24.10.2023 10:00';
const pairs = [
    // course_id, lesson_id, [group_id1, group_id2...]
    [10609, 313900, [710456, 955552]],
];
let win = await createWindow(-1);
for (const [courseId, lessonId, groupIds] of pairs) {
    log(\`$\{courseId}, $\{lessonId}\`);
    const url = \`/admin/courses/$\{courseId}/lessons/$\{lessonId}/change_group_dates\`;
    let arr = [];
    for (let groupId of groupIds) {
        arr.push({ id: groupId, starts_at: starts_at })
    }
    await win.postFormDataJSON(url, { groups: arr });
}`,
                parent: 'lessonsOrder'
            },
            CHANGE_TRAINING_NAME: {
                name: 'Изменение названий тестов',
                code: `let pairs = [
    // [training_id, name],
    [10092, 'Тест отдела видеотрансляций'],
];
let win = await createWindow(-1);
for (let [trainingId, newName] of pairs) {
    log(\`$\{trainingId} <- $\{newName}\`);
    let url = \`/admin/trainings/$\{trainingId}\`;
    let fields = {
        '_method': 'patch',
        'training[name]': newName,
    };
    await win.postFormData(url, fields);
}`,
                parent: 'trainings'
            },
        }
        sections = buildSectionsRecursive(form, sectionsStructure);
        for (let key in SCRIPTS) {
            createActionButton(SCRIPTS[key], key);
        }

        currentWindow.addStyle(`
        .collapsible {
            background-color: #eef;
            color: #444;
            cursor: pointer;
            padding: 12px;
            margin: 4px 0px 4px 0px;
            width: 100%;
            border: none;
            outline: none;
            font-size: 15px;
        }`)
        currentWindow.addStyle(`
        .inside-collapsible {
            padding: 0 3vw;
            display: block;
            overflow: hidden;
        }`)
        currentWindow.addStyle(`
        .outside-collapsible {
            padding: 0;
        }`)
    }
    // на главной странице админки
    if (currentWindow.checkPath(pagePatterns.index)) {
        let mainPage = currentWindow.querySelector('.main-page');
        let loopButton = mainPage.querySelector('.btn-default');
        let yonoteButton = loopButton.cloneNode(true);
        let foxButton = loopButton.cloneNode(true);
        let fvsButton = loopButton.cloneNode(true);
        loopButton.className += ' loop';
        yonoteButton.className += ' yonote';
        fvsButton.className += ' fvs';
        foxButton.className += ' fox';
        loopButton.href = 'https://foxford.loop.ru/foxford/channels/c04um2g2h6e';
        yonoteButton.href = 'https://foxford.yonote.ru/doc/adminy-uchebnoj-platformy-WH5s3sfbLA';
        fvsButton.href = 'https://next.fvs.foxford.ru/id/hub';
        foxButton.href = SECRET_PAGE;
        loopButton.firstChild.src = 'https://uploads-foxford-ru.ngcdn.ru/uploads/inner_file/file/287601/loop.png';
        yonoteButton.firstChild.src = 'https://uploads-foxford-ru.ngcdn.ru/uploads/inner_file/file/287609/yonote.png';
        fvsButton.firstChild.src = 'https://uploads-foxford-ru.ngcdn.ru/uploads/inner_file/file/287608/fvs.png';
        foxButton.firstChild.src = 'https://uploads-foxford-ru.ngcdn.ru/uploads/inner_file/file/287602/fox.png';
        mainPage.appendChild(yonoteButton);
        mainPage.appendChild(fvsButton);
        mainPage.appendChild(foxButton);
        mainPage.querySelector('p').innerHTML +=
            `<br>Установлены скрипты Tampermonkey 2.0 (v.0.2.0.101 от 28 октября 2025)
            <br>Примеры скриптов можно посмотреть 
            <a href="https://github.com/maxina29/tm-2-adminka/tree/main/scripts_examples" target="_blank">здесь</a>
            <br><a href="/tampermoney_script_adminka.user.js" target="_blank">Обновить скрипт</a>`;
        currentWindow.log('Страница модифицирована');
    }
    await fillFormFromSearchParams();
})();

