/**
 * HasEffect 表示有effect
 * Layout， Passive表示哪种effect
 * useEffect 会在浏览器绘制之后执行，宏任务, Passive
 * useLayoutEffect 会在浏览器绘制之前执行，同步代码执行，不是微任务，不会放到事件队列，Layout
 */
export const NoFlags = 0b0000;
export const HasEffect = 0b0001;
export const Passive = 0b1000;
export const Layout = 0b0100;
