import {
  registerSimpleEvents,
  topLevelEventsToReactNames,
} from "../DOMEventProperties";
import { IS_CAPTURE_PHASE } from "../EventSystemFlags";
import { accumulateSinglePhaseListeners } from "../DOMPluginEventSystem";
import { SyntheticMouseEvent } from "../SyntheticEvent";

/**
 * 把要执行的回调函数添加到dispatchQueue
 * @param {*} dispatchQueue 事件函数队列
 * @param {*} domEventName dom事件名 click
 * @param {*} targetInst  事件源dom对应fiber
 * @param {*} nativeEvent 原生事件 e
 * @param {*} nativeEventTarget 事件源dom
 * @param {*} eventSystemFlags 冒泡0，捕获4
 * @param {*} targetContainer 容器dom div#root
 */
function extractEvents(
  dispatchQueue,
  domEventName,
  targetInst,
  nativeEvent,
  nativeEventTarget,
  eventSystemFlags,
  targetContainer
) {
  let SyntheticEventCtor; // 合成事件的构建函数
  switch (domEventName) {
    case "click":
      SyntheticEventCtor = SyntheticMouseEvent;
      break;
    default:
      break;
  }

  const reactName = topLevelEventsToReactNames.get(domEventName); // click=> onClick
  const isCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0; // 是否捕获阶段
  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    reactName,
    nativeEvent.type,
    isCapturePhase
  );

  if (listeners.length > 0) {
    const event = new SyntheticEventCtor(
      reactName,
      domEventName,
      null,
      nativeEvent,
      nativeEventTarget
    );

    dispatchQueue.push({
      event, // 合成事件实例
      listeners, // 执行函数组
    });
  }
}

export { registerSimpleEvents as registerEvents, extractEvents };
