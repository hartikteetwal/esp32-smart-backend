require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_INSTRUCTION = `
You are a smart home parser for an 8-channel relay board.
Input may be in English, Hindi, or mixed Hinglish.
Handle phonetic speech recognition errors (e.g., "jo lights", "zo lights", "so lights" mean "all lights").

CHANNELS (1-8 -> id 0-7):
1/ek/fan/first -> 0 | 2/do/second -> 1 | 3/teen/third -> 2 | 4/char/fourth -> 3
5/panch/fifth -> 4 | 6/che/sixth -> 5 | 7/saat/seventh -> 6 | 8/aath/last -> 7

STATE:
ON: on, chalu, jalao, kholo, start, enable -> true
OFF: off, band, bujhao, close, stop, disable -> false

GLOBAL (All lights):
- "all on", "turn on all lights", "jo lights", "saari light on", "sab chalu", "saari lights jala do" -> actionType: "ALL_RELAYS", state: true
- "all off", "turn off all lights", "saari light band", "sab bujha do", "goodnight" -> actionType: "ALL_RELAYS", state: false

MODES (0-9):
0: normal | 1: full on | 2: waterfall | 3: knight rider | 4: center out
5: police strobe | 6: tetris | 7: runner | 8: disco | 9: party/auto

SPEECH REPLY RULE:
"speechReply" MUST ALWAYS BE IN ENGLISH ONLY. Short and polite.

Output JSON Format:
{
  "actionType": "TOGGLE_RELAY" | "ALL_RELAYS" | "SET_MODE" | "UNKNOWN",
  "id": number | null,
  "state": boolean | null,
  "mode": number | null,
  "speechReply": string
}
`;

// ⚡ Local Fast Fallback Engine (0ms execution if Gemini is 503 or throttled)
function parseLocally(text) {
    const t = text.toLowerCase();

    // 1. All Lights On/Off
    if (t.includes('saari') || t.includes('sari') || t.includes('sab') || t.includes('all') || t.includes('jo light') || t.includes('zo light')) {
        if (t.includes('off') || t.includes('band') || t.includes('bujha')) {
            return { actionType: 'ALL_RELAYS', id: null, state: false, mode: null, speechReply: 'Turning off all lights, Boss.' };
        }
        if (t.includes('on') || t.includes('chalu') || t.includes('jala') || t.includes('kholo')) {
            return { actionType: 'ALL_RELAYS', id: null, state: true, mode: null, speechReply: 'Turning on all lights, Boss.' };
        }
    }

    // 2. Patterns
    if (t.includes('party') || t.includes('dance') || t.includes('auto')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 9, speechReply: 'Activating Party Auto Cycle mode, Boss.' };
    }
    if (t.includes('waterfall') || t.includes('cascade') || t.includes('jharna')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 2, speechReply: 'Starting Waterfall pattern, Boss.' };
    }
    if (t.includes('police') || t.includes('strobe')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 5, speechReply: 'Starting Police Strobe pattern, Boss.' };
    }
    if (t.includes('disco') || t.includes('twinkle') || t.includes('chamko')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 8, speechReply: 'Starting Disco pattern, Boss.' };
    }

    // 3. Individual Relays
    const numMap = {
        '1': 0, 'one': 0, 'ek': 0, 'pehla': 0, 'first': 0, 'fan': 0,
        '2': 1, 'two': 1, 'do': 1, 'dusra': 1, 'second': 1,
        '3': 2, 'three': 2, 'teen': 2, 'teesra': 2, 'third': 2,
        '4': 3, 'four': 3, 'char': 3, 'chautha': 3, 'fourth': 3,
        '5': 4, 'five': 4, 'panch': 4, 'panchwa': 4, 'fifth': 4,
        '6': 5, 'six': 5, 'che': 5, 'chatha': 5, 'sixth': 5,
        '7': 6, 'seven': 6, 'saat': 6, 'saatwa': 6, 'seventh': 6,
        '8': 7, 'eight': 7, 'aath': 7, 'aathwa': 7, 'eighth': 7, 'last': 7
    };

    let targetId = null;
    for (const [k, v] of Object.entries(numMap)) {
        if (new RegExp(`\\b${k}\\b`, 'i').test(t) || t.includes(k)) {
            targetId = v;
            break;
        }
    }

    if (targetId !== null) {
        const turnOff = t.includes('off') || t.includes('band') || t.includes('bujha');
        return {
            actionType: 'TOGGLE_RELAY',
            id: targetId,
            state: !turnOff,
            mode: null,
            speechReply: `Turning ${turnOff ? 'off' : 'on'} Relay ${targetId + 1}, Boss.`
        };
    }

    return null;
}

const processVoiceCommand = async (req, res) => {
    const { transcript } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!transcript || !transcript.trim()) {
        return res.status(400).json({ success: false, message: 'Transcript is required' });
    }

    console.log(`🎙️ Processing transcript: "${transcript}"`);

    // 1. Try Gemini AI Model
    if (apiKey) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: 'gemini-3.6-flash',
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                    maxOutputTokens: 500 // 👈 Sufficient token space to avoid empty output
                }
            });

            const prompt = `${SYSTEM_INSTRUCTION}\nUser Input: "${transcript}"`;
            const result = await model.generateContent(prompt);
            const rawResponse = result.response.text();

            console.log('🤖 Raw AI Output:', rawResponse);

            if (rawResponse && rawResponse.trim().length > 0) {
                let parsed;
                try {
                    parsed = JSON.parse(rawResponse);
                } catch (e) {
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
            }
        } catch (err) {
            console.warn('⚠️ Gemini call failed, activating instant local parser:', err.message);
        }
    }

    // 2. Safety Net: Local Intent Parser (Ensures zero downtime)
    const localResult = parseLocally(transcript);
    if (localResult) {
        console.log('⚡ Handled via Local Fallback Engine:', localResult);
        return res.status(200).json({
            success: true,
            ...localResult
        });
    }

    // 3. Unrecognized command response
    return res.status(200).json({
        success: true,
        actionType: 'UNKNOWN',
        id: null,
        state: null,
        mode: null,
        speechReply: "I couldn't quite catch that, Boss. Please say the switch or pattern name again."
    });
};

module.exports = { processVoiceCommand };