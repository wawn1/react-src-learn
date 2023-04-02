import {
  scheduleCallback as Scheduler_scheduleCallback,
  shouldYield,
  ImmediatePriority as ImmediateSchedulerPriority,
  UserBlockingPriority as UserBlockingSchedulerPriority,
  NormalPriority as NormalSchedulerPriority,
  IdlePriority as IdleSchedulerPriority,
} from "./Scheduler";
import { createWorkInProgress } from "./ReactFiber";
import { beginWork } from "./ReactFiberBeginWork";
import { completeWork } from "./ReactFiberCompleteWork";
import { MutationMask, NoFlags, Passive } from "./ReactFiberFlags";
import {
  commitMutationEffectsOnFiber, // 执行dom effect
  commitPassiveUnmountEffects, // 执行 useEffect destroy
  commitPassiveMountEffects, // 执行 useEffect create
  commitLayoutEffects,
} from "./ReactFiberCommitWork";
import { finishQueueingConcurrentUpdates } from "./ReactFiberConcurrentUpdates";
import {
  NoLanes,
  markRootUpdated,
  getNextLanes,
  SyncLane,
  getHeighestPriorityLane,
} from "./ReactFiberLane";
import {
  getCurrentUpdatePriority,
  lanesToEventPriority,
  DiscreteEventPriority,
  ContinuousEventPriority,
  DefaultEventPriority,
  IdleEventPriority,
} from "./ReactEventPriorities";
import { getCurrentEventPriority } from "react-dom-bindings/src/client/ReactDOMHostConfig";

// FiberRootNode.current指向旧fiber树，workInProgress指向新fiber树
let workInProgress = null;

// 一次工作完成才能再次执行, 构建中的root
let workInProgressRoot = null;

// 如果rootDoesHavePassiveEffect是true, 就缓存root到rootWithPendingPassiveEffects
let rootDoesHavePassiveEffect = false;

// 根节点 FiberRootNode root
// 由于effect是下一个宏任务执行，异步的，所以先缓存下来
let rootWithPendingPassiveEffects = null;

let workInProgressRenderLanes = NoLanes;

/**
 * 刷新页面，重新render
 * @param {*} root
 */
export function scheduleUpdateOnFiber(root, fiber, lane) {
  // 标记root上有哪些lane等待执行
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root) {
  // 获取当前优先级最高的lane
  const nextLanes = getNextLanes(root, NoLanes);
  let newCallbackPriority = getHeighestPriorityLane(nextLanes);

  if (newCallbackPriority === SyncLane) {
    // TODO
  } else {
    // 如果不是同步调度，创建一个任务
    let schedulerPriorityLevel;
    switch (lanesToEventPriority(nextLanes)) {
      // lane转eventPriority, eventPriority转schedulerPriorityLevel
      case DiscreteEventPriority:
        schedulerPriorityLevel = ImmediateSchedulerPriority;
        break;
      case ContinuousEventPriority:
        schedulerPriorityLevel = UserBlockingSchedulerPriority;
        break;
      case DefaultEventPriority:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
      case IdleEventPriority:
        schedulerPriorityLevel = IdleSchedulerPriority;
        break;
      default:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
    }
    // 下一个宏任务，执行performConcurrentWorkOnRoot
    Scheduler_scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }
}

/**
 * mount阶段
 * 根据fiber构建fiber树
 * 创建fiber的真实dom, 并且插入容器dom
 *
 *
 * @param {*} root
 */
function performConcurrentWorkOnRoot(root, timeout) {
  // 获取当前最高优先级lane
  const nextLanes = getNextLanes(root);
  if (nextLanes === NoLanes) {
    return null;
  }

  // 第一次渲染以同步的方式渲染根节点
  renderRootSync(root, nextLanes);
  // 此时存在新旧2个fiber树，新树，current的alternate， fiber已经构建好了，dom也创建好了，dom的props也修改好了
  // 开始进入提交阶段，执行副作用，将内存的dom插入dom树，下次就会渲染出来
  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  commitRoot(root);
}

/**
 * 1. 创建新fiber树的 根fiber
 * 2. 将update放到hook的queue, 将update放到fiber的queue
 * @param {*} root
 */
function prepareFreshStack(root, renderLanes) {
  // 缓存root
  workInProgressRoot = root;
  // 缓存fiber的renderLanes 给beginwork用
  workInProgressRenderLanes = renderLanes;
  // 创建根fiber
  workInProgress = createWorkInProgress(root.current, null);
  finishQueueingConcurrentUpdates();
}

function renderRootSync(root, renderLanes) {
  // 准备数据
  prepareFreshStack(root, renderLanes);
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

function workLoopConcurrent() {
  // 如果有下一个要构建的fiber，并且时间片没有过期
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork) {
  const current = unitOfWork.alternate;
  const next = beginWork(current, unitOfWork, workInProgressRenderLanes);
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

function flushPassiveEffect() {
  if (rootWithPendingPassiveEffects !== null) {
    // 缓存中取root
    const root = rootWithPendingPassiveEffects;
    // 执行卸载副作用，useEffect的destroy
    commitPassiveUnmountEffects(root.current);
    // 执行挂载副作用，useEffect的create
    commitPassiveMountEffects(root, root.current);
  }
}

function commitRoot(root) {
  // 清空
  workInProgressRoot = null;
  workInProgressRenderLanes = NoLanes;
  console.log("commitRoot~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  const { finishedWork } = root; // finishedWork 新fiber树的根fiber, root是FiberRootNode

  // 如果子树或者自己有 effect副作用
  if (
    (finishedWork.subtreeFlags & Passive) !== NoFlags ||
    (finishedWork.flags & Passive) !== NoFlags
  ) {
    if (!rootDoesHavePassiveEffect) {
      // 标记根root 有effect
      rootDoesHavePassiveEffect = true;
      // scheduleCallback执行时机 requestIdleCallback，在渲染之后执行，宏任务
      // 执行栈清空 => 微任务队列清空
      // => resize回调 => scroll回调 => requestAnimationFrame
      // => 渲染（dom操作，layout, paint）
      // => requestIdleCallback => 宏任务取一个放到执行栈
      // 当次render前不执行，render完后执行，下一个render生效
      Scheduler_scheduleCallback(NormalSchedulerPriority, flushPassiveEffect);
    }
  }

  // 判断子树有没有副作用
  const subtreeHasEffects =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffects = (finishedWork.flags & MutationMask) !== NoFlags;
  // 如果自己有副作用或者子节点有副作用就提交dom操作
  if (subtreeHasEffects || rootHasEffects) {
    // dom变更后 只是改了dom, 浏览器后面执行渲染
    commitMutationEffectsOnFiber(finishedWork, root);
    // 执行layout effect create
    console.log("recursive run layout effect create");
    commitLayoutEffects(finishedWork, root);
    // 如果有effect 缓存root
    if (rootDoesHavePassiveEffect) {
      rootDoesHavePassiveEffect = false;
      rootWithPendingPassiveEffects = root;
    }
  }
  // current指向新fiber树
  root.current = finishedWork;
}

// 申请一个车道
export function requestUpdateLane() {
  // 如果有更新车道就用
  const updateLane = getCurrentUpdatePriority();
  if (updateLane !== NoLanes) {
    return updateLane;
  }
  // 使用事件车道
  const eventLane = getCurrentEventPriority();
  return eventLane;
}
