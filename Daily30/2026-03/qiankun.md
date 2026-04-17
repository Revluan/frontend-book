qiankun 的 JS 沙箱一共有三种实现，分别是**快照沙箱（SnapshotSandbox）**、**单例沙箱（LegacySandbox）** 和**代理沙箱（ProxySandbox）**[reference:0]。

| 特性 | 快照沙箱 (SnapshotSandbox) | 单例沙箱 (LegacySandbox) | 代理沙箱 (ProxySandbox) |
| :--- | :--- | :--- | :--- |
| **核心原理** | 模拟游戏存档/读档，记录状态变化并恢复[reference:1] | 基于 Proxy 直接修改主应用 window，记录变更并恢复[reference:2] | 为每个子应用创建独立的 `fakeWindow` 代理对象，环境天然隔离[reference:3] |
| **核心依赖** | 不使用 Proxy，通过遍历 `window` 对象实现 | 使用 Proxy | 使用 Proxy |
| **是否污染全局** | 是，短暂污染，卸载后恢复 | 是，直接修改 `window` 对象 | 否，操作在 `fakeWindow` 上进行 |
| **多实例支持** | 不支持，多应用切换会互相干扰 | **不支持**，同一时间只能运行一个子应用实例[reference:4] | **支持**，不同应用拥有独立的 `fakeWindow` 代理对象，互不干扰[reference:5] |
| **性能** | 激活/卸载时需遍历 `window` 对象，有额外开销 | 激活/卸载时需遍历变更记录进行恢复 | 操作时通过 Proxy 拦截，性能更优 |
| **适用场景** | 降级方案，仅在不支持 Proxy 的低版本浏览器中使用[reference:6] | 早期 Proxy 方案，不推荐新项目使用 | **推荐使用**，现代化项目的首选方案 |

---

### 📜 快照沙箱 (SnapshotSandbox)

这是一种早期、朴素的隔离思路，其核心机制是**在子应用切换时，将主应用的 `window` 对象“存档”和“读档”**。

它的工作流程就像一个游戏存档机制：
1.  **存档 (active)**：子应用加载前，遍历 `window` 对象，将其所有属性和值复制并保存到一个快照中。
2.  **修改 (运行)**：子应用运行，可以自由地修改 `window` 对象上的任何东西，比如新增全局变量、修改原生 API 等。
3.  **恢复 (inactive)**：子应用卸载时，再次遍历 `window` 对象，与之前保存的快照进行比对，将发生变化（新增或修改）的属性值记录下来，然后用快照恢复 `window` 对象到原始状态[reference:7][reference:8]。

这种方法实现简单，兼容性好，但缺陷也很明显：性能较差且不支持多个子应用同时运行。因此，它通常只在像 IE 这样不支持 `Proxy` 的浏览器中作为降级方案使用。

### 🏛️ 单例沙箱 (LegacySandbox)

这是 qiankun 早期基于 `Proxy` 的一种实现，其核心机制是**在激活时恢复变更、在失活时还原变更，让 `window` 对象始终看起来像是“干净”的**。

它同样直接修改主应用的 `window` 对象，但与快照沙箱不同的是，它利用了 `Proxy` 来更精细地记录变更：
1.  **激活 (active)**：将上一次该子应用运行时对 `window` 对象做的所有修改恢复回来。
2.  **修改 (运行)**：子应用运行时，`Proxy` 会拦截所有对 `window` 对象的修改，并将变更分类记录：新增的全局变量、原有属性的旧值和新值[reference:9]。
3.  **失活 (inactive)**：将 `window` 对象彻底还原：删除该子应用新增的变量，并将修改过的变量恢复原值[reference:10][reference:11]。

它的性能比快照沙箱好，但致命缺陷是**不支持多实例**。这意味着，如果你的主应用需要同时激活多个子应用，就会出现冲突。因此，它很快被更强大的代理沙箱所取代。

### 🔐 代理沙箱 (ProxySandbox) - 最强大与推荐的方案

这是 qiankun 官方推荐且最强大的方案，其核心机制是**为每个子应用创建一个独立的 `fakeWindow` 代理对象**。

`ProxySandbox` 利用 `Proxy` 的强大能力，为每个子应用都创造一个独立的“虚拟”全局环境（`fakeWindow`）：
1.  **独立环境 (`fakeWindow`)**：它不为子应用提供真实的 `window`，而是提供一个通过 `Proxy` 创建的、名为 `fakeWindow` 的对象。
2.  **重定向操作**：当子应用读取或修改全局变量（如 `window.a` 或 `window.console`）时，`Proxy` 会拦截这些操作，并优先在 `fakeWindow` 上查找或执行[reference:12][reference:13]。

```javascript
// 逻辑简化示例
const fakeWindow = {};
const proxyWindow = new Proxy(fakeWindow, {
    get(target, prop) {
        // 优先从 fakeWindow 中取值
        return prop in target ? target[prop] : window[prop];
    },
    set(target, prop, value) {
        // 修改值只会发生在 fakeWindow 上
        target[prop] = value;
        return true;
    }
});
```

由于每个子应用都有自己独立的 `fakeWindow`，它们之间的全局环境完全隔离，因此 `ProxySandbox` **支持多实例**，是现代浏览器环境下的首选方案。

---

### 🚀 实践指南与注意事项

1.  **如何选择**：生产环境直接使用默认配置即可，qiankun 会自动为支持 `Proxy` 的浏览器启用 `ProxySandbox`。
2.  **潜在问题**：**子应用无法与主应用共享真正的全局变量**，因为 `window` 已被代理。如果确实需要共享，需通过 props 或全局状态管理工具（如 `initGlobalState`）显式传递[reference:14][reference:15]。
3.  **CSS 隔离**：qiankun 提供严格的 Shadow DOM 隔离（`strictStyleIsolation: true`）和实验性的作用域隔离（`experimentalStyleIsolation: true`）。前者可能影响子应用弹窗样式，后者性能较差，使用时需要权衡[reference:16]。

总的来说，qiankun 的 JS 沙箱方案和上一问讨论的 Garfish 思路非常相似，两者都采用了“快照”和“代理”两套方案，并优先使用基于 `Proxy` 的代理模式，为子应用提供独立的全局运行环境。




qiankun 的 CSS 样式隔离方案比较务实，它提供了不同隔离强度的选项，供你根据项目情况选择。

和 Garfish 类似，qiankun 也提供了**构建时**与**运行时**两种隔离思路。运行时方案是框架的核心，主要有以下三种，你可以根据需要配置[reference:0][reference:1]。

### ⚙️ 三大核心方案

#### 1. 动态样式隔离 (Dynamic Stylesheet Isolation)
*   **实现原理**：默认启用，在子应用加载时动态注入样式表，卸载时自动移除，确保环境干净[reference:2]。
*   **效果与局限**：可保证同一时刻只存在一个子应用时样式不冲突。但当多个子应用并存或与主应用切换时，无法完全防止相互污染[reference:3]。

#### 2. 严格样式隔离 (Strict Style Isolation) —— `strictStyleIsolation: true`
*   **实现原理**：利用 Web Components 的 **Shadow DOM** 技术，为每个子应用创建独立的 DOM 子树，其内部样式与外部完全隔离[reference:4][reference:5]。
*   **效果与局限**：提供**最强的隔离效果**，但会引入显著的副作用。子应用的弹窗等组件会脱离 Shadow DOM 作用域导致样式失效[reference:6]，且主应用难以自定义子应用样式[reference:7]。

#### 3. 实验性样式隔离 (Experimental Style Isolation) —— `experimentalStyleIsolation: true`
*   **实现原理**：借鉴 Vue 的 `scoped` 思路，通过重写 CSS 选择器，为子应用所有样式自动添加一个唯一的属性选择器（如 `div[data-qiankun="appName"]`）作为前缀，实现作用域限定[reference:8][reference:9]。
*   **效果与局限**：提供的是“弱隔离”，但依然无法完美解决动态插入到 `<body>` 下的弹窗样式问题[reference:10][reference:11]。

---

### 🚀 方案对比与建议

| 特性 | 动态样式隔离 (默认) | 严格样式隔离 (Shadow DOM) | 实验性样式隔离 (Scoped) |
| :--- | :--- | :--- | :--- |
| **隔离强度** | 弱（仅单实例） | **最强**（完全隔离） | 中等（作用域限定） |
| **弹窗支持** | 正常 | **需额外适配**[reference:12] | **需额外适配**[reference:13] |
| **主应用覆盖子应用样式** | 可覆盖 | **无法覆盖**[reference:14] | 可覆盖[reference:15] |
| **性能开销** | 小 | 较大（创建 Shadow Root） | 中等（运行时重写CSS） |
| **浏览器兼容性** | 无特殊要求 | 不支持 IE 等旧浏览器[reference:16] | 无特殊要求 |
| **主要适用场景** | 简单项目，单实例运行 | 需要极致隔离的“硬”沙箱场景 | 多数场景，期望平衡隔离与适配成本的“软”沙箱[reference:17] |

### 💡 总结与建议

*   **新项目**：**优先采用构建时的工程化手段**（如 CSS Modules）从源头避免冲突，再根据主应用微调样式[reference:18][reference:19]。
*   **运行时方案选择**：**推荐使用 `experimentalStyleIsolation`** 并统一处理弹窗等全局组件的样式问题（如通过 `getPopupContainer` 指定挂载点），它平衡了隔离性与灵活性[reference:20]。`strictStyleIsolation` 副作用较大，若非必要不建议开启。