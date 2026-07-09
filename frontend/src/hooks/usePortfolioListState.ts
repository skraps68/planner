import { useState, useEffect, useRef, useCallback } from 'react'

// Session-scoped persistence so the hierarchy looks the same when the user
// returns from a detail page (browser back button, home link, or ✕ close).
// Shared by the rich table (State 1) and the slim tree (State 2).
const LIST_STATE_KEY = 'portfoliosListState'

interface SavedListState {
  search: string
  portfolios: string[]
  programs: string[]
  idMode: boolean
}

const loadSavedListState = (): SavedListState => {
  try {
    const raw = sessionStorage.getItem(LIST_STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        search: typeof parsed.search === 'string' ? parsed.search : '',
        portfolios: Array.isArray(parsed.portfolios) ? parsed.portfolios : [],
        programs: Array.isArray(parsed.programs) ? parsed.programs : [],
        idMode: parsed.idMode === true,
      }
    }
  } catch {
    // Corrupted saved state — start fresh
  }
  return { search: '', portfolios: [], programs: [], idMode: false }
}

const toggled = (set: Set<string>, id: string): Set<string> => {
  const next = new Set(set)
  next.has(id) ? next.delete(id) : next.add(id)
  return next
}

export interface PortfolioListState {
  search: string
  setSearch: (s: string) => void
  expandedPortfolios: Set<string>
  expandedPrograms: Set<string>
  togglePortfolio: (id: string) => void
  toggleProgram: (id: string) => void
  /** Union-in ids (used by the tree to auto-expand ancestors of the active item) */
  expandMany: (portfolioIds: string[], programIds: string[]) => void
  idMode: boolean
  toggleIdMode: () => void
}

export function usePortfolioListState(): PortfolioListState {
  const saved = useRef(loadSavedListState()).current
  const [search, setSearch] = useState(saved.search)
  const [expandedPortfolios, setExpandedPortfolios] = useState<Set<string>>(
    new Set(saved.portfolios)
  )
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(
    new Set(saved.programs)
  )
  const [idMode, setIdMode] = useState(saved.idMode)

  useEffect(() => {
    sessionStorage.setItem(
      LIST_STATE_KEY,
      JSON.stringify({
        search,
        portfolios: [...expandedPortfolios],
        programs: [...expandedPrograms],
        idMode,
      })
    )
  }, [search, expandedPortfolios, expandedPrograms, idMode])

  const togglePortfolio = useCallback(
    (id: string) => setExpandedPortfolios((prev) => toggled(prev, id)),
    []
  )
  const toggleProgram = useCallback(
    (id: string) => setExpandedPrograms((prev) => toggled(prev, id)),
    []
  )
  const expandMany = useCallback((portfolioIds: string[], programIds: string[]) => {
    if (portfolioIds.length) setExpandedPortfolios((prev) => new Set([...prev, ...portfolioIds]))
    if (programIds.length) setExpandedPrograms((prev) => new Set([...prev, ...programIds]))
  }, [])
  const toggleIdMode = useCallback(() => setIdMode((v) => !v), [])

  return {
    search,
    setSearch,
    expandedPortfolios,
    expandedPrograms,
    togglePortfolio,
    toggleProgram,
    expandMany,
    idMode,
    toggleIdMode,
  }
}
