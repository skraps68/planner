import { describe, test, expect } from 'vitest'
import { hasPermission } from './permissions'

const admin = { roles: ['ADMIN'] } as any
const viewer = { roles: ['VIEWER'] } as any

describe('permissions', () => {
  test('admin has the reference-data permission', () => {
    expect(hasPermission(admin, 'manage_reference_data').hasPermission).toBe(true)
  })

  test('viewer lacks the reference-data permission', () => {
    expect(hasPermission(viewer, 'manage_reference_data').hasPermission).toBe(false)
  })
})
