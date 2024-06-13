import {
    addSimpleEnumerables,
    fromSchema,
    groupSettingsOnAdd,
    idForContainer,
    variableListeners,
} from './settings.mjs';

import {
    fillTemplateLineFromCfg,
    loadConfigTemplate,
    mergeTemplate,
} from './template.mjs';

function addNode(cfg) {
    let container = document.getElementById("leds");

    let id = idForContainer(container);
    if (id < 0) {
        return;
    }

    let line = loadConfigTemplate("led-config");
    line.querySelector("span").textContent = id;
    fillTemplateLineFromCfg(line, id, cfg);

    mergeTemplate(container, line);
}

function listeners() {
    return {
        "ledConfig": (_, value) => {
            let container = document.getElementById("leds");
            if (container.childElementCount > 0) {
                return;
            }

            value.leds.forEach((entries) => {
                addNode(fromSchema(entries, value.schema));
            });

            addSimpleEnumerables("led", "LED", value.leds.length);
        },
    };
};

export function init() {
    variableListeners(listeners());

    groupSettingsOnAdd("leds", () => {
        addNode();
    });
}
