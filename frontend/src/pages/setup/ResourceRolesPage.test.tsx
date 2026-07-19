import { render, screen, waitFor } from '../../test/test-utils'
import { vi, test, expect, beforeEach } from 'vitest'
const listMock = vi.fn()
const createMock = vi.fn()
const updateMock = vi.fn()
const deleteMock = vi.fn()
vi.mock('../../api/resourceRoles', () => ({ resourceRolesApi: {
  list: (...a:any[]) => listMock(...a),
  create: (...a:any[]) => createMock(...a),
  update: (...a:any[]) => updateMock(...a),
  delete: (...a:any[]) => deleteMock(...a),
}}))
import ResourceRolesPage from './ResourceRolesPage'

beforeEach(() => {
  listMock.mockReset()
  createMock.mockReset()
  updateMock.mockReset()
  deleteMock.mockReset()
})

test('renders the roles table', async () => {
  listMock.mockResolvedValue([{ id: 'r1', name: 'Engineer', description: 'd', version: 1 }])
  render(<ResourceRolesPage />)
  await waitFor(() => expect(screen.getByText('Engineer')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /add role/i })).toBeTruthy()
})

test('delete is disabled for the Default role', async () => {
  listMock.mockResolvedValue([
    { id: 'r1', name: 'Default', description: 'built-in', version: 1 },
    { id: 'r2', name: 'Engineer', description: 'd', version: 1 },
  ])
  render(<ResourceRolesPage />)
  await waitFor(() => expect(screen.getByText('Default')).toBeInTheDocument())

  const defaultDeleteButton = screen.getByLabelText(/delete default/i)
  expect(defaultDeleteButton).toBeDisabled()

  const engineerDeleteButton = screen.getByLabelText(/delete engineer/i)
  expect(engineerDeleteButton).not.toBeDisabled()
})

test('surfaces server error message when delete fails', async () => {
  listMock.mockResolvedValue([{ id: 'r2', name: 'Engineer', description: 'd', version: 1 }])
  deleteMock.mockRejectedValue({ response: { data: { detail: 'Role is in use' } } })
  window.confirm = vi.fn(() => true)

  render(<ResourceRolesPage />)
  await waitFor(() => expect(screen.getByText('Engineer')).toBeInTheDocument())

  screen.getByLabelText(/delete engineer/i).click()

  await waitFor(() => expect(screen.getByText('Role is in use')).toBeInTheDocument())
})
