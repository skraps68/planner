import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Autocomplete,
  CircularProgress,
  TextField,
  type SxProps,
  type Theme,
} from '@mui/material'

const SEARCH_DEBOUNCE_MS = 250

interface AssignmentEntityAutocompleteProps<T extends { id: string }> {
  value: T | null
  onChange: (value: T | null) => void
  searchOptions: (query: string) => Promise<T[]>
  getOptionLabel: (option: T) => string
  ariaLabel: string
  placeholder: string
  entityPlural: string
  disabled?: boolean
  autoFocus?: boolean
  sx?: SxProps<Theme>
}

/**
 * Compact server-backed type-ahead used by both assignment-grid perspectives.
 * Domain-specific option loading stays with the owning page so project and
 * resource access/filtering rules do not leak into shared grid mechanics.
 */
export function AssignmentEntityAutocomplete<T extends { id: string }>({
  value,
  onChange,
  searchOptions,
  getOptionLabel,
  ariaLabel,
  placeholder,
  entityPlural,
  disabled,
  autoFocus,
  sx,
}: AssignmentEntityAutocompleteProps<T>) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      requestIdRef.current += 1
      setOptions([])
      setLoading(false)
      return
    }

    setLoading(true)
    const handle = setTimeout(() => {
      const requestId = ++requestIdRef.current
      searchOptions(term)
        .then((results) => {
          if (requestId === requestIdRef.current) setOptions(results)
        })
        .catch(() => {
          if (requestId === requestIdRef.current) setOptions([])
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(handle)
  }, [query, searchOptions])

  const mergedOptions = useMemo(() => {
    if (value && !options.some((option) => option.id === value.id)) {
      return [value, ...options]
    }
    return options
  }, [options, value])

  return (
    <Autocomplete
      fullWidth
      size="small"
      sx={sx}
      disabled={disabled}
      options={mergedOptions}
      value={value}
      loading={loading}
      autoHighlight
      filterOptions={(results) => results}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      onChange={(_event, selected) => onChange(selected)}
      onInputChange={(_event, nextQuery, reason) => {
        if (reason === 'input') setQuery(nextQuery)
      }}
      noOptionsText={
        query.trim()
          ? `No ${entityPlural} found`
          : `Type to search ${entityPlural}`
      }
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus={autoFocus}
          placeholder={placeholder}
          variant="standard"
          inputProps={{
            ...params.inputProps,
            'aria-label': ariaLabel,
          }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={14} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  )
}

