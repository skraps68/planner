import { describe, it, expect } from 'vitest'
import theme, {
  COLOR_ACCENT, COLOR_INK, COLOR_MUTED, COLOR_LINE, TABLE_ROW_HEIGHT, TABLE_HEADER_HEIGHT, TABLE_CELL_PADDING,
} from './theme'

describe('theme tokens (Underline-Neutral)', () => {
  it('exposes the density constants', () => {
    expect(TABLE_ROW_HEIGHT).toBe(30)
    expect(TABLE_HEADER_HEIGHT).toBe(34)
    expect(TABLE_CELL_PADDING).toBe('4px 12px')
  })
  it('uses the navy accent as the MUI primary', () => {
    expect(theme.palette.primary.main.toLowerCase()).toBe(COLOR_ACCENT.toLowerCase())
    expect(COLOR_ACCENT.toLowerCase()).toBe('#1b4965')
  })
  it('table headers have no background fill', () => {
    const head = (theme.components?.MuiTableCell?.styleOverrides as any)?.head
    expect(head.backgroundColor === undefined || head.backgroundColor === 'transparent').toBe(true)
  })
  it('keeps neutral tokens defined', () => {
    expect(COLOR_INK).toBeTruthy(); expect(COLOR_MUTED).toBeTruthy(); expect(COLOR_LINE).toBeTruthy()
  })
})
