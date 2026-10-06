import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import AppBar from './components/AppBar';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const theme = createTheme({ palette: { mode: 'light', primary: { main: '#0b3558' }, secondary: { main: '#0aa6a6' }, background: { default: '#f4f7fa' } }, typography: { fontFamily: 'Inter, Arial, sans-serif' }, shape: { borderRadius: 10 } });

function PrivateLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <><AppBar /><Routes><Route path="/dashboard" element={<Dashboard />} /><Route path="/profile" element={<Profile />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Routes><Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} /><Route path="/*" element={<PrivateLayout />} /></Routes>;
}

export default function App() { return <BrowserRouter><ThemeProvider theme={theme}><CssBaseline /><AuthProvider><AppRoutes /></AuthProvider></ThemeProvider></BrowserRouter>; }
