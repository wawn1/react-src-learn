import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { createFiberFromElement, createFiberFromText } from "./ReactFiber";
import { Placement } from "./ReactFiberFlags";
import isArray from "shared/isArray";

/**
 *
 * @param {*} shouldTrackSideEffects 是否跟踪副作用
 */
function createChildReconciler(shouldTrackSideEffects) {
  /**
   * mount时，根据element创建fiber挂载到returnFiber
   * @param {*} returnFiber
   * @param {*} currentFirstFiber
   * @param {*} element
   * @returns
   */
  function reconcileSingleElement(returnFiber, currentFirstFiber, element) {
    const created = createFiberFromElement(element);
    created.return = returnFiber;
    return created;
  }

  function placeChild(newFiber, newIndex) {
    newFiber.index = newIndex;
    if (shouldTrackSideEffects) {
      // Placement 表示创建dom
      newFiber.flags |= Placement;
    }
  }

  function reconcileChildrenArray(returnFiber, currentFirstFiber, newChild) {
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
    if (shouldTrackSideEffects) {
      newFiber.flags |= Placement;
    }
    return newFiber;
  }
  /**
   * 构建returnFiber的子链表
   * @param {*} returnFiber 父fiber
   * @param {*} currentFirstFiber returnFiber的老fiber的child，旧的子虚拟dom列表第一个
   * @param {*} newChild returnFiber的jsx element的child, 子虚拟dom列表
   */
  function reconcileChildFibers(returnFiber, currentFirstFiber, newChild) {
    // 单个子节点
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFirstFiber, newChild)
          );
        default:
          break;
      }
    }
    // 子节点是个数组
    if (isArray(newChild)) {
      return reconcileChildrenArray(returnFiber, currentFirstFiber, newChild);
    }
    return null;
  }
  return reconcileChildFibers;
}

// bugfix: mount 时不追踪effect
export const mountChildFibers = createChildReconciler(false);
export const reconcileChildFibers = createChildReconciler(true);
