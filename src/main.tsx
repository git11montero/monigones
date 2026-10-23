import { BRAND } from '../shared/brand';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';
import './game.css';
document.title = `${BRAND.name} · ${BRAND.edition}`;
document.querySelector('meta[name="description"]')?.setAttribute('content', BRAND.slogan);
const client = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 2000 } },
});
registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('crown:update'));
  },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
