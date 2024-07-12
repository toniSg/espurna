import { isChangedElement, getElements } from './settings.mjs';

// per. [RFC1035](https://datatracker.ietf.org/doc/html/rfc1035)
const INVALID_HOSTNAME = `
Hostname cannot be empty and may only contain the ASCII letters ('A' through 'Z' and 'a' through 'z'),
the digits '0' through '9', and the hyphen ('-')! They can neither start or end with an hyphen.`;

const INVALID_PASSWORD = "Invalid password!";
const DIFFERENT_PASSWORD = "Passwords are different!";
const EMPTY_PASSWORD = "Password cannot be empty!";

/**
 * @param {string} value
 * @returns {boolean}
 */
export function validatePassword(value) {
    // http://www.the-art-of-web.com/javascript/validate-password/
    // at least one lowercase and one uppercase letter or number
    // at least eight characters (letters, numbers or special characters)

    // MUST be 8..63 printable ASCII characters. See:
    // https://en.wikipedia.org/wiki/Wi-Fi_Protected_Access#Target_users_(authentication_key_distribution)
    // https://github.com/xoseperez/espurna/issues/1151

    const Pattern = /^(?=.*[A-Z\d])(?=.*[a-z])[\w~!@#$%^&*()<>,.?;:{}[\]\\|]{8,63}/;
    return ((typeof value === "string")
        && (value.length >= 8)
        && Pattern.test(value));
}

/**
 * @typedef {{strict?: boolean}} ValidationOptions
 */

/**
 * @param {HTMLInputElement[]} pair
 * @param {ValidationOptions} options
 * @returns {boolean}
 */
function validatePasswords(pair, {strict = true} = {}) {
    if (pair.length !== 2) {
        alert(EMPTY_PASSWORD);
        return false;
    }

    if (pair.some((x) => !x.value.length)) {
        alert(EMPTY_PASSWORD);
        return false;
    }

    if (pair[0].value !== pair[1].value) {
        alert(DIFFERENT_PASSWORD);
        return false;
    }

    /** @param {HTMLInputElement} elem */
    function checkValidity(elem) {
        if (!elem.checkValidity()) {
            return false;
        }

        return !strict || validatePassword(elem.value);
    }

    if (pair.every(checkValidity)) {
        return true;
    }

    alert(INVALID_PASSWORD);
    return false;

}

/**
 * Try to validate 'adminPass{0,1}', searching the first form containing both.
 * In case it's default webMode, avoid checking things when both fields are empty (`required === false`)
 * @param {HTMLFormElement[]} forms
 * @param {ValidationOptions} options
 * @returns {boolean}
 */
export function validateFormsPasswords(forms, {strict = true} = {}) {
    const pair = Array.from(forms)
        .flatMap((x) => [
            x.elements.namedItem("adminPass0"),
            x.elements.namedItem("adminPass1"),
        ])
        .filter((x) => x instanceof HTMLInputElement);

    return validatePasswords(pair, {strict});
}

/**
 * @param {HTMLFormElement[]} forms
 */
export function validateForms(forms) {
    const elems = forms
        .flatMap((form) => getElements(form))
        .filter(isChangedElement)

    if (!elems.length) {
        return false;
    }

    /** @type {HTMLInputElement[]} */
    const passwords = [];

    for (let elem of elems) {
        switch (elem.name) {
        case "hostname":
            if (!elem.checkValidity()) {
                alert(INVALID_HOSTNAME);
                return false;
            }
            break;

        case "adminPass0":
        case "adminPass1":
            if (!(elem instanceof HTMLInputElement)) {
                return false;
            }

            passwords.push(elem);
            break;

        default:
            if (!elem.checkValidity()) {
                return false;
            }
            break;
        }
    }

    if ((passwords.length > 0)
     && (!validatePasswords(passwords, {strict: false})))
    {
        return false;
    }

    return true;
}
