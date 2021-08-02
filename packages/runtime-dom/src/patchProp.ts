
/**
 * 
 * @param el 
 * @param key 
 * @param prev 
 * @param next 
 */

const patchClass = (el, next) => {
    if (next == null) next = ''
    el.className = next;
}


// patchProp('div', 'style', {color: 'red'}, {background: 'blue'})
const patchStyle = (el, prev, next) => {
    if (next == null) {
        el.removeAttribute('style')
    } else {
        if (prev) {
            for (let key in prev) {
                if (next[key] == null) {
                    el.style[key] = ''
                }
            }
        }
        for (let key in next) {
            el.style[key] = next[key]
        }
    }
}

function createInvoker(fn) {
    const invoker = (e) => {
        invoker.value(e)
    }
    invoker.value = fn;
    return invoker
}

const patchEvent = (el, key, next) => {
    // react 中采用的是事件代理，但是vue中直接绑定给元素的
    // 之前绑定的事件和之后绑定的不一样怎么处理 ？

    const invokers = el._vei || (el._vei = {})
    const exists = invokers[key]
    if (exists && next) {
        // 替换事件
        exists.value = next
    } else {
        const eventName = key.toLowerCase().slice(2);
        if (next) {
            let invoker = invokers[key] = createInvoker(next)
            el.addEventListener(eventName, invoker)
        } else {
            el.removeEventListener(eventName, exists)
            invokers[key] = null;
        }
    }
}

const patchAttrs = (el, key, next) => {
    if (next == null) {
        el.removeAttribute(key)
    } else {
        el.setAttribute(key, next)
    }
}

export const patchProp = (el, key, prev, next) => {
    switch (key) {
        case 'class':  // .className  patchProp()
            patchClass(el, next)
            break;
        case 'style':  // .style.xxx
            patchStyle(el, prev, next)
            break
        default:
            if (/^on[^a-z]/.test(key)) {
                // 事件
                patchEvent(el, key, next)
            } else {
                // 其他属性 直接使用 setAttribute
                patchAttrs(el, key, next)
            }
    }
}

