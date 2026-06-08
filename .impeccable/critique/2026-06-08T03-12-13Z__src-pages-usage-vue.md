---
target: Usage
total_score: 21
p0_count: 0
p1_count: 2
timestamp: 2026-06-08T03-12-13Z
slug: src-pages-usage-vue
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | 错误状态无用户反馈，仅 console.log |
| 2 | Match System / Real World | 3 | 中文术语自然，图标语义清晰 |
| 3 | User Control and Freedom | 2 | 无清除筛选、无键盘快捷键、viewMode 直接隐藏而非禁用 |
| 4 | Consistency and Standards | 3 | 组件词汇统一，交互模式一致 |
| 5 | Error Prevention | 2 | 无防抖、无 API 错误展示、无 cookie 过期提示 |
| 6 | Recognition Rather Than Recall | 2 | 筛选器无 tooltip，技术术语无解释 |
| 7 | Flexibility and Efficiency | 2 | 无快捷键、无批量操作、筛选器无快捷重置 |
| 8 | Aesthetic and Minimalist Design | 3 | 视觉层次清晰，但筛选栏略显拥挤 |
| 9 | Error Recovery | 1 | 错误仅 console.log，用户看到空白页无解释 |
| 10 | Help and Documentation | 1 | 无 tooltip、无上下文帮助、无引导 |
| **Total** | | **21/40** | **Acceptable，需显著改进** |

## Anti-Patterns Verdict

LLM 评估：弹性缓动（ease-spring）和渐变文字（background-clip: text）被标记。检测器命中 1 项 bounce-easing。

## Priority Issues

- [P1] 错误状态完全缺失：API 失败时用户看到空白页无解释
- [P1] 筛选栏认知过载：6 个控件同时暴露，违反 Miller's Law
- [P2] 弹性缓动动画：ease-spring 回弹效果显廉价，检测器标记
- [P2] 渐变文字反模式：logo 和 title 使用 background-clip: text
- [P3] 无 prefers-reduced-motion 支持

## Persona Red Flags

- Alex (Power User)：无键盘快捷键，筛选栏 6 控件无快捷操作
- Jordan (First-Timer)：术语无解释，无引导
- Sam (Accessibility)：focus 指示器不明确，图表对屏幕阅读器不可访问
