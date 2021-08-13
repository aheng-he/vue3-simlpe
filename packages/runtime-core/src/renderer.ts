import { effect } from "@vue/reactivity";
import { ShapFlags } from "@vue/shared";
import { createAppAPI } from "./apiCreateApp";
import { createComponentInstance, setupComponent } from "./component";



// 不需要关心什么平台
export function createRenderer(rendererOptions) {
    const {
        insert: hostInsert,
        remove: hostRemove,
        patchProp: hostPatchProp,
        createElement: hostCreateElement,
        createText: hostCreateText,
        setText: hostSetText,
        setElementText: hostSetElementText,
        parentNode: hostParentNode,
        nextSibling: hostNextSibling,
    } = rendererOptions
    const setupRenderEffect = (instance, container) => {
        // 每次状态变化后，都会重新执行effect
        effect(function componentEffect(){
            if(!instance.isMounted){
                // 组件渲染的内容就是subTree
                let subTree = instance.subTree = instance.render.call(instance.proxy, instance.proxy) // 调用render，render需要获取数据
                patch(null, subTree, container)
                instance.isMounted = true;
            }else{
                const prevTree = instance.subTree;
                const nextTree = instance.render.call(instance.proxy, instance.proxy)
                instance.subTree = nextTree;

                // diff算法
                patch(prevTree, nextTree, container)
            }
        })
    }
    const patchProps = (el, oldProps, newProps) => {

    }
    const patchChildren = (n1, n2, container) => { // 做两个虚拟的节点的儿子的比较了
    }
    const patchElement = (n1, n2, container) => { // 走到这里说明前后两个元素能复用
        let el = n2.el = n1.el;

        const oldProps = n1.props || {};
        const newProps = n2.props || {};
        patchProps(el, oldProps, newProps);

        patchChildren(n1, n2, el)

    }
    function mountChildren(children, container) {
        for (let i = 0; i < children.length; i++) {
            patch(null, children[i], container);
        }
    }
    function mountElement(vnode, container, anchor) { // 把虚拟节点变成真实的DOM元素
        const { type, props, children, shapeFlag } = vnode;
        let el = vnode.el = hostCreateElement(type); // 对应的是真实DOM元素
        if (props) {
            for (let key in props) {
                hostPatchProp(el, key, null, props[key])
            }
        }
        // 父创建完毕后 需要创建儿子
        if (shapeFlag & ShapFlags.ARRAY_CHILDREN) {
            mountChildren(children, el);
        } else if (shapeFlag & ShapFlags.TEXT_CHILDREN) {
            hostSetElementText(el, children)
        }
        hostInsert(el, container, anchor);
    }

    const processElement = (n1, n2, container, anchor) => {
        if (n1 == null) {
            mountElement(n2, container, anchor);
        } else {

            // diff算法 核心
            patchElement(n1, n2, container);
        }
    }
    const mountComponent = (n2, container) => {
        // 1.组件的创建，需要产生一个组件的实例，调用组件实例上setup方法拿到render函数，拿到组件对应的虚拟DOM， subTree
        const instance = n2.component = createComponentInstance(n2)

        // 给instance添加属性，调用setup,拿到里面的信息
        setupComponent(instance)

        // 调用render 每个组件都有一个effect

        setupRenderEffect(instance, container)

    }

    const updateComponent = (n1, n2, container) => {

    }

    const processComponent = (n1, n2, container) => {  // 处理组件
        if (n1 == null) {
            mountComponent(n2, container)
        } else {
            updateComponent(n1, n2, container)
        }

    }
    const patch = (n1, n2, container,anchor = null) => {
        // n2可能是元素，也可能是组件
        const { shapeFlag } = n2;
        if (shapeFlag & ShapFlags.ELEMENT) { // 元素的虚拟节点
            processElement(n1, n2, container, anchor);
        } else if (shapeFlag & ShapFlags.STATEFUL_COMPONENT) {  // 组件的虚拟节点
            processComponent(n1, n2, container)
        }
    }
    const render = (vnode, container) => {
        patch(null, vnode, container)
    }
    return {
        createApp: createAppAPI(render),
        render
    }
}