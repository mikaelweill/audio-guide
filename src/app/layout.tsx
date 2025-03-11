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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
