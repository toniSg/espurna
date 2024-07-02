/**
 * @param {Error} error
 * @returns {string}
 */
export function formatError(error) {
    return [error.name, error.message, error.stack].join("\n");
}

/**
 * @param {string} source
 * @param {number} lineno
 * @param {number} colno
 */
export function formatSource(source, lineno, colno) {
    return `${source || "?"}:${lineno ?? "?"}:${colno ?? "?"}:`;
}

/** @type {number} */
let __errors = 0;

/**
 * @param {string} text
 */
export function showNotification(text) {
    const container = document.getElementById("error-notification");
    if (!container) {
        return;
    }

    __errors += 1;

    if (container.lastChild) {
        container.lastChild.textContent =
            `\n(${__errors} unhandled errors so far)`;
        return;
    }

    container.style.display = "inherit";
    container.style.whiteSpace = "pre-wrap";

    const head = document.createElement("div");
    head.classList.add("pure-u-1");
    head.classList.add("pure-u-lg-1");

    text += "\n\nFor more info see the Debug Log and / or Developer Tools console.";
    head.textContent = text;

    const tail = document.createElement("div");
    container.appendChild(head);
    container.appendChild(tail);
}

/**
 * @param {string} message
 * @param {string} source
 * @param {number} lineno
 * @param {number} colno
 * @param {any} error
 */
function notify(message, source, lineno, colno, error) {
    let text = "";
    if (message) {
        text += message;
    }

    if (source || lineno || colno) {
        text += ` ${source || "?"}:${lineno ?? "?"}:${colno ?? "?"}:`;
    }

    if (error instanceof Error) {
        text += formatError(error);
    }

    showNotification(text);
}

/** @param {string} message */
export function notifyMessage(message) {
    notify(message, "", 0, 0, null);
}

/** @param {Error} error */
export function notifyError(error) {
    notify("", "", 0, 0, error);
}

/** @param {ErrorEvent} event */
export function notifyErrorEvent(event) {
    notify(event.message,
        event.filename,
        event.lineno,
        event.colno,
        event.error);
}
