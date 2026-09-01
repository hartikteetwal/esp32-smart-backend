const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const processVoiceCommand = async (req, res) => {
    try {
        const { transcript } = req.body;

        if (!transcript || !transcript.trim()) {
            return res.status(400).json({ success: false, message: 'Voice transcript is required' });
        }

        const systemPrompt = `
You are an intelligent home automation voice assistant for an 8-channel smart relay system and chasing pattern studio.
Parse the user's spoken command into a structured execution payload.

System Capabilities:
1. Single Relay Control: Relays 1 to 8 (index 0 to 7). Actions: ON (true), OFF (false).
2. Master Controls: Turn all relays ON or OFF.
3. Lighting Patterns (Modes 0 to 9):
   - 0: Manual Switch Mode
   - 1: Static Full On
   - 2: Chasing Cascade / Waterfall
   - 3: Knight Rider / Scanner
   - 4: Center-Out Burst
   - 5: Alternate Flip-Flop
   - 6: Stacking Tetris
   - 7: Comet Runner
   - 8: Soft Twinkle
   - 9: Auto Cycle All Patterns

Rules:
- If user refers to "Relay 1" or "First light", id = 0.
- If user refers to "Relay 8" or "Eighth light", id = 7.
- If command does not match any action, return actionType = 'UNKNOWN' with a polite error response.
`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: transcript,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        actionType: {
                            type: Type.STRING,
                            enum: ['TOGGLE_RELAY', 'ALL_RELAYS', 'SET_MODE', 'UNKNOWN'],
                            description: 'The classified action command'
                        },
                        id: {
                            type: Type.INTEGER,
                            description: 'Relay index (0 to 7) if actionType is TOGGLE_RELAY'
                        },
                        state: {
                            type: Type.BOOLEAN,
                            description: 'Target boolean state for relay or all relays'
                        },
                        mode: {
                            type: Type.INTEGER,
                            description: 'Pattern mode index (0 to 9) if actionType is SET_MODE'
                        },
                        speechReply: {
                            type: Type.STRING,
                            description: 'Short, natural confirmation phrase to speak back to the user (e.g., "Turning on Relay 1, Boss.")'
                        }
                    },
                    required: ['actionType', 'speechReply']
                }
            }
        });

        const parsedAction = JSON.parse(response.text);
        return res.status(200).json({ success: true, ...parsedAction });
    } catch (err) {
        console.error('Gemini AI Voice Error:', err);
        return res.status(500).json({
            success: false,
            speechReply: 'Sorry Boss, I encountered an issue processing that command.'
        });
    }
};

module.exports = { processVoiceCommand };