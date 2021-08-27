import { effect } from "@vue/reactivity";
import { isSameVnode, ShapeFlags } from "@vue/shared";
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

    const patchKeyedChildren = (c1, c2, container) =>{
        // 两方都有儿子 才能称之为diff算法
        // 能复用的尽可能的复用， 之前和现在的差异，不一样的要新建或者删除，一样的要复用，复用dom和属性

        let i = 0;
        let e1 = c1.length - 1;
        let e2 = c2.length - 1;

        // sync form start
        // 从头部开始比较我们移动的都是i
        while(i <= e1 && 1 <= e2){  // 以最短的为主，谁先遍历完毕就终止
            const n1 = c1[i]
            const n2 = c2[i]
            if(isSameVnode(n1, n2)){
                // 递归 比较 属性，和这两个人的儿子
                patch(n1, n2, container)
            }else{
                break
            }
            i++;
        }

        // sync form end
        // 默认移动的是尾部的指针
        while(i <= e1 && i <= e2){
            const n1 = c1[e1]
            const n2 = c2[e2]

            if(isSameVnode(n1, n2)){
                patch(n1, n2, container)
            }else{
                break
            }
            e1--;
            e2--;
        }

        // 如果老的少，新的多，将新的直接插入
        if(i > e1){ // 无论头部增加，还是尾部增加，都是 这个 逻辑
            if(i <= e2){
                // 添加到前面还是后面？
                const nextPos = e2 + 1;
                // 如果是像前追加 e2 + 1 肯定小于c2的长度
                // 如果是向前追加 e2+1 肯定小于 c2的长度
                const anchor = nextPos < c2.length ? c2[nextPos].el : null;

                while(i <= e2){
                    patch(null, c2[i++], container, anchor)
                }
            }
        }else if(i > e2){// 老的多 新的少
            // 卸载多余的
            while(i <= e1){
                unmount(c1[i++])
            }
        }else{ // 乱序比对 （最长递增子序列）
            // 中间的内容 

            // 通过 i 和 e1 / e2之间的部分进行差异比对
            let s1 = i;
            let s2 = i;
            // 正常来说，应该用旧的节点做成一个映射表，拿新的节点去找，看一下能否复用
            // 根据新的节点生成一个索引的映射表

            const keyToNewIndexMap = new Map();

            for(let i = s2; i < e2; i++){
                const childVnode = c2[i]  // 获取新的儿子中的每一个节点
                keyToNewIndexMap.set(childVnode.key, i)
            }

            // 接下来有了映射表之后 我们要知道哪些可以被patch，哪些不能
            // 计算有几个需要被patch
            const toBePatched = e2 - s2 + 1;
            const newIndexToOldeIndexMap = new Array(toBePatched).fill(0);

            // 循环老的，将老的索引记录到 newIndexToOldeIndexMap（根据索引进行查找）
            for(let i = s1; i <= e1; i++){
                const childOldVnode = c1[i];  // 老的虚拟节点，通过老的key去 新的映射表中查找，如果有就复用
                let newIndex = keyToNewIndexMap.get(childOldVnode.key)  // 新的索引
                if(newIndex == null){ // 用老的去新的找，新的里面没有。删除掉这个节点
                    unmount(childOldVnode)
                }else{
                     // 这里用新索引的时候 需要减去开头的长度 
                     newIndexToOldeIndexMap[newIndex - s2] = i + 1// 构建新的索引和老的索引的关系
                     patch(childOldVnode, c2[newIndex], container);
                      // 如果里面的值 是 0的话说明新的有老的没有，而且数组里会记录新的对应的老的索引
                }
            }

            let increasingNewIndexSeq = getSeq(newIndexToOldeIndexMap);

            let j = increasingNewIndexSeq.length - 1; // 取出最后一个人的索引

            for(let i = toBePatched - 1; i >= 0; i--){
                let currentIndex = i + s2;
                let childNode = c2[currentIndex]
                let anchor = currentIndex + 1 < c2.length ? c2[currentIndex + 1].el : null;
                // 如果以前不存在这个节点就创建出来，进行插入操作

                if(newIndexToOldeIndexMap[i] == 0){
                    patch(null, childNode, container, anchor)
                }else{
                      // 做到了如果不需要去实现移动，就不在移动了
                    if (increasingNewIndexSeq[j] !== i) {
                        // 存在直接将节点进行插入操作
                        hostInsert(childNode.el, container, anchor); // dom操作是具有移动性，肯定用的是以前的 ，但是都做了一遍重新插入
                    } else {
                        j--;
                    }
                }
            }
        }

    }

    function getSeq(arr){ // 最长递增子序列
        let len = arr.length;
        let result = [0]  // 默认将第一个索引作为连续的开头
        let p = arr.slice(0)  // 用来存索引

        for(let i = 0; i < len; i++){
            const arrI = arr[i]
            if(arrI !== 0){  // 数组中的0要去掉，因为对于vue3而言，为0标识这个元素是要创建的
                let resultLastIndex = result[result.length - 1]  
                if(arr[resultLastIndex] < arrI){ // 当前的值，比最后一项大，那么就累计索引
                    p[i] = resultLastIndex;  // 在放入之前记住前一项的索引
                    result.push(i)
                    continue;  // 如果比最后一项大后续的逻辑跳过  
                }

                let start = 0;
                let end = result.length - 1;
                let middle;
                while(start < end){ // 终止条件，start 与 end 重合
                    middle = (start + end) / 2 | 0; // 取整
                    if(arr[result[middle]] < arrI){ // 向后找
                        start = middle + 1
                    }else{
                        end = middle
                    }
                }

                if(arrI < arr[result[middle]]){
                    if(start > 0){
                        p[i] = result[start - 1] // 替换的时候记住我的替换那个人的前一个人索引
                    }
                    result[start] = i  // 直接用当前的索引换掉老的索引， 替换成更有潜力的那一项
                }
            }

            // 找到结果集的最后一项，倒叙的查找回来
            let len = result.length;
            let last = result[len - 1]
            while(len-- > 0){
                result[len] = last;
                last = p[last]
            }
        }


        return result
    }

    const unmount = (vnode)=>{}
    const patchProps = (el, oldProps, newProps) => {
        if(oldProps !== newProps){
            // 替换和添加新属性
            for(let key in newProps){
                const prev = oldProps[key]
                const next = newProps[key]
                if(prev !== next){
                    hostPatchProp(el, key, prev, next)
                }
            }
            // 删除不存在的旧属性
            for(let key in oldProps){
                if(!(key in newProps)){
                    hostPatchProp(el, key, oldProps[key], null)
                }
            }
        }
    }
    const patchChildren = (n1, n2, container) => { // 做两个虚拟的节点的儿子的比较了

        const c1 = n1.children;
        const c2 = n2.children;

        /**
         * 儿子之间的比较
         * 1. 一方有儿子，另一方没有
         * 2. 以前有儿子，现在没有儿子
         * 3. 两方都是文本，直接用新的替换老的
         * 4. 最后一个就是两方都有儿子，就对比差异
         */

        const prevShapeFlag = n1.shapeFlag
        const shapeFlag = n2.shapeFlag

        if(shapeFlag & ShapeFlags.TEXT_CHILDREN){
            hostSetElementText(container, c2)  // 直接干掉以前的
        }else{
            // 现在是数组
            if(prevShapeFlag & ShapeFlags.ARRAY_CHILDREN){
                // 之前也是数组 对比差异
                patchKeyedChildren(c1, c2, container)

            }else{
                // 之前是文本 
                hostSetElementText(container, "")  // 删除之前的文本
                mountChildren(c2, container) // 挂载当前的数组
            }
        }
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
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            mountChildren(children, el);
        } else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
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
        if (shapeFlag & ShapeFlags.ELEMENT) { // 元素的虚拟节点
            processElement(n1, n2, container, anchor);
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {  // 组件的虚拟节点
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