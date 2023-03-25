import { allNativeEvents } from "./EventRegistry";
import * as SimpleEventPlugin from "./plugins/SimpleEventPlugin";
import { IS_CAPTURE_PHASE } from "./EventSystemFlags";
import { createEventListenerWrapperWithPriority } from "./ReactDOMEventListener";
import {
  addEventCaptureListener,
  addEventBubbleListener,
} from "./EventListener";
import getEventTarget from "./getEventTarget";
import { HostComponent } from "react-reconciler/src/ReactWorkTags";
import getListener from "./getListener";

SimpleEventPlugin.registerEvents();
const listeningMarker = `_reactListening` + Math.random().toString(36).slice(2);

export function listenToAllSupportedEvents(rootContainerElement) {
  // 监听根容器，只监听一次
  if (!rootContainerElement[listeningMarker]) {
    rootContainerElement[listeningMarker] = true;

    // 遍历所有原生事件，注册委托事件函数
    allNativeEvents.forEach((domEventName) => {
      listenToNativeEvent(domEventName, true, rootContainerElement);
      listenToNativeEvent(domEventName, false, rootContainerElement);
    });
  }
}

/**
 * 注册委托事件函数
 * @param {*} domEventName 原生事件
 * @param {*} isCapturePhaseListener 是否是捕获阶段
 * @param {*} target 容器dom
 */
export function listenToNativeEvent(
  domEventName,
  isCapturePhaseListener,
  target
) {
  let eventSystemFlags = 0; // 冒泡0，捕获4
  if (isCapturePhaseListener) {
    eventSystemFlags |= IS_CAPTURE_PHASE;
  }

  addTrappedEventListener(
    target,
    domEventName,
    eventSystemFlags,
    isCapturePhaseListener
  );
}

function addTrappedEventListener(
  targetContainer,
  domEventName,
  eventSystemFlags,
  isCapturePhaseListener
) {
  // 创建事件委托函数
  const listener = createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags
  );

  // 注册监听函数
  if (isCapturePhaseListener) {
    addEventCaptureListener(targetContainer, domEventName, listener);
  } else {
    addEventBubbleListener(targetContainer, domEventName, listener);
  }
}

export function dispatchEventForPluginEventSystem(
  domEventName, // click
  eventSystemFlags, // 阶段 冒泡0 捕获4
  nativeEvent, // 事件e
  targetInst, //  事件源dom对应fiber
  targetContainer // 容器dom
) {
  dispatchEventForPlugins(
    domEventName,
    eventSystemFlags,
    nativeEvent,
    targetInst,
    targetContainer
  );
}

function dispatchEventForPlugins(
  domEventName, // click
  eventSystemFlags, // 阶段 冒泡0 捕获4
  nativeEvent, // 事件e
  targetInst, //  事件源dom对应fiber
  targetContainer // 容器dom
) {
  const nativeEventTarget = getEventTarget(nativeEvent);
  const dispatchQueue = [];

  // 将合成事件和执行函数 zip组合 放入dispatchQueue
  extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  );

  processDispatchQueue(dispatchQueue, eventSystemFlags);
}

/**
 * 执行合成事件 dispatchQueue
 * @param {*} dispatchQueue {event 合成事件, listeners react事件函数} 数组
 * @param {*} eventSystemFlags 是否捕获阶段
 */
function processDispatchQueue(dispatchQueue, eventSystemFlags) {
  // 判断是否在捕获阶段
  const isCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
  for (let i = 0; i < dispatchQueue.length; i++) {
    const { event, listeners } = dispatchQueue[i];
    processDispatchQueueItemsInOrder(event, listeners, isCapturePhase);
  }
}

function executeDispatch(event, listener, currentTarget) {
  // 合成事件实例currentTarget是不断变化的
  // event nativeEventTarget 是原始事件源 永远不变
  // event currentTarget 当前事件源
  event.currentTarget = currentTarget;
  listener(event);
}

/**
 * 执行react事件函数
 * @param {*} event 合成事件
 * @param {*} dispatchListeners 合成事件函数 和附带的fiber和dom
 * @param {*} isCapturePhase 是否捕获阶段
 * @returns
 */
function processDispatchQueueItemsInOrder(
  event,
  dispatchListeners,
  isCapturePhase
) {
  if (isCapturePhase) {
    for (let i = dispatchListeners.length - 1; i >= 0; i--) {
      const { listener, currentTarget } = dispatchListeners[i]; // listener onClick, currentTarget dom, instance fiber
      if (event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
    }
  } else {
    for (let i = 0; i < dispatchListeners.length; i++) {
      const { listener, currentTarget } = dispatchListeners[i]; // react的onClick函数
      if (event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
    }
  }
}

function extractEvents(
  dispatchQueue,
  domEventName,
  targetInst,
  nativeEvent,
  nativeEventTarget,
  eventSystemFlags,
  targetContainer
) {
  SimpleEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  );
}

/**
 * 从fiber到根fiber 累计react事件函数
 * @param {*} targetFiber fiber
 * @param {*} reactName react事件名
 * @param {*} nativeEventType
 * @param {*} isCapturePhase 是不是捕获阶段
 */
export function accumulateSinglePhaseListeners(
  targetFiber,
  reactName,
  nativeEventType,
  isCapturePhase
) {
  const captureName = reactName + "Capture";
  const reactEventName = isCapturePhase ? captureName : reactName;
  const listeners = [];
  let instance = targetFiber;
  while (instance !== null) {
    const { stateNode, tag } = instance;
    if (tag === HostComponent && stateNode !== null) {
      const listener = getListener(instance, reactEventName);
      if (listener) {
        listeners.push(createDispatchListener(instance, listener, stateNode));
      }
    }
    instance = instance.return;
  }
  return listeners;
}

/**
 * 将onClick 事件listener函数 的fiber和dom记录下来
 * @param {*} instance fiber
 * @param {*} listener onClick
 * @param {*} currentTarget dom
 */
function createDispatchListener(instance, listener, currentTarget) {
  return { instance, listener, currentTarget };
}
