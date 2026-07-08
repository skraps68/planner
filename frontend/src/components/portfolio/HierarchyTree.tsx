import React, { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, IconButton, Paper, Typography } from '@mui/material'
import { KeyboardArrowDown, KeyboardArrowRight } from '@mui/icons-material'
import { portfoliosApi } from '../../api/portfolios'
import { programsApi } from '../../api/programs'
import { projectsApi } from '../../api/projects'
import { Program, Project } from '../../types'
import { useScopeFilter } from '../../hooks/usePermissions'
import { usePortfolioListState } from '../../hooks/usePortfolioListState'

export type HierarchyItemType = 'portfolio' | 'program' | 'project'

interface HierarchyTreeProps {
  activeType: HierarchyItemType
  activeId: string
  onNavigate?: () => void
}

/**
 * Slim (State 2) hierarchy: a headerless folder tree. Level is conveyed by
 * indentation + expand/collapse arrows only (no per-level headers or icons).
 * Clicking a name navigates to that item's detail; the arrow is the only
 * expand/collapse control. Ancestors of the active item auto-expand.
 */
const HierarchyTree: React.FC<HierarchyTreeProps> = ({ activeType, activeId, onNavigate }) => {
  const navigate = useNavigate()
  const { filterPrograms, filterProjects } = useScopeFilter()
  const { expandedPortfolios, expandedPrograms, togglePortfolio, toggleProgram, expandMany } =
    usePortfolioListState()
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

  const row = (
    depth: number,
    isActive: boolean,
    arrow: React.ReactNode,
    label: string,
    onClick: () => void,
    key: string
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
        backgroundColor: isActive ? 'primary.main' : 'transparent',
        color: isActive ? 'primary.contrastText' : 'text.primary',
        '&:hover': { backgroundColor: isActive ? 'primary.main' : 'action.hover' },
      }}
    >
      {arrow}
      <Typography variant="body2" noWrap title={label} sx={{ fontSize: '0.78rem' }}>
        {label}
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
        width: 240,
        flexShrink: 0,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 96px)',
        py: 0.5,
        pr: 0.5,
      }}
    >
      {portfolios.map((portfolio) => {
        const pfOpen = expandedPortfolios.has(portfolio.id)
        const children = programsByPortfolio.get(portfolio.id) || []
        return (
          <React.Fragment key={portfolio.id}>
            {row(
              0,
              activeType === 'portfolio' && activeId === portfolio.id,
              arrowButton(pfOpen, portfolio.name, () => togglePortfolio(portfolio.id)),
              portfolio.name,
              () => go(`/portfolios/${portfolio.id}`),
              `pf-${portfolio.id}`
            )}
            {pfOpen &&
              children.map((program) => {
                const pgOpen = expandedPrograms.has(program.id)
                const projectChildren = projectsByProgram.get(program.id) || []
                return (
                  <React.Fragment key={program.id}>
                    {row(
                      1,
                      activeType === 'program' && activeId === program.id,
                      arrowButton(pgOpen, program.name, () => toggleProgram(program.id)),
                      program.name,
                      () =>
                        go(`/programs/${program.id}`, {
                          portfolioId: portfolio.id,
                          portfolioName: portfolio.name,
                        }),
                      `pg-${program.id}`
                    )}
                    {pgOpen &&
                      projectChildren.map((project) =>
                        row(
                          2,
                          activeType === 'project' && activeId === project.id,
                          leafSpacer,
                          project.name,
                          () =>
                            go(`/projects/${project.id}`, {
                              programId: program.id,
                              programName: program.name,
                              portfolioId: portfolio.id,
                              portfolioName: portfolio.name,
                            }),
                          `pj-${project.id}`
                        )
                      )}
                  </React.Fragment>
                )
              })}
          </React.Fragment>
        )
      })}
    </Paper>
  )
}

export default HierarchyTree
