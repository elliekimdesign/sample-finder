// Vercel Serverless Function: /api/spotify
// Securely fetch Spotify app token and return track/artist metadata for a query

let cachedToken = null; // { access_token, expires_at }

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
    if (artistId) {
      const a = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const aData = await a.json();
      if (a.ok) artist = aData;
    }

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
          }
        : null,
      attribution: 'Images & data from Spotify',
    };

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify(payload));
  } catch (e) {
    console.error('API /api/spotify error', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message || 'Internal error' }));
  }
};


