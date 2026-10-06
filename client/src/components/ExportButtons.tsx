import React from 'react';
import { Button, Stack } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableViewIcon from '@mui/icons-material/TableView';
import api from '../api/axios';

async function saveBlob(response:any, filename:string) { const url=URL.createObjectURL(response.data); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }
export default function ExportButtons({ ids=[] }: { ids?: string[] }) {
  const all = async () => { const r=await api.get('/pdf/generate',{responseType:'blob'}); await saveBlob(r,'efot-report.pdf'); };
  const excel = async () => { const r=await api.get('/export/excel',{responseType:'blob'}); await saveBlob(r,'efot-report.xlsx'); };
  const selected = async () => { const r=await api.post('/pdf/generate/selected',{ids},{responseType:'blob'}); await saveBlob(r,'efot-selected-report.pdf'); };
  return <Stack direction="row" spacing={1}><Button size="small" variant="outlined" startIcon={<TableViewIcon/>} onClick={excel}>Excel</Button><Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon/>} onClick={all}>PDF: текущий набор</Button><Button size="small" variant="contained" disabled={!ids.length} onClick={selected}>PDF: выбранные ({ids.length})</Button></Stack>;
}
