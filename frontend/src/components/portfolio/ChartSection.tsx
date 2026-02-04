import React from 'react';
import { Paper, Typography, Grid, Box } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { FinancialTableData } from '../../utils/forecastTransform';
import { formatCurrency } from '../../utils/currencyFormat';

interface ChartSectionProps {
  data?: FinancialTableData | null;
}

/**
 * ChartSection Component
 * 
 * Displays three bar charts comparing Budget vs (Actuals + Forecast):
 * - Capital chart
 * - Expense chart
 * - Total chart
 * 
 * Each chart shows:
 * - Budget bar (single bar)
 * - Actuals + Forecast bar (stacked bar with Actuals on bottom, Forecast on top)
 * - Variance visualization with dashed lines and label
 * 
 * Requirements: 8.1, 8.2, 8.3
 */
const ChartSection: React.FC<ChartSectionProps> = ({ data }) => {
  if (!data) {
    return null;
  }

  // Calculate variances
  const capitalBudget = parseFloat(data.budget.capital.toString());
  const capitalCurrentForecast = parseFloat(data.actuals.capital.toString()) + parseFloat(data.forecast.capital.toString());
  const capitalVariance = capitalCurrentForecast - capitalBudget;

  const expenseBudget = parseFloat(data.budget.expense.toString());
  const expenseCurrentForecast = parseFloat(data.actuals.expense.toString()) + parseFloat(data.forecast.expense.toString());
  const expenseVariance = expenseCurrentForecast - expenseBudget;

  const totalBudget = parseFloat(data.budget.total.toString());
  const totalCurrentForecast = parseFloat(data.actuals.total.toString()) + parseFloat(data.forecast.total.toString());
  const totalVariance = totalCurrentForecast - totalBudget;

  // Prepare data for Capital chart
  const capitalData = [
    {
      name: 'Budget',
      Budget: capitalBudget,
    },
    {
      name: 'Actuals + Forecast',
      Actuals: parseFloat(data.actuals.capital.toString()),
      Forecast: parseFloat(data.forecast.capital.toString()),
    },
  ];

  // Prepare data for Expense chart
  const expenseData = [
    {
      name: 'Budget',
      Budget: expenseBudget,
    },
    {
      name: 'Actuals + Forecast',
      Actuals: parseFloat(data.actuals.expense.toString()),
      Forecast: parseFloat(data.forecast.expense.toString()),
    },
  ];

  // Prepare data for Total chart
  const totalData = [
    {
      name: 'Budget',
      Budget: totalBudget,
    },
    {
      name: 'Actuals + Forecast',
      Actuals: parseFloat(data.actuals.total.toString()),
      Forecast: parseFloat(data.forecast.total.toString()),
    },
  ];

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 1.5, border: '1px solid #ccc' }}>
          {payload.map((entry: any, index: number) => (
            <Typography key={index} variant="body2" sx={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </Typography>
          ))}
        </Paper>
      );
    }
    return null;
  };

  // Helper to render a chart with variance visualization
  const renderChart = (
    chartData: any[],
    budget: number,
    currentForecast: number,
    variance: number
  ) => {
    // When over budget (variance >= 0), show negative sign (bad)
    // When under budget (variance < 0), show positive sign (good)
    const sign = variance >= 0 ? '-' : '+';
    const color = variance >= 0 ? '#d32f2f' : '#2e7d32';
    
    // Calculate the position of the variance label based on data values
    // Chart height is 300px, with margins: top=20, bottom=5
    // Actual chart area is ~275px (300 - 20 - 5)
    const chartHeight = 300;
    const topMargin = 20;
    const bottomMargin = 5;
    const chartArea = chartHeight - topMargin - bottomMargin;
    
    // Find the max value to determine the scale
    const maxValue = Math.max(budget, currentForecast) * 1.1; // Add 10% padding like Recharts does
    
    // Calculate positions as percentages from the bottom
    const budgetPercent = budget / maxValue;
    const forecastPercent = currentForecast / maxValue;
    
    // Convert to pixel positions from top (inverted because Y increases downward)
    const budgetY = topMargin + chartArea * (1 - budgetPercent);
    const forecastY = topMargin + chartArea * (1 - forecastPercent);
    
    // Calculate the midpoint between the two lines
    const midpointY = (budgetY + forecastY) / 2;
    
    // Check if there's enough space between lines (at least 40px)
    const gap = Math.abs(budgetY - forecastY);
    const minGap = 40;
    
    // If gap is too small, position above the higher line (lower Y value)
    const labelY = gap >= minGap ? midpointY : Math.min(budgetY, forecastY) - 20;
    
    return (
      <Box sx={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="Budget" fill="#1976d2" />
            <Bar dataKey="Actuals" stackId="a" fill="#66bb6a" />
            <Bar dataKey="Forecast" stackId="a" fill="#a5d6a7" />
            {/* Dashed line at budget level */}
            <ReferenceLine 
              y={budget} 
              stroke="#1976d2" 
              strokeDasharray="5 5" 
              strokeWidth={1.5}
            />
            {/* Dashed line at current forecast level */}
            <ReferenceLine 
              y={currentForecast} 
              stroke="#66bb6a" 
              strokeDasharray="5 5" 
              strokeWidth={1.5}
            />
          </BarChart>
        </ResponsiveContainer>
        {/* Variance label positioned based on data values */}
        <Box
          sx={{
            position: 'absolute',
            top: `${labelY}px`,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '13px',
            fontWeight: 'bold',
            color: color,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          var = {sign}{formatCurrency(Math.abs(variance))}
        </Box>
      </Box>
    );
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Budget vs Actuals + Forecast
      </Typography>
      <Grid container spacing={3}>
        {/* Total Chart */}
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle1" align="center" sx={{ mb: 2, fontWeight: 'bold' }}>
            Total
          </Typography>
          {renderChart(totalData, totalBudget, totalCurrentForecast, totalVariance)}
        </Grid>

        {/* Capital Chart */}
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle1" align="center" sx={{ mb: 2, fontWeight: 'bold' }}>
            Capital
          </Typography>
          {renderChart(capitalData, capitalBudget, capitalCurrentForecast, capitalVariance)}
        </Grid>

        {/* Expense Chart */}
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle1" align="center" sx={{ mb: 2, fontWeight: 'bold' }}>
            Expense
          </Typography>
          {renderChart(expenseData, expenseBudget, expenseCurrentForecast, expenseVariance)}
        </Grid>
      </Grid>
    </Paper>
  );
};

export default ChartSection;
