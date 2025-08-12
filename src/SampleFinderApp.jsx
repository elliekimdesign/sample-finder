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

  const openPanel = (data) => {
    setPanelData(data);
    setPanelOpen(true);
    // Fetch Spotify enrichment (best-effort)
    const query = [data.title, data.artist].filter(Boolean).join(' ');
    if (!query) return;
    setSpotifyLoading(true);
    setSpotifyError('');
    setSpotifyData(null);
    fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Spotify API ${r.status}`);
        return r.json();
      })
      .then((json) => {
        setSpotifyData(json);
      })
      .catch((e) => {
        // In local Vite dev, /api may not exist; fail silently
        setSpotifyError(e.message || 'Failed to load Spotify data');
      })
      .finally(() => setSpotifyLoading(false));
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

                            {/* Unified Search Form */}
                    <div className="w-full max-w-3xl">
                      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-6 mb-8">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Type a song title..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full px-6 py-4 bg-transparent text-white text-lg font-inter font-light border-b border-white/20 focus:outline-none focus:border-white/40 placeholder-gray-400/60 transition-all duration-500"
                          />
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
                      <p className="text-white/40 text-xs text-center mt-3 font-inter font-light">
                        Try: "She Knows"
                      </p>
                    </div>

                                                                    {/* Results container */}
                    <div className="w-full max-w-7xl">
                      {results.map((item, i) => (
                        <div key={i} className="mt-8 space-y-8">
                          {/* Album Info (No Cards) */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                            {/* Left Side - Sampled Song Info */}
                            <div className="flex items-center gap-6 lg:col-span-6">
                              <img 
                                src={item.thumbnail} 
                                alt={`${item.title} album art`}
                                className="w-32 h-32 rounded-xl object-cover shadow-xl cursor-pointer" 
                                onClick={() => openPanel({
                                  type: 'sampled',
                                  title: item.title,
                                  artist: item.artist,
                                  year: item.year,
                                  image: item.thumbnail,
                                  description: 'Artist and album details will appear here. Placeholder content.'
                                })}
                              />
                              <div className="cursor-pointer" onClick={() => openPanel({
                                type: 'sampled',
                                title: item.title,
                                artist: item.artist,
                                year: item.year,
                                image: item.thumbnail,
                                description: 'Artist and album details will appear here. Placeholder content.'
                              })}>
                                <span className="inline-block px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-full text-[11px] font-medium text-white/80 border border-white/20">Sampled Song</span>
                                <h3 className="text-2xl sm:text-3xl font-bold text-white mt-2">{item.title}</h3>
                                <p className="text-base sm:text-lg text-gray-300">{item.artist}</p>
                                <p className="text-xs sm:text-sm text-gray-500">{item.year}</p>
                              </div>
                            </div>

                            {/* Right Side - Sample Source Info */}
                            <div className="flex items-center gap-6 lg:col-span-6">
                              <img 
                                src={item.sampledFrom.thumbnail} 
                                alt={`${item.sampledFrom.title} album art`}
                                className="w-32 h-32 rounded-xl object-cover shadow-xl cursor-pointer" 
                                onClick={() => openPanel({
                                  type: 'source',
                                  title: item.sampledFrom.title,
                                  artist: item.sampledFrom.artist,
                                  year: item.sampledFrom.year,
                                  image: item.sampledFrom.thumbnail,
                                  description: 'Source artist and album details will appear here. Placeholder content.'
                                })}
                              />
                              <div className="cursor-pointer" onClick={() => openPanel({
                                type: 'source',
                                title: item.sampledFrom.title,
                                artist: item.sampledFrom.artist,
                                year: item.sampledFrom.year,
                                image: item.sampledFrom.thumbnail,
                                description: 'Source artist and album details will appear here. Placeholder content.'
                              })}>
                                <span className="inline-block px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-full text-[11px] font-medium text-white/80 border border-white/20">Sample Source</span>
                                <h3 className="text-2xl sm:text-3xl font-bold text-white mt-2">{item.sampledFrom.title}</h3>
                                <p className="text-base sm:text-lg text-gray-300">{item.sampledFrom.artist}</p>
                                <p className="text-xs sm:text-sm text-gray-500">{item.sampledFrom.year}</p>
                              </div>
                            </div>
                          </div>

                          {/* Video Player Cards - widen separation on large screens */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                            {/* Left Side - Sampled Song Video */}
                            <div className="relative rounded-xl p-6 border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.05] transition-colors shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] lg:col-span-6">
                              <div className="mb-4">
                                <span className="inline-block px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-full text-[11px] font-medium text-white/80 border border-white/20">Sampled Song</span>
                              </div>
                              <div className="aspect-video rounded-lg overflow-hidden ring-1 ring-white/10 transition-colors hover:ring-white/20">
                                <iframe
                                  width="100%"
                                  height="100%"
                                  src={`https://www.youtube.com/embed/${item.youtube.includes('youtu.be') ? item.youtube.split('youtu.be/')[1].split('?')[0] : item.youtube.split('v=')[1].split('&')[0]}?controls=1`}
                                  title="YouTube video player"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="w-full h-full"
                                ></iframe>
                              </div>
                            </div>

                            {/* Right Side - Sample Source Video */}
                            <div className="relative rounded-xl p-6 border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.05] transition-colors shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] lg:col-span-6">
                              <div className="mb-4">
                                <span className="inline-block px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-full text-[11px] font-medium text-white/80 border border-white/20">Sample Source</span>
                              </div>
                              <div className="aspect-video rounded-lg overflow-hidden ring-1 ring-white/10 transition-colors hover:ring-white/20">
                                <iframe
                                  width="100%"
                                  height="100%"
                                  src={`https://www.youtube.com/embed/${item.sampledFrom.youtube.includes('youtu.be') ? item.sampledFrom.youtube.split('youtu.be/')[1].split('?')[0] : item.sampledFrom.youtube.split('v=')[1].split('&')[0]}?controls=1`}
                                  title="YouTube video player"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="w-full h-full"
                                ></iframe>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Discover More - Placeholder cards to keep exploring */}
                      {results.length > 0 && (
                        <div className="mt-24 lg:mt-32">
                          <h4 className="text-white/80 text-lg font-semibold mb-6">Discover more sampled tracks</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      )}
                    </div>

                    {/* Slide-in Detail Panel */}
                    <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[600px] md:w-[680px] bg-[#18122a]/94 border-l border-white/10 backdrop-blur-md transform transition-transform duration-300 ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                        <div>
                          <p className="text-xs text-white/60 uppercase tracking-wide">{panelData?.type === 'source' ? 'Sample Source' : 'Sampled Song'}</p>
                          <h3 className="text-lg font-semibold text-white">{panelData?.title || 'Title'}</h3>
                          <p className="text-sm text-gray-300">{panelData?.artist || 'Artist'}</p>
                        </div>
                        <button onClick={closePanel} className="p-2 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors" aria-label="Close">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                      {/* Body */}
                      <div className="p-5 space-y-4 overflow-y-auto h-[calc(100%-56px)]">
                        {/* Image: prefer Spotify artist image → album image → fallback */}
                        <div className="w-full aspect-[4/3] rounded-lg overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                          {(() => {
                            const artistImg = spotifyData?.artist?.images?.[0]?.url;
                            const albumImg = spotifyData?.track?.album?.images?.[0]?.url;
                            const fallback = panelData?.image && panelData.image.trim() !== '' ? panelData.image : '/jcole.jpg';
                            const src = artistImg || albumImg || fallback;
                            return <img src={src} alt="Artist or album" className="w-full h-full object-cover" />;
                          })()}
                        </div>

                        {/* Title / artist / year from Spotify if available */}
                        <div className="space-y-1">
                          <h4 className="text-white text-lg font-semibold">{spotifyData?.track?.name || panelData?.title || 'Title'}</h4>
                          <p className="text-white/80 text-sm">{spotifyData?.track?.artists?.map((a) => a.name).join(', ') || panelData?.artist || 'Artist'}</p>
                          <p className="text-white/60 text-xs">{spotifyData?.track?.year || panelData?.year || ''}</p>
                        </div>

                        {/* Genres / followers */}
                        {spotifyData?.artist && (
                          <div className="text-xs text-white/70">
                            {spotifyData.artist.genres?.length > 0 && (
                              <p className="mb-1">Genres: {spotifyData.artist.genres.slice(0, 5).join(', ')}</p>
                            )}
                            {typeof spotifyData.artist.followers === 'number' && (
                              <p>Followers: {spotifyData.artist.followers.toLocaleString()}</p>
                            )}
                          </div>
                        )}

                        {/* Links */}
                        {(spotifyData?.track?.spotifyUrl || spotifyData?.artist?.spotifyUrl) && (
                          <div className="flex gap-3 pt-2">
                            {spotifyData.track?.spotifyUrl && (
                              <a href={spotifyData.track.spotifyUrl} target="_blank" rel="noreferrer" className="text-xs px-3 py-1 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 transition-colors">Open in Spotify (Track)</a>
                            )}
                            {spotifyData.artist?.spotifyUrl && (
                              <a href={spotifyData.artist.spotifyUrl} target="_blank" rel="noreferrer" className="text-xs px-3 py-1 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 transition-colors">Open in Spotify (Artist)</a>
                            )}
                          </div>
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
                      <button className="fixed inset-0 z-40 bg-[#161228]/44" onClick={closePanel} aria-label="Close panel backdrop"></button>
                    )}
                    </div>
      </div>
  );
}
