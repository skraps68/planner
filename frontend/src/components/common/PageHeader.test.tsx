import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PageHeader from './PageHeader'

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Workers" />)
    expect(screen.getByText('Workers')).toBeInTheDocument()
  })
  it('renders actions when provided', () => {
    render(<PageHeader title="Workers" actions={<button>Create</button>} />)
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })
})
