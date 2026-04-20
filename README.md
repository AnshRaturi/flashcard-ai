# Flashcard AI Engine (FlashIQ) 🧠

![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)

FlashIQ is an intelligent, full-stack web application that automatically transforms static study materials (PDF lecture slides, textbooks, or scanned notes) into highly interactive, spaced-repetition flashcard decks. Built for the Cuemath Build Challenge.

## ✨ Core Features

- **Instant PDF Extraction**: Upload dense PDF materials and let the AI instantly read and comprehend visual layouts, equations, and textbook paragraphs simultaneously.
- **Smart Flashcard Generation**: The Google Gemini multimodal engine meticulously extracts core concepts, rare edge cases, and distinct examples into structured question/answer formats.
- **Spaced Repetition Algorithm**: Natively integrated study spaces using dynamic deck metadata allowing you to grade your recall logic (`Again`, `Good`, `Easy`) and sort intervals correctly.
- **Supabase Cloud Sync**: Every deck generated is safely preserved in highly-scalable PostgreSQL databases via Supabase API binding ensuring no lost notes.

## 🛠️ Tech Stack 

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React Icons
- **Backend**: Next.js Serverless API processing
- **AI Engine**: `@google/genai` (Native integration via `gemini-flash-latest`)
- **Database**: Supabase (PostgreSQL)

---

## What I Built & The Problem I Picked
For the Cuemath build challenge, I chose the **AI Flashcard Engine** problem. The core problem this solves is the immense time sink students experience when converting dense PDF lecture slides or study notes into actionable learning material. By uploading any educational PDF, the application instantly extracts information and automatically transforms them into a structured interactive flashcard deck stored in the cloud.

## Key Decisions and Tradeoffs
* **Next.js & Serverless Architecture (Vercel):** I chose Next.js App Router for its seamless fusion of React front-end and API back-end routing. 
  * *Tradeoff:* Relying on serverless functions introduced strict 10-second timeout and payload limits, forcing me to heavily optimize my AI API calls instead of running long, multi-pass background jobs.
* **Native AI Document Processing vs. OCR Libraries:** Instead of forcefully using heavy Node.js libraries like `pdf-parse` to extract text manually, I decided to pass the PDF buffer directly to the Google Gemini API using Base64 `inlineData`. 
  * *Tradeoff:* I offloaded the heavy lifting to Google's infrastructure, which is faster and prevents memory crashes, but it tightly couples the initial PDF ingestion to the Gemini multimodal API limit ceilings.
* **Supabase for Persistence:** I opted for Supabase (PostgreSQL) instead of local storage or MongoDB to ensure relational data integrity between Deck metadata and Spaced Repetition algorithms (e.g., `next_review_date`, `interval`, `ease_factor`).

## What I'd Improve or Add With More Time
1. **User Authentication:** Implementing Clerk or NextAuth.js so multiple users can safely store, track, and sync their personalized spaced repetition intervals across devices.
2. **Side-by-Side Document Viewer:** A split-screen UI in the Study Space where the original PDF is rendered on the left, highlighting the exact paragraph the current AI flashcard was generated from.
3. **Broader Multimodal Support:** Expanding the upload capabilities beyond PDFs to support YouTube URLs, DOCX files, and raw PowerPoint presentations.

## Interesting Challenges and How I Solved Them
**The Vercel Server Crash & Serverless Bottlenecks:**
During deployment, I hit massive pipeline failures where uploading PDFs caused the entire Vercel server container to crash with a `500 Server Error` or a `504 Timeout`. I discovered that traditional NPM parsing modules like `pdf-parse` require high memory overhead and local file system bindings, which are fundamentally incompatible with Vercel's Hobby-tier serverless edge limits. 

**The Solution:**
I completely bypassed typical backend PDF parsing libraries. Instead of trying to extract text locally, I re-architected the API route to transform the PDF into a binary array buffer and sent it straight to Google's `gemini-flash-latest` model as a native document attachment. Not only did this completely resolve the server timeouts by shifting the computational weight out of Vercel, but it also resulted in significantly smarter flashcards because the AI could natively understand the visual layout and structure of the document itself.

---

## 🚀 Local Development Setup

**1. Clone the repository**
```bash
git clone https://github.com/AnshRaturi/flashcard-ai.git
cd flashcard-ai
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure Environment Variables**
Create a `.env.local` file in the root directory:
```env
GEMINI_API_KEY="your_google_ai_studio_api_key_here"
NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
```

**4. Setup Supabase Database**
Run the SQL schema located in `supabase_schema.sql` via your Supabase SQL editor to scaffold the required Tables and Policies.

**5. Start the Application**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
