import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PlateQ - Real-Time ANPR/LPR Malaysian Vehicle Detector',
  description:
    'Sistem pengesanan nombor plat kenderaan Malaysia secara langsung menggunakan kamera telefon, tablet dan komputer untuk kes repossession.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms" className="dark">
      <body className="bg-[#090a0f] text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
