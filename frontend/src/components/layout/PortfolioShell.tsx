import React from 'react'
import { Outlet, matchPath, useLocation } from 'react-router-dom'
import { Box } from '@mui/material'
import HierarchyTree, { HierarchyItemType } from '../portfolio/HierarchyTree'

interface DetailMatch {
  type: HierarchyItemType
  id: string
}

const DETAIL_PATTERNS: Array<{ pattern: string; type: HierarchyItemType }> = [
  { pattern: '/portfolios/:id', type: 'portfolio' },
  { pattern: '/programs/:id', type: 'program' },
  { pattern: '/projects/:id', type: 'project' },
]

const useHierarchyDetailMatch = (): DetailMatch | null => {
  const location = useLocation()
  for (const { pattern, type } of DETAIL_PATTERNS) {
    const match = matchPath({ path: pattern, end: true }, location.pathname)
    if (match?.params.id) return { type, id: match.params.id }
  }
  return null
}

/**
 * Persistent Portfolios workspace shell (layout route).
 * State 1 (/portfolios): outlet full-width — the rich all-columns table.
 * State 2 (a hierarchy detail route): slim folder tree | detail content.
 */
const PortfolioShell: React.FC = () => {
  const detail = useHierarchyDetailMatch()

  if (!detail) {
    return <Outlet />
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <HierarchyTree activeType={detail.type} activeId={detail.id} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  )
}

export default PortfolioShell
