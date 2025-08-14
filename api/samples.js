// Vercel Serverless Function: /api/samples
// Identify music samples using OpenAI o3-mini with structured outputs

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// JSON schema for structured output
const responseSchema = {
  type: "object",
  properties: {
    query_song: {
      type: "object",
      properties: {
        title: { type: "string" },
        artist: { type: ["string", "null"] }
      },
      required: ["title", "artist"],
      additionalProperties: false
    },
    main_sample: {
      type: "object",
      properties: {
        title: { type: ["string", "null"] },
        artist: { type: ["string", "null"] },
        confidence: { type: "number", minimum: 0.0, maximum: 1.0 },
        note: { type: ["string", "null"] }
      },
      required: ["title", "artist", "confidence", "note"],
      additionalProperties: false
    },
    status: {
      type: "string",
      enum: ["ok", "unknown"]
    }
  },
  required: ["query_song", "main_sample", "status"],
  additionalProperties: false
};

const systemPrompt = `You are a cautious music-data assistant; rely ONLY on internal knowledge.

First, normalize and disambiguate query into a canonical {title, artist}:
• Fix common typos; strip quotes/emojis/noise.
• If multiple songs share the title, pick the most famous: prioritize cultural prominence (chart success, streaming ubiquity, critical acclaim, meme/film/TV usage). If still tied, choose the earliest widely known release.

If you are not ≥70% confident about either the resolved song or its main sample, respond with status: "unknown" and use null for uncertain fields.

Never invent song or artist names.

Return JSON only — no prose.`;

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  try {
    // Extract query from request
    let query;
    if (req.method === 'POST') {
      // Handle POST request with JSON body
      if (typeof req.body === 'string') {
        const parsed = JSON.parse(req.body);
        query = parsed.query;
      } else {
        query = req.body?.query;
      }
    } else {
      // Handle GET request with query parameter
      query = req.query?.query || req.query?.q || '';
    }

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ 
        error: 'Missing or invalid query parameter',
        query_song: { title: "", artist: null },
        main_sample: { title: null, artist: null, confidence: 0.0, note: null },
        status: "unknown"
      }));
    }

    query = query.trim();

    // Call OpenAI API with structured output
    const completion = await openai.chat.completions.create({
      model: "o3-mini",
      seed: 7,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Given query: "${query}". Resolve to a specific song (title + artist) and return the main/primary sample in the JSON schema.`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sample_identification",
          strict: true,
          schema: responseSchema
        }
      }
    });

    // Parse the response
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      throw new Error('Invalid JSON response from OpenAI: ' + parseError.message);
    }

    // Validate the response structure
    if (!result.query_song || !result.main_sample || !result.status) {
      throw new Error('Incomplete response structure from OpenAI');
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800'); // Cache for 1 hour
    res.statusCode = 200;
    res.end(JSON.stringify(result));

  } catch (error) {
    console.error('API /api/samples error:', error);
    
    // Return minimal error response in expected format
    const errorResponse = {
      query_song: { title: "", artist: null },
      main_sample: { title: null, artist: null, confidence: 0.0, note: `Error: ${error.message}` },
      status: "unknown"
    };

    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(errorResponse));
  }
}
