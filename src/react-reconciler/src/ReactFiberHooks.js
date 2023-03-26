import ReactSharedInternals from "shared/ReactSharedInternals";
import { scheduleUpdateOnFiber } from "./ReactFiberWorkLoop";
import { enqueueConcurrentHookUpdate } from "./ReactFiberConcurrentUpdates";

const { ReactCurrentDispatcher } = ReactSharedInternals;

// hook单向链表 最后一个
let workInProgressHook = null;
// 当前fiber currentlyRenderingFiber.memoizedState hook单向链表 第一个
let currentlyRenderingFiber = null;

let currentHook = null;

const HooksDispatcherOnMount = {
  useReducer: mountReducer,
  useState: mountState,
};

const HooksDispatcherOnUpdate = {
  useReducer: updateReducer,
  useState: updateState,
};

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
  const update = {
    action,
    hasEagerState: false, // 是否有提前计算新state
    eagerState: null, // 新state
    next: null,
  };
  const { lastRenderedReducer, lastRenderedState } = queue;
  const eagerState = lastRenderedReducer(lastRenderedState, action);
  update.hasEagerState = true;
  update.eagerState = eagerState;
  if (Object.is(eagerState, lastRenderedState)) {
    return;
  }

  // setState触发更新
  const root = enqueueConcurrentHookUpdate(fiber, queue, update);
  scheduleUpdateOnFiber(root);
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
    workInProgressHook = newHook;
    workInProgressHook.next = newHook;
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
  const children = Component(props);

  // 函数组件执行完了，hooks都执行完了，变成初始化状态
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  return children;
}
