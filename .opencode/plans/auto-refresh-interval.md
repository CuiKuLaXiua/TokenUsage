# Per-Model Auto-Refresh Interval

## Overview

Each model can be configured with a refresh interval (in minutes). When set to a positive value (e.g. 5), the app automatically calls the model's API every N minutes to update usage data. Configured in the Config page dialog, displayed in both the Config table and the FloatWindow model rows.

## Files to Modify

| File | Change |
|---|---|
| `src/stores/app.ts` | `ModelConfig` + timer engine |
| `src/pages/Config.vue` | Form input + table column |
| `src/pages/FloatWindow.vue` | Display badge on model row |

---

## 1. `src/stores/app.ts` — Timer Engine

### 1a. ModelConfig interface (line 7-17)

Add field:

```typescript
refreshInterval?: number  // 自动刷新间隔（分钟），0 或 undefined 表示关闭
```

### 1b. Store internals (near line 66, after `let refreshAbortFlag = false`)

Add timer tracking:

```typescript
const autoRefreshTimers = new Map<string, ReturnType<typeof setInterval>>()
```

### 1c. New function: `startAutoRefresh()`

```typescript
function startAutoRefresh() {
  // Clear all existing timers
  stopAutoRefresh()

  for (const model of models.value) {
    const interval = model.refreshInterval
    if (!interval || interval <= 0) continue
    if (!model.enabled || !model.apiKey) continue

    // Do an immediate first fetch if no data yet
    if (!modelUsageMap[model.id]) {
      fetchModelUsage(model).catch(() => {})
    }

    // Set up periodic fetch — skip if already fetching
    const timerId = setInterval(() => {
      if (!fetching[model.id]) {
        fetchModelUsage(model).catch(() => {})
      }
    }, interval * 60 * 1000)

    autoRefreshTimers.set(model.id, timerId)
  }
}
```

### 1d. New function: `stopAutoRefresh()`

```typescript
function stopAutoRefresh() {
  autoRefreshTimers.forEach((timerId) => clearInterval(timerId))
  autoRefreshTimers.clear()
}
```

### 1e. Hook into `loadConfig()` (after `isConfigLoaded.value = true`, line ~74)

Add `startAutoRefresh()` call at end of try block.

### 1f. Hook into `saveConfig()` (line ~86)

Add `startAutoRefresh()` after the write succeeds — resets timers after any config mutation (add/update/remove).

### 1g. Export

Add `startAutoRefresh` and `stopAutoRefresh` to the return block.

---

## 2. `src/pages/Config.vue` — UI

### 2a. Imports

Add `Timer` to the `@element-plus/icons-vue` import (for table badge icon).

### 2b. defaultForm (line ~220)

Add default value: `refreshInterval: 0`

### 2c. Form — new field between Cookie and enabled toggle (after line ~176)

Insert before the `<!-- 启用 -->` inline form-field:

```html
<div class="form-field form-field-inline">
  <label class="form-label">自动刷新</label>
  <div class="interval-wrap">
    <input
      v-model.number="form.refreshInterval"
      type="number"
      class="form-input interval-input"
      min="0"
      max="1440"
      step="5"
      placeholder="0"
    />
    <span class="interval-unit">分钟</span>
  </div>
  <span class="interval-hint">0 = 关闭自动刷新</span>
</div>
```

### 2d. Table header — new column (line ~31, between 状态 and 操作)

```html
<th>自动刷新</th>
```

### 2e. Table body — new cell (line ~94, between 状态 cell and 操作 cell)

```html
<td>
  <span v-if="model.refreshInterval && model.refreshInterval > 0" class="refresh-badge">
    <el-icon :size="12"><Timer /></el-icon>
    每 {{ model.refreshInterval }} 分钟
  </span>
  <span v-else class="refresh-off">关闭</span>
</td>
```

### 2f. Styles — add to `<style scoped>` (before the Action group section, around line 470)

```css
/* ── Refresh interval ── */
.interval-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.interval-input {
  width: 80px !important;
  text-align: center;
}

.interval-unit {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.interval-hint {
  font-size: 11px;
  color: var(--text-placeholder);
  flex-shrink: 0;
}

.refresh-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
  background: var(--accent-glow);
  padding: 2px 8px;
  border-radius: 4px;
}

.refresh-off {
  font-size: 11px;
  color: var(--text-placeholder);
}
```

---

## 3. `src/pages/FloatWindow.vue` — Display Badge

### 3a. Imports

Add `Timer` to the `@element-plus/icons-vue` import.

### 3b. Model row header — add badge (after `model-row-badge` span, around line 48)

```html
<span v-if="model.refreshInterval && model.refreshInterval > 0" class="model-row-timer">
  <el-icon :size="10"><Timer /></el-icon>
  {{ model.refreshInterval }}m
</span>
```

### 3c. Style — add to `<style scoped>` (after .model-row-badge section, around line 331)

```css
.model-row-timer {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-glow);
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}
```

---

## Edge Cases & Guardrails

| # | Case | Handling |
|---|---|---|
| 1 | `refreshInterval` is negative | Input `min="0"` prevents entry |
| 2 | `refreshInterval` is `undefined` (legacy config) | Treated same as 0 — no timer |
| 3 | API key empty or model disabled | Timer not created |
| 4 | Fetch already in progress at tick | `fetching[model.id]` guard skips |
| 5 | Fetch throws error | `.catch(() => {})` silently absorbs |
| 6 | Model removed while timer active | `saveConfig()` → `startAutoRefresh()` → `stopAutoRefresh()` clears old timer |
| 7 | Config mutated (add/update) | `saveConfig()` triggers timer reset |
| 8 | App window closed | Timers die with renderer process |
| 9 | Float window + main window | Separate BrowserWindows → separate store instances → independent timers (correct) |

## Acceptance Criteria

- [ ] Config dialog has a number input labeled "自动刷新", min 0, max 1440, step 5
- [ ] Setting to 0 shows "关闭" in table and FloatWindow, no timer runs
- [ ] Setting to N > 0 starts auto-fetch every N minutes; table shows "每 N 分钟" badge
- [ ] Changing or removing a model's interval resets the timer for that model
- [ ] Deleting a model clears its timer
- [ ] FloatWindow model row shows compact "Nm" timer badge when interval > 0
- [ ] Build passes (`vite build`)
- [ ] No UI regressions on Dashboard, Config, Usage, Export tabs
