# AI Chat 功能架构设计文档

## 一、概述

本文档详细描述了 `text-model` 模块的架构设计。该模块实现了一个功能完整的 AI 对话系统，支持单模型对话和双模型对比模式，具备流式响应、深度思考、Markdown 渲染等核心能力。

---

## 二、目录结构

```
src/views/text-model/
├── index.tsx              # 主入口组件，负责状态管理和功能组装
├── types.ts               # 类型定义
├── constants.ts           # 常量配置
├── hooks/
│   ├── useTextModelInit.ts    # 初始化逻辑 Hook
│   ├── useThrottleMessages.ts # 消息状态管理 Hook（节流优化）
│   └── useChatHandlers.ts     # 流式数据处理 Hook
├── utils/
│   └── helpers.ts             # 工具函数
└── docs/
    └── architecture.md        # 本架构文档
```

---

## 三、核心架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           index.tsx (主组件)                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        状态管理层                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │ 模型选择状态  │  │ 消息列表状态  │  │ UI 交互状态           │  │   │
│  │  │ selectedModel│  │ messages     │  │ loading/panel/mode   │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼───────────────────────────────┐   │
│  │                        Hooks 层                                  │   │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────┐ │   │
│  │  │ useTextModelInit │ │ useThrottleMessages│ │useChatHandlers │ │   │
│  │  │ - 模型列表加载    │ │ - 消息节流更新    │ │ - 流式数据处理  │ │   │
│  │  │ - 登录状态判断    │ │ - Ref 同步管理    │ │ - Markdown解析 │ │   │
│  │  │ - API Key 管理    │ │ - 即时/节流更新   │ │                 │ │   │
│  │  └──────────────────┘ └──────────────────┘ └─────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼───────────────────────────────┐   │
│  │                        UI 组件层                                 │   │
│  │  ┌────────────┐ ┌───────────┐ ┌─────────────┐ ┌─────────────┐  │   │
│  │  │ ModelConfig│ │ ChatBox   │ │ MessageList │ │ComparisonView│  │   │
│  │  │ 模型配置栏  │ │ 输入框    │ │ 消息列表    │ │ 对比视图     │  │   │
│  │  └────────────┘ └───────────┘ └─────────────┘ └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 四、核心模块详解

### 4.1 主组件 (index.tsx)

**职责**: 作为整个功能的容器组件，负责：
- 状态集中管理
- 两种模式（单模型/对比模式）的切换逻辑
- 流式请求的生命周期管理
- 子组件的组装与协调

**核心状态**:

| 状态名 | 类型 | 说明 |
|--------|------|------|
| `selectedModelId` | `string` | 当前选中的模型 ID |
| `messages` | `Message[]` | 单模式下的消息列表 |
| `loading` | `boolean` | 是否正在加载 |
| `isComparisonMode` | `boolean` | 是否处于对比模式 |
| `leftState/rightState` | `useThrottleMessages` | 对比模式下左右面板的消息状态 |
| `modelParams` | `ModelParams` | 模型参数配置 |
| `deepThinkingEnabled` | `boolean` | 深度思考开关 |

---

### 4.2 类型定义 (types.ts)

```typescript
// 模型参数配置
interface ModelParams {
    maxTokens: number;        // 最大 token 数
    temperature: number;      // 温度参数
    topP: number;            // Top-P 采样
    repetitionPenalty: number; // 重复惩罚
    systemPrompt: string;     // 系统提示词
}

// 右侧面板类型
type RightPanelType = 'params' | 'api';
```

---

### 4.3 常量配置 (constants.ts)

```typescript
// 默认模型参数
const DEFAULT_MODEL_PARAMS: ModelParams = {
    maxTokens: 4096,
    temperature: 1.0,
    topP: 0.9,
    repetitionPenalty: 1.0,
    systemPrompt: 'You are a helpful assistant...',
};

// API Key 本地存储键名
const SELECTED_API_KEY_STORAGE_KEY = 'selectedApiKey';
```

---

### 4.4 Hooks 层

#### 4.4.1 useTextModelInit - 初始化 Hook

**职责**: 处理页面初始化所需的数据加载和状态管理

**核心功能**:
1. **登录状态判断**: 通过 `userService.getUserInfo()` 判断用户是否登录
2. **模型列表加载**: 根据登录状态调用不同的 API 获取模型列表
3. **API Key 管理**: 缓存和持久化用户选择的 API Key
4. **URL 参数解析**: 支持通过 URL 参数指定默认模型

**数据流**:
```
初始化 → 判断登录状态 → 加载模型列表 → 处理URL参数 → 设置默认模型
                ↓
        缓存 API Key (localStorage)
```

**返回值**:
```typescript
{
    isLoggedIn,           // 登录状态
    modelOptions,         // 模型选项列表
    selectedModelId,      // 选中的模型 ID
    setSelectedModelId,   // 设置模型 ID
    selectedApiKey,       // 选中的 API Key ID
    setSelectedApiKey,    // 设置 API Key
    deepThinkingEnabled,  // 深度思考开关
    setDeepThinkingEnabled,
    handleApiKeysLoaded,  // API Key 加载回调
    getApiKeyValue,       // 获取 API Key 值
}
```

---

#### 4.4.2 useThrottleMessages - 消息状态管理 Hook

**职责**: 管理消息列表状态，通过节流机制优化流式输出时的渲染性能

**设计背景**:
流式响应时，数据块（Chunk）会高频到达（每 50-100ms），如果每次都触发 React 状态更新，会导致：
- 大量重渲染，页面卡顿
- CPU 占用过高
- 用户体验差

**解决方案**:
采用「Ref + State + Timer」组合实现节流更新：

```
┌─────────────────────────────────────────────────────┐
│                   流式数据到达                        │
│                        ↓                            │
│              更新 messagesRef.current               │
│              (立即更新，无渲染)                       │
│                        ↓                            │
│              启动/重置 16ms 定时器                    │
│                        ↓                            │
│              定时器触发 → setMessages()              │
│              (触发 React 渲染)                       │
└─────────────────────────────────────────────────────┘
```

**关键代码解析**:
```typescript
const messagesRef = useRef<Message[]>([]);     // 最新数据引用
const [messages, setMessages] = useState<Message[]>([]); // 渲染状态
const updateTimerRef = useRef<NodeJS.Timeout | null>(null); // 节流定时器

// 节流更新：16ms 内只触发一次渲染
const throttleUpdateMessages = useCallback((newMessages: Message[]) => {
    messagesRef.current = newMessages;          // 1. 立即更新 Ref
    if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);   // 2. 清除旧定时器
    }
    updateTimerRef.current = setTimeout(() => {
        setMessages([...messagesRef.current]);  // 3. 16ms 后触发渲染
        updateTimerRef.current = null;
    }, 16);  // 16ms ≈ 60fps
}, []);

// 即时更新：用于关键操作（如发送消息、错误处理）
const immediateUpdateMessages = useCallback((newMessages: Message[]) => {
    messagesRef.current = newMessages;
    if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);   // 取消待执行的节流更新
    }
    setMessages([...newMessages]);              // 立即渲染
}, []);
```

---

#### 4.4.3 useChatHandlers - 流式数据处理 Hook

**职责**: 解析流式响应的数据块（Chunk），更新消息状态

**流式数据格式**:
```typescript
// OpenAI 兼容格式
{
    choices: [{
        delta: {
            role: 'assistant',           // 角色标识
            content: '文本内容...',       // 普通回复内容
            reasoning_content: '思考...'  // 深度思考内容
        }
    }]
}
```

**处理逻辑流程**:
```
收到 Chunk
    ↓
检查 delta 类型
    ├── hasReasoningContent → 拼接到 reasoning_content 字段
    ├── hasContent → 拼接到 content 字段 + 解析 Markdown
    └── hasRole → 标记开始响应
    ↓
调用 throttleUpdateMessages 更新状态
```

**Markdown 解析优化**:
```typescript
// 流式解析 Markdown，避免全量重新解析
if (markdownReady && parseMarkdown) {
    renderedHtml = await parseMarkdown(newContent, true);  // append=true 增量解析
}
```

---

### 4.5 工具函数 (utils/helpers.ts)

#### checkDeepThinkingSupport

**功能**: 检查模型是否支持深度思考功能

**实现逻辑**:
```typescript
export const checkDeepThinkingSupport = (model: ExperienceModel | undefined): boolean => {
    if (!model) return false;

    // ModalTypes 可能是数组或 JSON 字符串
    if (Array.isArray(model.ModalTypes)) {
        return model.ModalTypes.includes('Deep Thinking');
    } else if (typeof model.ModalTypes === 'string') {
        const modalTypes = JSON.parse(model.ModalTypes);
        return modalTypes.includes('Deep Thinking');
    }
    return false;
};
```

---

## 五、核心业务流程

### 5.1 消息发送流程

```
用户输入 → handleSend()
              ↓
         构建消息历史（包含 system prompt）
              ↓
         预更新 UI（显示用户消息 + 加载气泡）
              ↓
         调用 createChatStream 发起流式请求
              ↓
         ┌─────────────────────────────┐
         │     流式响应循环              │
         │  onChunk → handleChunk()    │
         │     → 解析 delta             │
         │     → 拼接内容               │
         │     → 节流更新 UI            │
         └─────────────────────────────┘
              ↓
         onDone → 标记消息完成
              或
         onError → 显示错误气泡
```

### 5.2 对比模式流程

```
点击对比按钮 → handleEnterComparisonMode()
                    ↓
              初始化左右面板状态
              （左侧继承当前状态）
                    ↓
              自动推荐右侧模型
              （按厂商分组，选择不同厂商）
                    ↓
              ┌─────────────────────────────────┐
              │        对比对话                  │
              │  handleComparisonSend()         │
              │     → 同时向两个模型发起请求      │
              │     → 独立处理各自的流式响应      │
              │     → 独立的节流更新机制          │
              └─────────────────────────────────┘
                    ↓
              退出对比 → 缓存右侧状态
                       → 恢复左侧状态到主界面
```

---

## 六、性能优化策略

### 6.1 节流渲染

| 策略 | 实现位置 | 效果 |
|------|----------|------|
| 消息更新节流 | `useThrottleMessages` | 将渲染频率从 100+ 次/秒 降至 60 次/秒 |
| Ref 同步 | `messagesRef` | 避免闭包陷阱，保证数据一致性 |

### 6.2 流式 Markdown 解析

- 使用增量解析（`append=true`），避免每次全量解析
- 异步解析不阻塞主线程

### 6.3 请求取消

```typescript
// 存储取消函数
abortRef.current = abort;

// 取消请求
const handleCancel = useCallback(() => {
    if (abortRef.current) {
        abortRef.current();
        abortRef.current = null;
    }
}, []);
```

---

## 七、状态管理总结

```
┌─────────────────────────────────────────────────────────────────┐
│                        全局状态                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ useTextModelInit                                          │   │
│  │  - isLoggedIn: 登录状态                                    │   │
│  │  - modelOptions: 模型列表                                  │   │
│  │  - selectedModelId: 当前模型                               │   │
│  │  - selectedApiKey: API Key 选择                            │   │
│  │  - deepThinkingEnabled: 深度思考开关                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     单模式状态                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ useThrottleMessages                                       │   │
│  │  - messages: 消息列表                                      │   │
│  │  - messagesRef: 消息引用（用于流式更新）                    │   │
│  │  - loading: 加载状态                                       │   │
│  │  - modelParams: 模型参数                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     对比模式状态                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────┐       │
│  │ 左侧面板                  │  │ 右侧面板                  │       │
│  │  - leftState (messages)  │  │  - rightState (messages) │       │
│  │  - leftModelId           │  │  - rightModelId          │       │
│  │  - leftLoading           │  │  - rightLoading          │       │
│  │  - leftModelParams       │  │  - rightModelParams      │       │
│  │  - leftAbortRef          │  │  - rightAbortRef         │       │
│  └─────────────────────────┘  └─────────────────────────┘       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 缓存（用于退出对比模式时保留数据）                          │   │
│  │  - comparisonRightMessagesCache: 右侧消息缓存              │   │
│  │  - comparisonRightModelIdCache: 右侧模型缓存               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 八、扩展性设计

### 8.1 易于扩展的点

1. **新增模型参数**: 在 `types.ts` 的 `ModelParams` 中添加新字段
2. **新增右侧面板**: 在 `RightPanelType` 中添加新类型
3. **新增消息类型**: 扩展 `Message` 接口
4. **新增对比模式面板**: 参考 `leftState/rightState` 模式添加

### 8.2 Hook 复用

所有 Hooks 都是独立的、可复用的：
- `useThrottleMessages` 可用于任何需要节流更新的场景
- `useChatHandlers` 可用于任何需要处理流式数据的场景
- `useTextModelInit` 封装了完整的初始化逻辑

---

## 九、关键代码索引

| 功能 | 文件位置 | 行号 |
|------|----------|------|
| 主组件入口 | `index.tsx` | 38-705 |
| 流式请求发送 | `index.tsx` | 197-228 |
| 节流更新实现 | `hooks/useThrottleMessages.ts` | 17-26 |
| 流式数据处理 | `hooks/useChatHandlers.ts` | 27-121 |
| 模型列表加载 | `hooks/useTextModelInit.ts` | 66-115 |
| 对比模式切换 | `index.tsx` | 299-349 |

---

## 十、总结

本 AI Chat 功能采用**分层架构**设计：

1. **UI 层**: 组合式组件，职责单一
2. **状态层**: Hooks 封装，关注点分离
3. **数据层**: 流式处理，节流优化

**核心亮点**:
- 流式响应的节流渲染机制，保证 60fps 流畅体验
- 对比模式的独立状态管理，支持状态缓存恢复
- 深度思考功能的无缝集成
- 完善的错误处理和请求取消机制
