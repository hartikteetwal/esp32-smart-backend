const { GoogleGenerativeAI } = require('@google/generative-ai');

const processVoiceCommand = async (req, res) => {
    try {
        const { transcript } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!transcript || !transcript.trim()) {
            return res.status(400).json({ success: false, message: 'Transcript is required' });
        }

        if (!apiKey) {
            console.error('❌ GEMINI_API_KEY is not defined in process.env');
            return res.status(500).json({
                success: false,
                speechReply: 'API key is missing on the server, Boss.'
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

        const prompt = `
You are an ultra-smart, highly intuitive IoT home automation assistant for an 8-channel relay board and lighting animation system.

User's spoken input (May contain typos, heavy accents, Hindi, English, or mixed Hinglish):
"${transcript}"

YOUR CORE TASK:
Use deep common-sense reasoning and fuzzy contextual matching to infer user intent even if the pronunciation or phrasing is broken or casual.

MAPPING & REASONING RULES:
1. TARGET RELAYS (1 to 8 -> 0-indexed: 0 to 7):
   - "one", "1", "first", "pehla", "ek number", "switch 1", "fan", "bedroom light" -> id: 0
   - "two", "2", "second", "dusra", "do number" -> id: 1
   - "three", "3", "third", "teesra", "teen" -> id: 2
   - "four", "4", "fourth", "chautha", "char" -> id: 3
   - "five", "5", "fifth", "panchwa", "panch" -> id: 4
   - "six", "6", "sixth", "chatha", "che" -> id: 5
   - "seven", "7", "seventh", "saatwa", "saat" -> id: 6
   - "eight", "8", "eighth", "aathwa", "aath", "last" -> id: 7

2. STATE LOGIC:
   - ON: "turn on", "on", "open", "chalu", "jala do", "start", "enable", "khol do" -> state: true
   - OFF: "turn off", "off", "band", "bujha do", "close", "disable", "rok do" -> state: false

3. MASTER / GLOBAL ACTIONS:
   - "all on", "sab chalu", "saari light on", "pure ghar ki light jalao", "turn everything on" -> actionType: "ALL_RELAYS", state: true
   - "all off", "sab band", "full off", "saari light band", "turn off all lights", "goodnight" -> actionType: "ALL_RELAYS", state: false

4. LIGHTING ANIMATION PATTERNS (Modes 0 to 9):
   - 0: "manual", "normal", "simple", "regular mode"
   - 1: "static on", "full on", "continuous"
   - 2: "cascade", "waterfall", "chasing", "jharna", "line se jalao"
   - 3: "knight rider", "police light", "scanner", "disco", "dhoom", "back and forth"
   - 4: "center out", "burst", "beech se bahar"
   - 5: "alternate", "flip flop", "strobe", "blinking", "ek chhod ke ek"
   - 6: "tetris", "stacking", "building", "bharte jao"
   - 7: "comet", "runner", "train", "tezi se bhago"
   - 8: "twinkle", "stars", "sparkle", "chamko"
   - 9: "auto cycle", "party mode", "sab pattern chalao", "dance mode", "shuffle"

RETURN ONLY RAW VALID JSON (No backticks, no markdown, no \`\`\`json):
{
  "actionType": "TOGGLE_RELAY" | "ALL_RELAYS" | "SET_MODE" | "UNKNOWN",
  "id": 0, // integer 0-7 if TOGGLE_RELAY, otherwise null
  "state": true, // boolean if TOGGLE_RELAY or ALL_RELAYS, otherwise null
  "mode": 0, // integer 0-9 if SET_MODE, otherwise null
  "speechReply": "Natural, polite, short 1-sentence reply in Hindi or English (e.g., 'Relay 1 chalu kar diya, Boss.' or 'Starting Knight Rider pattern.')"
}
`;

        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        console.log('🤖 Raw Gemini Output:', rawText);

        rawText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const parsedData = JSON.parse(rawText);

        return res.status(200).json({
            success: true,
            actionType: parsedData.actionType,
            id: parsedData.id !== undefined ? parsedData.id : null,
            state: parsedData.state !== undefined ? parsedData.state : null,
            mode: parsedData.mode !== undefined ? parsedData.mode : null,
            speechReply: parsedData.speechReply || 'Command executed, Boss.'
        });

    } catch (err) {
        console.error('❌ Gemini Error inside Controller:', err);
        return res.status(500).json({
            success: false,
            speechReply: 'Sorry Boss, I encountered an issue processing that command.'
        });
    }
};

module.exports = { processVoiceCommand };