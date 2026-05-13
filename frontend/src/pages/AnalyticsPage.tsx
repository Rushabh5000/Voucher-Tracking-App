import { useEffect, useState } from "react";
import { analyticsApi } from "@/api/client";
import type { AnalyticsData } from "@/types";
import { useUIStore } from "@/store/uiStore";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

const PIE_COLORS = ["#1A6B4A", "#888787", "#E8A918"];
const DARK_PIE   = ["#2FAF6A", "#6B6B6B", "#D4A020"];

export function AnalyticsPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useUIStore();

  const isDark     = theme === "dark";
  const axisColor  = isDark ? "#6B7280" : "#9CA3AF";
  const gridColor  = isDark ? "#1F2937" : "#F3F4F6";
  const pieColors  = isDark ? DARK_PIE : PIE_COLORS;

  useEffect(() => {
    analyticsApi.get().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return null;

  const { summary, brandBreakdown, monthlyTrend, statusPie } = data;

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total vouchers", value: summary.total },
          { label: "Unredeemed",     value: summary.unredeemed, color: "text-accent-600 dark:text-accent-400" },
          { label: "Redeemed",       value: summary.redeemed,   color: "text-gray-400" },
          { label: "Expired",        value: summary.expired,    color: "text-amber-600 dark:text-amber-400" },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color || "text-gray-900 dark:text-gray-100"}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Pie + Bar status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Status distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusPie} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={12}>
                {statusPie.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: isDark ? "#111827" : "#fff", border: "none", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Expiry alerts</h3>
          <div className="space-y-4 pt-2">
            {[
              { label: "Expiring in 7 days",  value: data.expiringIn7Days,  color: "bg-red-500"    },
              { label: "Expiring in 30 days", value: data.expiringIn30Days, color: "bg-amber-400"  },
              { label: "Already expired",     value: summary.expired,       color: "bg-gray-400"   },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{item.value}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all`}
                    style={{ width: `${summary.total ? Math.min((item.value / summary.total) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Monthly trend — last 12 months</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: isDark ? "#111827" : "#fff", border: "none", borderRadius: 8, fontSize: 12 }} />
            <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="added"    stroke="#1A6B4A" strokeWidth={2} dot={{ r: 3 }} name="Added" />
            <Line type="monotone" dataKey="redeemed" stroke="#E8A918" strokeWidth={2} dot={{ r: 3 }} name="Redeemed" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Brand breakdown bar chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Brand-wise voucher count</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={brandBreakdown.slice(0, 12)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="brand" tick={{ fill: axisColor, fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: isDark ? "#111827" : "#fff", border: "none", borderRadius: 8, fontSize: 12 }} />
            <Legend iconSize={10} iconType="square" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="unredeemed" fill="#1A6B4A" name="Unredeemed" radius={[3,3,0,0]} />
            <Bar dataKey="redeemed"   fill="#9CA3AF" name="Redeemed"   radius={[3,3,0,0]} />
            <Bar dataKey="expired"    fill="#E8A918" name="Expired"    radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Brand table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Brand breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Brand</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Total</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Unredeemed</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Redeemed</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Expired</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {brandBreakdown.map(b => (
                <tr key={b.brand} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{b.brand}</td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{b.total}</td>
                  <td className="px-4 py-3 text-center text-accent-600 dark:text-accent-400 font-medium">{b.unredeemed}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{b.redeemed}</td>
                  <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">{b.expired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
