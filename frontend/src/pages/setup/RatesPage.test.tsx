import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
const listMock = vi.fn()
const updateRateMock = vi.fn()
const getRateHistoryMock = vi.fn()
vi.mock('../../api/workers', () => ({ workerTypesApi: {
  list: (...a:any[]) => listMock(...a),
}}))
vi.mock('../../api/rates', () => ({ ratesApi: {
  updateRate: (...a:any[]) => updateRateMock(...a),
  getRateHistory: (...a:any[]) => getRateHistoryMock(...a),
}}))
import RatesPage from './RatesPage'

beforeEach(() => {
  listMock.mockReset()
  updateRateMock.mockReset()
  getRateHistoryMock.mockReset()
})

const threeTypes = [
  { id: 't1', type: 'Employee', description: 'd', worker_count: 3, current_rate: '50.00', version: 1 },
  { id: 't2', type: 'Contractor', description: 'd', worker_count: 1, current_rate: '75.00', version: 1 },
  { id: 't3', type: 'Intern', description: 'd', worker_count: 0, version: 1 },
]

test('renders one row per employment-class worker type with its current rate', async () => {
  listMock.mockResolvedValue(threeTypes)
  render(<RatesPage />)

  await waitFor(() => expect(screen.getByText('Employee')).toBeInTheDocument())
  expect(screen.getByText('Contractor')).toBeInTheDocument()
  expect(screen.getByText('Intern')).toBeInTheDocument()
  expect(screen.getByText('$50.00')).toBeInTheDocument()
  expect(screen.getByText('$75.00')).toBeInTheDocument()
  expect(screen.getByText('—')).toBeInTheDocument()

  expect(screen.getAllByRole('button', { name: /set rate/i })).toHaveLength(3)
})

test('setting a rate calls ratesApi.updateRate with the worker type id, amount, and date, then refreshes', async () => {
  listMock.mockResolvedValue(threeTypes)
  updateRateMock.mockResolvedValue({ id: 'rate1', worker_type_id: 't1', rate_amount: 60, start_date: '2026-07-19', version: 1, created_at: '' })
  render(<RatesPage />)

  await waitFor(() => expect(screen.getByText('Employee')).toBeInTheDocument())

  const setRateButtons = screen.getAllByRole('button', { name: /set rate/i })
  setRateButtons[0].click()

  const amountField = await screen.findByLabelText(/amount/i)
  const user = userEvent.setup()
  await user.clear(amountField)
  await user.type(amountField, '60')

  const saveButton = screen.getByRole('button', { name: /save/i })
  saveButton.click()

  await waitFor(() => expect(updateRateMock).toHaveBeenCalled())
  expect(updateRateMock).toHaveBeenCalledWith('t1', 60, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  expect(listMock).toHaveBeenCalledTimes(2)
})

test('surfaces server error message when updateRate fails', async () => {
  listMock.mockResolvedValue(threeTypes)
  updateRateMock.mockRejectedValue({ response: { data: { detail: 'Rate must be positive' } } })
  render(<RatesPage />)

  await waitFor(() => expect(screen.getByText('Employee')).toBeInTheDocument())

  const setRateButtons = screen.getAllByRole('button', { name: /set rate/i })
  setRateButtons[0].click()

  const amountField = await screen.findByLabelText(/amount/i)
  const user = userEvent.setup()
  await user.type(amountField, '60')

  const saveButton = screen.getByRole('button', { name: /save/i })
  saveButton.click()

  await waitFor(() => expect(screen.getByText('Rate must be positive')).toBeInTheDocument())
})
