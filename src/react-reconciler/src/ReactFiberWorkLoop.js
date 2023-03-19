import { scheduleCallback } from "scheduler";
import { createWorkInProgress } from "./ReactFiber";
import { beginWork } from "./ReactFiberBeginWork";
import { completeWork } from "./ReactFiberCompleteWork";

// FiberRootNode.current指向旧fiber树，workInProgress指向新fiber树
let workInProgress = null;

/**
 *
 * @param {*} root
 */
export function scheduleUpdateOnFiber(root) {
  ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root) {
  // 1帧内如果空闲就执行performConcurrentWorkOnRoot
  scheduleCallback(performConcurrentWorkOnRoot.bind(null, root));
}

/**
 * mount阶段
 * 根据fiber构建fiber树
 * 创建fiber的真实dom, 并且插入容器dom
 *
 *
 * @param {*} root
 */
function performConcurrentWorkOnRoot(root) {
  // 第一次渲染以同步的方式渲染根节点
  renderRootSync(root);
}

function prepareFreshStack(root) {
  workInProgress = createWorkInProgress(root.current, null);
}

function renderRootSync(root) {
  // 创建新fiber树的 根fiber
  prepareFreshStack(root);
  // dfs 遍历新的fiber树
  // mount时，边遍历边生成，遍历一个fiber，生成children fiber链表
  workLoopSync();
}

// dfs beginWork 中左
// dfs completeWork 左右中 无child就可以开始
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork) {
  const current = unitOfWork.alternate;
  const next = beginWork(current, unitOfWork);
  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  if (next === null) {
    // 如果dfs到了叶子节点，没有child, 执行complete
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(unitOfWork) {
  let completedWork = unitOfWork;
  do {
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;
    completeWork(current, completedWork);

    const siblingFiber = completedWork.sibling;
    // 先dfs兄弟节点
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }

    // 当前节点是child链表的最后一个，下一个是父节点
    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);
}
