import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/lib/auth'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { ToastProvider } from '@/components/toast'
import './globals.css'

export const metadata: Metadata = {
  title: '💰 家計本',
  description: '全家人共享記帳．自動拆帳．一目了然誰欠誰',
  manifest: '/family-ledger-web/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '家計本',
  },
  icons: {
    icon: '/family-ledger-web/icons/icon-192.png',
    apple: '/family-ledger-web/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#2d7a47',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastProvider>
            <AuthProvider>
              <ServiceWorkerRegister />
              {children}
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
