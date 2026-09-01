require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log("Checking API Key:", process.env.GEMINI_API_KEY ? "Found ✅" : "Missing/Undefined ❌");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
    try {
        // Exact updated active model
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
        const result = await model.generateContent("Say hello in one word");
        console.log("Gemini Response:", result.response.text());
        console.log("🎉 Gemini API Key is working perfectly!");
    } catch (error) {
        console.error("❌ Exact Error Details:\n", error);
    }
}

// run();