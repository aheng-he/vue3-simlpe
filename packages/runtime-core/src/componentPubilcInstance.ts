import { hasOwn } from "@vue/shared"


export const componentPublicInstance = {
    get({ _: instance }, key) {
        const { setupState, props, ctx } = instance

        // 先在自己的状态查找 然后上下文中查找，最后在属性中查找
        if (hasOwn(setupState, key)) {
            return setupState[key]
        } else if (hasOwn(ctx, key)) {
            return ctx[key]
        } else if (hasOwn(props, key)) {
            return props[key]
        }
    },

    set({ _: instance }, key, value) {
        const { setupState, props } = instance;

        if (hasOwn(setupState, key)) {
            setupState[key] = value
        } else if (hasOwn(props, key)) {
            props[key] = value
        }
        return true
    }
}