import React from 'react'
import { Tabs, Tab } from '@mui/material'
import { AccountTree } from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { Permission } from '../../utils/permissions'
import { getLastHierarchyDetail } from '../../utils/hierarchySession'

interface NavTabDef {
  value: string            // navigation target + Tab value
  label?: string
  icon?: React.ReactElement
  permission?: Permission
  match: string[]          // path prefixes that make this tab active
  groupStart?: boolean     // Group A: draw the Setup │ Global Lists divider before this tab
}

const TAB_DEFS: NavTabDef[] = [
  { value: '/portfolios', icon: <AccountTree fontSize="small" />, match: ['/portfolios', '/programs', '/projects'] },
  { value: '/workers', label: 'Workers', permission: 'view_workers', match: ['/workers'] },
  { value: '/setup/reference-data', label: 'Ref Data', permission: 'manage_reference_data', match: ['/setup'] },
  { value: '/admin/users', label: 'Users', permission: 'manage_users', match: ['/admin'] },
  { value: '/resources', label: 'Resources', permission: 'view_resources', match: ['/resources'], groupStart: true },
  { value: '/actuals', label: 'Actuals', permission: 'view_actuals', match: ['/actuals'] },
]

/**
 * The app's primary navigation: a permission-gated tab row in the app bar.
 * Leftmost is the hierarchy icon (Home -> /portfolios); a thin divider separates
 * the Setup tabs (Workers / Ref Data / Users) from the Global Lists
 * (Resources / Actuals). Active tab follows the URL by path prefix.
 */
const NavTabs: React.FC = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { hasPermission } = usePermissions()

  const tabs = TAB_DEFS.filter((t) => !t.permission || hasPermission(t.permission).hasPermission)
  const active = tabs.find((t) => t.match.some((m) => pathname === m || pathname.startsWith(m + '/')))
  const value = active ? active.value : false
  const navigateToTab = (tabPath: string) => {
    navigate(tabPath === '/portfolios' ? getLastHierarchyDetail() ?? tabPath : tabPath)
  }

  return (
    <Tabs
      value={value}
      onChange={(_e, v) => navigateToTab(v)}
      sx={{ minHeight: 48, '& .MuiTabs-flexContainer': { height: 48 } }}
    >
      {tabs.map((t) => (
        <Tab
          key={t.value}
          value={t.value}
          label={t.label}
          icon={t.icon}
          title={t.label ? undefined : 'Hierarchy (Home)'}
          aria-label={t.label || 'Hierarchy'}
          sx={{
            minHeight: 48,
            // Group A divider: a short vertical rule before the first Global Lists tab
            ...(t.groupStart && {
              ml: 1.5,
              position: 'relative',
              '&::before': {
                content: '""', position: 'absolute', left: -6, top: '30%', height: '40%',
                width: '1px', backgroundColor: 'divider',
              },
            }),
          }}
        />
      ))}
    </Tabs>
  )
}

export default NavTabs
