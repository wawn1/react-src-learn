import { mergeLanes } from "./ReactFiberLane";
import { HostRoot } from "./ReactWorkTags";

const concurrentQueues = [];
let concurrentQueuesIndex = 0;

/**
 * 针对hook的update
 * 
 * 将更新三元组 平摊放到concurrentQueue
 * @param {*} fiber 函数组件的fiber
 * @param {*} queue 更新hook的update链表  hook.queue
 * @param {*} update 一个update 
 * update结构 {
    action,
    hasEagerState: false, // 是否有提前计算新state
    eagerState: null, // 新state
    next: null,
  }
 */
export function enqueueConcurrentHookUpdate(fiber, queue, update, lane) {
  // setState=>执行 dispatchReducerAction => 将update暂存到concurrentQueue
  enqueueUpdate(fiber, queue, update, lane);
  console.log("after enqueue. concurrentQueues", concurrentQueues);
  return getRootForUpdatedFiber(fiber);
}

function enqueueUpdate(fiber, queue, update, lane) {
  concurrentQueues[concurrentQueuesIndex++] = fiber;
  concurrentQueues[concurrentQueuesIndex++] = queue;
  concurrentQueues[concurrentQueuesIndex++] = update;
  concurrentQueues[concurrentQueuesIndex++] = lane;
  // 当我们向一个fiber添加一个更新，要把此更新的lane合并到此fiber的lanes
  fiber.lanes = mergeLanes(fiber.lanes, lane);
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
 * a) 将hook的update，加到hook.queue.pending链表中
 * 处理3元组 fiber queue update, fiber queue update
 * 将update挂到对应hook的更新队列
 * b) 将fiber的update，加到fiber.updateQueue.shared.pending链表中
 */
export function finishQueueingConcurrentUpdates() {
  const endIndex = concurrentQueuesIndex;
  concurrentQueuesIndex = 0;
  let i = 0;
  while (i < endIndex) {
    const fiber = concurrentQueues[i++];
    const queue = concurrentQueues[i++];
    const update = concurrentQueues[i++];
    const lane = concurrentQueues[i++];
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

/**
 * 针对fiber的update
 *
 * 把fiber的update 放入concurrentQueues, 返回根fiber
 *
 * @param {*} fiber 根fiber HostRootFiber
 * @param {*} queue sharedQueue 待生效的队列 fiber.updateQueue.shared
 * @param {*} update 更新obj
 * update结构 {
 * payload: {element}
 * }
 * @param {*} lane 此更新的车道
 */
export function enqueueConcurrentClassUpdate(fiber, queue, update, lane) {
  enqueueUpdate(fiber, queue, update, lane);
  return getRootForUpdatedFiber(fiber);
}
