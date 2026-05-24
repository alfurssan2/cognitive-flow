const { google } = require('googleapis');
require('dotenv').config();

const sheetsAPI = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });

async function check() {
    const res = await sheetsAPI.spreadsheets.get({ spreadsheetId: process.env.SPREADSHEET_ID });
    const tabs = res.data.sheets.map(s => s.properties.title);
    console.log('Tabs:', tabs);

    for (const tab of tabs) {
        if (tab !== 'Settings') {
            try {
                const d = await sheetsAPI.spreadsheets.values.get({ 
                    spreadsheetId: process.env.SPREADSHEET_ID, 
                    range: `'${tab}'!A1:G5` 
                });
                console.log('Tab:', tab, 'Rows:', d.data.values);
            } catch(e) {
                console.log('Error reading tab:', tab, e.message);
            }
        }
    }
}
check().catch(console.error);
