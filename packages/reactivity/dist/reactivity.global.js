var VueReactivity = (function (exports) {
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
    var hasOwn = function (target, key) { return Object.prototype.hasOwnProperty.call(target, key); };

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
    var shallowGet = createGetter(false, true);
    var readonlyGet = createGetter(true);
    var shallowReadonlyGet = createGetter(true, true);
    var set = createSetter();
    var shallowSet = createSetter();
    var mutableHandler = {
        set: set,
        get: get,
    };
    var shallowReactiveHandler = {
        set: shallowSet,
        get: shallowGet
    };
    var readonlySet = {
        set: function (target, key) {
            console.warn("cannot set " + JSON.stringify(target) + " on key '" + key + "' failed");
        }
    };
    var readonlyHandler = extend({
        get: readonlyGet
    }, readonlySet);
    var shallowReadonlyHandler = extend({
        get: shallowReadonlyGet
    }, readonlySet);

    // 是否是浅的，默认时深度
    // 是否为只读，默认为否
    function reactive(target) {
        return createReactiveObject(target, false, mutableHandler);
    }
    function shallowReactive(target) {
        return createReactiveObject(target, false, shallowReactiveHandler);
    }
    function readonly(target) {
        return createReactiveObject(target, true, readonlyHandler);
    }
    function shallowReadonly(target) {
        return createReactiveObject(target, true, shallowReadonlyHandler);
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

    function ref(value) {
        // 把普通值变成一个引用类型，让一个普通值也具备响应式的能力
        return createRef(value);
    }
    var convert = function (v) { return isObject(v) ? reactive(v) : v; };
    // ts 中实现类的话，私有属性必须先声明才能使用
    var RefImpl = /** @class */ (function () {
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
    }());
    function createRef(value, shallow) {
        if (shallow === void 0) { shallow = false; }
        return new RefImpl(value, shallow); // 借助类的属性访问器
    }
    var ObjectRefImpl = /** @class */ (function () {
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
    }());
    function toRef(target, key) {
        return new ObjectRefImpl(target, key);
    }
    function toRefs(target, key) {
        var res = isArray(target) ? new Array(target.length) : {};
        for (var key_1 in target) {
            res[key_1] = toRef(target, key_1);
        }
        return res;
    }

    var ComputedRefImpl = /** @class */ (function () {
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
    }());
    function computed(getterOrOptions) {
        var getter;
        var setter;
        if (isObject(getterOrOptions)) {
            getter = getterOrOptions.get;
            setter = getterOrOptions.set;
        }
        else {
            getter = getterOrOptions;
            setter = function () {
                console.log("computed no setter");
            };
        }
        return new ComputedRefImpl(getter, setter);
    }

    exports.computed = computed;
    exports.effect = effect;
    exports.reactive = reactive;
    exports.readonly = readonly;
    exports.ref = ref;
    exports.shallowReactive = shallowReactive;
    exports.shallowReadonly = shallowReadonly;
    exports.toRef = toRef;
    exports.toRefs = toRefs;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

}({}));
//# sourceMappingURL=reactivity.global.js.map
