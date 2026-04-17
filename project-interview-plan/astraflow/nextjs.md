# Next.js 面试问答

本文档针对当前项目中 Next.js 的使用，整理了30个专业面试问题及回答。

---

## 一、App Router 基础篇

### 1. 请介绍这个项目使用的 Next.js 版本和主要特性

**回答：**

本项目使用 **Next.js 16.1.1**，主要特性包括：

**1. App Router**
- 采用新的 `app/` 目录结构
- 支持服务端组件（RSC）和客户端组件
- 嵌套布局（Nested Layouts）

**2. 服务端能力**
- 根布局 `RootLayout` 是异步服务端组件
- 可以直接在服务端获取数据（common-data）
- 支持 `fetch` 的缓存策略（`revalidate: 3600`）

**3. 路由组织**
```
app/
├── layout.tsx           # 根布局
├── page.tsx             # 首页
├── modelverse/          # 子应用路由
│   ├── page.tsx
│   └── [...slug]/page.tsx
├── experience-modelverse/  # 体验中心路由
│   ├── page.tsx
│   └── [...slug]/page.tsx
├── docs/                # 文档路由
│   ├── layout.tsx
│   └── [[...slug]]/page.tsx
└── api/                 # API 路由
    └── manifest/route.ts
```

**4. 与 Nextra 集成**
- 使用 nextra 处理 MDX 文档
- `pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx']`

---

### 2. App Router 中的 layout.tsx 和 page.tsx 有什么区别？

**回答：**

**layout.tsx（布局组件）**

1. **持久性**：布局在导航时保持状态，不会重新渲染
2. **嵌套支持**：子路由会嵌套在父布局中
3. **服务端组件**：默认是服务端组件，可以异步获取数据
4. **共享 UI**：用于放置导航、侧边栏等共享组件

```typescript
// app/layout.tsx
export default async function RootLayout({ children }) {
  // 可以在服务端获取数据
  const enabledSubApps = getEnabledSubApps();

  return (
    <html lang="zh-CN">
      <body>
        <NavigationLayout>
          {children}
        </NavigationLayout>
      </body>
    </html>
  );
}
```

**page.tsx（页面组件）**

1. **路由特定**：每个路由有独立的页面组件
2. **导航时重新渲染**：路由变化时页面组件会重新挂载
3. **可以是客户端或服务端组件**

```typescript
// app/modelverse/[...slug]/page.tsx
'use client';

export default function ModelverseSlugPage() {
  return <SubAppRoutePage />;
}
```

**项目中的应用：**

- `app/layout.tsx`：根布局，负责服务端数据获取、全局脚本注入
- `app/docs/layout.tsx`：文档页面的独立布局
- 各子应用的 `page.tsx`：只是路由占位，实际内容由 Garfish 渲染

---

### 3. 什么是服务端组件（RSC）？项目中如何使用？

**回答：**

**服务端组件概念：**

服务端组件（React Server Components）是在服务器上渲染的 React 组件，特点是：
- 不发送 JavaScript 到客户端
- 可以直接访问服务端资源（文件系统、数据库）
- 不支持交互（没有 useState、onClick 等）

**项目中的使用：**

**1. RootLayout 是服务端组件**

```typescript
// app/layout.tsx - 默认就是服务端组件
export default async function RootLayout({ children }) {
  // 可以直接使用 fs 读取文件
  const enabledSubApps = getEnabledSubApps(); // 内部使用 fs

  // 可以直接发起服务端请求
  const [bothProductsRes, categoryDataRes] = await Promise.all([
    fetch(domainURLMap.productsDataUrl, { next: { revalidate: 3600 } }),
    fetch(domainURLMap.categoryDataUrl, { next: { revalidate: 3600 } }),
  ]);

  return (
    <html>...</html>
  );
}
```

**2. 数据获取策略**

```typescript
// 使用 fetch 的 next 选项控制缓存
fetch(url, { next: { revalidate: 3600 } }); // 每小时重新验证
```

**3. 服务端数据注入客户端**

```typescript
// 通过 script 标签将服务端数据注入客户端
<script
  id="__ENABLED_SUB_APPS__"
  type="application/json"
  dangerouslySetInnerHTML={{ __html: enabledSubAppsJson }}
/>
```

---

### 4. 什么是客户端组件？如何区分服务端组件和客户端组件？

**回答：**

**客户端组件概念：**

客户端组件是在浏览器中渲染的 React 组件，支持：
- 交互（useState、onClick 等）
- 生命周期（useEffect）
- 浏览器 API（window、document）

**区分方式：**

**1. 使用 'use client' 指令**

```typescript
// 有 'use client' 指令 = 客户端组件
'use client';

import { useState, useEffect } from 'react';

export default function SubAppContainer() {
  const [showNotFound, setShowNotFound] = useState(false);

  useEffect(() => {
    // 可以使用浏览器 API
    console.log(window.location);
  }, []);

  return <div>...</div>;
}
```

```typescript
// 没有 'use client' 指令 = 服务端组件
// app/layout.tsx
export default async function RootLayout({ children }) {
  const data = await fetchSomeData(); // 可以使用 async/await
  return <html>...</html>;
}
```

**项目中的划分：**

| 组件 | 类型 | 原因 |
|------|------|------|
| `RootLayout` | 服务端 | 需要获取 common-data |
| `NavigationLayout` | 客户端 | 需要使用 Zustand、useEffect |
| `GarfishProvider` | 客户端 | 需要操作 DOM、初始化 Garfish |
| `SubAppContainer` | 客户端 | 需要监听路由、操作 DOM |
| `SubAppRoutePage` | 客户端 | 作为路由占位 |

---

### 5. Next.js 中的 metadata 是如何配置的？

**回答：**

**静态 metadata 配置：**

```typescript
// app/layout.tsx
export const metadata = {
  title: 'AstraFlow',
  description: 'AstraFlow',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};
```

**动态 metadata（generateMetadata）：**

```typescript
// 动态生成 metadata
export async function generateMetadata({ params }) {
  return {
    title: `产品详情 - ${params.id}`,
    description: '动态描述',
  };
}
```

**项目中的应用：**

- 使用静态 metadata 定义全局标题和图标
- favicon 通过 `app/favicon.ico` 自动加载

**注意事项：**

- metadata 只能在服务端组件中导出
- 客户端组件无法导出 metadata
- 子布局可以覆盖父布局的 metadata

---

## 二、数据获取与缓存篇

### 6. 项目中 RootLayout 是如何获取服务端数据的？

**回答：**

**数据获取流程：**

```typescript
// app/layout.tsx
export default async function RootLayout({ children }) {
  // 1. 从 manifest 获取启用的子应用配置
  const enabledSubApps = getEnabledSubApps();

  // 2. 获取域名配置
  const domainURLMap = getDomainURL();

  // 3. 并行获取 4 份 common-data
  let bothProducts = null;
  let allCategories = null;
  let errorCodeEn = null;
  let errorCodeZh = null;

  try {
    const [bothProductsRes, categoryDataRes, errorCodeEnRes, errorCodeZhRes] =
      await Promise.all([
        fetch(domainURLMap.productsDataUrl, { next: { revalidate: 3600 } }),
        fetch(domainURLMap.categoryDataUrl, { next: { revalidate: 3600 } }),
        fetch(domainURLMap.errorCodeEnUrl, { next: { revalidate: 3600 } }),
        fetch(domainURLMap.errorCodeZhUrl, { next: { revalidate: 3600 } }),
      ]);
    // ... 处理响应
  } catch (error) {
    console.error('[Layout] Error fetching common-data:', error);
  }

  // 4. 降级处理，确保不向子组件传递 null
  const safeBothProducts = bothProducts ?? {};
  const safeAllCategories = allCategories ?? {};

  return <NavigationLayout bothProducts={safeBothProducts} ... />;
}
```

**关键设计：**

1. **并行请求**：使用 `Promise.all` 并行获取多份数据
2. **缓存策略**：`revalidate: 3600` 每小时重新验证
3. **错误降级**：请求失败时使用空对象 `{}`，保证首屏可渲染
4. **服务端执行**：在服务端完成数据获取，减少客户端负担

---

### 7. Next.js 中的 fetch 缓存策略有哪些？项目中如何使用？

**回答：**

**Next.js 扩展的 fetch 选项：**

| 选项 | 说明 |
|------|------|
| `cache: 'no-store'` | 不缓存，每次请求都重新获取 |
| `cache: 'force-cache'` | 强制缓存，直到手动重新验证 |
| `next: { revalidate: 3600 }` | ISR，按时间间隔重新验证 |
| `next: { tags: ['tag'] }` | 按标签重新验证 |

**项目中的使用：**

```typescript
// app/layout.tsx
// 使用 ISR 策略，每小时重新验证
fetch(domainURLMap.productsDataUrl, { next: { revalidate: 3600 } })
```

**为什么选择 ISR：**

1. **性能**：数据被缓存，减少重复请求
2. **时效性**：每小时更新一次，数据不会太旧
3. **可靠性**：即使源服务不可用，也能返回缓存数据

**其他场景：**

```typescript
// API 路由不使用缓存
// app/api/manifest/route.ts
export async function GET() {
  const config = getManifestConfig();
  return NextResponse.json(config);
}
```

---

### 8. 服务端获取的数据如何传递给客户端组件？

**回答：**

**方式一：通过 Props 传递**

```typescript
// 服务端组件（layout.tsx）
export default async function RootLayout({ children }) {
  const bothProducts = await fetch(...);

  return (
    <NavigationLayout bothProducts={bothProducts}>
      {children}
    </NavigationLayout>
  );
}

// 客户端组件（NavigationLayout.tsx）
'use client';

export default function NavigationLayout({ bothProducts }) {
  // 接收服务端传递的数据
  useEffect(() => {
    useAppStore.getState().setProducts(bothProducts);
  }, [bothProducts]);
}
```

**方式二：通过 Script 标签注入**

```typescript
// layout.tsx
const enabledSubAppsJson = JSON.stringify(enabledSubApps);

return (
  <html>
    <head>
      <script
        id="__ENABLED_SUB_APPS__"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: enabledSubAppsJson }}
      />
      <script dangerouslySetInnerHTML={{
        __html: `
          const data = document.getElementById('__ENABLED_SUB_APPS__');
          window.__ENABLED_SUB_APPS__ = JSON.parse(data.textContent);
        `
      }} />
    </head>
  </html>
);
```

**项目中的选择：**

- **Props 传递**：用于传递 common-data 等大型数据
- **Script 注入**：用于传递 enabledSubApps 等配置数据，客户端可立即使用

---

### 9. 什么是 FOUC？项目中如何防止？

**回答：**

**FOUC（Flash of Unstyled Content）：**

页面在样式加载完成前短暂显示无样式内容的现象。

**项目中的解决方案：**

**1. 内联关键样式**

```typescript
// layout.tsx
<head>
  <style dangerouslySetInnerHTML={{
    __html: `
      /* 在样式加载前隐藏内容 */
      html:not(.styles-loaded) body {
        opacity: 0;
        visibility: hidden;
      }
      html.styles-loaded body {
        opacity: 1;
        visibility: visible;
        transition: opacity 0.15s ease-in;
      }
    `
  }} />
</head>
```

**2. 样式检测脚本**

```typescript
// 检测 Ant Design 样式是否注入
function checkAntdStyles() {
  const styles = Array.from(document.querySelectorAll('style'));
  return styles.some(style => {
    const text = style.textContent || '';
    return text.includes('ant-') || text.includes('antd');
  });
}

// 检测 Tailwind 是否生效
function checkTailwindStyles() {
  const el = document.createElement('div');
  el.className = 'hidden';
  document.body.appendChild(el);
  const display = window.getComputedStyle(el).display;
  document.body.removeChild(el);
  return display === 'none';
}

// 等待样式加载完成
function waitForStyles() {
  const checkInterval = setInterval(() => {
    if (hasReactRendered && hasAntdStyles && hasTailwindStyles) {
      clearInterval(checkInterval);
      document.documentElement.classList.add('styles-loaded');
    }
  }, 50);
}
```

**原理：**

1. 页面初始时 `opacity: 0` 隐藏内容
2. 检测 Ant Design 和 Tailwind 样式是否就绪
3. 样式就绪后添加 `styles-loaded` 类，显示内容

---

### 10. Layout 中的数据请求失败时如何处理？

**回答：**

**项目中的降级策略：**

```typescript
// app/layout.tsx
let bothProducts = null;
let allCategories = null;

try {
  const [bothProductsRes, categoryDataRes] = await Promise.all([
    fetch(domainURLMap.productsDataUrl, { next: { revalidate: 3600 } }),
    fetch(domainURLMap.categoryDataUrl, { next: { revalidate: 3600 } }),
  ]);

  if (bothProductsRes.ok) {
    bothProducts = await bothProductsRes.json();
  } else {
    console.error('[Layout] Failed to fetch bothProducts:', bothProductsRes.status);
    bothProducts = {}; // 降级为空对象
  }

  if (categoryDataRes.ok) {
    allCategories = await categoryDataRes.json();
  } else {
    console.error('[Layout] Failed to fetch categoryData:', categoryDataRes.status);
    allCategories = {}; // 降级为空对象
  }
} catch (error) {
  console.error('[Layout] Error fetching common-data:', error);
}

// 最终降级：确保不向子组件传递 null
const safeBothProducts = bothProducts ?? {};
const safeAllCategories = allCategories ?? {};
```

**设计要点：**

1. **单请求失败不影响其他**：每个请求独立处理
2. **空对象降级**：失败时返回 `{}`，而非 null
3. **双重保险**：`?? {}` 确保最终值不为 null
4. **错误日志**：记录失败信息便于排查
5. **首屏可渲染**：降级后页面仍可正常显示

---

## 三、路由与导航篇

### 11. 项目中的路由结构是如何设计的？

**回答：**

**路由结构：**

```
app/
├── page.tsx                    # 首页 /
├── layout.tsx                  # 根布局
├── modelverse/
│   ├── page.tsx               # /modelverse
│   └── [...slug]/page.tsx     # /modelverse/*
├── sandbox/
│   ├── page.tsx               # /sandbox
│   └── [...slug]/page.tsx     # /sandbox/*
├── experience-modelverse/
│   ├── page.tsx               # /experience-modelverse（重定向）
│   └── [...slug]/page.tsx     # /experience-modelverse/*
├── docs/
│   ├── layout.tsx             # 文档布局
│   └── [[...slug]]/page.tsx   # /docs/*（可选参数）
├── standard/
│   └── page.tsx               # /standard
└── api/
    └── manifest/route.ts      # /api/manifest
```

**路由设计要点：**

1. **子应用路由**：使用 `[...slug]` 捕获所有子路径
2. **体验中心**：独立路由，与主子应用分离
3. **文档路由**：使用 `[[...slug]]` 可选参数，支持 `/docs` 根路径
4. **API 路由**：放在 `app/api/` 目录下

**动态参数：**

- `[slug]`：必需参数
- `[...slug]`：捕获所有后续路径（必需）
- `[[...slug]]`：捕获所有后续路径（可选）

---

### 12. 动态路由 [...slug] 是如何工作的？

**回答：**

**捕获所有路由（Catch-all Routes）：**

```typescript
// app/modelverse/[...slug]/page.tsx
'use client';

export const dynamicParams = true;

export default function ModelverseSlugPage() {
  return <SubAppRoutePage />;
}
```

**路由匹配示例：**

| 路径 | 匹配的文件 | slug 参数 |
|------|-----------|-----------|
| `/modelverse` | `modelverse/page.tsx` | - |
| `/modelverse/about` | `modelverse/[...slug]/page.tsx` | `['about']` |
| `/modelverse/user/123` | `modelverse/[...slug]/page.tsx` | `['user', '123']` |

**dynamicParams 配置：**

```typescript
export const dynamicParams = true; // 允许动态参数（默认值）
```

**项目中的应用：**

- 子应用使用 `[...slug]` 捕获所有子路由
- 实际路由处理交给 Garfish 和子应用的 React Router
- Next.js 只负责提供路由占位

---

### 13. 体验中心的重定向是如何实现的？

**回答：**

**实现方式：**

```typescript
// app/experience-modelverse/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const dynamicParams = true;

export default function ExperienceModelverseRoot() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/experience-modelverse/text-model');
  }, [router]);

  return <></>;
}
```

**设计要点：**

1. **客户端重定向**：使用 `useRouter().replace()`
2. **replace 而非 push**：不保留当前页面历史
3. **useEffect 确保客户端执行**：避免 SSR 错误
4. **空组件返回**：重定向前不渲染任何内容

**为什么用客户端重定向：**

- 服务端重定向需要使用 `redirect()` 函数
- 客户端重定向更灵活，可以根据状态决定目标
- 体验中心可能有动态的首屏路径

---

### 14. 项目中的 API 路由是如何实现的？

**回答：**

**API 路由结构：**

```
app/api/
└── manifest/
    └── route.ts    # /api/manifest
```

**实现代码：**

```typescript
// app/api/manifest/route.ts
import { NextResponse } from 'next/server';
import { getManifestConfig } from '../../utils/manifest';

export async function GET() {
  try {
    const config = getManifestConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('获取 manifest 配置失败:', error);
    return NextResponse.json(
      { error: '获取 manifest 配置失败' },
      { status: 500 }
    );
  }
}
```

**使用场景：**

```typescript
// 客户端组件中调用
useEffect(() => {
  fetch('/api/manifest')
    .then(res => res.json())
    .then((data) => {
      const enabledApps = data.subApps.filter(app => app.enabled);
      useAppStore.getState().setEnabledSubApps(enabledApps);
    })
    .catch(error => {
      console.error('获取 manifest 配置失败:', error);
    });
}, []);
```

**API 路由特点：**

1. **文件即路由**：`app/api/manifest/route.ts` → `/api/manifest`
2. **支持 HTTP 方法**：GET、POST、PUT、DELETE 等
3. **返回 Response**：使用 `NextResponse.json()` 或标准 Response
4. **服务端执行**：可以访问服务端资源

---

### 15. next/navigation 和 next/router 有什么区别？

**回答：**

**next/navigation（App Router）：**

```typescript
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

function Component() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClick = () => {
    router.push('/about');      // 导航
    router.replace('/about');   // 替换
    router.back();              // 返回
    router.refresh();           // 刷新当前路由
  };
}
```

**next/router（Pages Router，已弃用）：**

```typescript
// 只在 pages/ 目录中使用
import { useRouter } from 'next/router';

function Component() {
  const router = useRouter();
  const { query } = router; // 动态路由参数
}
```

**项目中的使用：**

```typescript
// SubAppContainer.tsx
import { usePathname } from 'next/navigation';

export default function SubAppContainer() {
  const pathname = usePathname(); // 获取当前路径

  useEffect(() => {
    // 监听路由变化
  }, [pathname]);
}

// experience-modelverse/page.tsx
import { useRouter } from 'next/navigation';

export default function ExperienceModelverseRoot() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/experience-modelverse/text-model');
  }, [router]);
}
```

**主要区别：**

| 特性 | next/navigation | next/router |
|------|----------------|-------------|
| 适用范围 | App Router | Pages Router |
| usePathname | ✓ | ✗（用 router.pathname） |
| useSearchParams | ✓ | ✗（用 router.query） |
| router.refresh() | ✓ | ✗ |

---

## 四、配置与优化篇

### 16. next.config.js 中有哪些关键配置？

**回答：**

**项目配置解析：**

```javascript
const nextConfig = {
  // 1. 启用 React 严格模式
  reactStrictMode: true,

  // 2. 环境变量注入
  env: {
    NEXT_PUBLIC_MANIFEST_ENV: process.env.MANIFEST_ENV || '',
  },

  // 3. 页面扩展名（支持 MDX）
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],

  // 4. 开发环境性能优化
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // 5. CORS 配置（微前端需要）
  async headers() {
    return [{
      source: '/:path*',
      headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
    }];
  },

  // 6. 开发环境 rewrites（Source Map 代理）
  async rewrites() {
    return enabledSubApps.map((app) => ({
      source: '/:path*.map',
      destination: `http://127.0.0.1:${app.port}/:path*.map`,
    }));
  },

  // 7. 实验性配置
  experimental: {
    optimizePackageImports: ['antd'],
  },

  // 8. 转译本地包
  transpilePackages: ['@ucloud/ai-service'],
};

// 9. Nextra 集成
module.exports = async () => {
  const nextra = (await import('nextra')).default;
  return nextra({ defaultShowCopyCode: true })(nextConfig);
};
```

---

### 17. 为什么需要 transpilePackages 配置？

**回答：**

**问题背景：**

Next.js 默认不会转译 `node_modules` 中的包。如果某个包使用了最新的 JavaScript 语法或未编译的 TypeScript，可能会导致兼容性问题。

**项目中的使用：**

```javascript
// next.config.js
transpilePackages: ['@ucloud/ai-service'],
```

**为什么需要：**

1. **本地包未编译**：`@ucloud/ai-service` 可能包含未编译的源码
2. **模块格式问题**：某些包使用 ESM，需要转换
3. **依赖解析**：确保本地包的依赖能正确解析

**其他常见场景：**

```javascript
transpilePackages: [
  '@ucloud/ai-service',
  '@ucloud/ai-entry',
  '@ucloud/ai-design-tokens',
  'some-esm-only-package',
],
```

**与 optimizePackageImports 的区别：**

- `transpilePackages`：转译包的源码
- `optimizePackageImports`：优化包的导入（tree-shaking）

---

### 18. optimizePackageImports 配置有什么作用？

**回答：**

**作用：**

优化大型包的导入，减少打包体积和提升冷启动速度。

**项目中的使用：**

```javascript
// next.config.js
experimental: {
  optimizePackageImports: ['antd'],
}
```

**工作原理：**

```typescript
// 优化前：导入整个 antd
import { Button, Input, Select } from 'antd';
// Next.js 可能会分析整个 antd 包

// 优化后：自动转换为具名导入
import Button from 'antd/es/button';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
// 只分析实际使用的组件
```

**为什么对 antd 特别重要：**

1. **体积大**：antd 有数百个组件
2. **按需导入**：用户通常只用少数组件
3. **构建速度**：减少分析的代码量

**支持的包：**

- antd
- @mui/material
- lodash
- 其他大型 UI 库

---

### 19. 项目中如何处理多环境配置？

**回答：**

**环境配置策略：**

**1. 环境变量**

```javascript
// next.config.js
env: {
  NEXT_PUBLIC_MANIFEST_ENV: process.env.MANIFEST_ENV || '',
},
```

**2. 多环境 Manifest 文件**

```
app/
├── manifest.json           # 开发环境
├── manifest.test03.json    # test03 环境
└── manifest.production.json # 生产环境
```

**3. 环境判断逻辑**

```typescript
// app/utils/manifest.ts
const manifestEnv = process.env.MANIFEST_ENV || 'local';
const isProduction = process.env.NODE_ENV === 'production';

let possiblePaths: string[];
if (manifestEnv === 'test03') {
  possiblePaths = [path.join(process.cwd(), 'app', 'manifest.test03.json')];
} else if (isProduction) {
  possiblePaths = [path.join(process.cwd(), 'app', 'manifest.production.json')];
} else {
  possiblePaths = [path.join(process.cwd(), 'app', 'manifest.json')];
}
```

**4. 多环境域名配置**

```typescript
// utils/config.ts
export const domainURLMap = {
  'astraflow.ucloud.cn': { /* 国内生产 */ },
  'astraflow.ucloud-global.com': { /* 海外 */ },
  'astraflow.scloudsg.com': { /* SCloud */ },
  'astraflow-test03.ucloudadmin.com': { /* 测试环境 */ },
};

export const getDomainURL = () => {
  const manifestEnv = process.env.MANIFEST_ENV;
  switch (manifestEnv) {
    case 'test03': return domainURLMap['astraflow-test03.ucloudadmin.com'];
    case 'sgProd': return domainURLMap['astraflow.scloudsg.com'];
    default: return domainURLMap['astraflow.ucloud.cn'];
  }
};
```

**5. 启动脚本**

```json
// package.json
{
  "scripts": {
    "dev": "MANIFEST_ENV=prod next dev",
    "devtest": "MANIFEST_ENV=test03 next dev",
    "devSg": "MANIFEST_ENV=sgProd next dev",
    "build": "MANIFEST_ENV=prod next build",
    "buildtest": "MANIFEST_ENV=test03 next build"
  }
}
```

---

### 20. 开发环境中的 rewrites 配置有什么作用？

**回答：**

**问题背景：**

微前端架构下，子应用在开发环境独立运行在不同端口。主应用需要访问子应用的 Source Map 进行调试。

**配置实现：**

```javascript
// next.config.js
...(process.env.NODE_ENV === 'development' && {
  async rewrites() {
    const manifest = JSON.parse(fs.readFileSync('app/manifest.json'));
    const enabledSubApps = manifest.subApps.filter(app => app.enabled);

    return enabledSubApps.map((app) => ({
      source: '/:path*.map',
      destination: `http://127.0.0.1:${app.port}/:path*.map`,
    }));
  },
})
```

**工作原理：**

```
请求：http://localhost:3000/assets/index.js.map
代理：http://127.0.0.1:8083/assets/index.js.map
     （子应用 Vite 开发服务器）
```

**为什么需要：**

1. **跨域问题**：主应用和子应用不同源
2. **Source Map 调试**：需要在浏览器中加载源码映射
3. **开发体验**：统一入口，无需配置 CORS

**生产环境不需要：**

- 生产环境使用 Nginx 代理
- Source Map 通常不上传到生产

---

## 五、服务端渲染篇

### 21. 服务端组件和客户端组件如何组合使用？

**回答：**

**组合模式：**

```
服务端组件（RootLayout）
    │
    ├── 可以渲染服务端组件
    │
    └── 可以渲染客户端组件（通过 props 传递数据）
            │
            ├── 可以使用 useState、useEffect 等
            │
            └── 不可以渲染服务端组件
                    │
                    └── 但可以导入服务端组件（作为 children）
```

**项目中的实践：**

```typescript
// 服务端组件：app/layout.tsx
export default async function RootLayout({ children }) {
  // 服务端数据获取
  const bothProducts = await fetch(...);

  return (
    <html>
      <body>
        {/* 客户端组件，通过 props 传递数据 */}
        <NavigationLayout bothProducts={bothProducts}>
          {/* children 可能是服务端或客户端组件 */}
          {children}
        </NavigationLayout>
      </body>
    </html>
  );
}

// 客户端组件：components/NavigationLayout.tsx
'use client';

export default function NavigationLayout({ bothProducts, children }) {
  // 客户端逻辑
  useEffect(() => {
    useAppStore.getState().setProducts(bothProducts);
  }, [bothProducts]);

  return (
    <Layout>
      <Navigation />
      {children} {/* 接收父组件传递的 children */}
    </Layout>
  );
}
```

**关键规则：**

1. 服务端组件可以导入并渲染客户端组件
2. 客户端组件不能直接导入服务端组件
3. 客户端组件可以通过 `children` prop 接收服务端组件
4. 数据通过 props 从服务端流向客户端

---

### 22. 项目中为什么选择在 Layout 中获取数据而不是 Page 中？

**回答：**

**选择 Layout 的原因：**

**1. 数据共享**

```typescript
// Layout 获取的数据可供所有子路由使用
// app/layout.tsx
export default async function RootLayout({ children }) {
  const commonData = await fetchCommonData();

  return (
    <NavigationLayout commonData={commonData}>
      {children}  {/* 所有页面都能访问 commonData */}
    </NavigationLayout>
  );
}
```

**2. 避免重复请求**

- Layout 在导航时保持不变，数据只获取一次
- Page 每次导航都会重新渲染，会导致重复请求

**3. 首屏性能**

- Layout 数据在服务端获取，首屏直接渲染
- 减少客户端请求数量

**4. common-data 的特点**

```typescript
// common-data 是全局共享数据
// - bothProducts：产品列表
// - categories：分类信息
// - errorCode：错误码映射
// 这些数据在所有页面都需要，适合在 Layout 获取
```

**什么时候应该在 Page 获取数据：**

- 页面特定的数据（如文章详情）
- 需要根据路由参数动态获取的数据
- 不需要在页面间共享的数据

---

### 23. 什么是 Streaming SSR？项目中是否使用了？

**回答：**

**Streaming SSR 概念：**

流式服务端渲染，将页面分块逐步发送到客户端，而不是等待所有数据加载完成后再发送。

**Next.js 中的实现：**

```typescript
// 使用 Suspense 实现流式渲染
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <h1>标题（立即显示）</h1>
      <Suspense fallback={<Loading />}>
        <SlowComponent /> {/* 数据加载中时显示 Loading */}
      </Suspense>
    </div>
  );
}
```

**项目中的情况：**

当前项目主要使用 **Layout 级别的数据获取**，没有大量使用 Suspense：

```typescript
// 当前方式：等待所有数据加载完成
export default async function RootLayout({ children }) {
  const [data1, data2, data3, data4] = await Promise.all([...]);

  return <NavigationLayout ...>{children}</NavigationLayout>;
}
```

**如果要使用 Streaming：**

```typescript
// 改进方案：使用 Suspense
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {/* 立即显示导航 */}
        <NavigationLayout>
          {/* 首页内容 */}
          {children}
          {/* 异步加载 common-data */}
          <Suspense fallback={null}>
            <CommonDataLoader />
          </Suspense>
        </NavigationLayout>
      </body>
    </html>
  );
}
```

**是否需要：**

- 当前 common-data 加载较快，不需要 Streaming
- 如果未来有慢数据接口，可以考虑使用

---

### 24. 项目中如何处理 SSR 和 CSR 的差异？

**回答：**

**主要差异点：**

**1. 环境检测**

```typescript
// 判断是否在服务端
if (typeof window === 'undefined') {
  // 服务端代码
} else {
  // 客户端代码
}
```

**2. 动态导入避免 SSR 错误**

```typescript
// GarfishProvider.tsx
useEffect(() => {
  if (typeof window === 'undefined') {
    return; // 服务端不执行
  }

  // 动态导入 Garfish
  import('garfish').then((GarfishModule) => {
    // 初始化 Garfish
  });
}, []);
```

**3. 客户端组件标记**

```typescript
'use client'; // 明确标记为客户端组件

export default function ClientComponent() {
  const [state, setState] = useState(); // 客户端 API
  useEffect(() => {
    // 客户端生命周期
  }, []);
}
```

**4. 服务端数据注入客户端**

```typescript
// layout.tsx
const enabledSubAppsJson = JSON.stringify(enabledSubApps);

return (
  <head>
    <script
      id="__ENABLED_SUB_APPS__"
      type="application/json"
      dangerouslySetInnerHTML={{ __html: enabledSubAppsJson }}
    />
  </head>
);

// 客户端读取
const data = JSON.parse(
  document.getElementById('__ENABLED_SUB_APPS__').textContent
);
```

**5. 状态初始化**

```typescript
// 客户端组件的初始化放在 useEffect 中
useEffect(() => {
  initializeAppStore(); // 客户端执行
}, []);
```

---

### 25. 什么是 hydration？项目中如何处理 hydration 问题？

**回答：**

**Hydration 概念：**

Hydration 是 React 在客户端"激活"服务端渲染的 HTML 的过程，使其能够响应交互。

**常见 Hydration 问题：**

**1. 内容不匹配**

```typescript
// 错误示例：服务端和客户端渲染不同内容
function Component() {
  return <div>{Date.now()}</div>; // 每次渲染都不同
}
```

**2. 浏览器扩展修改 DOM**

```typescript
// 浏览器扩展可能修改 HTML，导致 hydration 错误
```

**项目中的处理方式：**

**1. 使用 useEffect 处理客户端逻辑**

```typescript
// 正确做法
function Component() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // 客户端才执行
  }, []);

  if (!mounted) {
    return <div>Loading...</div>; // 服务端渲染
  }

  return <div>{Date.now()}</div>; // 客户端渲染
}
```

**2. 数据从服务端流向客户端**

```typescript
// 服务端获取数据，通过 props 传递
// 客户端接收相同数据，保证内容一致
<NavigationLayout bothProducts={bothProducts}>
```

**3. 避免 FOUC 导致的闪烁**

```typescript
// 使用 styles-loaded 类控制显示时机
html:not(.styles-loaded) body {
  opacity: 0;
}
```

**4. suppressHydrationWarning**

```typescript
// 对于确实需要不同内容的元素
<div suppressHydrationWarning>
  {new Date().toLocaleTimeString()}
</div>
```

---

## 六、微前端集成篇

### 26. Next.js 与 Garfish 微前端是如何集成的？

**回答：**

**集成架构：**

```
Next.js 主应用
    │
    ├── app/layout.tsx（服务端组件）
    │   └── 获取 enabledSubApps，注入到客户端
    │
    └── components/
        ├── GarfishProvider.tsx（客户端组件）
        │   └── 初始化 Garfish，注册子应用
        │
        └── SubAppContainer.tsx（客户端组件）
            └── 提供 #sub-app-container 容器
```

**关键步骤：**

**1. 服务端注入配置**

```typescript
// app/layout.tsx
const enabledSubApps = getEnabledSubApps();
const enabledSubAppsJson = JSON.stringify(enabledSubApps);

return (
  <head>
    <script
      id="__ENABLED_SUB_APPS__"
      type="application/json"
      dangerouslySetInnerHTML={{ __html: enabledSubAppsJson }}
    />
  </head>
);
```

**2. 客户端初始化 Garfish**

```typescript
// components/GarfishProvider.tsx
useEffect(() => {
  // 从全局变量读取配置
  const enabledSubApps = window.__ENABLED_SUB_APPS__;

  // 动态导入 Garfish
  import('garfish').then((GarfishModule) => {
    Garfish.run({
      apps: enabledSubApps.map(subApp => ({
        name: subApp.name,
        entry: `${subApp.entry}/index.html`,
        sandbox: false,
        activeWhen: (location) => location.pathname.startsWith(subApp.basename),
        props: { store: storeRef.current },
      })),
    });
  });
}, []);
```

**3. 子应用容器**

```typescript
// components/SubAppContainer.tsx
export default function SubAppContainer() {
  return (
    <div id="sub-app-container" data-sub-app-container="true">
      {/* Garfish 会在这里挂载子应用 */}
    </div>
  );
}
```

---

### 27. 子应用路由页面为什么要设计成空组件？

**回答：**

**设计原因：**

**1. 路由占位**

```typescript
// app/modelverse/[...slug]/page.tsx
'use client';

export default function ModelverseSlugPage() {
  return <></>; // 空组件
}
```

Next.js 需要页面文件来匹配路由，但实际内容由 Garfish 渲染。

**2. 避免双重渲染**

- Next.js 渲染页面组件
- Garfish 在 `#sub-app-container` 中渲染子应用
- 如果页面组件有内容，会造成视觉混乱

**3. 统一管理**

```typescript
// 所有子应用路由页面复用同一个占位组件
export default function SubAppRoutePage() {
  return <></>;
}
```

**4. 保持 Next.js 路由能力**

```
/modelverse/about
    │
    ├── Next.js 匹配到 modelverse/[...slug]/page.tsx
    │
    └── Garfish 根据 /modelverse/about 渲染子应用对应页面
```

**流程说明：**

1. Next.js 路由匹配到 `modelverse/[...slug]/page.tsx`
2. 页面组件渲染空内容
3. Garfish 检测到路径变化，激活 modelverse 子应用
4. 子应用内部的 React Router 渲染 `/about` 页面

---

### 28. 项目中如何处理子应用加载状态？

**回答：**

**加载状态管理：**

**1. Zustand Store 状态**

```typescript
// store/useAppStore.ts
interface SubAppLoading {
  appName: string | null;
  loadingStartTime: number | null;
  mountStartTime: number | null;
  loadDuration: number | null;
  mountDuration: number | null;
  totalDuration: number | null;
}
```

**2. Garfish 生命周期钩子**

```typescript
// GarfishProvider.tsx
beforeMount: (appInfo) => {
  state.setSubAppLoading({
    appName: appInfo.name,
    loadingStartTime: performance.now(),
    ...
  });
},

afterMount: (appInfo) => {
  const mountDuration = performance.now() - mountStartTime;
  state.setSubAppLoading({ mountDuration, ... });
  setTimeout(() => state.clearSubAppLoading(), 300);
},
```

**3. 骨架屏展示**

```typescript
// SubAppContainer.tsx
const isLoading = subAppLoading.appName !== null;

return (
  <div id="sub-app-container">
    {isLoading && (
      <div className="sub-app-skeleton-overlay">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )}
  </div>
);
```

**4. 子应用内路由切换**

```typescript
// 监听路由变化，子应用内切换也显示加载态
useEffect(() => {
  if (pathnameChanged && sameSubApp) {
    setIsInternalRouteLoading(true);
    setTimeout(() => setIsInternalRouteLoading(false), 500);
  }
}, [pathname]);
```

---

### 29. Nextra 文档系统是如何集成的？

**回答：**

**Nextra 配置：**

```javascript
// next.config.js
module.exports = async () => {
  const nextra = (await import('nextra')).default;

  return nextra({
    defaultShowCopyCode: true,
    staticImage: true,
    latex: false,
  })(nextConfig);
};
```

**文档路由结构：**

```
app/docs/
├── layout.tsx              # 文档布局
└── [[...slug]]/page.tsx    # 文档页面（可选参数）
```

**文档布局：**

```typescript
// app/docs/layout.tsx
import DocsLayout from '@/components/docs/DocsLayout';

export default function Layout({ children }) {
  return <DocsLayout>{children}</DocsLayout>;
}
```

**页面扩展名配置：**

```javascript
// next.config.js
pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
```

这允许 `.md` 和 `.mdx` 文件作为页面。

**Nextra 特性：**

1. **MDX 支持**：在 Markdown 中使用 React 组件
2. **代码高亮**：自动语法高亮
3. **静态图片**：优化图片加载
4. **目录生成**：自动生成侧边栏目录

---

### 30. 项目中 Next.js 的最佳实践有哪些？

**回答：**

**1. 数据获取**

- ✅ 在 Layout 中获取共享数据
- ✅ 使用 `Promise.all` 并行请求
- ✅ 设置合理的缓存策略（`revalidate`）
- ✅ 请求失败时使用降级数据

**2. 组件划分**

- ✅ 默认使用服务端组件
- ✅ 只在需要交互时使用客户端组件
- ✅ 客户端组件使用 `'use client'` 明确标记

**3. 性能优化**

- ✅ 使用 `optimizePackageImports` 优化大型包
- ✅ 使用 `transpilePackages` 处理未编译的包
- ✅ 非首屏组件使用 `dynamic` 懒加载

```typescript
const ProductMenuDrawer = dynamic(
  () => import('./ProductMenuDrawer'),
  { ssr: false }
);
```

**4. 路由设计**

- ✅ 使用 `[...slug]` 捕获动态路由
- ✅ 子布局用于特定路由组
- ✅ API 路由用于客户端数据获取

**5. 环境配置**

- ✅ 使用环境变量区分环境
- ✅ 敏感配置不暴露到客户端
- ✅ 多环境配置文件分离

**6. 错误处理**

- ✅ 使用 Error Boundary 隔离错误
- ✅ 数据获取失败时降级处理
- ✅ 记录错误日志便于排查

**7. 类型安全**

- ✅ 使用 TypeScript
- ✅ 为 API 响应定义类型
- ✅ 避免使用 `any`

**8. 避免 FOUC**

- ✅ 内联关键样式
- ✅ 检测样式加载完成再显示内容

---

**文档版本**：1.0.0
**最后更新**：2024年
