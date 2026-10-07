import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import api from '../api/axios';

jest.mock('../api/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('./DataCharts', () => () => null);
jest.mock('./HistoryCharts', () => ({
  __esModule: true, default: () => null,
  metricLabels: { organizations: 'Организации', payroll: 'ФОТ' },
  formatMetric: (v: any) => v == null ? 'Нет данных' : String(v),
}));
jest.mock('./DataTable', () => (props: any) => <div>
  <div data-testid="active-import">{props.importId}</div>
  <button onClick={() => props.onImported('detail2', 'Загружено 26 строк')}>Загрузить второй файл</button>
</div>);

test('shows detail-only imports and switches to the uploaded dataset even when the old one remains', async () => {
  let periodRequests = 0;
  (api.get as jest.Mock).mockImplementation(async (url: string) => {
    if (url === '/analytics/periods') {
      periodRequests++;
      const p = { label: 'Период не указан', granularity: 'unknown', territory: null, datasetType: 'detail', createdAt: '2026-10-07T10:00:00Z', rows: 26 };
      return { data: periodRequests === 1 ? [{ ...p, id: 'detail1' }] : [{ ...p, id: 'detail1' }, { ...p, id: 'detail2' }] };
    }
    if (url === '/analytics/overview') return { data: { metrics: { organizations: 26, payroll: 1000 }, topActivities: [] } };
    return { data: { data: [], comparison: null } };
  });
  await act(async () => { render(<Dashboard />); });
  await waitFor(() => expect(screen.getByTestId('active-import').textContent).toBe('detail1'));
  await act(async () => { fireEvent.click(screen.getByText('Загрузить второй файл')); });
  await waitFor(() => expect(screen.getByTestId('active-import').textContent).toBe('detail2'));
  expect(screen.getByText('Загружено 26 строк')).toBeTruthy();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/analytics/overview', { params: { importId: 'detail2', compareImportId: undefined } }));
});
