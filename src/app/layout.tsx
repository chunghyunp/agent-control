import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Agent Control — Multi-Agent Dashboard',
  description: 'Multi-agent AI development monitoring dashboard powered by Anthropic',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: '#0a0c16', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
