import {
  setInitialProperties,
  diffProperties,
  updateProperties,
} from "./ReactDOMComponent";
import { precacheFiberNode, updateFiberProps } from "./ReactDOMComponentTree";
import { DefaultEventPriority } from "react-reconciler/src/ReactEventPriorities";
import { getEventPriority } from "../events/ReactDOMEventListener";

export function shouldSetTextContent(type, props) {
  return (
    typeof props.children === "string" || typeof props.children === "number"
  );
}

// 创建text dom
export function createTextInstance(content) {
  return document.createTextNode(content);
}

// 创建 type dom
export function createInstance(type, props, fiber) {
  const domElement = document.createElement(type);
  precacheFiberNode(fiber, domElement);
  updateFiberProps(domElement, props);
  return domElement;
}

// child dom 添加到parent dom
export function appendInitialChild(parent, child) {
  parent.appendChild(child);
}

export function finalizeInitialChildren(domElement, type, props) {
  setInitialProperties(domElement, type, props);
}

export function insertBefore(parent, child, before) {
  parent.insertBefore(child, before);
}

export function appendChild(parent, child) {
  parent.appendChild(child);
}

export function prepareUpdate(domElement, type, oldProps, newProps) {
  return diffProperties(domElement, type, oldProps, newProps);
}

/**
 * 1. 更新dom的props
 * 2. 更新dom的fiber props缓存
 * @param {*} domElement dom
 * @param {*} updatePayload 更新队列
 * @param {*} type dom type
 * @param {*} oldProps 老props
 * @param {*} newProps 新props
 * @param {*} finishedWork fiber
 */
export function commitUpdate(
  domElement,
  updatePayload,
  type,
  oldProps,
  newProps,
  finishedWork
) {
  updateProperties(
    domElement,
    updatePayload,
    type,
    oldProps,
    newProps,
    finishedWork
  );
  updateFiberProps(domElement, newProps);
}

/**
 * 删除parentInstance的child dom
 * @param {*} parentInstance parent dom
 * @param {*} child child dom
 */
export function removeChild(parentInstance, child) {
  parentInstance.removeChild(child);
}

// 获取事件优先级
export function getCurrentEventPriority() {
  const currentEvent = window.event;
  if (currentEvent === undefined) {
    // 没有事件就是默认事件优先级
    return DefaultEventPriority;
  }
  // 不同事件类型，事件优先级不同
  return getEventPriority(currentEvent.type);
}
