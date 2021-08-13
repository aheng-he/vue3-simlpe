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

export let isString = (val) => typeof val === 'string'

export let isFunction = val => typeof val === 'function'

export let hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key)

export let isVnode = (vnode) => vnode.__v_isVnode === true

export const enum ShapFlags {
    ELEMENT = 1,  // 标识是一个元素
    FUNCTIONAL_COMPONENT = 1 << 1,  // 函数组件
    STATEFUL_COMPONENT = 1 << 2,  // 带状态组件
    TEXT_CHILDREN = 1 << 3,  // 孩子是文本
    ARRAY_CHILDREN = 1 << 4, // 孩子是数组
    SLOTS_CHILDREN = 1 << 5,  // 插槽孩子
    TELEPORT = 1 << 6,  // 传送门
    SUSPENSE = 1 << 7,  // 实现异步组件等待
    COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,  // 是否需要keep-alive
    COMPONENT_KEEP_ALIVE = 1 << 9,  // 组件的keep-alive
    COMPONET = ShapFlags.STATEFUL_COMPONENT | ShapFlags.FUNCTIONAL_COMPONENT
}