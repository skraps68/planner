import React, { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, IconButton, InputAdornment, Paper, TextField, Tooltip, Typography } from '@mui/material'
import { Cancel, ChevronLeft, KeyboardArrowDown, KeyboardArrowRight, OpenInFull } from '@mui/icons-material'
import { portfoliosApi } from '../../api/portfolios'
import { programsApi } from '../../api/programs'
import { projectsApi } from '../../api/projects'
import { Program, Project } from '../../types'
import { useScopeFilter } from '../../hooks/usePermissions'
import { usePortfolioListState } from '../../hooks/usePortfolioListState'
import HighlightedLabel from './HighlightedLabel'

export type HierarchyItemType = 'portfolio' | 'program' | 'project'

// Per-level row shading (blue-grey family matching the table header color):
// portfolio rows strongest, program rows lighter, project rows unshaded
const DEPTH_BG = ['#C9D9E8', '#F1F6FA', 'transparent']

interface HierarchyTreeProps {
  activeType: HierarchyItemType
  activeId: string
  onNavigate?: () => void
  onCollapse?: () => void
  /** Toggle out to the expanded (rich all-columns) hierarchy view */
  onExpandFull?: () => void
}

const labelFor = (idMode: boolean, businessId: string, name: string) =>
  idMode ? `(${businessId}) ${name}` : name

/**
 * Slim (State 2) hierarchy: a folder tree with header row. Level is conveyed by
 * indentation + expand/collapse arrows only (no per-level headers or icons).
 * Clicking a name navigates to that item's detail; the arrow is the only
 * expand/collapse control. Ancestors of the active item auto-expand.
 */
const HierarchyTree: React.FC<HierarchyTreeProps> = ({
  activeType,
  activeId,
  onNavigate,
  onCollapse,
  onExpandFull,
}) => {
  const navigate = useNavigate()
  const { filterPrograms, filterProjects } = useScopeFilter()
  const {
    search,
    setSearch,
    idMode,
    toggleIdMode,
    expandedPortfolios,
    expandedPrograms,
    togglePortfolio,
    toggleProgram,
    expandMany,
  } = usePortfolioListState()
  const activeRowRef = useRef<HTMLDivElement | null>(null)

  const { data: portfoliosData } = useQuery({
    queryKey: ['portfolios', 'consolidated-list'],
    queryFn: () => portfoliosApi.list({ limit: 1000 }),
  })
  const { data: programsData } = useQuery({
    queryKey: ['programs', 'consolidated-list'],
    queryFn: () => programsApi.list({ limit: 1000 }),
  })
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'consolidated-list'],
    queryFn: () => projectsApi.list({ limit: 1000 }),
  })

  const portfolios = portfoliosData?.items || []
  const programs = useMemo(
    () => filterPrograms(programsData?.items || []),
    [programsData?.items, filterPrograms]
  )
  const projects = useMemo(
    () => filterProjects(projectsData?.items || []),
    [projectsData?.items, filterProjects]
  )

  const programsByPortfolio = useMemo(() => {
    const map = new Map<string, Program[]>()
    for (const program of programs) {
      const key = program.portfolio_id || 'none'
      map.set(key, [...(map.get(key) || []), program])
    }
    return map
  }, [programs])

  const projectsByProgram = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const project of projects) {
      map.set(project.program_id, [...(map.get(project.program_id) || []), project])
    }
    return map
  }, [projects])

  // Auto-expand the active item's ancestors (project -> program -> portfolio)
  useEffect(() => {
    if (!activeId || programs.length === 0) return
    const portfolioIds: string[] = []
    const programIds: string[] = []
    if (activeType === 'project') {
      const project = projects.find((p) => p.id === activeId)
      const program = project && programs.find((g) => g.id === project.program_id)
      if (program) {
        programIds.push(program.id)
        if (program.portfolio_id) portfolioIds.push(program.portfolio_id)
      }
    } else if (activeType === 'program') {
      const program = programs.find((g) => g.id === activeId)
      if (program?.portfolio_id) portfolioIds.push(program.portfolio_id)
    }
    if (portfolioIds.length || programIds.length) expandMany(portfolioIds, programIds)
  }, [activeType, activeId, programs, projects, expandMany])

  // Keep the active row visible within the tree pane
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeId, activeType])

  const go = (path: string, state?: object) => {
    navigate(path, state ? { state } : undefined)
    onNavigate?.()
  }

  // Filter model: compute which nodes are visible and which are dimmed
  const term = search.trim().toLowerCase()
  const searching = term !== ''

  const matches = (businessId: string, name: string) =>
    labelFor(idMode, businessId, name).toLowerCase().includes(term)

  // visibility: self-match OR descendant-match; matching parents show all children
  // Dimming rule: a node is dimmed only when shown because of a DESCENDANT match
  // (ancestor-context). Children force-shown under a matching ancestor are NOT dimmed.
  const visible = useMemo(() => {
    if (!searching) return null // null = show everything, no dimming
    const dimmed = new Set<string>()
    const show = new Set<string>()

    for (const portfolio of portfolios) {
      const pfMatch = matches(portfolio.business_id ?? '', portfolio.name)
      let pfHasDescendant = false

      for (const program of programsByPortfolio.get(portfolio.id) || []) {
        const pgMatch = matches(program.business_id ?? '', program.name)
        let pgHasDescendant = false

        for (const project of projectsByProgram.get(program.id) || []) {
          const pjMatch = matches(project.business_id ?? '', project.name)
          // Show a project if: it matches, its program matches, or its portfolio matches
          if (pfMatch || pgMatch || pjMatch) {
            show.add(`pj-${project.id}`)
            // Projects are leaf nodes — they can never be shown "because of a descendant".
            // They are never dimmed (either they self-match or are shown under a matching ancestor).
            if (pjMatch) pgHasDescendant = true
          }
        }

        if (pfMatch || pgMatch || pgHasDescendant) {
          show.add(`pg-${program.id}`)
          // Dim a program only if it's shown solely because of a descendant match
          // (not self-match, not force-shown under a matching ancestor)
          if (!pgMatch && !pfMatch && pgHasDescendant) {
            dimmed.add(`pg-${program.id}`)
          }
          if (pgMatch || pgHasDescendant) pfHasDescendant = true
        }
      }

      if (pfMatch || pfHasDescendant) {
        show.add(`pf-${portfolio.id}`)
        // Dim a portfolio only if it's shown solely because of a descendant match
        if (!pfMatch && pfHasDescendant) {
          dimmed.add(`pf-${portfolio.id}`)
        }
      }
    }

    return { show, dimmed }
  }, [searching, term, idMode, portfolios, programsByPortfolio, projectsByProgram])

  // While searching, all nodes with descendants in view are force-expanded
  // without writing to the persisted expansion sets
  const effectiveOpen = (kind: 'pf' | 'pg', id: string) =>
    searching ? true : kind === 'pf' ? expandedPortfolios.has(id) : expandedPrograms.has(id)

  const row = (
    depth: number,
    isActive: boolean,
    arrow: React.ReactNode,
    title: string,
    labelNode: React.ReactNode,
    onClick: () => void,
    key: string,
    dimColor?: boolean
  ) => (
    <Box
      key={key}
      ref={isActive ? activeRowRef : undefined}
      data-active={isActive ? 'true' : undefined}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        pl: 0.5 + depth * 1.75,
        pr: 0.5,
        py: 0.25,
        cursor: 'pointer',
        borderRadius: 1,
        // Level shading: portfolios strongest, programs lighter, projects none
        backgroundColor: DEPTH_BG[depth] || 'transparent',
        color: 'text.primary',
        // Selected row: thick inset outline (no layout shift) instead of a fill
        boxShadow: isActive
          ? (theme) => `inset 0 0 0 2px ${theme.palette.primary.main}`
          : 'none',
        '&:hover': { backgroundColor: 'action.hover' },
      }}
    >
      {arrow}
      <Typography
        variant="body2"
        noWrap
        title={title}
        // Portfolio and program names bold; project names regular
        sx={{
          fontSize: '0.78rem',
          fontWeight: depth < 2 ? 600 : 400,
          color: dimColor && !isActive ? 'text.disabled' : undefined,
        }}
      >
        {labelNode}
      </Typography>
    </Box>
  )

  const arrowButton = (open: boolean, label: string, onToggle: () => void) => (
    <IconButton
      aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
      size="small"
      sx={{ p: 0.25, mr: 0.25, color: 'inherit' }}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {open ? <KeyboardArrowDown fontSize="inherit" /> : <KeyboardArrowRight fontSize="inherit" />}
    </IconButton>
  )

  // 22px spacer keeps leaf names aligned with expandable siblings' names
  const leafSpacer = <Box sx={{ width: 22, flexShrink: 0 }} />

  return (
    <Paper
      sx={{
        width: idMode ? 280 : 240,
        flexShrink: 0,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 96px)',
        py: 0.5,
        pr: 0.5,
      }}
    >
      {/* Controls row above the filter so the filter can use the full width */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, px: 0.5, pb: 0.5 }}>
        <IconButton
          aria-label="Toggle ID mode"
          aria-pressed={idMode}
          size="small"
          onClick={toggleIdMode}
          sx={{
            border: '1px solid',
            borderColor: idMode ? 'primary.main' : 'divider',
            borderRadius: 1,
            color: idMode ? 'primary.main' : 'text.secondary',
            fontSize: '0.8rem',
            width: 26,
            height: 26,
          }}
        >
          #
        </IconButton>
        {onExpandFull && (
          <Tooltip title="Expand to full list view">
            <IconButton aria-label="Expand to full list view" size="small" onClick={onExpandFull}>
              <OpenInFull sx={{ fontSize: '0.85rem' }} />
            </IconButton>
          </Tooltip>
        )}
        {onCollapse && (
          <IconButton aria-label="Collapse tree" size="small" onClick={onCollapse}>
            <ChevronLeft fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Box sx={{ px: 0.5, pb: 0.5 }}>
        <TextField
          size="small"
          placeholder="Filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          InputProps={{
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear filter"
                  size="small"
                  edge="end"
                  onClick={() => setSearch('')}
                  sx={{ p: 0.25 }}
                >
                  {/* Filled circle-x reads as "x inside a light circle" */}
                  <Cancel sx={{ fontSize: '1rem', color: 'grey.400' }} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.78rem', py: 0.5 } }}
        />
      </Box>
      {searching && visible?.show.size === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.5 }}>
          No matches
        </Typography>
      ) : (
        portfolios.map((portfolio) => {
          const pfKey = `pf-${portfolio.id}`
          if (searching && !visible?.show.has(pfKey)) return null
          const pfOpen = effectiveOpen('pf', portfolio.id)
          const children = programsByPortfolio.get(portfolio.id) || []
          const pfBid = portfolio.business_id ?? ''
          return (
            <React.Fragment key={portfolio.id}>
              {row(
                0,
                activeType === 'portfolio' && activeId === portfolio.id,
                arrowButton(pfOpen, portfolio.name, () => togglePortfolio(portfolio.id)),
                labelFor(idMode, pfBid, portfolio.name),
                <HighlightedLabel label={labelFor(idMode, pfBid, portfolio.name)} term={search} />,
                () => go(`/portfolios/${portfolio.id}`),
                pfKey,
                visible?.dimmed.has(pfKey)
              )}
              {pfOpen &&
                children.map((program) => {
                  const pgKey = `pg-${program.id}`
                  if (searching && !visible?.show.has(pgKey)) return null
                  const pgOpen = effectiveOpen('pg', program.id)
                  const projectChildren = projectsByProgram.get(program.id) || []
                  const pgBid = program.business_id ?? ''
                  return (
                    <React.Fragment key={program.id}>
                      {row(
                        1,
                        activeType === 'program' && activeId === program.id,
                        arrowButton(pgOpen, program.name, () => toggleProgram(program.id)),
                        labelFor(idMode, pgBid, program.name),
                        <HighlightedLabel label={labelFor(idMode, pgBid, program.name)} term={search} />,
                        () =>
                          go(`/programs/${program.id}`, {
                            portfolioId: portfolio.id,
                            portfolioName: portfolio.name,
                          }),
                        pgKey,
                        visible?.dimmed.has(pgKey)
                      )}
                      {pgOpen &&
                        projectChildren.map((project) => {
                          const pjKey = `pj-${project.id}`
                          if (searching && !visible?.show.has(pjKey)) return null
                          const pjBid = project.business_id ?? ''
                          return row(
                            2,
                            activeType === 'project' && activeId === project.id,
                            leafSpacer,
                            labelFor(idMode, pjBid, project.name),
                            <HighlightedLabel label={labelFor(idMode, pjBid, project.name)} term={search} />,
                            () =>
                              go(`/projects/${project.id}`, {
                                programId: program.id,
                                programName: program.name,
                                portfolioId: portfolio.id,
                                portfolioName: portfolio.name,
                              }),
                            pjKey,
                            visible?.dimmed.has(pjKey)
                          )
                        })}
                    </React.Fragment>
                  )
                })}
            </React.Fragment>
          )
        })
      )}
    </Paper>
  )
}

export default HierarchyTree
