import React, { useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import api from '../api/axios';
import { errorMessage } from '../utils/download';

export default function UploadExcel({onImported}:{onImported?:(id?:string,message?:string)=>Promise<void>}) {
  const [open,setOpen]=useState(false);const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<any>(null);const [period,setPeriod]=useState('');const [territory,setTerritory]=useState('');
  const [busy,setBusy]=useState<'analyze'|'upload'|''>('');const [progress,setProgress]=useState(0);const [error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null);const lock=useRef(false);
  const choose=async(candidate:File)=>{
    if(lock.current)return;
    setError('');setPreview(null);setFile(null);
    if(!/\.(xlsx|xls)$/i.test(candidate.name)){setError('Выберите файл Excel с расширением .xlsx или .xls.');return;}
    if(candidate.size>25*1024*1024){setError('Файл слишком большой. Максимальный размер — 25 МБ.');return;}
    if(!candidate.size){setError('Файл пустой. Выберите таблицу с данными.');return;}
    lock.current=true;setFile(candidate);setBusy('analyze');
    try{
      const fd=new FormData();fd.append('file',candidate);
      const {data}=await api.post('/import/analyze',fd,{timeout:120000});
      setPreview(data);setPeriod(data.metadata?.periodLabel||'');setTerritory(data.metadata?.territory||'');
    }catch(e){setError(await errorMessage(e,'Не удалось прочитать Excel. Проверьте структуру файла.'));}
    finally{lock.current=false;setBusy('');}
  };
  const upload=async()=>{
    if(!file||!preview||lock.current)return;
    lock.current=true;setBusy('upload');setProgress(0);setError('');
    try{
      const fd=new FormData();fd.append('file',file);if(period.trim())fd.append('period',period.trim());if(territory.trim())fd.append('territory',territory.trim());
      const {data}=await api.post('/import/auto',fd,{timeout:120000,onUploadProgress:event=>setProgress(event.total?Math.round(event.loaded/event.total*100):0)});
      const message=`Файл «${file.name}» загружен: ${data.rows} строк. Пропущено при проверке: ${data.skipped||0}.`;
      setOpen(false);setFile(null);setPreview(null);
      await onImported?.(data.importId,message);
    }catch(e){setError(await errorMessage(e,'Загрузка не завершена. Проверьте файл и повторите попытку.'));}
    finally{lock.current=false;setBusy('');}
  };
  return <>
    <Button variant="contained" startIcon={<UploadFileIcon/>} onClick={()=>{setError('');setFile(null);setPreview(null);setPeriod('');setTerritory('');setOpen(true);}}>Загрузить Excel</Button>
    <Dialog open={open} onClose={()=>!busy&&setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="upload-title">
      <DialogTitle id="upload-title">Добавить данные из Excel</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{mb:2}}>Выберите таблицу. Мы проверим её структуру перед сохранением.</Typography>
        <Box sx={{p:3,border:'2px dashed',borderColor:preview?'success.light':'divider',borderRadius:3,textAlign:'center',bgcolor:'#f7fafc'}}>
          {preview?<CheckCircleOutlineIcon color="success" sx={{fontSize:36}}/>:<UploadFileIcon color="primary" sx={{fontSize:36}}/>}
          <Typography fontWeight={700} sx={{my:1,overflowWrap:'anywhere'}}>{file?.name||'Таблица с компаниями или сводными показателями'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{mb:2}}>{file?`${(file.size/1024).toFixed(0)} КБ`:'XLSX или XLS · до 25 МБ'}</Typography>
          <Button autoFocus variant="outlined" disabled={!!busy} onClick={()=>input.current?.click()}>{file?'Выбрать другой файл':'Выбрать файл'}</Button>
          <input ref={input} hidden type="file" accept=".xlsx,.xls" aria-label="Файл Excel" onChange={e=>{const f=e.target.files?.[0];e.currentTarget.value='';if(f)void choose(f);}}/>
        </Box>
        {busy&&<Box role="status" aria-live="polite" sx={{mt:2}}><LinearProgress variant={busy==='upload'&&progress<100?'determinate':'indeterminate'} value={progress}/><Typography variant="body2" sx={{mt:1}}>{busy==='analyze'?'Проверяем структуру файла…':progress<100?`Передаём файл: ${progress}%`:'Сохраняем и проверяем строки. Не закрывайте окно…'}</Typography></Box>}
        {error&&<Alert severity="error" sx={{mt:2}}>{error}</Alert>}
        {preview&&<><Stack direction="row" spacing={1} sx={{my:2}}><Chip color="success" variant="outlined" label={preview.datasetType==='detail'?'Данные по компаниям':'Сводные показатели'}/><Chip label={`Строк в файле: ${preview.totalRows}`}/></Stack>
          <TextField fullWidth label="Отчетный период (необязательно)" value={period} disabled={!!busy} onChange={e=>setPeriod(e.target.value)} helperText="Например: 2026, 2026-03 или 2026, 1 квартал. Без периода данные тоже будут доступны." sx={{mb:2}}/>
          <TextField fullWidth label="Регион или территория (необязательно)" value={territory} disabled={!!busy} onChange={e=>setTerritory(e.target.value)} sx={{mb:2}}/>
          <Alert severity="info">Если этот период и регион уже загружены, новый файл станет актуальной версией. Предыдущая версия сохранится в базе.</Alert>
        </>}
      </DialogContent>
      <DialogActions sx={{px:3,pb:3}}><Button disabled={!!busy} onClick={()=>setOpen(false)}>Отмена</Button><Button variant="contained" disabled={!preview||!!busy} startIcon={busy==='upload'?<CircularProgress color="inherit" size={18}/>:<UploadFileIcon/>} onClick={upload}>{busy==='upload'?'Загрузка…':'Загрузить данные'}</Button></DialogActions>
    </Dialog>
  </>;
}
