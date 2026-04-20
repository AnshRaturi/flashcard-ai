'use client';

import { useState } from 'react';
import { UploadCloud, File, X, CheckCircle2, FileText, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const router = useRouter();
  const [isHovering, setIsHovering] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cardCount, setCardCount] = useState<number>(0);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 413) throw new Error("File is too large for Vercel Free Tier (Max 4.5MB). Try a smaller 1-2 page PDF.");
        if (response.status === 504) throw new Error("Vercel Timeout (10s) reached. Try a much smaller file.");
        if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
            throw new Error(`Vercel Server Error (${response.status}). The free tier server crashed before finishing the response.`);
        }
        
        try {
           const errData = JSON.parse(text);
           throw new Error(errData.error || "Failed to process PDF");
        } catch(e) {
           throw new Error("Failed to process PDF. Check server logs.");
        }
      }

      const data = await response.json();

      if (data.flashcards && data.flashcards.length > 0) {
         // Save flashcards globally to localstorage so the Study route can access them
         localStorage.setItem("flashcards_deck", JSON.stringify(data.flashcards));
         setCardCount(data.flashcards.length);
      }

      setIsSuccess(true);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to generate flashcards. See console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl flex-1 w-full mx-auto py-12 lg:py-20 animate-in fade-in duration-500 flex flex-col justify-center">
      <div className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-zinc-900 dark:text-zinc-50">Upload Materials</h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
          Upload your PDF lecture slides or study materials. We&apos;ll automatically generate structured flashcards.
        </p>
      </div>

      {!file && !isSuccess && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
          onDragLeave={() => setIsHovering(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center p-12 md:p-24 border-2 border-dashed rounded-[2rem] transition-all duration-200 ${
            isHovering 
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 scale-[1.02]' 
              : 'border-zinc-300 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30'
          }`}
        >
          <div className={`rounded-full p-5 mb-6 transition-colors duration-200 ${isHovering ? 'bg-indigo-200/50 dark:bg-indigo-500/30' : 'bg-indigo-100 dark:bg-indigo-500/20'}`}>
            <UploadCloud className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">Drag & Drop your PDF</h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 font-medium text-lg">or click to browse from your computer</p>
          <label className="cursor-pointer bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-8 py-4 rounded-full font-semibold text-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/5 dark:shadow-white/5">
            Choose File
            <input 
              type="file" 
              className="hidden" 
              accept="application/pdf"
              onChange={(e) => {
                if (e.target.files?.[0]) setFile(e.target.files[0]);
              }}
            />
          </label>
        </div>
      )}

      {file && !isSuccess && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 md:p-10 shadow-xl shadow-zinc-200/20 dark:shadow-none animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-700/50 mb-8">
            <div className="flex items-center gap-5">
              <div className="bg-indigo-100 dark:bg-indigo-500/20 p-4 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm">
                <File className="h-8 w-8" />
              </div>
              <div>
                <p className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">{file.name}</p>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB • PDF Document</p>
              </div>
            </div>
            <button 
              onClick={() => setFile(null)}
              className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors p-3 rounded-xl"
              disabled={isProcessing}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <button
            onClick={handleProcess}
            disabled={isProcessing}
            className={`w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-lg transition-all ${
              isProcessing
                ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-wait'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 active:scale-[0.98]'
            }`}
          >
            {isProcessing ? (
              <>
                <BrainCircuit className="animate-pulse h-6 w-6 text-zinc-400 dark:text-zinc-500" />
                AI is thinking... Generating flashcards...
              </>
            ) : (
              'Extract Text & Generate AI Flashcards'
            )}
          </button>
        </div>
      )}

      {isSuccess && (
        <div className="text-center p-8 py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-xl shadow-zinc-200/20 dark:shadow-none animate-in zoom-in-95 duration-500">
          <div className="inline-flex rounded-full bg-green-100 dark:bg-green-500/20 p-5 mb-6 shadow-inner">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-3xl font-extrabold mb-4 text-zinc-900 dark:text-zinc-50">Generation Complete!</h2>

          <p className="text-zinc-600 dark:text-zinc-400 text-lg mb-8 max-w-md mx-auto leading-relaxed">
            We successfully generated <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{cardCount}</strong> flashcards covering core concepts, examples, edge cases, and misconceptions.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 px-4">
            <button onClick={() => router.push("/study")} className="flex-1 sm:flex-none justify-center flex items-center bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
              Start Studying
            </button>
            <button onClick={() => { setFile(null); setIsSuccess(false); setCardCount(0); }} className="flex-1 sm:flex-none justify-center flex items-center px-8 py-3.5 rounded-xl font-bold border-2 border-zinc-200 text-zinc-700 dark:text-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-95 transition-all">
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
