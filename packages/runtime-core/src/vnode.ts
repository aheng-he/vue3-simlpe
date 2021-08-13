import { isArray, isObject, isString, ShapFlags } from "@vue/shared"

export function createVnode(type, props, children = null) {

    const shapeFlag = isString(type) ?
        ShapFlags.ELEMENT : isObject(type) ? ShapFlags.STATEFUL_COMPONENT : 0
    const vnode = {
        __v_isVnode: true,
        type,
        props,
        children,
        key: props && props.key,
        el: null,
        shapeFlag,
    }

    normalizeChildren(vnode, children)
    return vnode
}

function normalizeChildren(vnode, children) {  // 将儿子的类型同一记录在vnode的shapeFlag
    let type = 0;
    if (children == null) {

    } else if (isArray(children)) {
        type = ShapFlags.ARRAY_CHILDREN
    } else {
        type = ShapFlags.TEXT_CHILDREN
    }
    vnode.shapeFlag |= type
}
