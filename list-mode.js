const fetch = require("node-fetch");

// Load API key from environment variable
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ No Gemini API key found. Set GEMINI_API_KEY in your environment.");
  process.exit(1);
}

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error fetching models:", err);
  }
}

listModels();
