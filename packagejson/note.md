## dependencies 和 devDependencies 的区别及打包行为
dependencies
- 运行时依赖
- 生产环境需要的依赖
- 会被打包到生产环境的 bundle 中

devDependencies
- 开发时依赖
- 只在开发环境需要的依赖

### 打包到产物中的机制
基本原则: 依赖是否被打包，取决于代码是否实际使用，而不是在哪个字段中声明
1. 声明位置 ≠ 打包行为
```json
{
  "dependencies": {
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "webpack": "^5.88.0"
  }
}
```
lodash 在 dependencies 中，但如果代码从未导入使用，不会被打包
webpack 在 devDependencies 中，但如果是构建工具（如 Next.js 内部使用 webpack），会在构建时使用，不会进入客户端代码

2. 构建时依赖 vs 运行时依赖
```js
// 场景分析：
// ✅ 正确分类示例
{
  "dependencies": {
    "react": "^18.2.0",         // 运行时必需
    "uuid": "^9.0.0"            // 运行时生成 ID
  },
  "devDependencies": {
    "@types/react": "^18.2.0",  // 仅 TS 类型检查
    "eslint": "^8.52.0"         // 仅代码检查
  }
}

// ❌ 错误分类示例
{
  "dependencies": {
    "typescript": "^5.2.0"      // 错误！TS 只在开发时使用
  },
  "devDependencies": {
    "axios": "^1.5.0"           // 错误！代码中实际使用了 axios
  }
}
```
3. Node.js 环境 vs 浏览器环境
```json
{
  "dependencies": {
    "express": "^4.18.2"        // 服务器端运行（Node.js）
  },
  "devDependencies": {
    "vite": "^4.5.0"            // 只在开发构建时使用
  }
}
```

### 如何正确分类依赖
```js
// 判断流程图：
1. 这个包是否在 production 环境中需要？
   ├── 是 → 放入 dependencies
   └── 否 → 进入下一步
   
2. 这个包是否只在开发、测试、构建时使用？
   ├── 是 → 放入 devDependencies
   └── 否 → 重新评估
```

### 最佳实践
1. 使用正确的安装命令
```bash
# 安装生产依赖
npm install package-name

# 安装开发依赖
npm install --save-dev package-name
# 或
npm install -D package-name

# 查看依赖树
npm ls --depth=0
npm ls package-name  # 查看特定包
```

2. 定期清理未使用的依赖
```bash
# 使用工具检查未使用的依赖
npx depcheck
# 删除未使用的依赖
npm uninstall package-name
```
### 总结
特性	dependencies	devDependencies
用途	运行时必需	开发/构建时使用
生产安装	✅ 会安装	❌ 不安装
是否打包	取决于是否被代码使用	一般不会，除非被代码引用
示例	react, axios, lodash	typescript, eslint, jest