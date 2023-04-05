import {
  HostComponent,
  HostRoot,
  HostText,
  IndeterminateComponent,
} from "./ReactWorkTags";
import { NoFlags } from "./ReactFiberFlags";
import { NoLanes } from "./ReactFiberLane";

/**
 * fiber数据结构
 * @param {*} tag fiber类型 函数组件0，类组件1，原生组件5，根fiber3
 * @param {*} pendingProps 等待处理的属性
 * @param {*} key 唯一标识
 */
export function FiberNode(tag, pendingProps, key) {
  this.tag = tag; // 函数组件0，类组件1，原生组件5，根fiber3
  this.key = key;
  this.type = null; // jsx element(虚拟dom)的type, 例如 span div p func(类组件，函数组件)
  this.stateNode = null; // fiber对应真实dom的引用

  this.return = null; // 指向父fiber
  this.child = null; // 指向第一个子fiber
  this.sibling = null; //指向下一个兄弟fiber

  this.pendingProps = pendingProps; // 等待生效的属性
  this.memoizedProps = null; // 已经生效的属性

  // 存储的数据
  // 类组件 类state
  // 函数组件 hooks
  // 根fiber 要渲染的元素
  this.memoizedState = null;
  // 更新操作队列
  this.updateQueue = null;

  // 副作用标记，标识这个fiber要进行什么操作
  this.flags = NoFlags;
  // 子节点有没有副作用的标记，冒泡统计，用于性能优化
  this.subtreeFlags = NoFlags;
  // 新旧fiber互相引用
  this.alternate = null;
  // dom-diff 移动
  this.index = 0;
  // 子fiber删除数组
  this.deletions = null;
  // 优先级
  this.lanes = NoLanes;
}

export function createFiber(tag, pendingProps, key) {
  return new FiberNode(tag, pendingProps, key);
}

export function createHostRootFiber() {
  return createFiber(HostRoot, null, null);
}

/**
 * 基于老的fiber和新的属性创建新的fiber
 * 创建一个fiber，除了props，其他都和入参fiber一样
 * clone fiber
 *
 * 1. 没有alternate, 创建fiber，复用dom
 * 2. 有alternate, 复用fiber, 复用dom
 *
 * @param {*} current 老fiber
 * @param {*} pendingProps 新属性
 */
export function createWorkInProgress(current, pendingProps) {
  let workInProgress = current.alternate;
  if (workInProgress === null) {
    console.log("copy fiber reuse old dom.", current, pendingProps);
    // 第一次渲染没有备份节点，新fiber是旧fiber的备份，直接创建新fiber
    workInProgress = createFiber(current.tag, pendingProps, current.key);
    workInProgress.type = current.type;
    // 复用真实dom
    workInProgress.stateNode = current.stateNode;

    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    console.log("copy fiber reuse old fiber.", current, pendingProps);
    // 复用新fiber树的fiber, 新props
    workInProgress.pendingProps = pendingProps;
    workInProgress.type = current.type;
    workInProgress.flags = NoFlags;
    workInProgress.subtreeFlags = NoFlags;
  }

  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  return workInProgress;
}

/**
 * 根据虚拟dom创建fiber
 * @param {*} element jsx element
 */
export function createFiberFromElement(element) {
  const { type, key, props: pendingProps } = element;
  return createFiberFromTypeAndProps(type, key, pendingProps);
}

function createFiberFromTypeAndProps(type, key, pendingProps) {
  let tag = IndeterminateComponent;
  // 如果type是字符串 span div 说明是一个原生组件
  if (typeof type === "string") {
    tag = HostComponent;
  }
  const fiber = createFiber(tag, pendingProps, key);
  fiber.type = type;
  return fiber;
}

export function createFiberFromText(content) {
  return createFiber(HostText, content, null);
}
