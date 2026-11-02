import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import AppErrorBoundary from './workspace/AppErrorBoundary.jsx';
import {initializeSupabase} from './supabase.js';
import './styles.css';
const root=createRoot(document.getElementById('root'));
root.render(<main className="center-page"><p role="status">Preparando conexão…</p></main>);
initializeSupabase().catch(()=>false).finally(()=>{
 root.render(<React.StrictMode><AppErrorBoundary><App/></AppErrorBoundary></React.StrictMode>);
});
