import { registerTwoPhaseEvent } from "./EventRegistry";

// const simpleEventPluginEvents = [
//   "abort",
//   "auxClick",
//   "cancel",
//   "canPlay",
//   "canPlayThrough",
//   "click",
//   "close",
//   "contextMenu",
//   "copy",
//   "cut",
//   "drag",
//   "dragEnd",
//   "dragEnter",
//   "dragExit",
//   "dragLeave",
//   "dragOver",
//   "dragStart",
//   "drop",
//   "durationChange",
//   "emptied",
//   "encrypted",
//   "ended",
//   "error",
//   "gotPointerCapture",
//   "input",
//   "invalid",
//   "keyDown",
//   "keyPress",
//   "keyUp",
//   "load",
//   "loadedData",
//   "loadedMetadata",
//   "loadStart",
//   "lostPointerCapture",
//   "mouseDown",
//   "mouseMove",
//   "mouseOut",
//   "mouseOver",
//   "mouseUp",
//   "paste",
//   "pause",
//   "play",
//   "playing",
//   "pointerCancel",
//   "pointerDown",
//   "pointerMove",
//   "pointerOut",
//   "pointerOver",
//   "pointerUp",
//   "progress",
//   "rateChange",
//   "reset",
//   "resize",
//   "seeked",
//   "seeking",
//   "stalled",
//   "submit",
//   "suspend",
//   "timeUpdate",
//   "touchCancel",
//   "touchEnd",
//   "touchStart",
//   "volumeChange",
//   "scroll",
//   "toggle",
//   "touchMove",
//   "waiting",
//   "wheel",
// ];

const simpleEventPluginEvents = ["click"];

// dom事件名映射到react事件名 click=>onClick
export const topLevelEventsToReactNames = new Map();

/**
 * 将原生事件名和react事件名 映射保存
 * 并将注册的原生事件名保存下来，用于容器dom设置这些事件的委托函数
 *
 * @param {*} domEventName 原生事件名
 * @param {*} reactName react事件名
 */
function registerSimpleEvent(domEventName, reactName) {
  topLevelEventsToReactNames.set(domEventName, reactName);
  registerTwoPhaseEvent(reactName, [domEventName]);
}

export function registerSimpleEvents() {
  for (let i = 0; i < simpleEventPluginEvents.length; i++) {
    const eventName = simpleEventPluginEvents[i]; // click
    const domEventName = eventName.toLowerCase(); // click
    const capitalizeEvent = eventName[0].toUpperCase() + eventName.slice(1); // Click
    registerSimpleEvent(domEventName, `on${capitalizeEvent}`); // click:onClick Map
  }
}
