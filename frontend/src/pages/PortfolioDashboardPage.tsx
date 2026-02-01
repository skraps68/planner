import React, { useState, useMemo, useEffect } from 'react'
import { Box, Container, Alert, CircularProgress, Grid, Button } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowBack } from '@mui/icons-material'
import { AxiosError } from 'axios'
import { programsApi } from '../api/programs'
import { projectsApi } from '../api/projects'
import { phasesApi } from '../api/phases'
import { getProgramForecast, getProjectForecast } from '../api/forecast'
import { transformForecastData } from '../utils/forecastTransform'
import FilterSection from '../components/portfolio/FilterSection'
import { FinancialSummaryTable } from '../components/portfolio/FinancialSummaryTable'
import ChartSection from '../components/portfolio/ChartSection'

/**
 * PortfolioDashboardPage Component
 * 
 * Main container component for the Portfolio Dashboard feature.
 * Manages state for program/project selection and orchestrates data fetching.
 * 
 * Requirements: 2.4, 2.5, 2.6, 2.7, 4.6, 4.7, 4.8, 6.5
 */
const PortfolioDashboardPage: React.FC = () => {
  // Get URL search params for pre-selection
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // State management for program and project selection (Requirement 2.4, 2.5)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)

  // Get today's date in ISO format for as_of_date parameter (Requirement 4.6)
  const today = useMemo(() => {
    const date = new Date()
    return date.toISOString().split('T')[0] // YYYY-MM-DD format
  }, [])

  // Check if we came from a detail page (has programId or projectId in URL)
  const cameFromDetailPage = searchParams.get('programId') || searchParams.get('projectId')
  
  // Determine back navigation path
  const getBackPath = () => {
    const projectId = searchParams.get('projectId')
    const programId = searchParams.get('programId')
    const returnTo = searchParams.get('returnTo')
    const returnId = searchParams.get('returnId')
    const returnTab = searchParams.get('returnTab')
    
    // Use returnTo and returnId if available (more reliable)
    if (returnTo && returnId) {
      const basePath = returnTo === 'project' ? `/projects/${returnId}` : `/programs/${returnId}`
      return returnTab ? `${basePath}?tab=${returnTab}` : basePath
    }
    
    // Fallback to projectId/programId from filters
    if (projectId) {
      return `/projects/${projectId}`
    } else if (programId) {
      return `/programs/${programId}`
    }
    return null
  }

  // Pre-select program and project from URL params
  useEffect(() => {
    const programId = searchParams.get('programId')
    const projectId = searchParams.get('projectId')
    
    if (programId) {
      setSelectedProgramId(programId)
    }
    if (projectId) {
      setSelectedProjectId(projectId)
    }
  }, [searchParams])

  /**
   * Helper function to format API errors into user-friendly messages
   * Requirement 6.5: Error handling for API failures
   */
  const getErrorMessage = (error: unknown): string => {
    if (!error) return 'An unknown error occurred'
    
    const axiosError = error as AxiosError
    
    // Network errors
    if (!axiosError.response) {
      return 'Unable to connect to server. Please check your connection.'
    }
    
    // HTTP status code errors
    switch (axiosError.response.status) {
      case 404:
        return 'The requested program/project was not found.'
      case 403:
        return "You don't have permission to view this data."
      case 500:
        return 'An error occurred while loading data. Please try again.'
      case 504:
        return 'Request timed out. Please try again.'
      default:
        return axiosError.message || 'An error occurred while loading data.'
    }
  }

  // Fetch all programs on mount (Requirement 2.4)
  const { 
    data: programsData, 
    isLoading: programsLoading,
    error: programsError
  } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.list({ limit: 1000 })
  })

  const programs = programsData?.items || []

  // Fetch projects filtered by selected program (Requirement 2.5)
  const { 
    data: projectsData, 
    isLoading: projectsLoading,
    error: projectsError
  } = useQuery({
    queryKey: ['projects', selectedProgramId],
    queryFn: () => projectsApi.list({ 
      program_id: selectedProgramId!, 
      limit: 1000 
    }),
    enabled: !!selectedProgramId // Only fetch when program is selected
  })

  const projects = projectsData?.items || []

  // Fetch phases for selected project
  const { 
    data: phasesData, 
    isLoading: phasesLoading
  } = useQuery({
    queryKey: ['phases', selectedProjectId],
    queryFn: () => phasesApi.list(selectedProjectId!),
    enabled: !!selectedProjectId // Only fetch when project is selected
  })

  const phases = phasesData || []

  // Fetch forecast data based on selection (Requirements 2.6, 2.7, 4.7, 4.8)
  const { 
    data: forecastData, 
    isLoading: forecastLoading,
    error: forecastError 
  } = useQuery({
    queryKey: ['forecast', selectedProgramId, selectedProjectId, selectedPhaseId, today],
    queryFn: async () => {
      // If project is selected, fetch project-level forecast (Requirement 2.7)
      if (selectedProjectId) {
        return await getProjectForecast(selectedProjectId, today, selectedPhaseId)
      }
      // If only program is selected, fetch program-level forecast (Requirement 2.6)
      // This will aggregate data for all projects in the program
      return await getProgramForecast(selectedProgramId!, today)
    },
    enabled: !!selectedProgramId // Only fetch when program is selected
  })

  // Transform forecast data for display (Requirement 4.8)
  const financialTableData = useMemo(() => {
    if (!forecastData) return null
    return transformForecastData(forecastData)
  }, [forecastData])

  // Handlers for program and project selection changes
  const handleProgramChange = (programId: string | null) => {
    setSelectedProgramId(programId)
    setSelectedProjectId(null) // Reset project when program changes
    setSelectedPhaseId(null) // Reset phase when program changes
  }

  const handleProjectChange = (projectId: string | null) => {
    setSelectedProjectId(projectId)
    setSelectedPhaseId(null) // Reset phase when project changes
  }

  const handlePhaseChange = (phaseId: string | null) => {
    setSelectedPhaseId(phaseId)
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Display error for programs loading failure (Requirement 6.5) */}
      {programsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {getErrorMessage(programsError)}
        </Alert>
      )}

      {/* Display error for projects loading failure (Requirement 6.5) */}
      {projectsError && selectedProgramId && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load projects: {getErrorMessage(projectsError)}
        </Alert>
      )}

      {/* Display loading state for initial programs load (Requirement 6.5) */}
      {programsLoading && !programsError && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress size={60} />
        </Box>
      )}

      {/* Display main content when programs are loaded (Requirement 6.5) */}
      {!programsLoading && !programsError && (
        <Grid container spacing={3}>
          {/* Filter Section - Full width on all screens */}
          <Grid item xs={12}>
            <FilterSection
              programs={programs}
              projects={projects}
              phases={phases}
              selectedProgramId={selectedProgramId}
              selectedProjectId={selectedProjectId}
              selectedPhaseId={selectedPhaseId}
              onProgramChange={handleProgramChange}
              onProjectChange={handleProjectChange}
              onPhaseChange={handlePhaseChange}
              programsLoading={programsLoading}
              projectsLoading={projectsLoading}
              phasesLoading={phasesLoading}
              backButton={
                cameFromDetailPage ? (
                  <Button 
                    startIcon={<ArrowBack />} 
                    onClick={() => {
                      const backPath = getBackPath()
                      if (backPath) navigate(backPath)
                    }}
                  >
                    Back
                  </Button>
                ) : undefined
              }
            />
          </Grid>

          {/* Display info message when no program is selected (Requirement 6.5) */}
          {!selectedProgramId && (
            <Grid item xs={12}>
              <Alert severity="info">
                Please select a program to view financial data.
              </Alert>
            </Grid>
          )}

          {/* Financial Summary Table - Full width on all screens */}
          {selectedProgramId && (
            <Grid item xs={12}>
              <FinancialSummaryTable
                data={financialTableData}
                loading={forecastLoading}
                error={forecastError ? new Error(getErrorMessage(forecastError)) : null}
              />
            </Grid>
          )}

          {/* Chart Section Placeholder - Full width on all screens */}
          {selectedProgramId && (
            <Grid item xs={12}>
              <ChartSection />
            </Grid>
          )}
        </Grid>
      )}
    </Container>
  )
}

export default PortfolioDashboardPage
