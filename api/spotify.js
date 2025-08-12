// Vercel Serverless Function: /api/spotify
// Securely fetch Spotify app token and return track/artist metadata for a query

let cachedToken = null; // { access_token, expires_at }
const responseCache = new Map(); // key -> { data, expires }
const RESPONSE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    responseCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCached(key, data) {
  responseCache.set(key, { data, expires: Date.now() + RESPONSE_TTL_MS });
}

function truncateBio(text) {
  if (!text) return null;
  // keep first sentence; fallback to 280 chars
  const firstSentence = text.split(/(?<=\.)\s/)[0] || text;
  const trimmed = firstSentence.length > 280 ? firstSentence.slice(0, 277) + '...' : firstSentence;
  return trimmed;
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 1000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function getAppToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
  }

  const now = Date.now();
  if (cachedToken && now < cachedToken.expires_at - 30_000) {
    return cachedToken.access_token;
  }

  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization:
        'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await r.json();
  if (!r.ok) {
    console.error('Spotify token error', data);
    throw new Error('Failed to fetch Spotify token');
  }

  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.access_token;
}

module.exports = async function handler(req, res) {
  try {
    const q = (req.query && req.query.q) || (new URL(req.url, 'http://x').searchParams.get('q')) || '';
    if (!q) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Missing q' }));
    }

    const token = await getAppToken();

    // 1) Search track
    const searchUrl = 'https://api.spotify.com/v1/search?' + new URLSearchParams({
      q,
      type: 'track',
      limit: '1',
    });
    const s = await fetch(searchUrl, { headers: { Authorization: `Bearer ${token}` } });
    const sData = await s.json();
    if (!s.ok) {
      console.error('Spotify search error', sData);
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'Spotify search failed' }));
    }

    const track = sData?.tracks?.items?.[0];
    if (!track) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'No track found' }));
    }

    // 2) Artist details
    const artistId = track.artists?.[0]?.id;
    let artist = null;
    // Fetch artist details and a short wiki summary in parallel (best-effort)
    const artistNameFromTrack = track?.artists?.[0]?.name;
    const [artistRes, wikiRes] = await Promise.all([
      (async () => {
        if (!artistId) return null;
        const a = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const aData = await a.json();
        if (a.ok) return aData;
        return null;
      })(),
      (async () => {
        try {
          const name = artistNameFromTrack;
          if (!name) return { bio: null, url: null };
          const title = encodeURIComponent(name);
          const w = await fetchWithTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {}, 1000);
          if (!w.ok) return { bio: null, url: null };
          const wData = await w.json();
          return {
            bio: truncateBio(wData?.extract || ''),
            url: wData?.content_urls?.desktop?.page || null,
          };
        } catch {
          return { bio: null, url: null };
        }
      })(),
    ]);

    artist = artistRes;
    const artistBio = wikiRes?.bio || null;
    const artistWikiUrl = wikiRes?.url || null;

    const payload = {
      track: {
        id: track.id,
        name: track.name,
        artists: track.artists.map((a) => ({ id: a.id, name: a.name })),
        album: {
          id: track.album.id,
          name: track.album.name,
          images: track.album.images || [],
        },
        year: (track.album.release_date || '').slice(0, 4),
        spotifyUrl: track.external_urls?.spotify,
      },
      artist: artist
        ? {
            id: artist.id,
            name: artist.name,
            images: artist.images || [],
            genres: artist.genres || [],
            followers: artist.followers?.total || 0,
            spotifyUrl: artist.external_urls?.spotify,
            bio: artistBio,
            wikipediaUrl: artistWikiUrl,
          }
        : null,
      attribution: 'Images & data from Spotify',
    };

    // Cache and send
    const cacheKey = `q:${q}`;
    setCached(cacheKey, payload);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
    res.statusCode = 200;
    res.end(JSON.stringify(payload));
  } catch (e) {
    console.error('API /api/spotify error', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message || 'Internal error' }));
  }
};


