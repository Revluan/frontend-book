# Monorepo 架构学习笔记（Turborepo）

## 先回答你的核心问题

可以拆分。  
你现在的做法是「应用和共享依赖在同一个仓库」；你说的另一种做法是「共享依赖单独一个仓库（也可以是独立 monorepo），业务项目作为外部消费者去安装它」。

两种都常见，没有绝对谁更好，关键是你的团队规模、发布节奏和协作方式。

---

## 架构 A：应用 + 共享包同仓（你当前结构）

```text
my-turborepo/
  apps/
    web
    docs
  packages/
    ui
    utils
    eslint-config
```

### 工作方式
- `apps/*` 直接依赖 `packages/*`（workspace 本地链接）
- 改 `packages/ui` 代码，`apps/web` 或 `apps/docs` 本地开发时通常会立刻感知到变更
- 一次提交可以同时改「业务 + 公共包」

### 优点
- 开发反馈快：本地联调最顺畅
- 跨项目改动原子化：一个 PR 可以同时改 app 和 package
- 版本心智负担低：很多场景不需要先发版再消费
- 统一工具链：eslint、tsconfig、CI、turbo 缓存共享

### 缺点
- 仓库会变大，权限边界不够强
- 共享包复用到“仓库外项目”时不自然
- CI 和发布策略可能逐步变复杂

---

## 架构 B：共享包拆到独立仓库（可为独立 monorepo）

```text
repo-shared/           (只放公共包)
  packages/
    ui
    utils

repo-app-a/            (业务项目 A)
repo-app-b/            (业务项目 B)
```

### 工作方式
- 共享包在 `repo-shared` 内开发、测试、发布（如 npm 私有源）
- 业务仓库通过版本号安装：`"@company/ui": "^1.4.0"`
- 业务升级共享包时，要改业务仓库 `package.json` 版本并回归测试

### 优点
- 边界清晰：共享层和业务层职责分离
- 可被多个独立项目/团队复用
- 发布和权限控制更专业（更接近“平台团队”模式）

### 缺点
- 本地联调成本更高（通常要 `npm link`/`yalc`/本地 registry 等）
- 版本发布链条变长：开发 -> 发版 -> 业务升级 -> 回归
- 依赖升级治理需要纪律（变更日志、语义化版本、兼容策略）

---

## 你提到的“版本升级同步修改”是否必然？

是的，在“拆仓 + 外部消费”模式下，这是常态：
- 共享仓库发布新版本后
- 业务仓库要显式升级依赖版本（手动或自动化 PR）
- 然后跑测试与验证

这其实是好事：  
它让“升级”变成一个可审计、可回滚、可灰度的显式动作，而不是隐式漂移。

---

## 两种架构的对比（决策视角）

| 维度 | 同仓（当前） | 拆仓（共享独立） |
|---|---|---|
| 本地联调效率 | 高 | 中-低 |
| 版本管理成本 | 低 | 中-高 |
| 跨团队边界 | 弱 | 强 |
| 发布流程 | 可简化 | 更规范 |
| 适合阶段 | 早期/中小团队 | 多团队/平台化阶段 |

---

## 推荐的学习路径（从易到难）

1. 先把当前同仓模式吃透（Turborepo filter、task pipeline、缓存）  
2. 在同仓内先建立“包发布思维”（changelog、semver、breaking change）  
3. 再尝试把 `ui/utils` 拆到独立仓库，体验完整“发布->升级->回归”流程  
4. 最后决定是否长期拆仓（按团队协作成本来选，不按“看起来高级”来选）

---

## 一个实用判断标准

当你出现以下信号时，可以认真考虑拆仓：
- 共享包被多个独立业务仓库消费
- 共享包需要独立发布节奏与严格版本治理
- 团队权限边界、CI 资源隔离诉求明显
- 共享层已有“平台团队”角色

如果你还在快速迭代产品、团队规模不大：  
优先保持同仓，通常性价比最高。

---

## 总结

你现在的理解是对的：
- 架构 A（同仓）= 开发体验最好，改公共包本地很快看到效果
- 架构 B（拆仓）= 工程边界更清晰，但升级流程更正式，也更有成本

学习顺序建议：先精通 A，再有意识地实践 B。这样你会真正理解“为什么拆”，而不是“为了拆而拆”。


# 拆仓架构下：多个 `packages` 能否单独发布？

可以。**一个仓库里放多个包（monorepo），和「每个包单独发 npm」并不矛盾。**

---

## 核心概念

- **仓库（repo）**：Git 里的一份代码树，可以包含很多目录。
- **包（package）**：每个有独立 `package.json` 且带有 **`name` + `version`** 的目录，在 npm 眼里就是**一个可发布的单元**。
- **发布（publish）**：对某个目录执行 `npm publish`（或 pnpm/yarn 的等价命令），发布的是**该目录 `package.json` 里声明的那个 `name`**，不是整个仓库名。

因此：`packages/ui`、`packages/utils`、`packages/eslint-config` 只要各自有合法的 `package.json`，就可以**分别**发布成例如 `@your-scope/ui`、`@your-scope/utils` 等。

---

## 拆仓后典型布局（只放工具/组件）

```text
repo-shared/
  packages/
    ui/              → @your-scope/ui
    utils/           → @your-scope/utils
    eslint-config/   → @your-scope/eslint-config
  package.json       （根：workspaces + turbo 脚本，通常 **private: true**，根本身一般不发 npm）
  turbo.json
```

- **根目录**常设为 `private: true`，只负责编排任务，**不必**作为一个 npm 包发布。
- **每个子包**各自 `name` / `version`，按需单独 `publish`。

---

## 「单独发布」具体指什么？

| 含义 | 是否成立 |
|------|----------|
| 改 `utils` 只发 `utils`，不必发 `ui` | ✅ 可以（只要版本与变更对应） |
| 消费者只装 `@your-scope/utils`，不装 `ui` | ✅ 可以（依赖按需声明） |
| 一次命令把仓库里所有包都发一遍 | ✅ 也可以（用脚本 / Changesets / CI 矩阵） |

所以：**多包 monorepo = 多个发布单元共存于同一仓库**，不是「整仓打一个包」。

---

## 包与包之间互相依赖怎么办？

同仓开发时常用 workspace 协议，例如：

```json
"@your-scope/utils": "workspace:*"
```

**发布到 npm 前**需要变成真实版本（或由工具在发布时改写），例如：

```json
"@your-scope/utils": "^1.2.0"
```

否则外部项目从 registry 安装时解析不到 `workspace:*`。

实践上常见做法：

- 用 **Changesets**（或类似工具）在一次 PR 里声明「哪些包要升版本、谁依赖谁」，发布时自动算版本与依赖关系；或  
- 手动维护各包 `version` 与相互的 semver 范围（小团队可行，包多了会累）。

---

## 和 Turborepo 的关系

Turborepo 管的是 **任务编排与缓存**（build、test、lint、`publish` 若你写成 task），**不负责**「把一个仓库变成一个 npm 包」。

- 你可以在 `turbo.json` 里给每个包定义 `build`，再按需 `turbo run build --filter=@your-scope/ui`。
- **发布**通常是：先 build，再进入对应包目录或对指定 workspace 执行 publish（具体命令随 pnpm/npm 文档而定）。

---

## 你需要建立的心智模型

1. **一个 Git 仓库**可以装**很多 npm 包**。  
2. **每个包**用自己的 **`name` + `version`** 在 registry 上独立存在。  
3. **拆仓**只是把「共享代码」放到单独仓库；**多包是否单独发布**，由**每个子包的发布策略**决定，而不是由「拆不拆仓」单独决定。

---

## 小结

- **可以单独发布**：`packages` 里有多少个合法 npm 包，就可以发多少个（名称在 registry 上不冲突即可）。  
- **拆仓架构**下，业务项目通过 **`package.json` 依赖具体包名与版本** 引用它们；升级某个共享包时，改的是**对应依赖那一行**（可配合自动化 PR）。  
- 多包之间的版本与依赖，建议尽早用 **semver + changelog（如 Changesets）** 管起来，否则包多了容易乱。

（文件名 `muti-repo.md` 若为笔误，日后可改名为 `multi-repo.md`，内容逻辑不变。）

---

## 包 1 引用包 2：具体怎么处理？

下面用 **`@scope/pkg1` 依赖 `@scope/pkg2`** 来举例（包 2 是基础能力，包 1 在其之上封装组件或业务工具）。

### 1）在代码里

包 1 里正常写：

```ts
import { foo } from "@scope/pkg2";
```

和引用外部 npm 包一样，**区别只在 `package.json` 里怎么声明版本**。

### 2）在 `package.json` 里声明依赖

**同仓开发（推荐写法）**：在 `packages/pkg1/package.json` 的 `dependencies`（或合适的字段）里写：

```json
{
  "dependencies": {
    "@scope/pkg2": "workspace:*"
  }
}
```

含义：在本 monorepo 里，安装/链接时直接指向本地的 `packages/pkg2`，不用先发到 npm 再装回来。

**发布到 registry 之后**：已安装包 1 的用户机器上**没有** workspace，因此包 1 里对包 2 的版本必须是 **semver 范围**，例如：

```json
"@scope/pkg2": "^1.2.0"
```

常见落地方式：

- 用 **Changesets** 等在「发版」步骤里自动把 `workspace:*` 换成将要发布的版本；或  
- 发版前手动改一版（小团队、包少时可行）。

### 3）本地开发时会发生什么？

- `npm install` / `pnpm install` 会在 workspace 内把 `@scope/pkg2` **解析到本地目录**，包 1 改代码、包 2 改代码都能在同一次 dev/build 里被用到。  
- 若包 2 需要先 **build** 才有 `dist`（例如 TS 编译产物），则包 1 的 build 往往要 **在包 2 build 之后**执行（见下一条）。

### 4）构建顺序（Turborepo 里常怎么做）

若 `turbo.json` 里 `build` 配置了 `dependsOn: ["^build"]`，表示：**先构建当前包所依赖的 workspace 包，再构建当前包**。这样包 1 在 build 时能拿到包 2 已构建好的输出（具体还取决于包 2 的 `exports` / `main` 指向源码还是 `dist`）。

若包 2 只导出 **源码**（无单独 build 步骤），有时包 1 的 bundler 会直接编译包 2 的源码，这时对 `^build` 的依赖可以按项目实际调整。

### 5）发布顺序（手动心智模型）

当包 1 **真的依赖**已发布的包 2 时，registry 上的规则是：

1. **先有** `@scope/pkg2@某版本` 在 npm 上。  
2. 包 1 的 `package.json` 里对包 2 的 **版本范围**要包含该版本（例如 `^1.2.0`）。  
3. 再发布 `@scope/pkg1`。

若本次改动**同时**改了包 2 的 API，通常流程是：

- 给包 2 **升版本**（按 semver：breaking → major）并发布；  
- 更新包 1 里对包 2 的依赖范围（必要时升包 1 自己的版本）；  
- 再发布包 1。

工具链（如 Changesets）可以把「多包联动升版」收成**一次发布流水线**，减少手工漏改。

### 6）只改包 2、包 1 要不要发新版？

- 若包 2 是 **patch**（行为修复、对外 API 不变），包 1 可能**不必**发新版；消费者升级包 2 即可。  
- 若包 1 的 **peer 依赖**或打包方式**锁死了**包 2 的范围，可能需要发包 1 才能让大家顺利升级（视你包的导出方式而定）。  
- 若包 2 **breaking**，包 1 几乎总要跟进（升依赖范围 + 适配代码 + 发包 1 新版本）。

### 7）循环依赖

**包 1 → 包 2 → 包 1** 这种循环应尽量避免：workspace 能链上，但构建、类型解析、发布顺序都会很痛苦。出现苗头时优先考虑：**抽第三包（公共内核）** 或合并边界。

### 8）`peerDependencies` 什么时候用？

若包 1 是 **React 组件库**，而 `react` 应由宿主应用提供，会把 `react` 放在 `peerDependencies`。  
包 1 依赖包 2 时，多数情况包 2 仍在 **`dependencies`**（随包 1 一起装一份）；若你希望「宿主必须显式安装包 2、且只保留一份实例」，再考虑把包 2 挪到 `peerDependencies`（要清楚对使用方的要求会变严）。

---

**一句话**：同仓用 `workspace:*` 链起来开发与构建；对外发布时，包 1 必须声明**真实的 semver 依赖**指向已发布的包 2，并按 **先底后上** 的顺序发版（或用 Changesets 类工具一次算清）。

---

## Changesets：具体怎么用（含场景示例）

[Changesets](https://github.com/changesets/changesets) 用来在多包仓库里做三件事：

1. **记录**本次改动影响哪些包、 semver 级别（patch / minor / major）  
2. **`changeset version` 时**自动改各包 `version`、`CHANGELOG.md`，并把「内部包互相依赖」里的范围改到**真实版本**（不再依赖你手工对齐）  
3. **`changeset publish`**（可选）按新版本把需要发布的包推到 npm

下面按「从零到发版」写；包名仍用 `@scope/pkg1`、`@scope/pkg2` 举例。

### 1）安装与初始化

在**共享库 monorepo 根目录**（`private: true` 的那个）执行：

```bash
npm install -D @changesets/cli
npx changeset init
```

`init` 会生成 `.changeset/config.json`（以及说明用的 `README.md`）。  
多使用 **pnpm** 时也可：`pnpm add -D @changesets/cli`，命令仍用 `pnpm exec changeset` 或 `npx changeset`。

建议在根 `package.json` 加脚本，方便团队统一：

```json
{
  "scripts": {
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "changeset publish"
  }
}
```

### 2）日常三条命令（心智模型）

| 阶段 | 命令 | 做什么 |
|------|------|--------|
| 合并功能分支前 / 发版前 | `npx changeset`（或 `npm run changeset`） | 交互式生成 `.changeset/*.md`「待发布说明」 |
| 准备发版 | `npx changeset version` | 根据这些 md **升版本号、写 CHANGELOG、更新包之间依赖版本** |
| 推到 registry | `npx changeset publish` | 对**有版本变化且可发布**的包执行 `npm publish`（需已 `npm login`） |

**注意**：`changeset version` 会删掉（消费掉）已应用的 `.changeset/*.md` 描述文件，只保留生成的 changelog；这些 md 应进 Git，和代码一起 PR。

### 3）`npx changeset` 交互里你在选什么？

运行后会问类似问题：

- **Which packages would you like to include?**  
  勾选本次**真的对外有语义**变更的包（可多选）。  
- **What kind of change is this for each package?**  
  - `patch`：修复，兼容  
  - `minor`：新功能，向后兼容  
  - `major`：破坏性变更  
- **Please enter a summary for this change**  
  一句话说明，会进 CHANGELOG。

一个 PR 里可以只跑一次 `changeset`，也可以多人多次各写一条，发版前会**合并计算**。

---

### 场景示例

#### 场景 A：只改了底层包 `pkg2`（小修复）

- 代码：只动 `packages/pkg2`。  
- 操作：根目录执行 `npx changeset` → 只选 `@scope/pkg2` → 选 **patch** → 写摘要。  
- 发版：`changeset version` → 通常只有 `@scope/pkg2` 版本 `1.0.0 → 1.0.1`，CHANGELOG 多一条。  
- `@scope/pkg1` 若**没有**出现在这次 changeset 里，一般**不会**顺带升 `pkg1` 的版本号；对外已发布的 `pkg1` 若依赖写的是 `"@scope/pkg2": "^1.0.0"`，消费者安装时仍可解析到 `1.0.1`（在 `^` 允许范围内）。若你希望「依赖字段也显式对齐 / 必须发一版 pkg1」，把 `pkg1` 也纳入本次 changeset，或在配置里使用 **`fixed` / `linked`** 等策略（见官方文档）。  
- **要点**：单包小改时，changeset 里**只点 pkg2** 即可；是否要连带发 `pkg1` 由产品兼容策略决定。

#### 场景 B：`pkg1` 依赖 `pkg2`，两处都改了（兼容新功能）

- 代码：`pkg2` 新增导出；`pkg1` 改用该导出。  
- 操作：`npx changeset` → **同时勾选** `@scope/pkg2` 与 `@scope/pkg1` → 分别为两者选 **minor**（或 pkg2 minor、pkg1 patch，按你对外承诺的 API 级别来）。  
- 发版：`changeset version` → 两个包版本都会升，`pkg1` 对 `pkg2` 的依赖范围会被更新到**包含新的 pkg2 版本**。  
- **要点**：多包联动时，**一次 changeset 里把受影响的包都点上**，比事后手工改两个 `package.json` 更安全。

#### 场景 C：`pkg2` 破坏性变更（major），`pkg1` 必须跟进

- 代码：`pkg2` 改签名；`pkg1` 已适配。  
- 操作：`npx changeset` → `@scope/pkg2` 选 **major**；`@scope/pkg1` 至少 **minor** 或 **major**（若对外也视为 breaking，则 pkg1 也用 major）。  
- 发版：`changeset version` 后，registry 上会出现新的 `@scope/pkg2@2.0.0`，`pkg1` 的依赖会指向新版本范围，并带上各自的 CHANGELOG。  
- **要点**：**major 一定显式标出来**，否则消费者以为只是小升级。

#### 场景 D：本次其实不想发 npm，只想先攒「变更记录」

- 开发期间：每个重要 PR 让作者跑 `npx changeset` 提交一个 `.changeset/xxx.md`。  
- 发版日：维护者统一跑 `changeset version` + 测试 + `changeset publish`。  
- **要点**：把「记一笔」和「真升版本」拆开，适合固定节奏发版（如每周）。

#### 场景 E：Scoped 包、首次发布

- 确保各子包 `package.json` 里 `name` 正确（如 `@scope/pkg2`）。  
- 若组织要求 scoped 包公开可读，常需在子包加：

```json
"publishConfig": {
  "access": "public"
}
```

- `npm login` 指向正确的 registry（含私有 Verdaccio/GitHub Packages 等）。  
- **要点**：Changesets 不负责 registry 权限，只负责**版本与发包顺序**；私有源要在 `.npmrc` / CI 里配好 token。

---

### 和本文前面「包 1 / 包 2」的关系（对照）

- **手工**：先发 pkg2，再改 pkg1 里 `^x.y.z`，再发 pkg1。  
- **Changesets**：用「很多个 `.changeset/*.md`」描述意图，**一次 `version` 统一改版本号和内部依赖**，再用 `publish` 按依赖关系发（仍建议 CI 里先 `build` / `test`）。

### 常见坑（初学时）

- **忘了跑 `changeset`**：合并了代码但发版时 nothing to version。  
- **major 标成 patch**：CHANGELOG 与 semver 不一致，下游升级踩雷。  
- **循环依赖**：Changesets 不能替你消除架构问题，该拆包仍要拆。  
- **只 publish 没先 build**：若你的包发布的是 `dist`，请在 `publish` 前在 CI/脚本里先 `turbo run build`（或用 `prepublishOnly`）。

更细的选项（`fixed` 版本联动、`linked` 包组、`snapshot` 预发布等）见官方文档：[Changesets 文档](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md)。
