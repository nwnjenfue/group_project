import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ExportButtons from './ExportButtons';
import { downloadReport } from '../utils/download';
jest.mock('../utils/download',()=>({downloadReport:jest.fn(),errorMessage:async()=> 'Отчет недоступен'}));
test('blocks exports without a dataset and shows server errors after a click',async()=>{
  const {rerender}=render(<ExportButtons/>);
  expect((screen.getByText('Скачать PDF').closest('button') as HTMLButtonElement).disabled).toBe(true);
  rerender(<ExportButtons importId="selected" total={26} filters={{q:'company'}}/>);
  (downloadReport as jest.Mock).mockRejectedValueOnce(new Error('failed'));
  await act(async()=>{fireEvent.click(screen.getByText('Скачать PDF'));});
  expect(downloadReport).toHaveBeenCalledWith('pdf','selected',[],{q:'company'});
  expect(screen.getByText('Отчет недоступен')).toBeTruthy();
  expect((screen.getByText('Скачать PDF').closest('button') as HTMLButtonElement).disabled).toBe(false);
});
