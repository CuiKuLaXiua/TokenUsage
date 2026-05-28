<template>
  <span class="count-up" :style="{ color: color }">{{ displayValue }}</span>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  color?: string
}>(), {
  duration: 800,
  decimals: 0,
  prefix: '',
  suffix: '',
  color: ''
})

const displayValue = ref(props.prefix + '0' + props.suffix)

function animateValue(target: number) {
  const startTime = performance.now()
  const startVal = 0

  function tick(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / props.duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
    const current = startVal + (target - startVal) * eased

    displayValue.value = props.prefix + current.toFixed(props.decimals) + props.suffix

    if (progress < 1) {
      requestAnimationFrame(tick)
    }
  }

  requestAnimationFrame(tick)
}

onMounted(() => {
  animateValue(props.value)
})

watch(() => props.value, (newVal) => {
  animateValue(newVal)
})
</script>

<style scoped>
.count-up {
  font-variant-numeric: tabular-nums;
  transition: color var(--duration-normal) var(--ease-smooth);
}
</style>
