'use client';

import { useState, useEffect } from 'react';
import { RefreshCcw, ThumbsUp, ThumbsDown, Check, BrainCircuit, AlertCircle, Loader2, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  topic: string;
  difficulty: string;
  id: string;
  source_file?: string;
  next_review_date: string;
  interval: number;
}

export default function StudyPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [availableDecks, setAvailableDecks] = useState<{name: string, total: number, due: number, mastered: number}[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchDecks = async () => {
      // Fetch broadly to group into distinct Decks mathematically and calculate deep stats
      try {
        const { data, error } = await supabase
          .from('flashcards')
          .select('source_file, id, next_review_date, interval');
        console.log("Supabase data returned", !!data, !!error);
        if (error) {
          console.error("Failed to fetch decks:", error);
        } else if (data) {
          const nowMs = Number(new Date());
          const slightlyAhead = new Date(nowMs + 5 * 60000);
          const decksMap: Record<string, {total: number, due: number, mastered: number}> = {};
          
          data.forEach(card => {
           // We assign null/old cards to Uncategorized
           const deckName = card.source_file || "Uncategorized Deck";
           if (!decksMap[deckName]) decksMap[deckName] = {total: 0, due: 0, mastered: 0};
           
           decksMap[deckName].total += 1;
           
           const isDue = new Date(card.next_review_date) <= slightlyAhead;

           if (isDue) {
               decksMap[deckName].due += 1;
           } else {
               decksMap[deckName].mastered += 1;
           }
        });
        setAvailableDecks(Object.entries(decksMap).map(([name, stats]) => ({name, ...stats})));
      }
      } catch (err) {
        console.error("fetchDecks caught exception", err);
      } finally {
        setIsLoaded(true);
      }
    };

    fetchDecks();
  }, []);

  const loadDeck = async (deckName: string) => {
      setIsLoaded(false);
      try {
        const now = Number(new Date());
        const slightlyAhead = new Date(now + 5 * 60000).toISOString();
        
        let finalCards = [];
        if (deckName === "Uncategorized Deck") {
           const { data } = await supabase.from('flashcards')
              .select('*')
              .lte('next_review_date', slightlyAhead);
           
           if (data) {
              finalCards = data.filter((d: any) => !d.source_file || d.source_file === "Uncategorized Deck")
                .sort((a: any, b: any) => new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime())
                .slice(0, 30);
           }
        } else {
           const { data } = await supabase.from('flashcards')
              .select('*')
              .eq('source_file', deckName)
              .lte('next_review_date', slightlyAhead)
              .order('next_review_date', { ascending: true })
              .limit(30);
           finalCards = data || [];
        }

        setCards(finalCards);
        setSelectedDeck(deckName);
        setSessionComplete(false);
        setCurrentIndex(0);
      } catch (err) {
        console.error("loadDeck caught exception", err);
      } finally {
        setIsLoaded(true);
      }
  };

  const deleteDeck = async (deckName: string) => {
    if (!confirm(`Are you sure you want to delete the deck "${deckName}"?`)) return;
    
    let error;
    if (deckName === "Uncategorized Deck") {
        const res = await supabase.from('flashcards').delete().is('source_file', null);
        error = res.error;
    } else {
        const res = await supabase.from('flashcards').delete().eq('source_file', deckName);
        error = res.error;
    }

    if (error) {
        console.error("Failed to delete deck:", error);
        alert("Failed to delete deck. Please try again.");
    } else {
        setAvailableDecks(prev => prev.filter(d => d.name !== deckName));
    }
  };

  const renameDeck = async (deckName: string) => {
    const newName = prompt(`Enter new name for deck "${deckName}":`, deckName);
    if (!newName || newName.trim() === "" || newName === deckName) return;
    
    const trimmedName = newName.trim();
    let error;
    if (deckName === "Uncategorized Deck") {
        const res = await supabase.from('flashcards').update({ source_file: trimmedName }).is('source_file', null);
        error = res.error;
    } else {
        const res = await supabase.from('flashcards').update({ source_file: trimmedName }).eq('source_file', deckName);
        error = res.error;
    }
    
    if (error) {
        console.error("Failed to rename deck:", error);
        alert("Failed to rename deck. Please try again.");
    } else {
        window.location.reload();
    }
  };

  const handleReview = async (rating: "hard" | "good" | "easy") => {
    setIsFlipped(false);
    
    const card = cards[currentIndex];
    let newInterval = card.interval || 0;
    
    // Basic Spaced Repetition Multipliers
    if (rating === "hard") {
      newInterval = 0; // Reset interval, need to study again immediately
    } else if (rating === "good") {
      newInterval = newInterval < 3 ? 3 : newInterval * 2;
    } else if (rating === "easy") {
      newInterval = newInterval < 3 ? 4 : newInterval * 3;
    }

    const nextDate = new Date();
    // if rating is hard, it is due in 5 minutes. Otherwise it's due in X days.
    if (newInterval === 0) {
       nextDate.setMinutes(nextDate.getMinutes() + 5);
    } else {
       nextDate.setDate(nextDate.getDate() + newInterval);
    }

    // Fire and forget update directly to Supabase
    supabase.from('flashcards')
      .update({
         interval: newInterval,
         next_review_date: nextDate.toISOString()
      })
      .eq('id', card.id)
      .then(({error}) => {
         if (error) console.error("Update sync error", error);
      });

    setTimeout(() => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(v => v + 1);
      } else {
        setSessionComplete(true);
      }
    }, 200); 
  };

  if (!isLoaded) {
     return (
       <div className="flex-1 min-h-[500px] flex flex-col items-center justify-center gap-4 animate-pulse">
         <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
         <p className="font-semibold text-zinc-500">Syncing database decks...</p>
       </div>
     );
  }

  // DECK SELECTION PAGE
  if (!selectedDeck) {
     if (availableDecks.length === 0) {
        return (
          <div className="flex-1 flex flex-col justify-center items-center max-w-lg mx-auto py-20 text-center w-full px-4 animate-in fade-in duration-500">
            <div className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800/50 p-6 mb-6 shadow-inner">
              <AlertCircle className="h-12 w-12 text-zinc-400" />
            </div>
            <h2 className="text-3xl font-extrabold mb-4 text-zinc-900 dark:text-zinc-50">Upload Your First PDF!</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed text-lg">
              You haven&apos;t generated any decks yet. Head over to the Upload section to dynamically extract flashcards from your documents.
            </p>
            <Link href="/upload" className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
              Create a Deck
            </Link>
          </div>
        );
     }

     return (
       <div className="flex-1 max-w-5xl mx-auto py-12 px-4 w-full animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
             <div>
                <h1 className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 mb-4 font-sans tracking-tight">Select a Deck</h1>
                <p className="text-zinc-600 dark:text-zinc-400 text-lg">Choose an extracted document archive to begin your spaced repetition session.</p>
             </div>
             
             {availableDecks.length > 0 && (
               <div className="relative w-full md:w-72 lg:w-96">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                   <svg className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                   </svg>
                 </div>
                 <input
                   type="text"
                   placeholder="Search decks by name..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="block w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl rounded-2xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-zinc-200/40 dark:shadow-none"
                 />
               </div>
             )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableDecks
              .filter(deck => deck.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((deck) => (
              <div 
                key={deck.name}
                onClick={() => deck.due > 0 ? loadDeck(deck.name) : undefined}
                className={`group flex flex-col text-left p-6 sm:p-8 rounded-[2rem] bg-white border border-zinc-200 shadow-lg shadow-zinc-200/40 dark:shadow-none dark:bg-zinc-900 dark:border-zinc-800 transition-all duration-300 relative ${deck.due > 0 ? 'hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:shadow-indigo-500/10 cursor-pointer' : 'opacity-70'}`}
              >
                 <div className="flex justify-between items-start w-full mb-6 py-2">
                   <div className="bg-indigo-50 dark:bg-indigo-500/10 h-14 w-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BrainCircuit className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                   </div>
                   <div className="flex gap-2 relative z-10 -mt-2 -mr-2">
                     <button
                       onClick={(e) => { e.stopPropagation(); renameDeck(deck.name); }}
                       className="p-2.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors cursor-pointer"
                       title="Rename Deck"
                     >
                       <Edit2 className="w-5 h-5" />
                     </button>
                     <button
                       onClick={(e) => { e.stopPropagation(); deleteDeck(deck.name); }}
                       className="p-2.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                       title="Delete Deck"
                     >
                       <Trash2 className="w-5 h-5" />
                     </button>
                   </div>
                 </div>
                 <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 pr-12 line-clamp-2 min-h-14" title={deck.name}>
                    {deck.name}
                 </h3>
                 
                 <div className="flex flex-col gap-2 mb-6 flex-1 w-full text-sm">
                    <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg">
                       <span className="text-zinc-500 font-medium">Total Cards</span>
                       <span className="font-bold text-zinc-900 dark:text-zinc-100">{deck.total}</span>
                    </div>
                    <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg">
                       <span className="text-amber-600 dark:text-amber-400 font-medium">Due Now</span>
                       <span className="font-bold text-amber-700 dark:text-amber-500">{deck.due}</span>
                    </div>
                    <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg">
                       <span className="text-emerald-600 dark:text-emerald-400 font-medium">Mastered</span>
                       <span className="font-bold text-emerald-700 dark:text-emerald-500">{deck.mastered}</span>
                    </div>
                 </div>
                 
                 {deck.due > 0 ? (
                    <div className="w-full text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-500/10 text-center py-2.5 rounded-xl group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500 transition-colors">
                       Start Session
                    </div>
                 ) : (
                    <div className="w-full text-emerald-600 dark:text-emerald-500 font-bold bg-emerald-50 dark:bg-emerald-500/10 text-center py-2.5 rounded-xl">
                       Completed for Now
                    </div>
                 )}
              </div>
            ))}
          </div>
       </div>
     );
  }

  // Catch the edge case where a deck was selected but it mathematically has 0 cards left
  if (cards.length === 0 && selectedDeck) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center max-w-lg mx-auto py-20 text-center w-full px-4 animate-in fade-in duration-500">
        <div className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-500/20 p-6 mb-6 shadow-inner">
          <Check className="h-12 w-12 text-emerald-600 dark:text-emerald-500" />
        </div>
        <h2 className="text-3xl font-extrabold mb-4 text-zinc-900 dark:text-zinc-50">Deck Completed!</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed text-lg">
          You&apos;ve successfully cleared all due cards for <strong>{selectedDeck}</strong>. The spaced repetition engine will alert you when they need to be reviewed again.
        </p>
        <button onClick={() => setSelectedDeck(null)} className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-lg active:scale-95 transition-all">
          Return to Decks
        </button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  if (sessionComplete) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center max-w-2xl mx-auto py-20 text-center animate-in zoom-in-95 duration-500 w-full px-4">
        <div className="inline-flex rounded-full bg-indigo-100 dark:bg-indigo-500/20 p-8 mb-10 shadow-inner">
          <BrainCircuit className="h-20 w-20 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-zinc-900 dark:text-zinc-50">Session Complete!</h2>
        <p className="text-zinc-600 dark:text-zinc-400 text-xl mb-12 max-w-md leading-relaxed">
          You mastered <strong className="text-zinc-900 dark:text-zinc-100">{cards.length}</strong> concepts today. Your progress has been securely synced.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <button 
             onClick={() => setSelectedDeck(null)}
            className="bg-indigo-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
          >
            Switch Deck
          </button>
          <Link href="/upload" className="bg-white text-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 px-10 py-4 rounded-xl font-bold text-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center">
            Upload More
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl flex-1 mx-auto py-8 lg:py-12 flex flex-col w-full px-4 justify-center">
      <div className="mb-8 flex items-center justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800/50">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 mb-1">Study Session</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
               {currentCard.topic}
            </span>
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 capitalize">
               Level: {currentCard.difficulty}
            </span>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 px-5 py-2.5 rounded-xl text-base font-bold text-zinc-700 dark:text-zinc-300">
          Card {currentIndex + 1} <span className="opacity-50 mx-1">/</span> {cards.length}
        </div>
      </div>

      <div className="relative w-full mb-12 h-[450px] md:h-[500px] perspective-1000">
        <div 
          className={`w-full h-full duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden flex flex-col justify-between p-8 lg:p-12 text-center rounded-[2.5rem] bg-white border border-zinc-200 shadow-xl shadow-zinc-200/50 dark:bg-zinc-900 dark:border-zinc-800 dark:shadow-none transition-colors hover:border-indigo-300 dark:hover:border-indigo-500/50 overflow-hidden">
            <div className="flex items-center gap-2 self-start">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]"></span>
              <span className="text-sm font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">Concept</span>
            </div>
            
            <div className="flex-1 flex flex-col justify-center overflow-y-auto py-6 px-2 my-2 custom-scrollbar">
              <p className="text-2xl lg:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                {currentCard.question}
              </p>
            </div>

            <div className="flex justify-center mt-2">
              <p className="text-sm text-zinc-400 dark:text-zinc-500 font-semibold bg-zinc-50 dark:bg-zinc-800/50 px-5 py-2.5 rounded-full border border-zinc-100 dark:border-zinc-700/50">
                Click anywhere to flip
              </p>
            </div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col justify-between p-8 lg:p-12 text-center rounded-[2.5rem] bg-indigo-50/90 border border-indigo-100 shadow-xl shadow-indigo-100/50 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:shadow-none backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-2 self-start">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1 rounded-full">Explanation</span>
            </div>
            
            <div className="flex-1 flex flex-col justify-center overflow-y-auto py-6 px-2 my-2 custom-scrollbar">
              <p className="text-xl lg:text-2xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed max-w-prose mx-auto">
                {currentCard.answer}
              </p>
            </div>
            
            <div className="flex justify-center mt-2 h-[42px] {/* Spacer height to match front card footer */}"></div>
          </div>
        </div>
      </div>

      <div className="h-28 md:h-24">
        {isFlipped ? (
          <div className="flex space-x-4 lg:space-x-6 animate-in slide-in-from-bottom-4 zoom-in-95 fade-in duration-300 mx-auto w-full max-w-2xl px-2">
            <button 
              onClick={() => handleReview("hard")}
              className="flex-1 flex flex-col items-center justify-center py-4 bg-white dark:bg-zinc-900 text-red-600 rounded-2xl border-2 border-red-100 hover:bg-red-50 hover:border-red-200 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:border-red-900/50 shadow-sm active:scale-95 transition-all group"
            >
              <ThumbsDown className="h-7 w-7 mb-1.5 group-hover:-translate-y-1 transition-transform" />
              <span className="font-bold text-base">Hard</span>
              <span className="text-xs font-semibold opacity-70 mt-0.5">&lt; 5m</span>
            </button>
            <button 
              onClick={() => handleReview("good")}
              className="flex-1 flex flex-col items-center justify-center py-4 bg-white dark:bg-zinc-900 text-emerald-600 rounded-2xl border-2 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200 dark:border-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-900/50 shadow-sm active:scale-95 transition-all group"
            >
              <Check className="h-7 w-7 mb-1.5 group-hover:-translate-y-1 transition-transform" />
              <span className="font-bold text-base">Good</span>
              <span className="text-xs font-semibold opacity-70 mt-0.5">1-2d</span>
            </button>
            <button 
              onClick={() => handleReview("easy")}
              className="flex-1 flex flex-col items-center justify-center py-4 bg-white dark:bg-zinc-900 text-blue-600 rounded-2xl border-2 border-blue-100 hover:bg-blue-50 hover:border-blue-200 dark:border-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-950/30 dark:hover:border-blue-900/50 shadow-sm active:scale-95 transition-all group"
            >
              <ThumbsUp className="h-7 w-7 mb-1.5 group-hover:-translate-y-1 transition-transform" />
              <span className="font-bold text-base">Easy</span>
              <span className="text-xs font-semibold opacity-70 mt-0.5">3-4d</span>
            </button>
          </div>
        ) : (
          <div className="flex justify-center mx-auto w-full max-w-md px-2 animate-in slide-in-from-bottom-2 fade-in">
            <button 
              onClick={() => setIsFlipped(true)}
              className="w-full flex items-center justify-center gap-3 py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-xl shadow-xl shadow-black/10 dark:shadow-white/10 hover:bg-zinc-800 dark:hover:bg-zinc-100 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
            >
              <RefreshCcw className="h-6 w-6" />
              Reveal Answer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
