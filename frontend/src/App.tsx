import { Routes, Route, Navigate } from 'react-router-dom'
import { Box } from '@mui/material'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/layout/Layout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PortfolioDashboardPage from './pages/PortfolioDashboardPage'
import ProgramsListPage from './pages/programs/ProgramsListPage'
import ProgramDetailPage from './pages/programs/ProgramDetailPage'
import ProgramFormPage from './pages/programs/ProgramFormPage'
import ProjectsListPage from './pages/projects/ProjectsListPage'
import ProjectDetailPage from './pages/projects/ProjectDetailPage'
import ProjectFormPage from './pages/projects/ProjectFormPage'
import ResourcesListPage from './pages/resources/ResourcesListPage'
import ResourceDetailPage from './pages/resources/ResourceDetailPage'
import WorkersListPage from './pages/workers/WorkersListPage'
import WorkerDetailPage from './pages/workers/WorkerDetailPage'
import WorkerTypeDetailPage from './pages/workers/WorkerTypeDetailPage'
import ActualsListPage from './pages/actuals/ActualsListPage'
import ActualsImportPage from './pages/actuals/ActualsImportPage'
import VarianceAnalysisPage from './pages/actuals/VarianceAnalysisPage'
import ReportsIndexPage from './pages/reports/ReportsIndexPage'
import BudgetVsActualDashboard from './pages/reports/BudgetVsActualDashboard'
import TimeSeriesCostReport from './pages/reports/TimeSeriesCostReport'
import ResourceUtilizationReport from './pages/reports/ResourceUtilizationReport'
import DrillDownReport from './pages/reports/DrillDownReport'
import UsersListPage from './pages/admin/UsersListPage'
import UserDetailPage from './pages/admin/UserDetailPage'
import UserFormPage from './pages/admin/UserFormPage'
import UserRolesPage from './pages/admin/UserRolesPage'
import RoleScopesPage from './pages/admin/RoleScopesPage'
import UserAuditPage from './pages/admin/UserAuditPage'
import PortfoliosListPage from './pages/portfolios/PortfoliosListPage'
import PortfolioDetailPage from './pages/portfolios/PortfolioDetailPage'
import PortfolioFormPage from './pages/portfolios/PortfolioFormPage'

function App() {
  return (
    <AuthProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/portfolio" replace />} />
                    <Route path="/portfolio" element={<PortfolioDashboardPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/portfolios" element={<PortfoliosListPage />} />
                    <Route path="/portfolios/new" element={<PortfolioFormPage />} />
                    <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
                    <Route path="/programs" element={<ProgramsListPage />} />
                    <Route path="/programs/new" element={<ProgramFormPage />} />
                    <Route path="/programs/:id" element={<ProgramDetailPage />} />
                    <Route path="/programs/:id/edit" element={<ProgramFormPage />} />
                    <Route path="/projects" element={<ProjectsListPage />} />
                    <Route path="/projects/new" element={<ProjectFormPage />} />
                    <Route path="/projects/:id" element={<ProjectDetailPage />} />
                    <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
                    <Route path="/resources" element={<ResourcesListPage />} />
                    <Route path="/resources/:id" element={<ResourceDetailPage />} />
                    <Route path="/workers" element={<WorkersListPage />} />
                    <Route path="/workers/:id" element={<WorkerDetailPage />} />
                    <Route path="/workers/types/:id" element={<WorkerTypeDetailPage />} />
                    <Route path="/actuals" element={<ActualsListPage />} />
                    <Route path="/actuals/import" element={<ActualsImportPage />} />
                    <Route path="/actuals/variance" element={<VarianceAnalysisPage />} />
                    <Route path="/reports" element={<ReportsIndexPage />} />
                    <Route path="/reports/budget-vs-actual" element={<BudgetVsActualDashboard />} />
                    <Route path="/reports/time-series" element={<TimeSeriesCostReport />} />
                    <Route path="/reports/resource-utilization" element={<ResourceUtilizationReport />} />
                    <Route path="/reports/drill-down" element={<DrillDownReport />} />
                    <Route path="/admin/users" element={<UsersListPage />} />
                    <Route path="/admin/users/create" element={<UserFormPage />} />
                    <Route path="/admin/users/:id" element={<UserDetailPage />} />
                    <Route path="/admin/users/:id/edit" element={<UserFormPage />} />
                    <Route path="/admin/users/:id/roles" element={<UserRolesPage />} />
                    <Route path="/admin/users/:id/roles/:roleId/scopes" element={<RoleScopesPage />} />
                    <Route path="/admin/users/:id/audit" element={<UserAuditPage />} />
                    {/* Additional routes will be added in subsequent tasks */}
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Box>
    </AuthProvider>
  )
}

export default App
