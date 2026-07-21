import React from 'react'
import { Grid, Typography, Box } from '@mui/material'

/**
 * A single labelled field in a detail section. The value sits in a fixed-height
 * slot so the read-only value reserves exactly the same vertical space as its
 * editor — the section never jumps when toggling between view and Edit/Save.
 *
 * - `value` is the read-only display; `children` is the editor (a TextField,
 *   Autocomplete, …) shown only while `editing` is true.
 * - Fields with no `children` stay read-only even in edit mode (e.g. ID).
 * - `multiline` gives a taller, full-width slot (for a description text area)
 *   and preserves line breaks in the read-only view.
 */
export interface DetailFieldProps {
  label: string
  editing: boolean
  value: React.ReactNode
  children?: React.ReactNode
  multiline?: boolean
}

// Heights match MUI's size="small" TextField (single line) and a 3-row multiline
// TextField, so the read-only slot and the editor occupy the same space.
export const FIELD_SLOT_H = 40
export const MULTILINE_SLOT_H = 92

const DetailField: React.FC<DetailFieldProps> = ({ label, editing, value, children, multiline }) => {
  const showEditor = editing && children != null
  const isEmpty = value === '' || value === null || value === undefined
  return (
    <Grid item xs={12} sm={multiline ? 12 : 6}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box
        data-testid="detail-slot"
        style={{ minHeight: multiline ? MULTILINE_SLOT_H : FIELD_SLOT_H }}
        sx={{ mt: 0.5, display: 'flex', alignItems: multiline ? 'flex-start' : 'center' }}
      >
        {showEditor ? (
          children
        ) : (
          <Typography
            variant="body1"
            sx={multiline ? { whiteSpace: 'pre-wrap', width: '100%' } : undefined}
          >
            {isEmpty ? '—' : value}
          </Typography>
        )}
      </Box>
    </Grid>
  )
}

export default DetailField
