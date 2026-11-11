import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { AvisosProvider } from './context/AvisosContext.jsx';
import './index.css';
import './styles/tokens.css';
import './styles/app.css';

// Aplica el tema guardado antes de pintar (evita el parpadeo claro → oscuro)
document.documentElement.dataset.theme = localStorage.getItem('tema') || 'light';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AvisosProvider>
          <App />
        </AvisosProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
