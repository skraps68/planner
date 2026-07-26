import React, { useState, useEffect, useRef } from 'react'
import { Outlet, matchPath, useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Paper, IconButton, Tooltip, useMediaQuery, useTheme } from '@mui/material'
import { ChevronLeft, ChevronRight, OpenInFull } from '@mui/icons-material'
import HierarchyTree, { HierarchyItemType } from '../portfolio/HierarchyTree'
import { saveLastHierarchyDetail } from '../../utils/hierarchySession'
import { useUserSettings } from '../../contexts/UserSettingsContext'

interface DetailMatch {
  type: HierarchyItemType
  id: string
}

const TREE_COLLAPSED_KEY = 'portfolioTreeCollapsed'
const DEFAULT_TREE_WIDTH = 240
const MIN_TREE_WIDTH = 200
const MAX_TREE_WIDTH = 520
const MIN_CONTENT_WIDTH = 360
const KEYBOARD_RESIZE_STEP = 8

const getMaximumTreeWidth = () =>
  Math.max(
    MIN_TREE_WIDTH,
    Math.min(MAX_TREE_WIDTH, window.innerWidth - MIN_CONTENT_WIDTH),
  )

const clampTreeWidth = (width: number) =>
  Math.min(getMaximumTreeWidth(), Math.max(MIN_TREE_WIDTH, Math.round(width)))

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
  const { settings, isServerBacked, updateSettings } = useUserSettings()
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'))
  const [treeVisibleOnNarrow, setTreeVisibleOnNarrow] = useState(false)
  const [treeCollapsed, setTreeCollapsed] = useState(
    () => isServerBacked
      ? settings.navigation?.hierarchyPane?.collapsed ?? false
      : sessionStorage.getItem(TREE_COLLAPSED_KEY) === '1'
  )
  const [treeWidth, setTreeWidth] = useState<number | undefined>(
    () => {
      if (settings.navigation?.hierarchyPane?.width !== undefined) {
        return settings.navigation.hierarchyPane.width
      }
      const savedWidth = Number(sessionStorage.getItem('portfolioTreeWidth'))
      return !isServerBacked && Number.isFinite(savedWidth) && savedWidth > 0
        ? clampTreeWidth(savedWidth)
        : undefined
    },
  )
  const [isResizingTree, setIsResizingTree] = useState(false)
  const treePaneRef = useRef<HTMLDivElement | null>(null)
  const resizeStateRef = useRef<{
    pointerId: number
    startX: number
    startWidth: number
    currentWidth: number
  } | null>(null)
  const setCollapsed = (collapsed: boolean) => {
    setTreeCollapsed(collapsed)
    sessionStorage.setItem(TREE_COLLAPSED_KEY, collapsed ? '1' : '0')
    updateSettings({ navigation: { hierarchyPane: { collapsed } } })
  }
  const location = useLocation()
  const navigate = useNavigate()
  // Cross-route navigation that bypasses the tree should land on content, not a stale tree view
  useEffect(() => {
    setTreeVisibleOnNarrow(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isServerBacked) return
    setTreeCollapsed(settings.navigation?.hierarchyPane?.collapsed ?? false)
    setTreeWidth(settings.navigation?.hierarchyPane?.width)
  }, [
    isServerBacked,
    settings.navigation?.hierarchyPane?.collapsed,
    settings.navigation?.hierarchyPane?.width,
  ])

  useEffect(() => {
    if (!isResizingTree) return
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [isResizingTree])

  // Remember the last detail visited (incl. ?tab=) so the expanded view's
  // contract control can bring it back
  useEffect(() => {
    if (detail) {
      saveLastHierarchyDetail(location.pathname + location.search)
    }
  }, [detail, location.pathname, location.search])

  const expandToFullList = () => navigate('/portfolios')

  const currentTreeWidth = () => {
    if (treeWidth !== undefined) return treeWidth
    const measuredWidth = treePaneRef.current?.getBoundingClientRect().width ?? 0
    return measuredWidth > 0 ? measuredWidth : DEFAULT_TREE_WIDTH
  }

  const saveTreeWidth = (width: number) => {
    const nextWidth = clampTreeWidth(width)
    setTreeWidth(nextWidth)
    sessionStorage.setItem('portfolioTreeWidth', String(nextWidth))
    updateSettings({ navigation: { hierarchyPane: { width: nextWidth } } })
    return nextWidth
  }

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startWidth = currentTreeWidth()
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth,
      currentWidth: startWidth,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setIsResizingTree(true)
  }

  const handleResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resizeState = resizeStateRef.current
    if (!resizeState || resizeState.pointerId !== event.pointerId) return
    event.preventDefault()
    const nextWidth = clampTreeWidth(
      resizeState.startWidth + event.clientX - resizeState.startX,
    )
    resizeState.currentWidth = nextWidth
    setTreeWidth(nextWidth)
  }

  const finishResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const resizeState = resizeStateRef.current
    if (!resizeState || resizeState.pointerId !== event.pointerId) return
    saveTreeWidth(resizeState.currentWidth)
    resizeStateRef.current = null
    setIsResizingTree(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextWidth: number | undefined
    if (event.key === 'ArrowLeft') {
      nextWidth = currentTreeWidth() - KEYBOARD_RESIZE_STEP
    } else if (event.key === 'ArrowRight') {
      nextWidth = currentTreeWidth() + KEYBOARD_RESIZE_STEP
    } else if (event.key === 'Home') {
      nextWidth = MIN_TREE_WIDTH
    } else if (event.key === 'End') {
      nextWidth = getMaximumTreeWidth()
    }
    if (nextWidth === undefined) return
    event.preventDefault()
    saveTreeWidth(nextWidth)
  }

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
    <Box sx={{ display: 'flex', gap: treeCollapsed ? 1.5 : 0, alignItems: 'flex-start' }}>
      {treeCollapsed ? (
        <Paper
          sx={{
            width: 24,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            py: 0.5,
          }}
        >
          <IconButton aria-label="Expand tree" size="small" onClick={() => setCollapsed(false)}>
            <ChevronRight fontSize="small" />
          </IconButton>
          <Tooltip title="Expand to full list view" placement="right">
            <IconButton aria-label="Expand to full list view" size="small" onClick={expandToFullList}>
              <OpenInFull sx={{ fontSize: '0.9rem' }} />
            </IconButton>
          </Tooltip>
        </Paper>
      ) : (
        <>
          <Box ref={treePaneRef} sx={{ flexShrink: 0 }}>
            <HierarchyTree
              activeType={detail.type}
              activeId={detail.id}
              width={treeWidth}
              onCollapse={() => setCollapsed(true)}
              onExpandFull={expandToFullList}
            />
          </Box>
          <Box
            role="separator"
            aria-label="Resize hierarchy navigation"
            aria-orientation="vertical"
            aria-valuemin={MIN_TREE_WIDTH}
            aria-valuemax={getMaximumTreeWidth()}
            aria-valuenow={treeWidth ?? DEFAULT_TREE_WIDTH}
            tabIndex={0}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
            onKeyDown={handleResizeKeyDown}
            sx={{
              position: 'relative',
              alignSelf: 'stretch',
              width: 12,
              minHeight: 'calc(100vh - 96px)',
              flexShrink: 0,
              cursor: 'col-resize',
              touchAction: 'none',
              outline: 'none',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '50%',
                width: isResizingTree ? 2 : 1,
                transform: 'translateX(-50%)',
                backgroundColor: isResizingTree ? 'primary.main' : 'background.default',
              },
              '&:hover::before, &:focus-visible::before': {
                width: 2,
                backgroundColor: 'primary.main',
              },
            }}
          />
        </>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  )
}

export default PortfolioShell
