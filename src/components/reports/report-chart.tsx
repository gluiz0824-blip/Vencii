"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ReportDistributionChart({
  data,
  label,
}: {
  data: { label: string; totalCents: number }[];
  label: string;
}) {
  const money = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value / 100);
  return (
    <div className="h-64 w-full" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 8, bottom: 35 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            angle={-25}
            textAnchor="end"
            height={58}
            fontSize={10}
          />
          <YAxis
            tickFormatter={money}
            tickLine={false}
            axisLine={false}
            width={75}
            fontSize={10}
          />
          <Tooltip formatter={(value) => [money(Number(value)), "Valor"]} />
          <Bar
            dataKey="totalCents"
            fill="var(--primary)"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
