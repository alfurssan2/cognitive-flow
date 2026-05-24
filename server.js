require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');
const { fetchSessionData, shuffleAndFormatQuestions, appendGeneratedCards } = require('./src/sheets');
const { getCognitiveHint, chatWithTutor, generateCards } = require('./src/gemini');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up Google Sheets API auth
const sheetsAPI = google.sheets({
    version: 'v4',
    auth: process.env.GOOGLE_API_KEY 
});

// Endpoint to fetch and shuffle the exam bank
app.get('/api/session', async (req, res) => {
    try {
        const spreadsheetId = process.env.SPREADSHEET_ID;
        if (!spreadsheetId) throw new Error("SPREADSHEET_ID not configured in .env");
        if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not configured in .env");

        const rawSession = await fetchSessionData(sheetsAPI, spreadsheetId);
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
        // Append to 'Generator' tab via Sheets API
        await appendGeneratedCards(sheetsAPI, spreadsheetId, newCards);
        
        res.json({ success: true, added: newCards.length });
    } catch (error) {
        console.error("Generate Error:", error);
        res.status(500).json({ error: error.message || "Failed to generate cards" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
