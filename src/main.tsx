import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000 } } })

async function bootstrap() {
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledFrame: 'bypass', serviceWorker: { url: '/mockServiceWorker.js' } })
  createRoot(document.getElementById('root')!).render(
    <StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></StrictMode>,
  )
}

void bootstrap()
