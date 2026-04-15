**微前端 & Garfish（8题）**

1. 你们为什么选 Garfish 而不是 qiankun 或 Module Federation，各自的优缺点是什么？

Garfish 支持 HTML 入口，与 Vite 子应用天然契合（直接加载 `index.html`）；生命周期钩子完善（beforeLoad/afterLoad/beforeMount/afterMount/beforeUnmount/afterUnmount）；且有 `reactBridge` 适配 React 19 的 `createRoot` API。qiankun 也支持 HTML 入口，但在 React 19 + Next.js 16 场景下社区适配不如 Garfish 成熟。Module Federation 要求主/子应用共享构建配置（Webpack 5+），与我们主应用 Next.js + 子应用 Vite 的异构技术栈不兼容，且没有沙箱能力。综合考虑技术栈兼容性、HTML 入口支持和独立部署能力，选择了 Garfish。
 
2. Garfish 的沙箱隔离机制是怎么实现的，JS 沙箱和 CSS 沙箱分别用了什么方案？

Garfish 的 JS 沙箱基于 Proxy 代理 `window`，子应用对全局变量的读写在沙箱内完成，卸载时自动恢复；CSS 沙箱支持 Shadow DOM 或样式作用域。但我们项目中 **`sandbox` 设为了 `false`**，原因是关闭沙箱可以让主子应用共享同一个 React 实例，避免多 React 实例导致的 hooks 报错。CSS 隔离改为手动方案：在 `beforeMount` 中给容器设置 `data-sub-app="子应用名"`，子应用 CSS 通过 `#sub-app-container[data-sub-app="xxx"]` 做命名空间隔离，容器本身使用 `isolation: isolate` 创建新的层叠上下文。

3. 主子应用之间如何通信？用了 Garfish 的什么 API，还是自己实现的？

采用了三种方式配合：
- **Garfish Props（主→子）**：主应用通过 `apps[].props` 传递 Zustand store、Service 实例、antd 主题配置、Tailwind 配置等。子应用在 `createSubAppProvider` 中通过 `GarfishProps.props` 接收。
- **Zustand Store（主↔子双向）**：主应用把 `useAppStore` hook 通过 props 传给子应用，子应用调用 `setExternalStore(store)` 接入，内部用 `useSyncExternalStore` 订阅主应用状态变化。子应用也可通过 store 的 actions（如 `registerSubAppMenuItems`、`registerSubAppIntlMessages`）向主应用注册菜单和国际化。
- **全局变量（补充）**：子应用通过 `window.__SUB_APP_INTL_MESSAGES__` 注册国际化消息，作为 store 方案的补充。

4. 子应用独立部署后，如何处理路由冲突？主应用和子应用的路由是怎么约定的？

采用 **basename 前缀隔离** + **双层路由**：每个子应用在 manifest 中声明唯一的 `basename`（如 `/modelverse`、`/sandbox`），Garfish 的 `activeWhen` 通过 `pathname.startsWith(basename + '/')` 做前缀匹配来激活对应子应用。Next.js 侧通过 `app/modelverse/[...slug]/page.tsx` 等 catch-all 路由做占位（渲染空组件 `SubAppRoutePage`），保证不返回 404。子应用内部使用 React Router 并设置 `basename="/modelverse"`，只处理 basename 之后的路径（如 `/bill`）。未注册的 basename 路径会在 `SubAppContainer` 中展示 NotFound 页面。

5. 子应用加载失败怎么处理，有没有降级方案？

三层错误处理：
- **Garfish 生命周期钩子**：`errorLoadApp`（加载失败）和 `errorMountApp`（挂载失败）中清除 loading 状态并打印错误日志，防止页面一直处于 loading。
- **React ErrorBoundary**：`reactBridge` 配置了 `errorBoundary`，子应用渲染异常时展示「加载出错，请刷新重试」的兜底 UI。主应用侧也用 `SubAppErrorBoundary` 包裹了 `SubAppContainer`。
- **NotFound 兜底**：访问未注册子应用的路径时，`SubAppContainer` 检测到非法 basename 后展示 NotFound 页面。

6. 微前端场景下如何处理公共依赖（比如 React）的共享，避免重复打包？

当前策略是 **各自打包 + 版本对齐**。主应用和子应用都独立打包 React 19、antd 6 等，通过统一版本号避免多实例冲突。曾尝试过通过 `window.__MAINAPP_INNERPAGES__` 全局变量 + Vite transform 插件实现构建时依赖共享（主应用挂载 React/antd 到全局，子应用在编译阶段替换 import 为全局变量读取），但因为 Vite/Rollup 的 `external` 机制与入口模块冲突（"The entry point cannot be marked as external"），最终放弃。工具包（`ai-packages`）通过 `peerDependencies` 声明 React，由消费方提供，不会多打一份。代价是 bundle 体积稍大（React 被打了两份），但换来了更好的隔离性和独立开发体验。

7. 子应用切换时，如何保证上一个子应用的状态被正确清理，避免内存泄漏？

清理分三层：
- **reactBridge 的 `unmount`**：调用 `root.unmount()` 卸载 React 组件树，清理 `domElements` 和 `renderResults` 引用，确保 React 内部状态释放。
- **Garfish 生命周期**：`beforeUnmount` 中清除 loading 状态；`afterUnmount` 中移除容器的 `data-sub-app` 属性，防止样式残留。
- **子应用内部**：子应用监听 `garfish:beforeUnmount` 事件，在卸载前做自定义清理（如取消网络请求、移除事件监听）。子应用注册的 `subAppMenuItems` 和 `subAppIntlMessages` 按 basename 存储在 store 中，切换时保留（避免重复加载时重新注册）。

8. 本地开发时主子应用联调怎么做，有没有遇到跨域或端口配置的问题？

使用 `acd-cli dev` 统一启动：它扫描子应用的 `.config/index.js` 和 `vite.config.ts`，自动生成 `manifest.json`（包含各子应用的 entry URL 和端口），端口冲突时自动分配新端口。主应用（`localhost:3000`）通过 manifest 中的 entry（如 `http://127.0.0.1:8083`）加载子应用。跨域方面：子应用 Vite 配置了 `cors: true` 和 `Access-Control-Allow-Origin: *`，微前端模式下设置 `origin` 指向主应用域名；主应用 `next.config.js` 也配了 `Access-Control-Allow-Origin: *`。Source Map 调试通过 Next.js 的 `rewrites` 把 `.map` 请求代理到对应子应用端口。还支持通过环境变量（如 `NEXT_PUBLIC_MODELVERSE_ENTRY`）覆盖子应用入口地址，方便联调远程环境。

---

**Next.js & React 19（6题）**

9. 主应用为什么选 Next.js，用了它的哪些能力，SSR 还是 SSG，还是纯 CSR？

选 Next.js 是因为主应用需要多种渲染模式混合：根布局 `layout.tsx` 是 Server Component，在服务端并行 fetch 产品列表、分类、错误码等公共数据，配合 `next: { revalidate: 3600 }` 做 ISR（增量静态再生），兼顾性能和数据时效性；文档页面（`/docs`）用 `generateStaticParams` 做 SSG；而 Garfish 子应用加载、导航交互等则是纯 CSR（标记 `'use client'`）。同时 Next.js 的 App Router 对微前端基座很友好——可以用 `[...slug]` catch-all 路由为子应用做占位，不需要额外的路由库。此外还用了 `next/dynamic` 做组件懒加载（`ssr: false`），和 `transpilePackages` 转译 monorepo 内的 `@ucloud/ai-service`。

10. React 19 有哪些新特性，你们实际用到了哪些？

React 19 的主要新特性包括：`use()` hook、Server Components 正式稳定、Actions（`useActionState`、`useFormStatus`）、`ref` 作为 prop 传递（不再需要 `forwardRef`）、`<Context>` 可直接作为 Provider、文档 metadata 支持（`<title>`/`<meta>`）等。我们实际用到的主要是：React 19 稳定的 `createRoot` API（与 Garfish reactBridge 适配）、ref 作为 prop 的简化写法、以及整体的性能提升。`use()`、`useActionState` 等新 API 还没有引入，因为微前端子应用是纯客户端渲染，Server Actions 场景较少。

11. React 19 的 use() hook 和 Server Components 你们有用吗，微前端场景下 Server Components 有什么限制？

Server Components 在主应用中有使用——`layout.tsx` 和 `page.tsx` 都是 Server Component，在服务端 fetch 数据后传给客户端组件。`use()` hook 目前未使用。微前端场景下 Server Components 的主要限制是：**子应用无法使用 Server Components**，因为子应用由 Garfish 在客户端动态加载和渲染，不经过 Next.js 的 SSR 流程，无法获得服务端执行环境。子应用也不能用 `use()` 读取服务端 Promise。Server Components 只能在主应用的 Next.js 服务端部分发挥作用，跨不了微前端边界。

12. Next.js 的 App Router 和 Pages Router 你们用的哪个，为什么？

主要使用 **App Router**（`app/` 目录），原因是 App Router 原生支持 Server Components、嵌套布局、流式渲染等 React 19 特性，且 `[...slug]` catch-all 路由非常适合作为微前端子应用的占位路由。文档部分（`/docs`）通过 Nextra 与 `pages/` 目录共存，这是 Nextra 的约束。整体以 App Router 为主。

13. 主应用作为微前端基座，Next.js 的服务端渲染和子应用的客户端渲染如何协调？

采用"服务端渲染框架 + 客户端渲染内容"的分离策略。主应用的 `layout.tsx` 在服务端渲染导航栏、布局框架，并 fetch 公共数据（产品列表、子应用配置等），通过 `<script id="__ENABLED_SUB_APPS__">` 将子应用配置注入到 HTML 中。客户端水合后，`GarfishProvider` 读取配置并初始化 Garfish，根据路由激活对应子应用，将其挂载到 `#sub-app-container`。子应用路由对应的 Next.js 页面（`[...slug]/page.tsx`）只渲染空组件 `SubAppRoutePage`，实际内容完全由 Garfish 在客户端渲染。这样服务端负责"壳"和数据预取，客户端负责子应用的动态加载和交互。

14. React 19 并发模式下，useTransition 和 Suspense 在你们项目里有实际应用场景吗？

当前项目未使用 `useTransition` 和 `Suspense`。潜在的适用场景包括：子应用切换时用 `useTransition` 标记为低优先级更新，保持导航栏响应而不阻塞；列表页筛选/搜索时用 `useTransition` 延迟重渲染避免卡顿；以及用 `Suspense` 包裹子应用容器，在子应用加载期间展示 fallback Loading UI。目前这些场景通过 Garfish 生命周期钩子和手动 loading 状态管理实现，还没有迁移到并发模式。

---

**Vite & 构建（5题）**

15. Vite 在开发环境用 ESM + esbuild，生产环境用 Rollup 打包，这个差异有没有给你们带来过问题？

有遇到过两个问题：一是 **manualChunks 跨 chunk 依赖**问题——开发时 Vite 按需加载模块不需要 chunk 分割，但生产环境 Rollup 的 `manualChunks` 如果拆得太细（比如单独拆 vendor-react），在 Garfish ESM 环境下会因为 blob URL 导致跨 chunk 依赖解析失败，modelverse 最终改为所有 node_modules 打进同一个 vendor chunk 来规避。二是 **Garfish 与 Vite 虚拟模块冲突**——Vite 开发时会注入 `/@react-refresh`、`/@vite/client` 等虚拟模块，`@garfish/es-module` 插件会尝试解析这些路径导致报错（"Cannot use import statement outside a module"），因此禁用了 GarfishEsModule 插件，改用 Vite 原生的 `<script type="module">` 加载。

16. 子应用用 Vite 打包，如何配置 library 模式或 SystemJS 格式，让 Garfish 能正确加载？

我们**没有使用 library 模式或 SystemJS**，而是采用普通 SPA 构建 + ESM 格式。子应用打包输出 `format: 'esm'`，入口是 `index.html`（不是 lib 入口）。Garfish 通过 HTML 入口加载子应用：请求 `index.html` → 解析其中的 `<script type="module" src="main.js">` → 执行 JS → 子应用通过 `window.__GARFISH_EXPORTS__` 注册 provider。关键配置包括：`modulePreload.polyfill: false`（避免与 Garfish 冲突）、`commonjsOptions.transformMixedEsModules: true`（CJS 转 ESM），以及自定义的 `reorder-modulepreload` 插件确保 vendor chunk 在主 chunk 之前加载。

17. Vite 构建速度比 Webpack 快 5 倍，具体体现在哪个阶段，冷启动还是热更新？

**两个阶段都有体现，但冷启动提升最明显。** 开发时 Vite 不做 bundle，利用浏览器原生 ESM 按需加载模块，冷启动只需要启动 dev server + esbuild 预构建依赖（几百毫秒级），而 Webpack 需要先把所有模块打包成 bundle 才能启动。热更新方面，Vite 的 HMR 只需要重新请求变更的模块，不需要重新构建整个 bundle，在大型子应用中更快。但生产构建阶段（Rollup）差异不大，因为都需要完整的打包流程。对我们项目来说，多个子应用同时开发时，每个 Vite 子应用秒级冷启动，比等 Webpack 编译完省了很多时间。

18. 多个子应用同时开发，Vite 端口怎么管理，有没有统一的启动脚本？

有统一的 `acd-cli dev` 命令。运行 `acd-cli dev -p main-app,modelverse,sandbox` 后，它会：1）扫描每个子应用的 `vite.config.ts` 用正则读取端口号（modelverse 8083、sandbox 8084）；2）检测端口是否被占用，冲突时自动调用 `findAvailablePort` 分配新端口并更新 `vite.config.ts`；3）先启动所有子应用（带 `GARFISH_ENV=true`），再启动主应用；4）自动生成 `main-app/app/manifest.json`，写入各子应用的 entry URL 和端口。manifest 在 `.gitignore` 中，不提交到仓库，每次 `acd-cli dev` 动态生成。

19. 生产构建时如何做代码分割和 chunk 优化，避免子应用包体积过大？

通过 Rollup 的 `manualChunks` 做代码分割。sandbox 拆为三个 chunk：`vendor-antd`（antd 相关）、`vendor-ucloud`（`@ucloud/*` 包）、`vendor`（其他第三方依赖），业务代码是主 chunk。modelverse 因为遇到 Garfish ESM 下跨 chunk 依赖解析问题，改为所有 node_modules 打进一个 `vendor` chunk。另外通过 `createViteConfig` 中的 `reorder-modulepreload` 插件控制生产环境 `<link rel="modulepreload">` 的顺序，保证 vendor-react 在 vendor-antd 之前加载，避免运行时依赖缺失。构建目标设为 `esnext`，不做额外降级，产物更小。未使用 library 模式，不单独拆 React（由子应用自行打包），通过版本对齐保持一致性。

---

**状态管理（4题）**

20. 主子应用之间的全局状态是怎么管理的，用了什么方案（Redux / Zustand / 自定义 EventBus）？

用的 **Zustand**。主应用维护一个单一 store（`useAppStore`），由多个 slice 组成：`subAppSlice`（子应用菜单、国际化、loading）、`commonDataSlice`（产品列表、分类、错误码）、以及 core 部分（service、user、theme、language、loginModal 等）。主应用通过 Garfish 的 `props` 把 `useAppStore` 这个 hook 函数本身传给子应用，子应用调用 `setExternalStore(store)` 接入，内部通过 `useSyncExternalStore` 订阅主应用 store 的变化。之所以用 `useSyncExternalStore` 而非直接调用主应用的 hook，是因为主子应用是不同的 React 实例，不能跨实例调用 hooks。子应用也可以通过 store 的 actions（如 `registerSubAppMenuItems`、`registerSubAppIntlMessages`）向主应用写数据，实现双向通信。

21. 子应用有自己独立的状态管理吗，和主应用的状态如何隔离？

子应用（sandbox、modelverse）各自有一个本地 Zustand store（`localStore`），但在微前端模式下不使用。`useAppStore` 的实现是：如果 `externalStoreHook` 存在（即主应用 store 已注入），就通过 `useSyncExternalStore` 订阅主应用 store；否则回退到本地 `localStore`（独立运行模式）。这样子应用在微前端模式下与主应用共享全局状态（user、theme、service 等），独立运行时用自己的本地 store，两种模式代码一致。子应用特有的业务状态（如表单数据、列表筛选条件等）用组件级的 `useState`/`useReducer` 管理，不放到全局 store。

22. 用户登录态、权限信息这类全局数据，是放在主应用统一管理还是每个子应用自己获取？

**主应用统一管理**。主应用的 `UserInfo` 组件通过 `userService.getUserInfo()` 和 `updateUserInfo()` 获取用户信息，写入 `store.user`（包含 UserId、UserEmail、Admin、AuthState 等）。子应用通过共享的 `useAppStore` 直接读取 `store.user`。登录弹窗也由主应用统一提供：`LoginModalContext` 将 `openLoginModal`/`closeLoginModal` 注册到 store，子应用需要登录时调用 `store.showNeedLoginPage()` 显示登录遮罩，或通过 `store.loginModal.openLoginModal()` 打开登录弹窗。Service 实例同样由主应用初始化后挂到 `window.__MAIN_APP_SERVICE__`，子应用优先使用该实例，避免重复初始化和鉴权。

23. 子应用卸载时，如何确保它注册的全局状态、事件监听被正确清除？

三层清理机制：**reactBridge 层**调用 `root.unmount()` 卸载整个 React 组件树（所有 useEffect 的 cleanup 函数会执行），并删除 `domElements` 和 `renderResults` 引用。**Garfish 生命周期层**在 `beforeUnmount` 中调用 `clearSubAppLoading()`，`afterUnmount` 中移除容器的 `data-sub-app` 属性。**路由变化层**在 `SubAppContainer` 中监听 `pathname` 变化，自动调用 `hideNeedLoginPage()` 取消登录遮罩，避免跨页残留。子应用注册的 `subAppMenuItems` 和 `subAppIntlMessages` 按 basename 键存储在 store 中，卸载时**不删除**——这是有意为之，因为子应用再次激活时可以直接使用缓存的菜单和国际化数据，避免重复注册。

---

**Monorepo & pnpm-workspace（4题）**

24. pnpm-workspace 的 workspace 协议（workspace:*）是怎么用的，和普通版本号有什么区别？

项目中实际**没有使用 `workspace:*` 协议**。`ai-packages/` 是一个 pnpm workspace monorepo，内部包（bridge、entry、service 等）之间以及外部应用（main-app、sandbox、modelverse）依赖 `@ucloud/*` 时，都使用普通版本号（如 `^0.0.5`、`^0.1.34`），从私有 npm registry 拉取已发布的包。`workspace:*` 的作用是让 monorepo 内的包直接链接到本地源码（`node_modules` 里是 symlink 而非下载的 tgz），开发时改了 entry 立刻在 service 中生效，不需要先发版。我们没用是因为 main-app 和子应用不在 `ai-packages` 的 workspace 内，它们作为独立仓库消费已发布的 `@ucloud/*` 包，所以全部走 registry 版本号。

25. Monorepo 下如何管理各包的版本发布，用了 changesets 还是其他工具？

使用 **Changesets**。配置在 `ai-packages/.changeset/config.json`，`access: "restricted"`（私有包）、`baseBranch: "main"`、`updateInternalDependencies: "patch"`。发布流程：1）`pnpm changeset` 交互式选择变更的包和版本类型（patch/minor/major），生成一个 `.md` 变更记录；2）`pnpm run version` 执行 `changeset version`，消费变更记录、更新各包的 `package.json` 版本号和 CHANGELOG；3）`pnpm run release` 依次执行 version → install → build → `pnpm -r publish --no-git-checks` 发布到私有 registry。

26. 私域 npm 如何搭建和配置，子应用如何指定从私域拉包？

私有 npm registry 地址为 `http://registry.npm.pre.ucloudadmin.com`。通过 `.npmrc` 文件配置 scope 级别的 registry 映射：`@ucloud:registry=http://registry.npm.pre.ucloudadmin.com`，其余包走公共 registry（`https://registry.npmjs.org`）。所有项目（main-app、sandbox、modelverse、ai-packages）的 `.npmrc` 中都有这条配置。发布时，各 `@ucloud/*` 包的 `package.json` 中配置 `publishConfig.registry` 指向私有 registry。这样 `pnpm install` 时，遇到 `@ucloud/*` 的依赖自动从私有 registry 拉取，其他包从 npmjs.org 拉取，开发者不需要额外配置。

27. acd-cli 脚手架从模板仓库克隆项目，模板仓库怎么维护，如何做版本管理？

模板仓库托管在内部 GitLab（`git@git.ucloudadmin.com:ai-platform/sub-template.git`）。`acd-cli init` 的流程是：1）交互式询问应用名称、basename、目标目录；2）用 `simple-git` 克隆模板仓库到目标目录；3）删除 `.git` 目录，让用户初始化自己的仓库；4）自动更新 `.config/index.js` 中的 `name` 和 `basename`，以及 `package.json` 中的 `name`。模板仓库的维护方式是直接在 `sub-template` 仓库的 main 分支上迭代，`acd-cli init` 每次克隆的都是最新版本。没有用 tag 或版本号管理模板版本——因为模板需要保持与当前 `@ucloud/ai-entry` 等工具包版本兼容，直接用最新版最简单。如果需要重大变更，可以在模板仓库里用分支隔离。

---

**综合架构（3题）**

28. 整个 AI 平台从零到一，前端架构是你一个人主导设计的吗，团队规模多大，你承担了哪些角色？

前端架构由我一人主导设计和落地，包括技术选型（Next.js + Garfish + Vite）、微前端方案设计、monorepo 工具链搭建（ai-packages、acd-cli）、主应用基座开发、子应用接入规范制定。团队规模较小（2-3 人前端），我承担了前端架构师 + 核心开发的角色：负责基础设施（主应用框架、Garfish 集成、共享组件库、CI/CD 流程），其他成员负责各子应用的业务开发。同时也参与了与后端的 API 规范对齐、部署方案设计（K8s + nginx 代理）等跨职能工作。

29. 微前端落地过程中遇到的最棘手的问题是什么，最后怎么解决的？

最棘手的是 **Garfish + Vite ESM 的兼容性问题**。具体表现有三个层面：1）`@garfish/es-module` 插件会尝试解析 Vite 的虚拟模块路径（`/@react-refresh`、`/@vite/client`），导致 "Cannot use import statement outside a module" 报错——解决方案是禁用 GarfishEsModule 插件，直接依赖 Vite 原生的 `<script type="module">` 加载。2）尝试用 Rollup `external` 共享 React 等依赖时，遇到 "The entry point cannot be marked as external" 错误——改为在 transform 阶段用插件替换 import 语句，但这又导致 `@vitejs/plugin-react` 的 JSX 转换失效，最终放弃依赖共享，改为各自打包 + 版本对齐。3）`manualChunks` 拆分出的多个 vendor chunk 在 Garfish ESM 沙箱下因 blob URL 导致跨 chunk 依赖解析失败——modelverse 最终改为所有 node_modules 合并到一个 vendor chunk。

30. 如果让你重新设计这套架构，有哪些地方会做不一样的选择？

三个方面：1）**依赖共享**——会认真评估 Module Federation 2.0（已支持 Vite），通过运行时依赖共享减少 bundle 体积，而非当前的各自打包方案。即使不用 MF，也会在项目初期就设计好 externals 方案（比如通过 CDN 加载 React/antd），而非中途尝试再放弃。2）**沙箱策略**——不会直接关闭 Garfish 沙箱。关闭沙箱虽然避免了多 React 实例问题，但也失去了 JS/CSS 隔离能力，全局变量污染风险较高。更好的做法是保持沙箱开启，通过 Garfish 的 `externals` 配置共享 React，让主子应用用同一个实例。3）**模板与工具链**——`acd-cli init` 直接克隆 Git 仓库的方式比较粗糙，没有版本管理。会改用类似 `create-xxx-app` 的方式，模板作为 npm 包发布，支持版本选择和 diff 升级。