import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Link,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { actualsApi, ActualImportResponse, AllocationConflictResponse } from '../../api/actuals'

const steps = ['Upload File', 'Validate Data', 'Review Results', 'Import Confirmation']

const ActualsImportPage = () => {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validationResult, setValidationResult] = useState<ActualImportResponse | null>(null)
  const [conflictResult, setConflictResult] = useState<AllocationConflictResponse | null>(null)
  const [importResult, setImportResult] = useState<ActualImportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }
    setSelectedFile(file)
    setError(null)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleValidate = async () => {
    if (!selectedFile) return

    setLoading(true)
    setError(null)

    try {
      // First validate the file
      const validation = await actualsApi.importActuals(selectedFile, true)
      setValidationResult(validation)

      // Check for allocation conflicts
      const conflicts = await actualsApi.checkAllocationConflicts(selectedFile)
      setConflictResult(conflicts)

      setActiveStep(1)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to validate file')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) return

    setLoading(true)
    setError(null)

    try {
      const result = await actualsApi.importActuals(selectedFile, false)
      setImportResult(result)
      setActiveStep(3)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to import actuals')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setActiveStep(0)
    setSelectedFile(null)
    setValidationResult(null)
    setConflictResult(null)
    setImportResult(null)
    setError(null)
  }

  const downloadTemplate = () => {
    const csvContent = 'project_id,external_worker_id,worker_name,date,percentage\n' +
      '550e8400-e29b-41d4-a716-446655440000,EMP001,John Smith,2024-01-15,75.0\n' +
      '550e8400-e29b-41d4-a716-446655440000,EMP002,Jane Doe,2024-01-15,50.0'
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'actuals_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const renderUploadStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Upload Actuals CSV File
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Upload a CSV file containing actual work records. The file should include project ID, worker ID, worker name, date, and allocation percentage.
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body2"
          onClick={downloadTemplate}
          sx={{ cursor: 'pointer' }}
        >
          Download CSV Template
        </Link>
      </Box>

      <Paper
        variant="outlined"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        sx={{
          p: 4,
          textAlign: 'center',
          border: dragActive ? '2px dashed primary.main' : '2px dashed grey.300',
          backgroundColor: dragActive ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          id="file-input"
        />
        <label htmlFor="file-input" style={{ cursor: 'pointer', display: 'block' }}>
          <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {selectedFile ? selectedFile.name : 'Drag and drop CSV file here'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            or click to browse
          </Typography>
        </label>
      </Paper>

      {selectedFile && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info">
            File selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
          </Alert>
        </Box>
      )}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => navigate('/actuals')}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleValidate}
          disabled={!selectedFile || loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Validate File'}
        </Button>
      </Box>
    </Box>
  )

  const renderValidationStep = () => {
    if (!validationResult) return null

    const hasErrors = validationResult.failed_imports > 0
    const hasConflicts = conflictResult?.has_conflicts

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Validation Results
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Alert severity={hasErrors || hasConflicts ? 'error' : 'success'} sx={{ mb: 2 }}>
            {hasErrors || hasConflicts ? (
              <>
                Validation found {validationResult.failed_imports} errors
                {hasConflicts && ` and ${conflictResult.conflicts.length} allocation conflicts`}
              </>
            ) : (
              `All ${validationResult.total_rows} rows validated successfully`
            )}
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Chip
              icon={<SuccessIcon />}
              label={`${validationResult.successful_imports} Valid`}
              color="success"
            />
            <Chip
              icon={<ErrorIcon />}
              label={`${validationResult.failed_imports} Errors`}
              color="error"
            />
            {hasConflicts && (
              <Chip
                icon={<WarningIcon />}
                label={`${conflictResult.conflicts.length} Conflicts`}
                color="warning"
              />
            )}
          </Box>
        </Box>

        {hasErrors && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Validation Errors:
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Errors</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {validationResult.results
                    .filter((r) => !r.success)
                    .map((result) => (
                      <TableRow key={result.row_number}>
                        <TableCell>{result.row_number}</TableCell>
                        <TableCell>
                          {result.errors?.map((err, idx) => (
                            <Typography key={idx} variant="body2" color="error">
                              {err}
                            </Typography>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {hasConflicts && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Allocation Conflicts:
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Worker</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Existing</TableCell>
                    <TableCell align="right">New</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {conflictResult.conflicts.map((conflict, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        {conflict.worker_name}
                        <Typography variant="caption" display="block" color="text.secondary">
                          {conflict.external_worker_id}
                        </Typography>
                      </TableCell>
                      <TableCell>{conflict.actual_date}</TableCell>
                      <TableCell align="right">{conflict.existing_allocation}%</TableCell>
                      <TableCell align="right">{conflict.new_allocation}%</TableCell>
                      <TableCell align="right">
                        <Typography color="error" fontWeight="bold">
                          {conflict.total_allocation}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleReset}>Start Over</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setActiveStep(0)}>Back</Button>
            <Button
              variant="contained"
              onClick={() => setActiveStep(2)}
              disabled={hasErrors || hasConflicts}
            >
              Continue to Import
            </Button>
          </Box>
        </Box>
      </Box>
    )
  }

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review and Confirm Import
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        You are about to import {validationResult?.successful_imports} actual records.
        This action cannot be undone.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Import Summary:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2">
            File: <strong>{selectedFile?.name}</strong>
          </Typography>
          <Typography variant="body2">
            Total Rows: <strong>{validationResult?.total_rows}</strong>
          </Typography>
          <Typography variant="body2">
            Valid Records: <strong>{validationResult?.successful_imports}</strong>
          </Typography>
        </Box>
      </Paper>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={handleReset}>Cancel</Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={() => setActiveStep(1)}>Back</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleImport}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Import Actuals'}
          </Button>
        </Box>
      </Box>
    </Box>
  )

  const renderConfirmationStep = () => {
    if (!importResult) return null

    const success = importResult.failed_imports === 0

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Import Complete
        </Typography>

        <Alert severity={success ? 'success' : 'warning'} sx={{ mb: 3 }}>
          {success ? (
            `Successfully imported ${importResult.successful_imports} actual records`
          ) : (
            `Imported ${importResult.successful_imports} records with ${importResult.failed_imports} failures`
          )}
        </Alert>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Chip
            icon={<SuccessIcon />}
            label={`${importResult.successful_imports} Imported`}
            color="success"
          />
          {importResult.failed_imports > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${importResult.failed_imports} Failed`}
              color="error"
            />
          )}
        </Box>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleReset}>Import Another File</Button>
          <Button variant="contained" onClick={() => navigate('/actuals')}>
            View Actuals
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Import Actuals
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {activeStep === 0 && renderUploadStep()}
        {activeStep === 1 && renderValidationStep()}
        {activeStep === 2 && renderReviewStep()}
        {activeStep === 3 && renderConfirmationStep()}
      </Paper>
    </Box>
  )
}

export default ActualsImportPage
