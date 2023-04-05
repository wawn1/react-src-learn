import ReactSharedInternals from "shared/ReactSharedInternals";
import { requestUpdateLane, scheduleUpdateOnFiber } from "./ReactFiberWorkLoop";
import { enqueueConcurrentHookUpdate } from "./ReactFiberConcurrentUpdates";
import {
  Passive as PassiveEffect,
  Update as UpdateEffect,
} from "./ReactFiberFlags";
import {
  HasEffect as HookHasEffect,
  Passive as HookPassive,
  Layout as HookLayout,
} from "./ReactHookEffectTags";
import { NoLanes } from "./ReactFiberLane";

const { ReactCurrentDispatcher } = ReactSharedInternals;

/**
 *
 * setState 执行时机？
 * 1. setState=>执行 dispatchReducerAction => 将update暂存到concurrentQueues
 * 2. setState => scheduleUpdateOnFiber root上执行更新=> performConcurrentWorkOnRoot => renderRootSync
 * a) => prepareFreshStack 将update 挂载到对应hook的queue
 * b) => workLoopSync => performUnitOfWork => beginWork => renderWithHooks => 执行component => 执行useState => 执行updateReducer(执行hook.queue)
 *
 * effect执行时机？
 * 1. updateEffect => 生成effect放到 fiber.updateQueue.lastEffect
 * 2. 等render后，commitRoot => 下一个宏任务执行 flushPassiveEffect
 */

// hook单向链表 最后一个
let workInProgressHook = null;
// 当前fiber currentlyRenderingFiber.memoizedState hook单向链表 第一个
let currentlyRenderingFiber = null;

// 老hook
let currentHook = null;

const HooksDispatcherOnMount = {
  useReducer: mountReducer,
  useState: mountState,
  useEffect: mountEffect,
  useLayoutEffect: mountLayoutEffect,
};

const HooksDispatcherOnUpdate = {
  useReducer: updateReducer,
  useState: updateState,
  useEffect: updateEffect,
  useLayoutEffect: updateLayoutEffect,
};

function mountLayoutEffect(create, deps) {
  // 标记fiber Update, 标记hook layout effect
  return mountEffectImpl(UpdateEffect, HookLayout, create, deps);
}

function updateLayoutEffect(create, deps) {
  return updateEffectImpl(UpdateEffect, HookLayout, create, deps);
}

function updateEffect(create, deps) {
  return updateEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
  // 复制老hook 生成新hook
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy;
  if (currentHook !== null) {
    // 获取老的useEffect hook的，老的effect对象
    const prevEffect = currentHook.memoizedState;
    destroy = prevEffect.destroy;
    if (nextDeps !== null) {
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // 复制effect, 更新hook.memoizedState 和 构建新的fiber的effect链表
        // 不管要不要重新执行，都要创建新的effect对象，构建新的effect链表，fiber.updateQueue.lastEffect
        // passive 类型
        hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps);
        return;
      }
    }
  }
  // 如果要执行effect，加HookHasEffect，表示有hook
  currentlyRenderingFiber.flags |= fiberFlags;
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    destroy,
    nextDeps
  );
}

// 浅比较dependence 数组
function areHookInputsEqual(nextDeps, prevDeps) {
  if (prevDeps === null) {
    return null;
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

/**
 * 数据结构关系
 * fiber.memoizedState 指向hook 链表的第一个，hook链表中一些是effect hook
 * fiber.updateQueue.lastEffect  指向effect循环链表最后一个位置
 *
 * useState, 状态和更新都挂在hook上
 * 但是useEffect, effect函数挂在fiber.updateQueue.lastEffect上
 *
 * useEffect 函数
 * @param {*} create
 * @param {*} deps
 * @returns
 */
function mountEffect(create, deps) {
  return mountEffectImpl(PassiveEffect, HookPassive, create, deps);
}

/**
 * 创建hook，挂到hook链表里
 * 给hook的fiber 加flags 表示组件里用到useEffect
 *
 * @param {*} fiberFlags fiber effect flag
 * @param {*} hookFlags hook effect flag
 * @param {*} create useEffect create函数
 * @param {*} deps useEffect deps依赖
 */
function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
  // 创建hook，加入hook链表
  const hook = mountWorkInProgressHook();
  // 下一个依赖
  const nextDeps = deps === undefined ? null : deps;
  // 给fiber打tag, 表示有useEffect
  currentlyRenderingFiber.flags |= fiberFlags;
  // 创建effect,挂在fiber的effect链表
  // 将effect放到useEffect hook的状态  hook.memoizedState
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    undefined,
    nextDeps
  );
}

/**
 * fiber.updateQueue.lastEffect 指向循环链表末尾
 * 创建effect,并加入到循环链表末尾
 * @param {*} tag effect flag (passive/layout HasEffect)
 * @param {*} create useEffect创建函数
 * @param {*} destroy useEffect销毁函数
 * @param {*} deps useEffect依赖数组
 */
function pushEffect(tag, create, destroy, deps) {
  const effect = {
    tag,
    create,
    destroy,
    deps,
    next: null,
  };
  let componentUpdateQueue = currentlyRenderingFiber.updateQueue;
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber.updateQueue = componentUpdateQueue;
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    const lastEffect = componentUpdateQueue.lastEffect;
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      componentUpdateQueue.lastEffect = effect;
    }
  }
  return effect;
}

function createFunctionComponentUpdateQueue() {
  return {
    lastEffect: null,
  };
}

// useState其实就是内置了reducer的useReducer
// action 就是setState的入参，(oldState)=> newState 或者state
function baseStateReducer(state, action) {
  return typeof action === "function" ? action(state) : action;
}

function updateState(initialState) {
  return updateReducer(baseStateReducer);
}

// 和mountReducer基本一样
// setState加了一个优化，如果state没变，则不更新
function mountState(initialState) {
  const hook = mountWorkInProgressHook();
  hook.memoizedState = initialState;
  const queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: baseStateReducer, // 上一个reducer
    lastRenderedState: initialState, // 上一个state
  };
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;
  hook.queue = queue;

  return [hook.memoizedState, dispatch];
}

/**
 * 生成setState函数
 * setState(x=> x+1)  setState(2)
 * action就是setState传入的参数
 * @param {*} fiber
 * @param {*} queue
 * @param {*} action x=> x+1  2
 * @returns setState 函数, 参数action
 */
function dispatchSetState(fiber, queue, action) {
  // 获取当前的更新赛道
  const lane = requestUpdateLane();
  const update = {
    lane, // 这个update的优先级
    action,
    hasEagerState: false, // 是否有提前计算新state
    eagerState: null, // 新state
    next: null,
  };

  // processUpdateQueue 处理update, 如果有跳过的，会把剩余的lanes记录到fiber
  // 如果队列不空则不计算，lastRenderedState 就不是正确的基础state, 前面update还没执行，newState还没产生
  if (
    fiber.lanes === NoLanes &&
    (fiber.alternate === null || fiber.alternate.lanes === NoLanes)
  ) {
    const { lastRenderedReducer, lastRenderedState } = queue;
    const eagerState = lastRenderedReducer(lastRenderedState, action);
    update.hasEagerState = true;
    update.eagerState = eagerState;
    if (Object.is(eagerState, lastRenderedState)) {
      return;
    }
  }

  // setState触发更新
  const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
  // 这里是为了把lane二进制合并到root.pendingLanes, 记录发生了那些优先级的事件
  scheduleUpdateOnFiber(root, fiber, lane);
}

/**
 * 组件useReducer的底层函数
 * 1. 复制老hook 到新hook (所以没有执行setState, state对象连地址都不变)
 * 2. 执行reducer, 更新state
 * @param {*} reducer
 * @returns [新state, setState]
 */
function updateReducer(reducer) {
  // 新hook
  const hook = updateWorkInProgressHook();
  // 新的更新队列
  const queue = hook.queue;
  // 老的hook
  const current = currentHook;
  console.log("执行hook更新队列hook.queue，更新state", queue);

  // 基于老state, 执行reducer，计算newState
  const pendingQueue = queue.pending;
  let newState = current.memoizedState;
  if (pendingQueue !== null) {
    queue.pending = null;
    const firstUpdate = pendingQueue.next;
    let update = firstUpdate;
    do {
      if (update.hasEagerState) {
        // 如果提前算过了，直接取
        newState = update.eagerState;
      } else {
        const action = update.action;
        newState = reducer(newState, action);
        update = update.next;
      }
    } while (update !== null && update !== firstUpdate);
  }
  hook.memoizedState = newState;
  queue.lastRenderedState = newState;
  return [hook.memoizedState, queue.dispatch];
}

/**
 * 根据老hook 节点，构建新的hook 节点（复制state queue）
 * 并放到新fiber上
 */
function updateWorkInProgressHook() {
  // 获取将要构建的新hook的老hook
  if (currentHook === null) {
    // 当前构建的fiber  currentlyRenderingFiber, 老fiber  current
    const current = currentlyRenderingFiber.alternate;
    // 老hook
    currentHook = current.memoizedState;
  } else {
    // 下一个老hook
    currentHook = currentHook.next;
  }
  console.log("copy old hook", currentHook);

  // 复制旧hook
  const newHook = {
    memoizedState: currentHook.memoizedState,
    queue: currentHook.queue,
    next: null,
  };

  if (workInProgressHook === null) {
    workInProgressHook = newHook;
    // fiber的状态是hook链表第一个节点
    currentlyRenderingFiber.memoizedState = newHook;
  } else {
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }
  return workInProgressHook;
}

/**
 * 相当于执行 组件useReducer
 * 组件useReducer 是装饰函数
 * @param {*} reducer
 * @param {*} initialArg
 * @returns [state, setState]
 */
function mountReducer(reducer, initialArg) {
  // 创建空hook
  const hook = mountWorkInProgressHook();
  // 设置state
  hook.memoizedState = initialArg;
  const queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: initialArg,
  };
  const dispatch = dispatchReducerAction.bind(
    null,
    currentlyRenderingFiber,
    queue
  );
  queue.dispatch = dispatch;
  hook.queue = queue;

  return [hook.memoizedState, dispatch];
}

/**
 * setState 函数
 * 将update三元组缓存下来。renderRootSync时，将update放到hook的更新队列queue
 * 调度重新渲染
 * @param {*} fiber
 * @param {*} queue
 * @param {*} action
 */
function dispatchReducerAction(fiber, queue, action) {
  const update = {
    action, // {type: 'add', payload: 1}
    next: null,
  };
  // 把当前更新放到更新队列里，并返回根fiber
  const root = enqueueConcurrentHookUpdate(fiber, queue, update);
  scheduleUpdateOnFiber(root, fiber);
}

/**
 * 创建空hook节点
 */
function mountWorkInProgressHook() {
  const hook = {
    memoizedState: null, // hook的状态 state
    queue: null, // 一个hook的update事件队列，setState产生一个update事件，循环链表
    next: null, // 链表next指针
  };

  if (workInProgressHook === null) {
    currentlyRenderingFiber.memoizedState = hook;
    workInProgressHook = hook;
  } else {
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }
  return workInProgressHook;
}

/**
 * 渲染函数组件
 * @param current 老fiber
 * @param workInProgress 新fiber
 * @param Component 组件函数
 * @param props 组件属性
 * @returns 虚拟dom  jsx element
 */
export function renderWithHooks(current, workInProgress, Component, props) {
  // 当前hook的fiber
  currentlyRenderingFiber = workInProgress;
  // 清空effect链表
  workInProgress.updateQueue = null;

  // 先记录obj{useReducer}  到共享对象 ReactCurrentDispatcher.current
  // 函数组件useReducer这里的useReducer 的装饰函数
  // 增强功能：构建hook链表，记录update，返回[state, setState]
  if (current !== null && current.memoizedState !== null) {
    ReactCurrentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    // mount阶段
    ReactCurrentDispatcher.current = HooksDispatcherOnMount;
  }

  // 执行函数组件
  console.log("run function component and hook", currentlyRenderingFiber);
  const children = Component(props);

  // 函数组件执行完了，hooks都执行完了，变成初始化状态
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  return children;
}
