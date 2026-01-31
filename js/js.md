## 原型，原型链
每个对象都有一个原型(prototype)，并从原型继承属性和方法。
原型本身也是一个对象，它也有自己的原型，形成了原型链。

## 0.1+0.2 不等于 0.3
因为 0.1+0.2 等于 0.30000000000000004
0.2的二进制表示为 0.001100110011001100110011001100110011001100110011001101，进了一位，实际比0.2大

## 谈谈你对 Promise 和 async/await 的理解，如何处理多个 AI接口的并发请求？
### Promise 与 async/await 的理解

#### Promise
- **概念**：Promise 是一种异步编程的解决方案，用于处理异步操作，避免回调地狱
- **状态**：包含 pending（进行中）、fulfilled（已成功）和 rejected（已失败）三种状态
- **特点**：状态一旦改变，就不会再变；支持链式调用，通过 .then() 和 .catch() 处理结果和错误
- **优势**：使异步代码更清晰，便于错误处理和流程控制

#### async/await
- **概念**：ES2017 引入的语法糖，基于 Promise，使异步代码看起来更像同步代码
- **特点**：async 函数返回一个 Promise；await 关键字只能在 async 函数中使用，用于等待 Promise 解决
- **优势**：代码更简洁易读，错误处理更直观（可使用 try/catch），调试更方便

### 处理多个 AI 接口的并发请求

#### 1. 使用 Promise.all()
```javascript
async function fetchMultipleAIEndpoints() {
  try {
    const [response1, response2, response3] = await Promise.all([
      fetch('/api/ai/chat'),
      fetch('/api/ai/image'),
      fetch('/api/ai/analysis')
    ]);
    
    const [data1, data2, data3] = await Promise.all([
      response1.json(),
      response2.json(),
      response3.json()
    ]);
    
    return { data1, data2, data3 };
  } catch (error) {
    console.error('Error fetching AI endpoints:', error);
    throw error;
  }
}
```

#### 2. 并发限制处理
当 AI 接口数量较多时，需要限制并发数：
```javascript
async function fetchWithConcurrencyLimit(urls, limit) {
  const results = [];
  const executing = [];
  
  for (const url of urls) {
    const p = fetch(url).then(res => res.json());
    results.push(p);
    
    if (limit <= urls.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  
  return Promise.all(results);
}
```

#### 3. 错误处理策略
- **全部成功**：使用 Promise.all()，任何一个失败都会 reject
- **部分成功**：使用 Promise.allSettled()，收集所有结果，包括成功和失败
- **最快响应**：使用 Promise.race()，获取第一个完成的请求结果

#### 4. 实际应用建议
- **请求分组**：将相关的 AI 请求分组处理，提高代码可读性
- **缓存机制**：对重复的 AI 请求结果进行缓存，减少 API 调用
- **超时控制**：为每个请求设置合理的超时时间，避免单个请求阻塞整体流程
- **重试机制**：对临时失败的请求实现自动重试，提高系统稳定性
- **监控与分析**：记录请求性能指标，分析优化空间

## 请解释一下 JavaScript 的事件循环（Event Loop）机制，特别是它如何影响 UI 渲染？

### 事件循环的基本概念

JavaScript 是单线程语言，为了处理异步操作，引入了事件循环（Event Loop）机制。事件循环负责协调执行代码、处理事件和执行队列中的任务。

### 宏任务与微任务

#### 宏任务（Macro Tasks）
- 包括：script 整体代码、setTimeout、setInterval、I/O 操作、UI 渲染、postMessage 等
- 执行优先级较低，每次事件循环只会执行一个宏任务

#### 微任务（Micro Tasks）
- 包括：Promise.then/catch/finally、async/await、process.nextTick（Node.js）、MutationObserver 等
- 执行优先级较高，在每个宏任务执行完成后，会立即执行所有微任务

### 事件循环的执行流程

1. 执行全局同步代码（属于宏任务）
2. 执行所有微任务
3. 执行一次 UI 渲染（如果需要）
4. 从宏任务队列中取出一个任务执行
5. 执行所有微任务
6. 重复步骤 3-5

### 事件循环如何影响 UI 渲染

1. **渲染时机**：UI 渲染发生在每次宏任务执行完成后，所有微任务执行完成之后
    宏任务 → 微任务 → UI 渲染 ：这是一个完整的循环周期
2. **渲染阻塞**：
   - 长时间运行的同步代码会阻塞 UI 渲染，导致页面卡顿
   - 大量微任务也会延迟 UI 渲染，因为微任务会在渲染前执行完毕
3. **动画流畅度**：
   - 使用 requestAnimationFrame 可以确保回调函数在 UI 渲染前执行
   - 避免在动画过程中执行重计算或重绘操作
```js
// 宏任务开始
console.log('宏任务开始');

// 微任务
Promise.resolve().then(() => {
  console.log('微任务1开始');
  // 模拟耗时操作
  for (let i = 0; i < 1000000000; i++) {}
  console.log('微任务1结束');
});

Promise.resolve().then(() => {
  console.log('微任务2开始');
  // 模拟耗时操作
  for (let i = 0; i < 1000000000; i++) {}
  console.log('微任务2结束');
});

// 宏任务结束
console.log('宏任务结束');

// 执行顺序：
// 1. 宏任务开始
// 2. 宏任务结束
// 3. 微任务1开始
// 4. 微任务1结束（耗时）
// 5. 微任务2开始
// 6. 微任务2结束（耗时）
// 7. UI 渲染（被延迟）
```
### 实际应用中的优化建议

1. **避免长任务**：将耗时操作拆分为多个小任务，使用 setTimeout 或 requestAnimationFrame
2. **合理使用微任务**：微任务适合处理需要在渲染前完成的操作，但不宜过多
3. **优化动画**：使用 CSS transform 和 opacity 进行动画，避免触发重排
4. **使用 Web Workers**：将计算密集型任务移至 Worker 线程
5. **合理安排任务顺序**：将 UI 相关的操作放在合适的时机执行

### 代码示例

```javascript
// 示例1：事件循环执行顺序
console.log('1. 同步代码开始');

setTimeout(() => {
  console.log('4. setTimeout 回调（宏任务）');
}, 0);

Promise.resolve().then(() => {
  console.log('3. Promise.then 回调（微任务）');
});

console.log('2. 同步代码结束');

// 执行结果：
// 1. 同步代码开始
// 2. 同步代码结束
// 3. Promise.then 回调（微任务）
// 4. setTimeout 回调（宏任务）

// 示例2：UI 渲染时机
console.log('开始');

// 宏任务
setTimeout(() => {
  console.log('setTimeout 执行');
  // 这里的 DOM 修改会在下一次渲染中显示
  document.body.style.backgroundColor = 'red';
}, 0);

// 微任务
Promise.resolve().then(() => {
  console.log('Promise 执行');
  // 这里的 DOM 修改会在本次渲染中显示
  document.body.style.color = 'blue';
});

console.log('结束');
// 执行顺序：
// 1. 执行同步代码（打印开始、结束）
// 2. 执行微任务（打印 Promise 执行，修改文字颜色）
// 3. 执行 UI 渲染（显示蓝色文字）
// 4. 执行宏任务（打印 setTimeout 执行，修改背景色）
// 5. 执行 UI 渲染（显示红色背景）
```

### 总结

事件循环是 JavaScript 处理异步操作的核心机制，它通过协调宏任务和微任务的执行顺序，确保代码的正确执行和 UI 的流畅渲染。理解事件循环机制有助于我们编写性能更好、用户体验更佳的代码，特别是在处理复杂的异步操作和动画效果时。



## this指针是什么
this 指针是 JavaScript 中的一个特殊变量，它指向当前执行代码的上下文对象。this 的值在函数调用时动态确定，取决于函数的调用方式。
1. 作为对象方法调用：this 指向调用该方法的对象
2. 作为普通函数调用：this 指向全局对象（浏览器中为 window，Node.js 中为 global）
3. 使用 call、apply、bind 方法调用：this 指向指定的对象
4. 箭头函数中：this 指向定义时的上下文对象，而不是调用时的上下文对象


## js中的闭包是什么
闭包（Closure）是指一个函数能够访问并操作其词法作用域外部的变量。简单来说，闭包就是一个函数，它记住了创建时的词法环境，即使在其被调用的环境中，词法环境已经不存在，也能够访问到外部的变量。
闭包的创建
1. 函数嵌套：在一个函数内部定义另一个函数
2. 内部函数引用外部函数的变量
3. 外部函数返回内部函数
闭包的作用
1. 实现数据封装和隐藏：闭包可以将函数内部的变量隐藏起来，只暴露必要的接口
2. 实现柯理化函数：通过闭包可以实现函数的柯理化，将多参数函数转换为单参数函数
3. 实现回调函数：在异步操作中，闭包可以确保回调函数在正确的环境中执行
闭包的注意事项
1. 内存泄漏：如果闭包引用了外部函数的变量，而外部函数的变量又引用了闭包，就会导致内存泄漏

## 如何判断数据类型
1. typeof 运算符：可以判断基本数据类型（string、number、boolean、undefined、symbol）
2. instanceof 运算符：可以判断对象的具体类型
3. constructor 属性：可以判断对象的构造函数
4. Object.prototype.toString.call() 方法：可以判断所有数据类型，包括对象、数组、正则表达式等

## js对象存储在什么地方？对象中的值存储在什么地方？基础数据类型存储在哪里？
1. js对象存储在堆内存中
2. 对象中的值（属性和方法）存储在堆内存中
3. 基础数据类型（string、number、boolean、undefined、symbol）存储在栈内存中

## 如果浏览器中什么任务都没有，是否存在事件循环的概念？
事件循环是浏览器中处理异步操作的机制，它确保了代码的正确执行和 UI 的流畅渲染。即使浏览器中没有任何任务需要执行，事件循环仍然存在，它会不断检查任务队列，将需要执行的任务放到调用栈中执行。

## js是单线程的，那异步任务是如何执行？
1. 事件循环（Event Loop）：JavaScript 引擎采用事件循环机制来处理异步任务。事件循环包括调用栈（Call Stack）、任务队列（Task Queue）和微任务队列（Microtask Queue）。
2. 调用栈：用于存储当前正在执行的函数调用。
3. 任务队列：用于存储异步任务，如定时器回调、事件回调等。
4. 微任务队列：用于存储需要在当前任务执行完成后立即执行的任务，如 Promise 回调、MutationObserver 回调等。
5. 事件循环过程：
   - 检查调用栈是否为空，如果为空，则从任务队列中取出第一个任务并压入调用栈执行。
   - 执行任务时，可能会生成新的异步任务，这些任务会被加入任务队列。
   - 任务执行完成后，检查微任务队列是否为空，如果不为空，则将微任务队列中的所有任务依次压入调用栈执行。
   - 重复以上过程，形成事件循环。
