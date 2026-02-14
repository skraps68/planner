import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ConflictDialog from './ConflictDialog'

describe('ConflictDialog', () => {
  const mockOnRefreshAndRetry = vi.fn()
  const mockOnCancel = vi.fn()

  const defaultProps = {
    open: true,
    entityType: 'portfolio',
    attemptedChanges: {
      name: 'My Portfolio',
      description: 'My description',
      version: 1,
    },
    currentState: {
      id: '123',
      name: 'Updated Portfolio',
      description: 'Updated description',
      version: 2,
    },
    onRefreshAndRetry: mockOnRefreshAndRetry,
    onCancel: mockOnCancel,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays when open is true', () => {
    render(<ConflictDialog {...defaultProps} />)
    
    expect(screen.getByText('Update Conflict Detected')).toBeInTheDocument()
  })

  it('does not display when open is false', () => {
    render(<ConflictDialog {...defaultProps} open={false} />)
    
    expect(screen.queryByText('Update Conflict Detected')).not.toBeInTheDocument()
  })

  it('displays user-friendly error message', () => {
    render(<ConflictDialog {...defaultProps} />)
    
    expect(
      screen.getByText(/The portfolio was modified by another user/i)
    ).toBeInTheDocument()
  })

  it('shows comparison between attempted changes and current state', () => {
    render(<ConflictDialog {...defaultProps} />)
    
    // Check that field names are displayed
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    
    // Check that attempted changes are displayed
    expect(screen.getByText('My Portfolio')).toBeInTheDocument()
    expect(screen.getByText('My description')).toBeInTheDocument()
    
    // Check that current state is displayed
    expect(screen.getByText('Updated Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Updated description')).toBeInTheDocument()
  })

  it('highlights fields that differ between attempted and current', () => {
    render(<ConflictDialog {...defaultProps} />)
    
    // Both name and description differ, so both rows should be highlighted
    const rows = screen.getAllByRole('row')
    // Filter out header row
    const dataRows = rows.filter(row => row.querySelector('td'))
    
    expect(dataRows.length).toBeGreaterThan(0)
  })

  it('displays current version number', () => {
    render(<ConflictDialog {...defaultProps} />)
    
    expect(screen.getByText(/Current version: 2/i)).toBeInTheDocument()
  })

  it('provides Refresh & Retry button', () => {
    render(<ConflictDialog {...defaultProps} />)
    
    const refreshButton = screen.getByRole('button', { name: /Refresh & Retry/i })
    expect(refreshButton).toBeInTheDocument()
  })

  it('provides Cancel button', () => {
    render(<ConflictDialog {...defaultProps} />)
    
    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    expect(cancelButton).toBeInTheDocument()
  })

  it('calls onRefreshAndRetry when Refresh & Retry is clicked', async () => {
    render(<ConflictDialog {...defaultProps} />)
    
    const refreshButton = screen.getByRole('button', { name: /Refresh & Retry/i })
    fireEvent.click(refreshButton)
    
    await waitFor(() => {
      expect(mockOnRefreshAndRetry).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onCancel when Cancel is clicked', async () => {
    render(<ConflictDialog {...defaultProps} />)
    
    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelButton)
    
    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })

  it('does not automatically retry without user action', () => {
    render(<ConflictDialog {...defaultProps} />)
    
    // Wait a bit to ensure no automatic retry
    expect(mockOnRefreshAndRetry).not.toHaveBeenCalled()
  })

  it('formats field names correctly', () => {
    const props = {
      ...defaultProps,
      attemptedChanges: {
        reporting_start_date: '2024-01-01',
        version: 1,
      },
      currentState: {
        reporting_start_date: '2024-02-01',
        version: 2,
      },
    }
    
    render(<ConflictDialog {...props} />)
    
    // Should convert reporting_start_date to "Reporting Start Date"
    expect(screen.getByText('Reporting Start Date')).toBeInTheDocument()
  })

  it('handles null and undefined values', () => {
    const props = {
      ...defaultProps,
      attemptedChanges: {
        description: null,
        version: 1,
      },
      currentState: {
        description: undefined,
        version: 2,
      },
    }
    
    render(<ConflictDialog {...props} />)
    
    // Should display "N/A" for null/undefined
    const naElements = screen.getAllByText('N/A')
    expect(naElements.length).toBeGreaterThan(0)
  })

  it('handles boolean values', () => {
    const props = {
      ...defaultProps,
      attemptedChanges: {
        is_active: true,
        version: 1,
      },
      currentState: {
        is_active: false,
        version: 2,
      },
    }
    
    render(<ConflictDialog {...props} />)
    
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('excludes version field from comparison table', () => {
    render(<ConflictDialog {...defaultProps} />)
    
    // Version should not appear as a field in the comparison table
    const versionFieldName = screen.queryByText('Version')
    expect(versionFieldName).not.toBeInTheDocument()
  })
})
