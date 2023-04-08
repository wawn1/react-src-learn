import {
  scheduleCallback as Scheduler_scheduleCallback,
  shouldYield,
  ImmediatePriority as ImmediateSchedulerPriority,
  UserBlockingPriority as UserBlockingSchedulerPriority,
  NormalPriority as NormalSchedulerPriority,
  IdlePriority as IdleSchedulerPriority,
  cancelCallback as Scheduler_cancelCallback,
  now,
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
  includesBlockingLane,
  markStarvedLanesAsExpired,
  NoTimestamp,
  includesExpiredLane,
  mergeLanes,
  markRootFinished,
} from "./ReactFiberLane";
import {
  getCurrentUpdatePriority,
  lanesToEventPriority,
  DiscreteEventPriority,
  ContinuousEventPriority,
  DefaultEventPriority,
  IdleEventPriority,
  setCurrentUpdatePriority,
} from "./ReactEventPriorities";
import { getCurrentEventPriority } from "react-dom-bindings/src/client/ReactDOMHostConfig";
import {
  scheduleSyncCallback,
  flushSyncCallbacks,
} from "./ReactFiberSyncTaskQueue";

// FiberRootNode.current指向旧fiber树，workInProgress指向新fiber树
let workInProgress = null;

// 一次工作完成才能再次执行, 构建中的root
let workInProgressRoot = null;

// 如果rootDoesHavePassiveEffect是true, 就缓存root到rootWithPendingPassiveEffects
let rootDoesHavePassiveEffect = false;

// 根节点 FiberRootNode root
// 由于effect是下一个宏任务执行，异步的，所以先缓存下来
let rootWithPendingPassiveEffects = null;

let workInProgressRootRenderLanes = NoLanes;

// 构建fiber树 正在进行
const RootInProgress = 0;
// 构建fiber树已经完成
const RootCompleted = 5;
// 当前渲染工作结束的时候，当前fiber树处于什么状态，默认是进行中
let workInProgressRootExitStatus = RootInProgress;

// 当前事件发生的时间，缓存到全局
let currentEventTime = NoTimestamp;

/**
 * 刷新页面，重新render
 * @param {*} root
 */
export function scheduleUpdateOnFiber(root, fiber, lane, eventTime) {
  // 标记root上有哪些lane等待执行
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root, eventTime);
}

function ensureRootIsScheduled(root, currentTime) {
  // 先获取当前schedule task
  const existingCallbackNode = root.callbackNode;
  // 把所有饿死的赛道标记为过期
  markStarvedLanesAsExpired(root, currentTime);
  // 获取当前优先级最高的lane
  const nextLanes = getNextLanes(root, workInProgressRootRenderLanes);
  console.log("current render lane", nextLanes, workInProgressRootRenderLanes);
  // 如果没有要执行的任务
  if (nextLanes === NoLanes) {
    return;
  }

  let newCallbackPriority = getHeighestPriorityLane(nextLanes);
  // 获取现在根上正在运行的优先级
  const existingCallbackPriority = root.callbackPriority;
  // 一个函数里多次setState合并更新, 都在更新队列里，执行一次就行
  if (existingCallbackPriority === newCallbackPriority) {
    console.log("set state in one function. just one render. skip");
    return;
  }
  // 如果进到这里执行了render, 说明是后面的render, 说明优先级更高的schedule task, 取消掉原来的低优先级更新
  // useEffect 里的setState 是默认优先级32， onClick的setState优先级是1
  if (existingCallbackNode !== null) {
    console.log("cancel low task", existingCallbackNode);
    Scheduler_cancelCallback(existingCallbackNode);
  }

  // 可暂停的调度task schedule里最小堆存放的task
  let newCallbackNode;
  if (newCallbackPriority === SyncLane) {
    // 把performSyncWorkOnRoot放到同步队列中
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    //再把flushSyncCallbacks 放入微任务
    queueMicrotask(flushSyncCallbacks);
    newCallbackNode = null;
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
    // 创建一个调度task, callback是performConcurrentWorkOnRoot，绑定root. 并返回task
    newCallbackNode = Scheduler_scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }

  // 缓存调度task到root, 在commitRoot后清空该变量，可以用于判断一次render渲染任务是否完成
  root.callbackNode = newCallbackNode;
  // 缓存上次render的优先级
  root.callbackPriority = newCallbackPriority;
}

/**
 * mount阶段
 * 根据fiber构建fiber树
 * 创建fiber的真实dom, 并且插入容器dom
 *
 *
 * 并发指的是render阶段可以暂停，每次执行5ms, 然后释放，其他任务可以去抢占
 * flushPassiveEffect 执行effect任务就可以抢占，上次产生的effect优先级就比当次render阶段任务高
 *
 * 并发是render任务和其他任务，分时执行
 *
 * 1. 如果shouldTimeSlice true => renderRootConcurrent
 * 2. 如果shouldTimeSlice false => renderRootSync
 *
 * @param {*} root
 * @param {*} didTimeout bool 是否超时
 */
function performConcurrentWorkOnRoot(root, didTimeout) {
  console.log("performConcurrentWorkOnRoot");
  // 拿到缓存的调度任务task
  const originalCallbackNode = root.callbackNode;
  // 获取当前最高优先级lane
  const lanes = getNextLanes(root);
  if (lanes === NoLanes) {
    return null;
  }
  // 如果不包含阻塞的车道，并且没有超时
  // 默认更新车道是同步的，修改allowConcurrentByDefault标记才能启用时间分片
  const nonIncludesBlockingLane = !includesBlockingLane(root, lanes);
  // 是否不包含阻塞车道
  const nonIncludesExpiredLane = !includesExpiredLane(root, lanes);
  // 时间片没有过期
  const nonTimeout = !didTimeout;
  // 是否可以启动时间分片，可中断的render阶段
  const shouldTimeSlice =
    nonIncludesBlockingLane && nonIncludesExpiredLane && nonTimeout;
  console.log("shouldTimeSlice", shouldTimeSlice);

  // render阶段是否完成
  const exitStatus = shouldTimeSlice
    ? renderRootConCurrent(root, lanes)
    : renderRootSync(root, lanes);

  // 如果render阶段完成了
  if (exitStatus !== RootInProgress) {
    // 此时存在新旧2个fiber树，新树，current的alternate， fiber已经构建好了，dom也创建好了，dom的props也修改好了
    // 开始进入提交阶段，执行副作用，将内存的dom插入dom树，下次就会渲染出来
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    commitRoot(root);
  }

  // 如果不是null, 说明没有commitRoot完成
  // 将任务函数继续传给schedule, schedule就不会删除task,并且下次5ms时间片，看task优先级情况取出执行，有时候可能不是优先级最高的
  if (root.callbackNode === originalCallbackNode) {
    // 可能多次performConcurrentWorkOnRoot, 很多次都是5ms执行render阶段，最后一次同步执行commitRoot, 清空缓存的callbackNode调度任务
    console.log("add a schedule task.performConcurrentWorkOnRoot.");
    return performConcurrentWorkOnRoot.bind(null, root);
  }

  return null;
}

/**
 * 在根上执行同步工作
 */
function performSyncWorkOnRoot(root) {
  // 获取root最高优先级lane
  const lanes = getNextLanes(root);
  // 渲染新fiber树
  renderRootSync(root, lanes);
  // 获取新渲染完成的fiber根节点
  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  commitRoot(root);
  return null;
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
  workInProgressRootRenderLanes = renderLanes;
  // 创建根fiber
  workInProgress = createWorkInProgress(root.current, null);
  finishQueueingConcurrentUpdates();
}

function renderRootSync(root, renderLanes) {
  console.log("renderRootSync");
  if (
    root !== workInProgressRoot ||
    workInProgressRootRenderLanes !== renderLanes
  ) {
    // 准备数据
    prepareFreshStack(root, renderLanes);
  }
  // dfs 遍历新的fiber树
  // mount时，边遍历边生成，遍历一个fiber，生成children fiber链表
  workLoopSync();
  return RootCompleted;
}

/**
 * render阶段
 * @param {*} root 根节点
 * @param {*} lanes 优先级
 * @returns exitStatus render阶段是否完成
 */
function renderRootConCurrent(root, lanes) {
  console.log("renderRootConCurrent");
  // 因为构建fiber树的过程中，此方法会反复进入，
  // 只在第一次创建根fiber
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    console.log("create root node", lanes);
    prepareFreshStack(root, lanes);
  }

  // 在5ms内执行fiber树的构建，render阶段
  workLoopConcurrent();
  // 如果还有没有构建完成
  if (workInProgress !== null) {
    return RootInProgress;
  }
  // render阶段完成
  return workInProgressRootExitStatus;
}

// dfs beginWork 中左
// dfs completeWork 左右中 无child就可以开始
function workLoopSync() {
  console.log("workLoopSync");
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  console.log("workLoopConcurrent");
  // 如果有下一个要构建的fiber，并且时间片没有过期
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
    let startTimeTemp = Date.now();
    while (Date.now() - startTimeTemp < 6) {}
    console.log("shouldYield", shouldYield(), workInProgress);
  }
}

function performUnitOfWork(unitOfWork) {
  const current = unitOfWork.alternate;
  const next = beginWork(current, unitOfWork, workInProgressRootRenderLanes);
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

  // 如果走到了这里，说明整个fiber树构建完成，render阶段完成
  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted;
  }
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
  const previousUpdatePriority = getCurrentUpdatePriority();
  try {
    // render阶段可以同步或可暂停的，commit阶段必须同步DiscreteEventPriority
    setCurrentUpdatePriority(DiscreteEventPriority);
    commitRootImpl(root);
  } finally {
    setCurrentUpdatePriority(previousUpdatePriority);
  }
}

function commitRootImpl(root) {
  console.log("commitRoot~~~~~~~~~~~~~~~~~~~~~~~~~~~");

  // 清空
  workInProgressRoot = null;
  workInProgressRootRenderLanes = NoLanes;
  root.callbackNode = null;
  root.callbackPriority = null;

  const { finishedWork } = root; // finishedWork 新fiber树的根fiber, root是FiberRootNode
  // 合并统计当前新的根上的剩下的车道
  const remainingLanes = mergeLanes(
    finishedWork.lanes,
    finishedWork.childLanes
  );
  // 清空除了remainingLanes的其他lane的 expirationTimes
  markRootFinished(root, remainingLanes);

  console.log("commit", finishedWork.child.memoizedState.memoizedState[0]);

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
  // 在提交之后，因为根上可能会有跳过的更新，所以需要重新再次调度
  ensureRootIsScheduled(root, now());
}

// 获取优先级
// 如果有合并事件的优先级，就用
// 否则才看原生事件的优先级
// 只获取粗粒度的更新优先级，事件优先级 数轴聚类 => 更新优先级
export function requestUpdateLane() {
  // 如果有更新车道就用，event listener产生的lane,
  const updateLane = getCurrentUpdatePriority();
  if (updateLane !== NoLanes) {
    return updateLane;
  }
  // 使用事件车道
  const eventLane = getCurrentEventPriority();
  return eventLane;
}

// 请求当前时间
export function requestEventTime() {
  currentEventTime = now();
  return currentEventTime;
}
