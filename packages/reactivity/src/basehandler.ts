import { extend, hasChange, hasOwn, isArray, isIntegerKey, isObject } from "@vue/shared";
import { track, trigger } from "./effect";
import { reactive, readonly } from "./reactive";

function createGetter(isReadonly = false, shallow = false) {
    // vue3针对的是对象进行劫持，不用改写原来的对象，如果是嵌套，当取值的时候才会代理
    // vue2 针对的是属性劫持，改写了原来的对象，一上来就递归的
    /**
     * target 原来的对象
     * key 设置的属性值
     * receiver 代理对象
     */
    return function get(target, key, receiver) {
        const res = Reflect.get(target, key, receiver)

        if (!isReadonly) {
            // console.log('收集当前属性，如果这个属性变化了，稍候进行视图更新')
            track(target, 'get', key)
        }

        //  
        if (shallow) {
            return res
        }

        if (isObject(res)) {
            // 懒递归 当我们取值的时候才会去做递归代理，如果不取值，默认代理一层
            return isReadonly ? readonly(res) : reactive(res)

        }
        return res;
    }
}

function createSetter(shallow = false) {
    // 数组新增的时候，触发了两次set，1. 新增了一项，同时更改了长度。2.因为更改了长度，再次触发了set（第二次的触发时无意义的）
    return function set(target, key, value, receiver) {
        const oldValue = target[key];

        // 设置属性，可能之前有，也有可能之前没有（新增和修改）

        /**
         * 如果判断数组是新增还是修改
         * 1. 是数组
         * 2. 修改的key是数字
         * 3. key的值小于length
         * 为修改
         */

        let hasKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key)

        const res = Reflect.set(target, key, value, receiver)

        if (!hasKey) {
            console.log('新增')
            trigger(target, 'add', key, value)
        } else if (hasChange(oldValue, value)) {
            console.log('修改')
            trigger(target, 'set', key, value, oldValue)
        }
        return res;  // 返回是否设置成功
    }
}

const get = createGetter();
const shallowGet = createGetter(false, true)
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)

const set = createSetter()
const shallowSet = createSetter(true)

export const mutableHandler = {
    set: set,
    get: get,
}

export const shallowReactiveHandler = {
    set: shallowSet,
    get: shallowGet

}

const readonlySet = {
    set(target, key) {
        console.warn(`cannot set ${JSON.stringify(target)} on key '${key}' failed`)
    }
}

export const readonlyHandler = extend({
    get: readonlyGet
}, readonlySet)

export const shallowReadonlyHandler = extend({
    get: shallowReadonlyGet
}, readonlySet)
