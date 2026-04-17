# React 面试问答

本文档针对当前项目中 React 的使用，整理了30个专业面试问题及回答。

---

## 一、状态管理篇

### 1. 项目为什么选择 Zustand 作为状态管理方案？与其他方案相比有什么优势？

**回答：**

选择 Zustand 主要基于以下考虑：

**1. 轻量简洁**

```typescript
// Zustand 创建 store 非常简洁
const useAppStore = create<AppState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

**2. 无需 Provider 包裹**

```typescript
// Redux 需要 Provider
<Provider store={store}>
  <App />
</Provider>

// Zustand 不需要 Provider，直接使用
const user = useAppStore((state) => state.user);
```

**3. 微前端友好**

Zustand 的 store hook 可以直接传递给子应用，无需 Context：

```typescript
// GarfishProvider.tsx
props: {
  store: storeRef.current,  // 直接传递 store hook
}
```

**4. 与其他方案对比**

| 方案 | 优点 | 缺点 |
|------|------|------|
| Redux | 生态丰富、中间件强大 | 样板代码多、需要 Provider |
| MobX | 响应式编程、自动追踪 | 学习曲线、魔法行为 |
| Recoil | 原子化状态、并发模式 | 需要 Provider、生态较小 |
| Zustand | 轻量、无 Provider、TypeScript 友好 | 生态相对较小 |

**5. TypeScript 支持好**

```typescript
// 类型推断完整
interface AppState {
  user: UserInfo | null;
  setUser: (user: UserInfo) => void;
}

const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),  // 类型自动推断
}));
```

---

### 2. Zustand Store 的结构是如何设计的？为什么要拆分 Slice？

**回答：**

**Store 结构设计：**

```typescript
// store/useAppStore.ts
export const useAppStore = create<AppState>((set, get) => ({
  // ---------- subApp slice ----------
  ...createSubAppSlice(set, get),

  // ---------- commonData slice ----------
  ...createCommonDataSlice(set),

  // ---------- core: service / user / theme / ui ----------
  service: null,
  user: null,
  theme: 'light',
  language: 'zh-CN',
  // ...
}));
```

**Slice 拆分示例：**

```typescript
// store/slices/subAppSlice.ts
export function createSubAppSlice(set: SetState, get: GetState) {
  return {
    subAppMenuItems: {},
    subAppIntlMessages: {},
    enabledSubApps: [],
    registerSubAppMenuItems: (menuItems) => {
      set((state) => ({
        subAppMenuItems: {
          ...state.subAppMenuItems,
          [menuItems.basename]: { ...menuItems, registeredAt: Date.now() },
        },
      }));
    },
    // ...
  };
}
```

**拆分 Slice 的原因：**

1. **单一职责**：每个 Slice 负责一个领域，便于维护
2. **减少单文件体积**：原 store 约 440+ 行，拆分后更清晰
3. **按需订阅**：组件只订阅需要的 Slice，减少重渲染
4. **团队协作**：不同团队可以维护不同的 Slice

---

### 3. 如何避免 Zustand Store 的大对象订阅导致的性能问题？

**回答：**

**问题示例：**

```typescript
// ❌ 不好的做法 - 订阅整个 store
const store = useAppStore();
// 任何状态变化都会触发重渲染
```

**解决方案：**

**1. 细粒度 Selector**

```typescript
// ✅ 只订阅需要的字段
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

**3. Hook 封装**

```typescript
// hooks/useSubAppMenuData.ts
export function useSubAppMenuData() {
  const enabledSubApps = useAppStore((state) => state.enabledSubApps);
  const subAppMenuItemsStore = useAppStore((state) => state.subAppMenuItems);
  const subAppIntlMessagesStore = useAppStore((state) => state.subAppIntlMessages);

  // 使用 useMemo 减少计算
  const currentSubApp = useMemo(() => {
    // ... 推导逻辑
  }, [pathname, enabledSubApps]);

  return { currentSubApp, subAppMenuItems, subAppIntlMessages };
}
```

**4. 避免在渲染路径调用 getState**

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

### 4. 主应用和子应用如何共享 Zustand Store？

**回答：**

**共享机制：**

**1. 主应用传递 Store**

```typescript
// components/GarfishProvider.tsx
GarfishInstance.run({
  apps: enabledSubApps.map((subApp) => ({
    name: subApp.name,
    props: {
      store: storeRef.current,  // 传递 store hook
    },
  })),
});
```

**2. 子应用接收 Store**

```typescript
// 子应用 main.tsx
const store = GarfishProps?.props?.store;
if (store) {
  setExternalStore(store);  // 设置外部 store
}
```

**3. 使用 useSyncExternalStore 订阅**

```typescript
// 子应用 store/useAppStore.ts
let externalStoreHook: ReturnType<typeof create<AppState>> | null = null;

export const setExternalStore = (store) => {
  externalStoreHook = store;
};

export function useAppStore<T>(selector?: (state: AppState) => T) {
  if (externalStoreHook) {
    // 使用 React 18 的 useSyncExternalStore 订阅外部 store
    return useSyncExternalStore(
      externalStoreHook.subscribe,
      () => selector(externalStoreHook.getState()),
    );
  }
  // 独立运行时使用本地 store
  return localStore(selector);
}
```

**优势：**

1. **状态实时同步**：主应用状态变化，子应用自动更新
2. **无需消息通信**：避免 postMessage 等跨域通信复杂性
3. **类型安全**：TypeScript 类型可以直接共享

---

### 5. Store 中的状态持久化是如何实现的？

**回答：**

**持久化实现：**

**1. 主题持久化**

```typescript
// store/useAppStore.ts
setTheme: (theme) => {
  set({ theme });
  if (typeof window !== 'undefined') {
    localStorage.setItem('app-theme', theme);
  }
},
```

**2. 主题色持久化**

```typescript
setPrimaryColor: (color: string) => {
  set({ primaryColor: color });
  if (typeof window !== 'undefined') {
    localStorage.setItem('app-primary-color', color);
    // 同步更新 CSS 变量
    document.documentElement.style.setProperty('--primary-color', color);
  }
},
```

**3. 项目持久化**

```typescript
setCurrentProject: (project) => {
  set({ currentProject: project });
  if (typeof window !== 'undefined') {
    if (project) {
      localStorage.setItem('current-project', JSON.stringify(project));
    } else {
      localStorage.removeItem('current-project');
    }
  }
},
```

**4. 初始化恢复**

```typescript
export const initializeAppStore = () => {
  if (typeof window === 'undefined') return;

  const savedTheme = localStorage.getItem('app-theme');
  const savedPrimaryColor = localStorage.getItem('app-primary-color');

  if (savedTheme) {
    useAppStore.getState().setTheme(savedTheme);
  }
  if (savedPrimaryColor) {
    useAppStore.getState().setPrimaryColor(savedPrimaryColor);
  } else {
    // 使用默认颜色
    document.documentElement.style.setProperty(
      '--primary-color',
      useAppStore.getState().primaryColor
    );
  }
};
```

---

## 二、Hooks 篇

### 6. 项目中的 useIntl Hook 是如何设计的？

**回答：**

**设计目标：**

替代 react-intl，使用 @ucloud/ai-service 的翻译能力。

**核心实现：**

```typescript
// hooks/useIntl.ts
export function useIntl() {
  const language = useAppStore((state) => state.language) || 'zh-CN';
  const pathname = usePathname();
  const enabledSubApps = useAppStore((state) => state.enabledSubApps);
  const subAppIntlMessages = useAppStore((state) => state.subAppIntlMessages);

  // 1. 获取当前子应用配置
  const currentSubApp = useMemo(() => {
    if (!pathname) return null;
    return getSubAppConfigByPath(pathname, enabledSubApps);
  }, [pathname, enabledSubApps]);

  // 2. 合并主应用和子应用的国际化消息
  const mergedMessages = useMemo(() => {
    const baseLocaleMessages = messages[language] || messages['zh-CN'];

    if (currentSubApp && subAppIntlMessages[currentSubApp.basename]) {
      const subAppMessages = subAppIntlMessages[currentSubApp.basename].messages;
      const subAppLocaleMessages = subAppMessages[language] || subAppMessages['zh-CN'] || {};

      // 子应用消息优先级更高
      return { ...baseLocaleMessages, ...subAppLocaleMessages };
    }

    return baseLocaleMessages;
  }, [language, currentSubApp, subAppIntlMessages]);

  // 3. 格式化消息函数
  const formatMessage = useMemo(() => {
    return (descriptor: string, values?: Record<string, unknown>) => {
      const key = descriptor;

      // 先从合并的消息中查找
      if (key in mergedMessages) {
        let message = mergedMessages[key];
        // 替换变量
        if (values && Object.keys(values).length > 0) {
          Object.keys(values).forEach((valueKey) => {
            message = message.replace(new RegExp(`\\{${valueKey}\\}`, 'g'), String(values[valueKey]));
          });
        }
        return message;
      }

      // 返回 key 作为默认值
      return key;
    };
  }, [mergedMessages]);

  return {
    formatMessage,
    locale: language,
    messages: mergedMessages,
  };
}
```

**特点：**

1. **消息合并**：自动合并主应用和子应用的国际化消息
2. **变量替换**：支持 `{variable}` 格式的变量替换
3. **响应式更新**：语言切换时自动更新所有翻译

---

### 7. useSubAppMenuData Hook 的设计目的是什么？

**回答：**

**设计目的：**

集中处理子应用菜单数据的订阅和推导，避免组件内部重复订阅。

**实现：**

```typescript
// hooks/useSubAppMenuData.ts
export function useSubAppMenuData(): {
  currentSubApp: SubAppConfig | null;
  subAppMenuItems: SubAppMenuItems | null;
  subAppIntlMessages: SubAppIntlMessages | null;
} {
  const pathname = usePathname();
  const enabledSubApps = useAppStore((state) => state.enabledSubApps);
  const subAppMenuItemsStore = useAppStore((state) => state.subAppMenuItems);
  const subAppIntlMessagesStore = useAppStore((state) => state.subAppIntlMessages);

  // 推导当前子应用
  const currentSubApp = useMemo(
    () => pathname ? getSubAppConfigByPath(pathname, enabledSubApps) : null,
    [pathname, enabledSubApps]
  );

  // 推导菜单项（含体验中心回退）
  const subAppMenuItems = useMemo(() => {
    if (!pathname || !currentSubApp) return null;

    const direct = subAppMenuItemsStore[currentSubApp.basename];
    if (direct) return direct;

    // 体验中心回退到底层子应用的菜单
    if (currentSubApp.name.startsWith('experience-')) {
      const underlyingBasename = '/' + currentSubApp.name.replace(/^experience-/, '');
      const underlying = subAppMenuItemsStore[underlyingBasename];
      if (underlying?.menuItems) {
        return { ...underlying, basename: currentSubApp.basename };
      }
    }
    return null;
  }, [pathname, currentSubApp, subAppMenuItemsStore]);

  // 推导国际化消息
  const subAppIntlMessages = useMemo(() => {
    // ... 类似逻辑
  }, [pathname, currentSubApp, subAppIntlMessagesStore]);

  return { currentSubApp, subAppMenuItems, subAppIntlMessages };
}
```

**优势：**

1. **集中订阅**：避免多处重复订阅 store
2. **逻辑复用**：菜单推导逻辑只需维护一处
3. **性能优化**：useMemo 缓存计算结果
4. **体验中心处理**：自动处理体验中心的回退逻辑

---

### 8. 项目中如何使用 useEffect 处理副作用？

**回答：**

**常见使用场景：**

**1. 初始化逻辑**

```typescript
// components/NavigationLayout.tsx
useEffect(() => {
  if (bothProducts !== null && bothProducts !== undefined) {
    useAppStore.getState().setProducts(bothProducts);
  }
  if (allCategories !== null && allCategories !== undefined) {
    useAppStore.getState().setCategories(allCategories);
  }
}, [bothProducts, allCategories, errorCodeEn, errorCodeZh, domainURLMap]);
```

**2. DOM 操作**

```typescript
// components/GarfishProvider.tsx
useEffect(() => {
  if (typeof window === 'undefined') return;

  // 动态导入 Garfish
  import('garfish').then((GarfishModule) => {
    // 初始化逻辑
  });

  return () => {
    // 清理逻辑
  };
}, [enabledSubApps.length]);
```

**3. 事件监听**

```typescript
// components/Navigation.tsx
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
```

**4. 路由变化处理**

```typescript
// components/SubAppContainer.tsx
useEffect(() => {
  if (!pathname || !isInitialized || enabledSubApps.length === 0) {
    return;
  }

  const matchedApp = getSubAppConfigByPath(pathname, enabledSubApps);
  // 处理路由变化
}, [pathname, isInitialized, enabledSubApps]);
```

**最佳实践：**

1. **依赖数组准确**：确保包含所有外部变量
2. **清理函数**：处理事件解绑、定时器清除
3. **条件判断**：避免不必要的执行

---

### 9. useMemo 和 useCallback 在项目中是如何使用的？

**回答：**

**useMemo 使用场景：**

**1. 复杂计算缓存**

```typescript
// hooks/useIntl.ts
const mergedMessages = useMemo(() => {
  const baseLocaleMessages = messages[language] || messages['zh-CN'];

  if (currentSubApp && subAppIntlMessages[currentSubApp.basename]) {
    const subAppMessages = subAppIntlMessages[currentSubApp.basename].messages;
    return { ...baseLocaleMessages, ...subAppMessages[language] };
  }

  return baseLocaleMessages;
}, [language, currentSubApp, subAppIntlMessages]);
```

**2. 避免重复渲染**

```typescript
// components/Navigation.tsx
const sidebarMenuItems = useMemo(() => {
  if (!subAppMenuItems?.menuItems) return [];

  return transformMenuItems(subAppMenuItems.menuItems);
}, [subAppMenuItems, subAppIntlMessages, currentLanguage, currentSubApp]);
```

**3. 对象引用稳定**

```typescript
// components/AntdConfigProvider.tsx
const themeConfig = useMemo(() => {
  return {
    token: { ...baseTheme },
    components: { ... },
  };
}, [baseTheme]);
```

**useCallback 使用场景：**

```typescript
// contexts/LoginModalContext.tsx
const openLoginModal = useCallback((onSuccess?: () => void) => {
  setOnSuccessCallback(() => onSuccess);
  setIsOpen(true);
}, []);

const closeLoginModal = useCallback(() => {
  setIsOpen(false);
  setOnSuccessCallback(undefined);
}, []);
```

**选择原则：**

- `useMemo`：缓存计算结果、对象、数组
- `useCallback`：缓存函数，避免子组件重渲染

---

### 10. useRef 在项目中有哪些使用场景？

**回答：**

**1. 存储 Store 引用**

```typescript
// components/GarfishProvider.tsx
const storeRef = useRef(useAppStore);

// 在 useEffect 中使用，避免依赖项变化
useEffect(() => {
  // 使用 storeRef.current 获取最新的 store
  const currentStore = storeRef.current;
}, [enabledSubApps.length]);  // 不依赖 store 本身
```

**2. 记录上一个值**

```typescript
// components/SubAppContainer.tsx
const previousMatchedAppRef = useRef<string | null>(null);
const previousPathnameRef = useRef<string | null>(null);

useEffect(() => {
  const matchedApp = getSubAppConfigByPath(pathname, enabledSubApps);

  if (matchedApp?.name !== previousMatchedAppRef.current) {
    // 子应用切换
    previousMatchedAppRef.current = matchedApp?.name || null;
  }
}, [pathname, enabledSubApps]);
```

**3. 定时器引用**

```typescript
// components/SubAppContainer.tsx
const internalRouteLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (internalRouteLoadingTimerRef.current) {
    clearTimeout(internalRouteLoadingTimerRef.current);
  }

  internalRouteLoadingTimerRef.current = setTimeout(() => {
    setIsInternalRouteLoading(false);
  }, 500);

  return () => {
    if (internalRouteLoadingTimerRef.current) {
      clearTimeout(internalRouteLoadingTimerRef.current);
    }
  };
}, [pathname]);
```

**4. DOM 引用**

```typescript
// components/Navigation.tsx
const mainContentRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  mainContentRef.current?.scrollTo(0, 0);
}, [pathname]);

return (
  <Content ref={mainContentRef}>
    {children}
  </Content>
);
```

**useRef vs useState：**

- `useRef`：值变化不触发重渲染，用于存储可变值
- `useState`：值变化触发重渲染，用于存储状态

---

## 三、Context 篇

### 11. 项目中有哪些 Context？各自的作用是什么？

**回答：**

**1. ServiceContext**

```typescript
// components/serviceProvider.tsx
export const ServiceContext = createContext<Service | null>(null);

// 提供全局服务实例
export default function ServiceProvider({ children, domainURL }) {
  const service = useServiceInitializer(mergedMessages, domainURL);

  return (
    <ServiceContext.Provider value={service}>
      {children}
    </ServiceContext.Provider>
  );
}
```

**作用**：提供 @ucloud/ai-service 的服务实例，包括 queryService、userService、intlService。

**2. IntlContext**

```typescript
// components/IntlProvider.tsx
const IntlContext = createContext<ReturnType<typeof useIntl> | null>(null);

export default function IntlProvider({ children }) {
  const intl = useIntl();

  return (
    <IntlContext.Provider value={intl}>
      {children}
    </IntlContext.Provider>
  );
}
```

**作用**：提供国际化功能（formatMessage、locale、messages）。

**3. LoginModalContext**

```typescript
// contexts/LoginModalContext.tsx
const LoginModalContext = createContext<LoginModalContextType | undefined>(undefined);

export function LoginModalProvider({ children, domainURLMap }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <LoginModalContext.Provider value={{ openLoginModal, closeLoginModal, isOpen }}>
      {children}
      <LoginModal open={isOpen} />
    </LoginModalContext.Provider>
  );
}
```

**作用**：管理登录弹窗状态，提供全局登录弹窗控制。

---

### 12. Context 的性能问题如何解决？

**回答：**

**问题：Context 值变化会导致所有消费者重渲染。**

**解决方案：**

**1. 拆分 Context**

```typescript
// 不好的做法：一个大 Context
<AppContext.Provider value={{ user, theme, language, ... }}>
  <App />
</AppContext.Provider>

// 好的做法：拆分为多个 Context
<UserContext.Provider value={user}>
  <ThemeContext.Provider value={theme}>
    <LanguageContext.Provider value={language}>
      <App />
    </LanguageContext.Provider>
  </ThemeContext.Provider>
</UserContext.Provider>
```

**2. 使用 Zustand 替代 Context**

```typescript
// 项目中的做法：使用 Zustand 管理大部分状态
// Context 只用于需要 Provider 包裹的场景

// 需要全局访问但变化不频繁的用 Context
<ServiceProvider>  {/* 服务实例基本不变 */}

// 频繁变化的状态用 Zustand
const language = useAppStore((state) => state.language);
```

**3. 使用 useMemo 稳定 Context 值**

```typescript
export function LoginModalProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(() => ({
    openLoginModal: (onSuccess) => { /* ... */ },
    closeLoginModal: () => setIsOpen(false),
    isOpen,
  }), [isOpen]);

  return (
    <LoginModalContext.Provider value={value}>
      {children}
    </LoginModalContext.Provider>
  );
}
```

**4. 组件拆分**

```typescript
// 消费 Context 的组件拆分到最小粒度
function UserName() {
  const { user } = useContext(UserContext);
  return <span>{user?.name}</span>;
}

function App() {
  return (
    <div>
      <OtherContent />
      <UserName />  {/* 只有这个组件会因 user 变化重渲染 */}
    </div>
  );
}
```

---

### 13. ServiceProvider 是如何初始化服务的？

**回答：**

**初始化流程：**

```typescript
// components/serviceProvider.tsx
export default function ServiceProvider({ children, domainURL }) {
  const mergedMessages = useAppStore((state) => state.mergedMessages);

  // 使用自定义 Hook 初始化服务
  const service = useServiceInitializer(mergedMessages, domainURL);

  // 将服务实例存入 store
  useEffect(() => {
    useAppStore.setState({ service: service });
  }, [service]);

  return (
    <ServiceContext.Provider value={service}>
      {children}
    </ServiceContext.Provider>
  );
}
```

**同时挂载到 window：**

```typescript
// components/serviceProvider.tsx
if (typeof window !== 'undefined') {
  const win = window as Window & { __MAINAPP_INNERPAGES__?: Record<string, any> };
  if (!win.__MAINAPP_INNERPAGES__) {
    win.__MAINAPP_INNERPAGES__ = {};
  }
  win.__MAINAPP_INNERPAGES__!.antd = antd;
  win.__MAINAPP_INNERPAGES__!.react = ReactLib;
  win.__MAINAPP_INNERPAGES__!['react-dom'] = ReactDOM;
  win.__MAINAPP_INNERPAGES__!['react-router-dom'] = ReactRouterDOM;
  // ...
}
```

**这样做的目的：**

1. **Context 使用**：组件内通过 useContext 获取
2. **全局访问**：子应用可以通过 window 访问
3. **依赖共享**：共享 React、antd 等库实例

---

### 14. LoginModalContext 的设计有什么特点？

**回答：**

**设计特点：**

**1. 使用 useRef 解决闭包问题**

```typescript
export function LoginModalProvider({ children, domainURLMap }) {
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | undefined>();
  const onSuccessCallbackRef = useRef<(() => void) | undefined>(undefined);

  // 保持 ref 同步
  useEffect(() => {
    onSuccessCallbackRef.current = onSuccessCallback;
  }, [onSuccessCallback]);

  const handleSuccess = useCallback(() => {
    // 使用 ref 获取最新的回调，避免闭包问题
    const currentCallback = onSuccessCallbackRef.current;
    if (currentCallback) {
      currentCallback();
    }
    closeLoginModal();
  }, [closeLoginModal]);
}
```

**2. 注册到 Store 供子应用使用**

```typescript
useEffect(() => {
  useAppStore.getState().setLoginModal({
    openLoginModal,
    closeLoginModal,
    isOpen: () => isOpen,
  });

  return () => {
    useAppStore.getState().setLoginModal(null);
  };
}, [openLoginModal, closeLoginModal, isOpen]);
```

**3. 动态加载弹窗组件**

```typescript
const LoginModal = dynamic(() => import('../components/Login/LoginModal'), {
  ssr: false
});
```

**优势：**

1. **闭包安全**：使用 ref 避免回调过期
2. **跨应用访问**：子应用可以通过 store 调用
3. **性能优化**：动态加载减少首屏体积

---

## 四、组件设计篇

### 15. Navigation 组件是如何组织的？

**回答：**

**组件结构：**

```typescript
// components/Navigation.tsx
export default function Navigation({ collapsed, onCollapse, children }) {
  // 1. 状态管理
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // 2. Store 订阅
  const enabledSubApps = useAppStore((state) => state.enabledSubApps);
  const currentLanguage = useAppStore((state) => state.language);
  const { currentSubApp, subAppMenuItems, subAppIntlMessages } = useSubAppMenuData();

  // 3. 复杂计算
  const sidebarMenuItems = useMemo(() => { /* ... */ }, [/* deps */]);
  const selectedTopNavKey = useMemo(() => { /* ... */ }, [pathname, visibleTopNavConfig]);

  // 4. 副作用
  useEffect(() => { /* 移动端检测 */ }, []);
  useEffect(() => { /* 路由变化滚动 */ }, [pathname]);

  // 5. 条件渲染
  if (!service) {
    return <Skeleton />;  // 加载态
  }

  return (
    <>
      <NavigationHeader />
      <Content>
        <Layout>
          {isModelService && !isMobile && <SidebarNavigation />}
          {isModelService && isMobile && <Drawer />}
          <Content>{children}</Content>
        </Layout>
      </Content>
    </>
  );
}
```

**设计要点：**

1. **关注点分离**：Header、Sidebar 拆分为独立组件
2. **Hook 封装**：useSubAppMenuData 集中处理菜单逻辑
3. **条件渲染**：PC/移动端、模型服务/首页区分渲染
4. **加载态**：service 未就绪时显示骨架屏

---

### 16. SubAppContainer 组件的作用是什么？

**回答：**

**核心作用：**

提供子应用挂载容器，处理加载状态和错误展示。

**关键实现：**

```typescript
// components/SubAppContainer.tsx
export default function SubAppContainer() {
  const enabledSubApps = useAppStore((state) => state.enabledSubApps);
  const subAppLoading = useAppStore((state) => state.subAppLoading);
  const showNeedLoginOverlay = useAppStore((state) => state.showNeedLoginOverlay);
  const pathname = usePathname();

  // 1. 监听路由变化
  useEffect(() => {
    const matchedApp = getSubAppConfigByPath(pathname, enabledSubApps);
    if (matchedApp && currentMatchedAppName !== previousMatchedAppRef.current) {
      // 设置加载状态
      useAppStore.getState().setSubAppLoading({
        appName: currentMatchedAppName,
        loadingStartTime: performance.now(),
        // ...
      });
    }
  }, [pathname, isInitialized, enabledSubApps]);

  // 2. 初始化 enabledSubApps
  useEffect(() => {
    if (enabledSubApps.length === 0 && !isInitialized) {
      fetch('/api/manifest')
        .then(res => res.json())
        .then((data) => {
          useAppStore.getState().setEnabledSubApps(data.subApps.filter(app => app.enabled));
        });
    }
  }, [enabledSubApps.length, isInitialized]);

  // 3. 渲染
  return (
    <div id="sub-app-container" data-sub-app-container="true">
      {/* 加载骨架屏 */}
      {showLoadingOverlay && <Skeleton />}

      {/* 需要登录遮罩 */}
      {showNeedLoginOverlay && <NeedLoginPage />}
    </div>
  );
}
```

**职责：**

1. **容器提供**：提供 `#sub-app-container` 供 Garfish 挂载
2. **加载状态**：显示骨架屏、记录加载耗时
3. **错误处理**：显示 404 页面、登录遮罩
4. **路由监听**：监听路由变化，更新加载状态

---

### 17. GarfishProvider 组件是如何初始化 Garfish 的？

**回答：**

**初始化流程：**

```typescript
// components/GarfishProvider.tsx
export default function GarfishProvider() {
  const storeRef = useRef(useAppStore);
  const enabledSubApps = useAppStore((state) => state.enabledSubApps);
  const antdThemeConfig = useAppStore((state) => state.antdThemeConfig);
  const service = useContext(ServiceContext);

  useEffect(() => {
    async function initGarfish() {
      if (typeof window === 'undefined') return;

      // 1. 等待 enabledSubApps 就绪
      if (enabledSubApps.length === 0) {
        const globalEnabledSubApps = window.__ENABLED_SUB_APPS__;
        if (globalEnabledSubApps) {
          storeRef.current.getState().setEnabledSubApps(globalEnabledSubApps);
        }
        return;
      }

      // 2. 动态导入 Garfish
      if (!garfishInitialized) {
        import('garfish').then((GarfishModule) => {
          const Garfish = GarfishModule.default || GarfishModule;

          // 3. 配置 Garfish
          Garfish.run({
            domGetter: () => document.querySelector('#sub-app-container'),
            basename: '/',
            apps: [
              // manifest 子应用
              ...manifestApps,
              // 体验中心虚拟子应用
              ...experienceCenterApps,
            ],
          });

          garfishInitialized = true;

          // 4. 预加载子应用
          setTimeout(() => {
            requestIdleCallback(() => {
              preloadSubAppNames.forEach(name => Garfish.preloadApp(name));
            });
          }, 2000);
        });
      }
    }

    initGarfish();
  }, [enabledSubApps.length]);

  return null;
}
```

**关键设计：**

1. **动态导入**：避免 SSR 错误
2. **等待配置**：enabledSubApps 就绪后再初始化
3. **生命周期钩子**：beforeMount、afterMount 等记录性能
4. **预加载**：2秒后空闲时预加载子应用

---

### 18. AntdConfigProvider 是如何管理主题的？

**回答：**

**主题管理：**

```typescript
// components/AntdConfigProvider.tsx
export default function AntdConfigProvider({ children }) {
  const { language, primaryColor, theme, themeConfig, setPrimaryColor } = useAppStore();

  // 1. 初始化 store（从 localStorage 恢复）
  if (typeof window !== 'undefined') {
    const savedPrimaryColor = localStorage.getItem('app-primary-color');
    if (savedPrimaryColor) {
      document.documentElement.style.setProperty('--primary-color', savedPrimaryColor);
    }
  }

  useEffect(() => {
    initializeAppStore();
  }, []);

  // 2. 根据语言设置 dayjs locale
  useEffect(() => {
    const dayjsLocale = language === 'zh-CN' ? 'zh-cn' : 'en';
    dayjs.locale(dayjsLocale);
  }, [language]);

  // 3. 更新 CSS 变量
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', primaryColor);
  }, [primaryColor]);

  // 4. 配置 Ant Design 主题
  const themeConfig = useMemo(() => {
    const baseTheme = theme === 'dark' ? themeDark : themeLight;

    return {
      token: {
        ...baseTheme,
        colorPrimary: baseTheme.colorPrimary,
        borderRadius: designTokensTheme.borderRadiusSM,
      },
      components: {
        Layout: { bodyBg: baseTheme.colorBgContainer },
      },
    };
  }, [theme]);

  // 5. 同步到 store
  useEffect(() => {
    useAppStore.getState().setAntdThemeConfig(themeConfig);
  }, [themeConfig]);

  return (
    <ConfigProvider locale={locale} theme={themeConfig}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
```

**特点：**

1. **持久化**：主题设置保存到 localStorage
2. **CSS 变量同步**：primaryColor 同步到 CSS 变量
3. **国际化联动**：语言切换自动更新 dayjs locale
4. **Store 同步**：主题配置同步到 store 供子应用使用

---

### 19. 项目中如何处理组件的加载状态？

**回答：**

**多种加载状态处理：**

**1. 骨架屏**

```typescript
// SubAppContainer.tsx
const showLoadingOverlay = isLoading || isInternalRouteLoading;

return (
  <div id="sub-app-container">
    {showLoadingOverlay && (
      <div className="sub-app-skeleton-overlay">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )}
  </div>
);
```

**2. Service 未就绪**

```typescript
// Navigation.tsx
if (!service) {
  return (
    <div>
      <div style={{ height: 64 }}>
        <Skeleton.Button active size="small" />
        <Skeleton.Input active size="small" />
      </div>
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  );
}
```

**3. 动态导入**

```typescript
// contexts/LoginModalContext.tsx
const LoginModal = dynamic(() => import('../components/Login/LoginModal'), {
  ssr: false
});

// Navigation.tsx
const ProductMenuDrawer = dynamic(() => import('./ProductMenuDrawer'), {
  ssr: false
});
```

**4. 子应用加载状态**

```typescript
// store/slices/subAppSlice.ts
const initialSubAppLoading = {
  appName: null,
  loadingStartTime: null,
  mountStartTime: null,
  loadDuration: null,
  mountDuration: null,
  totalDuration: null,
};

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
  console.log(`挂载耗时: ${mountDuration.toFixed(2)}ms`);
  setTimeout(() => state.clearSubAppLoading(), 300);
},
```

---

### 20. 错误边界（Error Boundary）是如何使用的？

**回答：**

**使用场景：**

```typescript
// app/layout.tsx
<NavigationLayout>
  <GarfishProvider />
  {/* 子应用容器用 Error Boundary 隔离 */}
  <SubAppErrorBoundary>
    <SubAppContainer />
  </SubAppErrorBoundary>
  {children}
</NavigationLayout>
```

**Error Boundary 实现：**

```typescript
// 典型的 Error Boundary 实现
class SubAppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 上报错误
    console.error('子应用渲染错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h2>子应用加载失败</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**作用：**

1. **错误隔离**：子应用错误不影响主应用
2. **降级展示**：显示友好的错误页面
3. **错误上报**：记录错误信息便于排查

---

## 五、性能优化篇

### 21. 项目中如何避免不必要的重渲染？

**回答：**

**1. 细粒度订阅**

```typescript
// ❌ 不好的做法
const store = useAppStore();

// ✅ 好的做法
const language = useAppStore((state) => state.language);
const user = useAppStore((state) => state.user);
```

**2. useMemo 缓存计算**

```typescript
const sidebarMenuItems = useMemo(() => {
  return transformMenuItems(subAppMenuItems.menuItems);
}, [subAppMenuItems, subAppIntlMessages, currentLanguage]);
```

**3. useCallback 缓存函数**

```typescript
const openLoginModal = useCallback((onSuccess?: () => void) => {
  setOnSuccessCallback(() => onSuccess);
  setIsOpen(true);
}, []);
```

**4. 组件拆分**

```typescript
// 大组件拆分为小组件
<NavigationHeader />
<SidebarNavigation />
<ProductMenuDrawer />
```

**5. 动态加载**

```typescript
const ProductMenuDrawer = dynamic(() => import('./ProductMenuDrawer'), {
  ssr: false
});
```

**6. React.memo**

```typescript
const SidebarNavigation = React.memo(function SidebarNavigation({
  collapsed,
  selectedKeys,
  menuItems,
}) {
  // ...
});
```

---

### 22. 如何优化大列表的渲染性能？

**回答：**

**项目中虽然没有直接使用虚拟列表，但有以下优化策略：**

**1. 分页加载**

```typescript
// 在数据层面控制
const visibleItems = items.slice(0, pageSize);
```

**2. 条件渲染**

```typescript
// 只渲染可见区域
{isModelService && !isMobile && <SidebarNavigation />}
{isModelService && isMobile && <Drawer />}
```

**3. 懒加载**

```typescript
// 非首屏内容延迟加载
const ProductMenuDrawer = dynamic(() => import('./ProductMenuDrawer'), {
  ssr: false
});
```

**4. 虚拟列表方案（如需要）**

```typescript
// 使用 react-window 或 react-virtualized
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={50}
>
  {({ index, style }) => (
    <div style={style}>{items[index]}</div>
  )}
</FixedSizeList>
```

---

### 23. 项目中如何处理内存泄漏问题？

**回答：**

**常见内存泄漏场景及解决方案：**

**1. 定时器清理**

```typescript
// components/SubAppContainer.tsx
const internalRouteLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  internalRouteLoadingTimerRef.current = setTimeout(() => {
    setIsInternalRouteLoading(false);
  }, 500);

  return () => {
    if (internalRouteLoadingTimerRef.current) {
      clearTimeout(internalRouteLoadingTimerRef.current);
    }
  };
}, [pathname]);
```

**2. 事件监听清理**

```typescript
// components/Navigation.tsx
useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  window.addEventListener('resize', checkMobile);
  return () => {
    window.removeEventListener('resize', checkMobile);
  };
}, []);
```

**3. Store 清理**

```typescript
// contexts/LoginModalContext.tsx
useEffect(() => {
  useAppStore.getState().setLoginModal({
    openLoginModal,
    closeLoginModal,
    isOpen: () => isOpen,
  });

  // 清理函数：组件卸载时清除
  return () => {
    useAppStore.getState().setLoginModal(null);
  };
}, [openLoginModal, closeLoginModal, isOpen]);
```

**4. 避免闭包陷阱**

```typescript
// 使用 ref 保存最新值，避免闭包持有旧引用
const onSuccessCallbackRef = useRef<(() => void) | undefined>(undefined);

useEffect(() => {
  onSuccessCallbackRef.current = onSuccessCallback;
}, [onSuccessCallback]);
```

---

### 24. 项目中如何优化国际化消息的合并？

**回答：**

**优化策略：**

**1. useMemo 缓存**

```typescript
// hooks/useIntl.ts
const mergedMessages = useMemo(() => {
  const baseLocaleMessages = messages[language] || messages['zh-CN'];

  if (currentSubApp && subAppIntlMessages[currentSubApp.basename]) {
    const subAppMessages = subAppIntlMessages[currentSubApp.basename].messages;
    return { ...baseLocaleMessages, ...subAppMessages[language] };
  }

  return baseLocaleMessages;
}, [language, currentSubApp, subAppIntlMessages]);
```

**2. 同步到 Store**

```typescript
// 避免重复计算
useEffect(() => {
  useAppStore.getState().setMergedMessages(mergedMessages);
}, [mergedMessages]);
```

**3. 按需加载**

```typescript
// 子应用注册时才合并
if (currentSubApp && subAppIntlMessages[currentSubApp.basename]) {
  // 只在子应用路径下才合并子应用消息
}
```

**4. 缓存策略**

```typescript
// store/slices/subAppSlice.ts
registerSubAppIntlMessages: (messages) => {
  set((state) => {
    const updated = {
      ...state.subAppIntlMessages,
      [messages.basename]: {
        ...messages,
        registeredAt: Date.now(),  // 记录注册时间
      },
    };
    // 同步到 window 全局变量
    if (typeof window !== 'undefined') {
      window.__SUB_APP_INTL_MESSAGES__[messages.basename] = { ...messages };
    }
    return { subAppIntlMessages: updated };
  });
},
```

---

### 25. 动态导入（dynamic import）在项目中的应用场景有哪些？

**回答：**

**应用场景：**

**1. 非首屏组件**

```typescript
// contexts/LoginModalContext.tsx
const LoginModal = dynamic(() => import('../components/Login/LoginModal'), {
  ssr: false
});

// components/Navigation.tsx
const ProductMenuDrawer = dynamic(() => import('./ProductMenuDrawer'), {
  ssr: false
});
```

**2. 避免 SSR 错误**

```typescript
// Garfish 只在客户端运行
import('garfish').then((GarfishModule) => {
  // 初始化 Garfish
});
```

**3. 按路由加载**

```typescript
// Next.js 内置支持
// app/modelverse/[...slug]/page.tsx 在访问时才加载
```

**4. 第三方库延迟加载**

```typescript
// service 初始化
const { initService } = await import('@ucloud/ai-service');
```

**dynamic 的优势：**

1. **减少首屏体积**：非关键组件延迟加载
2. **避免 SSR 错误**：`ssr: false` 跳过服务端渲染
3. **按需加载**：用户交互时才加载

---

## 六、React 19 特性篇

### 26. 项目使用 React 19 有哪些新特性的应用？

**回答：**

**项目使用的 React 19 特性：**

**1. useSyncExternalStore**

```typescript
// 子应用订阅主应用 store
import { useSyncExternalStore } from 'react';

export function useAppStore<T>(selector?: (state: AppState) => T) {
  if (externalStoreHook) {
    return useSyncExternalStore(
      externalStoreHook.subscribe,
      () => selector(externalStoreHook.getState()),
    );
  }
  return localStore(selector);
}
```

**作用**：安全地订阅外部数据源，避免撕裂问题。

**2. 改进的 Ref 支持**

```typescript
// React 19 中 ref 作为 props 传递更简单
// 无需 forwardRef
<Content ref={mainContentRef}>
  {children}
</Content>
```

**3. 文档元数据支持**

```typescript
// 在组件中渲染 title、meta 等
// Next.js App Router 自动处理
export const metadata = {
  title: 'AstraFlow',
  description: 'AstraFlow',
};
```

**4. 并发特性**

```typescript
// useTransition 用于非紧急更新
const [isPending, startTransition] = useTransition();

startTransition(() => {
  // 低优先级更新
});
```

---

### 27. useSyncExternalStore 是如何解决外部状态订阅问题的？

**回答：**

**问题背景：**

在并发模式下，外部状态订阅可能导致"撕裂"问题——同一渲染中状态不一致。

**解决方案：**

```typescript
// 子应用 store 实现
let externalStoreHook: ReturnType<typeof create<AppState>> | null = null;

export const setExternalStore = (store) => {
  externalStoreHook = store;
};

export function useAppStore<T>(selector?: (state: AppState) => T) {
  if (externalStoreHook) {
    // 使用 useSyncExternalStore 安全订阅
    return useSyncExternalStore(
      // subscribe 函数
      (callback) => externalStoreHook.subscribe(callback),
      // getSnapshot 函数
      () => selector(externalStoreHook.getState()),
      // getServerSnapshot（可选）
      () => selector(externalStoreHook.getState()),
    );
  }
  return localStore(selector);
}
```

**工作原理：**

1. **subscribe**：注册状态变化回调
2. **getSnapshot**：获取当前状态快照
3. **getServerSnapshot**：服务端渲染时的快照

**优势：**

1. **并发安全**：避免撕裂问题
2. **服务端支持**：支持 SSR
3. **一致性**：确保渲染过程中状态一致

---

### 28. 项目中如何处理 React 严格模式（Strict Mode）？

**回答：**

**配置：**

```javascript
// next.config.js
const nextConfig = {
  reactStrictMode: true,
};
```

**严格模式的影响：**

**1. 双重渲染（开发环境）**

```typescript
// useEffect 会执行两次
useEffect(() => {
  console.log('mount');  // 开发环境打印两次

  return () => {
    console.log('unmount');  // 开发环境打印两次
  };
}, []);
```

**2. 解决方案**

```typescript
// 使用 useRef 避免重复执行
const initializedRef = useRef(false);

useEffect(() => {
  if (initializedRef.current) return;
  initializedRef.current = true;

  // 只执行一次的逻辑
}, []);
```

**项目中的处理：**

```typescript
// components/GarfishProvider.tsx
let garfishInitialized = false;  // 模块级变量

useEffect(() => {
  if (!garfishInitialized) {
    import('garfish').then(() => {
      garfishInitialized = true;
    });
  }
}, []);
```

**最佳实践：**

1. **副作用幂等**：确保副作用可以多次执行
2. **清理函数完善**：正确清理资源
3. **使用 useRef**：避免重复初始化

---

### 29. 项目中如何处理服务端和客户端的差异？

**回答：**

**差异处理策略：**

**1. 环境检测**

```typescript
if (typeof window === 'undefined') {
  // 服务端代码
} else {
  // 客户端代码
}
```

**2. 客户端组件标记**

```typescript
'use client';

export default function ClientComponent() {
  // 只在客户端执行
}
```

**3. useEffect 延迟执行**

```typescript
// 确保只在客户端执行
useEffect(() => {
  // 浏览器 API
  window.addEventListener('resize', handler);
}, []);
```

**4. 动态导入**

```typescript
// 跳过 SSR
const LoginModal = dynamic(() => import('./LoginModal'), {
  ssr: false
});
```

**5. 条件初始化**

```typescript
// store/useAppStore.ts
setPrimaryColor: (color: string) => {
  set({ primaryColor: color });
  if (typeof window !== 'undefined') {
    localStorage.setItem('app-primary-color', color);
    document.documentElement.style.setProperty('--primary-color', color);
  }
},
```

---

### 30. 项目中 React 最佳实践总结

**回答：**

**1. 状态管理**

- ✅ 使用 Zustand 集中管理全局状态
- ✅ 细粒度订阅，避免不必要重渲染
- ✅ Slice 拆分，职责清晰

**2. 组件设计**

- ✅ 单一职责，组件拆分到最小粒度
- ✅ 关注点分离，逻辑封装到 Hook
- ✅ 条件渲染，避免不必要的渲染

**3. 性能优化**

- ✅ useMemo 缓存复杂计算
- ✅ useCallback 缓存函数引用
- ✅ 动态加载非首屏组件
- ✅ 使用 React.memo 避免重渲染

**4. 副作用处理**

- ✅ useEffect 依赖数组准确
- ✅ 清理函数完善，避免内存泄漏
- ✅ 使用 useRef 存储可变值

**5. Context 使用**

- ✅ 按需拆分，避免大 Context
- ✅ 结合 Zustand，减少 Context 依赖
- ✅ useMemo 稳定 Context 值

**6. 类型安全**

- ✅ TypeScript 完整类型定义
- ✅ Props、State、Store 类型明确
- ✅ 避免使用 any

**7. 错误处理**

- ✅ Error Boundary 隔离错误
- ✅ 加载状态友好展示
- ✅ 错误日志记录

**8. 微前端适配**

- ✅ Store 通过 props 传递
- ✅ useSyncExternalStore 订阅外部状态
- ✅ Context 通过 Provider 共享

---

**文档版本**：1.0.0
**最后更新**：2024年
