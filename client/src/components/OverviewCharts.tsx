import React from 'react';
import { Box, Card, CardContent, Grid, Stack, Tooltip as Hint, Typography } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DataRow } from './DataTable';
const colors=['#145b78','#128a98','#398cc7','#726cad','#d69532','#628369','#63748a','#c66c60'];
const compact=(n:number)=>new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:1}).format(n);
const full=(n:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);
const short=(s:string)=>s.replace(/^(Товарищество с ограниченной ответственностью|Акционерное общество)\s*/i,'').replace(/^"|"$/g,'');
export default function OverviewCharts({data}:{data:DataRow[]}){
  const payroll=[...data].sort((a,b)=>Number(b['Сумма по полю ФОТ'])-Number(a['Сумма по полю ФОТ'])).slice(0,10).map((r,i)=>({id:i,name:short(r.вид_деятельности),value:Number(r['Сумма по полю ФОТ']||0)}));
  const employees=[...data].sort((a,b)=>Number(b.средняя_численность_работников)-Number(a.средняя_численность_работников)).slice(0,8).map(r=>({name:short(r.вид_деятельности),value:Number(r.средняя_численность_работников||0)})).filter(r=>r.value>0);
  return <Grid container spacing={2} sx={{mt:1}}>
    <Grid item xs={12} lg={8}><Card><CardContent><Typography variant="h6" fontWeight={800}>Лидеры по фонду оплаты труда</Typography><Typography variant="body2" color="text.secondary">До 10 записей. Наведите на столбец, чтобы увидеть название и сумму.</Typography>
      <Box sx={{height:420,mt:2}}><ResponsiveContainer><BarChart layout="vertical" data={payroll} margin={{left:0,right:24,top:0,bottom:10}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickFormatter={compact}/><YAxis type="category" dataKey="name" width={135} tick={{fontSize:11}} tickFormatter={name=>String(name).length>19?String(name).slice(0,19)+'…':String(name)} interval={0}/><Tooltip formatter={(v:any)=>[full(Number(v))+' ₸','ФОТ']} contentStyle={{maxWidth:350,whiteSpace:'normal'}}/><Bar dataKey="value" fill="#145b78" radius={[0,5,5,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></Box>
    </CardContent></Card></Grid>
    <Grid item xs={12} lg={4}><Card sx={{height:'100%'}}><CardContent><Typography variant="h6" fontWeight={800}>Численность работников</Typography><Typography variant="body2" color="text.secondary">До 8 записей среди лидеров по ФОТ</Typography>
      <Box sx={{height:200}}><ResponsiveContainer><PieChart><Pie data={employees} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={2} isAnimationActive={false}>{employees.map((_,i)=><Cell key={i} fill={colors[i]}/>)}</Pie><Tooltip formatter={(v:any)=>[full(Number(v)),'Работников']}/></PieChart></ResponsiveContainer></Box>
      <Stack spacing={1}>{employees.map((r,i)=><Hint title={r.name} key={i}><Stack direction="row" alignItems="center" spacing={1}><Box sx={{width:9,height:9,borderRadius:'50%',bgcolor:colors[i],flexShrink:0}}/><Typography variant="body2" noWrap sx={{flex:1,minWidth:0}}>{r.name}</Typography><Typography variant="body2" fontWeight={700}>{full(r.value)}</Typography></Stack></Hint>)}</Stack>
    </CardContent></Card></Grid>
  </Grid>;
}
