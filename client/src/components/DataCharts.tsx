import React from 'react';
import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DataRow } from './DataTable';

const fmt=(v:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(v);
export default function DataCharts({data}:{data:DataRow[]}){
  const top=[...data].sort((a,b)=>Number(b['Сумма по полю ФОТ']||0)-Number(a['Сумма по полю ФОТ']||0)).slice(0,10).map(r=>({name:String(r.вид_деятельности||'').slice(0,22),full:r.вид_деятельности,value:Number(r['Сумма по полю ФОТ']||0)}));
  const pie=[...data].sort((a,b)=>Number(b.средняя_численность_работников||0)-Number(a.средняя_численность_работников||0)).slice(0,8).map(r=>({name:String(r.вид_деятельности||'').slice(0,18),value:Number(r.средняя_численность_работников||0)}));
  return <Grid container spacing={2} sx={{mb:2}}><Grid item xs={12} lg={8}><Card><CardContent><Typography fontWeight={800} sx={{mb:1}}>Топ-10 по ФОТ</Typography><Box sx={{height:360}}><ResponsiveContainer><BarChart data={top} margin={{left:20,right:20,bottom:80}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" angle={-35} textAnchor="end" interval={0}/><YAxis tickFormatter={fmt}/><Tooltip formatter={(v:any)=>fmt(Number(v))}/><Bar dataKey="value" fill="#0b3558"/></BarChart></ResponsiveContainer></Box></CardContent></Card></Grid><Grid item xs={12} lg={4}><Card><CardContent><Typography fontWeight={800}>Распределение численности</Typography><Box sx={{height:360}}><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={120} label={({percent})=>`${Math.round(percent*100)}%`}>{pie.map((_,i)=><Cell key={i} fill={['#0b3558','#0aa6a6','#2d6cdf','#7a8ca5','#d97706','#475569','#0891b2','#64748b'][i%8]}/>)}</Pie><Tooltip formatter={(v:any)=>fmt(Number(v))}/><Legend/></PieChart></ResponsiveContainer></Box></CardContent></Card></Grid></Grid>;
}
