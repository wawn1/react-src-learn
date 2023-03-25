import { setInitialProperties } from "./ReactDOMComponent";
import { precacheFiberNode, updateFiberProps } from "./ReactDOMComponentTree";
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
