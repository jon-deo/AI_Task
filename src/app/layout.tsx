import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';

import { Toaster } from '@/components/ui/toaster';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Sports Celebrity Reels',
    template: '%s | Sports Celebrity Reels',
  },
  description:
    'AI-powered sports celebrity history reels. Discover engaging stories of your favorite sports stars.',
  keywords: [
    'sports',
    'celebrity',
    'reels',
    'AI',
    'history',
    'athletes',
    'entertainment',
  ],
  authors: [{ name: 'Sports Celebrity Reels Team' }],
  creator: 'Sports Celebrity Reels',
  publisher: 'Sports Celebrity Reels',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Sports Celebrity Reels',
    description:
      'AI-powered sports celebrity history reels. Discover engaging stories of your favorite sports stars.',
    siteName: 'Sports Celebrity Reels',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Sports Celebrity Reels',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sports Celebrity Reels',
    description:
      'AI-powered sports celebrity history reels. Discover engaging stories of your favorite sports stars.',
    images: ['/og-image.jpg'],
    creator: '@sportsreels',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  colorScheme: 'light dark',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang='en' className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel='icon' href='/favicon.ico' sizes='any' />
        <link rel='icon' href='/icon.svg' type='image/svg+xml' />
        <link rel='apple-touch-icon' href='/apple-touch-icon.png' />
        <link rel='manifest' href='/manifest.json' />
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='apple-mobile-web-app-title' content='Sports Reels' />
        <meta name='application-name' content='Sports Reels' />
        <meta name='msapplication-TileColor' content='#2563eb' />
        <meta name='theme-color' content='#ffffff' />
      </head>
      <body
        className={`${inter.className} min-h-screen bg-background font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <div className='relative flex min-h-screen flex-col'>
            <main className='flex-1'>{children}</main>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
