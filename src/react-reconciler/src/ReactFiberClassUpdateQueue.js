import { markUpdateLaneFromFiberToRoot } from "./ReactFiberConcurrentUpdates";
import assign from "shared/assign";

export const UpdateState = 0;

export function initialUpdateQueue(fiber) {
  // 创建一个新的更新队列
  // 循环队列，外部引用指针指向最后一个元素
  const queue = {
    shared: {
      pending: null,
    },
  };
  fiber.updateQueue = queue;
}

export function createUpdate() {
  const update = { tag: UpdateState };
  return update;
}

/**
 * 将update 放入 fiber的updateQueue
 * @param {*} fiber fiber节点
 * @param {*} update update 一个对象，记录更新操作和数据
 */
export function enqueueUpdate(fiber, update) {
  const updateQueue = fiber.updateQueue;
  const pending = updateQueue.shared.pending; // 外部指针
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;

  // 返回根节点
  return markUpdateLaneFromFiberToRoot(fiber);
}

/**
 * 根据老状态和更新队列，计算新的状态
 * @param {*} workInProgress 要计算的fiber
 */
export function procesUpdateQueue(workInProgress) {
  const queue = workInProgress.updateQueue;
  const pendingQueue = queue.shared.pending;

  if (pendingQueue !== null) {
    queue.shared.pending = null;
    // 循环链表最后一个节点
    const lastPendingUpdate = pendingQueue;
    // 循环链表头结点
    const firstPendingUpdate = lastPendingUpdate.next;
    // 剪开循环
    lastPendingUpdate.next = null;

    // 从头执行更新链表
    let nextState = workInProgress.memoizedState;
    let update = firstPendingUpdate;
    while (update) {
      nextState = getStateFromUpdate(update, nextState);
      update = update.next;
    }

    // 将最终计算结果 放到fiber的新状态
    workInProgress.memoizedState = nextState;
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
      return assign({}, prevState, payload);
  }
}
