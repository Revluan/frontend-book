# 微前端项目面试问答

本文档针对当前微前端架构项目，整理了30个专业面试问题及回答。

---

## 一、架构基础篇

### 1. 请介绍这个微前端项目的整体架构设计

**回答：**

本项目采用 **微前端架构**，使用 **Garfish** 作为微前端框架。整体架构分为：

- **主应用（Main App）**：基于 Next.js 16 + React 19，负责整体布局、导航、状态管理和子应用加载
- **子应用（Sub Apps）**：基于 React 19 + Vite，独立开发、独立部署，通过 Garfish 集成到主应用
- **共享服务层**：`@ucloud/ai-service` 提供统一的 API 调用、用户信息、国际化等服务
- **状态共享**：通过 Zustand 实现主应用与子应用的状态共享
- **沙箱隔离**：当前配置为 `sandbox: false`，共享 React 实例

这种架构的优势在于：子应用可以独立开发、测试、部署；技术栈灵活；状态共享便捷；国际化统一管理。

---

### 2. 为什么选择 Garfish 作为微前端框架？与其他方案相比有什么优势？

**回答：**

选择 Garfish 主要基于以下考虑：

1. **字节跳动出品**：经过大规模生产环境验证，稳定性有保障
2. **ESM 支持**：对 ES Module 有较好的支持，适合现代前端项目
3. **灵活性**：支持多种加载方式，可以关闭沙箱实现依赖共享
4. **与 Vite 兼容**：子应用使用 Vite 构建，Garfish 对 Vite 有较好的兼容性

与其他方案对比：
- **qiankun**：基于 single-spa，功能全面但沙箱方案较重
- **Module Federation**：Webpack 5 原生方案，但需要统一构建工具
- **single-spa**：底层框架，需要自行实现很多功能
- **Garfish**：在灵活性和开箱即用之间取得了较好的平衡

---

### 3. 主应用为什么选择 Next.js？子应用为什么选择 Vite？

**回答：**

**主应用选择 Next.js 的原因：**

1. **SSR/SSG 支持**：主应用需要处理 SEO 和首屏性能，Next.js 的服务端渲染能力是刚需
2. **App Router**：Next.js 16 的 App Router 提供了更好的路由组织方式
3. **生态完善**：插件丰富，与 Ant Design、Tailwind CSS 等集成良好
4. **服务端能力**：可以在服务端获取公共数据（common-data），减少客户端请求

**子应用选择 Vite 的原因：**

1. **开发体验**：Vite 的 HMR 速度极快，开发效率高
2. **构建速度**：基于 esbuild 的预构建，冷启动和热更新都非常快
3. **ESM 原生支持**：现代浏览器原生支持 ES Module，无需打包即可运行
4. **轻量级**：子应用不需要 SSR，Vite 足够满足需求

---

### 4. 请描述主应用的初始化流程

**回答：**

主应用的初始化流程如下：

```
1. Next.js 启动
   ↓
2. RootLayout (app/layout.tsx) 渲染
   ↓
3. ServiceInitializer 初始化 @ucloud/ai-service
   ↓
4. GarfishProvider 初始化 Garfish
   ↓
5. 从 manifest.json 读取子应用配置
   ↓
6. 将子应用配置存入 Zustand store
   ↓
7. SubAppContainer 渲染子应用容器
   ↓
8. Garfish 根据路由加载对应的子应用
```

关键步骤说明：
- **ServiceInitializer**：在客户端组件挂载时初始化服务，使用动态导入避免 SSR 错误
- **GarfishProvider**：配置子应用列表，设置入口地址、激活条件、props
- **SubAppContainer**：提供 `#sub-app-container` DOM 节点供 Garfish 挂载子应用

---

### 5. 请描述子应用的初始化流程

**回答：**

子应用的初始化流程如下：

```
1. Garfish 加载子应用入口 HTML
   ↓
2. 加载子应用的 JavaScript 模块
   ↓
3. 执行 main.tsx，导出 provider 函数
   ↓
4. Garfish 调用 provider，传入 props
   ↓
5. RootComponent 接收 props
   ↓
6. 从 props.store 获取主应用的 Zustand store
   ↓
7. 调用 setExternalStore 设置外部 store
   ↓
8. 注册子应用路由、菜单、国际化消息到主应用
   ↓
9. 渲染 App 组件
```

关键点：
- 子应用导出 `provider` 函数供 Garfish 使用
- 使用 `reactBridge` 包装根组件
- 通过 `useSyncExternalStore` 订阅主应用 store

---

## 二、状态管理篇

### 6. 主应用和子应用是如何实现状态共享的？

**回答：**

状态共享的实现方式如下：

**1. Store 传递**

主应用通过 Garfish props 将 Zustand store hook 传递给子应用：

```typescript
// 主应用：GarfishProvider.tsx
apps: enabledSubApps.map((subApp) => ({
  props: {
    store: storeRef.current,  // 传递 Zustand store hook
  },
}))
```

**2. 子应用接收并设置**

```typescript
// 子应用：main.tsx
const store = GarfishProps?.props?.store;
if (store) {
  setExternalStore(store);  // 设置外部 store
}
```

**3. 使用 useSyncExternalStore 订阅**

```typescript
export function useAppStore<T = AppState>(selector?: (state: AppState) => T) {
  if (externalStoreHook) {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }
  return localStore(selector);  // 独立运行时使用本地 store
}
```

这种方式的优点是：状态变化自动触发所有订阅者更新，无需消息通信，响应式同步。

---

### 7. Zustand Store 的结构是怎样的？为什么要进行 Slice 拆分？

**回答：**

**Store 结构：**

```typescript
interface AppState {
  // 用户信息
  user: { name: string; email: string; avatar?: string } | null;

  // 主题设置
  theme: 'light' | 'dark';
  primaryColor: string;

  // 语言设置
  language: 'zh-CN' | 'en-US';

  // 子应用路由信息
  subAppRoutes: Record<string, SubAppRoutes>;

  // 子应用菜单项信息
  subAppMenuItems: Record<string, SubAppMenuItems>;

  // 子应用国际化消息
  subAppIntlMessages: Record<string, SubAppIntlMessages>;

  // 启用的子应用配置
  enabledSubApps: SubAppConfig[];
}
```

**Slice 拆分的原因：**

1. **单一职责**：每个 Slice 负责一个领域，便于维护
2. **按需订阅**：组件只订阅需要的 Slice，减少不必要的重渲染
3. **代码组织**：避免单个文件过大（原 store 约 440+ 行）
4. **团队协作**：不同团队可以维护不同的 Slice

当前拆分为：
- `subAppSlice.ts`：菜单、intl、加载态
- `commonDataSlice.ts`：products、categories、errorCode、domainURLMap

---

### 8. 子应用如何注册路由、菜单和国际化消息到主应用？

**回答：**

子应用通过调用主应用 store 的 action 方法进行注册：

**1. 路由注册**

```typescript
// 子应用：main.tsx
testState.registerSubAppRoutes({
  basename: '/react',
  routes: routes,
  fullRoutes: fullRoutes,
});
```

**2. 菜单注册**

```typescript
testState.registerSubAppMenuItems({
  basename: '/react',
  menuItems: menuItems,
});
```

**3. 国际化消息注册**

```typescript
testState.registerSubAppIntlMessages({
  basename: '/react',
  messages: messages,  // { 'zh-CN': {...}, 'en-US': {...} }
});
```

**主应用 Store 实现：**

```typescript
registerSubAppRoutes: (routes) => {
  set((state) => ({
    subAppRoutes: {
      ...state.subAppRoutes,
      [routes.basename]: routes,
    },
  }));
}
```

---

### 9. 如何避免 Zustand Store 的大对象订阅导致的性能问题？

**回答：**

避免性能问题的策略：

**1. 细粒度 Selector**

```typescript
// ❌ 不好的做法 - 订阅整个 store
const store = useAppStore();

// ✅ 好的做法 - 只订阅需要的字段
const language = useAppStore((state) => state.language);
const user = useAppStore((state) => state.user);
```

**2. 使用 shallow 比较**

```typescript
import { shallow } from 'zustand/shallow';

const { menuItems, intlMessages } = useAppStore(
  (state) => ({
    menuItems: state.subAppMenuItems,
    intlMessages: state.subAppIntlMessages,
  }),
  shallow
);
```

**3. 组件拆分**

将大组件拆分成更小的组件，每个组件只订阅自己需要的状态：

```typescript
// Navigation 拆分为 NavigationHeader、SidebarMenu、MobileDrawer
// 每个组件独立订阅需要的状态
```

**4. 使用 Hook 封装订阅逻辑**

```typescript
// hooks/useSubAppMenuData.ts
export function useSubAppMenuData() {
  const pathname = usePathname();
  const subAppMenuItems = useAppStore((state) => state.subAppMenuItems);
  // ... 集中处理订阅逻辑
}
```

---

### 10. 子应用独立运行时如何处理状态？

**回答：**

子应用设计了双模式支持：

**1. 检测运行模式**

```typescript
export function useAppStore<T = AppState>(selector?: (state: AppState) => T) {
  if (externalStoreHook) {
    // Garfish 环境 - 使用主应用的 store
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }
  // 独立运行 - 使用本地 store
  return localStore(selector);
}
```

**2. 本地 Store 实现**

```typescript
// 子应用也有自己的 store 定义，独立运行时使用
const localStore = create<AppState>((set) => ({
  // ... 状态定义
}));
```

**3. 入口文件处理**

```typescript
// main.tsx
if (!window.__GARFISH__) {
  // 独立运行时，直接渲染
  root.render(<App />);
}
```

这种设计让子应用既可以集成运行，也可以独立开发和调试。

---

## 三、沙箱与隔离篇

### 11. 为什么这个项目关闭了 JS 沙箱（sandbox: false）？

**回答：**

关闭 JS 沙箱主要有以下原因：

**1. React 实例共享需求**

主应用和子应用都使用 React 19，需要共享同一个 React 实例。如果启用沙箱，会导致：
- 多个 React 实例共存
- Context 失效
- Hooks 规则错误

**2. 状态管理共享**

主应用通过 props 将 Zustand store 传递给子应用，关闭沙箱可以：
- 直接引用同一个 store
- 响应式同步状态
- 避免 postMessage 等跨域通信的复杂性

**3. Vite HMR 兼容性**

Garfish 的 ES Module 插件与 Vite 的虚拟模块（如 `/@react-refresh`）存在兼容性问题，关闭沙箱可以：
- 保证 HMR 正常工作
- 提升开发体验

**4. 性能考虑**

无沙箱开销，不需要 Proxy 代理、作用域隔离等，性能更好。

---

### 12. 关闭 JS 沙箱后，如何保证子应用之间的隔离？

**回答：**

虽然关闭了 JS 沙箱，但采用了以下隔离策略：

**1. 约定大于配置**

- 子应用由内部团队开发，代码质量可控
- 制定编码规范，避免全局变量污染

**2. 全局变量命名空间**

```typescript
// 使用命名空间避免冲突
window.__SUB_APP_NAMESPACE__ = window.__SUB_APP_NAMESPACE__ || {};
window.__SUB_APP_NAMESPACE__.myConfig = { ... };
```

**3. 生命周期清理**

```typescript
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

**4. 错误边界**

```typescript
<SubAppErrorBoundary>
  <SubAppContainer />
</SubAppErrorBoundary>
```

各子应用的错误独立处理，不会影响其他子应用或主应用。

---

### 13. CSS 隔离是如何实现的？

**回答：**

CSS 隔离采用 **PostCSS 前缀选择器** 方案：

**1. 构建时配置**

```javascript
// postcss.config.cjs
const subAppName = process.env.SUB_APP_NAME || '';
const prefix = subAppName
  ? `#sub-app-container[data-sub-app="${subAppName}"] `
  : '#sub-app-container ';

module.exports = {
  plugins: {
    'postcss-prefix-selector': { prefix },
  },
};
```

**2. 处理效果**

```css
/* 原始样式 */
.button { color: blue; }

/* 处理后 */
#sub-app-container[data-sub-app="finance"] .button { color: blue; }
```

**3. 运行时 DOM 属性同步**

```typescript
// 挂载时
beforeMount: (appInfo: any) => {
  const container = document.querySelector('#sub-app-container');
  if (container) {
    container.setAttribute('data-sub-app', nameForCss);
  }
}

// 卸载时
afterUnmount: (appInfo: any) => {
  const container = document.querySelector('#sub-app-container');
  if (container) {
    container.removeAttribute('data-sub-app');
  }
}
```

**4. 体验中心特殊处理**

体验中心虚拟应用复用底层子应用的 CSS：

```typescript
const nameForCss = appInfo.name.startsWith('experience-')
  ? appInfo.name.replace(/^experience-/, '')  // experience-modelverse → modelverse
  : appInfo.name;
```

---

### 14. 主应用和子应用如何共享依赖？版本不一致会有什么问题？

**回答：**

**共享依赖策略：**

由于 `sandbox: false`，主应用和子应用实际上共享以下依赖：

1. **React 生态**：react / react-dom
2. **状态管理**：Zustand
3. **共享服务**：@ucloud/ai-service
4. **设计令牌**：@ucloud/ai-design-tokens

**版本不一致的问题：**

1. **React 版本不一致**：
   - 多个 React 实例
   - Context 失效
   - Hooks 错误（如 "Invalid hook call"）

2. **其他库版本不一致**：
   - 类型不匹配
   - 行为差异
   - 潜在的运行时错误

**解决方案：**

1. **严格版本锁定**
```json
{
  "react": "19.0.0",  // 不使用 ^ 或 ~
  "antd": "6.1.2"
}
```

2. **依赖检查脚本**
```bash
node scripts/check-dependencies.js
```

3. **Monorepo 管理**
```yaml
# pnpm-workspace.yaml
packages:
  - 'main-app'
  - 'modelverse'
  - 'sandbox'
  - 'ai-packages/*'
```

---

### 15. Tailwind CSS 在微前端架构中是如何处理的？

**回答：**

**1. 主应用配置**

```javascript
// tailwind.config.js
module.exports = {
  important: true,  // 所有样式添加 !important
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",  // 引用 CSS 变量
      }
    }
  }
}
```

**2. 子应用配置**

子应用通过 PostCSS 添加命名空间前缀：

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

**3. 主题色同步**

主应用通过 CSS 变量定义主题色，子应用通过 `var(--primary-color)` 引用：

```typescript
// GarfishProvider.tsx
props: {
  tailwindConfig: {
    theme: { extend: { colors: { primary: 'var(--primary-color)' } } },
    important: true,
  },
}
```

**4. 设计令牌共享**

通过 `@ucloud/ai-design-tokens` 统一管理：
- 颜色系统
- 间距系统
- 响应式断点
- 控件高度

---

## 四、路由与导航篇

### 16. 主应用和子应用的路由是如何协调的？

**回答：**

**主应用路由（Next.js App Router）：**

```
/                    → 首页
/modelverse          → Modelverse 子应用
/modelverse/*        → Modelverse 子应用路由
/sandbox             → Sandbox 子应用
/sandbox/*           → Sandbox 子应用路由
/experience-modelverse/* → 体验中心
```

**子应用路由（React Router）：**

子应用使用 React Router，路由配置注册到主应用：

```typescript
// 子应用路由配置
export const routes = [
  { path: '/', name: 'Home', component: 'Home' },
  { path: '/about', name: 'About', component: 'About' },
];

// 完整路径 = basename + path
// 例如：/modelverse + /about = /modelverse/about
```

**路由注册流程：**

```
1. 子应用加载
   ↓
2. RootComponent 获取 routes 配置
   ↓
3. 生成 fullRoutes（包含 basename）
   ↓
4. 调用 store.registerSubAppRoutes
   ↓
5. 主应用 store 存储路由信息
   ↓
6. 主应用导航组件读取路由信息
   ↓
7. 渲染菜单和导航
```

---

### 17. 什么是体验中心？为什么要设计成虚拟子应用？

**回答：**

**体验中心概念：**

体验中心是一个聚合入口，下面可以挂多个子应用的页面，路径规则为 `/experience-${subapp.name}/xxx`。

**为什么设计成虚拟子应用：**

1. **不占 manifest 条目**：体验中心是入口聚合，不是独立子应用

2. **复用构建产物**：与底层子应用共用 entry 和静态资源

3. **basename 独立**：
   - 主路径：`/modelverse`
   - 体验中心路径：`/experience-modelverse`
   - 两者需要不同的 basename

4. **侧栏过滤**：体验中心只展示部分菜单（文本模型、视觉模型、多模态）

**实现方式：**

```typescript
// GarfishProvider.tsx
// 为体验中心注册虚拟子应用
{
  name: `experience-${name}`,  // experience-modelverse
  basename: `/experience-${name}`,  // /experience-modelverse
  entry: subApp.entry,  // 复用底层子应用的 entry
}
```

---

### 18. 顶部导航是如何实现的？支持哪些配置？

**回答：**

顶部导航通过静态配置维护（`config/topNav.ts`）：

**配置项说明：**

| 字段 | 说明 |
|------|------|
| `key` | 顶 nav 唯一标识 |
| `href` | 点击后跳转地址 |
| `labelKey` | 国际化 key |
| `pathPatterns` | 属于该顶 nav 的路径前缀，**最长匹配优先** |
| `subAppBasenames` | 依赖的子应用 basename；启用时才显示 |
| `sidebarMenuKeys` | 该顶 nav 下侧栏只展示的菜单 key |

**配置示例：**

```typescript
{
  key: 'experienceCenter',
  href: '/experience-modelverse/text-model',
  labelKey: 'nav.experienceCenter',
  pathPatterns: ['/experience-modelverse'],
  subAppBasenames: ['/modelverse'],
  sidebarMenuKeys: ['text-model', 'vision-model', 'multimodal'],
}
```

**特点：**

- 一个子应用可以出现在多个顶 nav 下
- 按 `subAppBasenames` 与 manifest 联动显示
- 体验中心支持侧栏菜单过滤

---

### 19. 子应用路由页面为什么要收敛？如何实现？

**回答：**

**为什么要收敛：**

之前每个子应用都有独立的 `page.tsx` + `[...slug]/page.tsx`，内容几乎相同：

```
app/modelverse/page.tsx
app/modelverse/[...slug]/page.tsx
app/sandbox/page.tsx
app/sandbox/[...slug]/page.tsx
app/experience-modelverse/page.tsx
app/experience-modelverse/[...slug]/page.tsx
```

这导致：
- 重复文件和重复逻辑
- 维护困难

**如何实现收敛：**

创建共享组件 `SubAppRoutePage.tsx`：

```typescript
// components/SubAppRoutePage.tsx
export function SubAppRoutePage() {
  return (
    <div id="sub-app-container" className="flex-1" />
  );
}
```

各子应用路由页面统一使用：

```typescript
// app/modelverse/[...slug]/page.tsx
import { SubAppRoutePage } from '@/components/SubAppRoutePage';
export default SubAppRoutePage;
```

---

### 20. Next.js App Router 和 Pages Router 并存会有什么问题？

**回答：**

**当前状态：**

项目同时存在 `app/` 和 `pages/` 目录，pages 主要用于 Nextra/docs。

**问题：**

1. **心智负担**：两套路由系统，需要理解两种模式
2. **构建复杂**：Next.js 需要处理两种路由
3. **迁移成本**：部分功能需要迁移

**建议：**

1. **明确边界**：
   - App Router：业务应用
   - Pages Router：仅用于文档等特殊场景

2. **逐步迁移**：规划将所有业务代码迁移到 App Router

3. **文档化**：在团队内明确约定，避免新代码使用 Pages Router

---

## 五、性能优化篇

### 21. 子应用预加载是如何实现的？

**回答：**

预加载分为两个阶段：

**1. Prefetch Link（立即执行）**

```typescript
// layout.tsx
{enabledSubApps.map((subApp) => (
  <link
    key={subApp.name}
    rel="prefetch"
    href={`${subApp.entry}/index.html`}
    as="document"
  />
))}
```

**2. Preload App（延迟执行）**

```typescript
// GarfishProvider.tsx
const preloadDelayMs = 2000;
setTimeout(() => {
  requestIdleCallback(() => {
    preloadSubAppNames.forEach((appName) => {
      GarfishInstance.preloadApp(appName);
    });
  });
}, preloadDelayMs);
```

**优化建议：**

- 对「当前 path 对应子应用」做优先 preload
- 先 preload 当前要进的子应用，再 idle 时 preload 其余

---

### 22. 首屏性能优化做了哪些工作？

**回答：**

**1. 数据降级**

```typescript
// common-data 请求失败时使用 {} 降级
const safeBothProducts = bothProducts || {};
```

**2. 非首屏组件动态加载**

```typescript
const ProductMenuDrawer = dynamic(
  () => import('./ProductMenuDrawer'),
  { ssr: false }
);

const LoginModal = dynamic(
  () => import('./LoginModal'),
  { ssr: false }
);
```

**3. 子应用预加载**

- Prefetch link 立即执行
- 2秒后 requestIdleCallback 预加载

**4. Layout 数据并行请求**

```typescript
const [bothProducts, categories, errorCode, domainURLMap] = await Promise.all([
  fetchBothProducts(domainURL),
  fetchCategories(domainURL),
  fetchErrorCode(domainURL),
  fetchDomainURLMap(domainURL),
]);
```

**5. 代码分割**

```typescript
// vite.config.ts
manualChunks: (id: string) => {
  if (id.includes('antd')) return 'vendor-antd';
  if (id.includes('@ucloud')) return 'vendor-ucloud';
  return 'vendor';
}
```

---

### 23. 如何优化 Navigation 组件的性能？

**回答：**

**问题：**

Navigation.tsx 约 460 行，包含顶栏、侧栏、菜单推导、intl、移动端抽屉、骨架等。

**优化方案：**

**1. 组件拆分**

```
Navigation.tsx
├── NavigationHeader.tsx
├── SidebarMenu.tsx
├── MobileDrawer.tsx
└── hooks/
    ├── useSubAppMenu.ts
    └── useSidebarSelection.ts
```

**2. 细粒度订阅**

```typescript
// hooks/useSubAppMenuData.ts
export function useSubAppMenuData() {
  const pathname = usePathname();
  const subAppMenuItems = useAppStore((state) => state.subAppMenuItems);
  const subAppIntlMessages = useAppStore((state) => state.subAppIntlMessages);

  // 集中处理订阅逻辑，避免在组件内直调 getState()
  return useMemo(() => {
    // ... 推导当前子应用菜单
  }, [pathname, subAppMenuItems, subAppIntlMessages]);
}
```

**3. 避免渲染路径调用 getState**

```typescript
// ❌ 不好的做法
function Component() {
  const value = useAppStore.getState().something;  // 每次渲染都调用
}

// ✅ 好的做法
function Component() {
  const value = useAppStore((state) => state.something);  // 响应式订阅
}
```

---

### 24. Vite 构建优化做了哪些配置？

**回答：**

**1. 依赖预构建**

```typescript
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
  },
}
```

**2. 代码分割**

```typescript
manualChunks: (id: string) => {
  if (id.includes('node_modules')) {
    if (id.includes('antd')) return 'vendor-antd';
    if (id.replace(/\\/g, '/').includes('@ucloud')) return 'vendor-ucloud';
    return 'vendor';
  }
}
```

**注意**：React 和 react-dom 必须在 vendor 中，不能单独拆分，避免循环依赖导致 `createContext` 为 `undefined`。

**3. CSS 处理**

```typescript
css: {
  postcss: './postcss.config.cjs',
  devSourcemap: true,
}
```

---

### 25. 生产环境的日志如何处理？

**回答：**

**当前状态：**

Garfish 生命周期有 console.log：

```typescript
beforeLoad: (appInfo: any) => {
  console.log(`子应用 ${appInfo.name} 开始加载`);
},
```

**建议：**

1. **改为 debug 或采样上报**

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log(`子应用 ${appInfo.name} 开始加载`);
} else {
  // 采样上报
  reportLog({ event: 'subapp_load', name: appInfo.name });
}
```

2. **错误边界上报**

```typescript
class SubAppErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    reportError({
      error,
      errorInfo,
      subAppName: getCurrentSubAppName(),
    });
  }
}
```

3. **性能监控**

```typescript
afterMount: (appInfo: any) => {
  const duration = performance.now() - startTime;
  reportPerformance({
    appName: appInfo.name,
    mountDuration: duration,
  });
}
```

---

## 六、国际化与通信篇

### 26. 国际化方案是如何设计的？

**回答：**

**架构设计：**

```
主应用 locales/
  ├── zh-CN.ts
  └── en-US.ts
         │ 合并
         ▼
子应用 locales/
  ├── zh-CN.ts
  └── en-US.ts
         │ 注册到主应用 store
         ▼
主应用 store.subAppIntlMessages
         │ 根据当前路径选择子应用消息
         ▼
useIntl Hook
         │ 合并主应用和子应用消息
         ▼
组件使用 formatMessage
```

**消息合并策略：**

1. 主应用消息作为基础消息
2. 子应用消息覆盖主应用的相同 key
3. 优先级：子应用消息 > 主应用消息

**使用示例：**

```typescript
const formatMessage = (descriptor: { id: string; defaultMessage?: string }) => {
  const key = descriptor.id;
  if (key in mergedMessages) {
    return mergedMessages[key];
  }
  return descriptor.defaultMessage || key;
};
```

---

### 27. 主应用和子应用的通信机制有哪些？

**回答：**

**1. 主应用 → 子应用**

**通过 Garfish Props：**

```typescript
// 主应用
props: {
  store: storeRef.current,
  service: service,
  antdThemeConfig: antdThemeConfig,
  tailwindConfig: {...},
}
```

**通过 Zustand Store：**

```typescript
// 主应用
useAppStore.getState().setLanguage('en-US');

// 子应用（自动同步）
const language = useAppStore((state) => state.language);
```

**2. 子应用 → 主应用**

**通过 Zustand Store Actions：**

```typescript
// 子应用
const store = useAppStore.getState();
store.registerSubAppRoutes({ basename, routes, fullRoutes });
store.registerSubAppMenuItems({ basename, menuItems });
store.registerSubAppIntlMessages({ basename, messages });
```

**通过全局变量：**

```typescript
// 子应用注册
window.__SUB_APP_INTL_MESSAGES__[basename] = { basename, messages };

// 主应用读取
const messages = window.__SUB_APP_INTL_MESSAGES__?.[basename];
```

**3. 事件通信（可选）**

```typescript
// 主应用发送事件
window.dispatchEvent(new CustomEvent('main-app-event', { detail: data }));

// 子应用监听事件
window.addEventListener('main-app-event', (event) => {
  // 处理数据
});
```

---

### 28. 主题色同步是如何实现的？

**回答：**

**实现机制：**

```
主应用 store.primaryColor 变化
  ↓ Zustand 订阅
子应用 useAppStore 订阅
  ↓ 更新 CSS 变量
document.documentElement.style.setProperty('--primary-color', color)
```

**主应用定义：**

```typescript
// store
primaryColor: '#667eea',

// CSS 变量
document.documentElement.style.setProperty('--primary-color', primaryColor);
```

**子应用使用：**

```typescript
// Tailwind 配置
colors: {
  primary: 'var(--primary-color)',
}

// CSS
.button {
  background-color: var(--primary-color);
}
```

**Ant Design 主题同步：**

```typescript
// 主应用传递
props: {
  antdThemeConfig: antdThemeConfig,
}

// 子应用接收
const { antdThemeConfig } = GarfishProps?.props || {};
<ConfigProvider theme={antdThemeConfig}>
  <App />
</ConfigProvider>
```

---

## 七、部署与运维篇

### 29. Nginx 配置是如何生成的？

**回答：**

**原则：唯一来源**

- 模板：`main-app/deploy/nginx.conf.template`
- 脚本：`deploy/generate-nginx-config.js`

**生成命令：**

```bash
node deploy/generate-nginx-config.js [输出路径]
# 默认输出：/etc/nginx/nginx.conf
```

**脚本行为：**

1. 根据环境读取 manifest（test03 / production）
2. 生成子应用 upstream
3. 生成 `/public/basename` 的 location
4. 若存在 `deploy/experience-center.json`，生成体验中心 location

**模板占位符：**

- `${SUBAPP_UPSTREAMS}`：子应用 upstream 块
- `${SUBAPP_LOCATIONS}`：子应用 location + 体验中心 location

**体验中心配置：**

```json
// deploy/experience-center.json
{
  "subAppNames": ["modelverse"]
}
```

---

### 30. 这个微前端架构的适用场景和不适用场景是什么？

**回答：**

**适用场景：**

1. **技术栈统一**：主应用和子应用都使用 React
2. **团队协作紧密**：可以协调依赖版本升级
3. **性能要求高**：需要极致的加载和运行性能
4. **状态共享需求**：需要主应用和子应用实时同步状态
5. **内部产品**：子应用由内部团队开发，代码质量可控

**不适用场景：**

1. **技术栈异构**：不同子应用使用不同框架（Vue、Angular 等）
2. **第三方子应用**：无法控制子应用的代码质量和版本
3. **强隔离需求**：需要严格的 JS 和 CSS 隔离
4. **动态加载未知应用**：需要加载未知的第三方应用
5. **跨团队独立开发**：各团队无法协调依赖版本

**未来优化方向：**

1. **渐进式沙箱**：对信任的子应用关闭沙箱，对第三方子应用启用沙箱
2. **依赖外部化**：使用 Module Federation 共享依赖
3. **Web Components**：考虑使用 Web Components 封装子应用，天然样式隔离

---

**文档版本**：1.0.0
**最后更新**：2024年
