import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fintechPalette } from '../../theme/designTokens.js'

export default function CreditWellnessChart({ chartData }) {
  if (!chartData?.length || chartData.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        More history will appear as your score updates.
      </p>
    )
  }

  return (
    <div className="h-48 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="wellnessFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fintechPalette.orange.main} stopOpacity={0.35} />
              <stop offset="100%" stopColor={fintechPalette.orange.main} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="score"
            stroke={fintechPalette.crimson.main}
            fill="url(#wellnessFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
