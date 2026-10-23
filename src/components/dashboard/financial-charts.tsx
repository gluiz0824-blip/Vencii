"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  DistributionItem,
  ForecastPoint,
} from "@/repositories/financial-dashboard-server.repository";

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function ForecastChart({ data }: { data: ForecastPoint[] }) {
  const formatted = data.map((item) => ({
    ...item,
    label: format(parseISO(item.periodStart), "dd MMM", { locale: ptBR }),
  }));
  return (
    <div className="h-72 w-full" aria-label="Saídas previstas por semana">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formatted}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
              <stop
                offset="100%"
                stopColor="var(--primary)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            tickFormatter={(value: number) => brl(value)}
            tickLine={false}
            axisLine={false}
            width={76}
            fontSize={11}
          />
          <Tooltip
            formatter={(value) => [brl(Number(value)), "Previsto"]}
            labelFormatter={(label) => `Semana de ${String(label)}`}
          />
          <Area
            type="monotone"
            dataKey="totalCents"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#forecast-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>Saídas previstas por semana</caption>
        <tbody>
          {formatted.map((item) => (
            <tr key={item.periodStart}>
              <th>{item.label}</th>
              <td>{brl(item.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DistributionChart({
  data,
  label,
}: {
  data: DistributionItem[];
  label: string;
}) {
  return (
    <div className="h-64 w-full" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={105}
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <Tooltip formatter={(value) => [brl(Number(value)), "Em aberto"]} />
          <Bar
            dataKey="totalCents"
            fill="var(--primary)"
            radius={[0, 5, 5, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((item) => (
            <tr key={item.label}>
              <th>{item.label}</th>
              <td>{brl(item.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
