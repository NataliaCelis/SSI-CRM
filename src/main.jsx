import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AcceptInvitePage from './pages/AcceptInvitePage';
import { AuthProvider } from './lib/AuthContext';
import './index.css';

// If the URL has a Supabase invite/recovery token, show the set-password page
const hash = window.location.hash;
const isInvite = hash.includes('type=invite') || hash.includes('type=recovery');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      {isInvite ? <AcceptInvitePage /> : <App />}
    </AuthProvider>
  </React.StrictMode>
);
