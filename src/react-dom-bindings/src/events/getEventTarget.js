/**
 * 获取事件源dom
 * @param {*} nativeEvent 原生事件e
 * @returns
 */
function getEventTarget(nativeEvent) {
  const target = nativeEvent.target || nativeEvent.srcElement || window;
  return target;
}

export default getEventTarget;
