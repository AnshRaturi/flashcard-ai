import Link from 'next/link';
import { ArrowRight, BrainCircuit, Upload, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-12 lg:py-32 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 mb-8 shadow-sm">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        <span>Smarter studying is here</span>
      </div>
      
      <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-zinc-950 sm:text-7xl dark:text-zinc-50 mb-8 leading-tight">
        Master any topic with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">AI flashcards.</span>
      </h1>
      
      <p className="max-w-2xl text-lg text-zinc-600 sm:text-xl dark:text-zinc-400 mb-12 leading-relaxed">
        Upload your lecture slides or notes as PDFs. We&apos;ll automatically extract the key concepts and generate high-quality, spaced-repetition flashcards to help you ace your exams.
      </p>
      
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center px-4">
        <Link href="/upload" className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all">
          <Upload className="h-5 w-5" />
          Upload a PDF
        </Link>
        <Link href="/study" className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-8 py-4 text-base font-semibold text-zinc-950 shadow-sm hover:bg-zinc-50 hover:scale-105 active:scale-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900 transition-all">
          <BrainCircuit className="h-5 w-5" />
          Start Studying
          <ArrowRight className="h-4 w-4 ml-1" />
        </Link>
      </div>

      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl text-left">
        {[
          { title: "Upload Anywhere", desc: "Drag & drop your PDFs, slides, or documents seamlessly into our engine." },
          { title: "Instant Generation", desc: "Our AI processes the text and crafts Q&A format cards instantly for you." },
          { title: "Spaced Repetition", desc: "Our built-in engine helps you review cards at the perfect time to commit to memory." }
        ].map((feature, i) => (
          <div key={i} className="flex flex-col gap-3 p-8 rounded-3xl bg-white border border-zinc-100 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800/80 transition-transform hover:-translate-y-1">
            <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold mb-3 shadow-inner">
              {i + 1}
            </div>
            <h3 className="font-semibold text-xl text-zinc-900 dark:text-zinc-100">{feature.title}</h3>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
