export interface CsvColumn<T> {
  key: keyof T
  label: string
  /** 可选的值格式化函数 */
  format?: (value: T[keyof T], row: T) => string | number
}

/**
 * 将数据数组转为 CSV 字符串
 * 正确处理逗号、换行、引号转义（RFC 4180）
 */
export function arrayToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escapeCell = (val: string | number): string => {
    const s = String(val ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  const header = columns.map((c) => escapeCell(c.label)).join(',')
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const raw = row[c.key]
        const val = c.format ? c.format(raw, row) : raw
        return escapeCell(val as string | number)
      })
      .join(','),
  )

  // 添加 UTF-8 BOM 确保 Excel 正确识别中文
  return '﻿' + [header, ...body].join('\r\n')
}

/**
 * 通过 Electron 将 CSV 内容保存为文件
 * 返回 true 表示保存成功，false 表示用户取消
 */
export async function downloadCsv(csvContent: string, defaultFilename: string): Promise<boolean> {
  const result = await window.electronAPI.showSaveDialog({
    title: '导出 CSV',
    defaultPath: defaultFilename,
    filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
  })

  if (result.canceled || !result.filePath) return false

  await window.electronAPI.saveFile({
    filePath: result.filePath,
    content: csvContent,
  })

  return true
}
