// Vercel Serverless Function: /api/samples
// Identify music samples using Perplexity Sonar with real-time web search

import { perplexity } from '@ai-sdk/perplexity';

const perplexityClient = perplexity({
  apiKey: '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',
});

// JSON schema for structured output with real-time web search results
const responseSchema = {
  type: "object",
  properties: {
    query_song: {
      type: "object",
      properties: {
        title: { type: "string" },
        artist: { type: ["string", "null"] },
        youtube_url: { type: ["string", "null"] },
        youtube_title: { type: ["string", "null"] }
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
        note: { type: ["string", "null"] },
        youtube_url: { type: ["string", "null"] },
        youtube_title: { type: ["string", "null"] }
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

const systemPrompt = `You are a super knowledgeable music-data assistant that has deep expertise in sample identification and can search the web in real-time to find accurate information.

First, normalize and disambiguate query into a canonical {title, artist}:
• Fix common typos; strip quotes/emojis/noise.
• If multiple songs share the title, pick the most famous: prioritize cultural prominence (chart success, streaming ubiquity, critical acclaim, meme/film/TV usage). If still tied, choose the earliest widely known release.

Then, for both the query song and its main sample:
• Search the web to find the best YouTube URLs and actual video titles
• For the query song, prioritize official music videos, then official audio, then most popular uploads
• For samples, find the original source recording when possible
• Return the actual YouTube URL and the exact title of the YouTube video (which may differ from the song title)
• Use web search to verify sample information and find the most accurate details

If you are not confident about either the resolved song or its main sample, respond with status: "unknown" and use null for uncertain fields.

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
        query_song: { title: "", artist: null, youtube_url: null, youtube_title: null },
        main_sample: { title: null, artist: null, confidence: 0.0, note: null, youtube_url: null, youtube_title: null },
        status: "unknown"
      }));
    }

    query = query.trim();

    // Call Perplexity API with Sonar model for web search capabilities
    const completion = await perplexityClient.chat({
      model: "sonar-medium-online",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Given query: "${query}". Resolve to a specific song (title + artist) and return the main/primary sample in the JSON schema. For both the song and sample, search the web to find the best YouTube URLs and return them along with the actual YouTube video titles.`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sample_identification_with_youtube",
          strict: true,
          schema: responseSchema
        }
      },
      // Perplexity Sonar can search the web in real-time for accurate information
    });

    // Parse the response
    const content = completion.choices?.[0]?.message?.content || completion.content;
    if (!content) {
      throw new Error('Empty response from Perplexity');
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      throw new Error('Invalid JSON response from Perplexity: ' + parseError.message);
    }

    // Validate the response structure
    if (!result.query_song || !result.main_sample || !result.status) {
      throw new Error('Incomplete response structure from Perplexity');
    }

    // Ensure all required fields are present with defaults for backward compatibility
    const validatedResult = {
      query_song: {
        title: result.query_song.title || "",
        artist: result.query_song.artist || null,
        youtube_url: result.query_song.youtube_url || null,
        youtube_title: result.query_song.youtube_title || null
      },
      main_sample: {
        title: result.main_sample.title || null,
        artist: result.main_sample.artist || null,
        confidence: result.main_sample.confidence || 0.0,
        note: result.main_sample.note || null,
        youtube_url: result.main_sample.youtube_url || null,
        youtube_title: result.main_sample.youtube_title || null
      },
      status: result.status || "unknown"
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800'); // Cache for 1 hour
    res.statusCode = 200;
    res.end(JSON.stringify(validatedResult));

  } catch (error) {
    console.error('API /api/samples error:', error);
    
    // Return minimal error response in expected format with YouTube fields
    const errorResponse = {
      query_song: { title: "", artist: null, youtube_url: null, youtube_title: null },
      main_sample: { title: null, artist: null, confidence: 0.0, note: `Error: ${error.message}`, youtube_url: null, youtube_title: null },
      status: "unknown"
    };

    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(errorResponse));
  }
}
