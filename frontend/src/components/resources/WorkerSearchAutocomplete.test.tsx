import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../test/test-utils'
import WorkerSearchAutocomplete from './WorkerSearchAutocomplete'
import { workersApi } from '../../api/workers'

vi.mock('../../api/workers', () => ({
  workersApi: {
    list: vi.fn(),
    get: vi.fn(),
  },
}))

const mkWorker = (id: string, name: string) => ({
  id,
  external_id: `EMP-${id}`,
  name,
  worker_type_id: 'wt1',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

describe('WorkerSearchAutocomplete', () => {
  beforeEach(() => {
    vi.mocked(workersApi.list).mockReset()
    vi.mocked(workersApi.get).mockReset()
  })

  it('searches the server as the user types and reports the chosen worker id', async () => {
    vi.mocked(workersApi.list).mockResolvedValue({
      items: [mkWorker('w1', 'John Smith'), mkWorker('w2', 'Bob Johnson')],
      total: 2, page: 1, size: 100, pages: 1,
    } as any)
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<WorkerSearchAutocomplete value={null} onChange={onChange} label="Worker" />)

    await user.type(screen.getByLabelText('Worker'), 'john')

    // Debounced call fires with the search term (not a bulk load).
    await waitFor(() =>
      expect(workersApi.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'john' }))
    )
    // Options come from the server response; picking one emits its id.
    await user.click(await screen.findByText('John Smith'))
    expect(onChange).toHaveBeenCalledWith('w1')
  })

  it('does not hit the server until at least one character is typed', async () => {
    render(<WorkerSearchAutocomplete value={null} onChange={vi.fn()} label="Worker" />)
    // Give any (incorrect) debounced fetch a chance to fire.
    await new Promise((r) => setTimeout(r, 350))
    expect(workersApi.list).not.toHaveBeenCalled()
  })

  it('seeds the currently-selected worker so its name shows before searching', async () => {
    vi.mocked(workersApi.get).mockResolvedValue(mkWorker('w9', 'Alice Williams') as any)
    render(<WorkerSearchAutocomplete value="w9" onChange={vi.fn()} label="Worker" />)

    expect(workersApi.get).toHaveBeenCalledWith('w9')
    await waitFor(() =>
      expect(screen.getByLabelText('Worker')).toHaveValue('Alice Williams')
    )
    // It should not bulk-load all workers just to display the current one.
    expect(workersApi.list).not.toHaveBeenCalled()
  })
})
