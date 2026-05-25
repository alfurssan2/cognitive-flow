const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const path = require("path");
const fs = require("fs");

let fileManager = null;
const uploadedFilesCache = {}; // filename -> file.name (URI)

/**
 * Calls Gemini API to get a conceptual hint for an incorrect answer.
 * Expects a strictly formatted JSON object.
 */
async function getCognitiveHint(question, incorrectAnswer, correctAnswer) {
    if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY is not set. Returning fallback hint.");
        return {
            conceptual_hint: "Review the reference material for this concept.",
            snapshot_icon: "menu_book"
        };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a cognitive psychology tutor. 
The student answered a multiple-choice question incorrectly.
Question: "${question}"
Student's Incorrect Answer: "${incorrectAnswer}"
Correct Answer: "${correctAnswer}"

Provide a highly targeted conceptual hint to help them understand why the correct answer is right and their answer was wrong. 
You must return a strictly formatted JSON object with exactly two keys:
1. "conceptual_hint": A maximum 1 sentence string containing the hint.
2. "snapshot_icon": A single string representing a relevant Material 3 icon name (e.g., "lightbulb", "psychology", "account_tree").

Return ONLY valid JSON.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Try to parse the JSON output from Gemini
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : text;
        
        return JSON.parse(jsonString.trim());
    } catch (error) {
        console.error("Error fetching Gemini hint:", error);
        return {
            conceptual_hint: "Review the reference material for this concept.",
            snapshot_icon: "menu_book"
        };
    }
}

/**
 * Handles conversational follow-ups for incorrect answers.
 */
async function chatWithTutor(history, message) {
    if (!process.env.GEMINI_API_KEY) return "I'm sorry, my AI backend is currently offline.";

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const chat = model.startChat({
        history: history || [],
    });

    try {
        const result = await chat.sendMessage(message);
        return result.response.text();
    } catch (error) {
        console.error("Error in chatWithTutor:", error);
        return "I'm having trouble processing that right now. Please try again.";
    }
}

/**
 * Generates an array of flashcards in JSON format.
 */
async function generateCards(topic, numQuestions) {
    if (!process.env.GEMINI_API_KEY) throw new Error("Gemini API Key missing.");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a professional certification exam writer. 
Generate exactly ${numQuestions} multiple-choice questions about the topic: "${topic}".
Output MUST be a valid JSON array of objects.
Each object must have exactly these keys:
- "question": the question text
- "optA": option A
- "optB": option B
- "optC": option C
- "optD": option D
- "correct": the correct option letter (A, B, C, or D)
- "reference": a brief reference or explanation

Return ONLY valid JSON.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;
    
    return JSON.parse(jsonString.trim());
}

/**
 * Handles conversational queries about a specific PDF file.
 */
async function chatWithPDF(pdfName, message) {
    if (!process.env.GEMINI_API_KEY) throw new Error("Gemini API Key missing.");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    if (!fileManager) {
        fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
    }

    let fileUri = uploadedFilesCache[pdfName];

    // If not in cache, try to upload it on-the-fly
    if (!fileUri) {
        const filePath = path.join(__dirname, "../public/materials", pdfName);
        if (!fs.existsSync(filePath)) {
            throw new Error(`PDF file not found: ${pdfName}`);
        }

        console.log(`Uploading ${pdfName} to Gemini...`);
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType: "application/pdf",
            displayName: pdfName,
        });
        
        fileUri = uploadResult.file.name;
        uploadedFilesCache[pdfName] = fileUri;
        console.log(`Upload complete! URI: ${fileUri}`);
    }

    const prompt = `You are an AI study assistant. The user is reading a document named "${pdfName}".
Answer the user's question accurately based ONLY on the provided document.
If the answer is not in the document, say so.
User Question: ${message}`;

    const result = await model.generateContent([
        {
            fileData: {
                mimeType: "application/pdf",
                fileUri: fileUri
            }
        },
        { text: prompt }
    ]);

    return result.response.text();
}

module.exports = { getCognitiveHint, chatWithTutor, generateCards, chatWithPDF };
