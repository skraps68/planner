import React from 'react'
import { Box, Typography } from '@mui/material'
import { ResourceInfo, GridData, getCellValue } from '../../utils/calendarTransform'

export interface ResourceRowProps {
  resource: ResourceInfo
  dates: Date[]
  gridData: GridData
}

const ResourceRow: React.FC<ResourceRowProps> = ({ resource, dates, gridData }) => {
  const formatPercentage = (value: number): string => {
    if (value === 0) return ''
    return `${value}%`
  }

  return (
    <>
      {/* Capital Row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `200px repeat(${dates.length}, 100px)`,
          borderBottom: '1px solid #ddd',
          backgroundColor: '#f5f5f5',
        }}
      >
        {/* Sticky resource name cell */}
        <Box
          sx={{
            position: 'sticky',
            left: 0,
            backgroundColor: '#f5f5f5',
            padding: '12px',
            borderRight: '1px solid #ddd',
            zIndex: 1,
          }}
        >
          <Typography variant="body2" fontWeight="medium">
            {resource.resourceName}
          </Typography>
          <Typography variant="caption" color="primary">
            Capital
          </Typography>
        </Box>

        {/* Capital cells for each date */}
        {dates.map((date, index) => {
          const value = getCellValue(gridData, resource.resourceId, date, 'capital')
          return (
            <Box
              key={index}
              sx={{
                padding: '12px',
                textAlign: 'center',
                borderRight: '1px solid #ddd',
              }}
            >
              <Typography variant="body2">{formatPercentage(value)}</Typography>
            </Box>
          )
        })}
      </Box>

      {/* Expense Row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `200px repeat(${dates.length}, 100px)`,
          borderBottom: '1px solid #ddd',
          backgroundColor: '#ffffff',
        }}
      >
        {/* Sticky resource name cell */}
        <Box
          sx={{
            position: 'sticky',
            left: 0,
            backgroundColor: '#ffffff',
            padding: '12px',
            borderRight: '1px solid #ddd',
            zIndex: 1,
          }}
        >
          <Typography variant="body2" fontWeight="medium">
            {resource.resourceName}
          </Typography>
          <Typography variant="caption" color="secondary">
            Expense
          </Typography>
        </Box>

        {/* Expense cells for each date */}
        {dates.map((date, index) => {
          const value = getCellValue(gridData, resource.resourceId, date, 'expense')
          return (
            <Box
              key={index}
              sx={{
                padding: '12px',
                textAlign: 'center',
                borderRight: '1px solid #ddd',
              }}
            >
              <Typography variant="body2">{formatPercentage(value)}</Typography>
            </Box>
          )
        })}
      </Box>
    </>
  )
}

export default ResourceRow
