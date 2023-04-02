import { push, peek, pop } from "./SchedulerMinHeep";
import {
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  LowPriority,
  IdlePriority,
} from "./SchedulerPriorities";

/**
 * requestAnimationFrame 和 setTimeout 谁快？
 * setTimeout 会产生一个任务放到宏任务队列
 * requestAnimationFrame 也是一个宏任务, 但是只在dom渲染前才执行，不渲染dom不执行
 *
 * js event loop 执行顺序
 * 1.执行栈清空 2.微任务队列清空 (挂起js，执行dom渲染)3.取1个宏任务队列放到执行栈
 * 渲染线程和js线程互斥执行，一旦执行渲染, js线程就阻塞了
 * 只能在2之后执行挂起
 * 也就是一旦开始执行一个fiber宏任务调度执行，不会被打断，是一个最小执行粒度
 *
 *
 * requestAnimationFrame 是浏览器函数，刷新帧时执行
 *
 * 如果系统60HZ
 * event loop 可以快速执行多个循环，setTimeout, 4ms后执行。
 * requestAnimationFrame 在16.7s内多次 event loop都不执行，设备刷新帧时才执行
 *
 * 参考文档：https://juejin.cn/post/7029252274299879454
 */

/**
 * 用什么可以替代  requestIdleCallback？
 * requestIdleCallback 是宏任务
 * 可以用setTimeout
 * requestAnimationFrame不能用，16.7s内的event loop都执行不了
 * MessageChannel以DOM Event的形式发送消息，所以它属于异步的宏任务。
 *
 * 宏任务队列其实是一个有序集合, 有优先级
 * requestAnimationFrame > MessageChannel(dom event) > setTimeout
 *
 * 参考文档：https://juejin.cn/post/7029715697173266469
 */

function getCurrentTime() {
  return performance.now();
}

// Max 31 bit integer. The max integer size in V8 for 32-bit systems.
// Math.pow(2, 30) - 1
// 0b111111111111111111111111111111
var maxSigned31BitInt = 1073741823;

// Times out immediately 立即过期
var IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out 用户阻塞操作优先级
var USER_BLOCKING_PRIORITY_TIMEOUT = 250;
// 正常优先级的过期时间
var NORMAL_PRIORITY_TIMEOUT = 5000;
// 低优先级的过期时间
var LOW_PRIORITY_TIMEOUT = 10000;
// Never times out 永不过期
var IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;

// 任务ID计数器
let taskIdCounter = 1;
// 任务的最小堆
const taskQueue = [];

// taskQueue 遍历执行函数
let scheduleHostCallback = null; // flushWork workLoop

// 开始执行任务队列的开始时间
let startTime = -1;

// react每次申请5ms时间片，然后释放，释放后浏览器渲染线程可以执行渲染
const frameInterval = 5;

// 替代requestIdleCallback
const channel = new MessageChannel();
var port2 = channel.port2;
var port1 = channel.port1;

// 下一个宏任务执行
port1.onmessage = performWorkUntilDeadline;

/**
 * 按优先级执行任务
 * @param {*} callback
 */
export function scheduleCallback(priorityLevel, callback) {
  // requestIdleCallback(callback);
  // 获取当前时间戳
  const currentTime = getCurrentTime();
  // 任务开始时间
  const startTime = currentTime;
  // 超时时间
  let timeout;
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT;
      break;
    case UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
      break;
    case IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT;
      break;
    case LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT;
      break;
    case NormalPriority:
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT;
      break;
  }

  // 计算此任务的过期时间
  const expirationTime = startTime + timeout;
  const newTask = {
    id: taskIdCounter++,
    callback, // 任务的回调函数
    priorityLevel, // 任务优先级
    startTime, // 任务开始时间
    expirationTime, // 任务的过期时间
    sortIndex: expirationTime, // 排序index
  };

  // 将任务放入最小堆
  push(taskQueue, newTask);
  // 执行任务
  requestHostCallback(flushWork);
  return newTask;
}

/**
 * 执行任务队列的任务 最小堆(优先级任务队列)taskQueue
 * @param {*} startTime
 * @returns
 */
function flushWork(startTime) {
  return workLoop(startTime);
}

function workLoop(startTime) {
  let currentTime = startTime;
  // 取出优先级最高的任务
  let currentTask = peek(taskQueue);

  while (currentTask !== null) {
    // 如果当前任务没过期，还要执行，但是没有时间了
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break;
    }

    // 取出当前的任务中的回调函数 performConcurrentWorkOnRoot
    const callback = currentTask.callback;
    if (typeof callback === "function") {
      currentTask.callback = null;
      const continuationCallback = callback();
      if (typeof continuationCallback === "function") {
        // 执行任务产生了一个新任务
        currentTask.callback = continuationCallback;
        return true; // 还有任务执行
      }
      // 弹出最高优先级任务
      pop(taskQueue);
    } else {
      // 弹出最高优先级任务
      pop(taskQueue);
    }
    currentTask = peek(taskQueue);
  }

  // 还有任务
  if (currentTask !== null) {
    return true;
  }
  // 如果任务队列所有任务都执行完了，没有下一个任务
  return false;
}

// 最小堆 这一次循环执行是否超过5ms
function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    return false;
  }
  return true;
}

function requestHostCallback(flushWork) {
  // 先缓存工作循环 执行函数
  scheduleHostCallback = flushWork;
  // 产生一个宏任务，执行最小堆
  schedulePerformWorkUntilDeadline();
}

function schedulePerformWorkUntilDeadline() {
  // 下个宏任务执行performWorkUntilDeadline
  port2.postMessage(null);
}

function performWorkUntilDeadline() {
  if (scheduleHostCallback) {
    // workLoop
    // 先获取开始执行任务的时间
    startTime = getCurrentTime();
    // 是否有更多的工作
    let hasMoreWork = true;

    try {
      // 执行超过5ms，还有任务 或者 最小堆里任务执行完了
      hasMoreWork = scheduleHostCallback(startTime);
    } finally {
      // 如果时间超过5ms, 还有任务，产生一个宏任务，下次继续，此时浏览器可以接手执行渲染dom 或者 不执行
      if (hasMoreWork) {
        schedulePerformWorkUntilDeadline();
      } else {
        // 清空任务队列执行函数
        scheduleHostCallback = null;
      }
    }
  }
}

export {
  scheduleCallback as unstable_scheduleCallback,
  shouldYieldToHost as unstable_shouldYield,
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  NormalPriority as unstable_NormalPriority,
  LowPriority as unstable_LowPriority,
  IdlePriority as unstable_IdlePriority,
};
