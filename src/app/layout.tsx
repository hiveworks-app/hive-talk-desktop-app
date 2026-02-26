import type { Metadata, Viewport } from 'next';
import { ReactQueryProvider } from '@/shared/providers/ReactQueryProvider';
import { LoadingOverlay } from '@/shared/ui/LoadingOverlay';
import { ToastContainer } from '@/shared/ui/ToastContainer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Hive-Talk',
    template: '%s | Hive-Talk',
  },
  description: 'Hive-Talk 실시간 채팅 웹 애플리케이션',
  applicationName: 'Hive-Talk',
  openGraph: {
    type: 'website',
    title: 'Hive-Talk',
    description: 'Hive-Talk 실시간 채팅 웹 애플리케이션',
    siteName: 'Hive-Talk',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1A1A' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Pretendard Variable Font — CDN preconnect + preload */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased">
        <ReactQueryProvider>
          {children}
          <ToastContainer />
          <LoadingOverlay />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
