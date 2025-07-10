import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '../components/WalletProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PoopChain',
  description: 'The shittiest DeFi on Polygon!',
  icons: {
    icon: '/favicon.ico',
  },
  keywords: ['defi', 'polygon', 'casino', 'meme', 'gas lottery', 'poopchain', 'poopygon'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}