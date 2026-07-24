import { createTheme } from '@mui/material/styles'
import type {} from '@mui/x-data-grid/themeAugmentation'

// Underline-Neutral design tokens — one source of truth for the app's look.
// Neutrals (cool-biased, chosen not defaulted)
export const COLOR_BG = '#f4f6f8'
export const COLOR_SURFACE = '#ffffff'
export const COLOR_INK = '#18212e'
export const COLOR_MUTED = '#64707f'
export const COLOR_LINE = '#e4e8ee'
// Accent — institutional navy (the single brand hue)
export const COLOR_ACCENT = '#1b4965'
export const COLOR_ACCENT_DARK = '#12344a'
export const COLOR_ACCENT_LT = '#35678c'
// Semantic (institutional, muted — separate from the accent)
export const COLOR_GOOD = '#1f8a54'
export const COLOR_WARN = '#b7791f'
export const COLOR_BAD = '#c0392f'
// Density / tables
export const TABLE_CELL_PADDING = '4px 12px'
export const TABLE_ROW_HEIGHT = 30
export const TABLE_HEADER_HEIGHT = 34
export const NUMERIC_FONT = 'ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace'
// Table header (Slate Institutional): solid slate fill + light labels
export const COLOR_HEADER_BG = '#2f3a49'
export const COLOR_HEADER_FG = '#eef2f7'

const theme = createTheme({
  palette: {
    primary: { main: COLOR_ACCENT, light: COLOR_ACCENT_LT, dark: COLOR_ACCENT_DARK, contrastText: '#ffffff' },
    secondary: { main: '#5b6b7f' },
    error: { main: COLOR_BAD },
    warning: { main: COLOR_WARN },
    success: { main: COLOR_GOOD },
    text: { primary: COLOR_INK, secondary: COLOR_MUTED },
    divider: COLOR_LINE,
    background: { default: COLOR_BG, paper: COLOR_SURFACE },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 13,
    h1: { fontSize: '1.75rem', fontWeight: 600 },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
    h4: { fontSize: '1.1rem', fontWeight: 600 },
    h5: { fontSize: '0.95rem', fontWeight: 600 },
    h6: { fontSize: '0.875rem', fontWeight: 600 },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.8rem' },
    caption: { fontSize: '0.72rem' },
    subtitle1: { fontSize: '0.875rem', fontWeight: 500 },
    subtitle2: { fontSize: '0.8rem', fontWeight: 500 },
  },
  spacing: 8,
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderBottom: '1px solid rgba(0,0,0,0.1)' },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '48px !important',
          paddingLeft: '12px !important',
          paddingRight: '12px !important',
        },
      },
    },
    MuiButton: {
      defaultProps: { size: 'small', disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, lineHeight: 1.4 },
        sizeSmall: { padding: '3px 10px', fontSize: '0.8rem' },
        sizeMedium: { padding: '5px 14px', fontSize: '0.875rem' },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
    },
    MuiFormControl: {
      defaultProps: { size: 'small' },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontSize: '0.875rem' },
        sizeSmall: { fontSize: '0.8rem' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        input: { paddingTop: '6px', paddingBottom: '6px' },
        inputSizeSmall: { paddingTop: '5px', paddingBottom: '5px' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 36,
          fontSize: '0.8rem',
          textTransform: 'none',
          padding: '6px 14px',
          fontWeight: 500,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 36 },
      },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        sizeSmall: { height: 20, fontSize: '0.68rem' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { border: `1px solid ${COLOR_LINE}`, boxShadow: '0 1px 2px rgba(20,30,45,0.05)', borderRadius: 6 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { boxShadow: '0 1px 2px rgba(20,30,45,0.05)' },
        elevation1: { boxShadow: '0 1px 2px rgba(20,30,45,0.05)' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: TABLE_CELL_PADDING, fontSize: '0.8rem', borderColor: COLOR_LINE },
        head: {
          backgroundColor: COLOR_HEADER_BG,
          color: COLOR_HEADER_FG,
          fontWeight: 600,
          fontSize: '0.68rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '6px 12px',
          whiteSpace: 'nowrap',
        },
        sizeSmall: { padding: TABLE_CELL_PADDING, fontSize: '0.8rem' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:last-child td': { borderBottom: 0 } },
      },
    },
    MuiDataGrid: {
      defaultProps: {
        density: 'compact',
        rowHeight: TABLE_ROW_HEIGHT,
        columnHeaderHeight: TABLE_HEADER_HEIGHT,
      },
      styleOverrides: {
        root: { border: `1px solid ${COLOR_LINE}`, borderRadius: 6 },
        cell: { padding: TABLE_CELL_PADDING, fontSize: '0.8rem', borderColor: COLOR_LINE },
        columnHeader: { padding: TABLE_CELL_PADDING },
        columnHeaders: {
          backgroundColor: COLOR_HEADER_BG,
          color: COLOR_HEADER_FG,
          '& .MuiDataGrid-sortIcon, & .MuiDataGrid-menuIconButton, & .MuiDataGrid-filterIcon': { color: COLOR_HEADER_FG },
        },
        columnHeaderTitle: { fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: COLOR_HEADER_FG },
        columnSeparator: { display: 'none' },
        row: { '&:hover': { backgroundColor: 'rgba(24,33,46,0.03)' } },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { paddingTop: 5, paddingBottom: 5 },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: { fontSize: '0.8rem' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: '0.8rem', minHeight: 32 },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { padding: '12px 16px', fontSize: '0.95rem', fontWeight: 600 },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '12px 16px' },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { padding: '8px 16px' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { padding: '4px 12px', fontSize: '0.8rem' },
      },
    },
    MuiAlertTitle: {
      styleOverrides: {
        root: { fontSize: '0.875rem', fontWeight: 600 },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: { boxShadow: 'none', '&:before': { display: 'none' } },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: { minHeight: 40, padding: '0 12px' },
        content: { margin: '8px 0' },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: { padding: '8px 12px 12px' },
      },
    },
  },
})

export default theme
