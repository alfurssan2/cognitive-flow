const { GoogleGenerativeAI } = require("@google/generative-ai");

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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

module.exports = { getCognitiveHint };
