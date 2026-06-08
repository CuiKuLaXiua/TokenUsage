export function getMonthDays(yearMonth: string): string[] {
  const [y, m] = yearMonth.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  return Array.from({ length: days }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return `${y}-${String(m).padStart(2, '0')}-${d}`
  })
}
