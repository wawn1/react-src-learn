import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  IndeterminateComponent,
} from "./ReactWorkTags";
import {
  processUpdateQueue,
  cloneUpdateQueue,
} from "./ReactFiberClassUpdateQueue";
import { mountChildFibers, reconcileChildFibers } from "./ReactChildFiber";
import { shouldSetTextContent } from "react-dom-bindings/src/client/ReactDOMHostConfig";
import { renderWithHooks } from "./ReactFiberHooks";
import { NoLanes } from "./ReactFiberLane";

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

function updateHostRoot(current, workInProgress, renderLanes) {
  const nextProps = workInProgress.pendingProps;
  cloneUpdateQueue(current, workInProgress);
  // mount时, 将update {payload: element} 放到workInProgress.memoizedState = {element}
  processUpdateQueue(workInProgress, nextProps, renderLanes);
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

function updateHostComponent(current, workInProgress, renderLanes) {
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
 * 挂载组件
 * @param {*} current 老fiber
 * @param {*} workInProgress 新fiber
 * @param {*} Component 组件函数
 */
export function mountIndeterminateComponent(
  current,
  workInProgress,
  Component,
  renderLanes
) {
  console.log("mount hook componet");
  const props = workInProgress.pendingProps;
  // const value = Component(props);
  const value = renderWithHooks(
    current,
    workInProgress,
    Component,
    props,
    renderLanes
  );
  workInProgress.tag = FunctionComponent;
  reconcileChildren(current, workInProgress, value);
  return workInProgress.child;
}

/**
 * 更新函数组件
 * @param {*} current 老fiber
 * @param {*} workInProgress 新fiber
 * @param {*} Component 函数组件
 * @param {*} newProps 组件props
 * @returns
 */
export function updateFunctionComponent(
  current,
  workInProgress,
  Component,
  newProps,
  renderLanes
) {
  console.log("update hook component");
  // 执行一遍函数组件，包含hook的执行
  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    newProps,
    renderLanes
  );
  // 打flags
  reconcileChildren(current, workInProgress, nextChildren);
  return workInProgress.child;
}

/**
 * 根据jsx element 创建新fiber的直连子链表 child
 * @param {*} current 老fiber
 * @param {*} workInProgress 新的fiber
 */
export function beginWork(current, workInProgress, renderLanes) {
  console.log("beginWork", current);
  workInProgress.lanes = NoLanes;
  switch (workInProgress.tag) {
    // 因为在eract里组件其实有2种，一种是函数组件，一种是类组件
    case IndeterminateComponent:
      return mountIndeterminateComponent(
        current,
        workInProgress,
        workInProgress.type,
        renderLanes
      );
    case FunctionComponent: {
      const Component = workInProgress.type;
      const newProps = workInProgress.pendingProps;
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        newProps,
        renderLanes
      );
    }
    case HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes);
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes);
    case HostText:
      return null;
    default:
      return null;
  }
}
