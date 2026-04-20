import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60; // Set Vercel timeout to 60 seconds

// Ensure the application throws or catches cleanly if not set
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "", 
});

// Primitive text cleanup function for trimming common web-to-PDF artifacts
const cleanExtractedText = (rawText: string) => {
  let cleaned = rawText;
  cleaned = cleaned.replace(/\n\d+\s+sites[\s\S]*/gi, "");
  cleaned = cleaned.replace(/\nPoetry Foundation[\s\S]*/gi, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }

    // Pre-flight validation: Check if file already exists in Supabase to prevent duplication loops
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabasePreCheck = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const { count } = await supabasePreCheck.from('flashcards')
        .select('*', { count: 'exact', head: true })
        .eq('source_file', file.name);
        
      if (count && count > 0) {
        return NextResponse.json({ 
           error: `A Deck for '${file.name}' already exists. Please head to your Study Space to review it, or rename your file.` 
        }, { status: 409 });
      }
    }

    // Convert the File object to a Buffer for pdf-parse
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialize the parser class with the PDF buffer
    const parser = new PDFParse({ data: buffer });
    
    let text = "";
    try {
      const result = await parser.getText();
      text = cleanExtractedText(result.text);
    } finally {
      // Always call destroy to free memory
      await parser.destroy();
    }

    if (!text || text.length < 10) {
       return NextResponse.json({ error: "Not enough readable text found in PDF." }, { status: 400 });
    }

    // System Prompt emphasizing Flashcard properties
    const systemInstruction = `You are a Flashcard generation engine. Your goal is to take input text and generate high-quality educational flashcards.

Focus specifically on creating flashcards for:
1. Core concepts
2. Practical examples
3. Edge cases and exceptions
4. Common misconceptions`;

    let outputJson;

    try {
      // Prompt Gemini with strictly typed schema
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Please extract concepts and generate flashcards from this text:\n\n${text.substring(0, 30000)}`,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING, description: "The front of the flashcard" },
                    answer: { type: Type.STRING, description: "The back of the flashcard containing the explanation" },
                    topic: { type: Type.STRING, description: "A 1-2 word concept category/topic" },
                    difficulty: { type: Type.STRING, description: "Must be 'easy', 'medium', or 'hard'" }
                  },
                  required: ["question", "answer", "topic", "difficulty"]
                }
              }
            },
            required: ["flashcards"]
          }
        }
      });

      const completionContent = response.text || '{"flashcards": []}';
      try {
         outputJson = JSON.parse(completionContent);
      } catch (err) {
         throw new Error("Unable to parse Gemini 1st pass output into expected JSON");
      }

      // SECOND AI PASS (Refinement)
      try {
        const refinementInstruction = `You are a strict editorial AI optimizing study material.
Your tasks:
1. Identify and REMOVE any duplicated logical concepts.
2. Improve clarity, making answers highly concise for rapid spaced repetition.
3. INJECT exactly one highly relevant "Example: " into the answer field if it helps contextualize the topic.
Return ONLY the refined JSON directly matching the input flashcard schema array.`;

        const refinementResponse = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `Refine these flashcards:\n\n${JSON.stringify(outputJson)}`,
          config: {
            systemInstruction: refinementInstruction,
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: {
               // Must match exactly the same Type extraction format to prevent validation crash
               type: Type.OBJECT,
               properties: {
                  flashcards: {
                     type: Type.ARRAY,
                     items: {
                        type: Type.OBJECT,
                        properties: {
                           question: { type: Type.STRING },
                           answer: { type: Type.STRING },
                           topic: { type: Type.STRING },
                           difficulty: { type: Type.STRING }
                        },
                        required: ["question", "answer", "topic", "difficulty"]
                     }
                  }
               },
               required: ["flashcards"]
            }
          }
        });
        
        const refinedText = refinementResponse.text || '{"flashcards": []}';
        const refinedJson = JSON.parse(refinedText);
        if (refinedJson.flashcards && refinedJson.flashcards.length > 0) {
           outputJson = refinedJson;
           console.log("Second AI Pass: Successfully refined, deduped, and injected examples.");
        }
      } catch (refineError: any) {
        console.warn("Second pass refinement failed implicitly, reverting to raw extraction.", refineError.message);
      }

    } catch (apiError: any) {
      console.warn("Gemini API Blocked (Limit 0). Operating strictly in Local Heuristic Fallback Mode.");
      
      // Intelligent Dynamic Fallback: Scrape the raw extracted text into flashcards locally without Gemini
      const rawSentences = text.split(/(?<=[.?!])\s+/).filter(s => s.length > 15);
      const generatedCards = [];
      
      for(let i=0; i < rawSentences.length; i++) {
         const sentence = rawSentences[i].trim();
         if (sentence.length < 20) continue; // Skip useless short garbage strings
         
         // Looking for definitions, key terms, or compound statements
         if (sentence.includes(":")) {
             const parts = sentence.split(":");
             if (parts[0].length < 60) {
                 generatedCards.push({
                    question: `Explain the concept: ${parts[0].trim()}`,
                    answer: parts.slice(1).join(":").trim(),
                    topic: "Key Feature",
                    difficulty: "medium"
                 });
             }
         } else if (sentence.toLowerCase().includes(" is ")) {
             const parts = sentence.split(/ is /i);
             if (parts[0].length < 60) {
                 generatedCards.push({
                     question: `What is ${parts[0].trim()}?`,
                     answer: `It is ${parts.slice(1).join(" is ").trim()}`,
                     topic: "Definition",
                     difficulty: "easy"
                 });
             }
         } else if (sentence.includes(",")) {
             const parts = sentence.split(",");
             // Use the first clause as a prompt if it's decently long
             if (parts[0].length > 15 && parts[0].length < 80) {
                 generatedCards.push({
                     question: `Complete this concept: "${parts[0].trim()}..."`,
                     answer: sentence,
                     topic: "Concept",
                     difficulty: "medium"
                 });
             }
         } else {
             // For standard factual sentences, ask to discuss or define the whole statement
             generatedCards.push({
                 question: `Analyze and recall this fact: "${sentence}"`,
                 answer: sentence,
                 topic: "Recall",
                 difficulty: "hard"
             });
         }

         // Expanded to allow up to 30 flashcards to deeply cover full PDFs
         if (generatedCards.length >= 30) break;
      }

      if (generatedCards.length === 0) {
         return NextResponse.json(
            { error: "The uploaded PDF appears to be a flat image, screenshot, or a protected document without a readable text layer. We require an OCR-capable scanner or a native text PDF." },
            { status: 400 }
         );
      }

      outputJson = { flashcards: generatedCards };
    }

    // Persist uniquely to Supabase via backend service binding bridging Env vars securely  
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && outputJson.flashcards.length > 0) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const cardsToInsert = outputJson.flashcards.map((card: any) => ({
        question: card.question,
        answer: card.answer,
        topic: card.topic,
        difficulty: card.difficulty,
        interval: 0,
        source_file: file.name || "Uncategorized Deck"
      }));

      const { error: dbError } = await supabase.from('flashcards').insert(cardsToInsert);
      
      if (dbError) {
        console.error("Supabase bulk insert failure:", dbError);
        // Do not crash the upload completely if DB fails softly 
      }
    }

    return NextResponse.json({
      success: true,
      flashcards: outputJson.flashcards,
      textPreview: text.substring(0, 300) + "..."
    });

  } catch (error: any) {
    console.error("PDF Parsing & GenAI Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract text or generate flashcards." },
      { status: 500 }
    );
  }
}
