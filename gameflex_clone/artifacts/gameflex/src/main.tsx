// @ts-nocheck
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';
import './styles.css';

// Force dark mode globally — GameFlex is dark-only
document.documentElement.classList.add('dark');

const router = getRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
);
