import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import {
  createFiberFromElement,
  createFiberFromText,
  createWorkInProgress,
} from "./ReactFiber";
import { ChildDeletion, Placement } from "./ReactFiberFlags";
import isArray from "shared/isArray";

/**
 *
 * @param {*} shouldTrackSideEffects 是否跟踪副作用
 */
function createChildReconciler(shouldTrackSideEffects) {
  /**
   * 复制fiber
   * @param {*} fiber 老fiber
   * @param {*} pendingProps 新props
   * @returns 新fiber
   */
  function useFiber(fiber, pendingProps) {
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
  }

  /**
   * 删除子fiber
   * 打标记 ChildDeletion
   * @param {*} returnFiber
   * @param {*} childToDelete
   * @returns
   */
  function deleteChild(returnFiber, childToDelete) {
    if (!shouldTrackSideEffects) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
      console.log("tag ChildDeletion.", returnFiber);
    } else {
      returnFiber.deletions.push(childToDelete);
    }
  }

  /**
   * 删除currentFirstChild 剩下的所有兄弟节点
   * @param {*} returnFiber
   * @param {*} currentFirstChild
   * @returns
   */
  function deleteRemainingChildren(returnFiber, currentFirstChild) {
    if (!shouldTrackSideEffects) {
      return;
    }
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
    return null;
  }

  /**
   * 单节点dom-diff
   *
   * 新fiber是单节点，老fiber可能是数组
   * old fibers [1, 2, 3]  new fiber [2]
   *
   * 1. 如果key, type相同，则复用
   * 2. 如果key不同，删除这个老fiber和fiber的所有子fiber
   * 3. 如果key相同，type不同，删除当前fiber，创建一个新的
   * 4. 没有老fiber, mount时，根据element创建fiber挂载到returnFiber
   * @param {*} returnFiber 父fiber
   * @param {*} currentFirstChild 子fiber链表第一个fiber 老fiber链表
   * @param {*} element 父fiber的dom的child
   * @returns
   */
  function reconcileSingleElement(returnFiber, currentFirstChild, element) {
    // 单节点dom diff
    // 新fiber的key
    const key = element.key;
    // 新fiber的type
    const type = element.type;
    // 老fiber
    let child = currentFirstChild;
    while (child !== null) {
      if (child.key === key) {
        if (child.type === type) {
          // 删除老fiber之后的所有sibling节点
          deleteRemainingChildren(returnFiber, child.sibling);
          // 如果key和类型一样，则复用
          const existing = useFiber(child, element.props);
          existing.return = returnFiber;
          return existing;
        } else {
          // 如果key相同，type不同，这个老fiber要删除，换新类型的fiber，但是子fiber不能删
          // 找到了一个之后的老fiber都不用看了，直接清空跳出循环，走创建fiber的逻辑
          // go to createFiberFromElement
          deleteRemainingChildren(returnFiber, child);
        }
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    const created = createFiberFromElement(element);
    created.return = returnFiber;
    return created;
  }

  function placeChild(newFiber, newIndex) {
    newFiber.index = newIndex;
    if (shouldTrackSideEffects) {
      // Placement 表示创建dom
      newFiber.flags |= Placement;
      console.log("tag insert. placeChild.", newFiber);
    }
  }

  function reconcileChildrenArray(returnFiber, currentFirstChild, newChild) {
    let resultingFirstChild = null; // 返回的第一个新儿子
    let previousNewFiber = null;

    for (let newIndex = 0; newIndex < newChild.length; newIndex++) {
      const newFiber = createChild(returnFiber, newChild[newIndex]);
      if (newFiber === null) continue;
      // 加index 和 flags
      placeChild(newFiber, newIndex);

      // child fiber链表
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
    return resultingFirstChild;
  }

  function createChild(returnFiber, newChild) {
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number"
    ) {
      const created = createFiberFromText(`${newChild}`);
      created.return = returnFiber;
      return created;
    }
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          const created = createFiberFromElement(newChild);
          created.return = returnFiber;
          return created;
        default:
          break;
      }
    }
    return null;
  }

  /**
   * 设置副作用
   * @param {*} newFiber
   * @returns
   */
  function placeSingleChild(newFiber) {
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement;
      console.log("tag insert. placeSingleChild.", newFiber);
    }
    return newFiber;
  }
  /**
   * 构建returnFiber的子链表
   * @param {*} returnFiber 父fiber
   * @param {*} currentFirstChild returnFiber的老fiber的child，旧的子fiber链表第一个
   * @param {*} newChild returnFiber的jsx element的child, 子虚拟dom列表
   */
  function reconcileChildFibers(returnFiber, currentFirstChild, newChild) {
    // 单个子节点
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFirstChild, newChild)
          );
        default:
          break;
      }
    }
    // 子节点是个数组
    if (isArray(newChild)) {
      return reconcileChildrenArray(returnFiber, currentFirstChild, newChild);
    }
    return null;
  }
  return reconcileChildFibers;
}

// bugfix: mount 时不追踪effect
export const mountChildFibers = createChildReconciler(false);
export const reconcileChildFibers = createChildReconciler(true);
