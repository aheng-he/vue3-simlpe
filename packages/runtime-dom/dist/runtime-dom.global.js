var VueRuntimeDOM = (function (exports) {
    'use strict';

    function isObject(val) {
        return typeof val === 'object' && val != null;
    }
    var extend = Object.assign;
    function hasChange(oldValue, newValue) {
        return oldValue !== newValue;
    }
    var isIntegerKey = function (key) {
        return parseInt(key) + '' === key;
    };
    var isArray = Array.isArray;
    var isString = function (val) { return typeof val === 'string'; };
    var isFunction = function (val) { return typeof val === 'function'; };
    var hasOwn = function (target, key) { return Object.prototype.hasOwnProperty.call(target, key); };
    var isVnode = function (vnode) { return vnode.__v_isVnode === true; };

    function effect(fn, options) {
        if (options === void 0) { options = {}; }
        var effect = createReactiveEffect(fn, options);
        if (!options.lazy) {
            effect();
        }
        return effect; // 返回响应式的effect
    }
    var activeEffect;
    var effectStack = [];
    var id = 0;
    function createReactiveEffect(fn, options) {
        var effect = function reactvieEffect() {
            try {
                effectStack.push(effect);
                activeEffect = effect;
                return fn();
            }
            finally {
                effectStack.pop();
                activeEffect = effectStack[effectStack.length - 1];
            }
        };
        effect.id = id++;
        effect.__isEffect = true;
        effect.options = options;
        effect.deps = []; // 用来收集依赖了那些属性
        return effect;
    }
    var targetMap = new WeakMap();
    function track(target, type, key) {
        if (activeEffect == undefined) {
            // 用户只是进行取值操作，而且这个 值不是在effect中使用的什么都不用收集
            return;
        }
        var depsMap = targetMap.get(target);
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map()));
        }
        var dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = new Set()));
        }
        if (!dep.has(activeEffect)) {
            dep.add(activeEffect);
        }
    }
    function trigger(target, type, key, newValue, oldValue) {
        // 去映射表里找属性对应的effect，让他重新执行
        var depsMap = targetMap.get(target);
        if (!depsMap)
            return; // 只是修改了属性，没有在effect中使用
        var effectsSet = new Set();
        // 如果同时又多个，依赖的effect是同一个，还有set做一个过滤
        var add = function (effectAdd) {
            if (effectAdd) {
                effectAdd.forEach(function (effect) {
                    effectsSet.add(effect);
                });
            }
        };
        // arr = [1,2,3]
        // arr.length = 1
        // arr.push(4)
        // 1. 如果更改了数组的长度，小于依赖收集的长度，要触发重新渲染
        // 2. 如果调用了push方法，或者其他新增数组的方法(必须能改变数组的长度)，也触发更新
        if (isArray(target) && key === 'length') {
            depsMap.forEach(function (dep, key) {
                if (key > newValue || key === 'length') {
                    add(dep); // 更改了数组的长度，比收集到的属性值小
                }
            });
        }
        else {
            add(depsMap.get(key));
            switch (type) {
                case 'add':
                    if (isArray(target) && isIntegerKey(key)) {
                        // 增加属性，需要触发length 的依赖属性
                        add(depsMap.get('length'));
                    }
            }
        }
        effectsSet.forEach(function (effect) {
            if (effect.options.schedular) {
                effect.options.schedular(effect);
            }
            else {
                effect();
            }
        });
    }

    function createGetter(isReadonly, shallow) {
        if (isReadonly === void 0) { isReadonly = false; }
        if (shallow === void 0) { shallow = false; }
        // vue3针对的是对象进行劫持，不用改写原来的对象，如果是嵌套，当取值的时候才会代理
        // vue2 针对的是属性劫持，改写了原来的对象，一上来就递归的
        /**
         * target 原来的对象
         * key 设置的属性值
         * receiver 代理对象
         */
        return function get(target, key, receiver) {
            var res = Reflect.get(target, key, receiver);
            if (!isReadonly) {
                // console.log('收集当前属性，如果这个属性变化了，稍候进行视图更新')
                track(target, 'get', key);
            }
            //  
            if (shallow) {
                return res;
            }
            if (isObject(res)) {
                // 懒递归 当我们取值的时候才会去做递归代理，如果不取值，默认代理一层
                return isReadonly ? readonly(res) : reactive(res);
            }
            return res;
        };
    }
    function createSetter(shallow) {
        // 数组新增的时候，触发了两次set，1. 新增了一项，同时更改了长度。2.因为更改了长度，再次触发了set（第二次的触发时无意义的）
        return function set(target, key, value, receiver) {
            var oldValue = target[key];
            // 设置属性，可能之前有，也有可能之前没有（新增和修改）
            /**
             * 如果判断数组是新增还是修改
             * 1. 是数组
             * 2. 修改的key是数字
             * 3. key的值小于length
             * 为修改
             */
            var hasKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key);
            var res = Reflect.set(target, key, value, receiver);
            if (!hasKey) {
                console.log('新增');
                trigger(target, 'add', key, value);
            }
            else if (hasChange(oldValue, value)) {
                console.log('修改');
                trigger(target, 'set', key, value);
            }
            return res; // 返回是否设置成功
        };
    }
    var get = createGetter();
    createGetter(false, true);
    var readonlyGet = createGetter(true);
    var shallowReadonlyGet = createGetter(true, true);
    var set = createSetter();
    var mutableHandler = {
        set: set,
        get: get,
    };
    var readonlySet = {
        set: function (target, key) {
            console.warn("cannot set " + JSON.stringify(target) + " on key '" + key + "' failed");
        }
    };
    var readonlyHandler = extend({
        get: readonlyGet
    }, readonlySet);
    extend({
        get: shallowReadonlyGet
    }, readonlySet);

    // 是否是浅的，默认时深度
    // 是否为只读，默认为否
    function reactive(target) {
        return createReactiveObject(target, false, mutableHandler);
    }
    function readonly(target) {
        return createReactiveObject(target, true, readonlyHandler);
    }
    /**
     *
     * @param target 创建代理对象目标
     * @param isReadonly 是否为只读
     * @param baseHandler 针对不同的方法创建不同的代理对象
     */
    // weakMap(key只能时对象) 
    var reactiveMap = new WeakMap(); // 目的是添加缓存
    var readonlyMap = new WeakMap();
    function createReactiveObject(target, isReadonly, baseHandler) {
        if (!isObject(target)) {
            return target;
        }
        // 代理缓存
        var proxyMap = isReadonly ? readonlyMap : reactiveMap;
        var existProxy = proxyMap.get(target);
        if (existProxy) {
            return existProxy; // 如果
        }
        // 如果是对象，就做一个代理
        var proxy = new Proxy(target, baseHandler);
        proxyMap.set(target, proxy);
        return proxy;
    }

    var convert = function (v) { return isObject(v) ? reactive(v) : v; };
    // ts 中实现类的话，私有属性必须先声明才能使用
    /** @class */ ((function () {
        function RefImpl(rawValue, shallow) {
            this.rawValue = rawValue;
            this.shallow = shallow;
            this._value = shallow ? rawValue : convert(rawValue);
        }
        Object.defineProperty(RefImpl.prototype, "value", {
            get: function () {
                // 收集依赖
                track(this, 'get', 'value');
                return this._value;
            },
            set: function (newValue) {
                // 触发更新
                if (hasChange(newValue, this.rawValue)) {
                    this.rawValue = newValue;
                    this._value = this.shallow ? newValue : convert(newValue);
                    trigger(this, 'set', 'value', newValue);
                }
            },
            enumerable: false,
            configurable: true
        });
        return RefImpl;
    })());
    /** @class */ ((function () {
        function ObjectRefImpl(target, key) {
            this.target = target;
            this.key = key;
            this.__v_isRef = true;
        }
        Object.defineProperty(ObjectRefImpl.prototype, "value", {
            get: function () {
                return this.target[this.key];
            },
            set: function (newValue) {
                this.target[this.key] = newValue;
            },
            enumerable: false,
            configurable: true
        });
        return ObjectRefImpl;
    })());

    /** @class */ ((function () {
        function ComputedRefImpl(getter, setter) {
            var _this = this;
            this.getter = getter;
            this.setter = setter;
            this._dirty = true;
            // 返回effect的执行权限
            // 传入了schedular 后，下次数据更新，原则上应该让effec重新执行，下次更新会调用schedular
            this.effect = effect(getter, {
                lazy: true, schedular: function (effect) {
                    if (!_this._dirty) {
                        // 用户修改了依赖的属性
                        _this._dirty = true;
                        trigger(_this, 'get', 'value');
                    }
                }
            });
        }
        Object.defineProperty(ComputedRefImpl.prototype, "value", {
            get: function () {
                if (this._dirty) {
                    this._value = this.effect();
                    this._dirty = false;
                }
                // 收集计算属性的依赖
                track(this, 'get', 'value');
                return this._value;
            },
            set: function (newValue) {
                // 当用户给计算属性设置值时会触发，set方法，此时调用计算属性的setter
                this.setter(newValue);
            },
            enumerable: false,
            configurable: true
        });
        return ComputedRefImpl;
    })());

    function createVnode(type, props, children) {
        if (children === void 0) { children = null; }
        var shapeFlag = isString(type) ?
            1 /* ELEMENT */ : isObject(type) ? 4 /* STATEFUL_COMPONENT */ : 0;
        var vnode = {
            __v_isVnode: true,
            type: type,
            props: props,
            children: children,
            key: props && props.key,
            el: null,
            shapeFlag: shapeFlag,
        };
        normalizeChildren(vnode, children);
        return vnode;
    }
    function normalizeChildren(vnode, children) {
        var type = 0;
        if (children == null) ;
        else if (isArray(children)) {
            type = 16 /* ARRAY_CHILDREN */;
        }
        else {
            type = 8 /* TEXT_CHILDREN */;
        }
        vnode.shapeFlag |= type;
    }

    function createAppAPI(render) {
        return function (rootCompont, rootProps) {
            var app = {
                _component: rootCompont,
                _props: rootProps,
                _container: null,
                mount: function (container) {
                    // 根据用户传入的组件，创建一个虚拟节点
                    var vnode = createVnode(rootCompont, rootProps);
                    app._container = container;
                    // 将虚拟节点变成真实节点
                    render(vnode, container);
                }
            };
            return app;
        };
    }

    var componentPublicInstance = {
        get: function (_a, key) {
            var instance = _a._;
            var setupState = instance.setupState, props = instance.props, ctx = instance.ctx;
            // 先在自己的状态查找 然后上下文中查找，最后在属性中查找
            if (hasOwn(setupState, key)) {
                return setupState[key];
            }
            else if (hasOwn(ctx, key)) {
                return ctx[key];
            }
            else if (hasOwn(props, key)) {
                return props[key];
            }
        },
        set: function (_a, key, value) {
            var instance = _a._;
            var setupState = instance.setupState, props = instance.props;
            if (hasOwn(setupState, key)) {
                setupState[key] = value;
            }
            else if (hasOwn(props, key)) {
                props[key] = value;
            }
            return true;
        }
    };

    var uid = 0;
    function createComponentInstance(vnode) {
        var instance = {
            uid: uid++,
            vnode: vnode,
            type: vnode.type,
            props: {},
            attrs: {},
            slots: {},
            setupState: {},
            proxy: null,
            emit: null,
            ctx: {},
            isMounted: false,
            subTree: null,
            render: null
        };
        instance.ctx = { _: instance }; // 将自己放到上下文中，并在生产环境中标识不希望用户直接使用
        return instance;
    }
    // 根据实例创建一个上下文对象
    function createSetupContext(instance) {
        return {
            attrs: instance.attrs,
            slots: instance.slots,
            emit: instance.emit,
            expose: function () { }, // 是表示组件暴露了那些方法，用户可以通过ref调用
        };
    }
    function finishComponentSetup(instance) {
        var Component = instance.type;
        if (!instance.render) {
            if (!Component.render && Component.template) ;
            instance.render = Component.render;
        }
    }
    function handleSetupResult(instance, setupResult) {
        if (isObject(setupResult)) {
            instance.setupState = setupResult;
        }
        else if (isFunction(setupResult)) {
            instance.render = setupResult;
        }
        //  处理 后可能依旧没有render 1） 用户没写setup  2) 用户写了setup但是什么都没返回
        finishComponentSetup(instance);
    }
    function setupStatefulComponent(instance) {
        var Component = instance.type;
        var setup = Component.setup;
        if (setup) {
            var setupContext = createSetupContext(instance);
            var setupResult = setup(instance.props, setupContext);
            handleSetupResult(instance, setupResult);
        }
        else {
            finishComponentSetup(instance);
        }
    }
    function setupComponent(instance) {
        var props = instance.props, children = instance.children;
        // 初始化属性  initProps
        // 初始化插槽  initSlots
        instance.props = props;
        instance.slots = children;
        instance.proxy = new Proxy(instance.ctx, componentPublicInstance);
        setupStatefulComponent(instance);
    }

    // 不需要关心什么平台
    function createRenderer(rendererOptions) {
        var setupRenderEffect = function (instance, container) {
            // 每次状态变化后，都会重新执行effect
            effect(function componentEffect() {
                if (!instance.isMounted) {
                    // 组件渲染的内容就是subTree
                    var subTree = instance.subTree = instance.render.call(instance.proxy, instance.proxy); // 调用render，render需要获取数据
                    patch(null, subTree);
                    instance.isMounted = true;
                }
                else {
                    var prevTree = instance.subTree;
                    var nextTree = instance.render.call(instance.proxy, instance.proxy);
                    instance.subTree = nextTree;
                    // diff算法
                    patch(prevTree, nextTree);
                }
            });
        };
        var mountComponent = function (n2, container) {
            // 1.组件的创建，需要产生一个组件的实例，调用组件实例上setup方法拿到render函数，拿到组件对应的虚拟DOM， subTree
            var instance = n2.component = createComponentInstance(n2);
            // 给instance添加属性，调用setup,拿到里面的信息
            setupComponent(instance);
            // 调用render 每个组件都有一个effect
            setupRenderEffect(instance);
        };
        var processComponent = function (n1, n2, container) {
            if (n1 == null) {
                mountComponent(n2);
            }
        };
        var patch = function (n1, n2, container) {
            // n2可能是元素，也可能是组件
            var shapeFlag = n2.shapeFlag;
            if (shapeFlag & 1 /* ELEMENT */) ;
            else if (shapeFlag & 4 /* STATEFUL_COMPONENT */) { // 组件的虚拟节点
                processComponent(n1, n2);
            }
        };
        var render = function (vnode, container) {
            patch(null, vnode);
        };
        return {
            createApp: createAppAPI(render),
            render: render
        };
    }

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
    function h(type, propsOrChildren, children) {
        // 第一个参数一定是类型，第二个参数可能是属性可能是儿子，后面的一定都是儿子，没有属性的情况只能放数组
        // 一个情况可以写文本，一个type + 一个文本
        var len = arguments.length;
        if (len == 2) {
            if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
                if (isVnode(propsOrChildren)) {
                    return createVnode(type, null, [propsOrChildren]);
                }
                else {
                    return createVnode(type, propsOrChildren);
                }
            }
            else {
                return createVnode(type, null, propsOrChildren);
            }
        }
        else {
            if (len > 3) {
                children = Array.from(arguments).slice(2);
            }
            else if (len === 3 && isVnode(children)) {
                children = [children];
            }
            // 当children是文本或者是数组时，不需要处理 
            // 文本在源码中不用变成数组，因为文本可以直接innerHTML
            return createVnode(type, propsOrChildren, children);
        }
    }

    var nodeOps = {
        // 增 删 改 查 元素中插入文本  文本的创建 文本元素的内容设置 获取父亲 获取下一个元素
        createElement: function (tagName) { return document.createElement(tagName); },
        remove: function (child) { return child.parentNode && child.parentNode.removeChild(child); },
        insert: function (child, parent, anchor) {
            if (anchor === void 0) { anchor = null; }
            return parent.insertBefore(child, anchor);
        },
        querySelector: function (selector) { return document.querySelector(selector); },
        setElementText: function (el, text) { return el.textContent = text; },
        createText: function (text) { return document.createTextNode(text); },
        setText: function (node, text) { return node.nodeValue = text; },
        getParent: function (node) { return node.parentNode; },
        getNextSibling: function (node) { return node.nextElementSibling; }
    };

    /**
     *
     * @param el
     * @param key
     * @param prev
     * @param next
     */
    var patchClass = function (el, next) {
        if (next == null)
            next = '';
        el.className = next;
    };
    // patchProp('div', 'style', {color: 'red'}, {background: 'blue'})
    var patchStyle = function (el, prev, next) {
        if (next == null) {
            el.removeAttribute('style');
        }
        else {
            if (prev) {
                for (var key in prev) {
                    if (next[key] == null) {
                        el.style[key] = '';
                    }
                }
            }
            for (var key in next) {
                el.style[key] = next[key];
            }
        }
    };
    function createInvoker(fn) {
        var invoker = function (e) {
            invoker.value(e);
        };
        invoker.value = fn;
        return invoker;
    }
    var patchEvent = function (el, key, next) {
        // react 中采用的是事件代理，但是vue中直接绑定给元素的
        // 之前绑定的事件和之后绑定的不一样怎么处理 ？
        var invokers = el._vei || (el._vei = {});
        var exists = invokers[key];
        if (exists && next) {
            // 替换事件
            exists.value = next;
        }
        else {
            var eventName = key.toLowerCase().slice(2);
            if (next) {
                var invoker = invokers[key] = createInvoker(next);
                el.addEventListener(eventName, invoker);
            }
            else {
                el.removeEventListener(eventName, exists);
                invokers[key] = null;
            }
        }
    };
    var patchAttrs = function (el, key, next) {
        if (next == null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, next);
        }
    };
    var patchProp = function (el, key, prev, next) {
        switch (key) {
            case 'class': // .className  patchProp()
                patchClass(el, next);
                break;
            case 'style': // .style.xxx
                patchStyle(el, prev, next);
                break;
            default:
                if (/^on[^a-z]/.test(key)) {
                    // 事件
                    patchEvent(el, key, next);
                }
                else {
                    // 其他属性 直接使用 setAttribute
                    patchAttrs(el, key, next);
                }
        }
    };

    // 需要支持dom创建的api及属性处理的api
    // runtime-dom主要作用就是抹平平台的差异，不同的平台对dom的操作不同，将api传入core中，core可以调用这些方法
    var rendererOptions = extend(nodeOps, { patchProp: patchProp });
    // 1. 用户传入组件的属性  2. 需要创建组件的虚拟节点 3. 将虚拟节点变成真正的节点
    var createApp = function (rootComponent, rootProps) {
        if (rootProps === void 0) { rootProps = null; }
        var app = createRenderer().createApp(rootComponent, rootProps);
        var mount = app.mount;
        // 重写mount方法，不仅可以接受用户参数，还可以做一些前置工作
        // 函数劫持 AOP切片编程
        app.mount = function (container) {
            container = rendererOptions.querySelector(container);
            container.innerHTML = "";
            mount(container);
        };
    };

    exports.createApp = createApp;
    exports.createRenderer = createRenderer;
    exports.h = h;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

}({}));
//# sourceMappingURL=runtime-dom.global.js.map
