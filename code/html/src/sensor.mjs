import { sendAction } from './connection.mjs';

import {
    showPanelByName,
    styleInject,
    styleVisible,
} from './core.mjs';

import {
    addEnumerables,
    prepareEnumerableTarget,
    listenEnumerableName,
    listenEnumerableTarget,
    initSelect,
    setChangedElement,
    setOriginalFromValue,
    setSelectValue,
    variableListeners,
} from './settings.mjs';

import {
    fromSchema,
    loadTemplate,
    mergeTemplate,
    NumberInput,
} from './template.mjs';

/**
 * @typedef Magnitude
 * @property {string} description
 * @property {number} index_global
 * @property {string} name
 * @property {number} type
 * @property {number} units
*/

/** @typedef {[number, string]} SupportedUnits */

const Magnitudes = {
    /** @type {Map<number, Magnitude>} */
    properties: new Map(),

    /** @type {Map<number, string>} */
    errors: new Map(),

    /** @type {Map<number, string>} */
    types: new Map(),

    /** @type {Map<number, string>} */
    units: new Map(),

    /** @type {Map<number, number[]>} */
    supportedUnits: new Map(),

    /** @type {Map<number, string>} */
    typePrefix: new Map(),

    /** @type {Map<string, number>} */
    prefixType: new Map(),
};

/**
 * @param {Magnitude} magnitude
 * @param {string} name
 */
function magnitudeTypedKey(magnitude, name) {
    const prefix = Magnitudes.typePrefix
        .get(magnitude.type);
    const index = magnitude.index_global;
    return `${prefix}${name}${index}`;
}

/**
 * @param {number} type
 */
function magnitudeTypeName(type) {
    return Magnitudes.types.get(type)
        ?? type.toString();
}

/**
 * @param {number} type
 * @param {number} index
 */
function magnitudeName(type, index) {
    return `${magnitudeTypeName(type)} #${index}`;
}

/**
 * @param {HTMLElement} elem
 * @param {number} id
 */
function listenEnumerableMagnitudeDescription(elem, id) {
    prepareEnumerableTarget(elem, id, "magnitude");
    listenEnumerableName(elem, "magnitude",
        (elem) => {
            elem.textContent =
                Magnitudes.properties.get(id)?.description ?? "";
        });
}

/**
 * @param {string} prefix
 * @param {any[][]} values
 * @param {string[]} schema
 */
function initModuleMagnitudes(prefix, values, schema) {
    const container = document.getElementById(`${prefix}-magnitudes`);
    if (!container || container.childElementCount > 0) {
        return;
    }

    const template = new NumberInput();

    values.forEach((value, id) => {
        const magnitude = fromSchema(value, schema);

        mergeTemplate(container, template.with(
            (label, input, span) => {
                listenEnumerableTarget(label, id, "magnitude");

                input.min = "0";
                input.name = `${prefix}Magnitude`;
                input.required = true;
                input.value = /** @type {!number} */
                    (magnitude.index_module).toString();
                setOriginalFromValue(input);

                listenEnumerableMagnitudeDescription(span, id);
            }));
    });
}

/**
 * @param {any} types
 * @param {any} errors
 * @param {any} units
 */
function initMagnitudes(types, errors, units) {
    /** @type {[number, string, string][]} */
    (types.values).forEach((value) => {
        const info = fromSchema(value, types.schema);

        const type = /** @type {number} */(info.type);
        Magnitudes.types.set(type,
            /** @type {string} */(info.name));

        const prefix = /** @type {string} */(info.prefix);
        Magnitudes.typePrefix.set(type, prefix);
        Magnitudes.prefixType.set(prefix, type);

        const supported_units = /** @type {number[]} */(info.units);
        Magnitudes.supportedUnits.set(type, supported_units);
    });

    /** @type {[number, string][]} */
    (errors.values).forEach((value) => {
        const error = fromSchema(value, errors.schema);
        Magnitudes.errors.set(
            /** @type {number} */(error.type),
            /** @type {string} */(error.name));
    });

    /** @type {SupportedUnits[]} */
    (units.values).forEach((value) => {
        const unit = fromSchema(value, units.schema);
        Magnitudes.units.set(
            /** @type {number} */(unit.type),
            /** @type {string} */(unit.name));
    });
}

/**
 * @typedef {function(number, Magnitude): void} MagnitudeCallback
 * @param {any[]} values
 * @param {string[]} schema
 * @param {MagnitudeCallback[]} callbacks
 */
function initMagnitudesList(values, schema, callbacks) {
    /** @import { EnumerableEntry } from './settings.mjs' */

    /** @type {EnumerableEntry[]} */
    const enumerables = [];

    values.forEach((value, id) => {
        const magnitude = fromSchema(value, schema);

        const description = /** @type {string} */
            (magnitude.description);
        const index_global = /** @type {number} */
            (magnitude.index_global);
        const type = /** @type {number} */
            (magnitude.type);
        const units = /** @type {number} */
            (magnitude.units);

        const name = magnitudeName(type, index_global);

        /** @type {Magnitude} */
        const result = {
            description,
            index_global,
            name,
            type,
            units,
        };

        enumerables.push({
            id,
            name,
        });

        Magnitudes.properties.set(id, result);
        callbacks.forEach((callback) => {
            callback(id, result);
        });
    });

    addEnumerables("magnitude", enumerables);
}

/**
 * @param {number} id
 * @param {Magnitude} magnitude
 */
function createMagnitudeInfo(id, magnitude) {
    const container = document.getElementById("magnitudes");
    if (!container) {
        return;
    }

    const line = loadTemplate("magnitude-info");

    const label = /** @type {!HTMLLabelElement} */
        (line.querySelector("label"));
    label.textContent = magnitude.name;

    const input = /** @type {!HTMLInputElement} */
        (line.querySelector("input"));
    input.dataset["id"] = id.toString();
    input.dataset["type"] = magnitude.type.toString();

    const info = /** @type {!HTMLSpanElement} */
        (line.querySelector(".magnitude-info"));
    info.style.display = "none";

    const description = /** @type {!HTMLSpanElement} */
        (line.querySelector(".magnitude-description"));
    description.textContent = magnitude.description;

    mergeTemplate(container, line);
}

/**
 * @param {number} _id
 * @param {Magnitude} magnitude
 */
function createMagnitudeUnitSelector(_id, magnitude) {
    const container = document.getElementById("magnitude-units");
    if (!container) {
        return;
    }

    const line = loadTemplate("magnitude-units");

    const label = /** @type {!HTMLLabelElement} */
        (line.querySelector("label"));
    label.textContent =
        magnitudeName(magnitude.type, magnitude.index_global);

    const select = /** @type {!HTMLSelectElement} */
        (line.querySelector("select"));
    select.setAttribute("name",
        magnitudeTypedKey(magnitude, "Units"));

    const options = (Magnitudes.supportedUnits.get(magnitude.type) ?? [])
        .map((type) => ({
            'id': type,
            'name': Magnitudes.units.get(type) ?? type.toString()
        }));

    initSelect(select, options);
    setSelectValue(select, magnitude.units);
    setOriginalFromValue(select);

    container?.parentElement?.classList?.remove("maybe-hidden");
    mergeTemplate(container, line);
}

/**
 * @typedef {{id: number, name: string, key: string, prefix: string, index_global: number}} SettingInfo
 * @param {number} id
 * @param {string} suffix
 * @returns {SettingInfo | null}
 */
function magnitudeSettingInfo(id, suffix) {
    const props = Magnitudes.properties.get(id);
    if (!props) {
        return null;
    }

    const prefix = Magnitudes.typePrefix.get(props.type);
    if (!prefix) {
        return null;
    }

    const out = {
        id: id,
        name: props.name,
        key: `${prefix}${suffix}${props.index_global}`,
        prefix,
        index_global: props.index_global,
    };


    return out;
}

/**
 * @param {number} id
 * @returns {SettingInfo | null}
 */
function emonRatioInfo(id) {
    return magnitudeSettingInfo(id, "Ratio");
}

/** @typedef {{required?: boolean, min?: string, max?: string}} MagnitudeNumberOptions */

/**
 * @param {string} containerId
 * @param {number} id
 * @param {string} keySuffix
 * @param {number} value
 * @param {MagnitudeNumberOptions} options
 */
function initMagnitudeNumberSetting(containerId, id, keySuffix, value, {required = true, min = "", max = ""} = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    const info = magnitudeSettingInfo(id, keySuffix);
    if (!info) {
        return;
    }

    container?.parentElement?.classList?.remove("maybe-hidden");

    const template = new NumberInput();
    mergeTemplate(container, template.with(
        (label, input, span) => {
            label.textContent = info.name;
            label.htmlFor = info.key;

            input.id = info.key;
            input.name = info.key;
            input.required = required;
            input.min = min;
            input.max = max;
            input.value = value.toString();

            setOriginalFromValue(input);
            listenEnumerableMagnitudeDescription(span, id);
        }));
}

/**
 * @param {number} id
 */
function initMagnitudesExpected(id) {
    const container = document.getElementById("emon-expected");
    if (!container) {
        return;
    }

    const info = emonRatioInfo(id);
    if (!info) {
        return;
    }

    // TODO: also display currently read value?
    const template = loadTemplate("emon-expected");

    const [expected, result] = template.querySelectorAll("input");
    expected.name += info.key;
    expected.id = expected.name;
    expected.dataset["id"] = info.id.toString();

    result.name += info.key;
    result.id = result.name;

    const [label] = template.querySelectorAll("label");
    label.textContent = info.name;
    label.htmlFor = expected.id;

    styleInject([
        styleVisible(`.emon-expected-${info.prefix}`, true)
    ]);

    mergeTemplate(container, template);
}

function emonCalculateRatios() {
    const expected = document.getElementById("emon-expected")
        ?.querySelectorAll("input.emon-expected-input");
    if (!expected) {
        return;
    }

    /** @type {NodeListOf<HTMLInputElement>} */
    (expected).forEach((input) => {
        if (!input.value || !input.dataset["id"]) {
            return;
        }

        sendAction("emon-expected", {
            id: parseInt(input.dataset["id"], 10),
            expected: parseFloat(input.value) });
    });
}

function emonApplyRatios() {
    const results = document.getElementById("emon-expected")
        ?.querySelectorAll("input.emon-expected-result");

    /** @type {NodeListOf<HTMLInputElement>} */
    (results).forEach((result) => {
        if (!result.value) {
            return;
        }

        let next = result.name
            .replace("result:", "");

        const ratio = document.getElementById(next);
        if (!(ratio instanceof HTMLInputElement)) {
            return;
        }

        ratio.value = result.value;
        setChangedElement(ratio);

        result.value = "";

        next = result.name
            .replace("result:", "expected:");
        const expected = document.getElementById(next);
        if (!(expected instanceof HTMLInputElement)) {
            return;
        }

        expected.value = "";
    });

    showPanelByName("sns");
}

/**
 * @param {any[]} values
 * @param {string[]} schema
 */
function initMagnitudesSettings(values, schema) {
    values.forEach((value, id) => {
        const settings = fromSchema(value, schema);

        if (typeof settings.Ratio === "number") {
            initMagnitudeNumberSetting(
                "emon-ratios", id,
                "Ratio", settings.Ratio);
            initMagnitudesExpected(id);
        }

        if (typeof settings.Correction === "number") {
            initMagnitudeNumberSetting(
                "magnitude-corrections", id,
                "Correction", settings.Correction);
        }

        const threshold =
            (typeof settings.ZeroThreshold === "number")
                ? settings.ZeroThreshold :
            (typeof settings.ZeroThreshold === "string")
                ? NaN : null;

        if (typeof threshold === "number") {
            initMagnitudeNumberSetting(
                "magnitude-zero-thresholds", id,
                "ZeroThreshold", threshold, {required: false});
        }

        if (typeof settings.MinDelta === "number") {
            initMagnitudeNumberSetting(
                "magnitude-min-deltas", id,
                "MinDelta", settings.MinDelta, {min: "0"});
        }

        if (typeof settings.MaxDelta === "number") {
            initMagnitudeNumberSetting(
                "magnitude-max-deltas", id,
                "MaxDelta", settings.MaxDelta, {min: "0"});
        }
    });
}

/**
 * @param {number} id
 * @returns {HTMLInputElement | null}
 */
function magnitudeValueContainer(id) {
    return document.querySelector(`input[name='magnitude'][data-id='${id}']`);
}

/**
 * @param {any[]} values
 * @param {string[]} schema
 */
function updateMagnitudes(values, schema) {
    values.forEach((value, id) => {
        const props = Magnitudes.properties.get(id);
        if (!props) {
            return;
        }

        const input = magnitudeValueContainer(id);
        if (!input) {
            return;
        }

        const magnitude = fromSchema(value, schema);
        if (typeof magnitude.units === "number") {
            props.units = magnitude.units;
        }

        const units = Magnitudes.units.get(
            /** @type {number} */(magnitude.units)) ?? "";

        if (typeof magnitude.error === "number" && 0 !== magnitude.error) {
            input.value =
                Magnitudes.errors.get(magnitude.error) ?? "Unknown error";
        } else if (typeof magnitude.value === "string") {
            input.value = `${magnitude.value}${units}`;
        } else {
            input.value = magnitude.value?.toString() ?? "?";
        }
    });
}

/**
 * @param {any[]} values
 * @param {string[]} schema
 */
function updateEnergy(values, schema) {
    values.forEach((value) => {
        const energy = fromSchema(value, schema);
        if (typeof energy.id !== "number") {
            return;
        }

        const input = magnitudeValueContainer(energy.id);
        if (!input) {
            return;
        }

        const props = Magnitudes.properties.get(energy.id);
        if (!props) {
            return;
        }

        if (typeof energy.saved !== "string" || !energy.saved) {
            return;
        }

        const info = input?.parentElement?.parentElement
            ?.querySelector(".magnitude-info");
        if (!(info instanceof HTMLElement)) {
            return;
        }

        info.style.display = "inherit";
        info.textContent = energy.saved;
    });
}

/**
 * @returns {import('./settings.mjs').KeyValueListeners}
 */
function listeners() {
    return {
        "magnitudes-init": (_, value) => {
            initMagnitudes(
                value.types, value.errors, value.units);
        },
        "magnitudes-module": (_, value) => {
            initModuleMagnitudes(
                value.prefix, value.values, value.schema);
        },
        "magnitudes-list": (_, value) => {
            initMagnitudesList(value.values, value.schema, [
                createMagnitudeUnitSelector, createMagnitudeInfo]);
        },
        "magnitudes-settings": (_, value) => {
            initMagnitudesSettings(value.values, value.schema);
        },
        "magnitudes": (_, value) => {
            updateMagnitudes(value.values, value.schema);
        },
        "energy": (_, value) => {
            updateEnergy(value.values, value.schema);
        },
    };
}

export function init() {
    variableListeners(listeners());

    document.querySelector(".button-emon-expected-calculate")
        ?.addEventListener("click", emonCalculateRatios);
    document.querySelector(".button-emon-expected-apply")
        ?.addEventListener("click", emonApplyRatios);
}
