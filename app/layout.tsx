import type {Metadata} from 'next';
import { Urbanist, Caveat } from 'next/font/google';
import './globals.css';

const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-urbanist',
  display: 'swap',
});

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-caveat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mnemósyne — AI Reflection Journal',
  description: 'A private, authenticated journaling app with Gemini AI reflections and secure Firestore storage.',
  openGraph: {
    title: 'Mnemósyne — AI Reflection Journal',
    description: 'A private, authenticated journaling app with Gemini AI reflections and secure Firestore storage.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mnemósyne — AI Reflection Journal',
    description: 'A private, authenticated journaling app with Gemini AI reflections and secure Firestore storage.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${urbanist.variable} ${caveat.variable}`}>
      <body className={`${urbanist.className} font-sans bg-[#F6F5FA] text-[#212121] antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
