import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { CallProvider } from './context/CallContext'
import AppRoutes from './routes/AppRoutes'
import GlassBackdrop from './components/common/GlassBackdrop'
import IncomingCallOverlay from './components/call/IncomingCallOverlay'
import CallScreen from './components/call/CallScreen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <GlassBackdrop />
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider>
              <CallProvider>
                <div className="relative z-10 min-h-screen">
                  <AppRoutes />
                </div>
                <IncomingCallOverlay />
                <CallScreen />
              </CallProvider>
            </SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
