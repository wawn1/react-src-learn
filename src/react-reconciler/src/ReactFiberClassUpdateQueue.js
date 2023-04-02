import { enqueueConcurrentClassUpdate } from "./ReactFiberConcurrentUpdates";
import assign from "shared/assign";
import { isSubsetOfLanes, mergeLanes, NoLane, NoLanes } from "./ReactFiberLane";

/**
 * fiber上的更新队列
 * update包含那些种类？
 * 1. {payload: {element}} 容器dom element, 整个dom树都在了
 *
 * 更新的时机
 * updateContainer
 * 1. enqueueUpdate => enqueueConcurrentClassUpdate(update 暂存到concurrentQueues)
 * 2. scheduleUpdateOnFiber => performConcurrentWorkOnRoot=> renderRootSync
 * => prepareFreshStack => finishQueueingConcurrentUpdates (将update 加到fiber.updateQueue.shared.pending)
 * => workLoopSync => performUnitOfWork => beginWork => updateHostRoot => processUpdateQueue (将element放到fiber.memoizedState)
 * 4. reconcileChildren, 用element 构建fiber树
 */

export const UpdateState = 0;

export function initialUpdateQueue(fiber) {
  // 创建一个新的更新队列
  // 循环队列，外部引用指针指向最后一个元素
  const queue = {
    baseState: fiber.memoizedState, // 更新队列链表，输入state。一般是firstBaseUpdate的旧state
    firstBaseUpdate: null, // 单链表，表头，update组成的
    lastBaseUpdate: null, // 单链表，表尾，update组成的
    shared: {
      pending: null, // 循环链表
    },
  };
  fiber.updateQueue = queue;
}

export function createUpdate(lane) {
  const update = { tag: UpdateState, lane, next: null };
  return update;
}

/**
 * 将update 放入 fiber的updateQueue
 * @param {*} fiber fiber节点
 * @param {*} update update {payload:{element}}
 */
export function enqueueUpdate(fiber, update, lane) {
  // 获取更新队列
  const updateQueue = fiber.updateQueue;
  const sharedQueue = updateQueue.shared;
  return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane);
}

/**
 * 根据老状态和更新队列，计算新的状态，放到 fiber.memoizedState
 *
 * 一个update链表workInProgress.updateQueue，根据入参优先级renderLanes, 执行一遍
 * 链表开头的连续高优先级，执行了，下次不执行
 * 在低优先级update之后，优先级高的执行了，为了保持getStateFromUpdate 顺序state计算流的正确性，下次还得执行，而且必须执行
 *
 * @param {*} workInProgress 要计算的fiber
 */
export function processUpdateQueue(workInProgress, nextProps, renderLanes) {
  const queue = workInProgress.updateQueue;

  // 老链表的表头
  let firstBaseUpdate = queue.firstBaseUpdate;
  // 老链表的表尾
  let lastBaseUpdate = queue.lastBaseUpdate;
  // 新链表的尾部 循环链表
  const pendingQueue = queue.shared.pending;

  // 合并新老链表
  if (pendingQueue !== null) {
    queue.shared.pending = null;
    // 循环链表最后一个节点
    const lastPendingUpdate = pendingQueue;
    // 循环链表头结点
    const firstPendingUpdate = lastPendingUpdate.next;
    // 剪开循环
    lastPendingUpdate.next = null;

    // 如果没有老链表
    if (lastBaseUpdate === null) {
      // 指向新链表表头
      firstBaseUpdate = firstPendingUpdate;
    } else {
      // 新链表接入到老链表表尾
      lastBaseUpdate.next = firstPendingUpdate;
    }
    lastBaseUpdate = lastPendingUpdate;
  }

  // 如果新链表（单链表）不空, 计算新状态，赋值给workInProgress.memoizedState
  if (firstBaseUpdate !== null) {
    let newState = queue.baseState;

    let newLanes = NoLanes;
    let newBaseState = null;
    let newFirstBaseUpdate = null;
    let newLastBaseUpdate = null;
    let update = firstBaseUpdate;

    do {
      const updateLane = update.lane;
      // 如果updateLane 不是renderLanes的子集，说明本次渲染不需要处理这个更新
      if (!isSubsetOfLanes(renderLanes, updateLane)) {
        const clone = {
          id: update.id,
          lane: updateLane,
          payload: update.payload,
        };
        // 将这个跳过的update放到新链表
        if (newLastBaseUpdate === null) {
          newFirstBaseUpdate = newLastBaseUpdate = clone;
          // 新链表表头的state, 顺序执行update的初始state
          newBaseState = newState;
        } else {
          newLastBaseUpdate = newLastBaseUpdate.next = clone;
        }
        // 如果有跳过的更新，就要lane合并到fiber上，fiber.lanes表示下次还要执行的lanes
        newLanes = mergeLanes(newLanes, updateLane);
      } else {
        // 说明要处理这个update

        if (newLastBaseUpdate !== null) {
          // 新链表有值，说明已经有跳过的update，这种比较特殊，本次要执行，下次还要执行一遍
          // 夹在没有执行的update之间的update，虽然执行过一遍，还是要顺序执行一遍保持结果不变
          const clone = {
            id: update.id,
            lane: NoLane, // 因为执行过了，下次不希望跳过，下次必须执行
            payload: update.payload,
          };
          // update加入新链表
          newLastBaseUpdate = newLastBaseUpdate.next = clone;
        }
        // 执行update
        newState = getStateFromUpdate(update, newState);
      }
      update = update.next;
    } while (update);
    if (!newLastBaseUpdate) {
      // queue所有update执行完, 这次链表所有update执行完的最终结果，作为下次update更新队列的初始state queue.baseState
      newBaseState = newState;
    }
    queue.baseState = newBaseState;
    queue.firstBaseUpdate = newFirstBaseUpdate;
    queue.lastBaseUpdate = newLastBaseUpdate;
    workInProgress.lanes = newLanes;
    // 每次执行update, 都更新memoizedState
    workInProgress.memoizedState = newState;
  }
}

/**
 * 根据老状态计算新状态
 * @param {*} update
 * @param {*} prevState
 */
function getStateFromUpdate(update, prevState) {
  switch (update.tag) {
    case UpdateState:
      const { payload } = update;
      let partialState;
      if (typeof payload === "function") {
        partialState = payload.call(null, prevState, nextProps);
      } else {
        partialState = payload;
      }
      return assign({}, prevState, partialState);
  }
}

export function cloneUpdateQueue(current, workInProgress) {
  const workInProgressQueue = workInProgress.updateQueue;
  const currentQueue = current.updateQueue;
  // 如果对象是同一个，就clone一个，对象分开，不互相影响
  if (currentQueue === workInProgressQueue) {
    const clone = {
      baseState: currentQueue.baseState,
      firstBaseUpdate: currentQueue.firstBaseUpdate,
      lastBaseUpdate: currentQueue.lastBaseUpdate,
      shared: currentQueue.shared,
    };
    workInProgress.updateQueue = clone;
  }
}
