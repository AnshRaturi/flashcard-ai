import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { BookOpen, UploadCloud, GraduationCap } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlashIQ - AI Flashcards",
  description: "Upload PDFs, master subjects with spaced repetition.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 selection:bg-indigo-500/30">
        <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xl tracking-tight transition-transform hover:scale-105 active:scale-95">
              <BookOpen className="h-6 w-6" />
              <span>FlashIQ</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              <Link href="/upload" className="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                <UploadCloud className="h-4 w-4" />
                <span className="hidden sm:inline">Upload PDF</span>
              </Link>
              <a href="/study" className="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                <GraduationCap className="h-4 w-4" />
                <span className="hidden sm:inline">Study Space</span>
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
