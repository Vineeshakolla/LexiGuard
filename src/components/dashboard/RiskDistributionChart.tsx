import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { CategorySummary, OverallAssessment } from '../../types/legal';
import { PieChart as PieIcon, BarChart3 } from 'lucide-react';

interface RiskDistributionChartProps {
  assessment: OverallAssessment;
  categorySummaries?: CategorySummary[];
}

export const RiskDistributionChart: React.FC<RiskDistributionChartProps> = ({
  assessment,
  categorySummaries = [],
}) => {
  const { highRiskCount, mediumRiskCount, lowRiskCount, totalClauses } = assessment;

  // Donut chart data
  const donutData = [
    {
      name: 'High & Critical Risk',
      value: highRiskCount,
      color: '#EF4444',
      percentage: totalClauses > 0 ? Math.round((highRiskCount / totalClauses) * 100) : 0,
    },
    {
      name: 'Moderate Risk',
      value: mediumRiskCount,
      color: '#F59E0B',
      percentage: totalClauses > 0 ? Math.round((mediumRiskCount / totalClauses) * 100) : 0,
    },
    {
      name: 'Low Risk',
      value: lowRiskCount,
      color: '#14B8A6',
      percentage: totalClauses > 0 ? Math.round((lowRiskCount / totalClauses) * 100) : 0,
    },
  ].filter(d => d.value > 0);

  // If no data, provide standard representation
  const displayDonutData = donutData.length > 0 ? donutData : [
    { name: 'Standard Terms', value: 1, color: '#14B8A6', percentage: 100 }
  ];

  // Horizontal bar chart data: filter categories that have count > 0 or top 6
  const barData = categorySummaries
    .filter(cat => cat.count > 0)
    .map(cat => ({
      name: cat.category.length > 24 ? cat.category.slice(0, 22) + '...' : cat.category,
      fullName: cat.category,
      count: cat.count,
      high: cat.highCount,
      moderate: cat.moderateCount,
      low: cat.lowCount,
      avgRisk: cat.averageRisk,
    }))
    .slice(0, 7);

  // Custom Tooltip for Donut
  const CustomDonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#10213A] text-white p-3 rounded-xl shadow-lg border border-slate-700 text-xs">
          <p className="font-bold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: data.color }} />
            {data.name}
          </p>
          <p className="mt-1 text-slate-300">
            Clauses: <span className="font-semibold text-white">{data.value}</span> ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#10213A] text-white p-3 rounded-xl shadow-lg border border-slate-700 text-xs max-w-xs">
          <p className="font-bold text-white mb-1">{data.fullName}</p>
          <div className="space-y-0.5 text-slate-300">
            <p>Total Flagged: <span className="font-bold text-white">{data.count}</span></p>
            {data.high > 0 && <p className="text-red-400">High Risk: {data.high}</p>}
            {data.moderate > 0 && <p className="text-amber-400">Moderate: {data.moderate}</p>}
            {data.low > 0 && <p className="text-teal-400">Low Risk: {data.low}</p>}
            <p className="pt-1 text-[11px] text-slate-400">Average Risk Score: {data.avgRisk}/100</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Legal Risk Distribution (Interactive Donut Chart) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#14B8A6] flex items-center justify-center border border-teal-100">
              <PieIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#10213A]">Legal Risk Distribution</h3>
              <p className="text-xs text-[#64748B]">Breakdown of analyzed clauses by risk severity</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-[#172F50]">
            {totalClauses} Total
          </span>
        </div>

        <div className="flex-1 min-h-[260px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={displayDonutData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
              >
                {displayDonutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomDonutTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value, entry: any) => (
                  <span className="text-xs text-[#18283F] font-medium ml-1">
                    {value} ({entry.payload.percentage}%)
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Risk Counts by Category (Horizontal Bar Chart) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#172F50] flex items-center justify-center border border-indigo-100">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#10213A]">Risk Counts by Category</h3>
              <p className="text-xs text-[#64748B]">Clause prevalence across legal domains</p>
            </div>
          </div>
          <span className="text-xs text-[#64748B]">Clauses</span>
        </div>

        <div className="flex-1 min-h-[260px]">
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                layout="vertical"
                data={barData}
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" allowDecimals={false} stroke="#94A3B8" fontSize={11} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={130}
                  tick={{ fontSize: 11, fill: '#172F50' }}
                  stroke="#94A3B8"
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="count" fill="#172F50" radius={[0, 6, 6, 0]} name="Clause Count" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-[#64748B]">
              No flagged clauses detected in specific categories.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
