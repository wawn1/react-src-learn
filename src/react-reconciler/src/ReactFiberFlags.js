export const NoFlags = /*                      */ 0b0000000000000000000000000000;
export const Placement = /*                    */ 0b0000000000000000000000000010;
export const Update = /*                       */ 0b0000000000000000000000000100;
// 标记当前fiber子节点有删除
export const ChildDeletion = /*                */ 0b0000000000000000000000010000;
export const MutationMask = Placement | Update | ChildDeletion;
