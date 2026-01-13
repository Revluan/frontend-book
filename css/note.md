## z-index 小的覆盖大的：原因与解决方案
堆叠上下文（Stacking Context） 问题。z-index 不是全局有效的，而是在各自的堆叠上下文内有效
堆叠上下文就像一个"平行宇宙"：
1. 每个堆叠上下文有自己独立的 z-index 层级系统
2. 不同堆叠上下文之间的 z-index 不能直接比较
3. 父堆叠上下文的层级决定了子堆叠上下文的整体位置

假设有以下HTML结构：
```html
<div class="parent1">
  <div class="child1">Child 1</div>
</div>
<div class="parent2">
  <div class="child2">Child 2</div>
</div>
```
```css
.parent1 {
  position: relative;
  z-index: 1;
}

.child1 {
  position: relative;
  z-index: 1000; /* 这个值很大，但是只在parent1的堆叠上下文中 */
}

.parent2 {
  position: relative;
  z-index: 2; /* 虽然parent2的z-index比parent1大，但parent2的堆叠上下文在parent1之上 */
}

.child2 {
  position: relative;
  z-index: 1; /* 这个值很小，但是因为parent2的堆叠上下文在parent1之上，所以child2会覆盖child1 */
}
```
在这个例子中，尽管.child1的z-index值很大，但是它被限制在.parent1的堆叠上下文中，而.parent1的z-index值小于.parent2，所以.parent2的堆叠上下文整体在.parent1之上，因此.child2（即使z-index值很小）也会覆盖.child1。
所以，要解决这个问题，你需要调整.parent1和.parent2的z-index值，使得.parent1的堆叠上下文在.parent2之上，或者将两个子元素放在同一个堆叠上下文中。


### 记住黄金法则：
1. z-index 只在同一堆叠上下文内比较有效
2. 父堆叠上下文的层级决定了子的"整体位置"
3. 某些 CSS 属性会隐式创建堆叠上下文, 比如 position: absolute 或 position: fixed