import { describe, test, expect } from 'vitest'
import { hasPermission } from './permissions'

const admin = { roles: ['ADMIN'] } as any
const viewer = { roles: ['VIEWER'] } as any

describe('permissions', () => {
  test('admin has setup permissions', () => {
    expect(hasPermission(admin, 'manage_rates').hasPermission).toBe(true)
    expect(hasPermission(admin, 'manage_resource_roles').hasPermission).toBe(true)
    expect(hasPermission(admin, 'manage_worker_types').hasPermission).toBe(true)
  })

  test('viewer lacks setup permissions', () => {
    expect(hasPermission(viewer, 'manage_rates').hasPermission).toBe(false)
  })
})
