import { useState, useEffect } from "react";
import ReactPlayer from "react-player";

// Placeholder discover list; replace items with real album art and YouTube links
const initialDiscover = [
  { title: "Next sampled track", artist: "TBD", thumbnail: "", youtube: "" },
  { title: "Another discovery", artist: "TBD", thumbnail: "", youtube: "" },
  { title: "Coming soon", artist: "TBD", thumbnail: "", youtube: "" },
];

export default function SampleFinderApp() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [discoverList] = useState(() => initialDiscover);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelData, setPanelData] = useState(null);
  const [spotifyData, setSpotifyData] = useState(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyError, setSpotifyError] = useState('');
  const [spotifyCovers, setSpotifyCovers] = useState({}); // key: `${title}|${artist}` -> album image url
  const [spotifyInfo, setSpotifyInfo] = useState({}); // key -> { title, artists, year, coverUrl }
  const [dominantColors, setDominantColors] = useState({}); // key -> { r,g,b }
  const [genrePool, setGenrePool] = useState([]); // unique list of genres from Spotify

  // Prefer serverless API on Vercel; fall back to Vercel prod domain on static hosts (e.g., GitHub Pages)
  const apiBase = (import.meta?.env?.VITE_API_BASE) || (typeof window !== 'undefined' && (window.__VITE_API_BASE__ || (window.location.hostname.endsWith('github.io') ? 'https://samplr-red.vercel.app' : '')));

  async function fetchSpotifyJson(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error(`Spotify API ${res.status}`);
    if (!ct.includes('application/json')) throw new Error('Non-JSON response');
    return res.json();
  }

  // Lightweight dominant color extraction using canvas (best-effort)
  async function extractDominantColor(imageUrl) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const size = 24;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0, size, size);
            const { data } = ctx.getImageData(0, 0, size, size);
            let r = 0, g = 0, b = 0, count = 0;
            for (let i = 0; i < data.length; i += 4) {
              const alpha = data[i + 3];
              if (alpha < 200) continue; // skip transparent
              r += data[i]; g += data[i + 1]; b += data[i + 2];
              count++;
            }
            if (count === 0) return resolve(null);
            resolve({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) });
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = imageUrl;
      } catch {
        resolve(null);
      }
    });
  }

  // Resolve album cover from Spotify for a given title/artist
  async function resolveAlbumCover(title, artist) {
    const key = `${title}|${artist}`;
    if (spotifyCovers[key]) return spotifyCovers[key];
    const q = encodeURIComponent(`${title} ${artist}`.trim());
    const endpoints = [
      `${apiBase}/api/spotify/search?q=${q}`,
      `${apiBase}/api/spotify?q=${q}`,
    ];
    for (const ep of endpoints) {
      try {
        const json = await fetchSpotifyJson(ep);
        const url = json?.track?.album?.images?.[0]?.url || '';
        if (url) return url;
      } catch (_) {
        // try next endpoint
      }
    }
    return '';
  }

  // Resolve full track info from Spotify (title, artists, year, cover)
  async function resolveSpotifyInfo(title, artist) {
    const q = encodeURIComponent(`${title} ${artist}`.trim());
    const endpoints = [
      `${apiBase}/api/spotify/search?q=${q}`,
      `${apiBase}/api/spotify?q=${q}`,
    ];
    for (const ep of endpoints) {
      try {
        const json = await fetchSpotifyJson(ep);
        const trackTitle = json?.track?.name || '';
        const artists = (json?.track?.artists || []).map((a) => a.name);
        const year = json?.track?.year || '';
        const coverUrl = json?.track?.album?.images?.[0]?.url || '';
        const genres = json?.artist?.genres || [];
        if (trackTitle || artists.length || year || coverUrl || genres.length) {
          return { title: trackTitle, artists, year, coverUrl, genres };
        }
      } catch (_) {
        // try next
      }
    }
    return null;
  }

  // Prefetch and store album covers for search results, then swap into UI
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!results || results.length === 0) return;
      const coverUpdates = {};
      const infoUpdates = {};
      const colorUpdates = {};
      const tasks = [];
      for (const it of results) {
        if (it?.title && it?.artist) {
          const k1 = `${it.title}|${it.artist}`;
          if (!spotifyCovers[k1]) {
            tasks.push(
              resolveAlbumCover(it.title, it.artist).then((url) => {
                if (url) coverUpdates[k1] = url;
              })
            );
          }
          if (!spotifyInfo[k1]) {
            tasks.push(
              resolveSpotifyInfo(it.title, it.artist).then((info) => {
                if (info) infoUpdates[k1] = info;
              })
            );
          }
          const sourceUrl1 = spotifyCovers[k1] || it.thumbnail;
          if (sourceUrl1 && !dominantColors[k1]) {
            tasks.push(
              extractDominantColor(sourceUrl1).then((col) => {
                if (col) colorUpdates[k1] = col;
              })
            );
          }
        }
        if (it?.sampledFrom?.title && it?.sampledFrom?.artist) {
          const k2 = `${it.sampledFrom.title}|${it.sampledFrom.artist}`;
          if (!spotifyCovers[k2]) {
            tasks.push(
              resolveAlbumCover(it.sampledFrom.title, it.sampledFrom.artist).then((url) => {
                if (url) coverUpdates[k2] = url;
              })
            );
          }
          if (!spotifyInfo[k2]) {
            tasks.push(
              resolveSpotifyInfo(it.sampledFrom.title, it.sampledFrom.artist).then((info) => {
                if (info) infoUpdates[k2] = info;
              })
            );
          }
          const sourceUrl2 = spotifyCovers[k2] || it.sampledFrom.thumbnail;
          if (sourceUrl2 && !dominantColors[k2]) {
            tasks.push(
              extractDominantColor(sourceUrl2).then((col) => {
                if (col) colorUpdates[k2] = col;
              })
            );
          }
        }
      }
      if (tasks.length === 0) return;
      await Promise.all(tasks);
      if (!cancelled) {
        if (Object.keys(coverUpdates).length > 0) {
          setSpotifyCovers((prev) => ({ ...prev, ...coverUpdates }));
        }
        if (Object.keys(infoUpdates).length > 0) {
          setSpotifyInfo((prev) => ({ ...prev, ...infoUpdates }));
          // merge genres into pool
          const incoming = Object.values(infoUpdates)
            .flatMap((i) => (i.genres || []))
            .map((g) => String(g))
            .filter((g) => g.length > 0);
          if (incoming.length > 0) {
            setGenrePool((prev) => {
              const set = new Set(prev);
              incoming.forEach((g) => set.add(g));
              return Array.from(set).slice(0, 24); // cap to 24 for UI
            });
          }
        }
        if (Object.keys(colorUpdates).length > 0) {
          setDominantColors((prev) => ({ ...prev, ...colorUpdates }));
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [results, apiBase]);

  const openPanel = (data) => {
    setPanelData(data);
    setPanelOpen(true);
    // Fetch Spotify enrichment (best-effort)
    const query = [data.title, data.artist].filter(Boolean).join(' ');
    if (!query) return;
    setSpotifyLoading(true);
    setSpotifyError('');
    setSpotifyData(null);
    (async () => {
      try {
        const q = encodeURIComponent(query);
        const endpoints = [
          `${apiBase}/api/spotify/search?q=${q}`,
          `${apiBase}/api/spotify?q=${q}`,
        ];
        let data = null;
        for (const ep of endpoints) {
          try {
            data = await fetchSpotifyJson(ep);
            if (data) break;
          } catch (err) {
            // try next endpoint
          }
        }
        if (!data) throw new Error('No JSON response');
        setSpotifyData(data);
      } catch (e) {
        setSpotifyError(e.message || 'Failed to load Spotify data');
      } finally {
        setSpotifyLoading(false);
      }
    })();
  };

  const closePanel = () => setPanelOpen(false);
  
  // 마우스 위치 추적
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);

  const sampleDB = {
    "she knows": [
      {
        title: "She Knows",
        artist: "J. Cole",
        year: 2014,
        youtube: "https://youtu.be/jYdaQJzcAcw?si=lr20a6NH9pP3xEmj&t=10",
        thumbnail: "/sheknows.jpg",
        sampledFrom: {
                      title: "Bad Things",
                      artist: "Cults",
                      year: 2011,
                      youtube: "https://www.youtube.com/watch?v=n1WSC99ANnQ",
          thumbnail: "/badthings.jpg",
        },
      },
    ],
    "power": [
    {
        title: "Power",
        artist: "Kanye West",
        year: 2010,
      youtube: "https://www.youtube.com/watch?v=L53gjP-TtGE",
        thumbnail: "/sheknows.jpg", // Using available thumbnail
      sampledFrom: {
          title: "21st Century Schizoid Man",
          artist: "King Crimson",
          year: 1969,
        youtube: "https://www.youtube.com/watch?v=YF1R0hc5QpQ",
          thumbnail: "/badthings.jpg", // Using available thumbnail
      },
    },
  ],
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const key = query.trim().toLowerCase();
    console.log('Searching for:', key);
    console.log('Found results:', sampleDB[key] || []);
    setResults(sampleDB[key] || []);
  };

  // Navigate back to landing (clear results and query)
  const goHome = () => {
    setResults([]);
    setQuery("");
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
                    <div className="min-h-screen relative overflow-hidden">
      
                        {/* Soft Organic Background */}
                  <div 
                    className="absolute inset-0 transition-all duration-2000 ease-out"
                    style={{
                      background: `
                        radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, 
                          rgba(255, 182, 193, 0.04) 0%, 
                          rgba(255, 182, 193, 0.02) 15%, 
                          transparent 30%),
                        radial-gradient(circle at ${100 - mousePosition.x}% ${100 - mousePosition.y}%, 
                          rgba(173, 216, 230, 0.03) 0%, 
                          transparent 20%),
                        radial-gradient(circle at ${mousePosition.x * 0.7}% ${mousePosition.y * 0.7}%, 
                          rgba(255, 218, 185, 0.02) 0%, 
                          transparent 25%),
                          linear-gradient(135deg, 
                          rgb(40, 35, 45) 0%, 
                          rgb(50, 40, 55) 30%,
                          rgb(45, 35, 50) 70%,
                          rgb(40, 35, 45) 100%)
                      `,
                    }}
                  />
                  
                  {/* Soft Organic Pattern */}
                  <div className="absolute inset-0 opacity-3" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3Ccircle cx='15' cy='15' r='0.5'/%3E%3Ccircle cx='45' cy='45' r='0.5'/%3E%3Ccircle cx='15' cy='45' r='0.3'/%3E%3Ccircle cx='45' cy='15' r='0.3'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                  }}></div>
                  




      {/* Centered content container */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
                    {results.length === 0 ? (
                      <>
                        {/* Large Typography Title */}
                        <div className="text-left mb-16 max-w-6xl">
                          <h1 className="text-8xl font-bitcount font-semibold text-white/90 leading-none tracking-tight">
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '0s' }}>s</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '0.3s' }}>a</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '0.6s' }}>m</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '0.9s' }}>p</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '1.2s' }}>l</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '1.5s' }}>e</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '1.8s' }}> </span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '2.1s' }}>f</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '2.4s' }}>i</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '2.7s' }}>n</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '3s' }}>d</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '3.3s' }}>e</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '3.6s' }}>r</span>
                          </h1>
                          <p className="text-white/60 text-sm font-light mt-4 text-center">
                            Find out who sampled this beat
                          </p>
                        </div>

                        {/* Unified Search Form (Hero) */}
                        <div className="w-full max-w-3xl mb-16 lg:mb-24">
                          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-6 mb-4">
                            <div className="flex-1 relative">
        <input
          type="text"
          placeholder="Type a song title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
                                className="w-full px-6 py-4 bg-transparent text-white text-lg font-inter font-light border-b border-white/30 focus:outline-none focus:border-white/50 placeholder-gray-400/60 transition-all duration-500"
                              />
                              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 rounded-full opacity-80"></div>
                            </div>
                            <button 
                              type="submit" 
                              className="px-6 py-4 bg-white/3 backdrop-blur-sm text-white/80 font-inter font-light border border-white/8 hover:bg-white/8 hover:border-white/15 hover:text-white transition-all duration-500"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
        </button>
      </form>
                          {/* Genre quick filters (from Spotify) */}
                          {genrePool.length > 0 && (
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                              {genrePool.slice(0, 18).map((g, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setQuery(g);
                                    // submit search for this genre
                                    const fakeEvent = { preventDefault: () => {} };
                                    handleSearch(fakeEvent);
                                  }}
                                  className="px-3 py-1 text-[11px] rounded-full bg-white/6 hover:bg-gradient-to-b from-transparent via-white/5 to-transparent border border-white/12 text-white/85 hover:text-white transition-colors"
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      /* Full-bleed header divider across the entire viewport */
                      <div className="relative w-full bg-transparent mb-12">
                        <div className="absolute bottom-0 h-px bg-gray-600/30 pointer-events-none" style={{ left: 'calc(-50vw + 50%)', right: 'calc(-50vw + 50%)' }}></div>
                        <div className="max-w-7xl mx-auto px-6 py-6 md:py-8 flex items-center gap-6">
                          <button type="button" onClick={goHome} className="font-bitcount text-2xl md:text-3xl lg:text-4xl font-bold text-white/90 tracking-tight lg:tracking-normal leading-[1.35] whitespace-nowrap hover:text-white focus:outline-none">
                            sample finder
                          </button>
                          <form onSubmit={handleSearch} className="flex-1">
                            <div className="flex gap-3 items-center">
                              <input
                                type="text"
                                placeholder="Search songs..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full px-5 py-3 bg-transparent text-white text-base font-inter font-light border-b border-white/25 focus:outline-none focus:border-white/40 placeholder-gray-400/60 transition-all duration-500"
                              />
                              <button 
                                type="submit" 
                                className="px-4 py-3 bg-white/3 backdrop-blur-sm text-white/80 font-inter font-light border border-white/10 hover:bg-white/8 hover:border-white/20 hover:text-white transition-all duration-500"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                              </button>
                            </div>
                          </form>
                        </div>
                        {/* Genre quick filters under header on results */}
                        {genrePool.length > 0 && (
                          <div className="max-w-7xl mx-auto px-6 mt-2 mb-4 flex flex-wrap items-center gap-2">
                            {genrePool.slice(0, 18).map((g, idx) => (
                              <button
                                key={`gh-${idx}`}
                                type="button"
                                onClick={() => {
                                  setQuery(g);
                                  const fakeEvent = { preventDefault: () => {} };
                                  handleSearch(fakeEvent);
                                }}
                                className="px-3 py-1 text-[11px] rounded-full bg-white/6 hover:bg-gradient-to-b from-transparent via-white/5 to-transparent border border-white/12 text-white/85 hover:text-white transition-colors"
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                                                                    {/* Results container */}
                    <div className="w-full max-w-7xl">
        {results.map((item, i) => (
                        <div
                          key={i}
                          className={`${i > 0 ? 'pt-16 mt-16 border-t-2 border-white' : ''} space-y-16 lg:space-y-20`}
                        >
                                                    {/* Album Info */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 relative mb-16">
                            {/* Vertical Divider - only visible on large screens */}
                            <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-white/5 to-transparent transform -translate-x-1/2"></div>
                            
                            {/* Left Side - Sampled Song */}
                            <div className="space-y-6">
                              {/* Section Header */}
                              <div>
                                <div className="mb-4">
                                  <h2 className="text-lg font-bold text-white relative">
                                    New Track
                                    <div className="absolute -bottom-1 left-0 w-8 h-0.5 bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 rounded-full opacity-80"></div>
                                  </h2>
                                </div>
                              </div>
                              
                              {/* Album Art and Song Info - Side by side */}
                              <div className="flex items-start gap-4">
                                {/* Album Art */}
                                <div className="relative w-48 flex-shrink-0 cursor-pointer" onClick={() => openPanel({
                                  type: 'sampled',
                                  title: (spotifyInfo[`${item.title}|${item.artist}`]?.title) || item.title,
                                  artist: (spotifyInfo[`${item.title}|${item.artist}`]?.artists?.join(', ')) || item.artist,
                                  year: (spotifyInfo[`${item.title}|${item.artist}`]?.year) || item.year,
                                  image: (spotifyInfo[`${item.title}|${item.artist}`]?.coverUrl) || item.thumbnail,
                                  description: 'Artist and album details will appear here. Placeholder content.'
                                })}>
                                  <div className="absolute -inset-1 opacity-70" style={{
                                    background: (() => { const c = dominantColors[`${item.title}|${item.artist}`]; return c ? `radial-gradient(60% 60% at 50% 50%, rgba(${c.r},${c.g},${c.b},0.35) 0%, rgba(${c.r},${c.g},${c.b},0.0) 70%)` : 'transparent'; })()
                                  }}></div>
                                  <img 
                                    src={spotifyCovers[`${item.title}|${item.artist}`] || item.thumbnail} 
                                    alt={`${item.title} album art`}
                                    className="relative w-full aspect-square object-cover shadow-xl border border-white/10" 
                                  />
                                </div>
                                
                                {/* Song Info */}
                                <div className="flex-1 cursor-pointer" onClick={() => openPanel({
                                  type: 'sampled',
                                  title: (spotifyInfo[`${item.title}|${item.artist}`]?.title) || item.title,
                                  artist: (spotifyInfo[`${item.title}|${item.artist}`]?.artists?.join(', ')) || item.artist,
                                  year: (spotifyInfo[`${item.title}|${item.artist}`]?.year) || item.year,
                                  image: (spotifyInfo[`${item.title}|${item.artist}`]?.coverUrl) || item.thumbnail,
                                  description: 'Artist and album details will appear here. Placeholder content.'
                                })}>
                                  <h3 className="text-xl font-bold text-white">{(spotifyInfo[`${item.title}|${item.artist}`]?.title) || item.title}</h3>
                                  <p className="text-base text-gray-300">{(spotifyInfo[`${item.title}|${item.artist}`]?.artists?.join(', ')) || item.artist}</p>
                                  <p className="text-sm text-gray-500">{(spotifyInfo[`${item.title}|${item.artist}`]?.year) || item.year}</p>
                                </div>
                              </div>
                            </div>

                            {/* Right Side - Sample Source */}
                            <div className="space-y-6">
                              {/* Section Header */}
            <div>
                                <div className="mb-4">
                                  <h2 className="text-lg font-bold text-white relative">
                                    Sample Source
                                    <div className="absolute -bottom-1 left-0 w-8 h-0.5 bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-600 rounded-full opacity-80"></div>
                                  </h2>
                                </div>
                              </div>
                              
                              {/* Album Art and Song Info - Side by side */}
                              <div className="flex items-start gap-4">
                                {/* Album Art */}
                                <div className="relative w-48 flex-shrink-0 cursor-pointer" onClick={() => openPanel({
                                  type: 'source',
                                  title: (spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.title) || item.sampledFrom.title,
                                  artist: (spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.artists?.join(', ')) || item.sampledFrom.artist,
                                  year: (spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.year) || item.sampledFrom.year,
                                  image: (spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.coverUrl) || item.sampledFrom.thumbnail,
                                  description: 'Source artist and album details will appear here. Placeholder content.'
                                })}>
                                  <div className="absolute -inset-1 opacity-70" style={{
                                    background: (() => { const c = dominantColors[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]; return c ? `radial-gradient(60% 60% at 50% 50%, rgba(${c.r},${c.g},${c.b},0.35) 0%, rgba(${c.r},${c.g},${c.b},0.0) 70%)` : 'transparent'; })()
                                  }}></div>
                                  <img 
                                    src={spotifyCovers[`${item.sampledFrom.title}|${item.sampledFrom.artist}`] || item.sampledFrom.thumbnail} 
                                    alt={`${item.sampledFrom.title} album art`}
                                    className="relative w-full aspect-square object-cover shadow-xl border border-white/10" 
                                  />
                                </div>
                                
                                {/* Song Info */}
                                <div className="flex-1 cursor-pointer" onClick={() => openPanel({
                                  type: 'source',
                                  title: (spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.title) || item.sampledFrom.title,
                                  artist: (spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.artists?.join(', ')) || item.sampledFrom.artist,
                                  year: (spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.year) || item.sampledFrom.year,
                                  image: (spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.coverUrl) || item.sampledFrom.thumbnail,
                                  description: 'Source artist and album details will appear here. Placeholder content.'
                                })}>
                                  <h3 className="text-xl font-bold text-white">{(spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.title) || item.sampledFrom.title}</h3>
                                  <p className="text-base text-gray-300">{(spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.artists?.join(', ')) || item.sampledFrom.artist}</p>
                                  <p className="text-sm text-gray-500">{(spotifyInfo[`${item.sampledFrom.title}|${item.sampledFrom.artist}`]?.year) || item.sampledFrom.year}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Video Player Cards */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 relative">
                            {/* Vertical Divider - only visible on large screens */}
                            <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-white/5 to-transparent transform -translate-x-1/2"></div>
                            
                            {/* Left Side - Sampled Song Video */}
                            <div className="relative group">
                              <div className="absolute -top-10 left-0">
                                <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                                  Play & Compare
                                </span>
                              </div>
                              <div className="pointer-events-none absolute -inset-2 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{background:'radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.00) 70%)'}}></div>
                              <div className="rounded-2xl overflow-hidden shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)] transition-all duration-400 group-hover:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.75)] scale-70 md:scale-70 group-hover:scale-100 opacity-60 group-hover:opacity-100">
                                <div className="aspect-video">
                                  <iframe
                                  width="100%"
                                  height="100%"
                                  src={`https://www.youtube.com/embed/${item.youtube.includes('youtu.be') ? item.youtube.split('youtu.be/')[1].split('?')[0] : item.youtube.split('v=')[1].split('&')[0]}?controls=1`}
                                  title="YouTube video player"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="w-full h-full filter grayscale group-hover:grayscale-0 transition-[filter] duration-400"
                                  ></iframe>
                                </div>
                              </div>
                            </div>

                            {/* Right Side - Sample Source Video */}
                            <div className="relative group">
                              <div className="pointer-events-none absolute -inset-2 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{background:'radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.00) 70%)'}}></div>
                              <div className="rounded-2xl overflow-hidden shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)] transition-all duration-400 group-hover:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.75)] scale-70 md:scale-70 group-hover:scale-100 opacity-60 group-hover:opacity-100">
                                <div className="aspect-video">
                                  <iframe
                                  width="100%"
                                  height="100%"
                                  src={`https://www.youtube.com/embed/${item.sampledFrom.youtube.includes('youtu.be') ? item.sampledFrom.youtube.split('youtu.be/')[1].split('?')[0] : item.sampledFrom.youtube.split('v=')[1].split('&')[0]}?controls=1`}
                                  title="YouTube video player"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="w-full h-full filter grayscale group-hover:grayscale-0 transition-[filter] duration-400"
                                  ></iframe>
              </div>
            </div>
              </div>
            </div>
          </div>
        ))}

                      {/* Discover More - clearly separated section (wider than main) */}
                      {results.length > 0 && (
                        <div className="mt-28 lg:mt-40 relative w-screen left-1/2 -translate-x-1/2">
                          <div className="max-w-[90rem] mx-auto px-6">
                            <div className="h-px bg-white/5 mb-8"></div>
                            <h4 className="text-white/85 text-lg font-semibold mb-6">Discover more sampled tracks</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {discoverList.map((d, idx) => (
                              <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                                <div className="flex items-center gap-4 p-4">
                                  <img
                                    src={d.thumbnail && d.thumbnail.trim() !== '' ? d.thumbnail : '/logo512.png'}
                                    alt={`${d.title} album art`}
                                    className="w-16 h-16 rounded-lg object-cover shadow"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-xs text-white/70 mb-1">Sampled Track</p>
                                    <h5 className="text-white font-semibold truncate">{d.title || 'Placeholder Title'}</h5>
                                    <p className="text-sm text-gray-300 truncate">{d.artist || 'Artist TBD'}</p>
                                  </div>
                                </div>
                                <div className="px-4 pb-4">
                                  {d.youtube && d.youtube.trim() !== '' ? (
                                    <div className="aspect-video rounded-lg overflow-hidden border border-white/10">
                                      <iframe
                                        width="100%"
                                        height="100%"
                                        src={`https://www.youtube.com/embed/${d.youtube.includes('youtu.be') ? d.youtube.split('youtu.be/')[1].split('?')[0] : d.youtube.split('v=')[1]?.split('&')[0] || ''}?controls=1`}
                                        title="YouTube video player"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="w-full h-full"
                                      ></iframe>
                                    </div>
                                  ) : (
                                    <div className="aspect-video rounded-lg border border-dashed border-white/15 bg-white/3 flex items-center justify-center text-white/50 text-sm">
                                      YouTube link coming soon
                                    </div>
                                  )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Slide-in Detail Panel */}
                    <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[600px] md:w-[680px] bg-[#18122a]/97 border-l border-white/10 backdrop-blur-md transform transition-transform duration-300 ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-5 py-4 border-b border-white/15">
                        <div>
                          <p className="text-sm text-white/80 uppercase tracking-wide">{panelData?.type === 'source' ? 'Sample Source' : 'Sampled Song'}</p>
                          <h3 className="text-xl font-semibold text-white">{panelData?.title || 'Title'}</h3>
                          <p className="text-base text-white/85">{panelData?.artist || 'Artist'}</p>
                        </div>
                        <button onClick={closePanel} className="p-2 rounded-md hover:bg-gradient-to-b from-transparent via-white/5 to-transparent text-white/80 hover:text-white transition-colors" aria-label="Close">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                      {/* Body */}
                      <div className="p-5 space-y-4 overflow-y-auto h-[calc(100%-56px)]">
                        {/* Large cover on top (original style), details below */}
                        <div className="w-full rounded-lg overflow-hidden border border-white/15 bg-white/5">
                          {(() => {
                            const artistImg = spotifyData?.artist?.images?.[0]?.url;
                            const albumImg = spotifyData?.track?.album?.images?.[0]?.url;
                            const fallback = panelData?.image && panelData.image.trim() !== '' ? panelData.image : '/jcole.jpg';
                            const src = artistImg || albumImg || fallback;
                            return (
                              <div className="w-full aspect-[4/3]">
                                <img src={src} alt="Artist or album" className="w-full h-full object-cover" />
                              </div>
                            );
                          })()}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-white text-xl font-semibold truncate">{spotifyData?.track?.name || panelData?.title || 'Title'}</h4>
                          <p className="text-white/90 text-base truncate">{spotifyData?.track?.artists?.map((a) => a.name).join(', ') || panelData?.artist || 'Artist'}</p>
                          <p className="text-white/70 text-sm">{spotifyData?.track?.year || panelData?.year || ''}</p>
                          {spotifyData?.artist?.genres?.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {spotifyData.artist.genres.slice(0, 5).map((g, idx) => (
                                <span key={idx} className="px-2 py-0.5 text-[11px] rounded-full bg-white/8 border border-white/15 text-white/85">{g}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Artist bio (from Wikipedia if available) - single instance */}
                        {spotifyData?.artist?.bio && (
                          <div className="text-base text-white/90 leading-relaxed">
                            {spotifyData.artist.bio}
                          </div>
                        )}

                        {/* Attribution-only (no logo/links) */}
                        {spotifyData && (
                          <div className="pt-1 text-[10px] text-white/55">Data from Spotify</div>
                        )}

                        {/* Loading / error */}
                        {spotifyLoading && (
                          <div className="text-xs text-white/60">Loading Spotify data…</div>
                        )}
                        {spotifyError && !spotifyLoading && (
                          <div className="text-xs text-red-300/80">{spotifyError}</div>
                        )}
                      </div>
                    </div>
                    {/* Backdrop */}
                    {panelOpen && (
                      <button className="fixed inset-0 z-40 bg-[#161228]/52" onClick={closePanel} aria-label="Close panel backdrop"></button>
                    )}
      </div>
    </div>
  );
}
