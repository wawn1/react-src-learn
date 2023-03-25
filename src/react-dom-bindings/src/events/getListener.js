import { getFiberCurrentPropsFromNode } from "../client/ReactDOMComponentTree";

/**
 * 从fiber中获取props, 从props获取事件函数
 * @param {*} inst fiber
 * @param {*} registrationName 事件函数名 onClick
 * @returns
 */
export default function getListener(inst, registrationName) {
  const { stateNode } = inst;
  if (stateNode === null) {
    return null;
  }

  const props = getFiberCurrentPropsFromNode(stateNode);
  if (props === null) {
    return null;
  }

  const listener = props[registrationName]; // props.onClick
  return listener;
}
