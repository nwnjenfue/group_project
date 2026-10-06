import React, { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, TextField, Typography } from '@mui/material';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setError(''); setLoading(true); try { const r = await api.post('/auth/login', { username, password }); login(r.data.user, r.data.token); } catch (err:any) { setError(err.response?.data?.message || 'Не удалось выполнить вход'); } finally { setLoading(false); } };
  return <Box sx={{ minHeight:'100vh', display:'grid', placeItems:'center', p:2 }}><Card sx={{ width:'100%', maxWidth:420, boxShadow:6 }}><CardContent sx={{ p:4 }}><Typography variant="h4" fontWeight={800} color="primary">eFOT</Typography><Typography color="text.secondary" sx={{ mb:3 }}>Финансово-экономический мониторинг</Typography><Box component="form" onSubmit={submit} sx={{ display:'grid', gap:2 }}><TextField label="Логин" value={username} onChange={e=>setUsername(e.target.value)} autoFocus required /><TextField label="Пароль" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />{error && <Alert severity="error">{error}</Alert>}<Button type="submit" variant="contained" size="large" disabled={loading}>{loading ? <CircularProgress size={22} color="inherit"/> : 'Войти'}</Button></Box></CardContent></Card></Box>;
}
