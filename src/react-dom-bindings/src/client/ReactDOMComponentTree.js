const randomKey = Math.random().toString(36).slice(2);
const internalInstanceKey = "__reactFiber$" + randomKey;
const internalPropsKey = "__reactProp$" + randomKey;
/**
 * 从真实dom节点，获取fiber
 * @param {*} targetNode dom
 */
export function getClosestInstanceFromNode(targetNode) {
  const targetInst = targetNode[internalInstanceKey];
  return targetInst || null;
}

/**
 * 提前缓存fiber节点到dom上
 * @param {*} hostInst fiber
 * @param {*} node dom
 */
export function precacheFiberNode(hostInst, node) {
  node[internalInstanceKey] = hostInst;
}

/**
 * 把fiber的props存到dom上
 * @param {*} node dom
 * @param {*} props fiber props
 */
export function updateFiberProps(node, props) {
  node[internalPropsKey] = props;
}

/**
 * 从真实dom中获取 fiber的props
 * @param {*} node dom
 * @returns
 */
export function getFiberCurrentPropsFromNode(node) {
  return node[internalPropsKey] === undefined ? null : node[internalPropsKey];
}
