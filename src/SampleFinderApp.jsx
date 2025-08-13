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
  const [panelSpotifyData, setPanelSpotifyData] = useState(null);
  const [discoverSpotifyData, setDiscoverSpotifyData] = useState({});
  const [spotifyData, setSpotifyData] = useState(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyError, setSpotifyError] = useState('');
  const [spotifyCovers, setSpotifyCovers] = useState({}); // key: `${title}|${artist}` -> album image url
  const [spotifyInfo, setSpotifyInfo] = useState({}); // key -> { title, artists, year, coverUrl }
  const [dominantColors, setDominantColors] = useState({}); // key -> { r,g,b }
  const [genrePool, setGenrePool] = useState([]); // unique list of genres from Spotify
  const [showAllGenres, setShowAllGenres] = useState(false); // 장르 더보기 상태

  // Prefer serverless API on Vercel; fall back to Vercel prod domain on static hosts (e.g., GitHub Pages)
  const apiBase = (import.meta?.env?.VITE_API_BASE) || (typeof window !== 'undefined' && (window.__VITE_API_BASE__ || (window.location.hostname.endsWith('github.io') ? 'https://samplr-red.vercel.app' : 'https://samplr-red.vercel.app')));

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
    console.log('📂 Opening panel with data:', data);
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
        thumbnail: "/sheknows.jpg", // 임시로 기존 이미지 사용
      sampledFrom: {
          title: "21st Century Schizoid Man",
          artist: "King Crimson",
          year: 1969,
        youtube: "https://www.youtube.com/watch?v=YF1R0hc5QpQ",
          thumbnail: "https://i.scdn.co/image/ab67616d0000b273dc30583ba717007b00cceb6a9", // King Crimson 실제 앨범아트
      },
    },
      ],
    "why i love you": [
      {
        title: "Why I Love You",
        artist: "Kanye West",
        year: 2011,
        youtube: "https://youtu.be/HVD4lnfz0-M?si=fqHGykEflGG9nbaC",
        thumbnail: "/badthings.jpg", // 임시로 기존 이미지 사용
        sampledFrom: {
          title: "I <3 U SO",
          artist: "Cassius",
          year: 1999,
          youtube: "https://youtu.be/NazVKnD-_sQ?si=-epMbz4ez53irk0Q&t=16",
          thumbnail: "https://i.scdn.co/image/ab67616d0000b2738bffce1e80c5a7b0e74aa1c4", // Cassius 앨범아트
        },
      },
    ],
    "i love u so": [
      {
        title: "I Love U So",
        artist: "Cassius",
        year: 1999,
        youtube: "https://youtu.be/NazVKnD-_sQ?si=NKE5iW5PH2uwgWOO&t=15",
        thumbnail: "/sheknows.jpg", // Temporary thumbnail
        sampledFrom: {
          title: "Temporary Sample",
          artist: "Unknown Artist", 
          year: 2000,
          youtube: "https://www.youtube.com/watch?v=n1WSC99ANnQ",
          thumbnail: "/sheknows.jpg",
      },
    },
  ],
    "rapper's delight": [
      {
        title: "Rapper's Delight",
        artist: "Sugarhill Gang",
        year: 1979,
        youtube: "https://www.youtube.com/watch?v=rKTUAESacQM",
        thumbnail: "/sheknows.jpg", // 임시로 기존 이미지 사용
        sampledFrom: {
          title: "Good Times",
          artist: "Chic",
          year: 1979,
          youtube: "https://www.youtube.com/watch?v=8rdwHkSYLzI",
          thumbnail: "https://i.scdn.co/image/ab67616d0000b27326f7f19c7f0381e56a96a0cc", // Chic 실제 앨범아트
        },
      },
    ],


    "california love": [
      {
        title: "California Love",
        artist: "2Pac ft. Dr. Dre",
        year: 1995,
        youtube: "https://www.youtube.com/watch?v=5wBTdfAkqGU",
        thumbnail: "/badthings.jpg", // 임시로 기존 이미지 사용
        sampledFrom: {
          title: "Woman to Woman",
          artist: "Joe Cocker",
          year: 1972,
          youtube: "https://www.youtube.com/watch?v=VY__ScowUMQ",
          thumbnail: "https://i.scdn.co/image/ab67616d0000b273e56db4aa81cbee5dc6bb7b8c", // Joe Cocker 앨범아트
        },
      },
    ],
    "through the wire": [
      {
        title: "Through the Wire",
        artist: "Kanye West",
        year: 2003,
        youtube: "https://www.youtube.com/watch?v=uvb-1wjAtk4",
        thumbnail: "/sheknows.jpg", // 임시로 기존 이미지 사용
        sampledFrom: {
          title: "Through the Fire",
          artist: "Chaka Khan",
          year: 1984,
          youtube: "https://www.youtube.com/watch?v=ru8IEllm5wo",
          thumbnail: "https://i.scdn.co/image/ab67616d0000b273bb5a17e929a5cb4cfd84bf2a", // Chaka Khan 앨범아트
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

  // Fetch Spotify data when panel opens
  useEffect(() => {
    console.log('🔄 Panel useEffect triggered:', { panelOpen, panelData });
    if (panelOpen && panelData?.artist && panelData?.title) {
      const fetchPanelSpotifyData = async () => {
        try {
          console.log('🎵 Fetching panel Spotify data for:', panelData.title, panelData.artist);
          console.log('🔗 API Base URL:', apiBase);
          
          // First try the main API 
          const info = await resolveSpotifyInfo(panelData.title, panelData.artist);
          if (info) {
            console.log('✅ Panel Spotify data received:', info);
            console.log('🖼️ Artist images available:', info.artist?.images?.length || 0);
            console.log('📀 Album images available:', info.track?.album?.images?.length || 0);
            
            // If no artist images, try more specific searches
            if ((!info.artist?.images || info.artist.images.length === 0) && info.artists && info.artists.length > 0) {
              console.log('🔍 No artist images found, trying more specific searches...');
              try {
                // Try multiple search strategies with special cases
                const searches = [];
                
                // Special case for Cassius - add more specific terms
                if (info.artists[0].toLowerCase() === 'cassius') {
                  searches.push(
                    'Cassius french house',
                    'Cassius electronic duo',
                    'Cassius Philippe Zdar',
                    'Cassius Boombass',
                    'Cassius 1999'
                  );
                }
                
                // Special case for JAY-Z
                if (info.artists[0].toLowerCase().includes('jay-z')) {
                  searches.push(
                    'JAY-Z rapper',
                    'JAY-Z Shawn Carter',
                    'JAY-Z hip hop'
                  );
                }
                
                // Generic searches
                searches.push(
                  // 1. Search with track name + artist name for better context
                  `${panelData.title} ${info.artists[0]}`,
                  // 2. Search with artist name + genre context
                  `${info.artists[0]} ${info.genres?.[0] || ''}`,
                  // 3. Just artist name as fallback
                  info.artists[0]
                );
                
                for (const searchQuery of searches) {
                  const artistQuery = encodeURIComponent(searchQuery.trim());
                  const artistUrl = `${apiBase}/api/spotify/search?q=${artistQuery}`;
                  const artistResponse = await fetch(artistUrl);
                  const artistData = await artistResponse.json();
                  
                  if (artistData?.artist?.images?.length > 0) {
                    console.log('🎨 Found artist images with query:', searchQuery, '- Images:', artistData.artist.images.length);
                    // Verify this is likely the right artist by checking if it matches our genre/context
                    if (artistData.artist.name.toLowerCase().includes(info.artists[0].toLowerCase()) ||
                        info.artists[0].toLowerCase().includes(artistData.artist.name.toLowerCase())) {
                      info.artist = artistData.artist;
                      break;
                    }
                  }
                }
              } catch (artistError) {
                console.error('❌ Artist search failed:', artistError);
              }
            }
            
            setPanelSpotifyData(info);
          } else {
            console.log('❌ No panel Spotify data found');
            setPanelSpotifyData(null);
          }
        } catch (error) {
          console.error('💥 Error fetching panel Spotify data:', error);
          setPanelSpotifyData(null);
        }
      };
      fetchPanelSpotifyData();
    } else {
      console.log('⚠️ Panel useEffect conditions not met:', { panelOpen, hasArtist: !!panelData?.artist, hasTitle: !!panelData?.title });
      setPanelSpotifyData(null);
    }
  }, [panelOpen, panelData?.artist, panelData?.title]);

  // Discover 섹션 Spotify 데이터 다시 활성화
  useEffect(() => {
    const fetchDiscoverData = async () => {
      console.log('🎵 Fetching Discover Spotify data...');
      const keys = Object.keys(sampleDB);
      
      for (const key of keys) {
        if (!discoverSpotifyData[key]) {
          const track = sampleDB[key][0];
          console.log(`🔍 Fetching: ${track.title} by ${track.artist}`);
          
          try {
            const q = encodeURIComponent(`${track.title} ${track.artist}`.trim());
            const url = `${apiBase}/api/spotify/search?q=${q}`;
            
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            
            if (response.ok) {
              const data = await response.json();
              if (data && data.track && data.track.album && data.track.album.images && data.track.album.images.length > 0) {
                setDiscoverSpotifyData(prev => ({
                  ...prev,
                  [key]: data
                }));
                console.log(`✅ Got album art for ${track.title}: ${data.track.album.images[0].url}`);
              } else {
                console.log(`⚠️ No album images for ${track.title}, using fallback`);
              }
            } else {
              console.log(`❌ API error for ${track.title}: ${response.status}`);
            }
          } catch (error) {
            console.error(`❌ Error fetching ${track.title}:`, error);
          }
          
          // API 호출 간격
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };

    // 데이터가 비어있으면 가져오기 시작
    if (Object.keys(discoverSpotifyData).length === 0) {
      fetchDiscoverData();
    }
  }, []);

  // Additional useEffect to log whenever panelSpotifyData changes
  useEffect(() => {
    console.log('📊 panelSpotifyData changed:', panelSpotifyData);
    if (panelSpotifyData) {
      console.log('👤 Artist data:', panelSpotifyData.artist);
      console.log('🎵 Track data:', panelSpotifyData.track);
      console.log('🖼️ Images check:', {
        artistImages: panelSpotifyData.artist?.images?.length || 0,
        albumImages: panelSpotifyData.track?.album?.images?.length || 0,
        bestImage: panelSpotifyData.artist?.bestImage,
        firstArtistImage: panelSpotifyData.artist?.images?.[0]?.url,
        firstAlbumImage: panelSpotifyData.track?.album?.images?.[0]?.url
      });
      console.log('🔍 Full API Response Structure:', JSON.stringify(panelSpotifyData, null, 2));
    }
  }, [panelSpotifyData]);

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
                  
                  {/* 3D Geometric Grid Background */}
                  <div className="absolute inset-0 perspective-1000" style={{ perspective: '1000px' }}>
                    {/* Floating 3D Grid */}
                    <div 
                      className="absolute inset-0 opacity-10 transition-transform duration-700 ease-out" 
                      style={{
                        background: `
                          linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 1px, transparent 2px),
                          linear-gradient(0deg, transparent 0%, rgba(255,255,255,0.03) 1px, transparent 2px)
                        `,
                        backgroundSize: '60px 60px',
                        transform: `
                          rotateX(${60 + (mousePosition.y - 50) * 0.1}deg) 
                          rotateY(${(mousePosition.x - 50) * 0.15}deg) 
                          rotateZ(0deg) 
                          translateZ(-200px)
                        `,
                        transformStyle: 'preserve-3d'
                      }}
                    ></div>
                    
                    {/* Floating 3D Cubes */}
                    <div className="absolute inset-0">
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute animate-pulse transition-transform duration-1000 ease-out"
                          style={{
                            left: `${10 + (i * 7) % 80}%`,
                            top: `${15 + (i * 11) % 70}%`,
                            width: '4px',
                            height: '4px',
                            background: `rgba(255,255,255,${0.05 + (mousePosition.x + mousePosition.y) * 0.0005})`,
                            transform: `
                              perspective(200px) 
                              rotateX(${45 + i * 15 + (mousePosition.y - 50) * 0.2}deg) 
                              rotateY(${i * 30 + (mousePosition.x - 50) * 0.3}deg) 
                              translateZ(${20 + i * 5 + Math.sin((mousePosition.x + mousePosition.y + i * 10) * 0.01) * 10}px)
                            `,
                            transformStyle: 'preserve-3d',
                            boxShadow: `0 0 ${8 + (mousePosition.x + mousePosition.y) * 0.02}px rgba(255,255,255,0.2)`,
                            animationDelay: `${i * 0.5}s`,
                            animationDuration: `${3 + i * 0.2}s`
                          }}
                        />
                      ))}
                    </div>
                    
                    {/* 3D Depth Layers */}
                    <div 
                      className="absolute inset-0 opacity-5 transition-all duration-1000 ease-out" 
                      style={{
                        background: `
                          radial-gradient(circle at ${20 + (mousePosition.x - 50) * 0.3}% ${80 + (mousePosition.y - 50) * 0.2}%, rgba(139, 69, 19, 0.3) 0%, transparent 50%),
                          radial-gradient(circle at ${80 + (mousePosition.x - 50) * 0.2}% ${20 + (mousePosition.y - 50) * 0.3}%, rgba(75, 0, 130, 0.3) 0%, transparent 50%),
                          radial-gradient(circle at ${40 + (mousePosition.x - 50) * 0.1}% ${40 + (mousePosition.y - 50) * 0.1}%, rgba(25, 25, 112, 0.2) 0%, transparent 50%)
                        `,
                        transform: `
                          translateZ(-100px) 
                          rotateX(${(mousePosition.y - 50) * 0.05}deg) 
                          rotateY(${(mousePosition.x - 50) * 0.05}deg)
                        `,
                        transformStyle: 'preserve-3d'
                      }}
                    ></div>
                  </div>
                  
                  {/* Soft Organic Pattern Overlay */}
                  <div className="absolute inset-0 opacity-2" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3Ccircle cx='15' cy='15' r='0.5'/%3E%3Ccircle cx='45' cy='45' r='0.5'/%3E%3Ccircle cx='15' cy='45' r='0.3'/%3E%3Ccircle cx='45' cy='15' r='0.3'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                  }}></div>
                  




      {/* Landing Page Container */}
      {results.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 pb-16 pt-16 md:pt-24 lg:pt-32 xl:pt-48">
                    
                      <>
                        {/* Large Typography Title */}
                        <div className="text-left mb-6 max-w-6xl">
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
                        <div className="w-full max-w-2xl mb-16 lg:mb-24">
                                                    <form onSubmit={handleSearch} className="relative group mb-4">
                            <div className="flex items-center relative">
                              {/* Animated background glow */}
                              <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded-2xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-700 blur-xl"></div>
                              
                              {/* Main input container */}
                              <div className="relative flex-1 flex items-center bg-white/4 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/20 group-hover:border-white/20 group-focus-within:border-white/25 group-focus-within:bg-white/6 transition-all duration-500">
        <input
          type="text"
                                  placeholder="Search for any song..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
                                  className="flex-1 px-6 py-4 bg-transparent text-white text-lg font-inter font-light placeholder-white/40 focus:outline-none focus:placeholder-white/60 transition-all duration-300"
                                />
                                <button 
                                  type="submit" 
                                  className="mr-2 p-3 bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 backdrop-blur-sm text-white/70 hover:text-white rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
        </button>
                              </div>
                            </div>
      </form>

                          {/* Example suggestion */}
                          <div className="text-center mt-8">
                            <button 
                              type="button"
                              onClick={() => {
                                setQuery("why i love you");
                                setTimeout(() => {
                                  const key = "why i love you";
                                  console.log('Searching for:', key);
                                  console.log('Found results:', sampleDB[key] || []);
                                  setResults(sampleDB[key] || []);
                                }, 100);
                              }}
                              className="text-xs text-white/40 hover:text-white/70 font-inter font-light transition-colors duration-300"
                            >
                              Try "Why I Love You"
                            </button>
                          </div>

                          {/* Landing Page Discover Section */}
                          <div className="mt-24 w-full max-w-6xl">
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 justify-items-center">
                              {Object.keys(sampleDB).slice(0, 6).map((key, idx) => {
                                const track = sampleDB[key][0]; // 첫 번째 트랙 가져오기
                                const currentSpotifyData = discoverSpotifyData[key];
                                const albumImageUrl = currentSpotifyData?.track?.album?.images?.[0]?.url || track.thumbnail;
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className="cursor-pointer select-none group"
                                    style={{
                                      animation: `slideUpFromBottom 0.8s ease-out forwards`,
                                      animationDelay: `${idx * 150}ms`,
                                      opacity: 0,
                                      transform: 'translateY(40px)'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuery(track.title);
                                      const fakeEvent = { preventDefault: () => {} };
                                      handleSearch(fakeEvent);
                                    }}
                                  >
                                    <div 
                                      className="w-32 md:w-36 aspect-square bg-white/5 overflow-hidden mb-3 relative transition-all duration-500 shadow-2xl hover:shadow-4xl"
                                      style={{
                                        transform: 'perspective(800px) rotateX(2deg) rotateY(-4deg)',
                                        transformStyle: 'preserve-3d'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(20px) scale(1.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'perspective(800px) rotateX(2deg) rotateY(-4deg)';
                                      }}
                                    >
                                      <img 
                                        src={albumImageUrl} 
                                        alt={track.title}
                                        className="w-full h-full object-cover"
                                        onLoad={() => console.log(`🖼️ Landing image loaded for ${track.title}:`, albumImageUrl)}
                                        onError={() => console.log(`❌ Landing image failed for ${track.title}:`, albumImageUrl)}
                                      />
                                      {/* 3D depth effect */}
                                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30 pointer-events-none"></div>
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300"></div>
                                    </div>
                                    <div className="text-center">
                                      <h4 className="text-white text-xs font-medium mb-1 line-clamp-2 leading-tight">
                                        {currentSpotifyData?.track?.name || track.title}
                                      </h4>
                                      <p className="text-white/60 text-xs line-clamp-1">
                                        {currentSpotifyData?.track?.artists?.[0]?.name || track.artist}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      </>
        </div>
      ) : (
        <div className="relative z-10 min-h-screen pt-6">
          {/* Subtle Gradient Background for Results Page */}
          <div className="fixed inset-0 -z-10">
            {/* Landing page colors with gradient effect */}
            <div 
              className="absolute inset-0" 
              style={{
                background: `
                  linear-gradient(135deg, 
                    rgb(40, 35, 45) 0%, 
                    rgb(50, 40, 55) 20%, 
                    rgb(45, 35, 50) 40%, 
                    rgb(40, 35, 45) 60%, 
                    rgb(50, 40, 55) 80%, 
                    rgb(45, 35, 50) 100%)
                `
              }}
            />
            
            {/* Mouse-tracking radial gradient effect */}
            <div 
              className="absolute inset-0 transition-all duration-1000 ease-out"
              style={{
                background: `
                  radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, 
                    rgba(255, 255, 255, 0.03) 0%, 
                    rgba(255, 255, 255, 0.015) 20%, 
                    transparent 40%),
                  radial-gradient(circle at ${100 - mousePosition.x}% ${100 - mousePosition.y}%, 
                    rgba(255, 255, 255, 0.02) 0%, 
                    transparent 30%)
                `
              }}
            />
            
            {/* Very subtle animated orbs */}
            <div className="absolute inset-0 opacity-6">
              <div 
                className="absolute animate-pulse" 
                style={{
                  top: '20%',
                  left: '15%',
                  width: '300px',
                  height: '300px',
                  background: 'radial-gradient(circle, rgba(255, 255, 255, 0.015) 0%, transparent 70%)',
                  borderRadius: '50%',
                  filter: 'blur(60px)',
                  animationDuration: '8s'
                }}
              />
              <div 
                className="absolute animate-pulse" 
                style={{
                  bottom: '25%',
                  right: '20%',
                  width: '250px',
                  height: '250px',
                  background: 'radial-gradient(circle, rgba(255, 255, 255, 0.01) 0%, transparent 70%)',
                  borderRadius: '50%',
                  filter: 'blur(50px)',
                  animationDuration: '10s',
                  animationDelay: '3s'
                }}
              />
            </div>
          </div>
                    
                      {/* Full-bleed header divider across the entire viewport */}
                      <div className="relative w-full bg-transparent mb-2">
                        <div className="absolute bottom-0 h-px bg-gray-600/30 pointer-events-none" style={{ left: 'calc(-50vw + 50%)', right: 'calc(-50vw + 50%)' }}></div>
                        <div className="max-w-7xl mx-auto px-6 py-3 md:py-4 flex items-center gap-6">
                          <button type="button" onClick={goHome} className="font-bitcount text-2xl md:text-3xl lg:text-4xl font-bold text-white/90 tracking-tight lg:tracking-normal leading-[1.35] whitespace-nowrap hover:text-white focus:outline-none flex items-center self-start mt-2">
                            sample finder
                          </button>
                          <form onSubmit={handleSearch} className="flex-1 max-w-md ml-auto relative group">
                            <div className="flex items-center relative">
                              {/* Animated background glow */}
                              <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded-2xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-700 blur-xl"></div>
                              
                              {/* Main input container */}
                              <div className="relative flex-1 flex items-center bg-white/4 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/20 group-hover:border-white/20 group-focus-within:border-white/25 group-focus-within:bg-white/6 transition-all duration-500">
                                <input
                                  type="text"
                                  placeholder="Search songs..."
                                  value={query}
                                  onChange={(e) => setQuery(e.target.value)}
                                  className="flex-1 px-4 py-2.5 bg-transparent text-white text-sm font-inter font-light placeholder-white/40 focus:outline-none focus:placeholder-white/60 transition-all duration-300"
                                />
                                <button 
                                  type="submit" 
                                  className="mr-1.5 p-2 bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 backdrop-blur-sm text-white/70 hover:text-white rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {/* Genre quick filters right under search input */}
                            {genrePool.length > 0 && (
                              <div className="mt-3 mb-6">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div className="flex flex-wrap items-center justify-start gap-2 flex-1 min-w-0">
                                    {(showAllGenres ? genrePool : genrePool.slice(0, 8)).map((g, idx) => (
                                      <button
                                        key={`gh-${idx}`}
                                        type="button"
                                        onClick={() => {
                                          setQuery(g);
                                          const fakeEvent = { preventDefault: () => {} };
                                          handleSearch(fakeEvent);
                                        }}
                                        className="px-3 py-1 text-[10px] rounded-full bg-white/5 hover:bg-white/8 border border-white/10 text-white/60 hover:text-white/85 transition-all duration-300 whitespace-nowrap"
                                      >
                                        {g.charAt(0).toUpperCase() + g.slice(1)}
                                      </button>
                                    ))}
                                  </div>
                                  {genrePool.length > 8 && (
                                    <button
                                      type="button"
                                      onClick={() => setShowAllGenres(!showAllGenres)}
                                      className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 hover:bg-white/8 border border-white/10 text-white/50 hover:text-white/75 transition-all duration-300 flex items-center justify-center"
                                    >
                                      <svg 
                                        className={`w-4 h-4 transition-transform duration-200 ${showAllGenres ? 'rotate-90' : ''}`} 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </form>
                        </div>

                      </div>

                    {/* Results container */}
                    <div className="w-full max-w-7xl mx-auto px-6">
        {results.map((item, i) => (
                        <div
                          key={i}
                          className={`${i > 0 ? 'pt-16 mt-16 border-t-2 border-white' : 'pt-8 mt-8'} space-y-16 lg:space-y-20`}
                        >
                                                    {/* Album Info */}
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-12 xl:gap-16 relative mb-20">
                            {/* Vertical Divider - only visible on large screens */}
                            <div className="hidden xl:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-white/5 to-transparent transform -translate-x-1/2"></div>
                            
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
                                <div className="relative w-48 flex-shrink-0 cursor-pointer transition-transform duration-300 hover:scale-[1.03]" onClick={() => openPanel({
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
                                    className="relative w-full aspect-square object-cover shadow-xl" 
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
                                <div className="relative w-48 flex-shrink-0 cursor-pointer transition-transform duration-300 hover:scale-[1.03]" onClick={() => openPanel({
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
                                    className="relative w-full aspect-square object-cover shadow-xl" 
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
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-12 xl:gap-16 relative">
                            {/* Vertical Divider - only visible on large screens */}
                            <div className="hidden xl:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-white/5 to-transparent transform -translate-x-1/2"></div>
                            
                            {/* Left Side - Sampled Song Video */}
                            <div className="relative group">
                                            <div className="absolute -top-12 left-0">
                <span className="text-sm font-bold text-white">
                  Play & Compare
                </span>
              </div>
                              <div className="pointer-events-none absolute -inset-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{background:'radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.00) 70%)'}}></div>
                              <div className="rounded-xl overflow-hidden shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)] transition-all duration-400 group-hover:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.75)] scale-[0.95] md:scale-[0.95] group-hover:scale-100 opacity-75 group-hover:opacity-100">
                                <div className="aspect-video">
                                  <iframe
                                  width="100%"
                                  height="100%"
                                  src={(() => {
                                    const extractVideoId = (url) => {
                                      if (url.includes('youtu.be/')) {
                                        const parts = url.split('youtu.be/')[1];
                                        const videoId = parts.split('?')[0];
                                        const timeMatch = url.match(/[?&]t=(\d+)/);
                                        const startTime = timeMatch ? timeMatch[1] : null;
                                        return { videoId, startTime };
                                      } else {
                                        const videoId = url.split('v=')[1].split('&')[0];
                                        return { videoId, startTime: null };
                                      }
                                    };
                                    const { videoId, startTime } = extractVideoId(item.youtube);
                                    return `https://www.youtube.com/embed/${videoId}?controls=1${startTime ? `&start=${startTime}` : ''}`;
                                  })()}
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
                              <div className="pointer-events-none absolute -inset-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{background:'radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.00) 70%)'}}></div>
                              <div className="rounded-xl overflow-hidden shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)] transition-all duration-400 group-hover:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.75)] scale-[0.95] md:scale-[0.95] group-hover:scale-100 opacity-75 group-hover:opacity-100">
                                <div className="aspect-video">
                                  <iframe
                                  width="100%"
                                  height="100%"
                                  src={(() => {
                                    const extractVideoId = (url) => {
                                      if (url.includes('youtu.be/')) {
                                        const parts = url.split('youtu.be/')[1];
                                        const videoId = parts.split('?')[0];
                                        const timeMatch = url.match(/[?&]t=(\d+)/);
                                        const startTime = timeMatch ? timeMatch[1] : null;
                                        return { videoId, startTime };
                                      } else {
                                        const videoId = url.split('v=')[1].split('&')[0];
                                        return { videoId, startTime: null };
                                      }
                                    };
                                    const { videoId, startTime } = extractVideoId(item.sampledFrom.youtube);
                                    return `https://www.youtube.com/embed/${videoId}?controls=1${startTime ? `&start=${startTime}` : ''}`;
                                  })()}
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
                        <div className="mt-32 lg:mt-48 relative w-screen left-1/2 -translate-x-1/2">
                          <div className="max-w-[90rem] mx-auto px-6">
                            <div className="h-px bg-white/5 mb-8"></div>
                            <h4 className="text-white/85 text-lg font-semibold mb-6">Discover more sampled tracks</h4>
                            <div 
                              className="flex gap-6 overflow-x-auto pb-4 cursor-grab active:cursor-grabbing" 
                              style={{scrollBehavior: 'smooth'}}
                              onMouseDown={(e) => {
                                const container = e.currentTarget;
                                let isDown = true;
                                let startX = e.pageX - container.offsetLeft;
                                let scrollLeft = container.scrollLeft;
                                
                                container.style.cursor = 'grabbing';
                                container.style.userSelect = 'none';
                                
                                const handleMouseMove = (e) => {
                                  if (!isDown) return;
                                  e.preventDefault();
                                  const x = e.pageX - container.offsetLeft;
                                  const walk = (x - startX) * 2; // 스크롤 속도
                                  container.scrollLeft = scrollLeft - walk;
                                };
                                
                                const handleMouseUp = () => {
                                  isDown = false;
                                  container.style.cursor = 'grab';
                                  container.style.userSelect = '';
                                  document.removeEventListener('mousemove', handleMouseMove);
                                  document.removeEventListener('mouseup', handleMouseUp);
                                  document.removeEventListener('mouseleave', handleMouseUp);
                                };
                                
                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                                document.addEventListener('mouseleave', handleMouseUp);
                              }}>
                            {Object.keys(sampleDB).map((key, idx) => {
                              const track = sampleDB[key][0]; // 첫 번째 트랙 가져오기
                              const currentSpotifyData = discoverSpotifyData[key];
                              const albumImageUrl = currentSpotifyData?.track?.album?.images?.[0]?.url || track.thumbnail;
                              
                              // 디버깅 로그 제거 (무한 루프 방지)
                              
                              return (
                              <div 
                                key={idx} 
                                className="cursor-pointer flex-shrink-0 w-52 select-none group transition-transform duration-200 hover:scale-[1.02]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuery(track.title);
                                  const fakeEvent = { preventDefault: () => {} };
                                  handleSearch(fakeEvent);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <div className="aspect-square bg-white/5 overflow-hidden mb-4 relative transition-all duration-200 group-hover:shadow-lg group-hover:shadow-white/5">
                                  <img 
                                    src={albumImageUrl} 
                                    alt={track.title}
                                    className="w-full h-full object-cover"
                                    onLoad={() => console.log(`🖼️ Image loaded for ${track.title}:`, albumImageUrl)}
                                    onError={() => console.log(`❌ Image failed for ${track.title}:`, albumImageUrl)}
                                  />

                                </div>
                                <h3 className="text-white text-base font-semibold mb-1 line-clamp-2 leading-tight transition-colors duration-200 group-hover:text-white/90">
                                  {currentSpotifyData?.track?.name || track.title}
                                </h3>
                                <p className="text-white/70 text-xs line-clamp-1 transition-colors duration-200 group-hover:text-white/80">
                                  {currentSpotifyData?.track?.artists?.[0]?.name || track.artist}
                                </p>
                              </div>
                              );
                            })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Slide-in Detail Panel */}
                    <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] md:w-[480px] lg:w-[520px] bg-[#18122a]/97 border-l border-white/10 backdrop-blur-md transform transition-transform duration-300 ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                            {/* Header */}
      <div className="flex items-center justify-between px-5 pt-8 pb-4 border-b border-white/15">
        <div>
          <p className="text-sm text-white/80 uppercase tracking-wide mb-3">About Artist</p>
          <h3 className="text-4xl font-semibold text-white">
            {panelSpotifyData?.artists?.[0] || panelData?.artist?.split(',')[0]?.trim() || 'Artist'}
          </h3>
        </div>
        <button onClick={closePanel} className="p-2 rounded-md hover:bg-gradient-to-b from-transparent via-white/5 to-transparent text-white/80 hover:text-white transition-colors" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
                      {/* Body */}
                      <div className="p-5 space-y-4 overflow-y-auto h-[calc(100%-56px)]">
                        {/* Artist image */}
                        <div className="w-full rounded-md overflow-hidden bg-white/5">
                          {(() => {
                            // Handle different API response structures
                            const bestImg = panelSpotifyData?.artist?.bestImage;
                            const artistImg = panelSpotifyData?.artist?.images?.[0]?.url;
                            const albumImg = panelSpotifyData?.track?.album?.images?.[0]?.url;
                            
                            // NEW: Handle flat response structure with coverUrl
                            const coverUrl = panelSpotifyData?.coverUrl;
                            
                            const fallback = panelData?.image && panelData.image.trim() !== '' ? panelData.image : '/jcole.jpg';
                            
                            // Try to get image from main search results as backup
                            const panelKey = `${panelData?.title}|${panelData?.artist}`;
                            const mainResultImage = spotifyCovers[panelKey] || spotifyInfo[panelKey]?.track?.album?.images?.[0]?.url;
                            
                            const src = bestImg || artistImg || albumImg || coverUrl || mainResultImage || fallback;
                            
                            console.log('🖼️ Panel Image Debug:', {
                              bestImg,
                              artistImg,
                              albumImg,
                              coverUrl,
                              mainResultImage,
                              fallback,
                              finalSrc: src,
                              'IMAGE_SHOULD_BE': coverUrl || fallback
                            });
                            
                            console.log('🔥 FORCE DEBUG - coverUrl exists?', !!coverUrl, 'value:', coverUrl);
                            
                            return (
                              <div className="w-full aspect-[4/3]">
                                <img src={src} alt="Artist or album" className="w-full h-full object-cover" />
                              </div>
                            );
                          })()}
                        </div>
                        
                        {/* Album art + Song info side by side */}
                        <div className="flex gap-4 items-center">
                          {/* Small album art (left) - slight rounded corners */}
                          <div className="w-20 h-20 rounded-md overflow-hidden bg-white/5 flex-shrink-0">
                            {(() => {
                              const coverUrl = panelSpotifyData?.coverUrl;
                              const albumImg = panelSpotifyData?.track?.album?.images?.[0]?.url;
                              const fallback = panelData?.image && panelData.image.trim() !== '' ? panelData.image : '/jcole.jpg';
                              const panelKey = `${panelData?.title}|${panelData?.artist}`;
                              const mainResultImage = spotifyCovers[panelKey] || spotifyInfo[panelKey]?.track?.album?.images?.[0]?.url;
                              
                              const albumSrc = coverUrl || albumImg || mainResultImage || fallback;
                              
                              return (
                                <img src={albumSrc} alt="Album" className="w-full h-full object-cover" />
                              );
                            })()}
                          </div>
                          
                          {/* Song info (right) */}
                          <div className="flex-1 space-y-1">
                            <h4 className="text-xl font-semibold text-white tracking-tight leading-tight">{panelData?.title || 'Unknown Title'}</h4>
                            <p className="text-base text-white/85 font-medium tracking-wide">
                              {panelSpotifyData?.artists?.join(', ') || panelData?.artist || 'Unknown Artist'}
                            </p>
                            <p className="text-sm text-white/65 font-normal">{panelData?.year || 'Unknown Year'}</p>
                          </div>
                        </div>

                        {/* Genre tags */}
                        {panelSpotifyData?.genres && panelSpotifyData.genres.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {panelSpotifyData.genres.map((genre, index) => (
                              <span key={index} className="px-3 py-1.5 text-xs font-medium bg-white/8 text-white/75 rounded-full tracking-wide border border-white/10">
                                {genre.charAt(0).toUpperCase() + genre.slice(1)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Artist information and bio */}
                        <div className="space-y-4">
                          {/* Show available info from flat structure */}
                          {panelSpotifyData && (
                            <div className="space-y-2">
                              {panelSpotifyData.genres && panelSpotifyData.genres.length > 0 && (
                                <div>
                                  <span className="text-white/60 text-sm">Genres</span>
                                  <div className="text-white font-medium">{panelSpotifyData.genres.join(', ')}</div>
                                </div>
                              )}
                              {panelSpotifyData.artists && panelSpotifyData.artists.length > 0 && (
                                <div>
                                  <span className="text-white/60 text-sm">Artist</span>
                                  <div className="text-white font-medium">{panelSpotifyData.artists[0]}</div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Spotify stats (if available) */}
                          {panelSpotifyData?.artist && panelSpotifyData.artist.popularity > 0 && (
                            <div className="text-sm">
                              <div>
                                <span className="text-white/60 font-medium tracking-wide text-xs uppercase">Popularity</span>
                                <div className="text-white font-semibold text-base tracking-tight">{panelSpotifyData.artist.popularity}/100</div>
                              </div>
                            </div>
                          )}
                          
                          {/* Bio or description */}
                          {(panelSpotifyData?.artist?.bio || panelSpotifyData?.artist?.description) && (
                            <div className="text-base text-white/85 leading-relaxed font-normal tracking-normal">
                              {panelSpotifyData.artist.bio || panelSpotifyData.artist.description}
                            </div>
                          )}
                        </div>

                        {/* Attribution-only (no logo/links) */}
                        {panelSpotifyData && (
                          <div className="pt-1 text-[10px] text-white/55">Data from Spotify</div>
                        )}

                        {/* Loading / error */}
                        {!panelSpotifyData && panelOpen && (
                          <div className="text-xs text-white/60">Loading artist data…</div>
                        )}
                      </div>
                    </div>
                    {/* Backdrop */}
                    {panelOpen && (
                      <button className="fixed inset-0 z-40 bg-[#161228]/52" onClick={closePanel} aria-label="Close panel backdrop"></button>
                    )}
                    
                    {/* Footer */}
                    <footer className="relative mt-32 py-16 px-6 z-20">
                      {/* Very dark subtle background */}
                      <div className="absolute inset-0 bg-gray-950/60"></div>
                      
                      <div className="relative w-full px-6">
                        
                        {/* Top row with logo and main info */}
                        <div className="flex items-start justify-between mb-6">
                          
                          {/* Left: Logo */}
                          <div className="flex-shrink-0">
                            <h1 className="text-white/60 font-bitcount text-2xl tracking-wide leading-tight">
                              sample finder
                            </h1>
                            <p className="text-white/35 mt-2" style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', fontWeight: '300', letterSpacing: '0.5px'}}>
                              Discover who sampled the beat
                            </p>
                          </div>
                          
                          {/* Right: Main info */}
                          <div className="text-right space-y-3">
                            <div className="text-white/70 tracking-wide" style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px', fontWeight: '400'}}>
                              © 2025 Ellie Kim
                            </div>
                            <div className="text-white/50 tracking-wider" style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', fontWeight: '400'}}>
                              Data from Spotify and YouTube
                            </div>
                          </div>
                          
                        </div>
                        
                        {/* Bottom row with version and built with */}
                        <div className="flex items-center justify-between">
                          
                          {/* Left: Empty space or could add something later */}
                          <div></div>
                          
                          {/* Right: Version and links */}
                          <div className="text-right space-y-2">
                            <div className="flex items-center justify-end gap-6">
                              <span 
                                className="text-white/60 bg-white/5 px-3 py-1 rounded-full border border-white/10" 
                                style={{fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: '10px', fontWeight: '500', letterSpacing: '0.5px'}}
                              >
                                v0.6
                              </span>
                              <a 
                                href="https://github.com/elliekimdesign/sample-finder" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-white/45 hover:text-white/70 transition-all duration-300"
                                style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', fontWeight: '400', textDecoration: 'none'}}
                              >
                                Patch Notes
                              </a>
                            </div>
                            <div className="text-white/30" style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '10px', fontWeight: '300', letterSpacing: '1px'}}>
                              BUILT WITH VIBE CODING
                            </div>
                          </div>
                          
                        </div>
                        
                      </div>
                    </footer>
        </div>
      )}
      
      {/* Footer for Landing Page */}
      {results.length === 0 && (
        <footer className="relative mt-32 py-16 px-6">
          {/* Very dark subtle background */}
          <div className="absolute inset-0 bg-gray-950/60"></div>
          
          <div className="relative w-full px-6">
            
            {/* Top row with logo and main info */}
            <div className="flex items-start justify-between mb-6">
              
              {/* Left: Logo */}
              <div className="flex-shrink-0">
                <h1 className="text-white/60 font-bitcount text-2xl tracking-wide leading-tight">
                  sample finder
                </h1>
                <p className="text-white/35 mt-2" style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', fontWeight: '300', letterSpacing: '0.5px'}}>
                  Discover who sampled the beat
                </p>
              </div>
              
              {/* Right: Main info */}
              <div className="text-right space-y-3">
                <div className="text-white/70 tracking-wide" style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px', fontWeight: '400'}}>
                  © 2025 Ellie Kim
                </div>
                <div className="text-white/50 tracking-wider" style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', fontWeight: '400'}}>
                  Data from Spotify and YouTube
                </div>
              </div>
              
            </div>
            
            {/* Bottom row with version and built with */}
            <div className="flex items-center justify-between">
              
              {/* Left: Empty space or could add something later */}
              <div></div>
              
              {/* Right: Version and links */}
              <div className="text-right space-y-2">
                <div className="flex items-center justify-end gap-6">
                  <span 
                    className="text-white/60 bg-white/5 px-3 py-1 rounded-full border border-white/10" 
                    style={{fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: '10px', fontWeight: '500', letterSpacing: '0.5px'}}
                  >
                    v0.6
                  </span>
                  <a 
                    href="https://github.com/elliekimdesign/sample-finder" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white/45 hover:text-white/70 transition-all duration-300"
                    style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', fontWeight: '400', textDecoration: 'none'}}
                  >
                    Patch Notes
                  </a>
                </div>
                <div className="text-white/30" style={{fontFamily: 'Inter, system-ui, sans-serif', fontSize: '10px', fontWeight: '300', letterSpacing: '1px'}}>
                  BUILT WITH VIBE CODING
                </div>
              </div>
              
            </div>
            
          </div>
        </footer>
      )}

    </div>
  );
}
