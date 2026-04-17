# JavaScript 面试问答

本文档针对当前项目中 JavaScript 的使用，整理了30个专业面试问题及回答。

---

## 一、异步编程篇

### 1. 项目中如何处理异步操作？有哪些模式？

**回答：**

**1. async/await 模式**

```typescript
// app/layout.tsx - 服务端异步数据获取
export default async function RootLayout({ children }) {
  try {
    const [bothProductsRes, categoryDataRes, errorCodeEnRes, errorCodeZhRes] =
      await Promise.all([
        fetch(domainURLMap.productsDataUrl, { next: { revalidate: 3600 } }),
        fetch(domainURLMap.categoryDataUrl, { next: { revalidate: 3600 } }),
        // ...
      ]);

    if (bothProductsRes.ok) {
      bothProducts = await bothProductsRes.json();
    }
  } catch (error) {
    console.error('[Layout] Error fetching common-data:', error);
  }
}
```

**2. 动态导入（Dynamic Import）**

```typescript
// utils/service.ts
export async function initializeService(mergedMessages, domainURL) {
  // 动态导入，避免 SSR 时访问 window
  const { initService } = await import('@ucloud/ai-service');

  serviceInstance = await initService({
    // ...
  });

  return serviceInstance;
}
```

**3. Promise 链式调用**

```typescript
// components/SubAppContainer.tsx
fetch('/api/manifest')
  .then(res => res.json())
  .then((data) => {
    const enabledApps = data.subApps.filter(app => app.enabled);
    useAppStore.getState().setEnabledSubApps(enabledApps);
  })
  .catch(error => {
    console.error('获取 manifest 配置失败:', error);
  });
```

**4. Promise.all 并行请求**

```typescript
// 并行获取多份数据
const [bothProductsRes, categoryDataRes] = await Promise.all([
  fetch(url1),
  fetch(url2),
]);
```

---

### 2. 动态导入（Dynamic Import）在项目中有什么应用？

**回答：**

**1. 避免 SSR 错误**

```typescript
// utils/service.ts
// @ucloud/ai-service 在模块加载时会访问 window
// 使用动态导入延迟到客户端执行
export async function initializeService() {
  if (typeof window === 'undefined') {
    return null;  // 服务端不执行
  }

  const { initService } = await import('@ucloud/ai-service');
  // ...
}
```

**2. 按需加载 Garfish**

```typescript
// components/GarfishProvider.tsx
useEffect(() => {
  // Garfish 只在客户端运行
  import('garfish').then((GarfishModule) => {
    const Garfish = GarfishModule.default || GarfishModule;
    Garfish.run({ /* config */ });
  });
}, []);
```

**3. 条件加载**

```typescript
// 根据环境条件加载不同模块
if (process.env.NODE_ENV === 'development') {
  const { devTools } = await import('./devTools');
  devTools.init();
}
```

**优势：**

1. **减少首屏体积**：非关键代码延迟加载
2. **避免 SSR 错误**：客户端特有的代码不在服务端执行
3. **按需加载**：用户交互时才加载

---

### 3. 项目中的错误处理策略有哪些？

**回答：**

**1. try-catch 捕获**

```typescript
// app/layout.tsx
try {
  const [bothProductsRes, categoryDataRes] = await Promise.all([...]);

  if (bothProductsRes.ok) {
    bothProducts = await bothProductsRes.json();
  } else {
    console.error('[Layout] Failed to fetch bothProducts:', bothProductsRes.status);
    bothProducts = {};  // 降级处理
  }
} catch (error) {
  console.error('[Layout] Error fetching common-data:', error);
}
```

**2. 降级处理**

```typescript
// 最终降级：确保不向子组件传递 null
const safeBothProducts = bothProducts ?? {};
const safeAllCategories = allCategories ?? {};
```

**3. Promise catch**

```typescript
// components/SubAppContainer.tsx
fetch('/api/manifest')
  .then(res => res.json())
  .then((data) => { /* ... */ })
  .catch(error => {
    console.error('获取 manifest 配置失败:', error);
    // 尝试从全局变量读取（由 layout.tsx 注入）
    const globalEnabledSubApps = window.__ENABLED_SUB_APPS__;
    if (globalEnabledSubApps) {
      useAppStore.getState().setEnabledSubApps(globalEnabledSubApps);
    }
  });
```

**4. 错误边界**

```typescript
// 用 Error Boundary 包裹子应用
<SubAppErrorBoundary>
  <SubAppContainer />
</SubAppErrorBoundary>
```

**5. Garfish 生命周期错误处理**

```typescript
errorLoadApp: (err, appInfo) => {
  console.error(`子应用 ${appInfo.name} 加载失败:`, err);
  storeRef.current.getState().clearSubAppLoading();
},
errorMountApp: (err, appInfo) => {
  console.error(`子应用 ${appInfo.name} 挂载失败:`, err);
  storeRef.current.getState().clearSubAppLoading();
},
```

---

### 4. 项目中如何实现并行请求？有什么优化策略？

**回答：**

**并行请求实现：**

```typescript
// app/layout.tsx
const [bothProductsRes, categoryDataRes, errorCodeEnRes, errorCodeZhRes] =
  await Promise.all([
    fetch(domainURLMap.productsDataUrl, { next: { revalidate: 3600 } }),
    fetch(domainURLMap.categoryDataUrl, { next: { revalidate: 3600 } }),
    fetch(domainURLMap.errorCodeEnUrl, { next: { revalidate: 3600 } }),
    fetch(domainURLMap.errorCodeZhUrl, { next: { revalidate: 3600 } }),
  ]);
```

**优化策略：**

**1. 独立处理每个响应**

```typescript
// 不让单个失败影响其他请求
if (bothProductsRes.ok) {
  bothProducts = await bothProductsRes.json();
} else {
  bothProducts = {};  // 失败降级
}

if (categoryDataRes.ok) {
  allCategories = await categoryDataRes.json();
} else {
  allCategories = {};  // 失败降级
}
```

**2. 使用 Promise.allSettled（如需要）**

```typescript
// 如果不想让任何失败阻断流程
const results = await Promise.allSettled([
  fetch(url1),
  fetch(url2),
]);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    // 处理成功
  } else {
    // 处理失败
  }
});
```

**3. 超时控制**

```typescript
// 可选：添加超时控制
const fetchWithTimeout = (url, timeout = 5000) => {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    ),
  ]);
};
```

---

### 5. async/await 和 Promise.then 有什么区别？项目中如何选择？

**回答：**

**区别对比：**

| 特性 | async/await | Promise.then |
|------|-------------|--------------|
| 可读性 | 同步风格，更清晰 | 链式调用，可能嵌套 |
| 错误处理 | try-catch | .catch() |
| 调试 | 断点友好 | 较难调试 |
| 顶层使用 | 需要包装（或使用 top-level await） | 直接使用 |

**项目中的选择：**

**1. async/await 用于复杂逻辑**

```typescript
// app/layout.tsx - 服务端组件，逻辑复杂
export default async function RootLayout({ children }) {
  try {
    const responses = await Promise.all([...]);

    if (bothProductsRes.ok) {
      const data = await bothProductsRes.json();
      // 处理数据...
    }
    // 更多逻辑...
  } catch (error) {
    // 错误处理
  }
}
```

**2. Promise.then 用于简单链式操作**

```typescript
// components/SubAppContainer.tsx - 简单的数据获取
fetch('/api/manifest')
  .then(res => res.json())
  .then(data => processData(data))
  .catch(error => handleError(error));
```

**3. 动态导入用 then**

```typescript
// 动态导入通常用 then
import('garfish').then((GarfishModule) => {
  // 使用模块
});
```

**选择原则：**

- **async/await**：逻辑复杂、需要中间变量、错误处理统一
- **Promise.then**：简单链式、不需要中间状态

---

## 二、模块化篇

### 6. 项目的模块化结构是怎样的？

**回答：**

**目录结构：**

```
main-app/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 首页
│   ├── utils/             # 应用级工具
│   │   └── manifest.ts
│   └── api/               # API 路由
│       └── manifest/route.ts
├── components/            # React 组件
│   ├── Navigation.tsx
│   ├── GarfishProvider.tsx
│   └── ...
├── hooks/                 # 自定义 Hooks
│   ├── useIntl.ts
│   ├── useSubAppMenuData.ts
│   └── ...
├── store/                 # Zustand 状态管理
│   ├── useAppStore.ts
│   ├── types.ts
│   └── slices/
├── utils/                 # 工具函数
│   ├── service.ts
│   ├── config.ts
│   ├── localePath.ts
│   └── ...
├── config/                # 配置文件
│   ├── topNav.ts
│   └── experienceCenter.ts
├── contexts/              # React Context
│   └── LoginModalContext.tsx
└── locales/               # 国际化资源
    ├── zh-CN.ts
    └── en-US.ts
```

**模块化原则：**

1. **按职责划分**：components、hooks、utils、store 各司其职
2. **就近原则**：app/utils 与 app/ 目录相关
3. **共享抽离**：共享的工具放在 utils/、hooks/
4. **配置集中**：config/ 集中管理配置

---

### 7. ES Module 和 CommonJS 在项目中是如何混用的？

**回答：**

**ES Module（主要使用）：**

```typescript
// 大部分文件使用 ESM
import { useAppStore } from '../store/useAppStore';
import { getSubAppConfigByPath } from '../app/utils/manifest';

export function useSubAppMenuData() {
  // ...
}
```

**CommonJS（特殊场景）：**

```typescript
// app/utils/manifest.ts - 服务端读取文件
if (typeof window === 'undefined') {
  // 使用 require 因为是同步操作
  const fs = require('fs');
  const path = require('path');

  const manifestPath = path.join(process.cwd(), 'app', 'manifest.json');
  const content = fs.readFileSync(manifestPath, 'utf-8');
}
```

**构建脚本使用 CommonJS：**

```javascript
// scripts/build-search-index.js
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../app/docs');
```

**混用注意事项：**

1. **服务端代码**：可以使用 require（同步）
2. **客户端代码**：统一使用 import
3. **构建脚本**：Node.js 环境，使用 CommonJS
4. **动态导入**：使用 `import()` 函数

---

### 8. 项目中如何组织工具函数？

**回答：**

**工具函数分类：**

**1. 服务相关（utils/service.ts）**

```typescript
// 服务初始化、获取实例
export async function initializeService(mergedMessages, domainURL) { }
export async function getService() { }
export function getServiceSync() { }
```

**2. 配置相关（utils/config.ts）**

```typescript
// 多环境域名配置
export const domainURLMap = { /* ... */ };
export const getDomainURL = () => { /* ... */ };
export const getClientDomainURL = () => { /* ... */ };
```

**3. 路径处理（utils/localePath.ts）**

```typescript
// 国际化路径处理
export function getPathnameWithoutLocale(pathname: string): string { }
export function getPathWithLocale(path: string, language: AppLanguage): string { }
export function isEnUsPath(pathname: string): boolean { }
```

**4. Cookie 操作（utils/tools.ts）**

```typescript
// Cookie 读取
export function getLanguageCookie(name: string) { }
export function getProjectCookie(name: string) { }
```

**5. 关键词替换（utils/replaceKeywordWithRules.js）**

```typescript
// 文本关键词替换
export default function replaceKeyword(item, rules = []) { }
```

**组织原则：**

1. **单一职责**：每个文件专注一个功能领域
2. **命名清晰**：函数名直观表达功能
3. **类型安全**：TypeScript 类型定义完整
4. **文档注释**：复杂函数添加注释

---

### 9. 项目中如何处理环境变量？

**回答：**

**环境变量配置：**

**1. Next.js 配置**

```javascript
// next.config.js
const nextConfig = {
  env: {
    // 将 MANIFEST_ENV 暴露给前端
    NEXT_PUBLIC_MANIFEST_ENV: process.env.MANIFEST_ENV || '',
  },
};
```

**2. 使用环境变量**

```typescript
// utils/config.ts
const CONSOLE_DEV = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

const COMMON_DATA_URL = `http://common-data.prj-console-astraflow.svc.c1.${
  process.env.NODE_ENV === 'development' ? 'u4' : 'uae'
}`;
```

**3. 多环境区分**

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

**4. 启动脚本**

```json
// package.json
{
  "scripts": {
    "dev": "MANIFEST_ENV=prod next dev",
    "devtest": "MANIFEST_ENV=test03 next dev",
    "build": "MANIFEST_ENV=prod next build",
    "buildtest": "MANIFEST_ENV=test03 next build"
  }
}
```

**命名规范：**

- `NEXT_PUBLIC_*`：暴露给客户端
- `MANIFEST_ENV`：服务端使用
- `NODE_ENV`：Node.js 内置

---

### 10. 项目中的依赖注入是如何实现的？

**回答：**

**1. 服务单例模式**

```typescript
// utils/service.ts
// 单例标志，确保只初始化一次
let serviceInstance: any = null;

export async function initializeService(mergedMessages, domainURL) {
  // 如果已经初始化，直接返回实例
  if (serviceInstance) {
    return serviceInstance;
  }

  // 初始化逻辑...
  serviceInstance = await initService({ /* config */ });

  return serviceInstance;
}

export function getServiceSync() {
  return serviceInstance;
}
```

**2. 全局变量注入**

```typescript
// 挂载到 window 供子应用使用
if (typeof window !== 'undefined') {
  (window as any).__MAIN_APP_SERVICE__ = serviceInstance;
}

// 挂载共享库
win.__MAINAPP_INNERPAGES__!.antd = antd;
win.__MAINAPP_INNERPAGES__!.react = ReactLib;
win.__MAINAPP_INNERPAGES__!['react-dom'] = ReactDOM;
```

**3. Context 注入**

```typescript
// components/serviceProvider.tsx
export const ServiceContext = createContext<Service | null>(null);

export default function ServiceProvider({ children, domainURL }) {
  const service = useServiceInitializer(mergedMessages, domainURL);

  return (
    <ServiceContext.Provider value={service}>
      {children}
    </ServiceContext.Provider>
  );
}
```

**4. Props 注入**

```typescript
// components/GarfishProvider.tsx
// 通过 Garfish props 传递给子应用
props: {
  store: storeRef.current,
  service: service,
  antdThemeConfig: antdThemeConfig,
}
```

---

## 三、数据处理篇

### 11. 项目中如何处理国际化路径？

**回答：**

**路径规则：**

- 中文：`/modelverse`
- 英文：`/en-us/modelverse`

**核心函数：**

```typescript
// utils/localePath.ts

// 去掉 locale 前缀
export function getPathnameWithoutLocale(pathname: string): string {
  if (!pathname) return '/';

  if (pathname === '/en-us' || pathname.startsWith('/en-us/')) {
    const rest = pathname.slice('/en-us'.length).replace(/^\//, '') || '';
    return rest ? `/${rest}` : '/';
  }

  return pathname;
}

// 添加 locale 前缀
export function getPathWithLocale(path: string, language: AppLanguage): string {
  if (!path || path === '/') return language === 'en-US' ? '/en-us' : '/';

  const normalized = path.startsWith('/') ? path : `/${path}`;

  // 已有前缀则不追加
  if (normalized === '/en-us' || normalized.startsWith('/en-us/')) {
    return normalized;
  }

  if (language === 'en-US') {
    return `/en-us${normalized}`;
  }

  return normalized;
}

// 判断是否为英文路径
export function isEnUsPath(pathname: string): boolean {
  return pathname === '/en-us' || pathname.startsWith('/en-us/');
}
```

**使用场景：**

```typescript
// components/Navigation.tsx
const fullPathWithLocale = fullPath ? getPathWithLocale(fullPath, currentLanguage) : undefined;

// GarfishProvider.tsx
const pathname = getPathnameWithoutLocale(rawPathname);
```

---

### 12. 项目中如何处理 Cookie？

**回答：**

**Cookie 读取：**

```typescript
// utils/tools.ts
export function getLanguageCookie(name: string) {
  const domainURL = getClientDomainURL();
  const domain = domainURL.ROOT;

  // 获取 domain 下的 cookie
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    const [key, value] = cookie.split('=');
    if (key === name && domain.includes(value)) {
      return value;
    }
  }

  // 回退：按前缀匹配
  return document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

export function getProjectCookie(name: string) {
  // 类似实现
}
```

**解析 URL 编码的 JSON：**

```typescript
export function encodedJsonToObject(encodedStr: string) {
  const decoded = decodeURIComponent(encodedStr);
  return JSON.parse(decoded);
}
```

**注意事项：**

1. **域名匹配**：确保 Cookie 属于当前域名
2. **安全解码**：使用 decodeURIComponent 处理编码
3. **错误处理**：解析失败时的降级处理

---

### 13. 项目中如何实现关键词替换？

**回答：**

**实现原理：**

```typescript
// utils/replaceKeywordWithRules.js

// 类型判断
export function isString(value) {
  return Object.prototype.toString.call(value) == '[object String]';
}

// 替换关键字
function replaceKeyword(item, rules = []) {
  item = item || '';
  let placeholder = 'e--e';
  let matchRegExp = /<.*?>|{{.*?}}|{.*?}/g;  // 匹配 HTML 标签和模板变量
  let replaceRegExp = /([.?*+^$[\]\\(){}|-])/g;  // 需要转义的特殊字符

  let htmlTagContents = [];
  let result = item;

  // 1. 先保护 HTML 标签和模板变量
  (item.match(matchRegExp) || []).forEach(htmlTagContent => {
    htmlTagContents.push(htmlTagContent);
    result = result.replace(
      new RegExp(htmlTagContent.replace(replaceRegExp, '\\$1')),
      placeholder
    );
  });

  // 2. 执行关键词替换
  rules.forEach(rule => {
    if (isString(rule.keyword)) {
      result = result.replace(
        new RegExp(rule.keyword.replace(replaceRegExp, '\\$1'), 'g'),
        rule.replacement
      );
    }
    if (Array.isArray(rule.keyword)) {
      rule.keyword.forEach(keyword => {
        result = result.replace(
          new RegExp(keyword.replace(replaceRegExp, '\\$1'), 'g'),
          rule.replacement
        );
      });
    }
  });

  // 3. 恢复 HTML 标签和模板变量
  (item.match(matchRegExp) || []).forEach((item, index) => {
    result = result.replace(new RegExp(placeholder), htmlTagContents[index]);
  });

  return result;
}
```

**使用场景：**

```typescript
// hooks/useIntl.ts
const channelRules = domainURL.channelConfig?.rulesReplacementForLocales || [];

// 替换货币符号等
// 将 "CNY"、"￥" 替换为 "USD"
for (const key in mergedMessages) {
  const item = mergedMessages[key];
  finalMessages[key] = replaceKeywordWithRules(item, channelRules);
}
```

**设计亮点：**

1. **保护特殊内容**：HTML 标签和模板变量不被误替换
2. **批量规则**：支持数组和字符串类型的关键词
3. **正则转义**：特殊字符正确转义

---

### 14. 项目中如何处理移动端检测？

**回答：**

**实现方式：**

```typescript
// utils/isMobile.ts
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    // 服务端渲染时，window 不存在
    if (typeof window === 'undefined') {
      return false;
    }
    // 客户端初始化时，立即检测一次
    return window.matchMedia('(max-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // 创建媒体查询对象
    const mobileQuery = window.matchMedia('(max-width: 768px)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // 初始化时设置一次状态
    setIsMobile(mobileQuery.matches);

    // 监听变化（现代浏览器）
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', handleChange);
    } else {
      // 兼容旧版浏览器
      mobileQuery.addListener(handleChange as any);
    }

    // 清理函数
    return () => {
      if (mobileQuery.removeEventListener) {
        mobileQuery.removeEventListener('change', handleChange);
      } else {
        mobileQuery.removeListener(handleChange as any);
      }
    };
  }, []);

  return isMobile;
};
```

**使用场景：**

```typescript
// components/Navigation.tsx
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  checkMobile();
  window.addEventListener('resize', checkMobile);

  return () => {
    window.removeEventListener('resize', checkMobile);
  };
}, []);

// 条件渲染
{isModelService && !isMobile && <SidebarNavigation />}
{isModelService && isMobile && <Drawer />}
```

---

### 15. 项目中如何处理深拷贝和对象合并？

**回答：**

**JSON 方式深拷贝：**

```typescript
// utils/service.ts
function updateURL(URL: any) {
  // JSON 深拷贝
  URL = JSON.parse(JSON.stringify(URL));

  URL.LOGOUT = URL.O_LOGOUT || `${URL.PASSPORT}/logout`;
  URL.PASSPORT = `${URL.PASSPORT}/login`;

  return URL;
}
```

**对象合并（Spread）：**

```typescript
// hooks/useIntl.ts
const mergedMessages = useMemo(() => {
  let mergedMessages = {
    ...baseLocaleMessages,  // 主应用消息
  };

  if (currentSubApp && subAppIntlMessages[currentSubApp.basename]) {
    const subAppLocaleMessages = subAppMessages[language] || {};

    // 子应用消息覆盖主应用
    mergedMessages = { ...mergedMessages, ...subAppLocaleMessages };
  }

  return mergedMessages;
}, [language, currentSubApp, subAppIntlMessages]);
```

**Store 中的合并：**

```typescript
// store/slices/subAppSlice.ts
registerSubAppMenuItems: (menuItems) => {
  set((state) => ({
    subAppMenuItems: {
      ...state.subAppMenuItems,  // 保留已有
      [menuItems.basename]: { ...menuItems, registeredAt: Date.now() },
    },
  }));
},
```

**注意事项：**

1. **JSON 深拷贝限制**：不支持函数、undefined、循环引用
2. **浅拷贝注意**：Spread 是浅拷贝，嵌套对象仍为引用
3. **不可变更新**：Redux/Zustand 要求返回新对象

---

## 四、正则表达式篇

### 16. 项目中正则表达式有哪些应用场景？

**回答：**

**1. 路径处理**

```typescript
// utils/localePath.ts
// 去掉动态参数部分
return pathname.split('/:')[0];
```

**2. 模板变量替换**

```typescript
// hooks/useIntl.ts
// 替换 {variable} 格式的变量
Object.keys(values).forEach((valueKey) => {
  message = message.replace(
    new RegExp(`\\{${valueKey}\\}`, 'g'),
    String(values[valueKey])
  );
});
```

**3. 关键词替换**

```typescript
// utils/replaceKeywordWithRules.js
// 匹配 HTML 标签和模板变量
let matchRegExp = /<.*?>|{{.*?}}|{.*?}/g;

// 需要转义的特殊字符
let replaceRegExp = /([.?*+^$[\]\\(){}|-])/g;

// 执行替换
result = result.replace(
  new RegExp(keyword.replace(replaceRegExp, '\\$1'), 'g'),
  rule.replacement
);
```

**4. Markdown 处理**

```javascript
// scripts/build-search-index.js
// 提取标题
const titleMatch = content.match(/^#\s+(.+)$/m);

// 移除代码块
.replace(/```[\s\S]*?```/g, '')

// 移除行内代码
.replace(/`[^`]+`/g, '')

// 移除图片
.replace(/!\[.*?\]\(.*?\)/g, '')

// 移除链接但保留文字
.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

// 提取所有标题
const headingMatches = content.matchAll(/^#{1,6}\s+(.+)$/gm);
```

---

### 17. 如何处理正则表达式中的特殊字符转义？

**回答：**

**问题：**

正则表达式中的特殊字符（如 `.`、`*`、`+` 等）需要转义才能作为字面量匹配。

**解决方案：**

```typescript
// utils/replaceKeywordWithRules.js

// 需要转义的特殊字符
let replaceRegExp = /([.?*+^$[\]\\(){}|-])/g;

// 转义函数
function escapeRegExp(string) {
  return string.replace(replaceRegExp, '\\$1');
}

// 使用
const keyword = 'CNY';  // 或 '￥'
const escaped = keyword.replace(replaceRegExp, '\\$1');  // 无需转义时不变

result = result.replace(
  new RegExp(escaped, 'g'),
  replacement
);
```

**常见特殊字符：**

| 字符 | 含义 | 需要转义 |
|------|------|----------|
| `.` | 任意字符 | 是 |
| `*` | 0 次或多次 | 是 |
| `+` | 1 次或多次 | 是 |
| `?` | 0 次或 1 次 | 是 |
| `^` | 开头 | 是 |
| `$` | 结尾 | 是 |
| `[]` | 字符集 | 是 |
| `()` | 分组 | 是 |
| `{}` | 量词 | 是 |
| `\` | 转义 | 是 |
| `|` | 或 | 是 |

---

### 18. 项目中如何提取 Markdown 内容？

**回答：**

**提取标题和内容：**

```javascript
// scripts/build-search-index.js
function extractFromMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 提取第一个 # 标题作为页面标题
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // 移除代码块和图片，提取纯文本内容
  let textContent = content
    .replace(/```[\s\S]*?```/g, '')      // 移除代码块
    .replace(/`[^`]+`/g, '')             // 移除行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '')     // 移除图片
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // 移除链接保留文字
    .replace(/<[^>]+>/g, '')             // 移除 HTML 标签
    .replace(/^---[\s\S]*?---/m, '')     // 移除 frontmatter
    .replace(/^#{1,6}\s+/gm, '')         // 移除标题标记
    .replace(/\n{3,}/g, '\n\n')          // 移除多余空行
    .trim();

  // 提取所有标题作为关键词
  const headings = [];
  const headingMatches = content.matchAll(/^#{1,6}\s+(.+)$/gm);
  for (const match of headingMatches) {
    headings.push(match[1].trim());
  }

  return {
    title,
    content: textContent,
    headings,
    excerpt: textContent.slice(0, 500),  // 摘要
  };
}
```

**正则解释：**

- `^#\s+(.+)$`：匹配 `# 开头的标题`
- ````[\s\S]*?`` ``：匹配代码块（非贪婪）
- `/\[([^\]]+)\]\([^)]+\)/g`：匹配链接，捕获文字

---

### 19. 项目中如何处理路径匹配？

**回答：**

**路径匹配实现：**

```typescript
// components/GarfishProvider.tsx
activeWhen: (location: unknown) => {
  const rawPathname = (location as Location)?.pathname || window.location.pathname;
  const pathname = getPathnameWithoutLocale(rawPathname);

  if (!pathname || !subApp.basename) {
    return false;
  }

  // 标准化路径
  const normalizedBasename = subApp.basename.endsWith('/')
    ? subApp.basename.slice(0, -1)
    : subApp.basename;
  const normalizedPath = pathname.endsWith('/') && pathname !== '/'
    ? pathname.slice(0, -1)
    : pathname;

  // 匹配：路径等于 basename 或以 basename/ 开头
  const isActive = normalizedPath === normalizedBasename ||
    normalizedPath.startsWith(normalizedBasename + '/');

  return isActive;
},
```

**菜单路径匹配：**

```typescript
// components/Navigation.tsx
const findMatchingKeys = (
  items: typeof subAppMenuItems.menuItems,
  currentPath: string,
  parentKeys: string[] = []
): string[] | null => {
  for (const item of items) {
    const currentKeys = [...parentKeys, item.key];

    if (item.path) {
      const fullPath = `${subAppMenuItems.basename}${item.path === '/' ? '' : item.path}`;
      const fullPathNoLocale = getPathnameWithoutLocale(fullPath);

      if (currentPath === fullPathNoLocale ||
          currentPath.startsWith(fullPathNoLocale) ||
          currentPath.startsWith('/en-us' + fullPathNoLocale)) {
        return currentKeys;
      }
    }

    if (item.children) {
      const childResult = findMatchingKeys(item.children, currentPath, currentKeys);
      if (childResult) {
        return childResult;
      }
    }
  }
  return null;
};
```

---

### 20. 项目中如何处理字符串操作？

**回答：**

**字符串分割和拼接：**

```typescript
// utils/tools.ts - Cookie 解析
const cookies = document.cookie.split('; ');
for (const cookie of cookies) {
  const [key, value] = cookie.split('=');
  // ...
}

// utils/localePath.ts - 路径拼接
const fullPath = `${subAppMenuItems.basename}${item.path === '/' ? '' : item.path}`;
```

**字符串替换：**

```typescript
// hooks/useIntl.ts - 变量替换
message = message.replace(
  new RegExp(`\\{${valueKey}\\}`, 'g'),
  String(values[valueKey])
);

// config/experienceCenter.ts - 前缀处理
const nameForCss = appInfo.name.startsWith('experience-')
  ? appInfo.name.replace(/^experience-/, '')
  : appInfo.name;
```

**字符串匹配：**

```typescript
// utils/localePath.ts
if (pathname.startsWith('/en-us/')) {
  // 处理英文路径
}

// config/experienceCenter.ts
if (pathname.startsWith(getExperienceBasename(name) + '/')) {
  return name;
}
```

**字符串截取：**

```typescript
// utils/localePath.ts
const rest = pathname.slice('/en-us'.length).replace(/^\//, '');

// scripts/build-search-index.js
const excerpt = textContent.slice(0, 500);
```

---

## 五、Node.js 篇

### 21. 项目中的构建脚本是如何设计的？

**回答：**

**构建脚本结构：**

```
scripts/
├── build-search-index.js   # 构建搜索索引
├── build-nav-index.js      # 构建导航索引
├── build-docs-page-map.js  # 构建文档页面映射
└── list-tailwind-classes.js # 列出 Tailwind 类名
```

**搜索索引构建脚本：**

```javascript
// scripts/build-search-index.js

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../app/docs');
const LOCALES = ['zh-CN', 'en-US'];

// 主函数
function buildSearchIndex() {
  console.log('🔍 Building search index...');

  const allIndexes = {};

  for (const locale of LOCALES) {
    const localeDir = path.join(DOCS_DIR, locale);
    const allDocs = [];

    // 扫描每个产品的文档
    for (const [productKey, localeConfigs] of Object.entries(PRODUCT_CONFIG)) {
      const docs = scanDirectory(productDir, productKey, locale);
      allDocs.push(...docs);
    }

    // 生成索引文件
    const outputFile = path.join(__dirname, `../public/search-index-${locale}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(allDocs, null, 2), 'utf-8');
  }
}

buildSearchIndex();
```

**特点：**

1. **CommonJS 模块**：Node.js 环境
2. **文件系统操作**：fs.readFileSync、fs.writeFileSync
3. **递归处理**：scanDirectory 递归扫描目录
4. **多语言支持**：为每个语言生成独立索引

---

### 22. 项目中如何读取和写入文件？

**回答：**

**同步读取文件：**

```typescript
// app/utils/manifest.ts
const fs = require('fs');
const path = require('path');

export function getManifestConfig(): ManifestConfig {
  if (typeof window === 'undefined') {
    // 服务端读取文件
    const manifestPath = path.join(process.cwd(), 'app', 'manifest.json');

    if (fs.existsSync(manifestPath)) {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      return JSON.parse(content);
    }
  }
}
```

**同步写入文件：**

```javascript
// scripts/build-search-index.js
const outputFile = path.join(__dirname, '../public/search-index.json');
const outputDir = path.dirname(outputFile);

// 确保目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 写入文件
fs.writeFileSync(outputFile, JSON.stringify(allDocs, null, 2), 'utf-8');
```

**目录操作：**

```javascript
// 递归扫描目录
function scanDirectory(dir, productKey, locale, basePath = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dir, item.name);

    if (item.isDirectory() && !item.name.startsWith('.')) {
      // 递归处理
      const subResults = scanDirectory(itemPath, productKey, locale, subPath);
      results.push(...subResults);
    } else if (item.isFile() && item.name.endsWith('.md')) {
      // 处理文件
    }
  }
}
```

---

### 23. 项目中如何生成 Nginx 配置？

**回答：**

**生成脚本：**

```javascript
// deploy/generate-nginx-config.js

const fs = require('fs');
const path = require('path');

// 读取环境变量
const manifestEnv = process.env.MANIFEST_ENV ||
  (process.env.NODE_ENV === 'production' ? 'production' : 'test03');

// 读取模板
const template = fs.readFileSync(templatePath, 'utf-8');

// 生成 upstream 配置
function generateUpstreams(subApps) {
  return subApps
    .filter(app => app.enabled)
    .map(app => {
      const serviceName = app.name;
      const entry = getEntryUrl(app);
      const serviceUrl = entry.replace(/^https?:\/\//, '');

      return `upstream ${serviceName} {
    server ${serviceUrl}:80;
}`;
    })
    .join('\n\n');
}

// 生成 location 配置
function generateLocations(subApps) {
  return subApps
    .filter(app => app.enabled)
    .map(app => {
      const publicBasename = '/public' + app.basename;

      return `location ^~ ${publicBasename} {
    proxy_pass http://${app.name}/;
    rewrite ^${publicBasename}/(.*)$ /$1 break;
}`;
    })
    .join('\n\n');
}

// 替换模板占位符
const config = template
  .replace('${SUBAPP_UPSTREAMS}', upstreams)
  .replace('${SUBAPP_LOCATIONS}', locations);

// 输出配置文件
fs.writeFileSync(outputPath, config, 'utf-8');
```

**模板文件：**

```nginx
# deploy/nginx.conf.template
http {
    ${SUBAPP_UPSTREAMS}

    server {
        ${SUBAPP_LOCATIONS}
    }
}
```

---

### 24. 项目中如何处理进程环境？

**回答：**

**环境变量获取：**

```javascript
// deploy/generate-nginx-config.js
const manifestEnv = process.env.MANIFEST_ENV ||
  (process.env.NODE_ENV === 'production' ? 'production' : 'test03');

// utils/config.ts
const CONSOLE_DEV = process.env.NODE_ENV === 'development' ||
  process.env.NODE_ENV === 'test';
```

**命令行参数：**

```javascript
// deploy/generate-nginx-config.js
const outputPath = process.argv[2] || '/etc/nginx/nginx.conf';
const entryEnv = process.argv[3];

// 使用：node generate-nginx-config.js /path/to/output production-126
```

**进程退出：**

```javascript
// deploy/generate-nginx-config.js
try {
  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
} catch (error) {
  console.error(`无法读取 manifest 文件: ${manifestPath}`, error);
  process.exit(1);  // 错误退出
}
```

**工作目录：**

```typescript
// app/utils/manifest.ts
const manifestPath = path.join(process.cwd(), 'app', 'manifest.json');
```

---

### 25. 项目中如何使用 Node.js 的 path 模块？

**回答：**

**路径拼接：**

```javascript
// scripts/build-search-index.js
const DOCS_DIR = path.join(__dirname, '../app/docs');
const localeDir = path.join(DOCS_DIR, locale);
const productDir = path.join(localeDir, productKey);
const itemPath = path.join(dir, item.name);
```

**获取目录名和扩展名：**

```javascript
// scripts/build-search-index.js
const outputDir = path.dirname(outputFile);

// 处理文件名
const fileName = item.name.replace(/\.(md|mdx)$/, '');
```

**路径解析：**

```typescript
// app/utils/manifest.ts
const manifestPath = path.join(process.cwd(), 'app', 'manifest.json');

// 路径规范化
const normalizedBasename = subApp.basename.endsWith('/')
  ? subApp.basename.slice(0, -1)
  : subApp.basename;
```

**跨平台路径处理：**

```javascript
// path.join 自动处理不同操作系统的路径分隔符
// Windows: path.join('a', 'b') -> 'a\b'
// Unix: path.join('a', 'b') -> 'a/b'
```

---

## 六、代码质量篇

### 26. 项目中如何进行类型检查？

**回答：**

**TypeScript 类型定义：**

```typescript
// store/types.ts
export interface AppState {
  user: UserInfo | null;
  theme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  subAppMenuItems: Record<string, SubAppMenuItems>;
  // ...
}

export interface MenuItemConfig {
  key: string;
  label: string;
  children?: MenuItemConfig[];
  icon?: React.ReactNode | string;
  path?: string;
  onClick?: () => void;
}
```

**类型导出和复用：**

```typescript
// store/useAppStore.ts
export type {
  UserInfo,
  MenuItemConfig,
  SubAppMenuItems,
  AppState,
} from './types';
```

**函数类型定义：**

```typescript
// utils/localePath.ts
export type AppLanguage = 'zh-CN' | 'en-US';

export function getPathnameWithoutLocale(pathname: string): string { }
export function getPathWithLocale(path: string, language: AppLanguage): string { }
```

**泛型使用：**

```typescript
// store/useAppStore.ts
export function useAppStore<T>(selector?: (state: AppState) => T) {
  // ...
}
```

---

### 27. 项目中如何处理可选链和空值合并？

**回答：**

**可选链（Optional Chaining）：**

```typescript
// components/SubAppContainer.tsx
const globalEnabledSubApps = (window as any).__ENABLED_SUB_APPS__;

// hooks/useIntl.ts
if (currentSubApp && subAppIntlMessages[currentSubApp.basename]) {
  const subAppMessages = subAppIntlMessages[currentSubApp.basename].messages;
}

// components/GarfishProvider.tsx
const rawPathname = (location as Location)?.pathname || window.location.pathname;
```

**空值合并（Nullish Coalescing）：**

```typescript
// app/layout.tsx
const safeBothProducts = bothProducts ?? {};
const safeAllCategories = allCategories ?? {};

// utils/config.ts
const manifestEnv = process.env.NEXT_PUBLIC_MANIFEST_ENV ?? process.env.MANIFEST_ENV;

// app/utils/manifest.ts
const manifestEnv = process.env.MANIFEST_ENV || 'local';
```

**区别：**

- `??` 只在 null/undefined 时使用右侧值
- `||` 在 falsy 值（0、''、false、null、undefined）时使用右侧值

```typescript
// 示例
const value = 0;
value ?? 1  // 0（保留 falsy 值）
value || 1  // 1（falsy 被替换）
```

---

### 28. 项目中如何使用解构赋值？

**回答：**

**对象解构：**

```typescript
// components/Navigation.tsx
const { currentSubApp, subAppMenuItems, subAppIntlMessages } = useSubAppMenuData();

// hooks/useIntl.ts
const { messages } = await response.json();

// store/slices/subAppSlice.ts
const { basename, menuItems, registeredAt } = menuItems;
```

**数组解构：**

```typescript
// app/layout.tsx
const [bothProductsRes, categoryDataRes, errorCodeEnRes, errorCodeZhRes] =
  await Promise.all([...]);

// utils/tools.ts
const [key, value] = cookie.split('=');
```

**默认值：**

```typescript
// components/Navigation.tsx
function Navigation({ collapsed = true, onCollapse, children }: NavigationProps) {
  // collapsed 默认值为 true
}
```

**重命名：**

```typescript
// 从模块导入时重命名
import { getSubAppConfigByPath as getConfig } from './manifest';
```

**剩余参数：**

```typescript
// 收集剩余属性
const { user, theme, ...rest } = state;
```

---

### 29. 项目中如何使用展开运算符？

**回答：**

**对象展开（合并）：**

```typescript
// hooks/useIntl.ts
let mergedMessages = {
  ...baseLocaleMessages,
};

mergedMessages = { ...mergedMessages, ...subAppLocaleMessages };

// store/slices/subAppSlice.ts
set((state) => ({
  subAppMenuItems: {
    ...state.subAppMenuItems,
    [menuItems.basename]: { ...menuItems, registeredAt: Date.now() },
  },
}));

// components/AntdConfigProvider.tsx
const baseItem = {
  key: item.key,
  label: labelText,
  icon: iconNode,
};

return {
  ...baseItem,
  children: transformMenuItems(item.children || []),
};
```

**数组展开：**

```typescript
// components/GarfishProvider.tsx
return [...manifestApps, ...experienceCenterApps];

// scripts/build-search-index.js
const subResults = scanDirectory(itemPath, productKey, locale, subPath);
results.push(...subResults);
```

**函数参数展开：**

```typescript
// 不定参数
function mergeObjects(...objects: object[]) {
  return Object.assign({}, ...objects);
}
```

---

### 30. 项目中 JavaScript 最佳实践总结

**回答：**

**1. 异步处理**

- ✅ 使用 async/await 提高可读性
- ✅ Promise.all 并行请求
- ✅ try-catch 统一错误处理
- ✅ 动态导入避免 SSR 错误

**2. 模块化**

- ✅ 按职责划分模块
- ✅ 类型定义集中管理
- ✅ 工具函数单一职责
- ✅ 避免循环依赖

**3. 数据处理**

- ✅ 使用 TypeScript 类型约束
- ✅ 可选链避免空指针
- ✅ 空值合并提供默认值
- ✅ 不可变数据更新

**4. 正则表达式**

- ✅ 特殊字符正确转义
- ✅ 使用非贪婪匹配
- ✅ 复杂正则添加注释
- ✅ 预编译常用正则

**5. Node.js 脚本**

- ✅ 错误处理和退出码
- ✅ 环境变量配置
- ✅ 路径使用 path 模块
- ✅ 日志输出便于调试

**6. 代码风格**

- ✅ 命名清晰直观
- ✅ 函数单一职责
- ✅ 避免魔法数字
- ✅ 注释关键逻辑

**7. 性能优化**

- ✅ 缓存计算结果
- ✅ 懒加载非关键模块
- ✅ 避免重复操作
- ✅ 使用高效算法

---

**文档版本**：1.0.0
**最后更新**：2024年
