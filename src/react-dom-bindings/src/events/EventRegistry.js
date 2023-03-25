export const allNativeEvents = new Set();

/**
 * 填充allNativeEvents，插件带来的需要注册的原生事件名
 * @param {*} registrationName React事件名 例如onClick
 * @param {*} dependencies 原生事件数组 [click]
 */
export function registerTwoPhaseEvent(registrationName, dependencies) {
  // 注册冒泡事件的对应关系
  registerDirectEvent(registrationName, dependencies);
  // 注册捕获事件的对应关系
  registerDirectEvent(registrationName + "Capture", dependencies);
}

export function registerDirectEvent(registrationName, dependencies) {
  for (let i = 0; i < dependencies.length; i++) {
    allNativeEvents.add(dependencies[i]);
  }
}
