import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import UploadExcel from './UploadExcel';
import api from '../api/axios';
jest.mock('../api/axios',()=>({__esModule:true,default:{post:jest.fn()}}));
beforeEach(()=>jest.clearAllMocks());
test('checks the workbook before upload and selects the resulting import',async()=>{
  (api.post as jest.Mock).mockResolvedValueOnce({data:{datasetType:'detail',totalRows:26,metadata:{periodLabel:'2026'}}}).mockResolvedValueOnce({data:{importId:'new-import',rows:26,skipped:0}});
  const done=jest.fn().mockResolvedValue(undefined);
  render(<UploadExcel onImported={done}/>);
  fireEvent.click(screen.getByText('Загрузить Excel'));
  await act(async()=>{fireEvent.change(screen.getByLabelText('Файл Excel'),{target:{files:[new File(['test'],'companies.xlsx')]}});});
  expect(screen.getByText('Данные по компаниям')).toBeTruthy();
  expect((screen.getByLabelText('Отчетный период (необязательно)') as HTMLInputElement).value).toBe('2026');
  await act(async()=>{fireEvent.click(screen.getByText('Загрузить данные'));});
  await waitFor(()=>expect(done).toHaveBeenCalledWith('new-import',expect.stringContaining('26 строк')));
  const body=(api.post as jest.Mock).mock.calls[1][1] as FormData;
  expect(body.get('period')).toBe('2026');
});
test('rejects wrong file type before a network request',async()=>{
  render(<UploadExcel/>);fireEvent.click(screen.getByText('Загрузить Excel'));
  await act(async()=>{fireEvent.change(screen.getByLabelText('Файл Excel'),{target:{files:[new File(['test'],'report.pdf')]}});});
  expect(screen.getByText('Выберите файл Excel с расширением .xlsx или .xls.')).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
});
