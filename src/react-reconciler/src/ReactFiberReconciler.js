import { createFiberRoot } from "./ReactFiberRoot";
import { createUpdate, enqueueUpdate } from "./ReactFiberClassUpdateQueue";
import { scheduleUpdateOnFiber } from "./ReactFiberWorkLoop";

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

  // 1. 创建更新
  const update = createUpdate();
  update.payload = { element };
  const root = enqueueUpdate(current, update);

  // 2. 执行更新
  scheduleUpdateOnFiber(root);
}
