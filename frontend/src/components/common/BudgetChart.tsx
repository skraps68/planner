import React from 'react'
import { Box, Typography, Paper } from '@mui/material'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface BudgetChartProps {
  capitalBudget: number
  expenseBudget: number
  title?: string
}

const COLORS = ['#1976d2', '#9c27b0']

const BudgetChart: React.FC<BudgetChartProps> = ({ capitalBudget, expenseBudget, title }) => {
  const data = [
    { name: 'Capital', value: capitalBudget },
    { name: 'Expense', value: expenseBudget },
  ]

  const total = capitalBudget + expenseBudget

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <Paper sx={{ p: 2 }}>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Total Budget
            </Typography>
            <Typography variant="h5">{formatCurrency(total)}</Typography>
          </Box>
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Capital Budget
            </Typography>
            <Typography variant="body1" color="primary">
              {formatCurrency(capitalBudget)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Expense Budget
            </Typography>
            <Typography variant="body1" color="secondary">
              {formatCurrency(expenseBudget)}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}

export default BudgetChart
