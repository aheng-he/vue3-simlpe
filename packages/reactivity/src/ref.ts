import { hasChange, isArray, isObject } from "@vue/shared";
import { track, trigger } from "./effect";
import { reactive } from "./reactive";

export function ref(value) {
    // 把普通值变成一个引用类型，让一个普通值也具备响应式的能力
    return createRef(value)
}

export function shallowRef(value) {
    return createRef(value, true)
}

const convert = (v) => isObject(v) ? reactive(v) : v;

// ts 中实现类的话，私有属性必须先声明才能使用
class RefImpl {
    public _value;
    constructor(public rawValue, public shallow) {
        this._value = shallow ? rawValue : convert(rawValue)
    }

    get value() {
        // 收集依赖
        track(this, 'get', 'value')
        return this._value
    }

    set value(newValue) {
        // 触发更新
        if (hasChange(newValue, this.rawValue)) {
            this.rawValue = newValue;
            this._value = this.shallow ? newValue : convert(newValue)

            trigger(this, 'set', 'value', newValue)
        }
    }
}

function createRef(value, shallow = false) {
    return new RefImpl(value, shallow);  // 借助类的属性访问器
}

class ObjectRefImpl {
    public __v_isRef = true;
    constructor(public target, public key) {

    }
    get value() {
        return this.target[this.key]
    }
    set value(newValue) {
        this.target[this.key] = newValue
    }
}

export function toRef(target, key) {
    return new ObjectRefImpl(target, key)
}


export function toRefs(target, key) {
    const res = isArray(target) ? new Array(target.length) : {}
    for (let key in target) {
        res[key] = toRef(target, key)
    }
    return res;
}