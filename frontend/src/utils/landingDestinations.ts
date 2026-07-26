import type { LandingDestination } from '../types/userSettings'
import type { Permission } from './permissions'

export interface LandingDestinationOption {
  value: LandingDestination
  label: string
  path: string
  permission?: Permission
}

export const LANDING_DESTINATIONS: LandingDestinationOption[] = [
  { value: 'hierarchy', label: 'Hierarchy', path: '/portfolios' },
  { value: 'workers', label: 'Workers', path: '/workers', permission: 'view_workers' },
  {
    value: 'reference_data',
    label: 'Reference Data',
    path: '/setup/reference-data',
    permission: 'manage_reference_data',
  },
  { value: 'users', label: 'Users', path: '/admin/users', permission: 'manage_users' },
  { value: 'resources', label: 'Resources', path: '/resources', permission: 'view_resources' },
  { value: 'actuals', label: 'Actuals', path: '/actuals', permission: 'view_actuals' },
]
