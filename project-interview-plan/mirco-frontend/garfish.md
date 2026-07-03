JS沙箱隔离的实现原理（见图1，2）
几个值得重点关注的细节
关于 new Function vs eval
Garfish 选择 new Function 而不是 eval，因为 new Function 不能访问当前局部环境的变量，安全性更高；而且字符串只需解析一次，重复执行时性能远优于 eval（第二次调用耗时可低至 0.001ms）。 garfishjs
关于异步脚本逃逸：子应用里 React 的懒加载（Loadable）、Vue 的动态组件，都会让 webpack 生成异步 chunk 并通过 script 标签插入，这会让代码绕过沙箱执行。Garfish 的解法是劫持 document.createElement，如果是创建 script，则改用 fetch 拉取内容，再放进沙箱里执行。 garfishjs
关于样式隔离的终极方案：Shadow DOM 是最彻底的样式隔离方式——隔离节点内的样式不会受外部影响，也不会影响外部，事件最终也只冒泡到隔离节点内部。但缺点是许多组件库（如 antd 的弹窗会把节点插到 body 上）无法在 Shadow DOM 内正常工作。 garfishjs
简单总结一句：JS 沙箱 = 给每个子应用一个假的 window 环境；样式隔离 = 给每个子应用的 CSS 加围栏。 Garfish 的 VM 沙箱是两者里实现最精妙、也坑最多的部分，它本质上是用 Proxy 伪造了一个平行宇宙的 window。


分两部分来讲，先讲 new Function，再讲 with，最后把它们组合起来看为什么沙箱需要同时用这两个。（见图3，4，5）
补充一个细节：为什么这两个 API 平时都被建议"不要用"？
new Function 的问题在于它像 eval 一样可以执行任意字符串代码，如果字符串来自用户输入，就有注入风险。with 的问题是它让变量查找变得不可预测，代码可读性很差，而且严格模式（'use strict'）下直接禁止使用。
但在沙箱这个场景，这两个"缺点"反而变成了优点——正是它们的这些特殊能力，才能实现对子应用代码的精确控制。Garfish 的思路就是：既然需要动态执行代码，不如把这个过程彻底接管，而不是让代码在正常环境里跑。
