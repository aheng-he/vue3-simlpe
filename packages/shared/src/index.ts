export function isObject(val) {
    return typeof val === 'object' && val != null
}

export const extend = Object.assign

export function hasChange(oldValue, newValue) {
    return oldValue !== newValue
}

export let isIntegerKey = (key) => {
    return parseInt(key) + '' === key
}

export let isArray = Array.isArray;

export let hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key)