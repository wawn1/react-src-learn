import {
  appendChild,
  insertBefore,
  commitUpdate,
  removeChild,
} from "react-dom-bindings/src/client/ReactDOMHostConfig";
import {
  MutationMask,
  Placement,
  Update,
  Passive,
  LayoutMask,
  Ref,
} from "./ReactFiberFlags";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./ReactWorkTags";
import {
  HasEffect as HookHasEffect,
  Passive as HookPassive,
  Layout as HookLayout,
} from "./ReactHookEffectTags";

let hostParent = null;

/**
 * 向上寻找有dom的fiber
 * @param {*} fiber
 * @returns
 */
function findHostParent(fiber) {
  let parent = fiber;
  while (parent !== null) {
    if (parent.tag === HostComponent) {
      return parent.stateNode;
    } else if (parent.tag === HostRoot) {
      return parent.stateNode.containerInfo;
    }
    parent = parent.return;
  }
  return null;
}

/**
 * 递归删除fiber和该fiber的所有子节点
 * @param {*} finishedWork 容器root
 * @param {*} nearestMountAncestor 父fiber
 * @param {*} deletedFiber 要删除的fiber
 */
function commitDeletionEffectsOnFiber(
  finishedRoot,
  nearestMountAncestor,
  deletedFiber
) {
  switch (deletedFiber.tag) {
    case HostComponent:
    case HostText: {
      // 先递归删除子节点，再删除当前节点，因为要处理子节点生命周期钩子
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountAncestor,
        deletedFiber
      );
      // 删除自己
      if (hostParent !== null) {
        removeChild(hostParent, deletedFiber.stateNode);
      }
      break;
    }
    default:
      break;
  }
}

function recursivelyTraverseDeletionEffects(
  finishedRoot,
  nearestMountAncestor,
  parent
) {
  let child = parent.child;
  while (child !== null) {
    commitDeletionEffectsOnFiber(finishedRoot, nearestMountAncestor, child);
    child = child.sibling;
  }
}

/**
 * 1. 向上找到有dom的父fiber
 * 2. 递归删除父fiber dom的子节点
 *
 * @param {*} root 容器节点
 * @param {*} returnFiber 父fiber
 * @param {*} deletedFiber 要删除的fiber
 */
function commitDeletionEffects(root, returnFiber, deletedFiber) {
  hostParent = findHostParent(returnFiber);
  commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);
  hostParent = null;
}

/**
 * 处理子节点打的effect tag
 * 1. 删除子节点
 * 2. 递归处理子节点
 * @param {*} root 容器根节点
 * @param {*} parentFiber 当前要处理副作用的fiber
 */
function recursivelyTraverseMutationEffects(root, parentFiber) {
  const deletions = parentFiber.deletions;
  // 如果子节点有删除，处理删除
  if (deletions !== null) {
    for (let i = 0; i < deletions.length; i++) {
      const childToDelete = deletions[i];
      commitDeletionEffects(root, parentFiber, childToDelete);
    }
  }

  // 如果子节点有更新，处理更新
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
  // 老fiber
  const current = finishedWork.alternate;
  // 更新tag
  const flags = finishedWork.flags;

  switch (finishedWork.tag) {
    case FunctionComponent: {
      // 先处理子节点副作用 递归
      recursivelyTraverseMutationEffects(root, finishedWork);
      // 处理自身的副作用
      commitReconciliationEffects(finishedWork);
      // 执行useLayoutEffect 的destroy
      if (flags & Update) {
        console.log("recursive run layout effect destroy");
        commitHookEffectListUnmount(HookHasEffect | HookLayout, finishedWork);
      }
      break;
    }
    case HostRoot:
    case HostText: {
      // 先处理子节点副作用 递归
      recursivelyTraverseMutationEffects(root, finishedWork);
      // 处理自身的副作用
      commitReconciliationEffects(finishedWork);
      break;
    }
    case HostComponent: {
      // 先处理子节点副作用 递归
      recursivelyTraverseMutationEffects(root, finishedWork);
      // 处理自身的副作用
      commitReconciliationEffects(finishedWork);
      // 处理ref副作用
      if (flags & Ref) {
        commitAttachRef(finishedWork);
      }

      // 处理DOM更新
      if (flags & Update) {
        // 获取真实dom
        const instance = finishedWork.stateNode;
        // 更新真实dom 属性
        if (instance !== null) {
          const newProps = finishedWork.memoizedProps;
          const oldProps = current !== null ? current.memoizedProps : newProps;
          const type = finishedWork.type;
          const updatePayload = finishedWork.updateQueue;
          finishedWork.updateQueue = null;
          if (updatePayload) {
            // 执行update二元组  属性，值
            commitUpdate(
              instance,
              updatePayload,
              type,
              oldProps,
              newProps,
              finishedWork
            );
          }
        }
      }
      break;
    }
    default:
      break;
  }
}

function commitAttachRef(finishedWork) {
  const ref = finishedWork.ref;
  if (ref !== null) {
    const instance = finishedWork.stateNode;
    if (typeof ref === "function") {
      ref(instance);
    } else {
      ref.current = instance;
    }
  }
}

// 递归执行fiber树的所有fiber的effect链表的destroy
export function commitPassiveUnmountEffects(finishedWork) {
  console.log("recursive run effect destroy");
  commitPassiveUnmountOnFiber(finishedWork);
}

function commitPassiveUnmountOnFiber(finishedWork) {
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case HostRoot: {
      recursivelyTraversePassiveUnmountEffects(finishedWork);
      break;
    }
    case FunctionComponent: {
      recursivelyTraversePassiveUnmountEffects(finishedWork);
      if (flags & Passive) {
        commitHookPassiveUnmountEffects(
          finishedWork,
          HookHasEffect | HookPassive
        );
      }
      break;
    }
  }
}

// 递归fiber树所有节点
function recursivelyTraversePassiveUnmountEffects(parentFiber) {
  if (parentFiber.subtreeFlags & Passive) {
    let child = parentFiber.child;
    while (child !== null) {
      commitPassiveUnmountOnFiber(child);
      child = child.sibling;
    }
  }
}

/**
 * 执行fiber effect链表的destory
 * @param {*} finishedWork fiber
 * @param {*} hookFlags 9 HookHasEffect | HookPassive
 */
function commitHookPassiveUnmountEffects(finishedWork, hookFlags) {
  commitHookEffectListUnmount(hookFlags, finishedWork);
}

function commitHookEffectListUnmount(flags, finishedWork) {
  const updateQueue = finishedWork.updateQueue;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      if ((effect.tag & flags) === flags) {
        const destroy = effect.destroy;
        // 由于先执行destroy, 再执行create。第一次执行时没有desctroy
        if (destroy) {
          destroy();
        }
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

// 递归执行fiber树的所有fiber的effect链表的create
export function commitPassiveMountEffects(root, finishedWork) {
  console.log("recursive run effect create");
  commitPassiveMountOnFiber(root, finishedWork);
}

/**
 * 递归执行fiber树的所有fiber的effect链表
 * @param {*} finishedRoot root FiberRootNode
 * @param {*} finishedWork root.current HostRootFiber
 */
function commitPassiveMountOnFiber(finishedRoot, finishedWork) {
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case HostRoot: {
      recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork);
      break;
    }
    case FunctionComponent: {
      recursivelyTraversePassiveMountEffects(finishedRoot, finishedWork);
      if (flags & Passive) {
        // Passive 1024  多一步执行effect链表
        commitHookPassiveMountEffects(
          finishedWork,
          HookPassive | HookHasEffect
        );
      }
      break;
    }
  }
}

// 递归fiber树所有节点
function recursivelyTraversePassiveMountEffects(root, parentFiber) {
  if (parentFiber.subtreeFlags & Passive) {
    let child = parentFiber.child;
    while (child !== null) {
      commitPassiveMountOnFiber(root, child);
      child = child.sibling;
    }
  }
}

function commitHookPassiveMountEffects(finishedWork, hookFlags) {
  commitHookEffectListMount(hookFlags, finishedWork);
}

/**
 * 执行fiber的effect链表
 * finishedWork.updateQueue.lastEffect 指向effect循环链表最后一个
 * @param {*} flags 9 HookPassive | HookHasEffect
 * @param {*} finishedWork fiber
 */
function commitHookEffectListMount(flags, finishedWork) {
  const updateQueue = finishedWork.updateQueue;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      if ((effect.tag & flags) === flags) {
        const create = effect.create;
        effect.destroy = create();
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

export function commitLayoutEffects(finishedWork, root) {
  // 老fiber
  const current = finishedWork.alternate;
  commitLayoutEffectOnFiber(root, current, finishedWork);
}

// 递归执行所有fiber的layout effect链表
function commitLayoutEffectOnFiber(finishedRoot, current, finishedWork) {
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case HostRoot: {
      recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
      break;
    }
    case FunctionComponent: {
      recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
      if (flags & LayoutMask) {
        // Passive 1024  多一步执行effect链表
        commitHookLayoutEffects(finishedWork, HookHasEffect | HookLayout);
      }
      break;
    }
  }
}

function commitHookLayoutEffects(finishedWork, hookFlags) {
  commitHookEffectListMount(hookFlags, finishedWork);
}

function recursivelyTraverseLayoutEffects(root, parentFiber) {
  if (parentFiber.subtreeFlags & LayoutMask) {
    let child = parentFiber.child;
    while (child !== null) {
      const current = child.alternate;
      commitLayoutEffectOnFiber(root, current, child);
      child = child.sibling;
    }
  }
}
