import { createContainer } from "react-reconciler/src/ReactFiberReconciler";

function ReactDOMRoot(internalRoot) {
  this._internalRoot = internalRoot;
}

/**
 *
 * @param {*} container id是root 的真实dom
 * @returns ReactDOMRoot{_internalRoot： FiberRootNode{containerInfo: container入参dom}}
 */
export function createRoot(container) {
  const root = createContainer(container);
  return new ReactDOMRoot(root);
}
