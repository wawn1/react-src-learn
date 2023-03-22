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
