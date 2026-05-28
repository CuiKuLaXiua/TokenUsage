# Token Usage UI 重构 + 多厂商兼容

## TL;DR

> **Quick Summary**: 将 Token Usage 从简洁 glass 风格升级为深空科技科幻风格，同时扩展数据模型支持三种额度类型（Token/百分比/余额），新增 DeepSeek 余额查询，统一 Kimi 标签。
>
> **Deliverables**:
> - 科幻风格 UI（深空科技主题，支持深色/浅色模式）
> - 6 个新组件（TokenRing、PercentBar、BalanceCard、CountUp、GlowBorder、ParticleBg）
> - 多厂商数据模型（token/balance/percent 三种类型）
> - DeepSeek 余额查询支持
> - Kimi 标签统一（5小时/7天）
>
> **Estimated Effort**: Medium-Large
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 5 → Task 8 → Task 10

---

## Context

### Original Request
用户要求：
1. 更优美的动效、动画、美观漂亮科幻的界面
2. 兼容多种额度类型（token 数值、百分比、余额）
3. 统一 Kimi 显示规则（5小时、7天）
4. 支持 DeepSeek 余额查询

### Interview Summary
**Key Discussions**:
- 风格选择：B（深空科技）— 暗蓝黑底、微光、克制的发光
- 主题：保留浅色主题，适配深色和浅色模式
- DeepSeek API：GET https://api.deepseek.com/user/balance，Header: Authorization: Bearer sk-xxx
- 实施顺序：先 UI 美化，后数据模型 + 功能兼容

**Research Findings**:
- 当前代码库：Vue 3 + TypeScript + Element Plus + Electron
- 当前样式：glass morphism，CSS 变量系统
- 数据模型：ModelUsageStatus 支持 used/total/remaining/percent/tiers
- Kimi 解析已有 tiers，但标签用的是 '5h' 和 'weekly'

### Gap Analysis (Metis)
**Identified Gaps** (addressed):
- DeepSeek API 响应格式需确认（用户已提供：balance_infos 数组）
- 浅色模式下的科幻风格适配（已确认保留）
- 组件复用策略（已决定新建专用组件）

---

## Work Objectives

### Core Objective
将 Token Usage 升级为深空科技风格的科幻界面，同时扩展后端支持三种额度类型，实现多厂商兼容。

### Concrete Deliverables
- `src/styles/sci-fi.css` — 科幻主题变量
- `src/components/TokenRing.vue` — Token 型圆环进度
- `src/components/PercentBar.vue` — 百分比型双层进度条
- `src/components/BalanceCard.vue` — 余额型卡片
- `src/components/CountUp.vue` — 数字翻牌组件
- `src/components/GlowBorder.vue` — 霓虹边框组件
- `src/components/ParticleBg.vue` — 粒子背景
- `src/pages/Dashboard.vue` — 重构后的仪表盘
- `src/pages/Config.vue` — 增加 DeepSeek 选项
- `src/components/AppLayout.vue` — 深空背景布局
- `src/stores/app.ts` — 扩展数据模型
- `src/services/api.ts` — 新增 DeepSeek 解析 + Kimi 标签统一
- `src/utils/format.ts` — 新增格式化函数
- `electron/main.ts` — 新增 DeepSeek API handler

### Definition of Done
- [ ] 深色模式下所有页面呈现深空科技风格
- [ ] 浅色模式下风格适配完成
- [ ] Dashboard 正确显示三种额度类型
- [ ] DeepSeek 余额查询功能正常
- [ ] Kimi 标签统一为"5小时"和"7天"
- [ ] 所有动效正常运行

### Must Have
- 深空科技风格（暗蓝黑底、微光、克制发光）
- 三种额度类型的 UI 展示
- DeepSeek 余额查询
- Kimi 标签统一
- 深色/浅色模式适配

### Must NOT Have (Guardrails)
- 不修改 Usage 页面、Export 页面、FloatWindow（后续迭代）
- 不引入新的 npm 依赖（用 CSS 实现动效）
- 不修改 Electron 主进程的窗口管理逻辑
- 不添加单元测试（用户未要求）

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None（用户未要求）
- **Agent-Executed QA**: 每个任务后由 agent 验证视觉效果和功能

### QA Policy
每个任务完成后，agent 需：
1. 启动 dev server 检查页面
2. 验证深色/浅色模式切换
3. 确认动效正常运行
4. 检查控制台无错误

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 基础设施 + 组件，7 个并行任务):
├── Task 1: 科幻主题变量 + 全局样式升级 [quick]
├── Task 2: TokenRing 组件 [quick]
├── Task 3: PercentBar 组件 [quick]
├── Task 4: BalanceCard 组件 [quick]
├── Task 5: CountUp 组件 [quick]
├── Task 6: GlowBorder 组件 [quick]
└── Task 7: ParticleBg 组件 [quick]

Wave 2 (After Wave 1 — 集成 + 数据模型，3 个并行任务):
├── Task 8: Dashboard 重构 + 组件集成 (depends: 1-7) [unspecified-high]
├── Task 9: 数据模型扩展 + API 解析 (depends: none) [unspecified-high]
└── Task 10: Config 页面 + AppLayout 重构 (depends: 1) [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
```

### Dependency Matrix
- **1 (Theme)**: blocks → 8, 10
- **2-7 (Components)**: blocks → 8
- **8 (Dashboard)**: blocked by → 1-7
- **9 (Data Model)**: independent
- **10 (Config/Layout)**: blocked by → 1

### Agent Dispatch Summary
- **Wave 1**: 7 tasks → 7 × `quick`
- **Wave 2**: 3 tasks → 3 × `unspecified-high`
- **FINAL**: 4 tasks → mixed agents

---

## TODOs

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `lsp_diagnostics`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `DIAGNOSTICS | SLOP CHECK | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start dev server. Test in BOTH dark and light mode: Dashboard 三种卡片显示、Config 添加 DeepSeek 模型、动效运行、主题切换。Document any failures.
  Output: `QA RESULTS | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: verify "What to do" done, "Must NOT do" not violated. Check no files modified outside scope (Usage.vue, Export.vue, FloatWindow.vue should be untouched). Flag any unaccounted changes.
  Output: `Tasks [N/N compliant] | Boundary [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- After Wave 1: `feat: add sci-fi theme and reusable components`
- After Wave 2: `feat: dashboard redesign with multi-provider support`
- After FINAL: `chore: final cleanup and verification`

---

## Success Criteria

### Verification Commands
```bash
npm run dev  # 启动开发服务器，检查页面
# 深色模式下检查 Dashboard 三种卡片
# 浅色模式下检查风格适配
# Config 页面添加 DeepSeek 模型
# 控制台无错误
```

### Final Checklist
- [ ] 深空科技风格呈现
- [ ] 三种额度类型正确显示
- [ ] DeepSeek 余额查询正常
- [ ] Kimi 标签为"5小时"和"7天"
- [ ] 深色/浅色模式切换正常
- [ ] 动效运行流畅
