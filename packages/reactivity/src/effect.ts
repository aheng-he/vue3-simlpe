import { isArray, isIntegerKey } from "@vue/shared";

export function effect(fn, options: any = {}) {
    const effect = createReactiveEffect(fn, options)
    if (!options.lazy) {
        effect()
    }
    return effect;  // 返回响应式的effect
}

let activeEffect;
let effectStack = [];
let id = 0;

function createReactiveEffect(fn, options) {
    const effect = function reactvieEffect() {
        try {
            effectStack.push(effect);
            activeEffect = effect;
            return fn()
        } finally {
            effectStack.pop()
            activeEffect = effectStack[effectStack.length - 1]
        }
    }

    effect.id = id++;
    effect.__isEffect = true;
    effect.options = options;
    effect.deps = [];  // 用来收集依赖了那些属性
    return effect;
}

const targetMap = new WeakMap()

export function track(target, type, key) {
    if (activeEffect == undefined) {
        // 用户只是进行取值操作，而且这个 值不是在effect中使用的什么都不用收集
        return
    }

    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()))
    }

    let dep = depsMap.get(key)
    if (!dep) {
        depsMap.set(key, (dep = new Set()))
    }

    if (!dep.has(activeEffect)) {
        dep.add(activeEffect)
    }


}

export function trigger(target, type, key, newValue?, oldValue?) {
    // 去映射表里找属性对应的effect，让他重新执行
    const depsMap = targetMap.get(target);
    if (!depsMap) return // 只是修改了属性，没有在effect中使用

    const effectsSet = new Set();
    // 如果同时又多个，依赖的effect是同一个，还有set做一个过滤
    const add = (effectAdd) => {
        if (effectAdd) {
            effectAdd.forEach(effect => {
                effectsSet.add(effect)
            });
        }
    }



    // arr = [1,2,3]
    // arr.length = 1
    // arr.push(4)
    // 1. 如果更改了数组的长度，小于依赖收集的长度，要触发重新渲染
    // 2. 如果调用了push方法，或者其他新增数组的方法(必须能改变数组的长度)，也触发更新

    if (isArray(target) && key === 'length') {
        depsMap.forEach((dep, key) => {
            if (key > newValue || key === 'length') {
                add(dep);  // 更改了数组的长度，比收集到的属性值小
            }
        })
    } else {
        add(depsMap.get(key))
        switch (type) {
            case 'add':
                if (isArray(target) && isIntegerKey(key)) {
                    // 增加属性，需要触发length 的依赖属性
                    add(depsMap.get('length'))
                }
        }
    }


    effectsSet.forEach((effect: any) => {
        if (effect.options.schedular) {
            effect.options.schedular(effect)
        } else {
            effect()
        }
    })
}