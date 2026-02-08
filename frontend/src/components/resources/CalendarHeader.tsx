import React from 'react'
import { Box, Typography } from '@mui/material'

export interface CalendarHeaderProps {
  dates: Date[]
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({ dates }) => {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `200px repeat(${dates.length}, 100px)`,
        borderBottom: '2px solid #ddd',
      }}
    >
      {/* Sticky first column header */}
      <Box
        sx={{
          position: 'sticky',
          left: 0,
          backgroundColor: '#A5C1D8',
          padding: '12px',
          fontWeight: 'bold',
          borderRight: '1px solid #ddd',
          zIndex: 2,
        }}
      >
        <Typography variant="subtitle2" fontWeight="bold">
          Resource
        </Typography>
      </Box>

      {/* Date column headers */}
      {dates.map((date, index) => (
        <Box
          key={index}
          sx={{
            backgroundColor: '#A5C1D8',
            padding: '12px',
            textAlign: 'center',
            borderRight: '1px solid #ddd',
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold">
            {formatDate(date)}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

export default CalendarHeader
