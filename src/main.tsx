import { BRAND } from '../shared/brand';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { startUpdates } from './lib/updates';
import { captureInstallation } from './lib/install';
import { startAudioLifecycle } from './lib/audio';
import App from './App';
import './styles.css';
import './game.css';
document.title = `${BRAND.name} · ${BRAND.edition}`;
document.querySelector('meta[name="description"]')?.setAttribute('content', BRAND.slogan);
const client = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 2000 } },
});
startUpdates();
captureInstallation();
startAudioLifecycle();
const router = createBrowserRouter([{ path: '*', element: <App /> }]);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
