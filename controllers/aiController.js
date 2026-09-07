require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ⚡ 1. ULTRA-COMPREHENSIVE FAST-PATH ENGINE (0ms, Zero Gemini API Dependency)
function fastPathParser(text) {
    if (!text) return null;
    const t = text.toLowerCase().trim();

    // --- A. ALL LIGHTS COMMANDS ---
    const hasAll =
        t.includes('all') || t.includes('sab') || t.includes('saari') || t.includes('sari') ||
        t.includes('ऑल') || t.includes('सब') || t.includes('सारी') || t.includes('सारे') ||
        t.includes('जो लाइट') || t.includes('जो लाइट्स') || t.includes('zo light') || t.includes('so light');

    const hasTurnOff =
        t.includes('off') || t.includes('band') || t.includes('bujha') || t.includes('rok') || t.includes('close') ||
        t.includes('ऑफ') || t.includes('बंद') || t.includes('बुझा') || t.includes('रोक');

    const hasTurnOn =
        t.includes('on') || t.includes('chalu') || t.includes('jala') || t.includes('khol') || t.includes('start') ||
        t.includes('ऑन') || t.includes('चालू') || t.includes('जला') || t.includes('खोल') || t.includes('चला') || t.includes('टर्न');

    if (hasAll) {
        if (hasTurnOff && !hasTurnOn) {
            return { actionType: 'ALL_RELAYS', id: null, state: false, mode: null, speechReply: 'Turning off all lights, Boss.' };
        }
        return { actionType: 'ALL_RELAYS', id: null, state: true, mode: null, speechReply: 'Turning on all lights, Boss.' };
    }

    // --- B. MODE & PATTERN COMMANDS ---
    // Mode Change / Cycle Request (e.g., "मोड चेंज करो", "चेंज द मोड", "नेक्स्ट पैटर्न")
    if (t.includes('मोड चेंज') || t.includes('चेंज द मोड') || t.includes('change mode') || t.includes('next mode') || t.includes('अगला मोड') || t.includes('mode badlo')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 9, speechReply: 'Switching lighting animation mode, Boss.' };
    }
    if (t.includes('party') || t.includes('dance') || t.includes('पार्टी') || t.includes('डांस') || t.includes('auto') || t.includes('ऑटो')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 9, speechReply: 'Starting Party Auto-Cycle mode, Boss.' };
    }
    if (t.includes('waterfall') || t.includes('cascade') || t.includes('jharna') || t.includes('झरना') || t.includes('वाटरफॉल')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 2, speechReply: 'Starting Waterfall pattern, Boss.' };
    }
    if (t.includes('knight rider') || t.includes('scanner') || t.includes('ping pong') || t.includes('नाइट राइडर') || t.includes('पिंग पोंग')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 3, speechReply: 'Starting Ping Pong runner pattern, Boss.' };
    }
    if (t.includes('center out') || t.includes('burst') || t.includes('सेंटर')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 4, speechReply: 'Starting Center Out pattern, Boss.' };
    }
    if (t.includes('police') || t.includes('strobe') || t.includes('पुलिस') || t.includes('स्ट्रोब')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 5, speechReply: 'Starting Police Strobe pattern, Boss.' };
    }
    if (t.includes('tetris') || t.includes('stack') || t.includes('टेट्रिस') || t.includes('स्टैक')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 6, speechReply: 'Starting Tetris stack pattern, Boss.' };
    }
    if (t.includes('disco') || t.includes('twinkle') || t.includes('डिस्को') || t.includes('chamko') || t.includes('चमको')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 8, speechReply: 'Starting Disco pattern, Boss.' };
    }
    if (t.includes('normal') || t.includes('manual') || t.includes('सिंपल') || t.includes('मैनुअल') || t.includes('रेगुलर')) {
        return { actionType: 'SET_MODE', id: null, state: null, mode: 0, speechReply: 'Switched to Manual switch mode, Boss.' };
    }

    // --- C. INDIVIDUAL CHANNELS (RELAY 1 TO 8) ---
    const channelDictionary = [
        { id: 0, keys: ['first', '1st', '1', 'one', 'ek', 'pehla', 'fan', 'फर्स्ट', 'एक', 'पहला', 'वन'] },
        { id: 1, keys: ['second', '2nd', '2', 'two', 'do', 'dusra', 'सेकंड', 'दो', 'दूसरा', 'टू'] },
        { id: 2, keys: ['third', '3rd', '3', 'three', 'teen', 'teesra', 'थर्ड', 'तीन', 'तीसरा', 'थ्री'] },
        { id: 3, keys: ['fourth', '4th', '4', 'four', 'char', 'chautha', 'फोर्थ', 'चार', 'चौथा', 'फोर'] },
        { id: 4, keys: ['fifth', '5th', '5', 'five', 'panch', 'panchwa', 'फिफ्थ', 'पांच', 'पाँच', 'पांचवां', 'फाइव'] },
        { id: 5, keys: ['sixth', '6th', '6', 'six', 'che', 'chatha', 'सिक्स्थ', 'छह', 'छः', 'छठा', 'सिक्स'] },
        { id: 6, keys: ['seventh', '7th', '7', 'seven', 'saat', 'saatwa', 'सेवंथ', 'सात', 'सातवां', 'सेवन'] },
        { id: 7, keys: ['eighth', '8th', '8', 'eight', 'aath', 'aathwa', 'last', 'एट्थ', 'आठ', 'आठवां', 'एट', 'लास्ट'] }
    ];

    let targetId = null;
    for (const ch of channelDictionary) {
        for (const k of ch.keys) {
            // Whole word or substring check
            const regex = new RegExp(`(^|\\s|[0-9])${k}(\\s|[0-9]|$)`, 'i');
            if (regex.test(t) || t.includes(k)) {
                targetId = ch.id;
                break;
            }
        }
        if (targetId !== null) break;
    }

    if (targetId !== null) {
        // Explicit off bola ho tabhi OFF karo, warna natural intent ON hota hai
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

// 🧠 2. GEMINI AI FALLBACK WITH STRICT SYSTEM INSTRUCTION
const SYSTEM_INSTRUCTION = `
You are an ultra-fast IoT parser for an 8-channel relay board.
The user's spoken input may be in Hindi (Devanagari), English, or Hinglish.
Infer the intent even with typos or spoken slang.

MAPPING:
- 1, first, pehla, ek -> 0 | 2, second, do -> 1 | 3, third, teen -> 2 | 4, fourth, char -> 3
- 5, fifth, panch -> 4 | 6, sixth, che -> 5 | 7, seventh, saat -> 6 | 8, eighth, aath -> 7
- State: ON/jalao/chalu/start -> true | OFF/band/bujhao -> false (Default to true if ambiguous)
- All: "all on", "all off" -> ALL_RELAYS
- Modes: 0:manual, 1:all on, 2:waterfall, 3:ping pong, 4:center out, 5:police, 6:tetris, 7:runner, 8:disco, 9:party

CRITICAL: speechReply MUST BE SHORT, CRISP ENGLISH ONLY.

Return ONLY a raw valid JSON object:
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

    // ⚡ 1. INSTANT FAST-PATH EXECUTION (0ms, no network delay, no 503 errors)
    const fastResult = fastPathParser(transcript);
    if (fastResult) {
        console.log('🚀 [0ms FAST-PATH HIT]:', fastResult.speechReply);
        return res.status(200).json({
            success: true,
            ...fastResult
        });
    }

    // 🌐 2. GEMINI AI FALLBACK
    if (apiKey) {
        try {
            console.log('🤖 Invoking Gemini 3.6-Flash for complex query...');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: 'gemini-3.6-flash',
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                    maxOutputTokens: 300
                }
            });

            const prompt = `${SYSTEM_INSTRUCTION}\nUser Input: "${transcript}"`;
            const result = await model.generateContent(prompt);
            const raw = result.response.text();

            console.log('🤖 Raw AI Output:', raw);

            // Clean JSON extraction
            const jsonStart = raw.indexOf('{');
            const jsonEnd = raw.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const cleanedJson = raw.substring(jsonStart, jsonEnd + 1);
                const parsed = JSON.parse(cleanedJson);

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
            console.warn('⚠️ Gemini AI failure:', err.message);
        }
    }

    // 🛑 3. Fallback
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