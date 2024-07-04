import {
    groupSettingsOnAddElem,
    variableListeners,
} from './settings.mjs';

import { addFromTemplate, addFromTemplateWithSchema } from './template.mjs';
import { moreElem } from './core.mjs';
import { sendAction } from './connection.mjs';

/** @param {function(HTMLElement): void} callback */
function withNetworks(callback) {
    callback(/** @type {!HTMLElement} */
        (document.getElementById("networks")));
}

/**
 * @param {HTMLElement} elem
 */
function lastMoreElem(elem) {
    if (elem.lastChild instanceof HTMLElement) {
        moreElem(elem.lastChild)
    }
}

/**
 * @param {any} value
 */
function onConfig(value) {
    withNetworks((elem) => {
        addFromTemplateWithSchema(
            elem, "network-config",
            value.networks, value.schema,
            value.max ?? 0);
        lastMoreElem(elem);
    });
}

/**
 * @param {HTMLElement} elem
 */
function networkAdd(elem) {
    addFromTemplate(elem, "network-config", {});
}

/** @param {function(HTMLTableElement): void} callback */
function withTable(callback) {
    callback(/** @type {!HTMLTableElement} */
        (document.getElementById("scanResult")));
}

/** @param {function(HTMLInputElement): void} callback */
function withButton(callback) {
    /** @type {NodeListOf<HTMLInputElement>} */
    (document.querySelectorAll("input.button-wifi-scan"))
        .forEach(callback);
}

/** @param {boolean} value */
function buttonDisabled(value) {
    withButton((button) => {
        button.disabled = value;
    });
}

/** @param {boolean} value */
function loadingDisplay(value) {
    const loading = (/** @type {!HTMLDivElement} */
        (document.querySelector("div.scan.loading")));
    loading.style.display = value ? "table" : "none";
}

/** @param {string[]} values */
function scanResult(values) {
    withTable((table) => {
        buttonDisabled(false);
        loadingDisplay(false);
        table.style.display = "table";

        const [results] = table.tBodies;
        const row = results.insertRow();
        for (let value of values) {
            const cell = row.insertCell();
            cell.appendChild(document.createTextNode(value));
        }
    });
}

/** @param {Event} event */
function scanStart(event) {
    event.preventDefault();

    withTable((table) => {
        const [results] = table.tBodies;
        while (results.rows.length) {
            results.deleteRow(0);
        }

        loadingDisplay(true);
        buttonDisabled(true);

        sendAction("scan");
    });
}

/**
 * @returns {import('./settings.mjs').KeyValueListeners}
 */
function listeners() {
    return {
        "wifiConfig": (_, value) => {
            onConfig(value);
        },
        "scanResult": (_, value) => {
            scanResult(value);
        },
    };
}

export function init() {
    withNetworks((elem) => {
        variableListeners(listeners());
        // TODO: as event arg?
        groupSettingsOnAddElem(elem, () => {
            networkAdd(elem);
        });
        withButton((button) => {
            button.addEventListener("click", scanStart);
        });
    });
}
