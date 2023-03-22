/**
 * 添加dom的style
 * @param {*} node dom
 * @param {*} styles 要添加的样式对象
 */
export function setValueForStyles(node, styles) {
  const { style } = node;
  // styles={color: 'red'}
  for (let styleName in styles) {
    if (styles.hasOwnProperty(styleName)) {
      const styleValue = styles[styleName];
      style[styleName] = styleValue;
    }
  }
}
