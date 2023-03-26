import { setValueForStyles } from "./CSSPropertyOperations";
import setTextContent from "./setTextContent";
import { setValueForProperty } from "./DOMPropertyOperations";

const STYLE = "style";
const CHILDERN = "children";

/**
 * 设置dom元素prop
 * style 和 children 要特殊处理
 * @param {*} type
 * @param {*} domElement
 * @param {*} nextProps
 */
function setInitialDOMProperties(type, domElement, nextProps) {
  for (let propKey in nextProps) {
    if (nextProps.hasOwnProperty(propKey)) {
      const nextProp = nextProps[propKey];
      if (propKey === STYLE) {
        setValueForStyles(domElement, nextProp);
      } else if (propKey === CHILDERN) {
        if (typeof nextProp === "string") {
          setTextContent(domElement, nextProp);
        } else if (typeof nextProp === "number") {
          setTextContent(domElement, nextProp + "");
        }
      } else if (nextProp !== null) {
        setValueForProperty(domElement, propKey, nextProp);
      }
    }
  }
}

export function setInitialProperties(domElement, type, props) {
  setInitialDOMProperties(type, domElement, props);
}

/**
 *
 * @param {*} domElement
 * @param {*} type
 * @param {*} oldProps
 * @param {*} newProps
 */
export function diffProperties(domElement, type, oldProps, newProps) {
  let updatePayload = [];
  let styleUpdates = null;

  // 处理删除属性。如果属性老的有，新的没有，要删除
  for (let propKey in oldProps) {
    if (propKey === STYLE) {
      continue;
    }

    // 新的有 或 老的没有 跳过
    if (
      newProps.hasOwnProperty(propKey) ||
      !oldProps.hasOwnProperty(propKey) ||
      oldProps[propKey] === null
    ) {
      continue;
    }

    // 属性，值，二元组update  删除属性
    updatePayload.push(propKey, null);
  }

  // 处理更新属性
  for (let propKey in newProps) {
    if (propKey === STYLE) {
      continue;
    }

    const newProp = newProps[propKey];
    const oldProp = oldProps[propKey] === undefined ? null : oldProps[propKey];
    if (
      !newProps.hasOwnProperty(propKey) ||
      newProp === null ||
      oldProp === null ||
      newProp === oldProp
    ) {
      continue;
    }

    if (propKey === CHILDERN) {
      if (typeof newProp === "string" || typeof newProp === "number") {
        updatePayload.push(propKey, newProp);
      }
    } else {
      // 更新
      updatePayload.push(propKey, newProp);
    }
  }

  const oldStyle = oldProps[STYLE];
  const newStyle = newProps[STYLE];

  if (oldStyle || newStyle) {
    // 样式删除
    if (oldStyle) {
      for (let styleName in oldStyle) {
        if (
          oldStyle.hasOwnProperty(styleName) &&
          (!newStyle || !newStyle.hasOwnProperty(styleName))
        ) {
          if (!styleUpdates) {
            styleUpdates = {};
          }
          styleUpdates[styleName] = "";
        }
      }
    }

    // 样式更新
    if (newStyle) {
      for (let styleName in newStyle) {
        if (
          newStyle.hasOwnProperty(styleName) &&
          (!oldStyle || oldStyle[styleName] !== newStyle[styleName])
        ) {
          if (!styleUpdates) {
            styleUpdates = {};
          }
          styleUpdates[styleName] = newStyle[styleName];
        }
      }
    }

    if (styleUpdates) {
      updatePayload.push(STYLE, styleUpdates);
    }
  }

  return updatePayload.length === 0 ? null : updatePayload;
}

/**
 * 更新dom的属性
 * @param {*} domElement dom
 * @param {*} updatePayload update二元组 属性，值
 */
export function updateProperties(domElement, updatePayload) {
  updateDOMProperties(domElement, updatePayload);
}

function updateDOMProperties(domElement, updatePayload) {
  for (let i = 0; i < updatePayload.length; i += 2) {
    const propKey = updatePayload[i];
    const propValue = updatePayload[i + 1];
    if (propKey === STYLE) {
      setValueForStyles(domElement, propValue);
    } else if (propKey === CHILDERN) {
      setTextContent(domElement, propValue);
    } else {
      setValueForProperty(domElement, propKey, propValue);
    }
  }
}
