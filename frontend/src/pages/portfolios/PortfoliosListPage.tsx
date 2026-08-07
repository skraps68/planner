import React, { useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Paper,
  TextField,
  InputAdornment,
  Chip,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import { Add, Search, KeyboardArrowDown, KeyboardArrowRight, CloseFullscreen, Cancel } from '@mui/icons-material'
import { portfoliosApi } from '../../api/portfolios'
import { programsApi } from '../../api/programs'
import { projectsApi } from '../../api/projects'
import { Portfolio } from '../../types/portfolio'
import { Program, Project } from '../../types'
import { format } from 'date-fns'
import ScopeFilterBanner from '../../components/common/ScopeFilterBanner'
import PermissionButton from '../../components/common/PermissionButton'
import HighlightedLabel from '../../components/portfolio/HighlightedLabel'
import { usePermissions, useScopeFilter } from '../../hooks/usePermissions'
import { LIST_SCROLL_KEY, usePortfolioListState } from '../../hooks/usePortfolioListState'
import { getLastHierarchyDetail } from '../../utils/hierarchySession'
import {
  getInclusiveDateRangeStatus,
  parseDateOnly,
} from '../../utils/dateOnly'

const formatDate = (value: string) => format(parseDateOnly(value), 'MMM dd, yyyy')

const StatusChip: React.FC<{ startDate: string; endDate: string }> = ({ startDate, endDate }) => {
  const rangeStatus = getInclusiveDateRangeStatus(startDate, endDate)
  let status = 'Active'
  let color: 'success' | 'warning' | 'default' = 'success'
  if (rangeStatus === 'planned') {
    status = 'Planned'
    color = 'warning'
  } else if (rangeStatus === 'completed') {
    status = 'Completed'
    color = 'default'
  }
  return <Chip label={status} color={color} size="small" />
}

// Hover/click affordance shared by all clickable rows
const clickableRowSx = {
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': { backgroundColor: 'action.hover' },
}

const headerCellSx = {
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

// Width of the expand-arrow column; child blocks indent by this amount so a
// child's text always starts to the RIGHT of its parent's text
const ARROW_COL_WIDTH = 34

// Shared fixed widths for the trailing columns of all three tables. Every level
// uses the same grid (Name flexes to absorb the nesting indent, and all tables
// share the same right edge), so these columns line up vertically:
//   PERSON_A: Owner / Business Sponsor / Project Manager
//   PERSON_B: (blank) / Program Manager / Cost Center
//   DATE:     Start|End Date
const COL = {
  personA: 180,
  personB: 180,
  date: 132,
  status: 92,
}

// Fixed-column labels are short enough to always show in full. Give them
// narrower horizontal padding than ordinary cells and never apply the generic
// header ellipsis; the flexible name/description column yields the extra width.
const nonTruncatingHeaderCellSx = (width: number) => ({
  ...headerCellSx,
  width,
  minWidth: width,
  px: 1,
  overflow: 'visible',
  textOverflow: 'clip',
})

const personAHeaderCellSx = nonTruncatingHeaderCellSx(COL.personA)
const personBHeaderCellSx = nonTruncatingHeaderCellSx(COL.personB)
const dateHeaderCellSx = nonTruncatingHeaderCellSx(COL.date)

// Nested group containers: indented under the parent's text, tinted and framed
// with a colored left accent so it's obvious where each group begins and ends.
// No right margin — all tables end flush at the same right edge so the shared
// fixed-width columns align across nesting levels.
const programsGroupSx = {
  ml: `${ARROW_COL_WIDTH}px`,
  my: 0.75,
  border: '1px solid',
  borderColor: 'divider',
  borderRight: 0,
  borderLeftWidth: 3,
  borderLeftColor: 'primary.main',
  backgroundColor: 'rgba(40,94,130,0.035)',
  overflow: 'hidden',
}

const projectsGroupSx = {
  // Extra indent because the projects table has no arrow column of its own
  ml: `${ARROW_COL_WIDTH + 14}px`,
  my: 0.75,
  border: '1px solid',
  borderColor: 'divider',
  borderRight: 0,
  borderLeftWidth: 3,
  borderLeftColor: 'primary.light',
  backgroundColor: 'rgba(40,94,130,0.02)',
  overflow: 'hidden',
}

/**
 * Consolidated Portfolios / Programs / Projects list.
 *
 * One nested, expandable view: portfolios at the top level, programs inside a
 * portfolio, projects inside a program. Each level keeps its own columns
 * (tables within tables). Rows navigate to the detail page on click; the
 * arrow button at the start of a row is the expand/collapse control.
 * Search and expansion state persist for the session, so returning to the
 * list shows it exactly as it was left.
 */
const PortfoliosListPage: React.FC = () => {
  const navigate = useNavigate()
  const { search, setSearch, expandedPortfolios, expandedPrograms, togglePortfolio, toggleProgram, idMode, toggleIdMode } =
    usePortfolioListState()

  const displayName = (businessId: string | undefined, name: string) =>
    idMode && businessId ? `(${businessId}) ${name}` : name

  // Where the contract control returns to (recorded by the shell on every
  // detail visit).
  const lastDetail = getLastHierarchyDetail()

  // Remember scroll position when leaving the page (the window is the scroller)
  useEffect(() => {
    return () => {
      sessionStorage.setItem(LIST_SCROLL_KEY, String(window.scrollY))
    }
  }, [])

  const { canAccessProgram, canAccessProject } = usePermissions()
  const { filterPrograms, filterProjects } = useScopeFilter()

  const { data: portfoliosData, isLoading: portfoliosLoading } = useQuery({
    queryKey: ['portfolios', 'consolidated-list'],
    queryFn: () => portfoliosApi.list({ limit: 1000 }),
  })

  const { data: programsData, isLoading: programsLoading } = useQuery({
    queryKey: ['programs', 'consolidated-list'],
    queryFn: () => programsApi.list({ limit: 1000 }),
  })

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'consolidated-list'],
    queryFn: () => projectsApi.list({ limit: 1000 }),
  })

  const isLoading = portfoliosLoading || programsLoading || projectsLoading

  // Restore scroll position once the data (and restored expansion) has rendered
  const scrollRestored = useRef(false)
  useEffect(() => {
    if (isLoading || scrollRestored.current) return
    scrollRestored.current = true
    const y = Number(sessionStorage.getItem(LIST_SCROLL_KEY)) || 0
    if (y > 0) {
      requestAnimationFrame(() => window.scrollTo(0, y))
    }
  }, [isLoading])

  // Scope-filter programs/projects the same way the old list pages did
  const programs = useMemo(
    () => filterPrograms(programsData?.items || []),
    [programsData?.items, filterPrograms]
  )
  const projects = useMemo(
    () => filterProjects(projectsData?.items || []),
    [projectsData?.items, filterProjects]
  )

  // Build the visible tree, applying the search filter across all three levels.
  // A parent is visible when it matches or when any descendant matches; all
  // children of a directly-matching parent stay visible.
  const tree = useMemo(() => {
    const searchLower = search.trim().toLowerCase()
    const has = (...fields: (string | undefined | null)[]) =>
      !searchLower || fields.some((f) => f?.toLowerCase().includes(searchLower))

    const projectsByProgram = new Map<string, Project[]>()
    for (const project of projects) {
      const list = projectsByProgram.get(project.program_id) || []
      list.push(project)
      projectsByProgram.set(project.program_id, list)
    }

    const programsByPortfolio = new Map<string, Program[]>()
    for (const program of programs) {
      const key = program.portfolio_id || 'none'
      const list = programsByPortfolio.get(key) || []
      list.push(program)
      programsByPortfolio.set(key, list)
    }

    const buildPrograms = (portfolioMatches: boolean, list: Program[]) =>
      list
        .map((program) => {
          const programMatches = has(program.name, program.business_sponsor, program.program_manager, idMode ? program.business_id : null)
          const allProjects = projectsByProgram.get(program.id) || []
          const visibleProjects =
            portfolioMatches || programMatches
              ? allProjects
              : allProjects.filter((p) => has(p.name, p.project_manager, p.cost_center_code, idMode ? p.business_id : null))
          if (!portfolioMatches && !programMatches && visibleProjects.length === 0) return null
          return { program, projects: visibleProjects }
        })
        .filter((n): n is { program: Program; projects: Project[] } => n !== null)

    const portfolioNodes = (portfoliosData?.items || [])
      .map((portfolio) => {
        const portfolioMatches = has(portfolio.name, portfolio.owner, portfolio.description, idMode ? portfolio.business_id : null)
        const programNodes = buildPrograms(portfolioMatches, programsByPortfolio.get(portfolio.id) || [])
        if (!portfolioMatches && programNodes.length === 0) return null
        return { portfolio, programs: programNodes }
      })
      .filter((n): n is { portfolio: Portfolio; programs: ReturnType<typeof buildPrograms> } => n !== null)

    // Programs whose portfolio_id doesn't resolve (unassigned) — keep them reachable
    const orphanPrograms = buildPrograms(false, programsByPortfolio.get('none') || [])

    return { portfolioNodes, orphanPrograms }
  }, [portfoliosData?.items, programs, projects, search, idMode])

  // While searching, force everything visible open so matches are on screen
  const searching = search.trim() !== ''
  const isPortfolioOpen = (id: string) => searching || expandedPortfolios.has(id)
  const isProgramOpen = (id: string) => searching || expandedPrograms.has(id)

  const openProgram = (program: Program, portfolio?: Portfolio) => {
    if (!canAccessProgram(program.id).hasPermission) return
    navigate(`/programs/${program.id}`, {
      state: portfolio ? { portfolioId: portfolio.id, portfolioName: portfolio.name } : undefined,
    })
  }

  const openProject = (project: Project, program: Program, portfolio?: Portfolio) => {
    if (!canAccessProject(project.id, project.program_id).hasPermission) return
    navigate(`/projects/${project.id}`, {
      state: {
        programId: program.id,
        programName: program.name,
        portfolioId: portfolio?.id,
        portfolioName: portfolio?.name,
      },
    })
  }

  const renderProjectsTable = (
    projectList: Project[],
    program: Program,
    portfolio?: Portfolio
  ) => (
    <Box sx={projectsGroupSx}>
      {projectList.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
          No projects in this program
        </Typography>
      ) : (
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headerCellSx}>Project Name</TableCell>
              <TableCell sx={personAHeaderCellSx}>Project Manager</TableCell>
              <TableCell sx={personBHeaderCellSx}>Cost Center</TableCell>
              <TableCell sx={dateHeaderCellSx}>Start Date</TableCell>
              <TableCell sx={dateHeaderCellSx}>End Date</TableCell>
              <TableCell sx={{ ...headerCellSx, width: COL.status }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projectList.map((project) => (
              <TableRow
                key={project.id}
                hover
                onClick={() => openProject(project, program, portfolio)}
                sx={clickableRowSx}
              >
                <TableCell><HighlightedLabel label={displayName(project.business_id, project.name)} term={search} /></TableCell>
                <TableCell><HighlightedLabel label={project.project_manager} term={search} /></TableCell>
                <TableCell><HighlightedLabel label={project.cost_center_code} term={search} /></TableCell>
                <TableCell>{formatDate(project.start_date)}</TableCell>
                <TableCell>{formatDate(project.end_date)}</TableCell>
                <TableCell>
                  <StatusChip startDate={project.start_date} endDate={project.end_date} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )

  const renderProgramsTable = (
    programNodes: { program: Program; projects: Project[] }[],
    portfolio?: Portfolio
  ) => (
    <Box sx={programsGroupSx}>
      {programNodes.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
          No programs in this portfolio
        </Typography>
      ) : (
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...headerCellSx, width: ARROW_COL_WIDTH, px: 0.5 }} />
              <TableCell sx={headerCellSx}>Program Name</TableCell>
              <TableCell sx={personAHeaderCellSx}>Business Sponsor</TableCell>
              <TableCell sx={personBHeaderCellSx}>Program Manager</TableCell>
              <TableCell sx={dateHeaderCellSx}>Start Date</TableCell>
              <TableCell sx={dateHeaderCellSx}>End Date</TableCell>
              <TableCell sx={{ ...headerCellSx, width: COL.status }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {programNodes.map(({ program, projects: projectList }) => (
              <React.Fragment key={program.id}>
                <TableRow
                  hover
                  onClick={() => openProgram(program, portfolio)}
                  sx={{
                    ...clickableRowSx,
                    // Echo the projects-group accent when open so the parent reads as the group header
                    ...(isProgramOpen(program.id) && {
                      backgroundColor: 'rgba(40,94,130,0.045)',
                    }),
                  }}
                >
                  <TableCell sx={{ py: 0 }}>
                    <IconButton
                      aria-label={isProgramOpen(program.id) ? 'Collapse projects' : 'Expand projects'}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleProgram(program.id)
                      }}
                    >
                      {isProgramOpen(program.id) ? (
                        <KeyboardArrowDown fontSize="small" />
                      ) : (
                        <KeyboardArrowRight fontSize="small" />
                      )}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}><HighlightedLabel label={displayName(program.business_id, program.name)} term={search} /></TableCell>
                  <TableCell><HighlightedLabel label={program.business_sponsor} term={search} /></TableCell>
                  <TableCell><HighlightedLabel label={program.program_manager} term={search} /></TableCell>
                  <TableCell>{formatDate(program.start_date)}</TableCell>
                  <TableCell>{formatDate(program.end_date)}</TableCell>
                  <TableCell>
                    <StatusChip startDate={program.start_date} endDate={program.end_date} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                    <Collapse in={isProgramOpen(program.id)} timeout="auto" unmountOnExit>
                      {renderProjectsTable(projectList, program, portfolio)}
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )

  return (
    <Box>
      <ScopeFilterBanner />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
        <TextField
          placeholder="Search portfolios, programs, projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '0 0 40%' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
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
        />
        <Tooltip title={idMode ? 'Hide IDs' : 'Show IDs'}>
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
              fontSize: '0.9rem',
              width: 34,
              height: 34,
            }}
          >
            #
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <PermissionButton
          permission="create_portfolios"
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/portfolios/new')}
        >
          Create Portfolio
        </PermissionButton>
        <PermissionButton
          permission="create_programs"
          variant="outlined"
          startIcon={<Add />}
          onClick={() => navigate('/programs/new')}
        >
          Create Program
        </PermissionButton>
        <PermissionButton
          permission="create_projects"
          variant="outlined"
          startIcon={<Add />}
          onClick={() => navigate('/projects/new')}
        >
          Create Project
        </PermissionButton>
        <Tooltip title={lastDetail ? 'Back to tree view' : 'Select an item first'}>
          <span>
            <IconButton
              aria-label="Back to tree view"
              size="small"
              disabled={!lastDetail}
              onClick={() => lastDetail && navigate(lastDetail)}
            >
              <CloseFullscreen sx={{ fontSize: '1rem' }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <TableContainer component={Paper}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headerCellSx, width: ARROW_COL_WIDTH, px: 0.5 }} />
                <TableCell sx={headerCellSx}>Portfolio Name</TableCell>
                <TableCell sx={personAHeaderCellSx}>Owner</TableCell>
                {/* Filler keeps the shared column grid: programs/projects use this slot */}
                <TableCell sx={personBHeaderCellSx} />
                <TableCell sx={dateHeaderCellSx}>Start Date</TableCell>
                <TableCell sx={dateHeaderCellSx}>End Date</TableCell>
                <TableCell sx={{ ...headerCellSx, width: COL.status }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {tree.portfolioNodes.length === 0 && tree.orphanPrograms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      {searching ? 'No matches found' : 'No portfolios found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {tree.portfolioNodes.map(({ portfolio, programs: programNodes }) => (
                <React.Fragment key={portfolio.id}>
                  <TableRow
                    hover
                    onClick={() => navigate(`/portfolios/${portfolio.id}`)}
                    sx={{
                      ...clickableRowSx,
                      // Echo the programs-group accent when open so the parent reads as the group header
                      ...(isPortfolioOpen(portfolio.id) && {
                        backgroundColor: 'rgba(40,94,130,0.06)',
                      }),
                    }}
                  >
                    <TableCell sx={{ py: 0 }}>
                      <IconButton
                        aria-label={isPortfolioOpen(portfolio.id) ? 'Collapse programs' : 'Expand programs'}
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          togglePortfolio(portfolio.id)
                        }}
                      >
                        {isPortfolioOpen(portfolio.id) ? (
                          <KeyboardArrowDown fontSize="small" />
                        ) : (
                          <KeyboardArrowRight fontSize="small" />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ minWidth: 0, overflow: 'hidden' }}>
                      <Typography
                        component="div"
                        variant="body2"
                        noWrap
                        sx={{ fontWeight: 600 }}
                      >
                        <HighlightedLabel
                          label={displayName(portfolio.business_id, portfolio.name)}
                          term={search}
                        />
                      </Typography>
                      {portfolio.description && (
                        <Typography
                          component="div"
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          title={portfolio.description}
                        >
                          <HighlightedLabel label={portfolio.description} term={search} />
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell><HighlightedLabel label={portfolio.owner} term={search} /></TableCell>
                    <TableCell />
                    <TableCell>{formatDate(portfolio.reporting_start_date)}</TableCell>
                    <TableCell>{formatDate(portfolio.reporting_end_date)}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                      <Collapse in={isPortfolioOpen(portfolio.id)} timeout="auto" unmountOnExit>
                        {renderProgramsTable(programNodes, portfolio)}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              {tree.orphanPrograms.length > 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ pl: 2, pt: 1.5 }}>
                      Programs without a portfolio
                    </Typography>
                    {renderProgramsTable(tree.orphanPrograms)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Box>
  )
}

export default PortfoliosListPage
