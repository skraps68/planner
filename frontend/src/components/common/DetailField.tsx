import React from 'react'
import { Typography, Box } from '@mui/material'

/**
 * A single labelled field in a (single-column) detail section: a right-aligned
 * label sits close to the LEFT of the value on one short row. The value lives in
 * a fixed-height slot so the read-only value reserves the same vertical space as
 * its editor — the section never jumps when toggling Edit/Save.
 *
 * - `value` is the read-only display; `children` is the editor shown while editing.
 * - Fields with no `children` stay read-only even in edit mode (e.g. ID).
 * - `multiline` gives a short text area (for a description); its label top-aligns
 *   with the first line of the value.
 *
 * Row width / column layout is the caller's concern (this renders a plain row).
 * The wrapper trims MUI's small-input padding so editors match the compact height.
 */
export interface DetailFieldProps {
  label: string
  editing: boolean
  value: React.ReactNode
  children?: React.ReactNode
  multiline?: boolean
}

export const ROW_H = 28
export const MULTILINE_SLOT_H = 64
// Right-hand band each detail section reserves on its value rows so the Edit/Save
// buttons sit at the top-right without crowding row 1; the Description reclaims it.
export const DETAIL_BUTTON_BAND = 180
const LABEL_W = 98
const LABEL_LINE_H = 1.5
const TOP_PAD = '3px' // shared top offset so a multiline label & value first-lines align

const trimmedInputSx = {
  '& .MuiOutlinedInput-input': { paddingTop: '2px', paddingBottom: '2px' },
  '& .MuiInputBase-inputMultiline': { padding: 0 },
  '& .MuiAutocomplete-inputRoot': { paddingTop: '1px', paddingBottom: '1px' },
  '& .MuiAutocomplete-input': { paddingTop: '2px', paddingBottom: '2px' },
}

const DetailField: React.FC<DetailFieldProps> = ({ label, editing, value, children, multiline }) => {
  const showEditor = editing && children != null
  const isEmpty = value === '' || value === null || value === undefined

  return (
    <Box sx={{ display: 'flex', alignItems: multiline ? 'flex-start' : 'center', gap: 0.75, ...trimmedInputSx }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          width: LABEL_W,
          flexShrink: 0,
          textAlign: 'right',
          lineHeight: LABEL_LINE_H,
          ...(multiline ? { pt: TOP_PAD } : {}),
        }}
      >
        {label}
      </Typography>
      <Box
        data-testid="detail-slot"
        style={{ minHeight: multiline ? MULTILINE_SLOT_H : ROW_H }}
        sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: multiline ? 'flex-start' : 'center' }}
      >
        {showEditor ? (
          children
        ) : multiline ? (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: LABEL_LINE_H, pt: TOP_PAD }}>
            {isEmpty ? '—' : value}
          </Typography>
        ) : (
          <Typography variant="body2" noWrap title={typeof value === 'string' ? value : undefined}>
            {isEmpty ? '—' : value}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default DetailField
