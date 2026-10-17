/**
 * Appwrite Function: Gemini AI Reading Companion Proxy
 * 
 * Environment Variables required:
 * - GEMINI_API_KEY: Your Google Gemini API Key
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async function (context) {
  const { req, res, error } = context;

  if (req.method === 'OPTIONS') {
    return res.empty();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({ error: 'Missing GEMINI_API_KEY in Appwrite Function settings' }, 500);
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { prompt, bookTitle, author, currentPage, extractedContextSoFar, userPrompt } = body;

    const genAI = new GoogleGenerativeAI(apiKey);
    const targetModel = body.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ model: targetModel });

    // Enforce strict spoiler-free boundary
    const systemInstruction = `
You are a private, spoiler-safe reading companion for the book "${bookTitle || 'Unknown'}" by ${author || 'Unknown'}.
The reader is currently at page ${currentPage || 1}.
CONTEXT OF THE BOOK UP TO PAGE ${currentPage || 1}:
"""
${extractedContextSoFar || 'Beginning chapters of the book.'}
"""

CRITICAL SPOILER-FREE RULES:
1. You ONLY know the plot, character backgrounds, and events up to page ${currentPage || 1}.
2. You must NEVER reveal or hint at any events after page ${currentPage || 1}.
3. If the user asks about an event or character not yet introduced, explicitly state that it hasn't appeared yet in their reading so far.
4. Keep explanations engaging, concise, and helpful.
`;

    const fullPrompt = `${systemInstruction}\n\nUser Question: ${userPrompt || prompt}`;
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const reply = response.text();

    return res.json({ reply, text: reply });
  } catch (err) {
    error('Gemini proxy error: ' + err.message);
    return res.json({ error: err.message }, 500);
  }
};
