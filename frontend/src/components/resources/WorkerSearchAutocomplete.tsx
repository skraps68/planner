import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Autocomplete, TextField, CircularProgress, SxProps, Theme } from '@mui/material'
import { workersApi } from '../../api/workers'
import { Worker } from '../../types'

interface WorkerSearchAutocompleteProps {
  /** Currently selected worker id (null when none). */
  value: string | null
  onChange: (workerId: string | null) => void
  label?: string
  placeholder?: string
  required?: boolean
  error?: boolean
  helperText?: string
  size?: 'small' | 'medium'
  sx?: SxProps<Theme>
}

const SEARCH_DEBOUNCE_MS = 300

/**
 * Worker picker backed by server-side search. Options are fetched on demand as
 * the user types (debounced), so it scales to thousands of workers without ever
 * loading them all. When a `value` is supplied (editing an existing labor
 * resource), the matching worker is fetched once and seeded as the selected
 * option so its name shows before the user searches.
 */
const WorkerSearchAutocomplete: React.FC<WorkerSearchAutocompleteProps> = ({
  value,
  onChange,
  label,
  placeholder,
  required,
  error,
  helperText,
  size,
  sx,
}) => {
  const [inputValue, setInputValue] = useState('')
  const [options, setOptions] = useState<Worker[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const reqIdRef = useRef(0)

  // Seed / sync the selected worker from the incoming value so the field shows
  // the current worker's name before any search happens.
  useEffect(() => {
    if (!value) {
      setSelectedWorker(null)
      return
    }
    if (selectedWorker?.id === value) return
    let cancelled = false
    workersApi
      .get(value)
      .then((w) => { if (!cancelled) setSelectedWorker(w) })
      .catch(() => { /* leave field empty; validation will prompt re-selection */ })
    return () => { cancelled = true }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced server-side search. A monotonic request id guards against a slow
  // earlier response overwriting the results of a newer query.
  useEffect(() => {
    const term = inputValue.trim()
    if (term.length < 1) {
      setOptions([])
      setLoading(false)
      return
    }
    setLoading(true)
    const handle = setTimeout(() => {
      const id = ++reqIdRef.current
      workersApi
        .list({ search: term, size: 100 })
        .then((res) => { if (id === reqIdRef.current) setOptions(res.items) })
        .catch(() => { if (id === reqIdRef.current) setOptions([]) })
        .finally(() => { if (id === reqIdRef.current) setLoading(false) })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [inputValue])

  // Keep the selected worker present in the option list so the controlled value
  // always resolves to a label, even when it isn't in the current search page.
  const mergedOptions = useMemo(() => {
    if (selectedWorker && !options.some((o) => o.id === selectedWorker.id)) {
      return [selectedWorker, ...options]
    }
    return options
  }, [options, selectedWorker])

  return (
    <Autocomplete
      sx={sx}
      size={size}
      options={mergedOptions}
      loading={loading}
      value={selectedWorker}
      // The server already filtered; don't re-filter client-side.
      filterOptions={(x) => x}
      getOptionLabel={(w) => w.name}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      onChange={(_, w) => {
        setSelectedWorker(w)
        onChange(w?.id ?? null)
      }}
      onInputChange={(_, v, reason) => { if (reason === 'input') setInputValue(v) }}
      noOptionsText={inputValue.trim().length < 1 ? 'Type to search workers' : 'No workers found'}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  )
}

export default WorkerSearchAutocomplete
