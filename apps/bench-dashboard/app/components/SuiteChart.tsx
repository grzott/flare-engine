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
import type { MicrobenchSuite } from '../lib/types';
import { nsToUnit, suiteUnit } from '../lib/units';

type SuiteChartProps = {
  suite: MicrobenchSuite;
};

export function SuiteChart({ suite }: SuiteChartProps) {
  const unit = suiteUnit(suite.results);
  const data = suite.results.map((r) => ({
    name: r.scenario.replace(/^[a-z]+\.\w+\s+/, ''),
    value: Number(nsToUnit(r.medianNs, unit).toFixed(3)),
    fullName: r.scenario,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="name"
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickFormatter={(v) => `${v}`}
          label={{
            value: unit,
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
          formatter={(v) => [`${v} ${unit}`, 'median']}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={d.fullName} fill={i % 2 === 0 ? '#f59e0b' : '#d97706'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
