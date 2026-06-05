<template>
  <div
    ref="triggerRef"
    class="glass-select"
    :class="{
      'is-open': open,
      [`glass-select--${size}`]: true,
      'is-disabled': disabled,
      'has-prefix': !!$slots['prefix-icon'],
    }"
    tabindex="0"
    @click="toggle"
    @keydown="onTriggerKeydown"
    @mousedown.prevent
  >
    <span v-if="$slots['prefix-icon']" class="glass-select__prefix">
      <slot name="prefix-icon" />
    </span>
    <span class="glass-select__text" :class="{ 'is-placeholder': !selectedLabel }">
      {{ selectedLabel || placeholder }}
    </span>
    <el-icon class="glass-select__arrow" :class="{ 'is-open': open }">
      <ArrowDown />
    </el-icon>
  </div>

  <Popover v-model:visible="open" :anchorEl="triggerRef" :matchWidth="matchWidth">
    <div
      ref="dropdownRef"
      class="glass-select__dropdown"
      :style="{ maxHeight: maxHeight + 'px' }"
      @keydown="onDropdownKeydown"
    >
      <div v-if="!filteredOptions.length" class="glass-select__empty">
        <slot name="empty">无数据</slot>
      </div>
      <div
        v-for="(opt, idx) in filteredOptions"
        :key="String(opt.value)"
        class="glass-select__option"
        :class="{
          'is-selected': modelValue === opt.value,
          'is-highlighted': highlightIdx === idx,
        }"
        @click="select(opt)"
        @mouseenter="highlightIdx = idx"
      >
        <slot name="option" :option="opt" :index="idx">
          {{ opt.label }}
        </slot>
      </div>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import Popover from './Popover.vue'

export interface SelectOption {
  label: string
  value: string | number
  [key: string]: any
}

const props = withDefaults(defineProps<{
  modelValue: string | number
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  size?: 'default' | 'small'
  maxHeight?: number
  filterable?: boolean
  matchWidth?: boolean
}>(), {
  placeholder: '请选择',
  disabled: false,
  size: 'default',
  maxHeight: 280,
  filterable: false,
  matchWidth: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | number): void
  (e: 'change', v: string | number): void
}>()

const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const open = ref(false)
const highlightIdx = ref(-1)

const selectedLabel = computed(() => {
  const opt = props.options.find(o => o.value === props.modelValue)
  return opt?.label ?? ''
})

const filteredOptions = computed(() => props.options)

function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    highlightIdx.value = props.options.findIndex(o => o.value === props.modelValue)
  }
}

function select(opt: SelectOption) {
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
  open.value = false
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (props.disabled) return

  if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) {
      open.value = true
      highlightIdx.value = props.options.findIndex(o => o.value === props.modelValue)
    }
  }
}

function onDropdownKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightIdx.value = Math.min(highlightIdx.value + 1, props.options.length - 1)
    scrollToHighlight()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightIdx.value = Math.max(highlightIdx.value - 1, 0)
    scrollToHighlight()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightIdx.value >= 0 && highlightIdx.value < props.options.length) {
      select(props.options[highlightIdx.value])
    }
  } else if (e.key === 'Escape') {
    open.value = false
    triggerRef.value?.focus()
  }
}

function scrollToHighlight() {
  if (!dropdownRef.value) return
  const items = dropdownRef.value.querySelectorAll('.glass-select__option')
  const item = items[highlightIdx.value] as HTMLElement | undefined
  item?.scrollIntoView({ block: 'nearest' })
}

watch(open, (v) => {
  if (!v) {
    highlightIdx.value = -1
  }
})
</script>

<style scoped>
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

/* size: small */
.glass-select--small {
  height: 30px;
  border-radius: 8px;
}

.glass-select--small .glass-select__text {
  font-size: 12px;
}

/* prefix icon */
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

/* text */
.glass-select__text {
  flex: 1;
  padding: 0 28px 0 12px;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.glass-select.has-prefix .glass-select__text {
  padding-left: 32px;
}

.glass-select__text.is-placeholder {
  color: var(--text-placeholder);
}

/* arrow */
.glass-select__arrow {
  position: absolute;
  right: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  transition: transform 0.25s var(--ease-spring),
              color 0.15s var(--ease-smooth);
  pointer-events: none;
}

.glass-select__arrow.is-open {
  transform: rotate(180deg);
}

.glass-select.is-open .glass-select__arrow,
.glass-select.is-open .glass-select__arrow {
  color: var(--accent);
}

/* dropdown */
.glass-select__dropdown {
  padding: 4px;
  overflow-y: auto;
}

.glass-select__dropdown::-webkit-scrollbar {
  width: 4px;
}

.glass-select__dropdown::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
}

.glass-select__dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.glass-select__option {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s var(--ease-smooth);
}

.glass-select__option:hover,
.glass-select__option.is-highlighted {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.glass-select__option.is-selected {
  color: var(--accent);
  font-weight: 600;
}

.glass-select__empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--text-placeholder);
}
</style>
