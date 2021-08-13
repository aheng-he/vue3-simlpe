/*
// type only
h('div')

// type + props
h('div', {})

// type + omit props + children
// Omit props does NOT support named slots
h('div', []) // array
h('div', 'foo') // text
h('div', h('br')) // vnode
h(Component, () => {}) // default slot

// type + props + children
h('div', {}, []) // array
h('div', {}, 'foo') // text
h('div', {}, h('br')) // vnode
h(Component, {}, () => {}) // default slot
h(Component, {}, {}) // named slots

// named slots without props requires explicit `null` to avoid ambiguity
h(Component, null, {})
**/

import { isArray, isObject, isVnode } from "@vue/shared";
import { createVnode } from "./vnode";


export function h(type, propsOrChildren, children){
    // 第一个参数一定是类型，第二个参数可能是属性可能是儿子，后面的一定都是儿子，没有属性的情况只能放数组
    // 一个情况可以写文本，一个type + 一个文本

    const len = arguments.length;
    if(len == 2){
        if(isObject(propsOrChildren) && !isArray(propsOrChildren)){
            if(isVnode(propsOrChildren)){
                return createVnode(type, null, [propsOrChildren])
            }else{
                return createVnode(type, propsOrChildren)
            }
        }else{
            return createVnode(type, null, propsOrChildren)
        }
    }else{
        if(len > 3){
            children = Array.from(arguments).slice(2)
        }else if(len === 3 && isVnode(children)){
            
            children = [children]
        }
        // 当children是文本或者是数组时，不需要处理 
        // 文本在源码中不用变成数组，因为文本可以直接innerHTML
        return createVnode(type, propsOrChildren, children)
    }
}