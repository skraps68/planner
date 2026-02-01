import React from 'react'
import { Box, Autocomplete, TextField, CircularProgress, Grid } from '@mui/material'
import { Program, Project, ProjectPhase } from '../../types'

interface FilterSectionProps {
  programs: Program[]
  projects: Project[]
  phases: ProjectPhase[]
  selectedProgramId: string | null
  selectedProjectId: string | null
  selectedPhaseId: string | null
  onProgramChange: (programId: string | null) => void
  onProjectChange: (projectId: string | null) => void
  onPhaseChange: (phaseId: string | null) => void
  programsLoading: boolean
  projectsLoading: boolean
  phasesLoading: boolean
  backButton?: React.ReactNode
}

const FilterSection: React.FC<FilterSectionProps> = ({
  programs,
  projects,
  phases,
  selectedProgramId,
  selectedProjectId,
  selectedPhaseId,
  onProgramChange,
  onProjectChange,
  onPhaseChange,
  programsLoading,
  projectsLoading,
  phasesLoading,
  backButton
}) => {
  // Find selected items for Autocomplete value
  const selectedProgram = programs.find(p => p.id === selectedProgramId) || null
  const selectedProject = projects.find(p => p.id === selectedProjectId) || null
  const selectedPhase = phases.find(p => p.id === selectedPhaseId) || null

  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={2} alignItems="center" wrap="nowrap">
        {backButton && (
          <Grid item sx={{ flexShrink: 0 }}>
            {backButton}
          </Grid>
        )}
        <Grid item sx={{ flexGrow: 1, minWidth: 0 }}>
          <Autocomplete
            options={programs}
            getOptionLabel={(option) => option.name}
            value={selectedProgram}
            onChange={(_, newValue) => {
              onProgramChange(newValue?.id || null)
            }}
            loading={programsLoading}
            disabled={programsLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Program"
                placeholder="All"
                InputProps={{
                  ...params.InputProps,
                  sx: {
                    '& input': {
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    },
                  },
                  endAdornment: (
                    <>
                      {programsLoading ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>

        <Grid item sx={{ flexGrow: 1, minWidth: 0 }}>
          <Autocomplete
            options={projects}
            getOptionLabel={(option) => option.name}
            value={selectedProject}
            onChange={(_, newValue) => {
              onProjectChange(newValue?.id || null)
            }}
            loading={projectsLoading}
            disabled={!selectedProgramId || projectsLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Project"
                placeholder="All"
                InputProps={{
                  ...params.InputProps,
                  sx: {
                    '& input': {
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    },
                  },
                  endAdornment: (
                    <>
                      {projectsLoading ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>

        <Grid item sx={{ flexGrow: 1, minWidth: 0 }}>
          <Autocomplete
            options={phases}
            getOptionLabel={(option) => option.name}
            value={selectedPhase}
            onChange={(_, newValue) => {
              onPhaseChange(newValue?.id || null)
            }}
            loading={phasesLoading}
            disabled={!selectedProjectId || phasesLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Phase"
                placeholder="All"
                InputProps={{
                  ...params.InputProps,
                  sx: {
                    '& input': {
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    },
                  },
                  endAdornment: (
                    <>
                      {phasesLoading ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  )
}

export default FilterSection
