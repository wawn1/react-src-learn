import ReactCurrentDispatcher from "./ReactCurrentDispatcher";

function resolveDispatcher() {
  // dispatch对象，内部有函数useReducer，用于生成[state, setState]
  return ReactCurrentDispatcher.current;
}

/**
 *
 * @param {*} reducer 函数，根据老state和action计算新状态
 * @param {*} initialArg 初始state
 */
export function useReducer(reducer, initialArg) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useReducer(reducer, initialArg);
}

export function useState(reducer, initialArg) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(reducer, initialArg);
}

/**
 * useEffect
 * @param {*} create 函数，返回destroy函数
 * @returns
 */
export function useEffect(create, deps) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}

export function useLayoutEffect(create, deps) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useLayoutEffect(create, deps);
}
