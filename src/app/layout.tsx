import type { Metadata } from 'next';
import { Inter, Geist_Mono, Share_Tech_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const shareTechMono = Share_Tech_Mono({
  variable: '--font-matrix',
  subsets: ['latin'],
  weight: '400', // Share Tech Mono ships only weight 400
  display: 'swap', // matches Inter — no FOUT-driven reflow (Pitfall 7)
});

export const metadata: Metadata = {
  title: "Joe Dollinger's Resume Agent",
  description:
    "Chat with an AI agent grounded on Joe Dollinger's PM background — case studies, decisions, and tailored pitches.",
  // Keep the page out of search indexes until Phase 5 launch (QR code +
  // resume link activation). Flip to `index: true` then.
  robots: { index: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} ${shareTechMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
