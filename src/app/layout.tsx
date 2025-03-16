import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Layout/Header";
import { AuthProvider } from "@/context/AuthContext";
import AuthStatus from "@/components/Layout/AuthStatus";
import DebugPanel from "@/components/Layout/DebugPanel";
import { Toaster } from 'react-hot-toast';
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Audio Travel Guide",
  description: "Personalized location-based audio guided tours",
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/manifest.json',
  themeColor: '#f97316',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Audio Guide',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/earth-globe-global-svgrepo-com.svg" />
      </head>
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <AuthProvider>
          <Providers>
            <Header />
            <main className="flex-grow">
              {children}
            </main>
            <AuthStatus />
            {process.env.NODE_ENV === "development" && <DebugPanel />}
            <Toaster position="bottom-right" />
            {/* OfflineIndicator will be added in a client component */}
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
