import React from 'react'
import { Breadcrumbs, Typography, Link, Chip, Box } from '@mui/material'
import { NavigateNext, Lock, LockOpen } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { getScopeContext } from '../../utils/permissions'

interface BreadcrumbItem {
  label: string
  path?: string
  isScope?: boolean
  state?: {
    portfolioId?: string
    portfolioName?: string
    programId?: string
    programName?: string
  }
}

interface ScopeBreadcrumbsProps {
  items: BreadcrumbItem[]
  showScopeIndicator?: boolean
}

const ScopeBreadcrumbs: React.FC<ScopeBreadcrumbsProps> = ({ items, showScopeIndicator = true }) => {
  const navigate = useNavigate()
  const user = useSelector((state: RootState) => state.auth.user)
  const scopeContext = getScopeContext(user)

  const hasGlobalScope = user?.activeRole?.scopes.some((scope) => scope.scope_type === 'GLOBAL') || false

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
      <Breadcrumbs separator={<NavigateNext fontSize="small" />} aria-label="breadcrumb">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          if (isLast || !item.path) {
            return (
              <Typography
                key={index}
                color="text.primary"
                sx={{
                  fontWeight: isLast ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {item.isScope && <Lock fontSize="small" />}
                {item.label}
              </Typography>
            )
          }

          return (
            <Link
              key={index}
              underline="hover"
              color="inherit"
              onClick={() => navigate(item.path!, { state: item.state })}
              sx={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              {item.isScope && <Lock fontSize="small" />}
              {item.label}
            </Link>
          )
        })}
      </Breadcrumbs>
      {showScopeIndicator && scopeContext.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasGlobalScope ? (
            <Chip
              icon={<LockOpen />}
              label="Full Access"
              size="small"
              color="success"
              variant="outlined"
            />
          ) : (
            <Chip
              icon={<Lock />}
              label={`Scoped Access: ${scopeContext.join(', ')}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
      )}
    </Box>
  )
}

export default ScopeBreadcrumbs
