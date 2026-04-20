import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60; // Set Vercel timeout to 60 seconds

// Ensure the application throws or catches cleanly if not set
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "", 
});

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

    // Convert the File object to a Buffer 
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    // System Prompt emphasizing Flashcard properties
    const systemInstruction = `You are a Flashcard generation engine. Your goal is to take input text and generate a maximum of 10 high-quality educational flashcards.

Focus specifically on creating flashcards for:
1. Core concepts
2. Practical examples
3. Edge cases and exceptions
4. Common misconceptions`;

    let outputJson;

    try {
      // Prompt Gemini with strictly typed schema and passing PDF natively
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
            {
               role: "user",
               parts: [
                 { inlineData: { data: base64Data, mimeType: "application/pdf" } },
                 { text: "Please carefully read this document and extract concepts to generate up to 10 critical flashcards." }
               ]
            }
        ],
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

      // Skip second AI pass to prevent Vercel 10s timeouts
      console.log("Skipping refinement pass to ensure Vercel hobby tier 10-second limit is not breached.");

    } catch (apiError: any) {
      console.warn("Gemini API Error:", apiError);
      
      return NextResponse.json(
          { error: "Google Gemini AI refused the prompt or failed parsing the PDF natively: " + apiError.message },
          { status: 500 }
      );
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
      textPreview: "PDF natively processed by Gemini."
    });

  } catch (error: any) {
    console.error("PDF Parsing & GenAI Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract text or generate flashcards." },
      { status: 500 }
    );
  }
}
