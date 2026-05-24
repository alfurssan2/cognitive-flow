const { google } = require('googleapis');

/**
 * Pillar Allocation Algorithm
 * Reads 'Settings' tab to determine target counts per pillar,
 * then extracts random questions from each pillar up to the target count.
 */
async function fetchSessionData(sheetsAPI, spreadsheetId) {
    // 1. Read 'Settings' tab
    const settingsResponse = await sheetsAPI.spreadsheets.values.get({
        spreadsheetId,
        range: 'Settings!A:B', // Assumes Col A: Pillar Tab Name, Col B: Target Count
    });
    
    const settingsRows = settingsResponse.data.values;
    if (!settingsRows || settingsRows.length === 0) {
        throw new Error("No data found in Settings tab.");
    }

    let pillarsData = settingsRows;
    // Skip header row only if the second column is not a number
    if (pillarsData[0] && isNaN(parseInt(pillarsData[0][1], 10))) {
        pillarsData = pillarsData.slice(1);
    }

    const pillars = pillarsData.map(row => ({
        tabName: row[0],
        targetCount: parseInt(row[1], 10)
    }));

    let masterSessionArray = [];

    // 2. Iterate through Pillar tabs and extract Target Count of rows
    for (const pillar of pillars) {
        if (!pillar.tabName || isNaN(pillar.targetCount)) continue;

        try {
            const pillarResponse = await sheetsAPI.spreadsheets.values.get({
                spreadsheetId,
                range: `'${pillar.tabName}'!A:G`, // Wraps tab name in quotes to support spaces
            });

            const pillarRows = pillarResponse.data.values;
            if (!pillarRows || pillarRows.length <= 1) continue;

            // Skip header row
            const dataRows = pillarRows.slice(1);
            
            // Randomize questions before picking target count
            const shuffledDataRows = shuffleArray([...dataRows]);
            const selectedRows = shuffledDataRows.slice(0, pillar.targetCount);

            const mappedQuestions = selectedRows.map(row => {
                return {
                    pillar: pillar.tabName,
                    question: row[0],
                    options: [
                        { text: row[1], originalKey: 'A' },
                        { text: row[2], originalKey: 'B' },
                        { text: row[3], originalKey: 'C' },
                        { text: row[4], originalKey: 'D' }
                    ],
                    correctOriginalKey: row[5], // e.g., 'A', 'B', 'C', or 'D'
                    reference: row[6]
                };
            });

            masterSessionArray = masterSessionArray.concat(mappedQuestions);
        } catch (error) {
            console.error(`Error reading tab ${pillar.tabName}:`, error.message);
        }
    }

    return masterSessionArray;
}

/**
 * Dynamic Shuffling Function
 * Shuffles the session array, and dynamically shuffles the 4 options for each question.
 */
function shuffleAndFormatQuestions(masterSessionArray) {
    // Shuffle the entire session array
    const shuffledSession = shuffleArray([...masterSessionArray]);

    // Shuffle options for each question and track the correct answer
    return shuffledSession.map(q => {
        const shuffledOptions = shuffleArray([...q.options]);
        
        let correctIndex = 0;
        const formattedOptions = shuffledOptions.map((opt, index) => {
            if (opt.originalKey === q.correctOriginalKey) {
                correctIndex = index;
            }
            return opt.text;
        });

        // Convert index (0, 1, 2, 3) to A, B, C, D
        const labels = ['A', 'B', 'C', 'D'];

        return {
            pillar: q.pillar,
            question: q.question,
            options: formattedOptions,
            correctAnswerLabel: labels[correctIndex],
            correctAnswerText: formattedOptions[correctIndex],
            reference: q.reference
        };
    });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Appends generated rows directly to the "Generator" tab.
 */
async function appendGeneratedCards(sheetsAPI, spreadsheetId, newCards) {
    const values = newCards.map(c => [
        c.question, c.optA, c.optB, c.optC, c.optD, c.correct, c.reference
    ]);

    await sheetsAPI.spreadsheets.values.append({
        spreadsheetId,
        range: `'Generator'!A:G`,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
    });
}

module.exports = {
    fetchSessionData,
    shuffleAndFormatQuestions,
    appendGeneratedCards
};
