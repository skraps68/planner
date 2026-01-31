import React from 'react'
import { Box, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, CircularProgress, Grid } from '@mui/material'
import { Program, Project } from '../../types'

interface FilterSectionProps {
  programs: Program[]
  projects: Project[]
  selectedProgramId: string | null
  selectedProjectId: string | null
  onProgramChange: (programId: string | null) => void
  onProjectChange: (projectId: string | null) => void
  programsLoading: boolean
  projectsLoading: boolean
}

const FilterSection: React.FC<FilterSectionProps> = ({
  programs,
  projects,
  selectedProgramId,
  selectedProjectId,
  onProgramChange,
  onProjectChange,
  programsLoading,
  projectsLoading
}) => {
  const handleProgramChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value
    onProgramChange(value === '' ? null : value)
    // Reset project selection when program changes
    onProjectChange(null)
  }

  const handleProjectChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value
    onProjectChange(value === '' ? null : value)
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth disabled={programsLoading}>
            <InputLabel id="program-select-label">Program</InputLabel>
            <Select
              labelId="program-select-label"
              id="program-select"
              value={selectedProgramId || ''}
              label="Program"
              onChange={handleProgramChange}
              endAdornment={
                programsLoading ? (
                  <CircularProgress size={20} sx={{ mr: 2 }} />
                ) : null
              }
            >
              <MenuItem value="">
                <em>Select a program</em>
              </MenuItem>
              {programs.map((program) => (
                <MenuItem key={program.id} value={program.id}>
                  {program.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <FormControl 
            fullWidth
            disabled={!selectedProgramId || projectsLoading}
          >
            <InputLabel id="project-select-label">Project</InputLabel>
            <Select
              labelId="project-select-label"
              id="project-select"
              value={selectedProjectId || ''}
              label="Project"
              onChange={handleProjectChange}
              endAdornment={
                projectsLoading ? (
                  <CircularProgress size={20} sx={{ mr: 2 }} />
                ) : null
              }
            >
              <MenuItem value="">
                <em>Select a project</em>
              </MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  )
}

export default FilterSection
