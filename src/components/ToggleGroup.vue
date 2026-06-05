<template>
  <div
    class="toggle-group"
    :class="`toggle-group--${size}`"
    role="radiogroup"
    @keydown="onKeydown"
  >
    <div class="toggle-group__track">
      <div
        v-if="sliderStyle"
        class="toggle-group__slider"
        :style="sliderStyle"
      />
      <button
        v-for="opt in options"
        :key="String(opt.value)"
        :ref="el => setBtnRef(String(opt.value), el as HTMLElement)"
        class="toggle-group__btn"
        :class="{ 'is-active': modelValue === opt.value }"
        role="radio"
        :aria-checked="String(modelValue === opt.value)"
        :tabindex="modelValue === opt.value ? 0 : -1"
        @click="select(opt.value)"
      >{{ opt.label }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string | number
  options: Array<{ label: string; value: string | number }>
  size?: 'small' | 'default'
}>(), {
  size: 'small',
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | number): void
}>()

const btnRefs = new Map<string, HTMLElement>()
const sliderLeft = ref(0)
const sliderWidth = ref(0)
const mounted = ref(false)

const sliderStyle = computed(() => {
  if (!mounted.value) return null
  return {
    left: sliderLeft.value + 'px',
    width: sliderWidth.value + 'px',
  }
})

function setBtnRef(key: string, el: HTMLElement | null) {
  if (el) {
    btnRefs.set(key, el)
  } else {
    btnRefs.delete(key)
  }
}

function updateSlider() {
  const key = String(props.modelValue)
  const btn = btnRefs.get(key)
  if (!btn) return

  const track = btn.parentElement
  if (!track) return

  sliderLeft.value = btn.offsetLeft
  sliderWidth.value = btn.offsetWidth
}

// ResizeObserver on the track to keep slider in sync
let observer: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    mounted.value = true
    updateSlider()

    const firstBtn = btnRefs.values().next().value as HTMLElement | undefined
    const track = firstBtn?.parentElement
    if (track) {
      observer = new ResizeObserver(() => updateSlider())
      observer.observe(track)
    }
  })
})

watch(() => props.modelValue, () => {
  nextTick(updateSlider)
})

watch(() => props.options, () => {
  nextTick(updateSlider)
})

function select(value: string | number) {
  if (value !== props.modelValue) {
    emit('update:modelValue', value)
  }
}

function onKeydown(e: KeyboardEvent) {
  const idx = props.options.findIndex(o => o.value === props.modelValue)
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    const prev = (idx - 1 + props.options.length) % props.options.length
    emit('update:modelValue', props.options[prev].value)
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    const next = (idx + 1) % props.options.length
    emit('update:modelValue', props.options[next].value)
  }
}
</script>

<style scoped>
.toggle-group {
  flex-shrink: 0;
  user-select: none;
}

.toggle-group__track {
  position: relative;
  display: inline-flex;
  padding: 3px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
}

.toggle-group__slider {
  position: absolute;
  top: 3px;
  height: calc(100% - 6px);
  background: var(--accent);
  border-radius: 8px;
  box-shadow: 0 1px 4px var(--accent-glow);
  transition: left 0.25s var(--ease-spring),
              width 0.25s var(--ease-spring);
  pointer-events: none;
}

.toggle-group__btn {
  position: relative;
  z-index: 1;
  padding: 5px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border-radius: 8px;
  white-space: nowrap;
  outline: none;
  transition: color 0.15s var(--ease-smooth),
              transform 0.1s var(--ease-smooth);
}

.toggle-group__btn.is-active {
  color: #fff;
  font-weight: 600;
}

.toggle-group__btn:not(.is-active):hover {
  color: var(--text-primary);
}

.toggle-group__btn:active {
  transform: scale(0.97);
}

/* size: default */
.toggle-group--default .toggle-group__btn {
  padding: 7px 18px;
  font-size: 13px;
}

.toggle-group--default .toggle-group__track {
  border-radius: 12px;
  padding: 4px;
}

.toggle-group--default .toggle-group__slider {
  top: 4px;
  height: calc(100% - 8px);
  border-radius: 10px;
}
</style>
