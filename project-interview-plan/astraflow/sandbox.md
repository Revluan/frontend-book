# 微前端沙箱与隔离机制分析

本文档深入分析当前微前端架构中的 **JS 沙箱**、**CSS 隔离** 和 **公共依赖处理** 机制。

---

## 目录

- [1. JS 沙箱机制](#1-js-沙箱机制)
- [2. CSS 隔离机制](#2-css-隔离机制)
- [3. 公共依赖处理](#3-公共依赖处理)
- [4. 优缺点分析](#4-优缺点分析)
- [5. 最佳实践建议](#5-最佳实践建议)

---

## 1. JS 沙箱机制

### 1.1 当前配置

**沙箱状态：关闭 (`sandbox: false`)**

```typescript
// components/GarfishProvider.tsx:124
{
  name: subApp.name,
  entry: entry ? `${entry}/index.html` : '',
  sandbox: false as unknown as any, // 关闭沙箱
  // ...
}
```

### 1.2 关闭沙箱的原因

从代码注释和实现可以看出，关闭沙箱主要有以下原因：

#### 1) React 实例共享需求
- **主应用**：Next.js 16 + React 19
- **子应用**：Vite + React 19
- 共享同一个 React 实例，避免多个 React 实例导致的 Context 失效、Hooks 错误等问题

#### 2) 状态管理共享
```typescript
// GarfishProvider.tsx:224
props: {
  store: storeRef.current,  // 传递 Zustand store hook
  service: service,          // 传递共享服务
  antdThemeConfig: antdThemeConfig,
}
```
- 主应用通过 props 将 Zustand store hook 传递给子应用
- 子应用通过 `setExternalStore` 设置外部 store
- 实现主子应用状态的实时同步

#### 3) Vite HMR 兼容性
```typescript
// GarfishProvider.tsx:102-115
// 注意：GarfishEsModule 与 Vite 的虚拟模块（如 /@react-refresh）存在根本性兼容性问题
// 即使配置了 excludes，Vite HMR 虚拟模块在沙箱内执行时仍可能被错误转换
plugins: [
  // 已禁用 GarfishEsModule
]
```

### 1.3 全局变量管理

#### 1) Garfish 环境标识
```typescript
// GarfishProvider.tsx:263-265
if (typeof window !== 'undefined') {
  (window as any).__GARFISH__ = true;
}
```
- 手动设置 `window.__GARFISH__` 全局变量
- 子应用可通过此变量判断是否在 Garfish 环境中运行

#### 2) 国际化消息共享
```typescript
// app/layout.tsx (RootLayout)
window.__SUB_APP_INTL_MESSAGES__ = {};
```
- 主应用初始化全局国际化消息对象
- 子应用注册时写入自己的国际化消息
- 主应用 `useIntl` Hook 合并主应用和子应用的消息

### 1.4 无沙箱环境的隔离策略

由于关闭了 JS 沙箱，采用以下策略避免冲突：

#### 1) DOM 容器标识
```typescript
// GarfishProvider.tsx:139-142
const container = document.querySelector('#sub-app-container');
if (container) {
  container.setAttribute('data-sub-app', nameForCss);
}
```
- 在挂载时设置 `data-sub-app` 属性
- 卸载时移除该属性
- 配合 CSS 命名空间实现样式隔离

#### 2) 生命周期管理
```typescript
beforeMount: (appInfo: any) => {
  // 设置 data-sub-app 属性
  // 记录加载性能
},
afterMount: (appInfo: any) => {
  // 记录挂载性能
  // 清理加载状态
},
beforeUnmount: (appInfo: any) => {
  // 清理加载状态
},
afterUnmount: (appInfo: any) => {
  // 移除 data-sub-app 属性
}
```

#### 3) 错误隔离
```typescript
errorLoadApp: (err: Error, appInfo: any) => {
  console.error(`子应用 ${appInfo.name} 加载失败:`, err);
  storeRef.current.getState().clearSubAppLoading();
},
errorMountApp: (err: Error, appInfo: any) => {
  console.error(`子应用 ${appInfo.name} 挂载失败:`, err);
  storeRef.current.getState().clearSubAppLoading();
}
```
- 各子应用的错误独立处理
- 不会影响其他子应用或主应用

---

## 2. CSS 隔离机制

### 2.1 核心机制：PostCSS 前缀选择器

#### 配置文件：`postcss.config.cjs`
```javascript
const subAppName = process.env.SUB_APP_NAME || process.env.VITE_SUB_APP_NAME || '';
const prefix = subAppName
  ? `#sub-app-container[data-sub-app="${subAppName}"] `
  : '#sub-app-container ';

module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
    'postcss-prefix-selector': { prefix },
  },
};
```

#### 工作原理
1. **构建时**：通过环境变量 `SUB_APP_NAME` 指定子应用名称
2. **PostCSS 处理**：`postcss-prefix-selector` 插件为所有 CSS 选择器添加前缀
3. **结果示例**：
   ```css
   /* 原始样式 */
   .button { color: blue; }

   /* 处理后 */
   #sub-app-container[data-sub-app="finance"] .button { color: blue; }
   ```

### 2.2 运行时 DOM 属性同步

#### 挂载时设置属性
```typescript
// GarfishProvider.tsx:136-142
beforeMount: (appInfo: any) => {
  // 体验中心虚拟应用复用底层子应用构建产物，故用底层 name 匹配 CSS
  const nameForCss = appInfo.name.startsWith('experience-')
    ? appInfo.name.replace(/^experience-/, '')
    : appInfo.name;
  const container = document.querySelector('#sub-app-container');
  if (container) {
    container.setAttribute('data-sub-app', nameForCss);
  }
}
```

#### 卸载时清理属性
```typescript
// GarfishProvider.tsx:184-187
afterUnmount: (appInfo: any) => {
  const container = document.querySelector('#sub-app-container');
  if (container) {
    container.removeAttribute('data-sub-app');
  }
}
```

### 2.3 体验中心特殊处理

体验中心虚拟应用（如 `experience-modelverse`）与底层子应用（`modelverse`）共用构建产物：

```typescript
// 使用底层子应用名称匹配 CSS
const nameForCss = appInfo.name.startsWith('experience-')
  ? appInfo.name.replace(/^experience-/, '')  // experience-modelverse → modelverse
  : appInfo.name;
```

**原因**：
- 体验中心不是独立构建的子应用
- 复用底层子应用的 entry 和静态资源
- CSS 前缀必须与底层子应用一致

### 2.4 Tailwind CSS 处理

#### 主应用配置
```javascript
// tailwind.config.js
module.exports = {
  important: true,  // 所有 Tailwind 样式添加 !important
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",  // 引用 CSS 变量
      }
    }
  }
}
```

#### 子应用配置
```javascript
// 子应用的 tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary-color)',
      }
    }
  }
}
```

#### 主题色同步
```typescript
// GarfishProvider.tsx:227-230
props: {
  antdThemeConfig: antdThemeConfig,
  tailwindConfig: {
    theme: { extend: { colors: { primary: 'var(--primary-color)' } } },
    important: true,
  },
}
```

- 主应用通过 CSS 变量 `--primary-color` 定义主题色
- 子应用通过 `var(--primary-color)` 引用主题色
- 主应用更新主题色时，子应用自动同步

### 2.5 CSS 加载策略

#### 开发环境
```typescript
// vite.config.ts:28-31
css: {
  postcss: './postcss.config.cjs',
  devSourcemap: true,  // 开发环境启用 sourcemap
}
```
- 立即注入 CSS，减少 FOUC (Flash of Unstyled Content)
- 启用 sourcemap 便于调试

#### 生产环境
- 通过 PostCSS 添加命名空间前缀
- 打包为独立的 CSS 文件
- 通过 `<link>` 标签加载

---

## 3. 公共依赖处理

### 3.1 依赖版本管理

#### 主应用依赖 (main-app/package.json)
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "antd": "^6.1.2",
    "zustand": "^5.0.9",
    "@ucloud/ai-service": "^0.0.38",
    "garfish": "^1.19.7",
    "tailwindcss": "^4.1.18"
  }
}
```

#### 子应用依赖 (finance/package.json)
```json
{
  "dependencies": {
    "react": "^19.0.0",         // 版本一致
    "react-dom": "^19.0.0",     // 版本一致
    "antd": "^6.0.0",           // 小版本差异
    "zustand": "^5.0.9",        // 版本一致
    "@ucloud/ai-service": "^0.0.36",  // 小版本差异
    "@ucloud/ai-entry": "^0.1.35"     // 子应用专用
  }
}
```

### 3.2 依赖共享策略

由于 `sandbox: false`，主应用和子应用实际上**共享以下依赖**：

#### 1) React 生态
- **react / react-dom**：共享同一实例
- **好处**：
  - 避免多个 React 实例导致的 Context 失效
  - 避免 Hooks 规则错误
  - 减少内存占用
- **风险**：
  - 版本必须严格一致
  - 主应用升级 React 时，所有子应用必须同步升级

#### 2) Zustand Store
```typescript
// 主应用传递 store
props: {
  store: storeRef.current,  // Zustand store hook
}

// 子应用接收并设置
const store = GarfishProps?.props?.store;
if (store) {
  setExternalStore(store);
}
```
- 子应用不创建独立 store
- 使用 `useSyncExternalStore` 订阅主应用 store
- 实现状态实时同步

#### 3) 共享服务层 (@ucloud/ai-service)
```typescript
// 主应用初始化
const serviceInstance = initService({
  getProjects,
  getChannelConfig,
  ENV: { CONSOLE_DEV: process.env.NODE_ENV === 'development' },
  URL: { API: '/api', PASSPORT: '/passport', ROOT: 'ucloud.cn' },
  regionService,
  projectService,
});

// 传递给子应用
props: {
  service: service,
}
```
- 主应用初始化服务
- 通过 props 传递给子应用
- 子应用可选择使用主应用的服务实例或独立初始化

### 3.3 Vite 构建优化

#### 依赖预构建
```typescript
// vite.config.ts:38-75
optimizeDeps: {
  entries: ['./src/main.tsx', './index.html'],
  include: [
    'react',
    'react-dom',
    'react-router-dom',
    'antd',
    '@remixicon/react',
    'zustand',
    'lodash',
    'moment',
    '@ucloud/ai-entry',
    '@ucloud/ai-service',
  ],
  exclude: ['lightningcss', 'fsevents'],
  esbuildOptions: {
    target: 'esnext',
    sourcemap: true,
    legalComments: 'none',
  },
}
```

**优化策略**：
- **预构建常用依赖**：提前将 ESM 依赖转换为优化的格式
- **排除不必要的依赖**：lightningcss、fsevents 等构建工具不需要预构建
- **目标环境**：esnext，减少转换开销

#### 代码分割
```typescript
// vite.config.ts:106-112
manualChunks: (id: string) => {
  if (id.includes('node_modules')) {
    if (id.includes('antd')) return 'vendor-antd';
    if (id.replace(/\\/g, '/').includes('@ucloud')) return 'vendor-ucloud';
    return 'vendor';
  }
}
```

**分割策略**：
- **vendor-antd**：单独打包 Ant Design（体积较大）
- **vendor-ucloud**：单独打包 @ucloud 相关包
- **vendor**：其他第三方依赖（包括 react、react-dom）

**重要**：
- React 和 react-dom 必须在 vendor 中，不能单独拆分
- 原因：避免循环依赖导致 `createContext` 为 `undefined`

### 3.4 设计令牌共享

#### @ucloud/ai-design-tokens

主应用和子应用都依赖 `@ucloud/ai-design-tokens`：

```javascript
// tailwind.config.js
const { theme } = require('@ucloud/ai-design-tokens');
const { screenXS, screenSM, screenMD, screenLG, screenXL, screenXXL } = theme;
```

**共享内容**：
- 颜色系统
- 间距系统（size、margin、padding）
- 圆角值（borderRadius）
- 响应式断点（screen）
- 控件高度（controlHeight）

**好处**：
- 主应用和子应用视觉风格统一
- 设计令牌集中管理，便于维护
- 支持主题切换

### 3.5 依赖版本一致性检查

#### 潜在风险
当前架构下，主应用和子应用的某些依赖版本不完全一致：
- `antd`: 主应用 6.1.2，子应用 6.0.0
- `@ucloud/ai-service`: 主应用 0.0.38，子应用 0.0.36

#### 建议
1. **严格版本锁定**：
   ```json
   // 使用精确版本，不使用 ^ 或 ~
   {
     "react": "19.0.0",
     "antd": "6.1.2"
   }
   ```

2. **依赖检查脚本**：
   ```bash
   # 检查主应用和所有子应用的依赖版本
   node scripts/check-dependencies.js
   ```

3. **Monorepo 管理**：
   - 考虑使用 pnpm workspace 或 npm workspace
   - 在根目录统一管理依赖版本

---

## 4. 优缺点分析

### 4.1 关闭 JS 沙箱的优势

#### 1) 性能更好
- **无沙箱开销**：不需要 Proxy 代理、作用域隔离等
- **共享依赖**：React、Zustand 等只加载一次
- **内存占用更低**：避免重复的依赖实例

#### 2) 状态共享更简单
- **直接引用**：主应用和子应用共享同一个 store
- **响应式同步**：状态变化自动触发所有订阅者更新
- **无需消息通信**：避免 postMessage 等跨域通信的复杂性

#### 3) 开发体验更好
- **HMR 支持**：Vite 的热更新正常工作
- **调试方便**：所有代码在同一上下文，方便断点调试
- **类型安全**：TypeScript 类型可以直接共享

### 4.2 关闭 JS 沙箱的劣势

#### 1) 全局污染风险
- **全局变量冲突**：子应用可能意外修改 `window` 上的全局变量
- **事件监听泄露**：子应用卸载时未清理的事件监听器会残留
- **定时器泄露**：未清理的 `setTimeout/setInterval` 会继续执行

#### 2) 依赖版本冲突
- **版本锁定**：所有子应用必须使用相同版本的共享依赖
- **升级困难**：升级某个依赖需要同步所有子应用
- **灵活性降低**：无法让不同子应用使用不同版本的依赖

#### 3) 隔离性较弱
- **错误传播**：子应用的某些错误可能影响主应用或其他子应用
- **样式冲突**：虽然有 CSS 命名空间，但全局样式仍可能冲突
- **安全性降低**：子应用可以访问主应用的所有全局对象

### 4.3 CSS 命名空间隔离的优势

#### 1) 样式隔离彻底
- **前缀选择器**：所有样式都带命名空间，不会冲突
- **体积小**：相比 Shadow DOM 等方案，无额外运行时开销
- **兼容性好**：所有浏览器都支持，无兼容性问题

#### 2) 调试友好
- **可见性**：样式在 DOM 中可见，便于调试
- **开发工具支持**：浏览器开发者工具可以正常查看和修改样式
- **Sourcemap 支持**：可以追溯到原始 CSS 文件

### 4.4 CSS 命名空间隔离的劣势

#### 1) 构建依赖
- **环境变量要求**：必须在构建时设置 `SUB_APP_NAME`
- **配置复杂**：需要为每个子应用配置 PostCSS
- **构建时间**：PostCSS 处理会增加构建时间

#### 2) 全局样式问题
- **body/html 样式**：无法直接设置 body、html 的样式
- **第三方库样式**：某些第三方库的全局样式无法添加前缀
- **伪元素限制**：某些复杂的伪元素选择器可能失效

---

## 5. 最佳实践建议

### 5.1 全局变量管理

#### 1) 避免全局变量污染
```typescript
// ❌ 不好的做法
window.myConfig = { ... };

// ✅ 好的做法
window.__SUB_APP_NAMESPACE__ = window.__SUB_APP_NAMESPACE__ || {};
window.__SUB_APP_NAMESPACE__.myConfig = { ... };
```

#### 2) 子应用卸载时清理
```typescript
// 子应用入口
export const provider = createSubAppProvider({
  App: AppComponent,
  onUnmount: () => {
    // 清理全局变量
    delete window.__SUB_APP_NAMESPACE__.myConfig;

    // 清理事件监听
    window.removeEventListener('resize', handleResize);

    // 清理定时器
    clearInterval(timer);
  }
});
```

### 5.2 依赖版本管理

#### 1) 使用精确版本
```json
// package.json
{
  "dependencies": {
    "react": "19.0.0",        // ✅ 精确版本
    "antd": "6.1.2",          // ✅ 精确版本
    "zustand": "5.0.9"        // ✅ 精确版本
  }
}
```

#### 2) 定期同步依赖
```bash
# 脚本示例：检查主应用和子应用的依赖版本差异
node scripts/check-dependencies.js
```

#### 3) Monorepo 管理
```json
// pnpm-workspace.yaml
packages:
  - 'main-app'
  - 'finance'
  - 'modelverse'
  - 'sandbox'
  - 'ai-packages/*'
```

### 5.3 CSS 隔离最佳实践

#### 1) 避免全局样式
```css
/* ❌ 不好的做法 */
body {
  background: white;
}

/* ✅ 好的做法 */
#sub-app-container[data-sub-app="finance"] .app-root {
  background: white;
}
```

#### 2) 使用 CSS Modules
```typescript
// ✅ 推荐使用 CSS Modules
import styles from './Button.module.css';

function Button() {
  return <button className={styles.button}>Click</button>;
}
```

#### 3) Scoped 样式
```vue
<!-- Vue 子应用可以使用 scoped -->
<style scoped>
.button {
  color: blue;
}
</style>
```

### 5.4 性能优化

#### 1) 预加载子应用
```typescript
// GarfishProvider.tsx:268-290
const preloadDelayMs = 2000;
setTimeout(() => {
  requestIdleCallback(() => {
    preloadSubAppNames.forEach((appName) => {
      GarfishInstance.preloadApp(appName);
    });
  });
}, preloadDelayMs);
```

#### 2) 按需加载组件
```typescript
// 使用动态导入
const ProductMenuDrawer = dynamic(
  () => import('./ProductMenuDrawer'),
  { ssr: false }
);
```

#### 3) 代码分割优化
```typescript
// vite.config.ts
manualChunks: (id: string) => {
  if (id.includes('antd')) return 'vendor-antd';
  if (id.includes('lodash')) return 'vendor-lodash';
  return 'vendor';
}
```

### 5.5 监控和调试

#### 1) 性能监控
```typescript
beforeMount: (appInfo: any) => {
  const startTime = performance.now();
  // ...
},
afterMount: (appInfo: any) => {
  const endTime = performance.now();
  const duration = endTime - startTime;
  console.log(`子应用 ${appInfo.name} 挂载耗时: ${duration}ms`);

  // 上报性能数据
  reportPerformance({
    appName: appInfo.name,
    mountDuration: duration
  });
}
```

#### 2) 错误边界
```typescript
// 主应用
<SubAppErrorBoundary>
  <SubAppContainer />
</SubAppErrorBoundary>

// 子应用
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // 上报错误
    reportError(error, errorInfo);
  }
}
```

#### 3) 开发者工具
- 使用 React DevTools 查看组件树
- 使用 Redux DevTools 查看 Zustand store 状态
- 使用 Performance 面板分析性能瓶颈

### 5.6 安全性考虑

#### 1) CSP (Content Security Policy)
```html
<!-- 主应用 -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline';">
```

#### 2) 子应用权限控制
```typescript
// 限制子应用访问某些全局对象
const safeProps = {
  store: storeRef.current,
  service: limitedServiceAPI,  // 限制 API 权限
  // 不暴露敏感信息
};
```

#### 3) XSS 防护
```typescript
// 使用 DOMPurify 清理用户输入
import DOMPurify from 'dompurify';

const clean = DOMPurify.sanitize(dirty);
```

---

## 6. 总结

### 6.1 当前架构总结

| 方面 | 实现方式 | 优点 | 缺点 |
|------|---------|------|------|
| **JS 沙箱** | 关闭 (`sandbox: false`) | 性能好、状态共享简单、开发体验好 | 全局污染风险、依赖版本锁定、隔离性弱 |
| **CSS 隔离** | PostCSS 前缀选择器 + DOM 属性 | 隔离彻底、调试友好、兼容性好 | 构建依赖、全局样式限制 |
| **公共依赖** | 共享 React/Zustand，版本一致 | 内存占用低、加载快、类型安全 | 版本升级需同步、灵活性降低 |

### 6.2 适用场景

当前架构适用于：
- **技术栈统一**：主应用和子应用都使用 React
- **团队协作紧密**：可以协调依赖版本升级
- **性能要求高**：需要极致的加载和运行性能
- **状态共享需求**：需要主应用和子应用实时同步状态

### 6.3 不适用场景

当前架构不适用于：
- **技术栈异构**：不同子应用使用不同框架（Vue、Angular 等）
- **第三方子应用**：无法控制子应用的代码质量和版本
- **强隔离需求**：需要严格的 JS 和 CSS 隔离
- **动态加载未知应用**：需要加载未知的第三方应用

### 6.4 未来优化方向

1. **渐进式沙箱**：
   - 对信任的子应用关闭沙箱（当前方案）
   - 对第三方子应用启用沙箱
   - 根据应用配置动态选择

2. **依赖外部化**：
   - 使用 Module Federation 共享依赖
   - 支持不同版本的依赖共存
   - 按需加载依赖

3. **Web Components**：
   - 考虑使用 Web Components 封装子应用
   - 天然的样式隔离（Shadow DOM）
   - 更好的跨框架支持

4. **微前端框架升级**：
   - 关注 Garfish 新版本特性
   - 考虑 qiankun、single-spa 等其他方案
   - 评估 Module Federation 的可行性

---

**文档版本**：1.0.0
**最后更新**：2024年
**维护者**：前端架构团队
