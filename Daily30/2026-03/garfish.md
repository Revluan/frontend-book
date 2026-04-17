Garfish 的 JS 沙箱主要提供了**快照沙箱（Snapshot Sandbox）**和**基于 Proxy 的 VM 沙箱**两套方案，后者的功能更强大，是现在更推荐的方式。两者的核心区别如下：

| 特性 | 快照沙箱 (Snapshot Sandbox) | 代理沙箱 / VM 沙箱 (VM Sandbox) |
| :--- | :--- | :--- |
| **核心原理** | 模拟游戏存档/读档，记录状态变化并恢复[reference:0][reference:1] | 为每个子应用创建一个独立的 `window` 代理对象，环境天然隔离[reference:2][reference:3] |
| **是否污染全局** | 是（会短暂污染，卸载后恢复）[reference:4] | 否（完全隔离）[reference:5] |
| **多实例支持** | 不支持[reference:6] | 支持[reference:7][reference:8] |
| **性能** | 激活/卸载时需遍历 `window` 对象，有额外开销[reference:9] | 操作时通过 Proxy 拦截，性能更优 |

---

### 🧬 快照沙箱 (Snapshot Sandbox)

这是一种相对早期的隔离思路，Garfish 实现它的核心思想是通过“保存状态”和“恢复状态”来隔离子应用运行时的全局副作用[reference:10]。

它的工作流程就像一个“存档/读档”机制：
1.  **存档 (activate)**: 子应用加载前，遍历 `window` 对象，将属性和值复制保存下来[reference:11][reference:12]。
2.  **修改**: 子应用运行，可以自由修改 `window` 对象[reference:13]。
3.  **恢复 (deactivate)**: 子应用卸载时，再次遍历 `window`，将变化记录到 `snapshotMutated`，然后用之前保存的 `snapshotOriginal` 快照恢复 `window` 对象[reference:14][reference:15]。

> 在 Garfish 的某些实现中，还会通过 `patch` 来管理特定的副作用，例如：
> *   **全局变量**: 对比并恢复全局对象上的属性和方法[reference:16]。
> *   **事件监听**: 代理 `addEventListener` 和 `removeEventListener`，在内部维护一个事件注册 Map，以便在应用卸载时清理[reference:17]。
> *   **定时器**: 代理 `setTimeout` 和 `setInterval`，在内部维护 Map，以便在应用卸载时清理[reference:18]。
> *   **`history` API**: 同样通过代理模式管理，防止路由状态冲突[reference:19]。

---

### 🔐 代理沙箱 / VM 沙箱 (VM Sandbox)

为了解决快照沙箱的性能和多实例问题，Garfish 提供了更强大的 VM 沙箱。它利用 ES6 的 `Proxy` 为每个子应用创造一个独立的“虚拟”全局环境（`fakeWindow`）[reference:20][reference:21]。

其核心机制主要包含两方面：

#### 1. 基于 Proxy 的独立环境 (`fakeWindow`)
Garfish 使用 `Proxy` 对真实的 `window` 对象进行拦截，为每个子应用都创建一个独立的代理对象 `fakeWindow`。子应用的所有全局操作（如读写 `window.a` 或调用 `setTimeout`）实际上都被这个代理对象拦截，并重定向到一个该应用私有的、隔离的对象上[reference:22][reference:23][reference:24]。因此，不同子应用间的全局变量和副作用完全不会互相干扰。

#### 2. 基于 `new Function` 的代码执行器
为了执行子应用的 JS 代码，Garfish 会使用 `new Function` 来包裹代码字符串。例如，它会生成类似这样的结构：
```javascript
new Function('window', 'this', `with(window) { ${code} }`)
```
这段代码创建了一个新函数，并将 `fakeWindow` 作为 `window` 参数注入。这样，子应用的代码就在一个受控的、由 `fakeWindow` 提供的沙箱环境中执行，而不是真实的全局 `window` 对象[reference:25][reference:26]。
> 此外，为了便于调试，Garfish 在执行代码时还会拼接 `//# sourceURL=` 指令，让浏览器开发者工具能将 `eval` 或 `new Function` 中执行的代码识别为单独的文件，从而保留正确的错误堆栈信息[reference:27]。

---

### ⚡ 与 ESM 模块的兼容性问题
需要注意的是，基于 `new Function` 的 VM 沙箱机制默认无法直接执行 ES Module 形式的代码。如果你的子应用使用 Vite 等构建工具，默认会生成 ESM 格式的产物。在这种情况下，通常需要**关闭 VM 沙箱，降级使用快照沙箱**[reference:28]，或者安装并使用 Garfish 官方提供的 `@garfish/es-module` 插件来提供支持[reference:29]。

### 💎 总结
Garfish 的两套 JS 沙箱隔离方案，本质上都是通过精确控制代码的执行时机和环境来实现的[reference:30]，其核心步骤如下：
1.  **获取代码**：通过 Fetch API 获取子应用的 JavaScript 文件内容[reference:31][reference:32]。
2.  **创建沙箱**：创建快照沙箱或基于 `Proxy` 的 VM 沙箱实例。
3.  **执行代码**：使用 `new Function` 或 `eval` 将代码包裹在一个函数中，并将沙箱提供的 `fakeWindow` 作为 `window` 参数注入，从而在隔离的环境中执行代码[reference:33][reference:34]。

了解这些机制，能让你在实际工作中更好地规避潜在问题。比如在引入 `Monaco Editor` 这类会往全局函数上挂载属性的库时，如果遇到属性丢失，就需要通过 `protectVariable` 配置来解决问题[reference:35]。





Garfish 的 CSS 样式隔离和 JS 沙箱类似，也提供了多种方案，核心思路是让不同子应用的样式互不干扰。

### ⚙️ 核心隔离方案

| 方案 | 实现原理 | 优点 | 缺点 / 注意事项 |
| :--- | :--- | :--- | :--- |
| **CSS 作用域 (Scoping)** | 为每个子应用的CSS选择器自动添加唯一的属性前缀，使其只在自己的DOM容器内生效[reference:0][reference:1]。 | 实现简单，兼容性好，性能开销小，是Garfish推荐的方案[reference:2]。 | 需额外的构建配置（如PostCSS插件），无法完全隔离影响全局的样式[reference:3]。 |
| **Shadow DOM** | 利用浏览器原生技术，将子应用挂载到一个独立的、隔离的DOM树中，其内部样式与外界完全隔离[reference:4]。 | 提供浏览器原生级别的、最彻底的样式隔离[reference:5]。 | 存在兼容性问题（主要是旧版IE），且事件冒泡和全局弹窗样式处理更复杂[reference:6][reference:7]。 |
| **动态样式表管理** | 在子应用加载时动态创建`<style>`或`<link>`标签插入样式，在卸载时将其移除[reference:8]。 | 灵活控制样式生命周期，能有效清理残留样式[reference:9]。 | 需要手动管理样式加载与卸载逻辑，对异步加载的样式处理较复杂[reference:10]。 |
| **CSS 命名约定** | 通过人为约定的命名规则（如BEM）为每个子应用指定唯一的CSS类名前缀来避免冲突[reference:11]。 | 简单，无需额外工具，依赖开发规范即可实现[reference:12]。 | 完全依赖开发人员的自觉性，容易出错，不适合大型团队或已存在的项目[reference:13]。 |

---

### ⚙️ 配置方式

你可以在注册子应用时，通过`sandbox`配置项来启用样式隔离[reference:14][reference:15]。

```javascript
// 示例配置：为子应用启用 CSS 作用域隔离
Garfish.run({
  apps: [
    {
      name: 'my-sub-app',
      entry: '//localhost:3001',
      sandbox: {
        css: {
          scope: 'my-app-scope', // 启用 CSS 作用域隔离
        },
      },
    },
  ],
});
```

对于更彻底的隔离，可以启用`strictIsolation`模式，结合VM沙箱和多实例管理来提供更全面的环境隔离[reference:16]。

### ⚠️ 注意事项

*   **Vite的兼容性问题**：Garfish的CSS隔离插件`@garfish/css-scope`与Vite的模块加载机制存在兼容问题。在Vite项目中，官方建议暂时禁用该插件，改用框架自带的样式隔离方案（如Vue的`scoped`或React的CSS-in-JS）[reference:17]。
*   **全局样式污染**：主应用的全局样式（如`reset.css`）依然可能影响到子应用，反之亦然。最佳实践是主应用提供最小化的全局样式，并鼓励子应用避免使用全局选择器[reference:18]。
*   **第三方库样式处理**：对于第三方UI库的样式，推荐使用其按需引入功能，或手动为其添加命名空间[reference:19]。

### 💎 总结

Garfish的CSS样式隔离机制提供了从构建时到运行时的多种灵活选择。通常，**CSS作用域**是平衡隔离效果与开发复杂度的首选。如果需要更严格的隔离，可以考虑**Shadow DOM**方案，但同时也要评估它可能带来的额外问题。