import { HostRoot } from "./ReactWorkTags";

/**
 * 处理更新优先级
 *
 * 先找到根fiber HostRootFiber, 再找根节点 FiberRootNode
 *
 * 根fiber的特点，return是null, tag是HostRoot, stateNode是FiberRootNode
 * @param {*} sourceFiber fiber 节点
 * @returns 根节点 FiberRootNode
 */
export function markUpdateLaneFromFiberToRoot(sourceFiber) {
  let node = sourceFiber;
  let parent = sourceFiber.return;

  while (parent !== null) {
    node = parent;
    parent = parent.return;
  }
  if (node.tag === HostRoot) {
    return node.stateNode;
  }
  return null;
}
