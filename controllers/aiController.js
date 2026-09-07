require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_INSTRUCTION = `
You are an ultra-fast smart home voice parser for an 8-channel relay board.
The user's spoken input may be in English, Hindi, or mixed Hinglish. Understand casual words, accents, and local slangs.

CHANNEL MAP (1 to 8 -> id 0 to 7):
- 1, ek, one, fan, first, bedroom -> id: 0
- 2, do, two, second -> id: 1
- 3, teen, three, third -> id: 2
- 4, char, four, fourth -> id: 3
- 5, panch, five, fifth -> id: 4
- 6, che, six, sixth -> id: 5
- 7, saat, seven, seventh -> id: 6
- 8, aath, eight, last -> id: 7

STATE MAP:
- ON: on, chalu, jalao, kholo, start, enable -> state: true
- OFF: off, band, bujhao, close, stop, disable -> state: false

GLOBAL / MASTER COMMANDS:
- All on / Sab chalu / Turn everything on -> actionType: "ALL_RELAYS", state: true
- All off / Sab band / Turn off all / Goodnight -> actionType: "ALL_RELAYS", state: false

LIGHTING ANIMATION MODES (mode 0 to 9):
- 0: normal, manual
- 1: full on, static
- 2: waterfall, cascade, jharna
- 3: ping pong, knight rider, scanner
- 4: center out, burst
- 5: police light, strobe, alternate
- 6: tetris, stack
- 7: running dots, runner, train
- 8: disco, random, sparkle
- 9: auto cycle, party mode, dance

CRITICAL LANGUAGE RULE FOR SPEECH REPLY:
- "speechReply" MUST ALWAYS BE IN ENGLISH ONLY. Do NOT use Hindi or Hinglish in the reply text.
- Keep it short, crisp, and polite (e.g., "Turning on Relay 1, Boss." or "Starting Knight Rider pattern.").

Expected JSON Schema:
{
  "actionType": "TOGGLE_RELAY" | "ALL_RELAYS" | "SET_MODE" | "UNKNOWN",
  "id": number | null,
  "state": boolean | null,
  "mode": number | null,
  "speechReply": string
}
`;

const processVoiceCommand = async (req, res) => {
    try {
        const { transcript } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('❌ CRITICAL: GEMINI_API_KEY is missing or undefined in process.env!');
            return res.status(500).json({
                success: false,
                speechReply: 'API key is missing on the server, Boss.'
            });
        }

        if (!transcript || !transcript.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Transcript is required'
            });
        }

        console.log(`🎙️ Processing voice transcript: "${transcript}"`);

        // Initialize inside handler to guarantee env variable availability
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
                maxOutputTokens: 120
            }
        });

        const prompt = `${SYSTEM_INSTRUCTION}\nUser Input: "${transcript}"`;
        const result = await model.generateContent(prompt);
        const rawResponse = result.response.text();

        console.log('🤖 Raw AI Output:', rawResponse);

        let parsed;
        try {
            parsed = JSON.parse(rawResponse);
        } catch (jsonErr) {
            const cleaned = rawResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
            parsed = JSON.parse(cleaned);
        }

        return res.status(200).json({
            success: true,
            actionType: parsed.actionType || 'UNKNOWN',
            id: parsed.id !== undefined ? parsed.id : null,
            state: parsed.state !== undefined ? parsed.state : null,
            mode: parsed.mode !== undefined ? parsed.mode : null,
            speechReply: parsed.speechReply || 'Command executed, Boss.'
        });

    } catch (err) {
        // This will print the exact Google API rejection in your terminal
        console.error('❌ Detailed Gemini API Error:', err);
        return res.status(500).json({
            success: false,
            speechReply: 'Sorry Boss, I could not process that command. Please try again.'
        });
    }
};

module.exports = { processVoiceCommand };