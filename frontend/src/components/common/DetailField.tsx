import React from 'react'
import { Grid, Typography, Box } from '@mui/material'

/**
 * A single labelled field in a detail section, laid out COMPACTLY: the label sits
 * to the LEFT of the value on one short row (no stacked caption line), and the
 * value lives in a fixed-height slot so the read-only value reserves the same
 * vertical space as its editor — the section never jumps when toggling Edit/Save.
 *
 * - `value` is the read-only display; `children` is the editor shown while editing.
 * - Fields with no `children` stay read-only even in edit mode (e.g. ID).
 * - `multiline` gives a full-width row with a short text area (for a description).
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
}

// Compact single-line row height (matches a padding-trimmed size="small" input),
// and a 2-row slot for the multiline description.
export const ROW_H = 30
export const MULTILINE_SLOT_H = 56
const LABEL_W = 118

// Collapse the default vertical padding of small TextFields and Autocompletes so
// their editors fit the compact row height (kept here, in one place).
const trimmedInputSx = {
  '& .MuiOutlinedInput-input': { paddingTop: '3px', paddingBottom: '3px' },
  '& .MuiInputBase-inputMultiline': { padding: 0 },
  '& .MuiAutocomplete-inputRoot': { paddingTop: '1px', paddingBottom: '1px' },
  '& .MuiAutocomplete-input': { paddingTop: '2px', paddingBottom: '2px' },
}

const DetailField: React.FC<DetailFieldProps> = ({ label, editing, value, children, multiline }) => {
  const showEditor = editing && children != null
  const isEmpty = value === '' || value === null || value === undefined

  const labelEl = (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ width: LABEL_W, flexShrink: 0, lineHeight: 1.3 }}
    >
      {label}
    </Typography>
  )

  if (multiline) {
    return (
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, ...trimmedInputSx }}>
          <Box sx={{ pt: '4px' }}>{labelEl}</Box>
          <Box
            data-testid="detail-slot"
            style={{ minHeight: MULTILINE_SLOT_H }}
            sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start' }}
          >
            {showEditor ? (
              children
            ) : (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', width: '100%', py: '3px' }}>
                {isEmpty ? '—' : value}
              </Typography>
            )}
          </Box>
        </Box>
      </Grid>
    )
  }

  return (
    <Grid item xs={12} sm={6}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...trimmedInputSx }}>
        {labelEl}
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
