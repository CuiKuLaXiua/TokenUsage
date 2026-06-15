<template>
  <div
    class="token-ring"
    :style="{ '--size': size + 'px', '--stroke': stroke + 'px' }"
    role="progressbar"
    :aria-valuenow="Math.round(percent)"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="`${Math.round(percent)}% 已使用`"
  >
    <svg class="ring-svg" :viewBox="`0 0 ${svgSize} ${svgSize}`">
      <!-- Track -->
      <circle
        class="ring-track"
        :cx="svgCenter"
        :cy="svgCenter"
        :r="radius"
        fill="none"
        :stroke-width="stroke"
      />
      <!-- Fill -->
      <circle
        class="ring-fill"
        :cx="svgCenter"
        :cy="svgCenter"
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
        :cx="svgCenter"
        :cy="svgCenter"
        :r="radius"
        fill="none"
        :stroke-width="stroke * 2"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :stroke="progressColor"
        opacity="0.2"
        :filter="`url(#${filterId})`"
      />
      <defs>
        <filter :id="filterId">
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

const filterId = `glow-${Math.random().toString(36).slice(2, 8)}`

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

// 为光晕（stroke*2 + feGaussianBlur stdDeviation=3）预留溢出空间
// fill ring 外边界贴齐 viewBox 边，glow 外扩 stroke + blur(~9) SVG 单位
const svgPadding = computed(() => props.stroke * 2 + 21)
const svgSize = computed(() => props.size + svgPadding.value * 2)
const svgCenter = computed(() => svgSize.value / 2)
const radius = computed(() => (svgSize.value - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() => {
  const p = Math.max(0, Math.min(100, props.percent))
  return circumference.value * (1 - p / 100)
})

const progressColor = computed(() => {
  if (props.color) return props.color
  return getProgressColorSmooth(props.percent)
})

const displayValue = computed(() => {
  const p = Math.max(0, Math.min(100, props.percent))
  const rounded = Math.round(p * 10) / 10
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1)
})

const innerDiameter = computed(() => props.size - 2 * props.stroke)
const valueFontSize = computed(() => `${Math.round(innerDiameter.value * 0.35)}px`)
const unitFontSize = computed(() => `${Math.round(innerDiameter.value * 0.18)}px`)
</script>

<style scoped>
.token-ring {
  position: relative;
  width: var(--size);
  height: var(--size);
  overflow: visible;
}

.ring-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  overflow: visible;
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
  transition: stroke-dashoffset 1.2s var(--ease-spring),
              stroke var(--duration-normal) var(--ease-smooth);
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
  font-size: v-bind(valueFontSize);
  font-weight: 700;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', 'Monaco', monospace;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  line-height: 1.2;
}

.ring-unit {
  font-size: v-bind(unitFontSize);
  font-weight: 600;
  color: var(--text-secondary);
}

@keyframes ringDraw {
  from { stroke-dashoffset: v-bind(circumference); }
}

@media (prefers-contrast: more) {
  .ring-fill {
    filter: saturate(1.3);
  }
  .ring-glow {
    opacity: 0.35;
  }
}

@media (forced-colors: active) {
  .ring-track {
    stroke: CanvasText;
    opacity: 0.3;
  }
  .ring-fill {
    stroke: Highlight;
  }
  .ring-glow {
    stroke: Highlight;
    opacity: 0.3;
  }
  .ring-value {
    color: CanvasText;
  }
}
</style>
