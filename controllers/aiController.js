const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// Instance bahar initialize karne se har request par cold-start lag nahi hoga
const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 120
    }
});

const SYSTEM_INSTRUCTION = `
You are an ultra-fast IoT parser for an 8-channel relay board & lighting patterns.
Input may be in English, Hindi, or broken Hinglish. Understand phonetic typos and local slangs.

CHANNELS (1-8 -> id: 0-7):
1/ek/fan/first -> 0 | 2/do/second -> 1 | 3/teen/third -> 2 | 4/char/fourth -> 3
5/panch/fifth -> 4 | 6/che/sixth -> 5 | 7/saat/seventh -> 6 | 8/aath/last -> 7

STATE:
ON: on, open, chalu, jalao, chala do, start -> true
OFF: off, band, bujhao, rok do, stop -> false

GLOBAL:
all on, saari jalao, sab chalu -> actionType: "ALL_RELAYS", state: true
all off, saari band, sab bujha do, goodnight -> actionType: "ALL_RELAYS", state: false

PATTERNS (mode: 0-9):
0: normal/manual | 1: full on | 2: waterfall/cascade/jharna
3: ping pong/knight rider/scanner | 4: center out/burst
5: police/alternate/strobe | 6: tetris/stack | 7: runner/dual dots
8: disco/random/sparkle | 9: auto/party/shuffle

Output JSON Schema:
{
  "actionType": "TOGGLE_RELAY" | "ALL_RELAYS" | "SET_MODE" | "UNKNOWN",
  "id": number | null,
  "state": boolean | null,
  "mode": number | null,
  "speechReply": "Crisp 1-sentence reply in Hindi/English"
}
`;

const processVoiceCommand = async (req, res) => {
    try {
        const { transcript } = req.body;

        if (!transcript || !transcript.trim()) {
            return res.status(400).json({ success: false, message: 'Transcript is required' });
        }

        const prompt = `${SYSTEM_INSTRUCTION}\nUser Input: "${transcript}"`;
        const result = await model.generateContent(prompt);
        const parsed = JSON.parse(result.response.text());

        return res.status(200).json({
            success: true,
            actionType: parsed.actionType || 'UNKNOWN',
            id: parsed.id ?? null,
            state: parsed.state ?? null,
            mode: parsed.mode ?? null,
            speechReply: parsed.speechReply || 'Command executed!'
        });

    } catch (err) {
        console.error('❌ Fast AI Error:', err.message);
        return res.status(500).json({
            success: false,
            speechReply: 'Thoda issue hua, dobara boliye!'
        });
    }
};

module.exports = { processVoiceCommand };