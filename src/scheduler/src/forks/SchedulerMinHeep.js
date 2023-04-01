// 向小顶堆添加节点
function push(heap, node) {
  const index = heap.length;
  heap.push(node);
  siftUp(heap, node, index);
}

// 查看堆顶元素
function peek(heap) {
  const first = heap[0];
  return first === undefined ? null : first;
}

// 弹出堆顶元素
function pop(heap) {
  // 弹出堆顶元素
  const first = heap[0];
  if (first !== undefined) {
    // 将最后一个元素放到堆顶，向下调整
    const last = heap.pop();
    if (last !== first) {
      heap[0] = last;
      siftDown(heap, last, 0);
    }
    return first;
  }
  return null;
}

/**
 * 向上调整节点，使得符合堆得要求
 * @param {*} heap 最小堆
 * @param {*} node 节点
 * @param {*} i 节点所在索引
 */
function siftUp(heap, node, i) {
  let index = i;
  while (true) {
    const parentIndex = (index - 1) >>> 1;
    const parent = node[parentIndex];

    if (parent !== undefined && compare(parent, node) > 0) {
      // 交换父子元素
      heap[parentIndex] = node;
      heap[index] = parent;
      // 走到父元素
      index = parentIndex;
    } else {
      // 不需要交换就结束了
      return;
    }
  }
}

/**
 * 向下调整节点，使得符合堆得要求
 * @param {*} heap 最小堆
 * @param {*} node 节点
 * @param {*} i 节点所在索引
 */
function siftDown(heap, node, i) {
  let index = i;
  const length = heap.length;
  while (index < length) {
    // 逻辑上自然数从1开始，父节点i,左子节点2*i, 右子节点2*i+1
    // 数组索引所以-1   父节点坐标自然数index+1  (index+1)*2 -1
    const leftIndex = (index + 1) * 2 - 1;
    const rightIndex = leftIndex + 1;

    const left = heap[leftIndex];
    const right = heap[rightIndex];

    if (left !== undefined && compare(left, node) < 0) {
      if (right !== undefined && compare(right, left) < 0) {
        heap[index] = right;
        heap[rightIndex] = node;
        index = rightIndex;
      } else {
        heap[index] = left;
        heap[leftIndex] = node;
        index = leftIndex;
      }
    } else if (right !== undefined && compare(right, node) < 0) {
      heap[index] = right;
      heap[rightIndex] = node;
      index = rightIndex;
    } else {
      return;
    }
  }
}

// 比较节点大小
function compare(a, b) {
  const diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}
