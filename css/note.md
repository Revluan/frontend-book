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

## 有两种盒模型，这两种盒模型有什么区别
1. 标准盒模型（W3C 盒模型）：
   - 元素的宽度和高度只包括内容区域（content）
   - 内边距（padding）、边框（border）和外边距（margin）都在内容区域外部
2. 怪异盒模型（IE 盒模型）：
   - 元素的宽度和高度包括内容区域、内边距和边框
   - 外边距（margin）在元素外部
  
## css选择器的权重，具体是如何计算的
1. 内联样式（inline style）：权重为 1000
2. ID 选择器（#id）：权重为 100
3. 类选择器（.class）、属性选择器（[attr]）、伪类选择器（:hover 等）：权重为 10
4. 元素选择器（div、p 等）、伪元素选择器（::before、::after 等）：权重为 1
5. 通配符选择器（*）、组合选择器（如 div p）、子选择器（如 >）、相邻兄弟选择器（如 +）：权重为 0

## css模块化是什么
css模块化是指将css代码分割成多个模块，每个模块只负责管理自己的样式，避免全局样式的污染和冲突。
具体实现方式有很多种，比如：
1. BEM（Block Element Modifier）命名规范
2. CSS Modules
3. PostCSS 插件（如 postcss-modules）
4. 工具库（如 styled-components、tailwindcss 等）

## BFC范式了解过吗，如何创建一个BFC
BFC（Block Formatting Context）是一种布局模式，它会创建一个独立的渲染区域，内部元素的布局不会影响到外部元素。
创建一个BFC的方式有很多种，比如：
1. 元素设置 float 或 position: absolute 或 position: fixed
2. 元素设置 overflow: hidden 或 overflow: auto
3. 元素设置 display: inline-block 或 display: flex 或 display: grid

## 浮动是什么，怎么清楚浮动
浮动（float）是一种布局方式，它可以使元素向左或向右移动，直到遇到其他元素或容器边缘。
清除浮动（clear float）是指在浮动元素后面添加一个空元素，并设置其 clear 属性为 both，以确保后续元素不会受到浮动元素的影响。
可能会收到影响的表现有哪些？
1. 父元素高度塌陷（父元素没有设置高度或高度设置为 auto）
2. 后续元素上 margin 失效
3. 后续元素上 padding 失效
