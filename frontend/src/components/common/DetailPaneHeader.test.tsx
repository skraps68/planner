import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip } from '@mui/material'
import DetailPaneHeader from './DetailPaneHeader'

describe('DetailPaneHeader', () => {
  it('renders title, chip, and calls onClose from the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <DetailPaneHeader title="CRM System Upgrade" statusChip={<Chip label="Active" />} onClose={onClose} />
    )
    expect(screen.getByText('CRM System Upgrade')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /close detail/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
