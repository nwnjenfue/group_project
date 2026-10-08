import React, { useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Tooltip, Typography } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableViewIcon from '@mui/icons-material/TableView';
import { downloadReport, errorMessage } from '../utils/download';

export default function ExportButtons({ ids=[], importId, filters={}, total=0 }: { ids?: string[]; importId?: string; filters?: Record<string,string>; total?: number }) {
  const [busy,setBusy]=useState(''); const lock=useRef(false);
  const [message,setMessage]=useState(''); const [error,setError]=useState('');
  const save=async(kind:'pdf'|'excel'|'selected')=>{
    if(!importId||lock.current)return;
    lock.current=true;setBusy(kind);setError('');setMessage('');
    try{await downloadReport(kind,importId,ids,filters);setMessage('Файл передан браузеру для скачивания. Найдите его в папке «Загрузки».');}
    catch(e){setError(await errorMessage(e,'Не удалось сформировать отчет. Попробуйте ещё раз.'));}
    finally{lock.current=false;setBusy('');}
  };
  return <Box><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
    <Tooltip title={importId?'Все строки с учетом поиска и фильтров':'Сначала выберите или загрузите данные'}><span><Button variant="contained" disabled={!importId||!total||!!busy} startIcon={busy==='pdf'?<CircularProgress size={18} color="inherit"/>:<PictureAsPdfIcon/>} onClick={()=>save('pdf')}>{busy==='pdf'?'Готовим PDF…':'Скачать PDF'}</Button></span></Tooltip>
    <Button variant="outlined" disabled={!importId||!ids.length||!!busy} startIcon={busy==='selected'?<CircularProgress size={18}/>:<PictureAsPdfIcon/>} onClick={()=>save('selected')}>{busy==='selected'?'Готовим PDF…':`PDF выбранных (${ids.length})`}</Button>
    <Button variant="text" disabled={!importId||!total||!!busy} startIcon={busy==='excel'?<CircularProgress size={18}/>:<TableViewIcon/>} onClick={()=>save('excel')}>Скачать Excel</Button>
  </Stack><Typography variant="caption" color="text.secondary">PDF включает все найденные строки, а не только текущую страницу. Для отдельных записей отметьте строки в таблице.</Typography>
  {error&&<Alert severity="error" sx={{mt:1}} onClose={()=>setError('')}>{error}</Alert>}
  {message&&<Alert severity="success" sx={{mt:1}} onClose={()=>setMessage('')}>{message}</Alert>}
  </Box>;
}
