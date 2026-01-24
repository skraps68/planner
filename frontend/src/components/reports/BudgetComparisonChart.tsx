import React from 'react'
import { Typography, Paper } from '@mui/material'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface BudgetComparisonChartProps {
  data: Array<{
    name: string
    budget: number
    actual: number
    forecast: number
  }>
  title?: string
  type?: 'bar' | 'line'
  height?: number
}

const BudgetComparisonChart: React.FC<BudgetComparisonChartProps> = ({
  data,
  title = 'Budget Comparison',
  type = 'bar',
  height = 300
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const ChartComponent = type === 'bar' ? BarChart : LineChart

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelStyle={{ color: '#000' }}
          />
          <Legend />
          {type === 'bar' ? (
            <>
              <Bar dataKey="budget" fill="#8884d8" name="Budget" />
              <Bar dataKey="actual" fill="#82ca9d" name="Actual" />
              <Bar dataKey="forecast" fill="#ffc658" name="Forecast" />
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="budget"
                stroke="#8884d8"
                name="Budget"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#82ca9d"
                name="Actual"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#ffc658"
                name="Forecast"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </Paper>
  )
}

export default BudgetComparisonChart
