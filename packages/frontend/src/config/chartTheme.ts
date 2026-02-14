// Nesma chart theme — use these instead of hardcoded hex arrays
export const CHART_COLORS = {
  primary: '#2E3192',
  secondary: '#80D1E9',
  accent: '#34d399',
  gold: '#f59e0b',
  purple: '#a855f7',
  red: '#ef4444',
  blue: '#3b82f6',
  cyan: '#06b6d4',
} as const;

export const CHART_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.accent,
  CHART_COLORS.gold,
  CHART_COLORS.purple,
  CHART_COLORS.red,
  CHART_COLORS.blue,
  CHART_COLORS.cyan,
];

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'rgba(5, 16, 32, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0.75rem',
    color: '#fff',
  },
  labelStyle: { color: '#9ca3af' },
  itemStyle: { color: '#fff' },
} as const;
