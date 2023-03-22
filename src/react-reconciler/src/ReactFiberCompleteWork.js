import {
  createTextInstance,
  createInstance,
  appendInitialChild,
  finalizeInitialChildren,
} from "react-dom-bindings/src/client/ReactDOMHostConfig";
import { HostComponent, HostRoot, HostText } from "./ReactWorkTags";
import { NoFlags } from "./ReactFiberFlags";

/**
 * completework是左右中，当前节点的子fiber链表对应dom已经构建完
 *
 * 有些fiber 组件fiber, 是空fiber,没有dom
 * dfs 子fiber 如果有dom就挂载并且返回
 *
 * 用循环写的递归
 * @param {*} parent 当前节点dom
 * @param {*} workInProgress 当前节点fiber
 */
function appendAllChildren(parent, workInProgress) {
  let node = workInProgress.child;
  while (node) {
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node.stateNode);
    } else if (node.child !== null) {
      node = node.child;
      continue;
    }

    if (node === workInProgress) {
      return;
    }

    // 如果没有兄弟节点，就一直返回
    while (node.sibling === null) {
      // 子一层dom构建完了
      if (node.return === null || node.return === workInProgress) {
        return;
      }
      node = node.return;
    }
    node = node.sibling;
  }
}

/**
 * mount阶段，创建dom, 设置jsx element的props到dom
 * @param {*} current 老fiber
 * @param {*} workInProgress 新fiber
 */
export function completeWork(current, workInProgress) {
  const newProps = workInProgress.pendingProps;
  switch (workInProgress.tag) {
    case HostRoot:
      bubbleProperties(workInProgress);
      break;
    case HostText:
      // 如果是文本节点的fiber，创建真实文本节点dom放到fiber.stateNode
      const newText = newProps;
      workInProgress.stateNode = createTextInstance(newText);
      bubbleProperties(workInProgress);
      break;
    case HostComponent:
      // 如果是原生节点的fiber，创建dom放到fiber.stateNode
      const { type } = workInProgress;
      const instance = createInstance(type, newProps, workInProgress);
      workInProgress.stateNode = instance;

      // 把自己所有的子节点dom添加到自己的身上
      appendAllChildren(instance, workInProgress);

      // 将prop 设置到dom上
      finalizeInitialChildren(instance, type, newProps);

      // 向上冒泡属性
      bubbleProperties(workInProgress);
      break;
  }
}

function bubbleProperties(workInProgress) {
  let subtreeFlags = NoFlags;

  // 将child链表所有更新，累计到fiber的subtreeFlags，用于性能优化，如果子fiber没有变更，就不用dfs处理
  let child = workInProgress.child;
  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;
    child = child.sibling;
  }
  workInProgress.subtreeFlags = subtreeFlags;
}
