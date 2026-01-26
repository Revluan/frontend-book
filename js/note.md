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