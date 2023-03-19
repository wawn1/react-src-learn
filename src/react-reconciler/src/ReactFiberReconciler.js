import { createFiberRoot } from "./ReactFiberRoot";

// 返回一个对象 FiberRootNode{containerInfo}
export function createContainer(containerInfo) {
  return createFiberRoot(containerInfo);
}
