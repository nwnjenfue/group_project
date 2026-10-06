import React, { useState } from 'react';
import { Alert, Avatar, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Divider, TextField, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import UserManagement from './UserManagement';

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const save = async () => {
    setError('');
    setOk('');
    try {
      await api.post('/auth/profile/password', { currentPassword, newPassword });
      setOk('Пароль изменён');
      setOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Ошибка смены пароля');
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Card sx={{ maxWidth: 1000, mx: 'auto' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 72, height: 72 }}>{user?.username?.[0]?.toUpperCase()}</Avatar>
            <Box>
              <Typography variant="h5" fontWeight={800}>{user?.username}</Typography>
              <Typography color="text.secondary">{user?.email}</Typography>
              <Typography color="text.secondary">Роль: {user?.role === 'admin' ? 'Администратор' : 'Пользователь'}</Typography>
            </Box>
          </Box>
          <Button sx={{ mt: 3 }} variant="contained" onClick={() => setOpen(true)}>Сменить пароль</Button>
          {ok && <Alert sx={{ mt: 2 }} severity="success">{ok}</Alert>}
          {isAdmin && (
            <>
              <Divider sx={{ my: 4 }} />
              <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>Управление пользователями</Typography>
              <UserManagement />
            </>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Смена пароля</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, minWidth: 360, pt: '10px !important' }}>
          <TextField label="Текущий пароль" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          <TextField label="Новый пароль" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} helperText="Минимум 8 символов" />
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={save}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
