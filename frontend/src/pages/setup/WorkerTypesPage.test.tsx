import { render, screen, waitFor } from '../../test/test-utils'
import { vi, test, expect, beforeEach } from 'vitest'
const listMock = vi.fn()
const createMock = vi.fn()
const updateMock = vi.fn()
const deleteMock = vi.fn()
vi.mock('../../api/workers', () => ({ workerTypesApi: {
  list: (...a:any[]) => listMock(...a),
  create: (...a:any[]) => createMock(...a),
  update: (...a:any[]) => updateMock(...a),
  delete: (...a:any[]) => deleteMock(...a),
}}))
import WorkerTypesPage from './WorkerTypesPage'

beforeEach(() => {
  listMock.mockReset()
  createMock.mockReset()
  updateMock.mockReset()
  deleteMock.mockReset()
})

test('renders the worker types table', async () => {
  listMock.mockResolvedValue([
    { id: 't1', type: 'Employee', description: 'd', worker_count: 3, current_rate: '50.00', version: 1 },
  ])
  render(<WorkerTypesPage />)
  await waitFor(() => expect(screen.getByText('Employee')).toBeInTheDocument())
  expect(screen.getByText('3')).toBeInTheDocument()
  expect(screen.getByText('$50.00')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /add worker type/i })).toBeTruthy()
})

test('shows a dash when current rate is absent', async () => {
  listMock.mockResolvedValue([
    { id: 't1', type: 'Contractor', description: 'd', worker_count: 0, version: 1 },
  ])
  render(<WorkerTypesPage />)
  await waitFor(() => expect(screen.getByText('Contractor')).toBeInTheDocument())
  expect(screen.getByText('—')).toBeInTheDocument()
})

test('surfaces server error message when delete fails', async () => {
  listMock.mockResolvedValue([{ id: 't2', type: 'Employee', description: 'd', worker_count: 0, version: 1 }])
  deleteMock.mockRejectedValue({ response: { data: { detail: 'Worker type has workers assigned' } } })
  window.confirm = vi.fn(() => true)

  render(<WorkerTypesPage />)
  await waitFor(() => expect(screen.getByText('Employee')).toBeInTheDocument())

  screen.getByLabelText(/delete employee/i).click()

  await waitFor(() => expect(screen.getByText('Worker type has workers assigned')).toBeInTheDocument())
})

test('save is disabled until both type and description are filled', async () => {
  listMock.mockResolvedValue([])
  render(<WorkerTypesPage />)
  await waitFor(() => expect(listMock).toHaveBeenCalled())

  screen.getByRole('button', { name: /add worker type/i }).click()
  const saveButton = await screen.findByRole('button', { name: /save/i })
  expect(saveButton).toBeDisabled()
})
