'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function isObject(val) {
    return typeof val === 'object' && val != null;
}
var extend = Object.assign;
function hasChange(oldValue, newValue) {
    return oldValue !== newValue;
}
var isIntegerKey = function (key) {
    return parseInt(key) + '' === key;
};
var isArray = Array.isArray;
var isString = function (val) { return typeof val === 'string'; };
var isFunction = function (val) { return typeof val === 'function'; };
var hasOwn = function (target, key) { return Object.prototype.hasOwnProperty.call(target, key); };
var isVnode = function (vnode) { return vnode.__v_isVnode === true; };

exports.extend = extend;
exports.hasChange = hasChange;
exports.hasOwn = hasOwn;
exports.isArray = isArray;
exports.isFunction = isFunction;
exports.isIntegerKey = isIntegerKey;
exports.isObject = isObject;
exports.isString = isString;
exports.isVnode = isVnode;
//# sourceMappingURL=shared.cjs.js.map
