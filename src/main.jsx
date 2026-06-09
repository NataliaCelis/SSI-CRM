import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AcceptInvitePage from './pages/AcceptInvitePage';
import { AuthProvider } from './lib/AuthContext';
import './index.css';

// Catch invite, recovery, magic link, and email confirmation tokens
const hash = window.location.hash;
const params = new URLSearchParams(hash.replace('#', ''));
const tokenType = params.get('type');
const isAuthRedirect = ['invite', 'recovery', 'magiclink', 'email'].includes(tokenType) || hash.includes('access_token');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      {isAuthRedirect ? <AcceptInvitePage /> : <App />}
    </AuthProvider>
  </React.StrictMode>
);
