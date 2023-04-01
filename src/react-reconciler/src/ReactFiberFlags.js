export const NoFlags = /*                      */ 0b0000000000000000000000000000;
export const Placement = /*                    */ 0b0000000000000000000000000010;
export const Update = /*                       */ 0b0000000000000000000000000100;
// 标记当前fiber子节点有删除
export const ChildDeletion = /*                */ 0b0000000000000000000000010000;
export const MutationMask = Placement | Update | ChildDeletion;
// 如果函数组件使用了useEffect, 函数组件对应fiber会有一个flags 2048
export const Passive = /*                      */ 0b0000000000000000100000000000;
export const LayoutMask = Update;
