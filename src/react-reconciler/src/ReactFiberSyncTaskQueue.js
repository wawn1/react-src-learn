import {
  DiscreteEventPriority,
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
} from "./ReactEventPriorities";

// 同步队列
let syncQueue = null;
// 是否正在执行同步队列
let isFlushingSyncQueue = false;

// 将待执行任务(一次渲染)放入同步队列
export function scheduleSyncCallback(callback) {
  if (syncQueue === null) {
    syncQueue = [callback];
  } else {
    syncQueue.push(callback);
  }
}

// 执行同步队列syncQueue
export function flushSyncCallbacks() {
  //
  if (!isFlushingSyncQueue && syncQueue !== null) {
    isFlushingSyncQueue = true;
    // 暂存当前的更新优先级
    const previousUpdatePriority = getCurrentUpdatePriority();
    try {
      const isSync = true;
      const queue = syncQueue;
      // 把优先级设置为同步，sync
      setCurrentUpdatePriority(DiscreteEventPriority);
      // 执行
      for (let i = 0; i < queue.length; i++) {
        let callback = queue[i];
        do {
          // 如果任务执行产生了新任务，优先执行
          callback = callback(isSync);
        } while (callback !== null);
      }

      // 清空队列
      syncQueue = null;
    } finally {
      setCurrentUpdatePriority(previousUpdatePriority);
      isFlushingSyncQueue = false;
    }
  }
}
