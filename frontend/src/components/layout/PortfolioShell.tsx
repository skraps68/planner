import React, { useState, useEffect } from 'react'
import { Outlet, matchPath, useLocation } from 'react-router-dom'
import { Box, Button, Paper, IconButton, useMediaQuery, useTheme } from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import HierarchyTree, { HierarchyItemType } from '../portfolio/HierarchyTree'

interface DetailMatch {
  type: HierarchyItemType
  id: string
}

const TREE_COLLAPSED_KEY = 'portfolioTreeCollapsed'

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
 * Narrow (<md): master-detail swap — content with "‹ List" button, or tree alone.
 */
const PortfolioShell: React.FC = () => {
  const detail = useHierarchyDetailMatch()
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'))
  const [treeVisibleOnNarrow, setTreeVisibleOnNarrow] = useState(false)
  const [treeCollapsed, setTreeCollapsed] = useState(
    () => sessionStorage.getItem(TREE_COLLAPSED_KEY) === '1'
  )
  const setCollapsed = (collapsed: boolean) => {
    setTreeCollapsed(collapsed)
    sessionStorage.setItem(TREE_COLLAPSED_KEY, collapsed ? '1' : '0')
  }
  const location = useLocation()
  // Cross-route navigation that bypasses the tree should land on content, not a stale tree view
  useEffect(() => {
    setTreeVisibleOnNarrow(false)
  }, [location.pathname])

  if (!detail) {
    return <Outlet />
  }

  if (isNarrow) {
    // Master-detail swap: tree OR content, never side by side
    if (treeVisibleOnNarrow) {
      return (
        <HierarchyTree
          activeType={detail.type}
          activeId={detail.id}
          onNavigate={() => setTreeVisibleOnNarrow(false)}
        />
      )
    }
    return (
      <Box>
        <Button
          size="small"
          startIcon={<ChevronLeft />}
          onClick={() => setTreeVisibleOnNarrow(true)}
          sx={{ mb: 1 }}
        >
          List
        </Button>
        <Outlet />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      {treeCollapsed ? (
        <Paper
          sx={{
            width: 24,
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            py: 0.5,
          }}
        >
          <IconButton aria-label="Expand tree" size="small" onClick={() => setCollapsed(false)}>
            <ChevronRight fontSize="small" />
          </IconButton>
        </Paper>
      ) : (
        <HierarchyTree
          activeType={detail.type}
          activeId={detail.id}
          onCollapse={() => setCollapsed(true)}
        />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  )
}

export default PortfolioShell
