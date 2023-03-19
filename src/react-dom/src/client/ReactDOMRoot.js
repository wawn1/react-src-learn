import {
  createContainer,
  updateContainer,
} from "react-reconciler/src/ReactFiberReconciler";

function ReactDOMRoot(internalRoot) {
  this._internalRoot = internalRoot;
}

/**
 * FiberRootNode 内部有容器dom
 * FiberRootNode的render方法，将虚拟dom渲染到真实容器dom里
 * 只需要创建更新任务，放入队列，工作循环会执行
 * @param {*} children jsx element(虚拟dom)
 */
ReactDOMRoot.prototype.render = function (children) {
  const root = this._internalRoot;
  updateContainer(children, root);
};

/**
 *
 * @param {*} container id是root 的真实dom
 * @returns ReactDOMRoot{_internalRoot： FiberRootNode{containerInfo: container入参dom}}
 */
export function createRoot(container) {
  const root = createContainer(container);
  return new ReactDOMRoot(root);
}
