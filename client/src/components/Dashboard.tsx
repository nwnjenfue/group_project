import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import DataTable, { DataRow } from './DataTable';
import DataCharts from './DataCharts';
import HistoryCharts, { formatMetric, metricLabels } from './HistoryCharts';
import api from '../api/axios';

interface Period { id: string; label: string; territory: string | null; granularity: string; createdAt: string; datasetType: string; filename: string; rows: number; }
export default function Dashboard() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [importId, setImportId] = useState('');
  const [compareId, setCompareId] = useState('');
  const [granularity, setGranularity] = useState('all');
  const [metrics, setMetrics] = useState<any>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [scenarioData, setScenarioData] = useState<any[] | null>(null);
  const [chartRows, setChartRows] = useState<DataRow[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [error, setError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(async (uploadedId?: string, message?: string) => {
    try {
      const r = await api.get('/analytics/periods');
      setPeriods(r.data); setGranularity('all');
      setImportId(old => r.data.some((p: Period) => p.id === uploadedId) ? uploadedId! : r.data.some((p: Period) => p.id === old) ? old : r.data[0]?.id || '');
      if (message) setImportMessage(message);
      setCompareId(''); setRevision(v => v + 1);
    } catch (e: any) { setError(e.response?.data?.message || 'Не удалось загрузить периоды'); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!importId) return;
    let active = true;
    setLoading(true); setError(''); setScenarioData(null);
    const params = { importId, compareImportId: compareId || undefined };
    Promise.all([api.get('/analytics/overview', { params }), api.get('/analytics/history', { params }), api.get('/analytics/alerts', { params })])
      .then(([o, h, a]) => {
        if (!active) return;
        setMetrics(o.data.metrics || {}); setHistory(h.data.data || []); setComparison(h.data.comparison); setAlerts(a.data.data || []);
        setChartRows((o.data.topActivities || []).map((r: any, i: number) => ({ id: String(i), код_окэд: r.oked, вид_деятельности: r.activity,
          средняя_численность_работников: Number(r.employees || 0), 'Сумма по полю ФОТ': Number(r.payroll || 0), Сумма_по_полю_ср_зп: Number(r.average_salary || 0), сумма_налогов: Number(r.taxes || 0), удельный_вес: 0 })));
      }).catch(e => { if (active) { setError(e.response?.data?.message || 'Ошибка аналитики'); setMetrics({}); setHistory([]); setComparison(null); setAlerts([]); setChartRows([]); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [importId, compareId, revision]);
  const selected = periods.find(p => p.id === importId);
  const options = periods.filter(p => granularity === 'all' || p.granularity === granularity);
  const comparable = periods.filter(p => p.id !== importId && p.datasetType === selected?.datasetType && selected?.granularity !== 'unknown' && p.granularity === selected?.granularity && p.territory === selected?.territory);
  const runScenario = async (scenario: string) => {
    try { const r = await api.get('/analytics/scenarios', { params: { scenario, importId } }); setScenarioData(r.data.data || []); }
    catch (e: any) { setError(e.response?.data?.message || 'Ошибка сценария'); }
  };
  return <Box sx={{ p: { xs: 1, md: 2 } }}>
    <Typography variant="h4" fontWeight={900}>Панель eFOT</Typography>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ my: 2 }}>
      <TextField select label="Длительность" value={granularity} sx={{ minWidth: 180 }} onChange={e => {
        const value = e.target.value; setGranularity(value); setCompareId('');
        setImportId(periods.find(p => value === 'all' || p.granularity === value)?.id || '');
      }}>{[['all','Все'],['year','Год'],['quarter','Квартал'],['month','Месяц'],['unknown','Без периода']].map(([v,l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>
      <TextField select label="Период и территория" value={options.some(p => p.id === importId) ? importId : ''} sx={{ minWidth: 290 }} onChange={e => { setImportId(e.target.value); setCompareId(''); }}>
        <MenuItem value="">Нет выбранного набора</MenuItem>{options.map(p => <MenuItem key={p.id} value={p.id}>{p.label} · {p.territory || 'Территория не указана'} · {p.datasetType === 'detail' ? 'Компании' : 'Сводка'} · {p.rows} строк · {new Date(p.createdAt).toLocaleString('ru-RU')}</MenuItem>)}
      </TextField>
      <TextField select label="Сравнить с" value={compareId} sx={{ minWidth: 220 }} onChange={e => setCompareId(e.target.value)}>
        <MenuItem value="">Предыдущий период</MenuItem>{comparable.map(p => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}
      </TextField>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {importMessage && <Alert severity="success" onClose={() => setImportMessage('')}>{importMessage}</Alert>}
    {loading && <Alert severity="info">Загрузка выбранного периода…</Alert>}
    {!importId && <Alert severity="info">Нет наборов выбранной длительности. Загрузите Excel и укажите период.</Alert>}
    {importId && !loading && <>
      {selected?.granularity === 'unknown' && <Alert severity="warning">Период не определён. Исторические сравнения недоступны; загрузите файл повторно с указанием периода.</Alert>}
      <Grid container spacing={2} sx={{ my: 1 }}>{Object.entries(metricLabels).map(([key, label]) => <Grid item xs={12} sm={6} md={2.4} key={key}>
        <Card><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={800}>{formatMetric(metrics[key])}</Typography>
          {comparison && <Typography variant="body2">К {comparison.period}: {formatMetric(comparison.changes[key]?.absolute)} / {formatMetric(comparison.changes[key]?.percent)}{comparison.changes[key]?.percent != null ? '%' : ''}</Typography>}
        </CardContent></Card>
      </Grid>)}</Grid>
      <Typography variant="body2" color="text.secondary">Денежные показатели — ₸. Средняя ЗП: {metrics.salaryMethod === 'payroll_per_employee_month' ? 'ФОТ / человеко-месяцы' : metrics.salaryMethod === 'employee_weighted_source_salary' ? 'средняя исходных зарплат, взвешенная по численности' : 'недостаточно данных'}.</Typography>
      {metrics.warnings?.map((w: string) => <Alert key={w} severity="info" sx={{ mt: 1 }}>{w}</Alert>)}
      <HistoryCharts data={history} />
      <Card sx={{ my: 2 }}><CardContent><Typography fontWeight={900}>Сценарии проверки</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{[['high_payroll','Высокий ФОТ'],['high_salary','Высокая ЗП'],['low_salary','Низкая ЗП'],['low_workforce','Малая численность'],['tax_zero','ФОТ без налогов']].map(([key,label]) => <Button key={key} onClick={() => runScenario(key)}>{label}</Button>)}</Stack>
        {scenarioData && <Box><Typography>Результатов: {scenarioData.length}</Typography>{scenarioData.slice(0,5).map((r,i) => <Typography key={i}>{r.oked} — {r.activity} · ФОТ {formatMetric(r.payroll)}</Typography>)}</Box>}
      </CardContent></Card>
      {alerts.length > 0 && <Card sx={{ mb: 2 }}><CardContent><Chip label={'Сигналы: ' + alerts.length} color="warning" />{alerts.slice(0,6).map((a,i) => <Alert key={i} severity="warning" sx={{ mt: 1 }}>{a.company_name || a.activity}: {a.factors?.join('; ')}</Alert>)}</CardContent></Card>}
      <DataCharts data={chartRows} />
    </>}
    <DataTable key={importId + ':' + revision} importId={importId} datasetType={selected?.datasetType} onImported={refresh} />
  </Box>;
}
