import { isFunction, isObject } from "@vue/shared";
import { componentPublicInstance } from "./componentPubilcInstance";

let uid = 0;
export function createComponentInstance(vnode) {
    const instance = {
        uid: uid++,
        vnode,    // 实例上的vnode就是我们处理过的vnode
        type: vnode.type,  // 用户写的组件内容
        props: {},  // props就是组件里用户声明过的
        attrs: {},  // 用户没有用到的props就会放到attrs
        slots: {},  // 组件的插槽
        setupState: {},  // setup的返回值
        proxy: null,
        emit: null,  // 组件通信
        ctx: {},     // 上下文
        isMounted: false,  // 组件是否挂载
        subTree: null,  // 
        render: null
    }
    instance.ctx = { _: instance }  // 将自己放到上下文中，并在生产环境中标识不希望用户直接使用
    return instance
}

// 根据实例创建一个上下文对象
function createSetupContext(instance) {
    return {
        attrs: instance.attrs,
        slots: instance.slots,
        emit: instance.emit,
        expose: () => { }, // 是表示组件暴露了那些方法，用户可以通过ref调用
    }
}

function finishComponentSetup(instance) {

    let Component = instance.type;
    if(!instance.render){
        if(!Component.render && Component.template){
            // 将template编译为render函数 complieToFunction()
        }
        instance.render = Component.render;
    }
}

function handleSetupResult(instance, setupResult) {
    if (isObject(setupResult)) {
        instance.setupState = setupResult
    } else if (isFunction(setupResult)) {
        instance.render = setupResult
    }
    //  处理 后可能依旧没有render 1） 用户没写setup  2) 用户写了setup但是什么都没返回
    finishComponentSetup(instance)
}

function setupStatefulComponent(instance) {
    let Component = instance.type;
    let { setup } = Component;
    if (setup) {
        let setupContext = createSetupContext(instance);
        let setupResult = setup(instance.props, setupContext)
        handleSetupResult(instance, setupResult)
    } else {
        finishComponentSetup(instance)
    }
}


export function setupComponent(instance) {
    let { props, children } = instance;
    // 初始化属性  initProps
    // 初始化插槽  initSlots

    instance.props = props;
    instance.slots = children;
    instance.proxy = new Proxy(instance.ctx, componentPublicInstance);
    setupStatefulComponent(instance)
}