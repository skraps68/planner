import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DetailField from './DetailField'

describe('DetailField', () => {
  it('shows the read-only value (not the editor) when not editing', () => {
    render(
      <DetailField label="Program Name" editing={false} value="Acme">
        <input aria-label="editor" />
      </DetailField>
    )
    expect(screen.getByText('Program Name')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.queryByLabelText('editor')).toBeNull()
  })

  it('shows the editor (not the read-only value) when editing', () => {
    render(
      <DetailField label="Program Name" editing value="Acme">
        <input aria-label="editor" />
      </DetailField>
    )
    expect(screen.getByLabelText('editor')).toBeInTheDocument()
    expect(screen.queryByText('Acme')).toBeNull()
  })

  it('shows the value even in edit mode when there is no editor (read-only field)', () => {
    render(<DetailField label="ID" editing value="PG-001" />)
    expect(screen.getByText('PG-001')).toBeInTheDocument()
  })

  it('renders an em dash for an empty value', () => {
    render(<DetailField label="Description" editing={false} value="" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('reserves the same slot height in view and edit modes (no jump)', () => {
    const { rerender } = render(
      <DetailField label="Name" editing={false} value="Acme">
        <input aria-label="editor" />
      </DetailField>
    )
    const viewHeight = screen.getByTestId('detail-slot').style.minHeight
    rerender(
      <DetailField label="Name" editing value="Acme">
        <input aria-label="editor" />
      </DetailField>
    )
    const editHeight = screen.getByTestId('detail-slot').style.minHeight
    expect(viewHeight).toBe('28px')
    expect(editHeight).toBe('28px')
    expect(viewHeight).toBe(editHeight)
  })

  it('uses a taller slot for the multiline variant', () => {
    render(<DetailField label="Description" editing={false} value={'line1\nline2'} multiline />)
    expect(screen.getByTestId('detail-slot').style.minHeight).toBe('64px')
  })

  it('renders an info icon with a tooltip when info is provided', async () => {
    const user = userEvent.setup()
    render(<DetailField label="Start Date" editing={false} value="Jan 01, 2026" info="Captured within these dates" />)
    const icon = screen.getByTestId('InfoOutlinedIcon')
    expect(icon).toBeInTheDocument()
    await user.hover(icon)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Captured within these dates')
  })

  it('has no info icon when info is not provided', () => {
    render(<DetailField label="ID" editing={false} value="PF-1" />)
    expect(screen.queryByTestId('InfoOutlinedIcon')).toBeNull()
  })
})
