import { createHostRootFiber } from "./ReactFiber";

function FiberRootNode(containerInfo) {
  this.containerInfo = containerInfo;
}

/**
 * 创建一个根fiber, 并且绑定真实dom
 * 根fiber有2个，双缓存
 * 容器dom只有一个，绑定在旧fiber树的根fiber
 * @param {*} containerInfo id为root的真实dom
 * @returns FiberRootNode{containerInfo: root dom}
 */
export function createFiberRoot(containerInfo) {
  // 根fiber的真实dom 容器dom
  const root = new FiberRootNode(containerInfo);
  // 根fiber
  const uninitializedFiber = createHostRootFiber();
  // 互相关联
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;
  return root;
}
