<template>
  <div
    ref="triggerRef"
    class="glass-select"
    :class="{
      'is-open': open,
      'is-disabled': disabled,
      'has-prefix': !!$slots['prefix-icon'],
    }"
    tabindex="0"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
    @mousedown.prevent
  >
    <span v-if="$slots['prefix-icon']" class="glass-select__prefix">
      <slot name="prefix-icon" />
    </span>
    <span class="glass-select__text" :class="{ 'is-placeholder': !displayText }">
      {{ displayText || placeholder }}
    </span>
    <el-icon class="glass-select__arrow" :class="{ 'is-open': open }">
      <ArrowDown />
    </el-icon>
  </div>

  <Popover v-model:visible="open" :anchorEl="triggerRef" :matchWidth="false" placement="bottom-start">
    <div class="month-picker__panel">
      <div class="month-picker__header">
        <button class="month-picker__nav" @click="prevYear">
          <el-icon :size="14"><ArrowLeft /></el-icon>
        </button>
        <span class="month-picker__year">{{ displayYear }}</span>
        <button class="month-picker__nav" @click="nextYear">
          <el-icon :size="14"><ArrowRight /></el-icon>
        </button>
      </div>
      <div class="month-picker__grid">
        <button
          v-for="m in 12"
          :key="m"
          class="month-picker__cell"
          :class="{
            'is-current': isCurrentMonth(m),
            'is-selected': isSelected(m),
          }"
          @click="selectMonth(m)"
        >{{ m }}月</button>
      </div>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowDown, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import Popover from './Popover.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>(), {
  placeholder: '选择月份',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'change', v: string): void
}>()

const triggerRef = ref<HTMLElement | null>(null)
const open = ref(false)
const displayYear = ref(new Date().getFullYear())

// Parse modelValue like "2026-06" into year/month
const parsed = computed(() => {
  if (!props.modelValue) return { year: 0, month: 0 }
  const [y, m] = props.modelValue.split('-').map(Number)
  return { year: y || 0, month: m || 0 }
})

const displayText = computed(() => {
  const p = parsed.value
  if (!p.year || !p.month) return ''
  return `${p.year}年${p.month}月`
})

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

function isCurrentMonth(m: number) {
  return displayYear.value === currentYear && m === currentMonth
}

function isSelected(m: number) {
  const p = parsed.value
  return displayYear.value === p.year && m === p.month
}

function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    const p = parsed.value
    displayYear.value = p.year || new Date().getFullYear()
  }
}

function selectMonth(m: number) {
  const val = `${displayYear.value}-${String(m).padStart(2, '0')}`
  emit('update:modelValue', val)
  emit('change', val)
  open.value = false
}

function prevYear() {
  displayYear.value--
}

function nextYear() {
  displayYear.value++
}
</script>

<style scoped>
/* Trigger - reuses glass-select pattern */
.glass-select {
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s var(--ease-smooth),
              box-shadow 0.15s var(--ease-smooth),
              background 0.15s var(--ease-smooth);
  user-select: none;
}

.glass-select:hover:not(.is-disabled) {
  border-color: var(--glass-border);
  background: var(--glass-bg);
}

.glass-select.is-open,
.glass-select.is-open {
  border-color: var(--accent);
  background: var(--glass-bg);
  box-shadow: 0 0 0 1px var(--accent-glow);
}

.glass-select.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.glass-select__prefix {
  position: absolute;
  left: 10px;
  z-index: 2;
  display: flex;
  align-items: center;
  color: var(--text-tertiary);
  pointer-events: none;
  font-size: 14px;
  transition: color 0.15s var(--ease-smooth);
}

.glass-select.is-open .glass-select__prefix,
.glass-select.is-open .glass-select__prefix {
  color: var(--accent);
}

.glass-select__text {
  flex: 1;
  padding: 0 28px 0 12px;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.glass-select.has-prefix .glass-select__text {
  padding-left: 32px;
}

.glass-select__text.is-placeholder {
  color: var(--text-placeholder);
}

.glass-select__arrow {
  position: absolute;
  right: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  transition: transform 0.25s var(--ease-spring);
  pointer-events: none;
}

.glass-select__arrow.is-open {
  transform: rotate(180deg);
}

/* Panel */
.month-picker__panel {
  width: 240px;
  padding: 8px;
}

.month-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 4px;
}

.month-picker__year {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.month-picker__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s var(--ease-smooth);
}

.month-picker__nav:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

.month-picker__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.month-picker__cell {
  padding: 8px 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s var(--ease-smooth),
              transform 0.2s var(--ease-spring);
}

.month-picker__cell:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
  transform: scale(1.05);
}

.month-picker__cell.is-current {
  border-color: var(--accent);
  border-style: dashed;
}

.month-picker__cell.is-selected {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  border-style: solid;
  border-color: var(--accent);
  box-shadow: 0 2px 8px var(--accent-glow);
}
</style>
