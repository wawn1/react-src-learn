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
