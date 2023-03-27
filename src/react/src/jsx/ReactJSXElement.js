import hasOwnProperty from "shared/hasOwnProperty";
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";

function hasValidRef(config) {
  return config.key !== undefined;
}

const RESERVED_PROPS = {
  key: true,
  ref: true,
  __self: true,
  __source: true,
};

function ReactElement(type, key, ref, props) {
  return {
    $$typeof: REACT_ELEMENT_TYPE, // jsx element标识
    type, // span h1 标签
    key,
    ref,
    props,
  };
}

/**
 * 将babel编译结果转化为jsx element(虚拟dom)
 * key, ref, style, children等在babel中都转出来了, 放在了config
 * jsx编译后，形成jsxDEV嵌套调用的函数执行，会先执行最内部的element构建
 * key, ref 单独存变量，其他存入props
 * @param {*} type
 * @param {*} config
 * @param {*} maybeKey 组件key
 */
export function jsxDEV(type, config, maybeKey) {
  const props = {};
  let key = null;
  let ref = null;

  // key ref存储
  if (typeof maybeKey !== undefined) {
    key = maybeKey;
  }
  if (hasValidRef(config)) {
    ref = config.ref;
  }

  // props存储
  for (let propName in config) {
    if (
      hasOwnProperty.call(config, propName) &&
      !RESERVED_PROPS.hasOwnProperty(propName)
    ) {
      props[propName] = config[propName];
    }
  }
  return ReactElement(type, key, ref, props);
}
