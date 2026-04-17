'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DeviceRun } from '../lib/types';

type DeviceChartProps = {
  run: DeviceRun;
};

export function DeviceChart({ run }: DeviceChartProps) {
  const data = run.loads.map((l) => {
    const avg = l.fps.length > 0 ? l.fps.reduce((a, b) => a + b, 0) / l.fps.length : 0;
    return { name: l.label, fps: Number(avg.toFixed(1)) };
  });

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-200">{run.device}</h2>
        <p className="text-sm text-slate-500">
          {run.os}
          {run.notes ? ` — ${run.notes}` : ''}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            label={{
              value: 'fps',
              angle: -90,
              position: 'insideLeft',
              fill: '#64748b',
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6 }}
            labelStyle={{ color: '#e2e8f0', fontSize: 12 }}
            itemStyle={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 12 }}
            formatter={(v) => [`${v} fps`, 'avg fps']}
          />
          <Bar dataKey="fps" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={i % 2 === 0 ? '#f59e0b' : '#d97706'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
