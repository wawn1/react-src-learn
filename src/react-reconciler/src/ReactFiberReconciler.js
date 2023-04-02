import { createFiberRoot } from "./ReactFiberRoot";
import { createUpdate, enqueueUpdate } from "./ReactFiberClassUpdateQueue";
import { scheduleUpdateOnFiber, requestUpdateLane } from "./ReactFiberWorkLoop";

// 返回一个对象 FiberRootNode{containerInfo}
export function createContainer(containerInfo) {
  return createFiberRoot(containerInfo);
}

/**
 * 更新容器，创建更新任务，执行更新
 *
 * 1, jsx element 放入 HostRootFiber的updateQueue
 * 更新任务就只包含element的数据， 不需要行为
 * 2, 执行更新
 *
 * @param {*} element 虚拟dom
 * @param {*} container FiberRootNode FiberRootNode.containerInfo就是容器dom
 */
export function updateContainer(element, container) {
  const current = container.current;

  // 请求一个更新车道
  const lane = requestUpdateLane(current);

  // 1. 创建更新
  const update = createUpdate(lane);
  update.payload = { element };
  const root = enqueueUpdate(current, update, lane);

  // 2. 执行更新
  scheduleUpdateOnFiber(root, current, lane);
}
