# 手写题：实现一个带并发限制的异步调度器 Scheduler
```js
class Scheduler {
  constructor(concurrencyLimit) {
    this.concurrencyLimit = concurrencyLimit;
    this.runningTasks = 0;
    this.taskQueue = [];
  }

  // 添加任务到调度器
  add(task) {
    return new Promise((resolve, reject) => {
      // 将任务包装成带回调的函数
      const wrappedTask = async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.runningTasks--;
          this._processQueue();
        }
      };

      // 如果当前运行任务数小于限制，立即执行
      if (this.runningTasks < this.concurrencyLimit) {
        this.runningTasks++;
        wrappedTask();
      } else {
        // 否则加入队列
        this.taskQueue.push(wrappedTask);
      }
    });
  }

  // 处理任务队列
  _processQueue() {
    if (this.taskQueue.length > 0 && this.runningTasks < this.concurrencyLimit) {
      this.runningTasks++;
      const nextTask = this.taskQueue.shift();
      nextTask();
    }
  }
}
```
构造函数 ：
- concurrencyLimit ：设置并发限制数
- runningTasks ：跟踪当前正在运行的任务数
- taskQueue ：存储等待执行的任务队列
add 方法 ：
- 接收一个返回 Promise 的异步任务函数
- 返回一个新的 Promise，用于捕获任务的执行结果
- 包装任务函数，添加错误处理和任务完成后的清理逻辑
- 根据当前运行任务数决定立即执行还是加入队列
_processQueue 方法 ：
- 私有方法，用于处理任务队列
- 当队列中有任务且未达到并发限制时，取出一个任务执行
```js
// 创建一个并发限制为 2 的调度器
const scheduler = new Scheduler(2);
// 模拟异步任务
const asyncTask = (id, duration) => {
  return () => new Promise(resolve => {
    console.log(`Task ${id} started`);
    setTimeout(() => {
      console.log(`Task ${id} completed`);
      resolve(id);
    }, duration);
  });
};

// 添加任务
scheduler.add(asyncTask(1, 2000))
  .then(result => console.log(`Task ${result} resolved`));

scheduler.add(asyncTask(2, 1000))
  .then(result => console.log(`Task ${result} resolved`));

scheduler.add(asyncTask(3, 1500))
  .then(result => console.log(`Task ${result} resolved`));

scheduler.add(asyncTask(4, 500))
  .then(result => console.log(`Task ${result} resolved`));
```
```txt
Task 1 started
Task 2 started
Task 2 completed
Task 2 resolved
Task 3 started
Task 1 completed
Task 1 resolved
Task 4 started
Task 4 completed
Task 4 resolved
Task 3 completed
Task 3 resolved
```
## 代码解释
1. 构造函数 ：
   - concurrencyLimit ：设置并发限制数
   - runningTasks ：跟踪当前正在运行的任务数
   - taskQueue ：存储等待执行的任务队列
2. add 方法 ：
   - 接收一个返回 Promise 的异步任务函数
   - 返回一个新的 Promise，用于捕获任务的执行结果
   - 包装任务函数，添加错误处理和任务完成后的清理逻辑
   - 根据当前运行任务数决定立即执行还是加入队列
3. _processQueue 方法 ：
   - 私有方法，用于处理任务队列
   - 当队列中有任务且未达到并发限制时，取出一个任务执行
## 使用示例
```js
// 创建一个并发限制为 2 的调度器
const scheduler = new Scheduler(2);

// 模拟异步任务
const asyncTask = (id, duration) => {
  return () => new Promise(resolve => {
    console.log(`Task ${id} started`);
    setTimeout(() => {
      console.log(`Task ${id} completed`);
      resolve(id);
    }, duration);
  });
};

// 添加任务
scheduler.add(asyncTask(1, 2000))
  .then(result => console.log(`Task ${result} resolved`));

scheduler.add(asyncTask(2, 1000))
  .then(result => console.log(`Task ${result} resolved`));

scheduler.add(asyncTask(3, 1500))
  .then(result => console.log(`Task ${result} resolved`));

scheduler.add(asyncTask(4, 500))
  .then(result => console.log(`Task ${result} resolved`));
```
### 执行结果
```txt
Task 1 started
Task 2 started
Task 2 completed
Task 2 resolved
Task 3 started
Task 1 completed
Task 1 resolved
Task 4 started
Task 4 completed
Task 4 resolved
Task 3 completed
Task 3 resolved
```
## 复杂度分析
- 时间复杂度 ：
  
  - 添加任务：O(1) - 直接加入队列或立即执行
  - 任务执行：取决于任务本身的复杂度
- 空间复杂度 ：
  
  - O(n) - 其中 n 是任务数量，需要存储等待执行的任务
## 扩展和优化
### 1. 取消任务功能
```js
class Scheduler {
  // 原有代码...

  // 添加取消功能
  add(task) {
    let isCancelled = false;
    let taskIndex = -1;

    return {
      promise: new Promise((resolve, reject) => {
        const wrappedTask = async () => {
          if (isCancelled) {
            reject(new Error('Task cancelled'));
            return;
          }

          try {
            const result = await task();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            this.runningTasks--;
            this._processQueue();
          }
        };

        if (this.runningTasks < this.concurrencyLimit) {
          this.runningTasks++;
          wrappedTask();
        } else {
          taskIndex = this.taskQueue.length;
          this.taskQueue.push(wrappedTask);
        }
      }),
      
      cancel() {
        if (taskIndex !== -1) {
          // 从队列中移除
          this.taskQueue.splice(taskIndex, 1);
          isCancelled = true;
        }
      }
    };
  }
}
```
### 2. 任务优先级
```js
class Scheduler {
  constructor(concurrencyLimit) {
    // 原有代码...
    this.priorityTaskQueue = [];
  }

  // 添加带优先级的任务
  add(task, priority = 0) {
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        // 原有代码...
      };

      if (this.runningTasks < this.concurrencyLimit) {
        this.runningTasks++;
        wrappedTask();
      } else {
        // 按优先级插入队列
        const taskWithPriority = { task: wrappedTask, 
        priority };
        let inserted = false;
        
        for (let i = 0; i < this.taskQueue.length; i++) {
          if (taskWithPriority.priority > this.taskQueue[i].
          priority) {
            this.taskQueue.splice(i, 0, taskWithPriority);
            inserted = true;
            break;
          }
        }
        
        if (!inserted) {
          this.taskQueue.push(taskWithPriority);
        }
      }
    });
  }

  // 修改处理队列方法
  _processQueue() {
    if (this.taskQueue.length > 0 && this.runningTasks < this.
    concurrencyLimit) {
      this.runningTasks++;
      const nextTask = this.taskQueue.shift().task;
      nextTask();
    }
  }
}
```
### 3. 统计和监控
```js
class Scheduler {
  constructor(concurrencyLimit) {
    // 原有代码...
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0
    };
    this.startTimes = new Map();
  }

  add(task) {
    this.stats.totalTasks++;
    const taskId = Symbol();
    
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        const startTime = Date.now();
        this.startTimes.set(taskId, startTime);
        
        try {
          const result = await task();
          const executionTime = Date.now() - startTime;
          this._updateStats(true, executionTime);
          resolve(result);
        } catch (error) {
          const executionTime = Date.now() - startTime;
          this._updateStats(false, executionTime);
          reject(error);
        } finally {
          this.startTimes.delete(taskId);
          this.runningTasks--;
          this._processQueue();
        }
      };

      // 原有逻辑...
    });
  }

  _updateStats(success, executionTime) {
    if (success) {
      this.stats.completedTasks++;
    } else {
      this.stats.failedTasks++;
    }
    
    // 简单的移动平均计算
    const totalExecutions = this.stats.completedTasks + this.
    stats.failedTasks;
    this.stats.averageExecutionTime = 
      (this.stats.averageExecutionTime * (totalExecutions - 1) 
      + executionTime) / totalExecutions;
  }

  getStats() {
    return { ...this.stats };
  }
}
```
### 技术要点总结
1. 核心设计 ：
   - 使用队列管理等待执行的任务
   - 跟踪当前运行任务数，确保不超过并发限制
   - 任务完成后自动从队列中取出下一个任务执行
2. Promise 处理 ：
   - 正确处理异步任务的 resolve 和 reject
   - 确保每个添加的任务都返回一个 Promise，便于外部使用
3. 错误处理 ：
   - 捕获任务执行过程中的错误，避免影响整个调度器
   - 确保即使任务失败也能继续处理队列中的其他任务
4. 扩展性 ：
   - 可以轻松添加取消任务、任务优先级、统计监控等功能
   - 适合处理 I/O 密集型任务，如网络请求、文件操作等
5. 应用场景 ：
   - 批量 API 请求
   - 图片上传/下载
   - 数据抓取
   - 任何需要控制并发数的异步操作
### 面试中的常见问题
1.Q: 为什么需要并发限制？
  A: 防止过多并发任务导致系统资源耗尽，如网络连接数限制、服务器请求限制等
2.Q: 如何处理任务执行过程中的错误？
  A: 捕获错误并通过 Promise reject 传递，同时确保调度器继续正常工作
3.Q: 如何实现任务优先级？
  A: 在任务队列中按优先级排序，取出任务时按优先级顺序执行
4.Q: 如何取消已加入队列但尚未执行的任务？
  A: 从任务队列中移除对应的任务，并处理相关的 Promise
5.Q: 这个实现有什么潜在问题？
  A: 长时间运行的任务可能会阻塞队列，可考虑添加任务超时机制


# 手写题：请实现一个带有“立即执行”选项的防抖函数（Debounce）

## 完整实现

```javascript
function debounce(func, wait, immediate = false) {
  let timeout;
  let result;

  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) {
        result = func.apply(this, args);
      }
    };

    const callNow = immediate && !timeout;

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) {
      result = func.apply(this, args);
    }

    return result;
  };
}
```

## 代码解释

1. **参数说明**：
   - `func`：需要防抖的函数
   - `wait`：等待时间（毫秒）
   - `immediate`：是否立即执行，默认为 false

2. **核心逻辑**：
   - `timeout`：存储定时器ID
   - `result`：存储函数执行结果
   - `later`：定时器回调函数，用于在等待时间后执行原函数
   - `callNow`：判断是否需要立即执行

3. **执行流程**：
   - 每次调用防抖函数时，先清除之前的定时器
   - 如果设置了立即执行且当前没有定时器，则立即执行原函数
   - 重新设置定时器，在等待时间后执行原函数（如果不是立即执行模式）

## 使用示例

```javascript
// 示例1：非立即执行模式（默认）
const debouncedSearch = debounce(function(query) {
  console.log('Searching for:', query);
  // 实际的搜索逻辑
}, 300);

// 连续调用，只会在最后一次调用后300ms执行
input.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});

// 示例2：立即执行模式
const debouncedClick = debounce(function() {
  console.log('Button clicked!');
  // 实际的点击处理逻辑
}, 1000, true);

// 点击按钮时会立即执行，然后在1000ms内的重复点击会被忽略
button.addEventListener('click', debouncedClick);
```

## 技术要点

1. **闭包**：利用闭包保存 `timeout` 和 `result` 变量的状态
2. **this 绑定**：使用 `apply` 方法确保原函数的 `this` 指向正确
3. **参数传递**：使用剩余参数语法 `...args` 传递所有参数
4. **立即执行逻辑**：通过 `immediate` 标志和 `!timeout` 判断实现
5. **结果返回**：保存并返回原函数的执行结果

## 常见应用场景

- **搜索输入**：用户输入停止后再发送搜索请求
- **表单验证**：用户输入停止后再进行表单验证
- **窗口调整**：窗口调整停止后再执行布局计算
- **按钮点击**：防止用户重复点击按钮触发多次操作
- **滚动事件**：滚动停止后再执行相关逻辑

## 与节流（Throttle）的区别

- **防抖（Debounce）**：将多次执行变为最后一次执行
- **节流（Throttle）**：将多次执行变为每隔一段时间执行一次

在选择使用哪种技术时，需要根据具体场景判断：
- 对于需要等待用户操作完成后再执行的场景，使用防抖
- 对于需要在一段时间内定期执行的场景，使用节流。