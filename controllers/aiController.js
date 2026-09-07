require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ⚡ 1. ULTRA-FAST LOCAL INTENT ENGINE (Handles English + Hinglish + Pure Devanagari Hindi)
function fastPathParser(text) {
    if (!text) return null;
    const t = text.toLowerCase().trim();

    // --- A. ALL LIGHTS ON / OFF ---
    const hasAll =
        t.includes('all') || t.includes('sab') || t.includes('saari') || t.includes('sari') ||
        t.includes('ऑल') || t.includes('सब') || t.includes('सारी') || t.includes('सारी') ||
        t.includes('जो लाइट') || t.includes('जो लाइट्स') || t.includes('zo light');

    const hasTurnOff =
        t.includes('off') || t.includes('band') || t.includes('bujha') || t.includes('rok') ||
        t.includes('ऑफ') || t.includes('बंद') || t.includes('बुझा') || t.includes('रोक');

    const hasTurnOn =
        t.includes('on') || t.includes('chalu') || t.includes('jala') || t.includes('khol') || t.includes('start') ||
        t.includes('ऑन') || t.includes('चालू') || t.includes('जला') || t.includes('खोल') || t.includes('चला');

    if (hasAll) {
        if (hasTurnOff) {
            return { actionType: 'ALL_RELAYS', id: null, state: false, mode: null, speechReply: 'Turning off all lights, Boss.' };
        }
        if (hasTurnOn) {
            return { actionType: 'ALL_RELAYS', id: null, state: true, mode: null, speechReply: 'Turning on all lights, Boss.' };
        }
    }

    // --- B. LIGHTING ANIMATIONS (MODES 0 - 9) ---
    if (t.includes('party') || t.includes('dance') || t.includes('पार्टी') || t.includes('डांस') || t.includes('auto')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 9, speechReply: 'Starting Party mode, Boss.' };
    }
    if (t.includes('waterfall') || t.includes('cascade') || t.includes('jharna') || t.includes('झरना')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 2, speechReply: 'Starting Waterfall pattern, Boss.' };
    }
    if (t.includes('knight rider') || t.includes('scanner') || t.includes('ping pong') || t.includes('पिंग पोंग')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 3, speechReply: 'Starting Knight Rider pattern, Boss.' };
    }
    if (t.includes('police') || t.includes('strobe') || t.includes('पुलिस')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 5, speechReply: 'Starting Police Strobe pattern, Boss.' };
    }
    if (t.includes('tetris') || t.includes('stack') || t.includes('टेट्रिस')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 6, speechReply: 'Starting Tetris stack pattern, Boss.' };
    }
    if (t.includes('disco') || t.includes('twinkle') || t.includes('डिस्को') || t.includes('chamko') || t.includes('चमको')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 8, speechReply: 'Starting Disco pattern, Boss.' };
    }
    if (t.includes('normal') || t.includes('manual') || t.includes('सिंपल') || t.includes('मैनुअल')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 0, speechReply: 'Switched to Manual mode, Boss.' };
    }

    // --- C. INDIVIDUAL CHANNELS (RELAY 1 TO 8) ---
    const channelDictionary = [
        { id: 0, keys: ['1', 'one', 'ek', 'pehla', 'fan', 'एक', 'पहला', 'वन'] },
        { id: 1, keys: ['2', 'two', 'do', 'dusra', 'दो', 'दूसरा', 'टू'] },
        { id: 2, keys: ['3', 'three', 'teen', 'teesra', 'तीन', 'तीसरा', 'थ्री'] },
        { id: 3, keys: ['4', 'four', 'char', 'chautha', 'चार', 'चौथा', 'फोर'] },
        { id: 4, keys: ['5', 'five', 'panch', 'panchwa', 'पांच', 'पाँच', 'पांचवां', 'फाइव'] },
        { id: 5, keys: ['6', 'six', 'che', 'chatha', 'छह', 'छः', 'छठा', 'सिक्स'] },
        { id: 6, keys: ['7', 'seven', 'saat', 'saatwa', 'सात', 'सातवां', 'सेवन'] },
        { id: 7, keys: ['8', 'eight', 'aath', 'aathwa', 'आठ', 'आठवां', 'एट', 'last'] }
    ];

    let targetId = null;
    for (const ch of channelDictionary) {
        for (const k of ch.keys) {
            const pattern = new RegExp(`(^|\\s|[0-9])${k}(\\s|[0-9]|$)`, 'i');
            if (pattern.test(t) || t.includes(`relay ${k}`) || t.includes(`रिले ${k}`) || t.includes(`${k} नंबर`)) {
                targetId = ch.id;
                break;
            }
        }
        if (targetId !== null) break;
    }

    if (targetId !== null && (hasTurnOn || hasTurnOff)) {
        const turnOff = hasTurnOff && !hasTurnOn;
        return {
            actionType: 'TOGGLE_RELAY',
            id: targetId,
            state: !turnOff,
            mode: null,
            speechReply: `Turning ${turnOff ? 'off' : 'on'} Relay ${targetId + 1}, Boss.`
        };
    }

    return null; // Fast-path me match nahi mila -> Ab Gemini sambhalega
}

// 🧠 2. GEMINI AI FALLBACK CONFIG
const SYSTEM_INSTRUCTION = `
You are an ultra-fast smart home voice parser for an 8-channel relay board.
The user input may be in Hindi (Devanagari), Hinglish, or English.
Phonetically infer casual speech and typos.

MAPS:
- Channel 1 to 8 -> id 0 to 7
- State: ON -> true | OFF -> false
- All Lights: "all on" -> actionType: "ALL_RELAYS", state: true | "all off" -> actionType: "ALL_RELAYS", state: false
- Modes (0-9): 0:manual, 1:all on, 2:waterfall, 3:ping pong, 4:center out, 5:police, 6:tetris, 7:runner, 8:disco, 9:party

CRITICAL:
- speechReply MUST BE SHORT, POLITE ENGLISH ONLY.

JSON Schema:
{
  "actionType": "TOGGLE_RELAY" | "ALL_RELAYS" | "SET_MODE" | "UNKNOWN",
  "id": number | null,
  "state": boolean | null,
  "mode": number | null,
  "speechReply": string
}
`;

const processVoiceCommand = async (req, res) => {
    const { transcript } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!transcript || !transcript.trim()) {
        return res.status(400).json({ success: false, message: 'Transcript is required' });
    }

    console.log(`🎙️ Voice Transcript: "${transcript}"`);

    // ⚡ STEP 1: FAST-PATH EXECUTION (0 Milliseconds Lag)
    const fastResult = fastPathParser(transcript);
    if (fastResult) {
        console.log('🚀 [INSTANT 0ms FAST-PATH MATCH]:', fastResult.speechReply);
        return res.status(200).json({
            success: true,
            ...fastResult
        });
    }

    // 🌐 STEP 2: GEMINI AI FOR COMPLEX / UNCOMMON SENTENCES
    if (apiKey) {
        try {
            console.log('🤖 Sending complex query to Gemini 3.6-Flash...');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: 'gemini-3.6-flash',
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                    maxOutputTokens: 300
                }
            });

            const prompt = `${SYSTEM_INSTRUCTION}\nUser Spoken Text: "${transcript}"`;
            const result = await model.generateContent(prompt);
            const rawResponse = result.response.text();

            console.log('🤖 Raw AI Output:', rawResponse);

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

        } catch (err) {
            console.warn('⚠️ Gemini AI failed or 503 busy:', err.message);
        }
    }

    // 🛑 STEP 3: Fallback response agar bilkul samajh na aaye
    return res.status(200).json({
        success: true,
        actionType: 'UNKNOWN',
        id: null,
        state: null,
        mode: null,
        speechReply: "Sorry Boss, I couldn't recognize that command."
    });
};

module.exports = { processVoiceCommand };