import getEventTarget from "./getEventTarget";
import { getClosestInstanceFromNode } from "../client/ReactDOMComponentTree";
import { dispatchEventForPluginEventSystem } from "./DOMPluginEventSystem";
import {
  ContinuousEventPriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
} from "react-reconciler/src/ReactEventPriorities";

/**
 * 事件委托给容器的执行函数, 提前缓存一些参数
 * @param {*} targetContainer 容器dom div#root
 * @param {*} domEventName dom事件名 click
 * @param {*} eventSystemFlags 是否捕获阶段
 * @returns listener (event) => {do}
 */
export function createEventListenerWrapperWithPriority(
  targetContainer,
  domEventName,
  eventSystemFlags
) {
  const listenerWrapper = dispatchDiscreteEvent;
  return listenerWrapper.bind(
    null,
    domEventName,
    eventSystemFlags,
    targetContainer
  );
}

/**
 * 事件委托给容器的执行函数
 * @param {*} domEventName 事件名 click
 * @param {*} eventSystemFlags 阶段 冒泡0 捕获4
 * @param {*} container 容器dom div#root
 * @param {*} nativeEvent
 */
function dispatchDiscreteEvent(
  domEventName,
  eventSystemFlags,
  container,
  nativeEvent
) {
  // 在点击按钮的时候，需要设置更新优先级 1 非常高的优先级处理
  // 先缓存老的更新优先级
  const previousPriority = getCurrentUpdatePriority();
  try {
    // 把当前的更新优先级设置为离散事件优先级 1 同步的 用户点击等，优先级非常高
    setCurrentUpdatePriority(DiscreteEventPriority);
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    // 恢复之前的更新优先级
    setCurrentUpdatePriority(previousPriority);
  }
}

/**
 * 事件委托给容器的执行函数 listener
 * 当容器捕获或者冒泡时，会执行函数
 * @param {*} domEventName
 * @param {*} eventSystemFlags
 * @param {*} container
 * @param {*} nativeEvent addEventListener 传给listener的事件
 */
export function dispatchEvent(
  domEventName,
  eventSystemFlags,
  targetContainer,
  nativeEvent
) {
  // 从事件e中获取事件源
  const nativeEventTarget = getEventTarget(nativeEvent);
  // 从dom私有属性中获取fiber
  const targetInst = getClosestInstanceFromNode(nativeEventTarget);

  dispatchEventForPluginEventSystem(
    domEventName, // click
    eventSystemFlags, // 阶段 冒泡0 捕获4
    nativeEvent, // 事件e
    targetInst, // 事件源dom对应fiber
    targetContainer // 容器dom
  );
}

/**
 * 获取事件优先级
 * @param {*} domEventName 事件的名称 click
 */
export function getEventPriority(domEventName) {
  switch (domEventName) {
    case "click":
      return DiscreteEventPriority;
    case "drag":
      return ContinuousEventPriority;
    default:
      return DefaultEventPriority;
  }
}
