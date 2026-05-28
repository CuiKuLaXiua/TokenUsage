<template>
  <div class="glow-border" :class="{ active: active }" :style="cssVars">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  color?: string
  active?: boolean
  intensity?: number
}>(), {
  color: 'var(--neon-blue)',
  active: true,
  intensity: 1
})

const cssVars = computed(() => ({
  '--glow-color': props.color,
  '--glow-intensity': props.intensity
}))
</script>

<style scoped>
.glow-border {
  position: relative;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  transition: all var(--duration-normal) var(--ease-smooth);
}

.glow-border::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 17px;
  background: linear-gradient(135deg, var(--glow-color), transparent, var(--glow-color));
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-smooth);
  z-index: -1;
}

.glow-border::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 16px;
  box-shadow: 0 0 20px var(--glow-color);
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-smooth);
}

.glow-border.active::before {
  opacity: calc(0.3 * var(--glow-intensity));
}

.glow-border.active::after {
  opacity: calc(0.15 * var(--glow-intensity));
}

.glow-border:hover::before {
  opacity: calc(0.5 * var(--glow-intensity));
}

.glow-border:hover::after {
  opacity: calc(0.25 * var(--glow-intensity));
}
</style>
