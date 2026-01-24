import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material'
import { Download } from '@mui/icons-material'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  onExport: (format: 'pdf' | 'excel', options: ExportOptions) => Promise<void>
  title?: string
}

export interface ExportOptions {
  includeCharts: boolean
  includeDetails: boolean
  includeRawData: boolean
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  onExport,
  title = 'Export Report'
}) => {
  const [format, setFormat] = useState<'pdf' | 'excel'>('excel')
  const [options, setOptions] = useState<ExportOptions>({
    includeCharts: true,
    includeDetails: true,
    includeRawData: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    try {
      await onExport(format, options)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  const handleOptionChange = (option: keyof ExportOptions) => {
    setOptions((prev) => ({
      ...prev,
      [option]: !prev[option]
    }))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Export Format</FormLabel>
            <RadioGroup
              value={format}
              onChange={(e) => setFormat(e.target.value as 'pdf' | 'excel')}
            >
              <FormControlLabel value="excel" control={<Radio />} label="Excel (.xlsx)" />
              <FormControlLabel value="pdf" control={<Radio />} label="PDF (.pdf)" />
            </RadioGroup>
          </FormControl>

          <FormControl component="fieldset" sx={{ mt: 3 }}>
            <FormLabel component="legend">Export Options</FormLabel>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.includeCharts}
                    onChange={() => handleOptionChange('includeCharts')}
                  />
                }
                label="Include Charts and Visualizations"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.includeDetails}
                    onChange={() => handleOptionChange('includeDetails')}
                  />
                }
                label="Include Detailed Breakdown"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.includeRawData}
                    onChange={() => handleOptionChange('includeRawData')}
                  />
                }
                label="Include Raw Data (Excel only)"
                disabled={format === 'pdf'}
              />
            </FormGroup>
          </FormControl>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Note: Export functionality is currently in development. This will generate a
            downloadable file with your selected options.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <Download />}
          disabled={loading}
        >
          {loading ? 'Exporting...' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ExportDialog
