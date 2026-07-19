import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, Menu, MenuItem, ListSubheader, Tooltip } from '@mui/material'
import { Apps as AppsIcon } from '@mui/icons-material'
import { usePermissions } from '../../hooks/usePermissions'
import { Permission } from '../../utils/permissions'

interface Destination {
  label: string
  path: string
  permission?: Permission
}

interface DestinationGroup {
  title: string
  items: Destination[]
}

// Occasional ("10%") destinations. The Portfolios hierarchy is the primary nav.
const GROUPS: DestinationGroup[] = [
  {
    title: 'Setup',
    items: [
      { label: 'Workers', path: '/workers', permission: 'view_workers' },
      { label: 'Resource Roles', path: '/setup/resource-roles', permission: 'manage_resource_roles' },
      { label: 'User Management', path: '/admin/users', permission: 'manage_users' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Reports', path: '/reports', permission: 'view_reports' },
    ],
  },
  {
    title: 'Global lists',
    items: [
      { label: 'Resources', path: '/resources', permission: 'view_resources' },
      { label: 'Actuals', path: '/actuals', permission: 'view_actuals' },
    ],
  },
]

const WaffleLauncher: React.FC = () => {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || hasPermission(item.permission).hasPermission
    ),
  })).filter((group) => group.items.length > 0)

  const go = (path: string) => {
    setAnchorEl(null)
    navigate(path)
  }

  return (
    <>
      <Tooltip title="Apps">
        <IconButton
          aria-label="apps"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          edge="start"
          sx={{ mr: 1.5 }}
        >
          <AppsIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {/* Home: back to the expanded portfolio hierarchy (same as the title link) */}
        <MenuItem key="/portfolios" onClick={() => go('/portfolios')}>
          Home
        </MenuItem>
        {visibleGroups.flatMap((group) => [
          <ListSubheader
            key={`${group.title}-header`}
            sx={{
              lineHeight: '28px',
              backgroundColor: 'grey.200',
              color: 'text.primary',
              fontWeight: 600,
            }}
          >
            {group.title}
          </ListSubheader>,
          ...group.items.map((item) => (
            <MenuItem key={item.path} onClick={() => go(item.path)}>
              {item.label}
            </MenuItem>
          )),
        ])}
      </Menu>
    </>
  )
}

export default WaffleLauncher
