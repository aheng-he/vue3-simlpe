import { createVnode } from "./vnode";

export function createAppAPI(render) {
    return (rootCompont, rootProps) => {
        const app = {
            _component: rootCompont,
            _props: rootProps,
            _container: null,
            mount(container) {
                // 根据用户传入的组件，创建一个虚拟节点
                const vnode = createVnode(rootCompont, rootProps);
                app._container = container;
                // 将虚拟节点变成真实节点
                render(vnode, container)
            }
        }
        return app
    }
}