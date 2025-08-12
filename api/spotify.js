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

function formatBio(text) {
  if (!text) return null;
  // Return full text, but limit to reasonable length for UI
  const maxLength = 800; // Increased from 280 to show more content
  if (text.length <= maxLength) return text;
  
  // Try to break at sentence boundary
  const sentences = text.split(/(?<=\.)\s/);
  let result = '';
  for (const sentence of sentences) {
    if ((result + sentence).length > maxLength) break;
    result += (result ? ' ' : '') + sentence;
  }
  
  return result || text.slice(0, maxLength - 3) + '...';
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

export default async function handler(req, res) {
  // Add CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

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
    
    console.log('🎵 Spotify Track Data:', {
      name: track.name,
      artists: track.artists?.map(a => a.name),
      albumName: track.album?.name,
      albumImageCount: track.album?.images?.length || 0,
      albumImages: track.album?.images
    });

    // 2) Get best artist image and primary artist details - DEFINE FUNCTION FIRST
    const getArtistOrAlbumImage = async (track) => {
      console.log('🚀 getArtistOrAlbumImage STARTED for track:', track.name);
      try {
        // 1) Fetch ALL individual artists
        const artistIds = (track?.artists || []).map(a => a.id).filter(Boolean);
        console.log('🎯 Fetching artists:', artistIds);

        // 2) Collect artist images from all artists
        const artists = await Promise.allSettled(
          artistIds.map(id =>
            fetch(`https://api.spotify.com/v1/artists/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => {
              console.log('🎨 Artist status:', id, r.status);
              if (!r.ok) throw new Error('artist ' + r.status);
              return r.json();
            })
          )
        );

        // 3) Find first artist with images and return detailed artist info
        for (const a of artists) {
          if (a.status === 'fulfilled' && Array.isArray(a.value.images) && a.value.images.length) {
            console.log('✅ Found artist with images:', a.value.name, a.value.images.length);
            console.log('🎨 Artist details:', {
              genres: a.value.genres,
              followers: a.value.followers?.total,
              popularity: a.value.popularity
            });
            return {
              image: a.value.images[0].url,
              artist: a.value
            };
          }
        }

        // 4) Fallback to album image
        if (Array.isArray(track?.album?.images) && track.album.images.length) {
          console.log('📀 Using album image as fallback');
          return {
            image: track.album.images[0].url,
            artist: artists.find(a => a.status === 'fulfilled')?.value || null
          };
        }

        console.log('❌ No images found anywhere');
        return { image: null, artist: null };
      } catch (err) {
        console.error('💥 Image resolve error:', err);
        return {
          image: track?.album?.images?.[0]?.url || null,
          artist: null
        };
      }
    };

    const artistNameFromTrack = track?.artists?.[0]?.name;
    const [imageResult, wikiRes] = await Promise.all([
      getArtistOrAlbumImage(track),
      (async () => {
        try {
          const name = artistNameFromTrack;
          if (!name) return { bio: null, url: null };
          const title = encodeURIComponent(name);
          
          // Try to get full page content first, fallback to summary
          let bio = null;
          let url = null;
          
          try {
            // Try full page content
            const wFull = await fetchWithTimeout(`https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${title}&prop=extracts&exintro=0&explaintext=1&exsectionformat=plain&origin=*`, {}, 2000);
            if (wFull.ok) {
              const wFullData = await wFull.json();
              const pages = wFullData?.query?.pages;
              if (pages) {
                const pageId = Object.keys(pages)[0];
                const pageData = pages[pageId];
                if (pageData && !pageData.missing && pageData.extract) {
                  bio = formatBio(pageData.extract);
                  url = `https://en.wikipedia.org/wiki/${title}`;
                }
              }
            }
          } catch (e) {
            console.log('Full page fetch failed, trying summary:', e.message);
          }
          
          // Fallback to summary if full page failed
          if (!bio) {
            const w = await fetchWithTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {}, 1000);
            if (w.ok) {
              const wData = await w.json();
              bio = formatBio(wData?.extract || '');
              url = wData?.content_urls?.desktop?.page || null;
            }
          }
          
          return { bio, url };
        } catch {
          return { bio: null, url: null };
        }
      })(),
    ]);

    const artist = imageResult?.artist;
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
            popularity: artist.popularity || 0,
            spotifyUrl: artist.external_urls?.spotify,
            bio: artistBio,
            wikipediaUrl: artistWikiUrl,
            // Add the best image found
            bestImage: imageResult?.image,
            // Add comprehensive artist description
            description: artistBio || `${artist.name} is an artist with ${artist.followers?.total?.toLocaleString() || 0} followers on Spotify.${artist.genres?.length ? ` Known for: ${artist.genres.slice(0, 3).join(', ')}.` : ''}`,
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
}


