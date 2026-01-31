## node中进程和线程的通信方式
进程间通信（IPC）：
1. Child Process 模块 ：
   - spawn 、 exec 、 fork 创建子进程
   - 通过 stdio 流（stdin/stdout/stderr）传递数据
   - fork 方式会自动创建 IPC 通道，通过 process.send() 和 process.on('message') 通信
2. Cluster 模块 ：
   - 基于 fork 实现，主进程与工作进程通过 IPC 通道通信
   - 支持消息传递和句柄传递（如 TCP 套接字）
3. 命名管道/套接字 ：
   - 使用 net 模块创建 Unix 域套接字或 TCP 套接字
   - 适用于不同 Node.js 进程间的通信
4. 共享文件/数据库 ：
   - 通过文件、Redis、MongoDB 等共享存储实现通信
   - 适用于低频率、非实时的场景
线程间通信（Worker Threads）：
1. Worker Threads 模块 ：
   - 主线程与工作线程通过 postMessage() 发送消息
   - 工作线程通过 parentPort.on('message') 接收消息
   - 支持结构化克隆（传递对象）和 SharedArrayBuffer（共享内存）
2. 共享内存 ：
   - 使用 SharedArrayBuffer 实现线程间直接内存共享
   - 配合 Atomics API 进行原子操作，避免竞态条件
3. 消息传递 ：
   - 默认通过结构化克隆传递数据，适合小量数据
   - 避免了共享内存的同步问题，更安全
进程通信通过 IPC 通道或共享存储，线程通信通过 Worker Threads 模块的消息传递或共享内存，选择方式需根据任务类型和性能需求