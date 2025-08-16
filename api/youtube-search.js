// Vercel Serverless Function: /api/youtube-search
// Find accurate YouTube URLs for songs using Perplexity with specific search strategies

import OpenAI from 'openai';

const perplexityClient = new OpenAI({
  apiKey: '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',
  baseURL: 'https://api.perplexity.ai'
});

// JSON schema for YouTube search results
const youtubeSearchSchema = {
  type: "object",
  properties: {
    youtube_url: { type: ["string", "null"] },
    youtube_title: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0.0, maximum: 1.0 },
    search_strategy_used: { type: "string" }
  },
  required: ["youtube_url", "youtube_title", "confidence", "search_strategy_used"],
  additionalProperties: false
};

const youtubeSearchPrompt = `You are a YouTube search specialist. Your job is to find the OFFICIAL, ORIGINAL version of a song on YouTube.

SEARCH PRIORITIES (in order):
1. Official music video from the artist's verified channel
2. Official audio from the artist's verified channel  
3. Official uploads from the record label's verified channel
4. High-quality uploads with millions of views (but verify artist/title match exactly)

AVOID AT ALL COSTS:
- Karaoke versions
- Cover versions
- Remix versions (unless specifically requested)
- Lyric videos (unless no official video exists)
- Low-quality uploads
- Fan uploads when official versions exist
- Live performances (unless specifically requested)

VERIFICATION STEPS:
1. Check that the YouTube video title contains the exact song title
2. Verify the artist name matches (account for variations like "Jay-Z" vs "JAY-Z")
3. Look for verified channel indicators (checkmarks)
4. Prefer videos with higher view counts when quality is equal
5. Check upload date - newer official uploads often have better quality

Return the best YouTube URL you find, along with the exact title of the video and your confidence level.

If you cannot find a reliable official version, return null values and explain why in search_strategy_used.

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
    // Extract song info from request
    let songTitle, artist;
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      songTitle = body?.title;
      artist = body?.artist;
    } else {
      songTitle = req.query?.title;
      artist = req.query?.artist;
    }

    // Validate input
    if (!songTitle || !artist) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ 
        error: 'Missing title or artist parameter',
        youtube_url: null,
        youtube_title: null,
        confidence: 0.0,
        search_strategy_used: 'error'
      }));
    }

    // Call Perplexity API for YouTube search
    const completion = await perplexityClient.chat.completions.create({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: youtubeSearchPrompt
        },
        {
          role: "user",
          content: `Find the official YouTube video for: "${songTitle}" by ${artist}. Search for the original, official version - avoid karaoke, covers, or remixes.`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "youtube_search_result",
          strict: true,
          schema: youtubeSearchSchema
        }
      },
      search_mode: "web",
      temperature: 0.1, // Very low temperature for consistent results
      max_tokens: 1000,
    });

    // Parse the response
    const content = completion.choices[0]?.message?.content;
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
    if (typeof result !== 'object' || result === null) {
      throw new Error('Invalid response structure from Perplexity');
    }

    // Ensure all required fields are present with defaults
    const validatedResult = {
      youtube_url: result.youtube_url || null,
      youtube_title: result.youtube_title || null,
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.0,
      search_strategy_used: result.search_strategy_used || 'unknown'
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=3600'); // Cache for 2 hours
    res.statusCode = 200;
    res.end(JSON.stringify(validatedResult));

  } catch (error) {
    console.error('API /api/youtube-search error:', error);
    
    // Return error response in expected format
    const errorResponse = {
      youtube_url: null,
      youtube_title: null,
      confidence: 0.0,
      search_strategy_used: `Error: ${error.message}`
    };

    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(errorResponse));
  }
}
