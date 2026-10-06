import React from 'react';
import { AppBar as MuiAppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AppBar() { const nav=useNavigate(); const loc=useLocation(); const {user,logout}=useAuth(); return <MuiAppBar position="sticky" elevation={1}><Toolbar><Typography variant="h6" fontWeight={800} sx={{cursor:'pointer'}} onClick={()=>nav('/dashboard')}>eFOT</Typography><Box sx={{flex:1}}/><Button color="inherit" onClick={()=>nav('/dashboard')} sx={{opacity:loc.pathname==='/dashboard'?1:.75}}>Аналитика</Button><Button color="inherit" onClick={()=>nav('/profile')} sx={{opacity:loc.pathname==='/profile'?1:.75}}>{user?.username || 'Профиль'}</Button><Button color="inherit" onClick={()=>{logout();nav('/login')}}>Выйти</Button></Toolbar></MuiAppBar>; }
