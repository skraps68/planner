import { createTheme } from '@mui/material/styles'
import type {} from '@mui/x-data-grid/themeAugmentation'

// Shared spacing constants for tables and data grids, kept in one place so
// list/header density stays consistent across the app.
export const TABLE_CELL_PADDING = '4px 10px'
export const TABLE_HEADER_BG = '#A5C1D8'
export const TABLE_ROW_HEIGHT = 36
export const TABLE_HEADER_HEIGHT = 36

const theme = createTheme({
  palette: {
    primary: {
      main: '#1565c0',
      light: '#1976d2',
      dark: '#0d47a1',
    },
    secondary: {
      main: '#7b1fa2',
      light: '#9c27b0',
      dark: '#6a1b9a',
    },
    error: {
      main: '#c62828',
    },
    warning: {
      main: '#e65100',
    },
    success: {
      main: '#2e7d32',
    },
    background: {
      default: '#f0f2f5',
      paper: '#ffffff',
    },
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
    borderRadius: 3,
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
      defaultProps: { size: 'small' },
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
        root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderRadius: 3 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
        elevation1: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: TABLE_CELL_PADDING, fontSize: '0.8rem' },
        head: { fontWeight: 600, fontSize: '0.78rem' },
        sizeSmall: { padding: TABLE_CELL_PADDING, fontSize: '0.78rem' },
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
        cell: { padding: TABLE_CELL_PADDING, fontSize: '0.8rem' },
        columnHeader: { padding: TABLE_CELL_PADDING },
        columnHeaders: { backgroundColor: TABLE_HEADER_BG },
        columnHeaderTitle: { fontWeight: 600, fontSize: '0.78rem' },
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
