<template>
  <div class="token-ring" :style="{ '--size': size + 'px', '--stroke': stroke + 'px' }">
    <svg class="ring-svg" :viewBox="`0 0 ${size} ${size}`">
      <!-- Track -->
      <circle
        class="ring-track"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="stroke"
      />
      <!-- Fill -->
      <circle
        class="ring-fill"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="stroke"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :stroke="progressColor"
      />
      <!-- Glow -->
      <circle
        class="ring-glow"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="stroke * 2"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :stroke="progressColor"
        opacity="0.2"
        filter="url(#glow)"
      />
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
    </svg>
    <div class="ring-center">
      <slot>
        <span class="ring-value">{{ displayValue }}</span>
        <span class="ring-unit">%</span>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getProgressColorSmooth } from '@/utils/format'

const props = withDefaults(defineProps<{
  percent: number
  size?: number
  stroke?: number
  color?: string
}>(), {
  size: 120,
  stroke: 6,
  color: ''
})

const center = computed(() => props.size / 2)
const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() => {
  const p = Math.max(0, Math.min(100, props.percent))
  return circumference.value * (1 - p / 100)
})

const progressColor = computed(() => {
  if (props.color) return props.color
  return getProgressColorSmooth(props.percent)
})

const displayValue = computed(() => props.percent.toFixed(1))
</script>

<style scoped>
.token-ring {
  position: relative;
  width: var(--size);
  height: var(--size);
}

.ring-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track {
  stroke: var(--border-light);
  transition: stroke var(--duration-normal) var(--ease-smooth);
}

.ring-fill {
  stroke-linecap: round;
  transition: stroke-dashoffset 1.2s var(--ease-spring),
              stroke var(--duration-normal) var(--ease-smooth);
  animation: ringDraw 1.5s var(--ease-spring) both;
}

.ring-glow {
  stroke-linecap: round;
  transition: stroke-dashoffset 1.2s var(--ease-spring);
  animation: ringDraw 1.5s var(--ease-spring) both;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.ring-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.ring-unit {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-top: 4px;
}

@keyframes ringDraw {
  from { stroke-dashoffset: v-bind(circumference); }
}
</style>
