const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

const materialsDir = path.join(__dirname, "../public/materials");
const filesToUpload = [
  "CInP Answer Key.pdf",
  "CInP Course Workbook - V1.5 .pdf",
  "CInP Glossary.pdf",
  "CInP Question Bank.pdf"
];

async function uploadFiles() {
  const uploadedFiles = {};
  for (const filename of filesToUpload) {
    const filePath = path.join(materialsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }

    console.log(`Uploading ${filename}...`);
    try {
      const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType: "application/pdf",
        displayName: filename,
      });
      console.log(`Uploaded ${uploadResult.file.displayName} as: ${uploadResult.file.name}`);
      uploadedFiles[filename] = uploadResult.file.name;
    } catch (e) {
      console.error(`Failed to upload ${filename}:`, e);
    }
  }

  const configPath = path.join(__dirname, "../src/materials_config.json");
  fs.writeFileSync(configPath, JSON.stringify(uploadedFiles, null, 2));
  console.log("Saved URIs to src/materials_config.json");
}

uploadFiles();
