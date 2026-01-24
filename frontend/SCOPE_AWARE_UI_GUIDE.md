# Scope-Aware UI Implementation Guide

This guide explains how to implement scope-aware navigation and filtering in the frontend application.

## Overview

The scope-aware UI system provides:
- **Permission-based navigation** - Menu items are filtered based on user permissions
- **Scope-based data filtering** - Data is automatically filtered by user's assigned scope
- **Visual feedback** - Clear indicators when permissions are insufficient
- **Breadcrumbs with scope context** - Shows user's current scope and navigation path
- **Permission-aware buttons** - Buttons are disabled with tooltips when user lacks permission

## Core Components

### 1. Permission Utilities (`utils/permissions.ts`)

Provides functions for checking permissions and scope access:

```typescript
import { hasPermission, canAccessProgram, canAccessProject } from '../utils/permissions'

// Check if user has a specific permission
const canEdit = hasPermission(user, 'edit_programs')
// Returns: { hasPermission: boolean, reason?: string }

// Check if user can access a program
const programAccess = canAccessProgram(user, programId)

// Check if user can access a project
const projectAccess = canAccessProject(user, projectId, programId)

// Get accessible IDs
const programIds = getAccessibleProgramIds(user) // string[] | 'all'
const projectIds = getAccessibleProjectIds(user) // string[] | 'all'
```

### 2. Custom Hooks

#### `usePermissions()`

Provides easy access to permission checking:

```typescript
import { usePermissions } from '../hooks/usePermissions'

const {
  hasPermission,
  canAccessProgram,
  canAccessProject,
  accessibleProgramIds,
  accessibleProjectIds,
  scopeContext,
  hasAnyRole,
  activeRoleType,
  user,
  isAuthenticated,
} = usePermissions()
```

#### `useScopeFilter()`

Provides data filtering based on user scope:

```typescript
import { useScopeFilter } from '../hooks/usePermissions'

const {
  filterPrograms,
  filterProjects,
  hasGlobalAccess,
  getScopeFilterParams,
} = useScopeFilter()

// Filter data arrays
const filteredPrograms = filterPrograms(programs)
const filteredProjects = filterProjects(projects)

// Get API filter parameters
const filterParams = getScopeFilterParams()
// Returns: { program_ids?: string[], project_ids?: string[] }
```

### 3. UI Components

#### `ScopeBreadcrumbs`

Displays navigation breadcrumbs with scope indicators:

```typescript
import ScopeBreadcrumbs from '../components/common/ScopeBreadcrumbs'

<ScopeBreadcrumbs
  items={[
    { label: 'Home', path: '/dashboard' },
    { label: 'Programs', path: '/programs' },
    { label: 'Program Name' },
  ]}
  showScopeIndicator={true}
/>
```

#### `ScopeFilterBanner`

Shows an informational banner when data is filtered by scope:

```typescript
import ScopeFilterBanner from '../components/common/ScopeFilterBanner'

<ScopeFilterBanner 
  entityType="programs" // 'programs' | 'projects' | 'resources' | 'data'
  showDetails={true}
/>
```

#### `PermissionButton`

Button component that automatically disables based on permissions:

```typescript
import PermissionButton from '../components/common/PermissionButton'

<PermissionButton
  permission="create_programs"
  variant="contained"
  startIcon={<Add />}
  onClick={handleCreate}
  showTooltip={true}
>
  Create Program
</PermissionButton>

// Or with custom permission check
<PermissionButton
  customCheck={() => canAccessProgram(programId)}
  variant="outlined"
  onClick={handleEdit}
>
  Edit
</PermissionButton>
```

#### `PermissionGuard`

Wraps content and shows access denied message if user lacks permission:

```typescript
import PermissionGuard from '../components/common/PermissionGuard'

<PermissionGuard permission="view_programs">
  <ProgramDetails />
</PermissionGuard>

// Or with custom check
<PermissionGuard customCheck={() => canAccessProgram(programId)}>
  <ProgramDetails />
</PermissionGuard>
```

## Implementation Examples

### Example 1: List Page with Scope Filtering

```typescript
import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import ScopeBreadcrumbs from '../components/common/ScopeBreadcrumbs'
import ScopeFilterBanner from '../components/common/ScopeFilterBanner'
import PermissionButton from '../components/common/PermissionButton'
import { usePermissions, useScopeFilter } from '../hooks/usePermissions'

const ProgramsListPage: React.FC = () => {
  const { hasPermission, canAccessProgram } = usePermissions()
  const { filterPrograms } = useScopeFilter()

  const { data } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.list(),
  })

  // Filter data based on user scope
  const filteredPrograms = useMemo(() => {
    if (!data?.items) return []
    return filterPrograms(data.items)
  }, [data?.items, filterPrograms])

  return (
    <Box>
      <ScopeBreadcrumbs
        items={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Programs' },
        ]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Programs</Typography>
        <PermissionButton
          permission="create_programs"
          variant="contained"
          onClick={handleCreate}
        >
          Create Program
        </PermissionButton>
      </Box>

      <ScopeFilterBanner entityType="programs" />

      {/* Render filtered data */}
      <DataGrid rows={filteredPrograms} columns={columns} />
    </Box>
  )
}
```

### Example 2: Detail Page with Permission Guards

```typescript
import React from 'react'
import { useParams } from 'react-router-dom'
import PermissionGuard from '../components/common/PermissionGuard'
import PermissionButton from '../components/common/PermissionButton'
import { usePermissions } from '../hooks/usePermissions'

const ProgramDetailPage: React.FC = () => {
  const { id } = useParams()
  const { canAccessProgram, hasPermission } = usePermissions()

  return (
    <PermissionGuard customCheck={() => canAccessProgram(id!)}>
      <Box>
        <ScopeBreadcrumbs
          items={[
            { label: 'Home', path: '/dashboard' },
            { label: 'Programs', path: '/programs' },
            { label: program.name },
          ]}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <PermissionButton
            permission="edit_programs"
            customCheck={() => canAccessProgram(id!)}
            variant="contained"
            onClick={handleEdit}
          >
            Edit
          </PermissionButton>

          <PermissionButton
            permission="delete_programs"
            customCheck={() => canAccessProgram(id!)}
            variant="outlined"
            color="error"
            onClick={handleDelete}
          >
            Delete
          </PermissionButton>
        </Box>

        {/* Program details */}
      </Box>
    </PermissionGuard>
  )
}
```

### Example 3: DataGrid with Permission-Based Actions

```typescript
const columns: GridColDef[] = [
  // ... other columns
  {
    field: 'actions',
    headerName: 'Actions',
    renderCell: (params) => {
      const programAccess = canAccessProgram(params.row.id)
      const canEdit = hasPermission('edit_programs')

      return (
        <Box>
          <IconButton
            disabled={!programAccess.hasPermission}
            title={programAccess.hasPermission ? 'View' : programAccess.reason}
            onClick={() => navigate(`/programs/${params.row.id}`)}
          >
            <Visibility />
          </IconButton>

          <IconButton
            disabled={!programAccess.hasPermission || !canEdit.hasPermission}
            title={
              !programAccess.hasPermission
                ? programAccess.reason
                : !canEdit.hasPermission
                ? canEdit.reason
                : 'Edit'
            }
            onClick={() => navigate(`/programs/${params.row.id}/edit`)}
          >
            <Edit />
          </IconButton>
        </Box>
      )
    },
  },
]
```

## Permission Types

Available permissions:
- `view_programs` - View program list and details
- `create_programs` - Create new programs
- `edit_programs` - Edit existing programs
- `delete_programs` - Delete programs
- `view_projects` - View project list and details
- `create_projects` - Create new projects
- `edit_projects` - Edit existing projects
- `delete_projects` - Delete projects
- `view_resources` - View resources
- `manage_resources` - Create/edit/delete resources
- `view_workers` - View workers
- `manage_workers` - Create/edit/delete workers
- `view_actuals` - View actuals data
- `import_actuals` - Import actuals from CSV
- `view_reports` - View reports
- `manage_users` - Manage users (admin only)
- `view_audit` - View audit logs

## Scope Types

- **GLOBAL** - Full access to all programs and projects
- **PROGRAM** - Access to specific program and all its projects
- **PROJECT** - Access to specific projects only

## Best Practices

1. **Always use permission checks** - Don't assume users have access
2. **Filter data client-side** - Use `useScopeFilter` hooks for consistent filtering
3. **Show clear feedback** - Use tooltips and disabled states to explain why actions are unavailable
4. **Add breadcrumbs** - Help users understand their current scope context
5. **Use PermissionGuard** - Wrap entire pages that require specific permissions
6. **Combine checks** - Check both permission AND scope access for actions on specific entities

## Testing Scope-Aware Features

When testing:
1. Test with different role types (ADMIN, PROGRAM_MANAGER, PROJECT_MANAGER, etc.)
2. Test with different scope types (GLOBAL, PROGRAM, PROJECT)
3. Test with multiple scope assignments
4. Verify data filtering works correctly
5. Verify buttons and actions are properly disabled
6. Verify tooltips show appropriate messages
