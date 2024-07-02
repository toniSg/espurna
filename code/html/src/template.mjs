// Generic parts of the HTML are placed into <template> container, which requires
// us to 'import' it into the currently loaded page to actually use it.
// (and notice that document.querySelector(...) won't be able to read inside of these)

import {
    initEnumerableSelect,
    initSelect,
    onGroupSettingsDel,
    setInputValue,
    setOriginalsFromValuesForNode,
    setSelectValue,
    setSpanValue,
} from './settings.mjs';

import { moreElem } from './core.mjs';

/**
 * @param {Event} event
 */
function moreParent(event) {
    event.preventDefault();
    event.stopPropagation();

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    const parent = target?.parentElement?.parentElement;
    if (parent) {
        moreElem(parent);
    }
}

/**
 * @param {string} name
 * @returns {DocumentFragment}
 */
export function loadTemplate(name) {
    const template = /** @type {HTMLTemplateElement} */
        (document.getElementById(`template-${name}`));
    return document.importNode(template.content, true);
}

/** @import { InputOrSelect } from './settings.mjs' */

/**
 * @param {string} name
 * @returns {DocumentFragment}
 */
export function loadConfigTemplate(name) {
    const template = loadTemplate(name);
    for (let elem of /** @type {NodeListOf<InputOrSelect>} */(template.querySelectorAll("input,select"))) {
        elem.dataset["settingsGroupElement"] = "true";
    }

    for (let elem of template.querySelectorAll("button.button-del-settings-group")) {
        elem.addEventListener("click", onGroupSettingsDel);
    }

    for (let elem of template.querySelectorAll("button.button-more-parent")) {
        elem.addEventListener("click", moreParent);
    }

    for (let elem of /** @type {NodeListOf<HTMLSelectElement>} */(template.querySelectorAll("select.enumerable"))) {
        initEnumerableSelect(elem, initSelect);
    }

    return template;
}

/** @typedef {InputOrSelect | HTMLSpanElement} TemplateLineElement */

/**
 * @import { DisplayValue } from './settings.mjs'
 * @param {DocumentFragment} fragment
 * @param {number} id
 * @param {{[k: string]: DisplayValue}} cfg
 */
export function fillTemplateFromCfg(fragment, id, cfg) {
    let local = {"template-id": id};
    if (cfg === undefined) {
        cfg = {};
    }

    Object.assign(local, cfg);
    cfg = local;

    for (let elem of /** @type {NodeListOf<TemplateLineElement>} */(fragment.querySelectorAll("input,select,span"))) {
        const key =
           ((elem instanceof HTMLInputElement)
         || (elem instanceof HTMLSelectElement))
                ? (elem.name) :
            (elem instanceof HTMLElement)
                ? elem.dataset["key"]
                : "";

        if (!key) {
            continue;
        }

        const value = cfg[key];
        if ((value === undefined) || (value === null)) {
            continue;
        }

        const is_array = Array.isArray(value);
        if (!is_array && elem instanceof HTMLInputElement) {
            setInputValue(elem, value);
        } else if (!is_array && elem instanceof HTMLSelectElement) {
            setSelectValue(elem, value);
        } else if (elem instanceof HTMLSpanElement) {
            setSpanValue(elem, value);
        }
    }

    setOriginalsFromValuesForNode(fragment);
}

/**
 * @param {HTMLElement} target
 * @param {DocumentFragment} template
 */
export function mergeTemplate(target, template) {
    for (let child of Array.from(template.children)) {
        target.appendChild(child);
    }
}

/**
 * @param {HTMLElement} container
 * @param {string} name
 * @param {any} cfg
 */
export function addFromTemplate(container, name, cfg) {
    const fragment = loadConfigTemplate(name);
    fillTemplateFromCfg(fragment, container.childElementCount, cfg);
    mergeTemplate(container, fragment);
}
