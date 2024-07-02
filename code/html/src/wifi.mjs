import {
    fromSchema,
    groupSettingsOnAdd,
    variableListeners,
} from './settings.mjs';

import { addFromTemplate } from './template.mjs';
import { moreElem } from './core.mjs';
import { sendAction } from './connection.mjs';

/**
 * @param {boolean?} showMore
 * @param {any?} cfg
 */
function addNode(showMore = false, cfg = undefined) {
    const container = document.getElementById("networks");
    if (!container) {
        return;
    }

    addFromTemplate(container, "network-config", cfg);
    if (showMore && container.lastChild instanceof HTMLElement) {
        moreElem(container.lastChild)
    }
}

/** @param {function(HTMLTableElement): void} callback */
function withTable(callback) {
    const table = document.getElementById("scanResult");
    if (!(table instanceof HTMLTableElement)) {
        return;
    }

    callback(table);
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
    const loading = document.querySelector("div.scan.loading");
    if (loading instanceof HTMLElement) {
        loading.style.display = value ? "table" : "none";
    }
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
 * @typedef {import('./settings.mjs').KeyValueListeners } KeyValueListeners
 */

/**
 * @returns {KeyValueListeners}
 */
function listeners() {
    return {
        "wifiConfig": (_, value) => {
            const container = document.getElementById("networks");
            if (!(container instanceof HTMLElement)) {
                return;
            }

            if (value.max !== undefined) {
                container.dataset["settingsMax"] = value.max;
            }

            const networks = value.networks;
            if (!Array.isArray(networks)) {
                return;
            }

            networks.forEach((entries) => {
                addNode(false, fromSchema(entries, value.schema));
            });
        },
        "scanResult": (_, value) => {
            scanResult(value);
        },
    };
}

export function init() {
    variableListeners(listeners());

    groupSettingsOnAdd("networks", () => {
        addNode();
    });

    withButton((button) => {
        button.addEventListener("click", scanStart);
    });
}
