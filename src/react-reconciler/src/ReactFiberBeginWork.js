import { HostComponent, HostRoot, HostText } from "./ReactWorkTags";
import { procesUpdateQueue } from "./ReactFiberClassUpdateQueue";
import { mountChildFibers, reconcileChildFibers } from "./ReactChildFiber";
import { shouldSetTextContent } from "react-dom-bindings/src/client/ReactDOMHostConfig";

/**
 *
 * @param {*} current 老的fiber
 * @param {*} workInProgress 新的fiber
 * @param {*} nextChildren 新fiber的element的child
 */
function reconcileChildren(current, workInProgress, nextChildren) {
  if (current === null) {
    // 没有老fiber，新fiber是新建的
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren);
  } else {
    // 如果没有老fiber, 做DOM-DIFF 拿老的子fiber链表和新的子jsx element链表进行比较，最小化更新
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren
    );
  }
}

function updateHostRoot(current, workInProgress) {
  // mount时, 将update {payload: element} 放到workInProgress.memoizedState = {element}
  procesUpdateQueue(workInProgress);
  const nextState = workInProgress.memoizedState;
  // HostRootFiber特殊，stateNode已经有了，绑定真实dom是FiberRootNode
  // update中的element, 对应构建出的fiber, 是HostRootFiber.child
  const nextChildren = nextState.element;
  // 协调子节点 DOM-DIFF
  // 构建子元素列表
  reconcileChildren(current, workInProgress, nextChildren);
  // 返回dfs的下一个节点
  return workInProgress.child;
}

function updateHostComponent(current, workInProgress) {
  const { type } = workInProgress;
  const nextProps = workInProgress.pendingProps;
  let nextChildren = nextProps.children;
  // 如果只有一个文本子节点
  const isDirectTextChild = shouldSetTextContent(type, nextProps);
  if (isDirectTextChild) {
    nextChildren = null;
  }

  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

/**
 * 根据jsx element 创建新fiber的直连子链表 child
 * @param {*} current 老fiber
 * @param {*} workInProgress 新的fiber
 */
export function beginWork(current, workInProgress) {
  switch (workInProgress.tag) {
    case HostRoot:
      return updateHostRoot(current, workInProgress);
    case HostComponent:
      return updateHostComponent(current, workInProgress);
    case HostText:
      return null;
    default:
      return null;
  }
}
