/**
 * 注册一个事件的 容器委托捕获函数
 * @param {*} target 容器dom
 * @param {*} eventType 原生事件名 click
 * @param {*} listener 委托事件执行函数
 * @returns
 */
export function addEventCaptureListener(target, eventType, listener) {
  target.addEventListener(eventType, listener, true);
  return listener;
}

/**
 * 注册一个事件的 容器委托冒泡函数
 * @param {*} target 容器dom
 * @param {*} eventType 原生事件名 click
 * @param {*} listener 委托事件执行函数
 * @returns
 */
export function addEventBubbleListener(target, eventType, listener) {
  target.addEventListener(eventType, listener, false);
  return listener;
}
