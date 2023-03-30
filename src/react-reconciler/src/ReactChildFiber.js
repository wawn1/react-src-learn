import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import {
  createFiberFromElement,
  createFiberFromText,
  createWorkInProgress,
} from "./ReactFiber";
import { ChildDeletion, Placement } from "./ReactFiberFlags";
import isArray from "shared/isArray";
import { HostText } from "./ReactWorkTags";

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
    console.log("tag ChildDeletion.", childToDelete);
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
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

  function placeChild(newFiber, lastPlacedIndex, newIndex) {
    newFiber.index = newIndex;
    if (!shouldTrackSideEffects) {
      return lastPlacedIndex;
    }
    const current = newFiber.alternate;
    if (current !== null) {
      // 如果有，说明这是一个更新的节点，有老的真实dom, 复用dom,只更新属性 或移动位置
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        // 如果当前fiber的index大于老fiber，说明是从后面移动到这里的，fiber是复用的，只需要标记插入就行
        newFiber.flags |= Placement;
        console.log("tag insert. move dom.", newFiber);
        return lastPlacedIndex;
      }
      return oldIndex;
    } else {
      // 如果没有，说明是一个新节点，需要标记插入
      newFiber.flags |= Placement;
      console.log("tag insert. create dom.", newFiber);
      return lastPlacedIndex;
    }
  }

  /**
   * key相同的情况下
   * 1. 如果type相同则复用
   * 2. 如果type不同，创建新fiber,
   * 如果有老dom, 则复用dom, completeWork时标记更新属性
   * 如果没有老dom, 则标记插入
   * 老fiber的标记删除和新fiber标记插入在外面函数做，这里只创建新fiber
   *
   * 返回新fiber
   * @param {*} returnFiber 父fiber
   * @param {*} current 老fiber
   * @param {*} element 新dom
   * @returns
   */
  function updateElement(returnFiber, current, element) {
    const elementType = element.type;
    if (current !== null) {
      // 新老type相同
      // key，type都相同，可以复用老fiber和真实dom
      if (current.type === elementType) {
        const existing = useFiber(current, element.props);
        existing.return = returnFiber;
        return existing;
      }

      // key相同，type不同， 标记删除，创建新的, 标记插入 samekeydifferenttype（1,2）
    }

    // 创建新的 samekeydifferenttype 2  这里创建的新fiber没有alternate, 后面用于判断是否复用成功
    const created = createFiberFromElement(element);
    created.return = returnFiber;
    return created;
  }

  /**
   * 尝试复用fiber
   * @param {*} returnFiber 新fiber树 父fiber
   * @param {*} oldFiber 老fiber
   * @param {*} newChild 新dom
   * @returns
   */
  function updateSlot(returnFiber, oldFiber, newChild) {
    const key = oldFiber !== null ? oldFiber.key : null;
    if (typeof newChild !== null && typeof newChild === "object") {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          // 如果key一样，进入更新元素的逻辑
          if (newChild.key === key) {
            return updateElement(returnFiber, oldFiber, newChild);
          }
        }
        default:
          return null;
      }
    }
    return null;
  }

  /**
   * 将剩余的老fiber，用key：fiber记录到map
   * @param {*} returnFiber 父fiber
   * @param {*} currentFirstChild 第一个老fiber
   * @returns
   */
  function mapRemainingChildren(returnFiber, currentFirstChild) {
    const existingChildren = new Map();
    let existingChild = currentFirstChild;
    while (existingChild !== null) {
      // 如果有key用key, 如果没有key用索引
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild);
      } else {
        existingChildren.set(existingChild.index, existingChild);
      }
      existingChild = existingChild.sibling;
    }

    return existingChildren;
  }

  /**
   * 如果map中有则复用，没有则创建
   * @param {*} returnFiber 父fiber
   * @param {*} current 老fiber
   * @param {*} textContent 文本节点
   * @returns
   */
  function updateTextNode(returnFiber, current, textContent) {
    if (current === null || current.tag !== HostText) {
      const created = createFiberFromText(textContent);
      created.return = returnFiber;
      return created;
    } else {
      const existing = useFiber(current, textContent);
      existing.return = returnFiber;
      return existing;
    }
  }

  /**
   * 如果map有相同key fiber，则复用
   * 如果没有，则创建
   * @param {*} existingChildren
   * @param {*} returnFiber
   * @param {*} newIdx
   * @param {*} newChild
   * @returns
   */
  function updateFromMap(existingChildren, returnFiber, newIdx, newChild) {
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number"
    ) {
      const matchedFiber = existingChildren.get(newIdx) || null;
      return updateTextNode(returnFiber, matchedFiber, "" + newChild);
    }
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key
            ) || null;
          return updateElement(returnFiber, matchedFiber, newChild);
        }
      }
    }
  }

  /**
   * DOM DIFF的三个规则
   * 只对同级元素进行比较，不同层级不对比
   * 不同的类型对应不同的元素
   * 可以通过key来标识同一个节点
   *
   * 第1轮遍历
   * key不同，直接结束本轮循环，第2轮循环 (*)
   * key相同，type不同，标记老fiber删除, 创建新的fiber，继续循环
   * key相同，type也相同，复用老fiber, 继续循环
   *
   * 第2轮遍历
   * 如果有1个结束了
   *   newChildren遍历完，oldFiber还有，将剩下oldFiber标记删除，diff结束
   *   oldFiber遍历完了，newChildren还有，将剩下newChildren标记插入，diff结束
   * newChildren和oldFiber都遍历完成，diff结束
   * newChildren和oldFiber都还有节点，第3轮循环，节点移动(*)
   *
   * 第3轮遍历
   * key不同跳出第1个循环，并且新旧2个链表都有剩余
   * 用map记录，key:oldFiber记录到map
   * 从前往后遍历，如果这个节点在前面位置，则复用移动过来
   * 如果没有能复用的，则创建
   * 如果多余了，则删除
   *
   *
   * @param {*} returnFiber
   * @param {*} currentFirstChild
   * @param {*} newChildren
   * @returns
   */
  function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren) {
    console.log(
      "reconcileChildrenArray returnFiber",
      returnFiber,
      currentFirstChild,
      newChildren
    );
    let resultingFirstChild = null; // 新fiber链表的第一个节点
    let previousNewFiber = null; // 新fiber链表的最后一个节点

    let newIdx = 0; // 遍历新child数组的指针

    let oldFiber = currentFirstChild; //  遍历老fiber链表的指针 初始第一个老fiber
    let nextOldFiber = null; // 遍历老fiber链表的下一个指针

    let lastPlacedIndex = 0; // 上一个不需要移动的节点的索引

    console.log("first loop. try to reuse.");
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      nextOldFiber = oldFiber.sibling;

      // 试图更新或者复用老fiber
      const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx]);
      if (newFiber === null) {
        break;
      }
      if (shouldTrackSideEffects) {
        // 如果有老fiber, 但是新的fiber并没有成功复用，就标记删除老fiber samekeydifferenttype 1
        if (oldFiber && newFiber.alternate === null) {
          deleteChild(returnFiber, oldFiber);
        }
      }
      // 指定fiber的位置, 并标记插入
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    // 如果新fiber已经没有了，旧fiber链表还有，将old链表剩下的全删掉
    if (newIdx === newChildren.length) {
      console.log("new fibers is done. delete remaining old fiber", oldFiber);
      deleteRemainingChildren(returnFiber, oldFiber);
      return resultingFirstChild;
    }

    if (oldFiber === null) {
      console.log("no old fiber. create remaining fibers");
      // 如果老fiber已经没有了，新虚拟dom还有，插入剩下的新节点
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx]);
        if (newFiber === null) continue;
        // 加index 和 flags
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);

        // child fiber链表
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    // 开始处理移动的情况
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber);
    // 开始遍历剩下的虚拟dom子节点
    for (; newIdx < newChildren.length; newIdx++) {
      console.log("move reuse.");
      // 移动复用或创建新节点
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx]
      );
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          // 移动复用了的老fiber 从fiber删除
          if (newFiber.alternate !== null) {
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key
            );
          }
        }
        // 标记插入，也就是移动，将原dom插入到另一个位置就是移动
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        // newFiber挂到链表里
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    if (shouldTrackSideEffects) {
      // map剩下的全部删除
      existingChildren.forEach((child) => deleteChild(returnFiber, child));
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
