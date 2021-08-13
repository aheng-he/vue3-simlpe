// 需要支持dom创建的api及属性处理的api

import { createRenderer } from '@vue/runtime-core'
import { extend } from '@vue/shared'
import { nodeOps } from './nodeOps'

import { patchProp } from './patchProp'


// runtime-dom主要作用就是抹平平台的差异，不同的平台对dom的操作不同，将api传入core中，core可以调用这些方法
const rendererOptions = extend(nodeOps, { patchProp })


// 1. 用户传入组件的属性  2. 需要创建组件的虚拟节点 3. 将虚拟节点变成真正的节点
export const createApp = function (rootComponent, rootProps = null) {
    let app = createRenderer(rendererOptions).createApp(rootComponent, rootProps)
    let { mount } = app;
    // 重写mount方法，不仅可以接受用户参数，还可以做一些前置工作
    // 函数劫持 AOP切片编程
    app.mount = function (container) {
        container = rendererOptions.querySelector(container)
        container.innerHTML = ""
        mount(container)
    }
}

export * from "@vue/runtime-core" 