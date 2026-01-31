## 为什么react hook不能在条件判断里执行呢？
核心原因：Hook依赖于调用顺序的一致性
破坏了React内部Hook链表的调用顺序一致性 ，导致React无法正确关联每个Hook的状态和副作用，从而引发运行时错误。

React通过内部维护一个“Hook链表”来管理组件的状态和副作用，链表中的每个Hook节点与组件中对应的Hook调用一一对应。
1. Hook链表的构建 ：首次渲染时，React会按照Hook在代码中的出现顺序，依次创建Hook节点并加入链表（如 useState 创建状态节点， useEffect 创建副作用节点）。
2. 状态的关联 ：后续渲染时，React会按照相同的顺序遍历链表，将每个Hook调用与对应的节点关联（例如，第一个 useState 始终对应链表的第一个节点）。
3. 条件判断的影响 ：若在条件判断中使用Hook（如 if (condition) { useState() } ），当条件为 false 时，该Hook调用会被跳过，导致后续渲染时Hook的调用顺序与首次渲染不一致。React无法正确匹配链表节点，从而抛出错误。

## 创建了Context上下文之后，Contextr怎么知道自己可以传到对应的子组件？
Context的传递机制基于 组件树层级查找 和 Provider-Consumer绑定 ，核心原理如下：
1. Context的创建与Provider的作用
- 通过 React.createContext() 创建Context对象时，会同时生成一个 Provider 组件。
- Provider 组件接收 value 属性，用于存储需要共享的数据，并将该数据“注入”到其包裹的组件树中。
2. React的向上查找机制
当子组件通过 useContext(MyContext) 或 Context.Consumer 访问Context时：
- React会 从当前组件开始，沿着组件树向上遍历 ，查找最近的同名 Context.Provider 。
- 找到Provider后，读取其 value 属性并返回给子组件。
- 若未找到Provider，则返回Context创建时的默认值（ React.createContext(defaultValue) 中的 defaultValue ）。
3. 作用域的界定
- Provider的包裹范围 决定了哪些子组件可以访问Context：只有被Provider直接或间接包裹的子组件，才能通过向上查找找到该Provider。
- 不同层级的同名Provider会形成“覆盖”效果：子组件优先获取最近的Provider的value。

```js
// 1. 创建Context
const ThemeContext = React.createContext('light');

// 2. Provider包裹子组件
function App() {
  return (
    <ThemeContext.Provider value="dark"> {/* 注入value为"dark" */}
      <Header /> {/* 可访问Context */}
    </ThemeContext.Provider>
  );
}

// 3. 子组件通过useContext获取
function Header() {
  const theme = useContext(ThemeContext); // 向上查找最近的ThemeContext.Provider，获取value="dark"
  return <h1 style={{ color: theme }}>Header</h1>;
}
```
Context通过 Provider注入数据 ，子组件通过 React内部向上遍历查找机制，定位到最近的同名Provider，从而实现跨组件数据传递。Provider的包裹范围界定了Context的作用域，确保数据只传递给对应的子组件。