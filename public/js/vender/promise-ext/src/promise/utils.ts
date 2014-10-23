/**
 * Test if given value is a Function.
 * @param {any} value Value to test
 * @returns {boolean} True if value is a function
 */
export function isCallable(value: any): boolean {
    return typeof value === "function";
}

/**
 * Test if given value is an Object.
 * @param {any} value Value to test
 * @returns {boolean} True if value is an object and not null
 */
export function isObject(value: any): boolean {
    return (typeof value === "object" && value !== null);
}

/**
 * Test if given value is a Constructor Function.
 * @param {any} value Value to test
 * @returns {boolean} True if value is a Constructor Function
 */
export function isConstructor(value: any): boolean {
    return (isCallable(value) && value.prototype && value.prototype.constructor === value);
}

/**
 * Test if given value is a undefined
 * @param {any} value Value to test
 * @returns {boolean} True if value is undefined
 */
export function isUndefined(value: any): boolean {
    return typeof value === "undefined";
}

/**
 * Test if given object contains property.
 * @param {Object} obj Object to test if value is contained in
 * @param {string} prop Property to test if contained in object
 * @returns {boolean} True if object contains property
 */
export function hasProperty(obj: any, prop: string): boolean {
    return (prop in obj);
}

/**
 * Invoke given function in given object with object as this
 * @param {Object} obj Object which contains function
 * @param {string} prop Function name
 * @returns {any} Returns the result of invocation
 */
export function invoke(obj: any, fn: string, args: any[] = []): any {
    if (!hasProperty(obj, fn) || !isCallable(obj[fn])) {
        throw new TypeError("Object has no " + fn + " function");
    }

    return obj[fn].apply(obj, args);
}

/**
 * Returns given value
 * @param {any} value Value to return
 * @returns {any} Given value
 */
export function identity(value: any): any {
    return value;
}

/**
 * Throws given error if it's instanceof Error else convert to Error then throws
 * @param {Error|any} e Error to be thrown
 */
export function thrower(e: Error): any;
export function thrower(e: any): any {
    if (!(e instanceof Error)) {
        e = new Error(e);
    }

    throw e;
}
