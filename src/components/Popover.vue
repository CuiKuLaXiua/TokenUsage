<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="popoverRef"
      class="glass-popover"
      :class="{ 'is-placed': positioned }"
      :style="popoverStyle"
    >
      <slot />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  anchorEl: HTMLElement | null
  placement?: 'bottom-start' | 'bottom' | 'top-start'
  maxHeight?: number
  matchWidth?: boolean
}>(), {
  placement: 'bottom-start',
  maxHeight: 280,
  matchWidth: true,
})

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

const popoverRef = ref<HTMLElement | null>(null)
const popoverTop = ref(0)
const popoverLeft = ref(0)
const popoverWidth = ref(0)
const positioned = ref(false)

const popoverStyle = computed(() => {
  if (!positioned.value) return { visibility: 'hidden' as const }
  return {
    top: popoverTop.value + 'px',
    left: popoverLeft.value + 'px',
    maxHeight: props.maxHeight + 'px',
    width: props.matchWidth && popoverWidth.value ? popoverWidth.value + 'px' : undefined,
  }
})

function recalc() {
  const el = props.anchorEl
  if (!el) { positioned.value = true; return }
  const rect = el.getBoundingClientRect()
  popoverWidth.value = rect.width
  popoverLeft.value = rect.left

  if (props.placement === 'top-start') {
    popoverTop.value = rect.top
  } else {
    popoverTop.value = rect.bottom + 4
  }
  positioned.value = true
}

function close() {
  emit('update:visible', false)
}

function onDocClick(e: MouseEvent) {
  if (!popoverRef.value) return
  const target = e.target as HTMLElement
  if (!document.body.contains(target)) return
  if (props.anchorEl?.contains(target)) return
  if (!popoverRef.value.contains(target)) {
    close()
  }
}

function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(() => props.visible, (v) => {
  if (v) {
    // Register close listeners immediately (no gap window)
    document.addEventListener('click', onDocClick, true)
    document.addEventListener('keydown', onDocKeydown)
    window.addEventListener('resize', recalc)
    // Defer recalc until the Teleported DOM is ready
    nextTick(() => recalc())
  } else {
    positioned.value = false
    document.removeEventListener('click', onDocClick, true)
    document.removeEventListener('keydown', onDocKeydown)
    window.removeEventListener('resize', recalc)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onDocKeydown)
  window.removeEventListener('resize', recalc)
})
</script>

<style scoped>
.glass-popover {
  position: fixed;
  z-index: 9999;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  box-shadow: var(--glass-shadow), 0 0 0 1px var(--accent-glow);
  overflow-y: auto;
}

.glass-popover.is-placed {
  animation: popoverIn 0.2s var(--ease-smooth);
}

.glass-popover::-webkit-scrollbar {
  width: 4px;
}

.glass-popover::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
}

.glass-popover::-webkit-scrollbar-track {
  background: transparent;
}

@keyframes popoverIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
