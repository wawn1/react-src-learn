import {
  DefaultLane,
  IdleLane,
  InputContinuousLane,
  NoLane,
  SyncLane,
  getHeighestPriorityLane,
  includesNonIdleWork,
} from "./ReactFiberLane";

// 离散事件优先级 click onchange
export const DiscreteEventPriority = SyncLane; // 1
// 连续事件的优先级 mousemove
export const ContinuousEventPriority = InputContinuousLane; // 4
// 默认事件车道
export const DefaultEventPriority = DefaultLane; // 16
// 空闲事件优先级
export const IdleEventPriority = IdleLane; // 536870912

// 一个全局变量，用于多个模块之前传递优先级
// event listner产生event 设置优先级 => setState 读优先级 记录到update对象 和 更新队列 => 执行update时就可以用了
// 例如：dispatchDiscreteEvent => dispatchSetState => enqueueConcurrentHookUpdate (缓存update)
//  beginWork => updateHostRoot => processUpdateQueue (执行update with lane优先级)
let currentUpdatePriority = NoLane;

export function getCurrentUpdatePriority() {
  return currentUpdatePriority;
}

export function setCurrentUpdatePriority(newPriority) {
  currentUpdatePriority = newPriority;
}

/**
 * 如果eventPriority < lane，eventPriority优先级更高
 * @param {*} eventPriority
 * @param {*} lane
 */
export function isHeigherEventPriority(eventPriority, lane) {
  return eventPriority !== lane && eventPriority < lane;
}

/**
 * lane优先级转事件优先级
 *
 * 将lane优先级转eventPriority
 * 将31收敛到4个
 *
 * 落入eventPriority数轴区间里，则返回右侧eventPriority
 *
 * eventPriority 数轴  lane 1 lane 4  lane 16 lane 536870912
 * @param {*} lanes
 * @returns
 */
export function lanesToEventPriority(lanes) {
  // 获取最高优先级的lane
  let lane = getHeighestPriorityLane(lanes);
  if (!isHeigherEventPriority(DiscreteEventPriority, lane)) {
    return DiscreteEventPriority;
  }
  if (!isHeigherEventPriority(ContinuousEventPriority, lane)) {
    return ContinuousEventPriority;
  }
  if (includesNonIdleWork(lane)) {
    return DefaultEventPriority;
  }
  return IdleEventPriority;
}
