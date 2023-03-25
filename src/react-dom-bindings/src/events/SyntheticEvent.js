import assign from "shared/assign";

function functionThatReturnsFalse() {
  return false;
}

function functionThatReturnsTrue() {
  return true;
}

const MouseEventInterface = {
  clientX: 0,
  clientY: 0,
};

/**
 *
 * @param {*} interfaceProps 原生事件属性结构
 * @returns
 */
function createSyntheticEvent(interfaceProps) {
  /**
   * 合成事件的构造函数
   * @param {*} reactName react事件名 onClick
   * @param {*} reactEventType click
   * @param {*} targetInst 事件源对应的fiber
   * @param {*} nativeEvent 原生事件对象 e
   * @param {*} nativeEventTarget 事件源dom
   */
  function SyntheticBaseEvent(
    reactName,
    reactEventType,
    targetInst,
    nativeEvent,
    nativeEventTarget
  ) {
    this._reactName = reactName;
    this.type = reactEventType;
    this._targetInst = targetInst;
    this.nativeEvent = nativeEvent;
    this.target = nativeEventTarget;

    // 把原生事件的属性拷贝到合成事件上
    for (let propName in interfaceProps) {
      if (!interfaceProps.hasOwnProperty(propName)) {
        continue;
      }
      this[propName] = nativeEvent[propName];
    }

    // 是否已经阻止默认事件
    this.isDefaultPrevented = functionThatReturnsFalse;
    // 是否已经阻止继续传播
    this.isPropagationStopped = functionThatReturnsFalse;

    return this;
  }

  // 添加 preventDefault stopPropagation
  assign(SyntheticBaseEvent.prototype, {
    preventDefault() {
      const event = this.nativeEvent;
      if (event.preventDefault) {
        event.preventDefault();
      } else {
        event.returnValue = false;
      }
      this.isDefaultPrevented = functionThatReturnsTrue;
    },
    stopPropagation() {
      const event = this.nativeEvent;
      if (event.stopPropagation) {
        event.stopPropagation();
      } else {
        event.returnValue = false;
      }
      this.isPropagationStopped = functionThatReturnsTrue;
    },
  });

  return SyntheticBaseEvent;
}

export const SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);
