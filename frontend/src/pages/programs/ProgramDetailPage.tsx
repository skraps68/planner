import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Divider,
  Card,
  CardContent,
  Tabs,
  Tab,
} from '@mui/material'
import { Edit, ArrowBack } from '@mui/icons-material'
import { programsApi } from '../../api/programs'
import { format } from 'date-fns'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index} style={{ paddingTop: 24 }}>
      {value === index && children}
    </div>
  )
}

const ProgramDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tabValue, setTabValue] = React.useState(0)

  const { data: program, isLoading } = useQuery({
    queryKey: ['program', id],
    queryFn: () => programsApi.get(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return <Typography>Loading...</Typography>
  }

  if (!program) {
    return <Typography>Program not found</Typography>
  }

  const now = new Date()
  const startDate = new Date(program.start_date)
  const endDate = new Date(program.end_date)

  let status = 'Active'
  let statusColor: 'success' | 'warning' | 'default' = 'success'

  if (now < startDate) {
    status = 'Planned'
    statusColor = 'warning'
  } else if (now > endDate) {
    status = 'Completed'
    statusColor = 'default'
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/programs')} sx={{ mr: 2 }}>
          Back
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {program.name}
        </Typography>
        <Chip label={status} color={statusColor} sx={{ mr: 2 }} />
        <Button variant="contained" startIcon={<Edit />} onClick={() => navigate(`/programs/${id}/edit`)}>
          Edit
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Overview" />
          <Tab label="Projects" />
          <Tab label="Budget Summary" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Program Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Program Name
                  </Typography>
                  <Typography variant="body1">{program.name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Business Sponsor
                  </Typography>
                  <Typography variant="body1">{program.business_sponsor}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Program Manager
                  </Typography>
                  <Typography variant="body1">{program.program_manager}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Technical Lead
                  </Typography>
                  <Typography variant="body1">{program.technical_lead}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(program.start_date), 'MMMM dd, yyyy')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    End Date
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(program.end_date), 'MMMM dd, yyyy')}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Stats
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Total Projects
                  </Typography>
                  <Typography variant="h4">0</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Active Projects
                  </Typography>
                  <Typography variant="h4">0</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Budget
                  </Typography>
                  <Typography variant="h4">$0</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Associated Projects
          </Typography>
          <Typography color="text.secondary">No projects found</Typography>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Budget Summary
          </Typography>
          <Typography color="text.secondary">Budget data will be displayed here</Typography>
        </Paper>
      </TabPanel>
    </Box>
  )
}

export default ProgramDetailPage
