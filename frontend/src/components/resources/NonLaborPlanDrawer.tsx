import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'

import { externalReferenceTypesApi } from '../../api/externalReferenceTypes'
import {
  nonlaborPlansApi,
  type ExternalReferenceInput,
  type ManualCashFlowInput,
  type NonLaborPlanCreateInput,
  type NonLaborPlanPreview,
} from '../../api/nonlaborPlans'
import { projectsApi } from '../../api/projects'
import { resourcesApi } from '../../api/resources'
import type {
  NonLaborCostTreatment,
  NonLaborFrequency,
  NonLaborPeriodPlacement,
  NonLaborPlanLine,
  NonLaborPlanMethod,
  Project,
  Resource,
} from '../../types'
import { APP_HEADER_HEIGHT } from '../../theme'


interface FixedProject {
  id: string
  name: string
  start_date: string
  end_date: string
  currency_code?: string
}

interface NonLaborPlanDrawerProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  fixedProject?: FixedProject
  fixedResource?: Pick<Resource, 'id' | 'name' | 'external_references'>
  initialPlan?: NonLaborPlanLine
}

interface ReferenceDraft {
  reference_type_id: string
  value: string
}

interface ManualCashFlowDraft {
  occurrence_date: string
  amount: string
}

const blankCashFlow = (): ManualCashFlowDraft => ({
  occurrence_date: '',
  amount: '',
})

const normalizeAmountInput = (value: string) =>
  value.replace(/^0+(?=\d)/, '')

const formatMoney = (value: number, decimals = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)

interface ApiFailure {
  response?: { data?: { detail?: string } }
}

const errorText = (error: unknown, fallback: string) =>
  (error as ApiFailure)?.response?.data?.detail || fallback

export default function NonLaborPlanDrawer({
  open,
  onClose,
  onSaved,
  fixedProject,
  fixedResource,
  initialPlan,
}: NonLaborPlanDrawerProps) {
  const [step, setStep] = useState(0)
  const [project, setProject] = useState<Project | null>(null)
  const [resource, setResource] = useState<Resource | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [treatment, setTreatment] = useState<NonLaborCostTreatment>('EXPENSE')
  const [method, setMethod] = useState<NonLaborPlanMethod>('STRAIGHT_LINE')
  const [totalAmount, setTotalAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [frequency, setFrequency] = useState<NonLaborFrequency>('MONTHLY')
  const [placement, setPlacement] = useState<NonLaborPeriodPlacement>('PERIOD_END')
  const [manualEntries, setManualEntries] = useState<ManualCashFlowDraft[]>([
    blankCashFlow(),
  ])
  const [references, setReferences] = useState<ReferenceDraft[]>([])
  const [preview, setPreview] = useState<NonLaborPlanPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const { data: projectPage } = useQuery({
    queryKey: ['projects', 'nonlabor-plan-options'],
    queryFn: () => projectsApi.list({ size: 100 }),
    enabled: open && !fixedProject,
  })
  const { data: resourcePage } = useQuery({
    queryKey: ['resources', 'nonlabor-plan-options'],
    queryFn: () => resourcesApi.listNonLabor({ size: 100 }),
    enabled: open && !fixedResource,
  })
  const { data: referenceTypes = [] } = useQuery({
    queryKey: ['external-reference-types'],
    queryFn: () => externalReferenceTypesApi.list(),
    enabled: open,
  })

  const selectedProject = fixedProject ?? (initialPlan ? {
    id: initialPlan.project_id,
    name: initialPlan.project_name,
    start_date: initialPlan.project_start_date,
    end_date: initialPlan.project_end_date,
    currency_code: initialPlan.currency_code,
  } : project)
  const selectedResource = fixedResource ?? (initialPlan ? {
    id: initialPlan.resource_id,
    name: initialPlan.resource_name,
  } : resource)

  useEffect(() => {
    if (!open) return
    setStep(0)
    setProject(null)
    setResource(null)
    setName(initialPlan?.name ?? '')
    setDescription(initialPlan?.description ?? '')
    setTreatment(initialPlan?.cost_treatment ?? 'EXPENSE')
    setMethod(initialPlan?.method ?? 'STRAIGHT_LINE')
    setTotalAmount(initialPlan ? String(initialPlan.total_amount) : '')
    setStartDate(
      initialPlan?.schedule_start
      ?? fixedProject?.start_date
      ?? '',
    )
    setEndDate(
      initialPlan?.schedule_end
      ?? fixedProject?.end_date
      ?? '',
    )
    setFrequency(initialPlan?.frequency ?? 'MONTHLY')
    setPlacement(initialPlan?.period_placement ?? 'PERIOD_END')
    setManualEntries(
      initialPlan?.method === 'MANUAL'
        ? initialPlan.occurrences.map((item) => ({
            occurrence_date: item.occurrence_date,
            amount: String(item.effective_amount),
          }))
        : [blankCashFlow()],
    )
    const defaultReferences = initialPlan?.references
      ?? fixedResource?.external_references
      ?? []
    setReferences(defaultReferences.map((item) => ({
      reference_type_id: item.reference_type_id,
      value: item.value,
    })))
    setPreview(null)
    setBusy(false)
    setError(null)
    setCancelDialogOpen(false)
  }, [open, fixedProject, fixedResource?.external_references, initialPlan])

  useEffect(() => {
    if (!project || fixedProject) return
    setStartDate(project.start_date)
    setEndDate(project.end_date)
  }, [project, fixedProject])

  const definition = useMemo(() => ({
    method,
    ...(method === 'STRAIGHT_LINE' ? {
      total_amount: Number(totalAmount),
      schedule_start: startDate,
      schedule_end: endDate,
      frequency,
      period_placement: placement,
    } : {}),
    manual_occurrences: method === 'MANUAL'
      ? manualEntries
          .filter((item) => item.occurrence_date && item.amount !== '')
          .map((item): ManualCashFlowInput => ({
            occurrence_date: item.occurrence_date,
            amount: Number(item.amount),
          }))
      : [],
  }), [
    method,
    totalAmount,
    startDate,
    endDate,
    frequency,
    placement,
    manualEntries,
  ])

  const basicsValid = Boolean(selectedProject && selectedResource && name.trim())
  const scheduleValid = method === 'MANUAL'
    ? manualEntries.some((item) =>
        item.occurrence_date
        && item.amount !== ''
        && Number(item.amount) >= 0
      )
    : Number(totalAmount) >= 0 && totalAmount !== '' && Boolean(startDate && endDate)

  const handleContinue = async () => {
    setError(null)
    if (step === 0) {
      if (!basicsValid) {
        setError('Project, resource, and forecast-line name are required.')
        return
      }
      setStep(1)
      return
    }
    if (!scheduleValid) {
      setError('Complete the schedule before continuing.')
      return
    }
    try {
      setBusy(true)
      const nextPreview = await nonlaborPlansApi.preview({
        project_id: selectedProject!.id,
        ...definition,
      })
      setPreview(nextPreview)
      setStep(2)
    } catch (previewError) {
      setError(errorText(previewError, 'Unable to preview this cost plan.'))
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    try {
      setBusy(true)
      setError(null)
      const referenceInputs: ExternalReferenceInput[] = references
        .filter((item) => item.reference_type_id && item.value)
        .map((item) => ({
          reference_type_id: item.reference_type_id,
          value: item.value,
        }))
      const payload: NonLaborPlanCreateInput = {
        project_id: selectedProject!.id,
        resource_id: selectedResource!.id,
        name: name.trim(),
        description: description.trim() || undefined,
        cost_treatment: treatment,
        references: referenceInputs,
        ...definition,
      }
      if (initialPlan) {
        await nonlaborPlansApi.update(initialPlan.id, {
          version: initialPlan.version,
          name: payload.name,
          description: payload.description,
          cost_treatment: payload.cost_treatment,
          references: payload.references,
          method: payload.method,
          total_amount: payload.total_amount,
          schedule_start: payload.schedule_start,
          schedule_end: payload.schedule_end,
          frequency: payload.frequency,
          period_placement: payload.period_placement,
          manual_occurrences: payload.manual_occurrences,
        })
      } else {
        await nonlaborPlansApi.create(payload)
      }
      onSaved()
      onClose()
    } catch (saveError) {
      setError(errorText(
        saveError,
        initialPlan
          ? 'Unable to update the cost plan.'
          : 'Unable to create the cost plan.',
      ))
    } finally {
      setBusy(false)
    }
  }

  const handleCancelPlan = async () => {
    if (!initialPlan) return
    try {
      setBusy(true)
      setError(null)
      await nonlaborPlansApi.cancel(initialPlan.id, initialPlan.version)
      setCancelDialogOpen(false)
      onSaved()
      onClose()
    } catch (cancelError) {
      setCancelDialogOpen(false)
      setError(errorText(cancelError, 'Unable to cancel the cost plan.'))
    } finally {
      setBusy(false)
    }
  }

  const updateManualEntry = (
    index: number,
    patch: Partial<ManualCashFlowDraft>,
  ) => {
    setManualEntries((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    )
  }

  const contextName =
    selectedProject?.name
    || selectedResource?.name
    || 'Non-labor forecast'

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 620 },
          maxWidth: '100%',
          top: `${APP_HEADER_HEIGHT}px`,
          height: `calc(100% - ${APP_HEADER_HEIGHT}px)`,
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 2.5, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
              <Typography variant="h5">
                {initialPlan ? 'Edit Cost Plan' : 'Add Cost Plan'}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                title={contextName}
                sx={{
                  lineHeight: 1.4,
                  overflowWrap: 'anywhere',
                  whiteSpace: 'normal',
                }}
              >
                {contextName}
              </Typography>
            </Box>
            <IconButton
              sx={{ flexShrink: 0 }}
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <Stepper activeStep={step} sx={{ mt: 2 }}>
            {['Basics', 'Schedule', 'Preview'].map((label) => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>
        </Box>
        <Divider />

        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {step === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {fixedProject ? (
                <TextField label="Project" value={fixedProject.name} disabled />
              ) : (
                <Autocomplete
                  options={projectPage?.items ?? []}
                  value={project}
                  getOptionLabel={(option) =>
                    option.business_id
                      ? `${option.business_id} · ${option.name}`
                      : option.name
                  }
                  onChange={(_event, value) => setProject(value)}
                  renderInput={(params) => <TextField {...params} label="Project" required />}
                />
              )}
              {fixedResource ? (
                <TextField label="Non-Labor Resource" value={fixedResource.name} disabled />
              ) : (
                <Autocomplete
                  options={resourcePage?.items ?? []}
                  value={resource}
                  getOptionLabel={(option) => option.name}
                  onChange={(_event, value) => {
                    setResource(value)
                    setReferences((value?.external_references ?? []).map(
                      (item) => ({
                        reference_type_id: item.reference_type_id,
                        value: item.value,
                      }),
                    ))
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Non-Labor Resource" required />
                  )}
                />
              )}
              <TextField
                label="Forecast Line Name"
                value={name}
                required
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                label="Description"
                value={description}
                multiline
                rows={2}
                onChange={(event) => setDescription(event.target.value)}
              />
              <FormControl>
                <InputLabel id="nonlabor-treatment-label">Treatment</InputLabel>
                <Select
                  labelId="nonlabor-treatment-label"
                  label="Treatment"
                  value={treatment}
                  onChange={(event) =>
                    setTreatment(event.target.value as NonLaborCostTreatment)
                  }
                >
                  <MenuItem value="CAPITAL">Capital</MenuItem>
                  <MenuItem value="EXPENSE">Expense</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Currency"
                value={selectedProject?.currency_code || 'USD'}
                disabled
              />

              <Typography variant="subtitle2" sx={{ mt: 1 }}>External References</Typography>
              {references.map((reference, index) => (
                <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '180px 1fr 36px', gap: 1 }}>
                  <FormControl size="small">
                    <InputLabel id={`reference-type-${index}`}>Type</InputLabel>
                    <Select
                      labelId={`reference-type-${index}`}
                      label="Type"
                      value={reference.reference_type_id}
                      onChange={(event) => setReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, reference_type_id: event.target.value }
                            : item
                        )
                      )}
                    >
                      {reference.reference_type_id
                        && !referenceTypes.some(
                          (item) => item.id === reference.reference_type_id,
                        ) && (
                          <MenuItem value={reference.reference_type_id}>
                            {initialPlan?.references.find(
                              (item) =>
                                item.reference_type_id === reference.reference_type_id,
                            )?.reference_type_name ?? 'Existing reference type'}
                          </MenuItem>
                        )}
                      {referenceTypes.filter((item) => item.is_active).map((item) => (
                        <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Reference Value"
                    value={reference.value}
                    inputProps={{ maxLength: 32, pattern: '[A-Za-z0-9]+' }}
                    onChange={(event) => {
                      const value = event.target.value.replace(/[^A-Za-z0-9]/g, '')
                      setReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, value } : item
                        )
                      )
                    }}
                  />
                  <IconButton
                    size="small"
                    aria-label="Remove reference"
                    onClick={() => setReferences((current) =>
                      current.filter((_item, itemIndex) => itemIndex !== index)
                    )}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setReferences((current) => [
                  ...current,
                  { reference_type_id: '', value: '' },
                ])}
                sx={{ alignSelf: 'flex-start' }}
              >
                Add Reference
              </Button>
            </Box>
          )}

          {step === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Schedule method</Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={method}
                onChange={(_event, value: NonLaborPlanMethod | null) => {
                  if (value) setMethod(value)
                }}
              >
                <ToggleButton value="MANUAL">Manual cash flow</ToggleButton>
                <ToggleButton value="STRAIGHT_LINE">Straight-line spread</ToggleButton>
              </ToggleButtonGroup>

              {method === 'STRAIGHT_LINE' ? (
                <>
                  <TextField
                    label="Total Amount"
                    type="number"
                    value={totalAmount}
                    inputProps={{ min: 0, step: '0.0001' }}
                    onChange={(event) =>
                      setTotalAmount(normalizeAmountInput(event.target.value))
                    }
                  />
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <TextField
                      label="Start Date"
                      type="date"
                      value={startDate}
                      InputLabelProps={{ shrink: true }}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                    <TextField
                      label="End Date"
                      type="date"
                      value={endDate}
                      InputLabelProps={{ shrink: true }}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                    <FormControl>
                      <InputLabel id="nonlabor-frequency-label">Frequency</InputLabel>
                      <Select
                        labelId="nonlabor-frequency-label"
                        label="Frequency"
                        value={frequency}
                        onChange={(event) =>
                          setFrequency(event.target.value as NonLaborFrequency)
                        }
                      >
                        <MenuItem value="DAILY">Daily</MenuItem>
                        <MenuItem value="MONTHLY">Monthly</MenuItem>
                        <MenuItem value="YEARLY">Yearly</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl disabled={frequency === 'DAILY'}>
                      <InputLabel id="nonlabor-placement-label">Place Amount At</InputLabel>
                      <Select
                        labelId="nonlabor-placement-label"
                        label="Place Amount At"
                        value={placement}
                        onChange={(event) =>
                          setPlacement(event.target.value as NonLaborPeriodPlacement)
                        }
                      >
                        <MenuItem value="PERIOD_START">Period start</MenuItem>
                        <MenuItem value="PERIOD_END">Period end</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </>
              ) : (
                <>
                  <Typography variant="subtitle2">Cash flow entries</Typography>
                  {manualEntries.map((entry, index) => (
                    <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 36px', gap: 1 }}>
                      <TextField
                        size="small"
                        label="Date"
                        type="date"
                        value={entry.occurrence_date}
                        InputLabelProps={{ shrink: true }}
                        onChange={(event) =>
                          updateManualEntry(index, { occurrence_date: event.target.value })
                        }
                      />
                      <TextField
                        size="small"
                        label="Amount"
                        type="number"
                        value={entry.amount}
                        inputProps={{ min: 0, step: '0.0001' }}
                        onChange={(event) =>
                          updateManualEntry(index, {
                            amount: normalizeAmountInput(event.target.value),
                          })
                        }
                      />
                      <IconButton
                        size="small"
                        aria-label="Remove cash flow"
                        disabled={manualEntries.length === 1}
                        onClick={() => setManualEntries((current) =>
                          current.filter((_item, itemIndex) => itemIndex !== index)
                        )}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setManualEntries((current) => [
                      ...current,
                      blankCashFlow(),
                    ])}
                  >
                    Add Cash Flow
                  </Button>
                </>
              )}
            </Box>
          )}

          {step === 2 && preview && (
            <Box>
              {preview.warnings.map((warning) => (
                <Alert key={warning} severity="warning" sx={{ mb: 1 }}>{warning}</Alert>
              ))}
              <Typography variant="h6" sx={{ mb: 0.5 }}>Review Cost Plan</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {preview.occurrence_count} occurrence{preview.occurrence_count === 1 ? '' : 's'}
                {' · '}exact total {formatMoney(preview.exact_total)}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.occurrences.slice(0, 12).map((item) => (
                    <TableRow key={item.occurrence_date}>
                      <TableCell>{item.occurrence_date}</TableCell>
                      <TableCell align="right">{formatMoney(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {preview.occurrences.length > 12 && (
                    <TableRow>
                      <TableCell colSpan={2} sx={{ color: 'text.secondary' }}>
                        + {preview.occurrences.length - 12} more occurrences
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <Alert severity="info" sx={{ mt: 2 }}>
                Grid cells display whole dollars; exact amounts are preserved.
              </Alert>
            </Box>
          )}
        </Box>

        <Divider />
        <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
          {initialPlan && (
            <Button
              color="error"
              onClick={() => setCancelDialogOpen(true)}
              disabled={busy}
            >
              Cancel Cost Plan
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={busy}
            sx={{ ml: initialPlan ? 0 : undefined }}
          >
            Close
          </Button>
          {step > 0 && (
            <Button sx={{ ml: 'auto' }} onClick={() => setStep((current) => current - 1)} disabled={busy}>
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              variant="contained"
              onClick={handleContinue}
              disabled={busy}
              sx={{ ml: step === 0 ? 'auto' : 0 }}
            >
              {busy ? <CircularProgress size={18} /> : step === 0 ? 'Continue' : 'Continue to Preview'}
            </Button>
          ) : (
            <Button variant="contained" onClick={handleSave} disabled={busy}>
              {busy
                ? <CircularProgress size={18} />
                : initialPlan ? 'Save Cost Plan' : 'Create Cost Plan'}
            </Button>
          )}
        </Box>
      </Box>
      <Dialog
        open={cancelDialogOpen}
        onClose={busy ? undefined : () => setCancelDialogOpen(false)}
        aria-labelledby="cancel-cost-plan-title"
      >
        <DialogTitle id="cancel-cost-plan-title">Cancel cost plan?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {`“${initialPlan?.name ?? ''}” will be removed from active forecasts. Its history will be retained.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={busy}>
            Keep Plan
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleCancelPlan}
            disabled={busy}
          >
            {busy ? <CircularProgress size={18} /> : 'Cancel Cost Plan'}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  )
}
