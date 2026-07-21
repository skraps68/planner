import React from 'react'
import { Grid, Typography, Box } from '@mui/material'

/**
 * A single labelled field in a detail section, laid out COMPACTLY: a right-aligned
 * label sits close to the LEFT of the value on one short row (no stacked caption
 * line, no wide gap), and the value lives in a fixed-height slot so the read-only
 * value reserves the same vertical space as its editor — the section never jumps
 * when toggling Edit/Save.
 *
 * - `value` is the read-only display; `children` is the editor shown while editing.
 * - Fields with no `children` stay read-only even in edit mode (e.g. ID).
 * - `multiline` gives a full-width row with a short text area (for a description);
 *   its label top-aligns with the first line of the value.
 *
 * The wrapper trims MUI's small-input padding so editors match the compact row
 * height; callers just pass a plain `<TextField size="small" …>` / `<Autocomplete>`.
 */
export interface DetailFieldProps {
  label: string
  editing: boolean
  value: React.ReactNode
  children?: React.ReactNode
  multiline?: boolean
  /** Span the full row as a single column (single-line) — e.g. a long name. */
  fullWidth?: boolean
}

export const ROW_H = 28
export const MULTILINE_SLOT_H = 54
const LABEL_W = 98
const LABEL_LINE_H = 1.5
const TOP_PAD = '3px' // shared top offset so multiline label & value first-lines align

const trimmedInputSx = {
  '& .MuiOutlinedInput-input': { paddingTop: '2px', paddingBottom: '2px' },
  '& .MuiInputBase-inputMultiline': { padding: 0 },
  '& .MuiAutocomplete-inputRoot': { paddingTop: '1px', paddingBottom: '1px' },
  '& .MuiAutocomplete-input': { paddingTop: '2px', paddingBottom: '2px' },
}

const DetailField: React.FC<DetailFieldProps> = ({ label, editing, value, children, multiline, fullWidth }) => {
  const showEditor = editing && children != null
  const isEmpty = value === '' || value === null || value === undefined

  if (multiline) {
    return (
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, ...trimmedInputSx }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ width: LABEL_W, flexShrink: 0, textAlign: 'right', lineHeight: LABEL_LINE_H, pt: TOP_PAD }}
          >
            {label}
          </Typography>
          <Box
            data-testid="detail-slot"
            style={{ minHeight: MULTILINE_SLOT_H }}
            sx={{ flex: 1, minWidth: 0 }}
          >
            {showEditor ? (
              children
            ) : (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: LABEL_LINE_H, pt: TOP_PAD }}>
                {isEmpty ? '—' : value}
              </Typography>
            )}
          </Box>
        </Box>
      </Grid>
    )
  }

  return (
    <Grid item xs={12} sm={fullWidth ? 12 : 6}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ...trimmedInputSx }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ width: LABEL_W, flexShrink: 0, textAlign: 'right', lineHeight: LABEL_LINE_H }}
        >
          {label}
        </Typography>
        <Box
          data-testid="detail-slot"
          style={{ minHeight: ROW_H }}
          sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}
        >
          {showEditor ? (
            children
          ) : (
            <Typography variant="body2" noWrap title={typeof value === 'string' ? value : undefined}>
              {isEmpty ? '—' : value}
            </Typography>
          )}
        </Box>
      </Box>
    </Grid>
  )
}

export default DetailField
