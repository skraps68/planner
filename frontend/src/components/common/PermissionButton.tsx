import React from 'react'
import { Button, ButtonProps, Tooltip, CircularProgress } from '@mui/material'
import { Lock } from '@mui/icons-material'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { hasPermission, Permission } from '../../utils/permissions'

interface PermissionButtonProps extends Omit<ButtonProps, 'disabled'> {
  permission?: Permission
  customCheck?: () => { hasPermission: boolean; reason?: string }
  showTooltip?: boolean
  loadingState?: boolean
}

const PermissionButton: React.FC<PermissionButtonProps> = ({
  permission,
  customCheck,
  showTooltip = true,
  loadingState = false,
  children,
  onClick,
  ...buttonProps
}) => {
  const user = useSelector((state: RootState) => state.auth.user)

  // Determine permission status
  let permissionCheck: { hasPermission: boolean; reason?: string } = { hasPermission: true, reason: undefined }
  
  if (customCheck) {
    permissionCheck = customCheck()
  } else if (permission) {
    permissionCheck = hasPermission(user, permission)
  }

  const isDisabled = !permissionCheck.hasPermission || loadingState

  const button = (
    <Button
      {...buttonProps}
      disabled={isDisabled}
      onClick={permissionCheck.hasPermission ? onClick : undefined}
      startIcon={
        loadingState ? (
          <CircularProgress size={16} />
        ) : !permissionCheck.hasPermission ? (
          <Lock fontSize="small" />
        ) : (
          buttonProps.startIcon
        )
      }
      sx={{
        ...buttonProps.sx,
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      {children}
    </Button>
  )

  if (showTooltip && !permissionCheck.hasPermission && permissionCheck.reason) {
    return (
      <Tooltip title={permissionCheck.reason} arrow>
        <span>{button}</span>
      </Tooltip>
    )
  }

  return button
}

export default PermissionButton
