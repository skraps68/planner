import React from 'react';
import { Paper, Typography, Grid, Box } from '@mui/material';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, LabelList } from 'recharts';
import { FinancialTableData } from '../../utils/forecastTransform';
import { formatCurrency } from '../../utils/currencyFormat';

// Bar fills mirror the FinancialSummaryTable's Budget and Current Forecast column
// backgrounds so the chart and table read as the same data. The Current Forecast
// bar is one color; its Actuals/Forecast split is shown by the segment divider
// line and the "A" / "F" letters, not by different fills. Strokes are a darker
// shade of the same hue so the pale fills stay visible on white.
const BUDGET_FILL = '#BBDEFB';            // table Budget column
const BUDGET_STROKE = '#1976d2';
const CURRENT_FORECAST_FILL = '#C8E6C9';  // table Current Forecast column
const CURRENT_FORECAST_STROKE = '#388e3c';

// Variance band (the area between the budget and current-forecast lines).
// Under budget (good) shades pale green; over budget (bad) shades pale red,
// echoing the success/error hues used elsewhere in the app.
const VARIANCE_GOOD_FILL = '#E8F5E9';
const VARIANCE_GOOD_HATCH = '#2e7d32';
const VARIANCE_BAD_FILL = '#FFEBEE';
const VARIANCE_BAD_HATCH = '#d32f2f';

interface ChartSectionProps {
  data?: FinancialTableData | null;
  /** Compact mode: smaller charts, tighter margins and fonts — for embedding in the financials panel */
  compact?: boolean;
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
const ChartSection: React.FC<ChartSectionProps> = ({ data, compact = false }) => {
  // Unique prefix so the SVG hatch pattern ids don't collide when several
  // chart sections are mounted at once
  const hatchIdBase = React.useId();

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

  // Three x-axis categories: Budget | spacer | Current Forecast. Each outer
  // category holds exactly ONE bar position, so the column (and the stacked
  // column) sit dead-center over their tick labels; the empty middle band
  // reserves room for the floating variance label between the columns.
  // "base" carries Budget (left) or Actuals (right); "top" carries Forecast.
  const mkChartRows = (budget: number, actuals: number, forecast: number) => [
    { name: 'Budget', base: budget, top: 0 },
    { name: ' ', base: 0, top: 0 },
    { name: 'Current Forecast', base: actuals, top: forecast },
  ];

  const capitalData = mkChartRows(
    capitalBudget,
    parseFloat(data.actuals.capital.toString()),
    parseFloat(data.forecast.capital.toString())
  );
  const expenseData = mkChartRows(
    expenseBudget,
    parseFloat(data.actuals.expense.toString()),
    parseFloat(data.forecast.expense.toString())
  );
  const totalData = mkChartRows(
    totalBudget,
    parseFloat(data.actuals.total.toString()),
    parseFloat(data.forecast.total.toString())
  );

  // Custom tooltip formatter. Text uses the stroke shades (not the pale bar
  // fills) so it stays readable on the white tooltip background.
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload;
    if (row.name === 'Budget') {
      return (
        <Paper sx={{ p: 1.5, border: '1px solid #ccc' }}>
          <Typography variant="body2" sx={{ color: BUDGET_STROKE }}>
            Budget: {formatCurrency(row.base)}
          </Typography>
        </Paper>
      );
    }
    if (row.name === 'Current Forecast') {
      return (
        <Paper sx={{ p: 1.5, border: '1px solid #ccc' }}>
          <Typography variant="body2" sx={{ color: CURRENT_FORECAST_STROKE }}>
            Actuals: {formatCurrency(row.base)}
          </Typography>
          <Typography variant="body2" sx={{ color: CURRENT_FORECAST_STROKE }}>
            Forecast: {formatCurrency(row.top)}
          </Typography>
        </Paper>
      );
    }
    return null; // spacer band
  };

  // Hover highlight for the tooltip: skip the empty spacer band in the middle
  // (its tooltip is empty too, so a grey wash there is just noise)
  const BandCursor = (props: any) => {
    const name = props?.payload?.[0]?.payload?.name;
    if (!name || name.trim() === '') return null;
    const { x, y, width, height } = props;
    return <rect x={x} y={y} width={width} height={height} fill="rgba(0, 0, 0, 0.06)" />;
  };

  // Letter marker ("A" for Actuals, "F" for Forecast) centered in a stacked-bar
  // segment; skipped when the segment is too short to fit it.
  const renderSegmentLetter = (letter: string) => (props: any) => {
    const { x, y, width, height, value, index } = props;
    const minHeight = compact ? 11 : 15;
    // Letters belong to the Current Forecast stack only (category index 2)
    if (index !== 2 || !value || !height || height < minHeight) return null;
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={CURRENT_FORECAST_STROKE}
        fontSize={compact ? 10 : 13}
        fontWeight="bold"
      >
        {letter}
      </text>
    );
  };

  // Helper to render a chart with variance visualization
  const renderChart = (
    chartData: any[],
    budget: number,
    currentForecast: number,
    variance: number,
    patternKey: string
  ) => {
    // When over budget (variance >= 0), show negative sign (bad)
    // When under budget (variance < 0), show positive sign (good)
    const sign = variance >= 0 ? '-' : '+';
    const color = variance >= 0 ? VARIANCE_BAD_HATCH : VARIANCE_GOOD_HATCH;

    // Variance band between the budget and current-forecast levels: light shade
    // + faint 45° cross-hatch, green when under budget and red when over
    const bandFill = variance >= 0 ? VARIANCE_BAD_FILL : VARIANCE_GOOD_FILL;
    const bandHatch = variance >= 0 ? VARIANCE_BAD_HATCH : VARIANCE_GOOD_HATCH;
    const bandLow = Math.min(budget, currentForecast);
    const bandHigh = Math.max(budget, currentForecast);
    const hatchId = `${hatchIdBase}-${patternKey}`;
    
    // Calculate the position of the variance label based on data values
    // Chart area = height minus top/bottom margins; label Y math below depends on these
    const chartHeight = compact ? 170 : 300;
    const topMargin = compact ? 12 : 20;
    const bottomMargin = compact ? 0 : 5;
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
    
    // Check if there's enough space between lines
    const gap = Math.abs(budgetY - forecastY);
    const minGap = compact ? 28 : 40;

    // If gap is too small, position above the higher line (lower Y value)
    const labelY = gap >= minGap ? midpointY : Math.min(budgetY, forecastY) - (compact ? 14 : 20);

    return (
      <Box sx={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            margin={
              compact
                ? { top: topMargin, right: 8, left: 0, bottom: bottomMargin }
                : { top: topMargin, right: 30, left: 20, bottom: bottomMargin }
            }
          >
            <defs>
              {/* Cross-hatch: pale base + faint 45° lines in the variance hue */}
              <pattern
                id={hatchId}
                patternUnits="userSpaceOnUse"
                width={6}
                height={6}
                patternTransform="rotate(45)"
              >
                <rect width={6} height={6} fill={bandFill} fillOpacity={0.55} />
                <line x1={0} y1={0} x2={0} y2={6} stroke={bandHatch} strokeWidth={1} strokeOpacity={0.25} />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            {/* Shaded variance band, drawn behind the bars */}
            {bandHigh > bandLow && (
              <ReferenceArea
                y1={bandLow}
                y2={bandHigh}
                fill={`url(#${hatchId})`}
                fillOpacity={1}
                stroke="none"
              />
            )}
            <XAxis
              dataKey="name"
              tickLine={false}
              // Category labels take over the removed legend's colors:
              // blue for Budget, green for Current Forecast
              tick={(props: any) => {
                const { x, y, payload } = props;
                const isBudget = payload.value === 'Budget';
                if (!payload.value.trim()) return <g />; // spacer band: no label
                return (
                  <text
                    x={x}
                    y={y + (compact ? 10 : 12)}
                    textAnchor="middle"
                    fontSize={compact ? 10 : 12}
                    fontWeight={700}
                    fill={isBudget ? BUDGET_STROKE : CURRENT_FORECAST_STROKE}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <YAxis
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: compact ? 10 : 12 }}
              width={compact ? 36 : 60}
            />
            <Tooltip content={<CustomTooltip />} cursor={<BandCursor />} />
            {/* One stacked series in one slot per category, so each column is
                centered under its tick. Per-category Cells recolor: the left
                category renders as the Budget column, the right as the
                Actuals+Forecast stack (segment strokes draw the divider;
                "A"/"F" mark the portions). */}
            <Bar dataKey="base" stackId="a" maxBarSize={compact ? 40 : 76} strokeWidth={1}>
              {chartData.map((_, i) => (
                <Cell
                  key={`base-${i}`}
                  fill={i === 0 ? BUDGET_FILL : CURRENT_FORECAST_FILL}
                  stroke={i === 0 ? BUDGET_STROKE : CURRENT_FORECAST_STROKE}
                />
              ))}
              <LabelList dataKey="base" content={renderSegmentLetter('A')} />
            </Bar>
            <Bar dataKey="top" stackId="a" maxBarSize={compact ? 40 : 76} strokeWidth={1}>
              {chartData.map((_, i) => (
                <Cell
                  key={`top-${i}`}
                  fill={CURRENT_FORECAST_FILL}
                  stroke={CURRENT_FORECAST_STROKE}
                />
              ))}
              <LabelList dataKey="top" content={renderSegmentLetter('F')} />
            </Bar>
            {/* Dashed line at budget level */}
            <ReferenceLine
              y={budget}
              stroke={BUDGET_STROKE}
              strokeDasharray="5 5"
              strokeWidth={1.5}
            />
            {/* Dashed line at current forecast level */}
            <ReferenceLine
              y={currentForecast}
              stroke={CURRENT_FORECAST_STROKE}
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
            padding: compact ? '2px 6px' : '4px 8px',
            fontSize: compact ? '11px' : '13px',
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

  const charts = (
    <Grid container spacing={compact ? 1 : 3}>
      {/* Total Chart */}
      <Grid item xs={12} md={4}>
        <Typography
          variant={compact ? 'caption' : 'subtitle1'}
          component="div"
          align="center"
          sx={{ mb: compact ? 0.5 : 2, fontWeight: 'bold' }}
        >
          Total
        </Typography>
        {renderChart(totalData, totalBudget, totalCurrentForecast, totalVariance, 'total')}
      </Grid>

      {/* Capital Chart */}
      <Grid item xs={12} md={4}>
        <Typography
          variant={compact ? 'caption' : 'subtitle1'}
          component="div"
          align="center"
          sx={{ mb: compact ? 0.5 : 2, fontWeight: 'bold' }}
        >
          Capital
        </Typography>
        {renderChart(capitalData, capitalBudget, capitalCurrentForecast, capitalVariance, 'capital')}
      </Grid>

      {/* Expense Chart */}
      <Grid item xs={12} md={4}>
        <Typography
          variant={compact ? 'caption' : 'subtitle1'}
          component="div"
          align="center"
          sx={{ mb: compact ? 0.5 : 2, fontWeight: 'bold' }}
        >
          Expense
        </Typography>
        {renderChart(expenseData, expenseBudget, expenseCurrentForecast, expenseVariance, 'expense')}
      </Grid>
    </Grid>
  );

  // Compact mode: no Paper wrapper or section title — embedded below the financials table
  if (compact) {
    return <Box sx={{ mt: 1.5 }}>{charts}</Box>;
  }

  return (
    <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Budget vs Current Forecast
      </Typography>
      {charts}
    </Paper>
  );
};

export default ChartSection;
