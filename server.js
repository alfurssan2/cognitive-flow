require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');
const { fetchSessionData, shuffleAndFormatQuestions, appendGeneratedCards, fetchBridgeStudyData } = require('./src/sheets');
const { getCognitiveHint, chatWithTutor, generateCards, chatWithPDF } = require('./src/gemini');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up Google Sheets API auth
const sheetsAPI = google.sheets({
    version: 'v4',
    auth: process.env.GOOGLE_API_KEY 
});

let cachedSession = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Endpoint to fetch and shuffle the exam bank
app.get('/api/session', async (req, res) => {
    try {
        const spreadsheetId = process.env.SPREADSHEET_ID;
        if (!spreadsheetId) throw new Error("SPREADSHEET_ID not configured in .env");
        if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not configured in .env");

        let rawSession;
        if (cachedSession && (Date.now() - lastCacheTime < CACHE_DURATION_MS)) {
            rawSession = cachedSession;
            console.log("Serving session from cache.");
        } else {
            rawSession = await fetchSessionData(sheetsAPI, spreadsheetId);
            cachedSession = rawSession;
            lastCacheTime = Date.now();
            console.log("Fetched new session from Sheets.");
        }
        
        let session = shuffleAndFormatQuestions(rawSession);
        
        // Filter for specific pillar if requested (Weakness Coach feature)
        if (req.query.pillar) {
            session = session.filter(q => q.pillar === req.query.pillar);
        }
        
        res.json({ session });
    } catch (error) {
        console.error("Session Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to fetch AI conceptual hint on incorrect answers
app.post('/api/hint', async (req, res) => {
    const { question, incorrectAnswer, correctAnswer } = req.body;
    if (!question || !incorrectAnswer || !correctAnswer) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
        const hintData = await getCognitiveHint(question, incorrectAnswer, correctAnswer);
        res.json(hintData);
    } catch (error) {
        console.error("Hint Error:", error);
        res.status(500).json({ error: "Failed to fetch hint" });
    }
});

// Endpoint to fetch AI workbook-based hint for Focus Sessions
app.post('/api/focus-hint', async (req, res) => {
    const { question, incorrectAnswer, correctAnswer } = req.body;
    if (!question || !incorrectAnswer || !correctAnswer) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
        const workbookName = "CInP Course Workbook - V1.5 .pdf";
        const message = `The student answered a multiple-choice question incorrectly.
Question: "${question}"
Student's Incorrect Answer: "${incorrectAnswer}"
Correct Answer: "${correctAnswer}"

Search the workbook for explanations about this concept.
Provide a highly targeted conceptual hint based on the workbook's materials.
You must return a strictly formatted JSON object with exactly two keys:
1. "conceptual_hint": A maximum 1-2 sentence string explaining the concept from the workbook.
2. "snapshot_icon": A single string representing a relevant Material 3 icon name (e.g., "menu_book", "import_contacts", "school").

Return ONLY valid JSON.`;

        const replyText = await chatWithPDF(workbookName, message);
        
        let hintData;
        try {
            const jsonMatch = replyText.match(/```json\n([\s\S]*?)\n```/) || replyText.match(/```\n([\s\S]*?)\n```/);
            const jsonString = jsonMatch ? jsonMatch[1] : replyText;
            hintData = JSON.parse(jsonString.trim());
        } catch (parseError) {
            console.warn("Failed to parse JSON response from PDF tutor, using fallback layout.", parseError);
            hintData = {
                conceptual_hint: replyText.substring(0, 200) + "...",
                snapshot_icon: "menu_book"
            };
        }
        res.json(hintData);
    } catch (error) {
        console.error("Focus Hint Error:", error);
        res.status(500).json({ error: "Failed to fetch workbook hint" });
    }
});

// Endpoint for conversational follow-ups
app.post('/api/chat', async (req, res) => {
    const { history, message } = req.body;
    if (!message) return res.status(400).json({ error: "Missing message" });
    
    try {
        const reply = await chatWithTutor(history, message);
        res.json({ reply });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: "Failed to process chat" });
    }
});

// Endpoint to generate new flashcards and save to Google Sheets
app.post('/api/generate-cards', async (req, res) => {
    const { topic, numQuestions } = req.body;
    if (!topic || !numQuestions) return res.status(400).json({ error: "Missing topic or number of questions" });
    
    try {
        const spreadsheetId = process.env.SPREADSHEET_ID;
        // Generate via Gemini
        const newCards = await generateCards(topic, numQuestions);
        
        // Attempt to append to 'Generator' tab via Sheets API
        try {
            await appendGeneratedCards(sheetsAPI, spreadsheetId, newCards);
            res.json({ success: true, added: newCards.length, cards: newCards, savedToSheets: true });
        } catch (sheetError) {
            console.warn("Could not save to Sheets (API Key lacks write access):", sheetError.message);
            res.json({ 
                success: true, 
                added: newCards.length, 
                cards: newCards, 
                savedToSheets: false, 
                sheetError: sheetError.message 
            });
        }
    } catch (error) {
        console.error("Generate Error:", error);
        res.status(500).json({ error: error.message || "Failed to generate cards" });
    }
});

// Endpoint to fetch joined Bridge and Quiz data
app.get('/api/bridge-study', async (req, res) => {
    try {
        const spreadsheetId = process.env.SPREADSHEET_ID;
        if (!spreadsheetId) throw new Error("SPREADSHEET_ID not configured in .env");
        if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not configured in .env");

        const data = await fetchBridgeStudyData(sheetsAPI, spreadsheetId);
        res.json(data);
    } catch (error) {
        console.error("Bridge Study API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint for Chat with PDF
app.post('/api/chat-pdf', async (req, res) => {
    const { message, pdfName } = req.body;
    if (!message || !pdfName) return res.status(400).json({ error: "Missing message or pdfName" });
    
    try {
        const reply = await chatWithPDF(pdfName, message);
        res.json({ reply });
    } catch (error) {
        console.error("PDF Chat Error:", error);
        res.status(500).json({ error: error.message || "Failed to process PDF chat" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
