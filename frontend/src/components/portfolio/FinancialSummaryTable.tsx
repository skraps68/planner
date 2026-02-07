import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Box
} from '@mui/material'
import { FinancialTableData } from '../../utils/forecastTransform'
import { formatCurrency } from '../../utils/currencyFormat'

interface FinancialSummaryTableProps {
  data: FinancialTableData | null
  loading: boolean
  error: Error | null
}

/**
 * FinancialSummaryTable Component
 * 
 * Displays a 3x5 grid of financial metrics with:
 * - 3 rows: Total, Capital, Expense
 * - 5 columns: Budget, Actuals, Forecast, Current Forecast, Variance
 * - Special symbols: '+' between Actuals and Forecast, '=' between Forecast and Current Forecast
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.5
 */
export const FinancialSummaryTable: React.FC<FinancialSummaryTableProps> = ({
  data,
  loading,
  error
}) => {
  // Handle loading state (Requirement 6.5)
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200} sx={{ mb: 3 }}>
        <CircularProgress />
      </Box>
    )
  }

  // Handle error state (Requirement 6.5)
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error.message || 'An error occurred while loading financial data.'}
      </Alert>
    )
  }

  // Render table with data or empty values (Requirement 3.6, 6.5)
  const displayData = data || {
    budget: { total: 0, capital: 0, expense: 0 },
    actuals: { total: 0, capital: 0, expense: 0 },
    forecast: { total: 0, capital: 0, expense: 0 },
    currentForecast: { total: 0, capital: 0, expense: 0 },
    variance: { total: 0, capital: 0, expense: 0 }
  }

  return (
    <TableContainer component={Paper} sx={{ mb: 3, overflowX: 'auto' }}>
      <Table sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
            <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Category</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 120 }}>Budget</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 120 }}>Actuals</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'bold', width: 40 }}>+</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 120 }}>Forecast</TableCell>
            <TableCell align="center" sx={{ fontWeight: 'bold', width: 40 }}>=</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 140 }}>Current Forecast</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 120 }}>Variance</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {/* Total Row */}
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#BBDEFB' }}>{formatCurrency(displayData.budget.total)}</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#E8F5E9' }}>{formatCurrency(displayData.actuals.total)}</TableCell>
            <TableCell align="center" sx={{ backgroundColor: '#E8F5E9' }}>+</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#E8F5E9' }}>{formatCurrency(displayData.forecast.total)}</TableCell>
            <TableCell align="center" sx={{ backgroundColor: '#E8F5E9' }}>=</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#C8E6C9' }}>{formatCurrency(displayData.currentForecast.total)}</TableCell>
            <TableCell 
              align="right"
              sx={{ 
                color: displayData.variance.total > 0 ? 'success.main' : displayData.variance.total < 0 ? 'error.main' : 'inherit',
                fontWeight: displayData.variance.total !== 0 ? 'bold' : 'normal'
              }}
            >
              {formatCurrency(displayData.variance.total)}
            </TableCell>
          </TableRow>

          {/* Capital Row */}
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Capital</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#BBDEFB' }}>{formatCurrency(displayData.budget.capital)}</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#E8F5E9' }}>{formatCurrency(displayData.actuals.capital)}</TableCell>
            <TableCell align="center" sx={{ backgroundColor: '#E8F5E9' }}>+</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#E8F5E9' }}>{formatCurrency(displayData.forecast.capital)}</TableCell>
            <TableCell align="center" sx={{ backgroundColor: '#E8F5E9' }}>=</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#C8E6C9' }}>{formatCurrency(displayData.currentForecast.capital)}</TableCell>
            <TableCell 
              align="right"
              sx={{ 
                color: displayData.variance.capital > 0 ? 'success.main' : displayData.variance.capital < 0 ? 'error.main' : 'inherit',
                fontWeight: displayData.variance.capital !== 0 ? 'bold' : 'normal'
              }}
            >
              {formatCurrency(displayData.variance.capital)}
            </TableCell>
          </TableRow>

          {/* Expense Row */}
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Expense</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#BBDEFB' }}>{formatCurrency(displayData.budget.expense)}</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#E8F5E9' }}>{formatCurrency(displayData.actuals.expense)}</TableCell>
            <TableCell align="center" sx={{ backgroundColor: '#E8F5E9' }}>+</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#E8F5E9' }}>{formatCurrency(displayData.forecast.expense)}</TableCell>
            <TableCell align="center" sx={{ backgroundColor: '#E8F5E9' }}>=</TableCell>
            <TableCell align="right" sx={{ backgroundColor: '#C8E6C9' }}>{formatCurrency(displayData.currentForecast.expense)}</TableCell>
            <TableCell 
              align="right"
              sx={{ 
                color: displayData.variance.expense > 0 ? 'success.main' : displayData.variance.expense < 0 ? 'error.main' : 'inherit',
                fontWeight: displayData.variance.expense !== 0 ? 'bold' : 'normal'
              }}
            >
              {formatCurrency(displayData.variance.expense)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}
