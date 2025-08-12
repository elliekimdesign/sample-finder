import { useState, useEffect } from 'react';

export default function SampleFinderApp() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelData, setPanelData] = useState(null);
  const [spotifyData, setSpotifyData] = useState(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyError, setSpotifyError] = useState('');
  const [genrePool, setGenrePool] = useState([]);
  const [spotifyCovers, setSpotifyCovers] = useState({});
  const [spotifyInfo, setSpotifyInfo] = useState({});
  const [dominantColors, setDominantColors] = useState({});

  // API base URL configuration
  const apiBase = typeof window !== 'undefined' 
    ? window.__VITE_API_BASE__ || import.meta.env.VITE_API_BASE || 'https://samplr-red.vercel.app'
    : 'https://samplr-red.vercel.app';

  // Helper function to validate JSON response
  const fetchSpotifyJson = async (url) => {
    const r = await fetch(url);
    const text = await r.text();
    if (!text.trim()) return null;
    
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('Not valid JSON:', text.slice(0, 100));
      return null;
    }
  };

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
        thumbnail: "/sheknows.jpg",
        sampledFrom: {
          title: "21st Century Schizoid Man",
          artist: "King Crimson",
          year: 1969,
          youtube: "https://www.youtube.com/watch?v=YF1R0hc5QpQ",
          thumbnail: "/badthings.jpg",
        },
      },
    ],
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const key = query.trim().toLowerCase();
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
      
      <div className="relative z-10 flex flex-col items-center">
        {/* Main Content Container */}
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center">
          
          {/* Conditional Header Layout */}
          {results.length === 0 ? (
            <>
              {/* Full Hero Layout */}
              <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-8">
                <div className="space-y-4">
                  <h1 className="font-bitcount text-6xl sm:text-7xl md:text-8xl font-semibold text-white/90 tracking-tight animate-textGlow leading-tight">
                    sample finder
                  </h1>
                  <p className="text-white/80 text-base sm:text-lg font-inter font-light max-w-md mx-auto">
                    Find out who sampled this beat
                  </p>
                </div>

                <form onSubmit={handleSearch} className="w-full max-w-md space-y-6">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search songs..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full px-6 py-4 bg-transparent text-white text-lg font-inter font-light border-b border-white/25 focus:outline-none focus:border-white/40 placeholder-gray-400/60 transition-all duration-500"
                    />
                    <button 
                      type="submit" 
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-white/3 backdrop-blur-sm text-white/80 font-inter font-light border border-white/10 hover:bg-white/8 hover:border-white/20 hover:text-white transition-all duration-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                  {!query && (
                    <p className="text-gray-400/60 text-sm font-inter">
                      Try: "She Knows"
                    </p>
                  )}
                </form>
              </div>
            </>
          ) : (
            /* Full-bleed header divider across the entire viewport */
            <div className="relative w-full bg-transparent mb-12">
              <div className="absolute bottom-0 h-px bg-white/10 pointer-events-none" style={{ left: 'calc(-50vw + 50%)', right: 'calc(-50vw + 50%)' }}></div>
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
            </div>
          )}

          {/* Results container */}
          <div className="w-full max-w-7xl">
            {results.map((item, i) => (
              <div
                key={i}
                className={`${i > 0 ? 'pt-16 mt-16 border-t border-white/10' : 'mt-12'} space-y-16 lg:space-y-20`}
              >
                {/* Album Info (No Cards) */}
                <div className="relative">
                  <div className="hidden lg:block absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10"></div>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">
                  
                    {/* Left Side - Current Hit (She Knows) */}
                    <div className="lg:col-span-6">
                      <div className="mb-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/65">Current Hit</div>
                        <div className="mt-1 h-px bg-white/12"></div>
                      </div>
                      <div className="flex items-start gap-6">
                        <div className="relative w-52 aspect-square cursor-pointer" onClick={() => openPanel({
                         type: 'sampled',
                         title: item.title,
                         artist: item.artist,
                         year: item.year,
                         image: item.thumbnail
                        })}>
                          <img 
                           src={item.thumbnail} 
                           alt={`${item.title} album art`}
                           className="relative w-full h-full object-cover shadow-xl border border-white/10" 
                          />
                        </div>
                        <div className="cursor-pointer flex-1 min-w-0">
                          <h3 className="text-xl sm:text-2xl font-bold text-white mt-2 font-ptserif">{item.title}</h3>
                          <p className="text-base sm:text-lg text-gray-300">{item.artist}</p>
                          <p className="text-xs sm:text-sm text-gray-500">{item.year}</p>
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Original Track (Bad Things) */}
                    <div className="lg:col-span-6">
                      <div className="mb-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/65">Original Track</div>
                        <div className="mt-1 h-px bg-white/12"></div>
                      </div>
                      <div className="flex items-start gap-6">
                        <div className="relative w-52 aspect-square cursor-pointer" onClick={() => openPanel({
                         type: 'source',
                         title: item.sampledFrom.title,
                         artist: item.sampledFrom.artist,
                         year: item.sampledFrom.year,
                         image: item.sampledFrom.thumbnail
                        })}>
                          <img 
                           src={item.sampledFrom.thumbnail} 
                           alt={`${item.sampledFrom.title} album art`}
                           className="relative w-full h-full object-cover shadow-xl border border-white/10" 
                          />
                        </div>
                        <div className="cursor-pointer flex-1 min-w-0">
                          <h3 className="text-xl sm:text-2xl font-bold text-white mt-2 font-ptserif">{item.sampledFrom.title}</h3>
                          <p className="text-base sm:text-lg text-gray-300">{item.sampledFrom.artist}</p>
                          <p className="text-xs sm:text-sm text-gray-500">{item.sampledFrom.year}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video Player Cards */}
                <div className="relative">
                  <div className="hidden lg:block absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10"></div>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                    {/* Left Side - Current Hit Video */}
                    <div className="relative group lg:col-span-6">
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

                    {/* Right Side - Original Track Video */}
                    <div className="relative group lg:col-start-7 lg:col-span-6">
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
              </div>
            ))}
          </div>

          {/* Slide-in Detail Panel */}
          <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[600px] md:w-[680px] bg-[#18122a]/97 border-l border-white/10 backdrop-blur-md transform transition-transform duration-300 ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/15">
              <div>
                <p className="text-sm text-white/80 uppercase tracking-wide">{panelData?.type === 'source' ? 'Original Track' : 'Current Hit'}</p>
                <h3 className="text-xl font-semibold text-white">{panelData?.title || 'Title'}</h3>
                <p className="text-base text-white/85">{panelData?.artist || 'Artist'}</p>
              </div>
              <button onClick={closePanel} className="p-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-colors" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto h-[calc(100%-56px)]">
              {/* Large cover on top */}
              <div className="w-full rounded-lg overflow-hidden border border-white/15 bg-white/5">
                <img
                  src={panelData?.image || '/jcole.jpg'}
                  alt={`${panelData?.artist || 'Artist'} image`}
                  className="w-full h-64 object-cover"
                />
              </div>

              {/* Artist name, track, year */}
              <div className="space-y-2">
                <h4 className="text-2xl font-bold text-white">{panelData?.artist || 'Artist Name'}</h4>
                <p className="text-lg text-white/90">{panelData?.title || 'Track Title'}</p>
                <p className="text-base text-white/70">{panelData?.year || 'Year'}</p>
              </div>

              {/* Loading states and fallback content */}
              {spotifyLoading && (
                <div className="space-y-2">
                  <div className="h-4 bg-white/10 rounded animate-pulse"></div>
                  <div className="h-3 bg-white/5 rounded animate-pulse w-3/4"></div>
                </div>
              )}

              {/* Short bio/description */}
              <div className="space-y-2">
                <p className="text-sm text-white/80 font-medium">About</p>
                <p className="text-sm text-white/70 leading-relaxed">
                  Artist bio information will appear here when available.
                </p>
              </div>

              {/* Attribution */}
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-white/50">Data from Spotify</p>
              </div>

              {spotifyError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{spotifyError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Backdrop */}
          {panelOpen && (
            <button className="fixed inset-0 z-40 bg-[#161228]/52" onClick={closePanel} aria-label="Close panel backdrop"></button>
          )}
        </div>
      </div>
    </div>
  );
}
