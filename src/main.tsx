import '@fontsource/cairo/400.css'
import '@fontsource/cairo/600.css'
import '@fontsource/cairo/700.css'
import '@fontsource/cairo/800.css'
import './index.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ApprovalProvider } from './components/approval'
import { ToastProvider } from './components/toast'
import { AuthProvider } from './lib/auth'
import { OfflineProvider } from './lib/offline'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ApprovalProvider>
          <AuthProvider>
            <OfflineProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </OfflineProvider>
          </AuthProvider>
        </ApprovalProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
