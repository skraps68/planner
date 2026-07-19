import React from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { Permission } from '../../utils/permissions'

interface AdminRouteProps {
  permission: Permission
  children: React.ReactNode
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ permission, children }) => {
  const { hasPermission } = usePermissions()
  return hasPermission(permission).hasPermission ? <>{children}</> : <Navigate to="/portfolios" replace />
}
