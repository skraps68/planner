import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePortfolioListState } from './usePortfolioListState'

describe('usePortfolioListState', () => {
  beforeEach(() => sessionStorage.clear())

  it('starts empty and persists changes to sessionStorage', () => {
    const { result } = renderHook(() => usePortfolioListState())
    expect(result.current.search).toBe('')
    expect(result.current.expandedPortfolios.size).toBe(0)

    act(() => {
      result.current.setSearch('crm')
      result.current.togglePortfolio('pf1')
      result.current.toggleProgram('pg1')
    })

    const saved = JSON.parse(sessionStorage.getItem('portfoliosListState')!)
    expect(saved.search).toBe('crm')
    expect(saved.portfolios).toEqual(['pf1'])
    expect(saved.programs).toEqual(['pg1'])
  })

  it('initializes from previously saved state', () => {
    sessionStorage.setItem(
      'portfoliosListState',
      JSON.stringify({ search: 'web', portfolios: ['pf9'], programs: [] })
    )
    const { result } = renderHook(() => usePortfolioListState())
    expect(result.current.search).toBe('web')
    expect(result.current.expandedPortfolios.has('pf9')).toBe(true)
  })

  it('toggle removes an already-expanded id', () => {
    const { result } = renderHook(() => usePortfolioListState())
    act(() => result.current.togglePortfolio('pf1'))
    act(() => result.current.togglePortfolio('pf1'))
    expect(result.current.expandedPortfolios.has('pf1')).toBe(false)
  })

  it('expandMany unions ids without collapsing existing ones', () => {
    const { result } = renderHook(() => usePortfolioListState())
    act(() => result.current.togglePortfolio('pf1'))
    act(() => result.current.expandMany(['pf2'], ['pg1', 'pg2']))
    expect(result.current.expandedPortfolios.has('pf1')).toBe(true)
    expect(result.current.expandedPortfolios.has('pf2')).toBe(true)
    expect(result.current.expandedPrograms.has('pg2')).toBe(true)
  })

  it('idMode defaults off, toggles, and persists', () => {
    const { result } = renderHook(() => usePortfolioListState())
    expect(result.current.idMode).toBe(false)

    act(() => result.current.toggleIdMode())
    expect(result.current.idMode).toBe(true)
    expect(JSON.parse(sessionStorage.getItem('portfoliosListState')!).idMode).toBe(true)
  })

  it('idMode restores from saved state', () => {
    sessionStorage.setItem(
      'portfoliosListState',
      JSON.stringify({ search: '', portfolios: [], programs: [], idMode: true })
    )
    const { result } = renderHook(() => usePortfolioListState())
    expect(result.current.idMode).toBe(true)
  })
})
