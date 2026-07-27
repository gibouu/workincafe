import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WorkinCafe',
  description: 'Find Toronto cafés suitable for studying or working.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
