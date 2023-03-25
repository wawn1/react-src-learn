import {
  appendChild,
  insertBefore,
} from "react-dom-bindings/src/client/ReactDOMHostConfig";
import { MutationMask, Placement } from "./ReactFiberFlags";
import {
  FuctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./ReactWorkTags";

function recursivelyTraverseMutationEffects(root, parentFiber) {
  if (parentFiber.subtreeFlags & MutationMask) {
    let { child } = parentFiber;
    while (child !== null) {
      commitMutationEffectsOnFiber(child, root);
      child = child.sibling;
    }
  }
}

function commitReconciliationEffects(finishedWork) {
  const { flags } = finishedWork;
  if (flags & Placement) {
    // 执行插入操作，也就是把真实dom插入父dom
    commitPlacement(finishedWork);
    // 清除effect
    finishedWork.flags = finishedWork.flags & ~Placement;
  }
}

// 判断fiber有没有dom, HostRoot有容器dom
function isHostParent(fiber) {
  return fiber.tag === HostComponent || fiber.tag === HostRoot;
}

/**
 * 寻找fiber的一个有真实dom的父fiber
 * @param {*} fiber
 * @returns
 */
function getHostParentFiber(fiber) {
  let parent = fiber.return;
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }
  return null;
}

/**
 * 找到要插入的锚点
 * 找到可以插在他前面的fiber, 并且该fiber是有dom的，不是虚fiber
 * @param {} fiber
 */
function getHostSibling(fiber) {
  let node = fiber;
  siblings: while (true) {
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null;
      }
      node = node.return;
    }
    node = node.sibling;
    while (node.tag !== HostComponent && node.tag !== HostText) {
      if (node.flags & Placement) {
        continue siblings;
      } else {
        node = node.child;
      }
    }

    if (!(node.flags & Placement)) {
      return node.stateNode;
    }
  }
}

/**
 * 向下寻找一层真实dom
 *
 * 将dom插入父dom
 *
 * @param {*} node 当前fiber
 * @param {*} before 当前fiber要插入的位置
 * @param {*} parent 父dom
 */
function insertOrAppendPlacementNode(node, before, parent) {
  const { tag } = node;
  const isHost = tag === HostComponent || tag === HostText;
  if (isHost) {
    const { stateNode } = node;
    if (before) {
      insertBefore(parent, stateNode, before);
    } else {
      appendChild(parent, stateNode);
    }
  } else {
    const { child } = node;
    if (child !== null) {
      insertOrAppendPlacementNode(child, before, parent);

      let { sibling } = child;
      while (sibling !== null) {
        insertOrAppendPlacementNode(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

/**
 * 把此fiber的真实dom插入到父dom
 *
 * 当前fiber和父fiber 都可能是没有dom的虚节点
 * @param {*} finishedWork 当前fiber
 */
function commitPlacement(finishedWork) {
  // 找到第一个有dom的父fiber
  let parentFiber = getHostParentFiber(finishedWork);
  switch (parentFiber.tag) {
    case HostRoot: {
      // 容器dom
      const parent = parentFiber.stateNode.containerInfo;
      const before = getHostSibling(finishedWork); // 获取最近的真实dom sibling
      insertOrAppendPlacementNode(finishedWork, before, parent);
      break;
    }
    case HostComponent: {
      const parent = parentFiber.stateNode;
      const before = getHostSibling(finishedWork);
      insertOrAppendPlacementNode(finishedWork, before, parent);
      break;
    }
    default:
      break;
  }
}

/**
 * 遍历fiber树，执行fiber上的副作用
 * @param {*} finishedWork fiber节点
 * @param {*} root 根节点
 */
export function commitMutationEffectsOnFiber(finishedWork, root) {
  switch (finishedWork.tag) {
    case FuctionComponent:
    case HostRoot:
    case HostComponent:
    case HostText: {
      // 先处理子节点副作用 递归
      recursivelyTraverseMutationEffects(root, finishedWork);
      // 处理自身的副作用
      commitReconciliationEffects(finishedWork);
      break;
    }
    default:
      break;
  }
}
