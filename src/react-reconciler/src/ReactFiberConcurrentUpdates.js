import { HostRoot } from "./ReactWorkTags";

const concurrentQueue = [];
let concurrentQueuesIndex = 0;

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

/**
 * 将更新三元组 平摊放到concurrentQueue
 * @param {*} fiber 函数组件的fiber
 * @param {*} queue 更新hook的update链表
 * @param {*} update 一个update
 */
export function enqueueConcurrentHookUpdate(fiber, queue, update) {
  enqueueUpdate(fiber, queue, update);
  return getRootForUpdatedFiber(fiber);
}

function enqueueUpdate(fiber, queue, update) {
  concurrentQueue[concurrentQueuesIndex++] = fiber;
  concurrentQueue[concurrentQueuesIndex++] = queue;
  concurrentQueue[concurrentQueuesIndex++] = update;
}

/**
 * 返回root  FiberRootNode
 * @param {*} sourceFiber 当前fiber
 * @returns
 */
function getRootForUpdatedFiber(sourceFiber) {
  let node = sourceFiber;
  let parent = node.return;
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }
  return node.tag === HostRoot ? node.stateNode : null;
}

/**
 * 处理3元组 fiber queue update, fiber queue update
 * 将update挂到对应hook的更新队列
 */
export function finishQueueingConcurrentUpdates() {
  const endIndex = concurrentQueuesIndex;
  concurrentQueuesIndex = 0;
  let i = 0;
  while (i < endIndex) {
    const fiber = concurrentQueue[i++];
    const queue = concurrentQueue[i++];
    const update = concurrentQueue[i++];
    if (queue !== null && update !== null) {
      const pending = queue.pending;
      if (pending === null) {
        update.next = update;
      } else {
        update.next = pending.next;
        pending.next = update;
      }
      queue.pending = update;
    }
  }
}
