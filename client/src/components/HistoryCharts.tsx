import React from 'react';
import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
export const metricLabels: Record<string, string> = { organizations: 'Организации', employees: 'Работники', payroll: 'ФОТ', averageSalary: 'Средняя ЗП', taxes: 'Налоги' };
export const formatMetric = (value: any) => value === null || value === undefined ? 'Нет данных' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
export default function HistoryCharts({ data }: { data: any[] }) {
  if (!data.length) return null;
  return <Grid container spacing={2} sx={{ my: 1 }}>{['employees', 'payroll', 'averageSalary', 'taxes'].map(key => <Grid item xs={12} md={6} key={key}>
    <Card><CardContent><Typography fontWeight={800}>{metricLabels[key]} — динамика</Typography><Box sx={{ height: 240 }}><ResponsiveContainer><LineChart data={data} margin={{ top: 15, right: 20, bottom: 25, left: 20 }}>
      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis tickFormatter={v => Number(v).toLocaleString('ru-RU', { notation: 'compact' })} />
      <Tooltip formatter={(v: any) => formatMetric(v)} /><Line type="monotone" dataKey={key} name={metricLabels[key]} stroke="#0b3558" connectNulls={false} dot />
    </LineChart></ResponsiveContainer></Box></CardContent></Card>
  </Grid>)}</Grid>;
}
