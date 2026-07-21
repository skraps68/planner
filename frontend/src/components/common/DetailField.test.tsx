import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    expect(viewHeight).toBe('30px')
    expect(editHeight).toBe('30px')
    expect(viewHeight).toBe(editHeight)
  })

  it('uses a taller slot for the multiline variant', () => {
    render(<DetailField label="Description" editing={false} value={'line1\nline2'} multiline />)
    expect(screen.getByTestId('detail-slot').style.minHeight).toBe('56px')
  })
})
