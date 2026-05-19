import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/Toaster';
import { BottomBar } from '@/components/bottom-bar/BottomBar';

export const metadata: Metadata = {
  title: 'Work in Cafe',
  description: 'Find places to work or study outside the home — map-first, mobile-friendly.',
  applicationName: 'Work in Cafe',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F2EDE3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <BottomBar />
        <Toaster />
      </body>
    </html>
  );
}
