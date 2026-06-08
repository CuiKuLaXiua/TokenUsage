import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import type { ChartThemeColors } from '@/types/usage'

const accentColorMap: Record<string, string> = {
  forest: '#6b9e7a',
  moss: '#8fa87a',
  matcha: '#a8c27a',
}

export function useChartTheme() {
  const themeStore = useThemeStore()

  const colors = computed<ChartThemeColors>(() => {
    const isDark = themeStore.isDark
    const accentHex = accentColorMap[themeStore.accent] || '#6b9e7a'
    return {
      isDark,
      accentHex,
      tooltipBg: isDark ? 'rgba(15,22,16,0.94)' : 'rgba(255,252,245,0.96)',
      tooltipText: isDark ? '#e4e0d8' : '#2c3028',
      tooltipBorder: isDark ? 'rgba(74,124,89,0.15)' : 'rgba(74,124,89,0.2)',
      axisColor: isDark ? '#5a6358' : '#8a9186',
      splitLineColor: isDark
        ? 'rgba(74,124,89,0.05)'
        : 'rgba(74,124,89,0.08)',
      pointerShadow: isDark
        ? 'rgba(74,124,89,0.06)'
        : 'rgba(74,124,89,0.08)',
    }
  })

  function buildDataZoom(c: ChartThemeColors) {
    return [
      {
        type: 'slider' as const,
        show: true,
        start: 0,
        end: 100,
        height: 20,
        bottom: 2,
        borderColor: 'transparent',
        backgroundColor: c.isDark
          ? 'rgba(74,124,89,0.04)'
          : 'rgba(74,124,89,0.06)',
        fillerColor: c.isDark
          ? 'rgba(74,124,89,0.08)'
          : 'rgba(74,124,89,0.12)',
        handleStyle: { color: c.accentHex, borderColor: 'transparent' },
        textStyle: { color: c.axisColor, fontSize: 10 },
        dataBackground: {
          lineStyle: { color: 'rgba(74,124,89,0.15)' },
          areaStyle: { color: 'rgba(74,124,89,0.04)' },
        },
      },
    ]
  }

  function buildTooltipShell(c: ChartThemeColors, isArea: boolean) {
    return {
      trigger: 'axis' as const,
      confine: true,
      enterable: false,
      appendToBody: true,
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      padding: [12, 16] as [number, number],
      textStyle: { color: c.tooltipText, fontSize: 12 },
      extraCssText: 'max-width: 300px; will-change: transform;',
      axisPointer: {
        type: (isArea ? 'line' : 'shadow') as 'line' | 'shadow',
        shadowStyle: { color: c.pointerShadow },
        lineStyle: {
          color: 'rgba(74,124,89,0.2)',
          type: 'dashed' as const,
        },
      },
    }
  }

  return { colors, buildDataZoom, buildTooltipShell }
}
