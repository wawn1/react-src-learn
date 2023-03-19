import { HostRoot } from "./ReactWorkTags";
import { NoFlags } from "./ReactFiberFlags";

/**
 * fiber数据结构
 * @param {*} tag fiber类型 函数组件0，类组件1，原生组件5，根fiber3
 * @param {*} pendingProps 等待处理的属性
 * @param {*} key 唯一标识
 */
export function FiberNode(tag, pendingProps, key) {
  this.tag = tag; // 函数组件0，类组件1，原生组件5，根fiber3
  this.key = key;
  this.type = null; // jsx element(虚拟dom)的type, 例如 span div p
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
  // 状态对应的更新队列
  this.updateQueue = null;

  // 副作用标记，标识这个fiber要进行什么操作
  this.flags = NoFlags;
  // 子节点有没有副作用的标记，冒泡统计，用于性能优化
  this.subtreeFlags = NoFlags;
  // 旧的fiber
  this.alternate = null;
}

export function createFiber(tag, pendingProps, key) {
  return new FiberNode(tag, pendingProps, key);
}

export function createHostRootFiber() {
  return createFiber(HostRoot, null, null);
}
