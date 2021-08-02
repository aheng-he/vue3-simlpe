import { isObject } from "@vue/shared"
import { mutableHandler, readonlyHandler, shallowReactiveHandler, shallowReadonlyHandler } from "./basehandler"



// 是否是浅的，默认时深度
// 是否为只读，默认为否

export function reactive(target) {
    return createReactiveObject(target, false, mutableHandler)
}

export function shallowReactive(target) {
    return createReactiveObject(target, false, shallowReactiveHandler)
}

export function readonly(target) {
    return createReactiveObject(target, true, readonlyHandler)
}

export function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandler)
}

/**
 * 
 * @param target 创建代理对象目标
 * @param isReadonly 是否为只读
 * @param baseHandler 针对不同的方法创建不同的代理对象
 */

// weakMap(key只能时对象) 
const reactiveMap = new WeakMap();  // 目的是添加缓存
const readonlyMap = new WeakMap();
function createReactiveObject(target, isReadonly, baseHandler) {
    if(!isObject(target)){
        return target
    }
    // 代理缓存
    let proxyMap = isReadonly ? readonlyMap : reactiveMap;

    const existProxy = proxyMap.get(target)
    if(existProxy){
        return existProxy; // 如果
    }
    // 如果是对象，就做一个代理
    const proxy = new Proxy(target, baseHandler);
    proxyMap.set(target, proxy)
    return proxy
}