import { allowConcurrentByDefault } from "./ReactFeatureFlags";

export const TotalLanes = 31;

export const NoLanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane = /*                          */ 0b0000000000000000000000000000000;

export const SyncHydrationLane = /*               */ 0b0000000000000000000000000000001;
export const SyncLane = /*                        */ 0b0000000000000000000000000000010;

export const InputContinuousHydrationLane = /*    */ 0b0000000000000000000000000000100;
export const InputContinuousLane = /*             */ 0b0000000000000000000000000001000;

export const DefaultHydrationLane = /*            */ 0b0000000000000000000000000010000;
export const DefaultLane = /*                     */ 0b0000000000000000000000000100000;

export const SyncUpdateLanes = /*                */ 0b0000000000000000000000000101010;

const TransitionHydrationLane = /*                */ 0b0000000000000000000000001000000;
const TransitionLanes = /*                       */ 0b0000000011111111111111110000000;
const TransitionLane1 = /*                        */ 0b0000000000000000000000010000000;
const TransitionLane2 = /*                        */ 0b0000000000000000000000100000000;
const TransitionLane3 = /*                        */ 0b0000000000000000000001000000000;
const TransitionLane4 = /*                        */ 0b0000000000000000000010000000000;
const TransitionLane5 = /*                        */ 0b0000000000000000000100000000000;
const TransitionLane6 = /*                        */ 0b0000000000000000001000000000000;
const TransitionLane7 = /*                        */ 0b0000000000000000010000000000000;
const TransitionLane8 = /*                        */ 0b0000000000000000100000000000000;
const TransitionLane9 = /*                        */ 0b0000000000000001000000000000000;
const TransitionLane10 = /*                       */ 0b0000000000000010000000000000000;
const TransitionLane11 = /*                       */ 0b0000000000000100000000000000000;
const TransitionLane12 = /*                       */ 0b0000000000001000000000000000000;
const TransitionLane13 = /*                       */ 0b0000000000010000000000000000000;
const TransitionLane14 = /*                       */ 0b0000000000100000000000000000000;
const TransitionLane15 = /*                       */ 0b0000000001000000000000000000000;
const TransitionLane16 = /*                       */ 0b0000000010000000000000000000000;

const RetryLanes = /*                            */ 0b0000111100000000000000000000000;
const RetryLane1 = /*                             */ 0b0000000100000000000000000000000;
const RetryLane2 = /*                             */ 0b0000001000000000000000000000000;
const RetryLane3 = /*                             */ 0b0000010000000000000000000000000;
const RetryLane4 = /*                             */ 0b0000100000000000000000000000000;

export const SomeRetryLane = RetryLane1;

export const SelectiveHydrationLane = /*          */ 0b0001000000000000000000000000000;

const NonIdleLanes = /*                          */ 0b0001111111111111111111111111111;

export const IdleHydrationLane = /*               */ 0b0010000000000000000000000000000;
export const IdleLane = /*                        */ 0b0100000000000000000000000000000;

export const OffscreenLane = /*                   */ 0b1000000000000000000000000000000;

// 没有时间戳
export const NoTimestamp = -1;

/**
 * 将lane标记到root 待生效的pendingLanes
 * @param {*} root
 * @param {*} updateLane
 */
export function markRootUpdated(root, updateLane) {
  // pendingLanes 指的是根上等待生效的lane
  root.pendingLanes |= updateLane;
}

// 获取下一个最高优先级的lane
export function getNextLanes(root, wipLanes) {
  // 先获取所有的待生效lane
  const pendingLanes = root.pendingLanes;
  if (pendingLanes === NoLanes) {
    return NoLanes;
  }

  // 获取所有车道中最高优先级的车道
  const nextLanes = getHeighestPriorityLanes(pendingLanes);

  if (wipLanes !== NoLane && wipLanes !== nextLanes) {
    // 渲染中的车道优先级更高，返回渲染中的车道
    if (nextLanes > wipLanes) {
      return wipLanes;
    }
  }
  return nextLanes;
}

export function getHeighestPriorityLanes(lanes) {
  return getHeighestPriorityLane(lanes);
}

// 只保留二进制最右的1，优先级最高的lane
export function getHeighestPriorityLane(lanes) {
  return lanes & -lanes;
}

// lanes包含非IdleLane, 则返回true
export function includesNonIdleWork(lanes) {
  return (lanes & NonIdleLanes) !== NoLanes;
}

// subset是否在set中
export function isSubsetOfLanes(set, subset) {
  // set     00110
  // subset  00010
  return (set & subset) === subset;
}

export function mergeLanes(a, b) {
  return a | b;
}

// lanes是否有InputContinuousLane | DefaultLane
// 默认车道是同步的，不启用时间分片
export function includesBlockingLane(root, lanes) {
  // 允许默认lane，并发渲染
  if (allowConcurrentByDefault) {
    return false;
  }
  const SyncDefaultLanes = InputContinuousLane | DefaultLane;
  return (lanes & SyncDefaultLanes) !== NoLane;
}

/**
 * 取最左侧的1的索引
 * @param {*} lanes
 * @returns
 */
function pickArbitraryLaneIndex(lanes) {
  // clz32返回最左侧的1的左边0的个数, 总32长度
  // 索引0到31
  return 31 - Math.clz32(lanes);
}

export function markStarvedLanesAsExpired(root, currentTime) {
  // 获取当前有更新的赛道
  const pendingLanes = root.pendingLanes;
  // 记录每个赛道上的过期时间
  const expirationTimes = root.expirationTimes;
  let lanes = pendingLanes;
  while (lanes > 0) {
    // 获取最左侧1的索引
    const index = pickArbitraryLaneIndex(lanes);
    // 获取当前最小优先级lane
    const lane = 1 << index;
    const expirationTime = expirationTimes[index];
    // 如果此赛道上没有过期时间，说明没有为此车道设置过期时间
    if (expirationTime === NoTimestamp) {
      expirationTimes[index] = computeExpirationTime(lane, currentTime);
    } else if (expirationTime <= currentTime) {
      // 如果此车道的过期时间已经小于等于当前时间, 过期了
      // 把此车道添加到过期lane里
      root.expirationLanes |= lane;
    }
    // 从lanes去掉lane
    lanes &= ~lane;
  }
}

//计算过期时间，当前时间+间隔时间
function computeExpirationTime(lane, currentTime) {
  switch (lane) {
    case SyncLane:
    case InputContinuousLane:
      return currentTime + 250;
    case DefaultLane:
      return currentTime + 5000;
    case IdleLane:
      return NoTimestamp;
    default:
      return NoTimestamp;
  }
}

// 初始化expirationTimes 数组，每个lane的过期时间数组
export function createLaneMap(initial) {
  const laneMap = [];
  for (let i = 0; i < TotalLanes; i++) {
    laneMap.push(initial);
  }
  return laneMap;
}

// 是否包含过期lane
export function includesExpiredLane(root, lanes) {
  return (lanes & root.expirationLanes) !== NoLanes;
}

// 删除除了remainingLanes的其他lane的过期时间
export function markRootFinished(root, remainingLanes) {
  const noLongerPendingLanes = root.pendingLanes & ~remainingLanes;
  root.pendingLanes = remainingLanes;
  const expirationTimes = root.expirationTimes;
  let lanes = noLongerPendingLanes;
  // 清除所有lane的过期时间
  while (lanes > 0) {
    // 获取最左侧1的索引
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;
    // 清除lane的过期时间
    expirationTimes[index] = NoTimestamp;
    lanes &= ~lane;
  }
}
