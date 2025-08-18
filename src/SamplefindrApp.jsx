import { useState, useEffect } from "react";
import ReactPlayer from "react-player";

// Placeholder discover list; replace items with real album art and YouTube links
const initialDiscover = [
  { title: "Next sampled track", artist: "TBD", thumbnail: "", youtube: "" },
  { title: "Another discovery", artist: "TBD", thumbnail: "", youtube: "" },
  { title: "Coming soon", artist: "TBD", thumbnail: "", youtube: "" },
];

export default function SamplefindrApp() {
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
  const [selectedCategory, setSelectedCategory] = useState(null); // 선택된 카테고리 ('tracks', 'artists', etc.)
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [hasSearched, setHasSearched] = useState(false); // 검색이 실행되었는지 추적
  const [discoverPage, setDiscoverPage] = useState(0); // Discover 섹션 페이지 인덱스
  const [isDirectAlbumClick, setIsDirectAlbumClick] = useState(false); // 앨범아트 직접 클릭인지 추적
  
  // Sample API integration states
  const [sampleApiLoading, setSampleApiLoading] = useState(false);
  const [sampleApiError, setSampleApiError] = useState('');
  const [lastApiQuery, setLastApiQuery] = useState('');
  
  // YouTube loading states
  const [youtubeLoading, setYoutubeLoading] = useState(new Set()); // Track which items are loading YouTube URLs

  // Prefer serverless API on Vercel; fall back to Vercel prod domain on static hosts (e.g., GitHub Pages)
  const apiBase = (import.meta?.env?.VITE_API_BASE) || (typeof window !== 'undefined' && (window.__VITE_API_BASE__ || (window.location.hostname.endsWith('github.io') ? 'https://samplr-red.vercel.app' : 'https://samplr-red.vercel.app')));

  async function fetchSpotifyJson(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error(`Spotify API ${res.status}`);
    if (!ct.includes('application/json')) throw new Error('Non-JSON response');
    return res.json();
  }

  // Fetch YouTube URL for a specific song
  async function fetchYouTubeUrl(title, artist) {
    try {
      console.log('🎥 Fetching YouTube URL for:', title, 'by', artist);
      
      const response = await fetch(`${apiBase}/api/youtube-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ title, artist })
      });

      if (!response.ok) {
        throw new Error(`YouTube search API ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🎥 YouTube search response:', data);
      
      return data;
    } catch (error) {
      console.error('❌ YouTube search error:', error);
      return {
        youtube_url: null,
        youtube_title: null,
        confidence: 0.0,
        search_strategy_used: `Error: ${error.message}`
      };
    }
  }

  // Fetch sample identification from Perplexity API
  async function fetchSampleIdentification(query) {
    try {
      setSampleApiLoading(true);
      setSampleApiError('');
      setLastApiQuery(query);
      
      console.log('🤖 Calling Sample API for:', query);
      
      const response = await fetch(`${apiBase}/api/samples`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`Sample API ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🎵 Sample API Response:', data);
      console.log('🔍 YouTube URLs in response:', {
        querySong: {
          title: data.query_song?.title,
          artist: data.query_song?.artist,
          youtube_url: data.query_song?.youtube_url,
          youtube_title: data.query_song?.youtube_title
        },
        sample: {
          title: data.main_sample?.title,
          artist: data.main_sample?.artist,
          youtube_url: data.main_sample?.youtube_url,
          youtube_title: data.main_sample?.youtube_title
        }
      });
      
      return data;
    } catch (error) {
      console.error('❌ Sample API Error:', error);
      setSampleApiError(error.message);
      throw error;
    } finally {
      setSampleApiLoading(false);
    }
  }

  // Enhance results with YouTube URLs (Step 2) - Progressive loading
  async function enhanceResultsWithYouTube(initialResults) {
    if (!Array.isArray(initialResults) || initialResults.length === 0) {
      return initialResults;
    }

    // Validate all results have required properties before starting enhancement
    const validResults = initialResults.filter((result, index) => {
      if (!result || typeof result !== 'object' || !result.title || !result.artist) {
        console.warn(`⚠️ Skipping invalid result at index ${index}:`, result);
        return false;
      }
      return true;
    });

    if (validResults.length === 0) {
      console.warn('⚠️ No valid results to enhance with YouTube URLs');
      return initialResults;
    }

    console.log('🎥 Starting YouTube URL enhancement for', validResults.length, 'valid results');
    
    // Create loading keys for tracking (using original indices to match render)
    const loadingKeys = new Set();
    initialResults.forEach((result, index) => {
      if (result && result.needsYouTubeSearch) {
        loadingKeys.add(`main-${index}`);
      }
      if (result && result.sampledFrom?.needsYouTubeSearch) {
        loadingKeys.add(`sample-${index}`);
      }
    });
    
    // Set loading state
    setYoutubeLoading(loadingKeys);
    
    // Create a copy of results that we'll update progressively
    let currentResults = [...initialResults];
    
    // Process each result individually and update state immediately
    const promises = initialResults.map(async (result, index) => {
      const tasks = [];
      
      // Fetch YouTube URL for main song if needed
      if (result.needsYouTubeSearch && result.title && result.artist) {
        tasks.push(
          fetchYouTubeUrl(result.title, result.artist)
            .then(youtubeData => {
              // Update results immediately when this completes
              setResults(prevResults => {
                // Validate that prevResults is an array and has the expected structure
                if (!Array.isArray(prevResults) || prevResults.length <= index) {
                  console.warn(`⚠️ Results array invalid or index ${index} out of bounds:`, prevResults);
                  return prevResults;
                }
                
                const newResults = [...prevResults];
                const currentResult = newResults[index];
                
                // Validate the current result object
                if (!currentResult || typeof currentResult !== 'object' || !currentResult.title) {
                  console.warn(`⚠️ Invalid result object at index ${index}:`, currentResult);
                  return prevResults; // Return unchanged if invalid
                }
                
                if (youtubeData.youtube_url && youtubeData.confidence > 0.5) {
                  newResults[index].youtube = youtubeData.youtube_url;
                  newResults[index].youtubeTitle = youtubeData.youtube_title;
                  newResults[index].youtubeConfidence = youtubeData.confidence;
                  console.log(`🎥 Main video loaded for result ${index}:`, youtubeData.youtube_url);
                } else {
                  console.log(`❌ Main video not found for result ${index} (confidence: ${youtubeData.confidence})`);
                }
                newResults[index].needsYouTubeSearch = false;
                
                return newResults;
              });
              
              // Remove from loading state
              setYoutubeLoading(prev => {
                const newSet = new Set(prev);
                newSet.delete(`main-${index}`);
                return newSet;
              });
            })
            .catch(error => {
              console.error('❌ Failed to fetch YouTube URL for main song:', error);
              // Still need to clear loading state and mark as not needing search
              setResults(prevResults => {
                if (!Array.isArray(prevResults) || prevResults.length <= index || !prevResults[index]) {
                  return prevResults;
                }
                const newResults = [...prevResults];
                newResults[index].needsYouTubeSearch = false;
                return newResults;
              });
              setYoutubeLoading(prev => {
                const newSet = new Set(prev);
                newSet.delete(`main-${index}`);
                return newSet;
              });
            })
        );
      }
      
      // Fetch YouTube URL for sample if needed
      if (result.sampledFrom?.needsYouTubeSearch && result.sampledFrom.title && result.sampledFrom.artist) {
        tasks.push(
          fetchYouTubeUrl(result.sampledFrom.title, result.sampledFrom.artist)
            .then(sampleYoutubeData => {
              // Update results immediately when this completes
              setResults(prevResults => {
                // Validate that prevResults is an array and has the expected structure
                if (!Array.isArray(prevResults) || prevResults.length <= index) {
                  console.warn(`⚠️ Results array invalid or index ${index} out of bounds for sample:`, prevResults);
                  return prevResults;
                }
                
                const newResults = [...prevResults];
                const currentResult = newResults[index];
                
                // Validate the current result object and its sampledFrom property
                if (!currentResult || typeof currentResult !== 'object' || !currentResult.title) {
                  console.warn(`⚠️ Invalid result object at index ${index} for sample:`, currentResult);
                  return prevResults; // Return unchanged if invalid
                }
                
                if (!currentResult.sampledFrom || typeof currentResult.sampledFrom !== 'object') {
                  console.warn(`⚠️ Invalid sampledFrom object at index ${index}:`, currentResult.sampledFrom);
                  return prevResults; // Return unchanged if invalid
                }
                
                if (sampleYoutubeData.youtube_url && sampleYoutubeData.confidence > 0.5) {
                  newResults[index].sampledFrom.youtube = sampleYoutubeData.youtube_url;
                  newResults[index].sampledFrom.youtubeTitle = sampleYoutubeData.youtube_title;
                  newResults[index].sampledFrom.youtubeConfidence = sampleYoutubeData.confidence;
                  console.log(`🎥 Sample video loaded for result ${index}:`, sampleYoutubeData.youtube_url);
                } else {
                  console.log(`❌ Sample video not found for result ${index} (confidence: ${sampleYoutubeData.confidence})`);
                }
                newResults[index].sampledFrom.needsYouTubeSearch = false;
                
                return newResults;
              });
              
              // Remove from loading state
              setYoutubeLoading(prev => {
                const newSet = new Set(prev);
                newSet.delete(`sample-${index}`);
                return newSet;
              });
            })
            .catch(error => {
              console.error('❌ Failed to fetch YouTube URL for sample:', error);
              // Still need to clear loading state and mark as not needing search
              setResults(prevResults => {
                if (!Array.isArray(prevResults) || prevResults.length <= index || !prevResults[index]?.sampledFrom) {
                  return prevResults;
                }
                const newResults = [...prevResults];
                newResults[index].sampledFrom.needsYouTubeSearch = false;
                return newResults;
              });
              setYoutubeLoading(prev => {
                const newSet = new Set(prev);
                newSet.delete(`sample-${index}`);
                return newSet;
              });
            })
        );
      }
      
      return Promise.all(tasks);
    });
    
    // Wait for all YouTube fetches to complete (but results are updated progressively)
    await Promise.all(promises);
    
    console.log('✅ YouTube URL enhancement completed');
    return currentResults; // This return value won't be used since we update state directly
  }

  // Helper function to safely join artists array
  function safeJoinArtists(artists) {
    return Array.isArray(artists) && artists.length > 0 ? artists.join(', ') : null;
  }

  // Convert API response to local DB format (Step 1: Song/Sample identification only)
  function convertApiResponseToLocalFormat(apiResponse) {
    try {
      // Validate API response structure
      if (!apiResponse || typeof apiResponse !== 'object') {
        console.warn('❌ Invalid API response structure:', apiResponse);
        return [];
      }

      const { query_song, main_sample, status } = apiResponse;
      
      // Check if we have the minimum required data
      if (status === 'unknown' || !query_song?.title || typeof query_song.title !== 'string') {
        console.warn('❌ API response missing required data:', { status, query_song });
        return [];
      }

      // Create a track object that matches local DB structure
      const track = {
        title: query_song.title.trim(),
        artist: (query_song.artist && typeof query_song.artist === 'string') ? query_song.artist.trim() : 'Unknown Artist',
        year: query_song.year || new Date().getFullYear(),
        album: query_song.album || null,
        youtube: '', // Will be populated by Step 2 (YouTube search)
        thumbnail: '', // Will be populated by Spotify search
        isApiResult: true, // Flag to indicate this came from API
        apiConfidence: main_sample?.confidence || 0,
        needsYouTubeSearch: true // Flag to indicate YouTube search is needed
      };

      // Add sample information if available
      if (main_sample?.title && main_sample.title !== 'none' && main_sample.confidence > 0) {
        track.sampledFrom = {
          title: main_sample.title.trim(),
          artist: (main_sample.artist && typeof main_sample.artist === 'string') ? main_sample.artist.trim() : 'Unknown Artist',
          year: main_sample.year || null,
          album: main_sample.album || null,
          youtube: '', // Will be populated by Step 2 (YouTube search)
          thumbnail: '',
          note: main_sample.note || null,
          needsYouTubeSearch: true // Flag to indicate YouTube search is needed
        };
      } else if (main_sample?.note) {
        // Store the note even if no sample was identified
        track.apiNote = main_sample.note;
      }

      // Debug logging for YouTube URLs
      console.log('🎵 Converting API response to track format:', {
        querySong: {
          title: track.title,
          artist: track.artist,
          youtube: track.youtube,
          youtubeUrl: query_song.youtube_url
        },
        sample: track.sampledFrom ? {
          title: track.sampledFrom.title,
          artist: track.sampledFrom.artist,
          youtube: track.sampledFrom.youtube,
          youtubeUrl: main_sample.youtube_url
        } : null
      });

      // Validate the final track object before returning
      if (!track.title || !track.artist) {
        console.warn('❌ Track object missing required fields:', track);
        return [];
      }

      return [track]; // Return as array to match local DB format
    } catch (error) {
      console.error('❌ Error converting API response:', error, apiResponse);
      return []; // Return empty array on any error
    }
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

  // All sample data now comes from AI API - no local database needed

  // Generate suggestions based on current query
  const generateSuggestions = (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    // For now, show simple suggestions. Could be enhanced with AI-powered suggestions later
    const baseSuggestions = [
      'Flashing Lights Kanye',
      'Halo Beyoncé', 
      'Stan Eminem',
      'California Love 2Pac',
      'Through the Wire',
      'Power Kanye West'
    ];
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    const matchingSuggestions = baseSuggestions.filter(suggestion =>
      suggestion.toLowerCase().includes(lowerSearchTerm)
    ).slice(0, 6);
    
    setSuggestions(matchingSuggestions);
    setShowSuggestions(matchingSuggestions.length > 0);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    generateSuggestions(value);
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    // Trigger search with the selected suggestion
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} };
      handleSearchWithTerm(suggestion, fakeEvent);
    }, 100);
  };

  const handleSearchWithTerm = (searchTerm, e) => {
    e.preventDefault();
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    
    // Always clear the selected category when doing a new search
    setSelectedCategory(null);
    setShowSuggestions(false);
    setDiscoverPage(0); // Reset discover section to first page
    setIsDirectAlbumClick(false); // Reset album click flag
    setYoutubeLoading(new Set()); // Clear YouTube loading states
    
    // If search term is empty, don't search
    if (!normalizedSearchTerm) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    
    // Mark that a search has been performed
    setHasSearched(true);
    
    // Always use AI API for all searches
    console.log('🤖 Using AI API for search:', searchTerm);
    
    // Call the sample identification API (Two-step process)
    (async () => {
      try {
        // Step 1: Get song and sample identification
        console.log('🎵 Step 1: Identifying song and sample...');
        const apiResponse = await fetchSampleIdentification(searchTerm);
        const convertedResults = convertApiResponseToLocalFormat(apiResponse);
        
        // Validate that convertedResults is an array and contains valid track objects
        if (Array.isArray(convertedResults) && convertedResults.length > 0) {
          // Double-check that all results have required properties
          const validResults = convertedResults.filter(item => 
            item && 
            typeof item === 'object' && 
            typeof item.title === 'string' && 
            item.title.trim().length > 0 &&
            typeof item.artist === 'string' && 
            item.artist.trim().length > 0
          );
          
          if (validResults.length > 0) {
            console.log('✅ Step 1 completed - Sample API found valid results:', validResults);
            
            // Set initial results (without YouTube URLs)
            setResults(validResults);
            
            // Step 2: Enhance with YouTube URLs (updates results progressively)
            console.log('🎥 Step 2: Fetching YouTube URLs...');
            await enhanceResultsWithYouTube(validResults);
            console.log('✅ Step 2 completed - YouTube URLs will appear as they load');
          } else {
            console.log('❌ Sample API returned no valid results after filtering');
            setResults([]); // Set to empty array to trigger category screen
          }
        } else {
          console.log('❌ Sample API returned no results');
          setResults([]); // Set to empty array to trigger category screen
        }
      } catch (error) {
        console.error('❌ Sample API failed:', error);
        // Still show empty results screen on API failure
        setResults([]);
      }
    })();
  };

  const handleSearch = (e) => {
    handleSearchWithTerm(query, e);
  };

  // Handle genre search
  const handleGenreSearch = (genre) => {
    const fakeEvent = { preventDefault: () => {} };
    setQuery(genre); // Set the genre as the search query for display
    setIsDirectAlbumClick(false); // Ensure header shows for genre search
    
    // Use AI API to search for tracks in this genre
    handleSearchWithTerm(genre, fakeEvent);
  };

  // Handle direct album click (without header)
  const handleDirectAlbumSearch = (trackTitle) => {
    const normalizedSearchTerm = trackTitle.trim().toLowerCase();
    
    // Set flags first
    setIsDirectAlbumClick(true);
    setSelectedCategory(null);
    setShowSuggestions(false);
    setDiscoverPage(0);
    setYoutubeLoading(new Set()); // Clear YouTube loading states
    
    if (!normalizedSearchTerm) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    
    setHasSearched(true);
    
    // Use AI API for direct album search as well
    console.log('🤖 Using AI API for direct album search:', trackTitle);
    
    (async () => {
      try {
        // Step 1: Get song and sample identification
        console.log('🎵 Step 1: Identifying song and sample for album search...');
        const apiResponse = await fetchSampleIdentification(trackTitle);
        const convertedResults = convertApiResponseToLocalFormat(apiResponse);
        
        // Validate that convertedResults is an array and contains valid track objects
        if (Array.isArray(convertedResults) && convertedResults.length > 0) {
          // Double-check that all results have required properties
          const validResults = convertedResults.filter(item => 
            item && 
            typeof item === 'object' && 
            typeof item.title === 'string' && 
            item.title.trim().length > 0 &&
            typeof item.artist === 'string' && 
            item.artist.trim().length > 0
          );
          
          if (validResults.length > 0) {
            console.log('✅ Step 1 completed - Sample API found valid results for album search:', validResults);
            
            // Set initial results (without YouTube URLs)
            setResults(validResults);
            
            // Step 2: Enhance with YouTube URLs (updates results progressively)
            console.log('🎥 Step 2: Fetching YouTube URLs for album search...');
            await enhanceResultsWithYouTube(validResults);
            console.log('✅ Step 2 completed - YouTube URLs will appear as they load');
          } else {
            console.log('❌ Sample API returned no valid results for album search after filtering');
            setResults([]);
          }
        } else {
          console.log('❌ Sample API returned no results for album search');
          setResults([]);
        }
      } catch (error) {
        console.error('❌ Sample API failed for album search:', error);
        setResults([]);
      }
    })();
  };

  // Navigate back to landing (clear results and query)
  const goHome = () => {
    setResults([]);
    setQuery("");
    setSelectedCategory(null);
    setHasSearched(false);
    setIsDirectAlbumClick(false);
    setYoutubeLoading(new Set()); // Clear YouTube loading states
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

  // Note: Discover section removed since we now use AI API for all data

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
                        linear-gradient(135deg, 
                          rgb(40, 35, 45) 0%, 
                          rgb(50, 40, 55) 20%, 
                          rgb(45, 35, 50) 40%, 
                          rgb(40, 35, 45) 60%, 
                          rgb(50, 40, 55) 80%, 
                          rgb(45, 35, 50) 100%),
                        radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, 
                          rgba(255, 255, 255, 0.08) 0%, 
                          rgba(255, 255, 255, 0.04) 15%, 
                          transparent 30%),
                        radial-gradient(circle at ${100 - mousePosition.x}% ${100 - mousePosition.y}%, 
                          rgba(255, 255, 255, 0.06) 0%, 
                          transparent 20%),
                        radial-gradient(circle at ${mousePosition.x * 0.7}% ${mousePosition.y * 0.7}%, 
                          rgba(255, 180, 120, 0.05) 0%, 
                          transparent 25%)
                      `,
                    }}
                  />
                  

                  
                  {/* Soft Organic Pattern Overlay */}
                  <div className="absolute inset-0 opacity-2" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3Ccircle cx='15' cy='15' r='0.5'/%3E%3Ccircle cx='45' cy='45' r='0.5'/%3E%3Ccircle cx='15' cy='45' r='0.3'/%3E%3Ccircle cx='45' cy='15' r='0.3'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                  }}></div>
                  




      {/* Landing Page Container */}
      {!hasSearched ? (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 pb-16 pt-16 md:pt-24 lg:pt-32 xl:pt-48">
                    
                      {/* Mouse-tracking radial gradient effect for Landing Page */}
                      <div 
                        className="absolute inset-0 transition-all duration-1000 ease-out"
                        style={{
                          background: `
                            radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, 
                              rgba(255, 255, 255, 0.03) 0%, 
                              rgba(255, 255, 255, 0.015) 15%, 
                              transparent 25%),
                            radial-gradient(circle at ${100 - mousePosition.x}% ${100 - mousePosition.y}%, 
                              rgba(255, 255, 255, 0.02) 0%, 
                              transparent 20%)
                          `
                        }}
                      />
                    
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
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '1.8s' }}>f</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '2.1s' }}>i</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '2.4s' }}>n</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '2.7s' }}>d</span>
                            <span className="inline-block animate-textGlow" style={{ animationDelay: '3s' }}>r</span>
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
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
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
                            
                            {/* Autocomplete Suggestions */}
                            {showSuggestions && suggestions.length > 0 && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-50 overflow-hidden">
                                {suggestions.map((suggestion, index) => (
                                  <div
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="px-6 py-3 text-white hover:bg-white/10 cursor-pointer transition-colors duration-200 border-b border-white/10 last:border-b-0"
                                  >
                                    <span className="text-sm font-light">{suggestion}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </form>

                          {/* Example suggestion */}
                          <div className="text-center mt-8">
                            <button 
                              type="button"
                              onClick={() => {
                                setQuery("Why I Love You Kanye");
                                setTimeout(() => {
                                  const fakeEvent = { preventDefault: () => {} };
                                  handleSearchWithTerm("Why I Love You Kanye", fakeEvent);
                                }, 100);
                              }}
                              className="text-xs text-white/40 hover:text-white/70 font-inter font-light transition-colors duration-300"
                            >
                              Try "Why I Love You"
                            </button>
                          </div>

                          {/* AI-Powered Search Suggestions */}
                          <div className="mt-24 w-full max-w-6xl">
                            <div className="text-center mb-8">
                              <h3 className="text-white/60 text-sm font-medium mb-4">
                                Try searching for these popular samples
                              </h3>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 justify-items-center">
                              {[
                                { query: 'Flashing Lights Kanye', title: 'Flashing Lights', artist: 'Kanye West' },
                                { query: 'Stan Eminem', title: 'Stan', artist: 'Eminem' },
                                { query: 'California Love 2Pac', title: 'California Love', artist: '2Pac' },
                                { query: 'Through the Wire', title: 'Through the Wire', artist: 'Kanye West' },
                                { query: 'Power Kanye', title: 'Power', artist: 'Kanye West' },
                                { query: 'Halo Beyonce', title: 'Halo', artist: 'Beyoncé' }
                              ].map((suggestion, idx) => {
                                
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
                                      setQuery(suggestion.query);
                                      setTimeout(() => {
                                        const fakeEvent = { preventDefault: () => {} };
                                        handleSearchWithTerm(suggestion.query, fakeEvent);
                                      }, 100);
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
                                      <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                        <div className="text-white/60 text-center">
                                          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                          </svg>
                                          <div className="text-xs">AI Search</div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-center">
                                      <h4 className="text-white text-xs font-medium mb-1 line-clamp-2 leading-tight">
                                        {suggestion.title}
                                      </h4>
                                      <p className="text-white/60 text-xs line-clamp-1">
                                        {suggestion.artist}
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
        <div className="relative z-10 min-h-screen pt-6 flex flex-col">
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
                    rgba(255, 255, 255, 0.015) 15%, 
                    transparent 25%),
                  radial-gradient(circle at ${100 - mousePosition.x}% ${100 - mousePosition.y}%, 
                    rgba(255, 255, 255, 0.02) 0%, 
                    transparent 20%)
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
                            samplefindr
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
                                        onClick={() => handleGenreSearch(g)}
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
                    <div className="w-full max-w-7xl mx-auto px-6 flex-1">
                      
                      {/* Sample API Loading State */}
                      {sampleApiLoading && (
                        <div className="pt-16 text-center">
                          <div className="mb-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/5 rounded-full animate-pulse">
                              <svg className="w-8 h-8 text-white/40 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                          </div>
                          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2">
                            Searching with AI...
                          </h2>
                          <p className="text-white/60 text-sm">
                            Identifying samples for "{lastApiQuery}"
                          </p>
                          {sampleApiError && (
                            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg max-w-md mx-auto">
                              <p className="text-red-300 text-sm">
                                {sampleApiError}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Category Selection View (Search results for XX) - Only when no results */}
                      {hasSearched && !selectedCategory && results.length === 0 && !sampleApiLoading && (
                        <div className="pt-8">
                          {/* Search Query Display */}
                          <div className="text-center mb-8">
                            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                              Search results for
                            </h1>
                            <h2 className="text-5xl md:text-6xl font-bold text-white">
                              "{query}"
                            </h2>
                          </div>
                          
                          {/* No Results Info */}
                          <div className="text-center mb-8">
                            <p className="text-lg text-white/70 mb-2">
                              No tracks or artists found
                            </p>
                            <p className="text-sm text-white/50">
                              Try one of the suggestions below
                            </p>
                          </div>
                          
                          {/* Horizontal line */}
                          <div className="h-px bg-white/10 w-full mb-8"></div>
                          
                          {/* Artists Preview */}
                          <div className="mb-12">
                            <h3 className="text-xl font-bold text-white mb-6">
                              Other artists
                            </h3>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60 leading-relaxed">
                              {[
                                'Kanye West', 'Eminem', 'Beyoncé', '2Pac', 'Jay-Z', 'Drake',
                                'Kendrick Lamar', 'Nas', 'The Notorious B.I.G.', 'OutKast',
                                'Wu-Tang Clan', 'A Tribe Called Quest', 'De La Soul', 'Public Enemy'
                              ].map((artist, i) => (
                                <span 
                                  key={i} 
                                  className="hover:text-white/80 cursor-pointer transition-colors"
                                  onClick={() => {
                                    const fakeEvent = { preventDefault: () => {} };
                                    handleSearchWithTerm(artist, fakeEvent);
                                  }}
                                >
                                  {artist}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Discover Section */}
                          <div className="mb-8">
                            <div className="flex items-center justify-between mb-6">
                              <h3 className="text-xl font-bold text-white">
                                Discover more sampled tracks
                              </h3>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="text-white/30 text-xs">scroll</span>
                              </div>
                            </div>
                            <div className="text-center py-8">
                              <p className="text-white/60 text-sm">
                                All sample discovery is now powered by AI. Search for any song above!
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Detailed Track View - Show directly when results exist */}
                      {results.length > 0 && (
                        <div>
                          
                          {/* Search Results Header - Show when any results exist (except direct album clicks) */}
                          {results.length > 0 && !isDirectAlbumClick && (
                            <div className="mb-8 pb-4 text-center">
                              <h2 className="text-white/60 text-sm font-normal tracking-wide">
                                Found {results.length} tracks {results.some(r => r.isApiResult) ? 'for' : 'by'} {query}
                              </h2>
                              <p className="text-white/35 text-xs mt-1 font-light">
                                {results.some(r => r.isApiResult) 
                                  ? 'Results identified using AI-powered sample detection'
                                  : 'Showing most popular tracks first'
                                }
                              </p>
                              <div className="mt-4 h-px bg-white/5"></div>
                            </div>
                          )}

        {(Array.isArray(results) ? results : [])
          .filter((item, originalIndex) => {
            // More robust validation to prevent undefined errors
            const isValid = item && 
              typeof item === 'object' && 
              item.title &&
              typeof item.title === 'string' && 
              item.title.trim().length > 0 &&
              item.artist &&
              typeof item.artist === 'string' && 
              item.artist.trim().length > 0;
            
            if (!isValid) {
              console.warn(`⚠️ Filtering out invalid result at index ${originalIndex}:`, item);
            }
            
            return isValid;
          })
          .filter(item => item != null) // Additional safety filter to remove any null/undefined items
          .map((item, i) => (
                        <div
                          key={i}
                          className={`${i > 0 ? 'pt-12 mt-12' : 'pt-8 mt-8'}`}
                        >
                          {/* Simple Track Header */}
                          <div className="mb-12">
              <div className="flex items-center gap-3 mb-2">
                              <h1 className={`text-2xl md:text-3xl font-bold text-white ${((spotifyInfo[`${item?.title}|${item?.artist}`]?.title) || item?.title || '').toLowerCase().includes('why i love you') ? 'font-libreCaslon' : 'font-notoSerif'}`}>
                                {(spotifyInfo[`${item?.title}|${item?.artist}`]?.title) || item?.title}
                              </h1>
                              {item?.isApiResult && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  AI Identified
                                </span>
                              )}
                            </div>
                            <p className="text-lg text-white/70">
                              by {safeJoinArtists(spotifyInfo[`${item?.title}|${item?.artist}`]?.artists) || item?.artist}
                            </p>
                            {item?.sampledFrom && item?.sampledFrom?.title && item?.sampledFrom?.artist && (
                              <p className="text-sm text-white/50 mt-2">
                                Samples "{item?.sampledFrom?.title}" by {item?.sampledFrom?.artist}
                                {item?.sampledFrom?.note && (
                                  <span className="block text-xs text-white/40 mt-1">
                                    {item?.sampledFrom?.note}
                                  </span>
                                )}
                              </p>
                            )}
                            {item?.apiNote && !item?.sampledFrom && (
                              <p className="text-sm text-white/40 mt-2 italic">
                                {item?.apiNote}
                              </p>
                            )}
                          </div>

                          {/* Album Info */}
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-12 xl:gap-16 relative mb-6 -mt-2">
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
                                <div className="relative w-[11.5rem] flex-shrink-0 cursor-pointer transition-transform duration-300 hover:scale-[1.03]" onClick={() => openPanel({
                                  type: 'sampled',
                                  title: (spotifyInfo[`${item?.title}|${item?.artist}`]?.title) || item?.title,
                                  artist: safeJoinArtists(spotifyInfo[`${item?.title}|${item?.artist}`]?.artists) || item?.artist,
                                  year: (spotifyInfo[`${item?.title}|${item?.artist}`]?.year) || item?.year,
                                  image: (spotifyInfo[`${item?.title}|${item?.artist}`]?.coverUrl) || item?.thumbnail,
                                  description: 'Artist and album details will appear here. Placeholder content.'
                                })}>
                                  <div className="absolute -inset-1 opacity-70" style={{
                                    background: (() => { const c = dominantColors[`${item?.title}|${item?.artist}`]; return c ? `radial-gradient(60% 60% at 50% 50%, rgba(${c.r},${c.g},${c.b},0.35) 0%, rgba(${c.r},${c.g},${c.b},0.0) 70%)` : 'transparent'; })()
                                  }}></div>
                                  <img 
                                    src={spotifyCovers[`${item?.title}|${item?.artist}`] || item?.thumbnail} 
                                    alt={`${item?.title || 'Unknown'} album art`}
                                    className="relative w-full aspect-square object-cover shadow-xl" 
                                  />
          </div>
                                
                                {/* Song Info */}
                                <div className="flex-1 cursor-pointer" onClick={() => openPanel({
                                  type: 'sampled',
                                  title: (spotifyInfo[`${item?.title}|${item?.artist}`]?.title) || item?.title,
                                  artist: safeJoinArtists(spotifyInfo[`${item?.title}|${item?.artist}`]?.artists) || item?.artist,
                                  year: (spotifyInfo[`${item?.title}|${item?.artist}`]?.year) || item?.year,
                                  image: (spotifyInfo[`${item?.title}|${item?.artist}`]?.coverUrl) || item?.thumbnail,
                                  description: 'Artist and album details will appear here. Placeholder content.'
                                })}>
                                  <h3 className="text-xl font-bold text-white font-notoSerif">{(spotifyInfo[`${item?.title}|${item?.artist}`]?.title) || item?.title}</h3>
                                  <p className="text-base text-gray-300">{safeJoinArtists(spotifyInfo[`${item?.title}|${item?.artist}`]?.artists) || item?.artist}</p>
                                  <p className="text-sm text-gray-500">{(spotifyInfo[`${item?.title}|${item?.artist}`]?.year) || item?.year}</p>
                                  
                                  {/* Genre Tags */}
                                  {spotifyInfo[`${item?.title}|${item?.artist}`]?.genres && spotifyInfo[`${item?.title}|${item?.artist}`].genres.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                      {spotifyInfo[`${item?.title}|${item?.artist}`].genres.slice(0, 3).map((genre, idx) => (
                                        <span
                                          key={idx}
                                          className="px-3 py-1 text-[10px] rounded-full bg-white/5 border border-white/10 text-white/60 whitespace-nowrap"
                                        >
                                          {genre.charAt(0).toUpperCase() + genre.slice(1)}
                                        </span>
        ))}
      </div>
                                  )}
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
                              
                              {item?.sampledFrom?.title ? (
                                <div className="flex items-start gap-4">
                                {/* Album Art */}
                                <div className="relative w-[11.5rem] flex-shrink-0 cursor-pointer transition-transform duration-300 hover:scale-[1.03]" onClick={() => openPanel({
                                  type: 'source',
                                  title: (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.title) || item?.sampledFrom?.title,
                                  artist: safeJoinArtists(spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.artists) || item?.sampledFrom?.artist,
                                  year: (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.year) || item?.sampledFrom?.year,
                                  image: (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.coverUrl) || item?.sampledFrom?.thumbnail,
                                  description: 'Source artist and album details will appear here. Placeholder content.'
                                })}>
                                  <div className="absolute -inset-1 opacity-70" style={{
                                    background: (() => { const c = dominantColors[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]; return c ? `radial-gradient(60% 60% at 50% 50%, rgba(${c.r},${c.g},${c.b},0.35) 0%, rgba(${c.r},${c.g},${c.b},0.0) 70%)` : 'transparent'; })()
                                  }}></div>
                                  <img 
                                    src={spotifyCovers[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`] || item?.sampledFrom?.thumbnail} 
                                    alt={`${item?.sampledFrom?.title || 'Unknown'} album art`}
                                    className="relative w-full aspect-square object-cover shadow-xl" 
                                  />
          </div>
                                
                                {/* Song Info */}
                                <div className="flex-1 cursor-pointer" onClick={() => openPanel({
                                  type: 'source',
                                  title: (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.title) || item?.sampledFrom?.title,
                                  artist: safeJoinArtists(spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.artists) || item?.sampledFrom?.artist,
                                  year: (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.year) || item?.sampledFrom?.year,
                                  image: (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.coverUrl) || item?.sampledFrom?.thumbnail,
                                  description: 'Source artist and album details will appear here. Placeholder content.'
                                })}>
                                  <h3 className="text-xl font-bold text-white font-notoSerif">{(spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.title) || item?.sampledFrom?.title}</h3>
                                  <p className="text-base text-gray-300">{safeJoinArtists(spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.artists) || item?.sampledFrom?.artist}</p>
                                  <p className="text-sm text-gray-500">{(spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.year) || item?.sampledFrom?.year}</p>
                                  
                                  {/* Genre Tags */}
                                  {spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.genres && spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`].genres.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                      {spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`].genres.slice(0, 3).map((genre, idx) => (
                                        <span
                                          key={idx}
                                          className="px-3 py-1 text-[10px] rounded-full bg-white/5 border border-white/10 text-white/60 whitespace-nowrap"
                                        >
                                          {genre.charAt(0).toUpperCase() + genre.slice(1)}
                                        </span>
        ))}
      </div>
                                  )}
                                </div>
                              </div>
                              ) : (
                                <div className="flex items-center justify-center h-64">
                                  <div className="text-center text-white/60">
                                    <svg className="w-16 h-16 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0118 12c0-4.418-3.582-8-8-8s-8 3.582-8 8a7.962 7.962 0 012 5.291m1.172 1.172A3.963 3.963 0 016 18c0-1.105.448-2.105 1.172-2.828M18 18c0-1.105-.448-2.105-1.172-2.828" />
                                    </svg>
                                    <p className="text-lg font-medium">No sample found</p>
                                    <p className="text-sm text-white/40 mt-2">This track doesn't contain any known samples</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Video Player Cards */}
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-12 xl:gap-16 relative pt-12">
                            {/* Vertical Divider - only visible on large screens */}
                            <div className="hidden xl:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-white/5 to-transparent transform -translate-x-1/2"></div>
                            
                            {/* Left Side - Sampled Song Video */}
                            <div className="relative group">
                                            <div className="absolute -top-8 left-0">
                <span className="text-sm font-bold text-white">
                  Play & Compare
                </span>
              </div>
                              <div className="pointer-events-none absolute -inset-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{background:'radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.00) 70%)'}}></div>
                              <div className="rounded-xl overflow-hidden shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)] transition-all duration-400 group-hover:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.75)] scale-[0.95] md:scale-[0.95] group-hover:scale-100 opacity-75 group-hover:opacity-100">
                                <div className="aspect-video">
                                  {item?.youtube ? (
                                    <iframe
                                      width="100%"
                                      height="100%"
                                      src={(() => {
                                        const extractVideoId = (url) => {
                                          if (url.includes('youtu.be/')) {
                                            const parts = url.split('youtu.be/')[1];
                                            const videoId = parts ? parts.split('?')[0] : null;
                                            const timeMatch = url.match(/[?&]t=(\d+)/);
                                            const startTime = timeMatch ? timeMatch[1] : null;
                                            return { videoId, startTime };
                                          } else {
                                            const urlParts = url.split('v=')[1];
                                            const videoId = urlParts ? urlParts.split('&')[0] : null;
                                            return { videoId, startTime: null };
                                          }
                                        };
                                        const { videoId, startTime } = extractVideoId(item?.youtube);
                                        return `https://www.youtube.com/embed/${videoId}?controls=1${startTime ? `&start=${startTime}` : ''}`;
                                      })()}
                                      title="YouTube video player"
                                      frameBorder="0"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                      className="w-full h-full filter grayscale group-hover:grayscale-0 transition-[filter] duration-400"
                                    />
                                  ) : youtubeLoading.has(`main-${i}`) ? (
                                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                      <div className="text-center text-white/40">
                                        <div className="inline-flex items-center justify-center w-12 h-12 mb-2 animate-spin">
                                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        </div>
                                        <p className="text-sm">Loading video...</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                      <div className="text-center text-white/40">
                                        <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        <p className="text-sm">No video available</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right Side - Sample Source Video */}
                            <div className="relative group">
                              <div className="pointer-events-none absolute -inset-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{background:'radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.00) 70%)'}}></div>
                              <div className="rounded-xl overflow-hidden shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)] transition-all duration-400 group-hover:shadow-[0_30px_70px_-24px_rgba(0,0,0,0.75)] scale-[0.95] md:scale-[0.95] group-hover:scale-100 opacity-75 group-hover:opacity-100">
                                <div className="aspect-video">
                                  {item?.sampledFrom?.title ? (
                                    item?.sampledFrom?.youtube ? (
                                    <iframe
                                      width="100%"
                                      height="100%"
                                      src={(() => {
                                        const extractVideoId = (url) => {
                                          if (url.includes('youtu.be/')) {
                                            const parts = url.split('youtu.be/')[1];
                                            const videoId = parts ? parts.split('?')[0] : null;
                                            const timeMatch = url.match(/[?&]t=(\d+)/);
                                            const startTime = timeMatch ? timeMatch[1] : null;
                                            return { videoId, startTime };
                                          } else {
                                            const urlParts = url.split('v=')[1];
                                            const videoId = urlParts ? urlParts.split('&')[0] : null;
                                            return { videoId, startTime: null };
                                          }
                                        };
                                        const { videoId, startTime } = extractVideoId(item?.sampledFrom?.youtube);
                                        return `https://www.youtube.com/embed/${videoId}?controls=1${startTime ? `&start=${startTime}` : ''}`;
                                      })()}
                                      title="YouTube video player"
                                      frameBorder="0"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                      className="w-full h-full filter grayscale group-hover:grayscale-0 transition-[filter] duration-400"
                                    />
                                  ) : youtubeLoading.has(`sample-${i}`) ? (
                                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                      <div className="text-center text-white/40">
                                        <div className="inline-flex items-center justify-center w-12 h-12 mb-2 animate-spin">
                                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        </div>
                                        <p className="text-sm">Loading video...</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                      <div className="text-center text-white/40">
                                        <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        <p className="text-sm">No video available</p>
                                      </div>
                                    </div>
                                  )
                                ) : (
                                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                    <div className="text-center text-white/40">
                                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                      <p className="text-sm">No sample found</p>
                                    </div>
                                  </div>
                                )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                      {/* Discover More - clearly separated section (wider than main) */}
                      {results.length > 0 && (
                        <div className="mt-32 lg:mt-48 relative w-screen left-1/2 -translate-x-1/2">
                          <div className="max-w-[90rem] mx-auto px-6">
                            <div className="h-px bg-white/5 mb-8"></div>
                            <div className="flex items-center justify-between mb-6">
                              <h4 className="text-white/85 text-lg font-semibold">Discover more sampled tracks</h4>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => setDiscoverPage(Math.max(0, discoverPage - 1))}
                                  disabled={discoverPage === 0}
                                  className={`p-2 rounded-full transition-all duration-200 ${
                                    discoverPage === 0 
                                      ? 'text-white/20 cursor-not-allowed' 
                                      : 'text-white/40 hover:text-white/70 hover:bg-white/5 cursor-pointer'
                                  }`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                                  </svg>
                                </button>
                                <button 
                                  disabled={true}
                                  className="p-2 rounded-full transition-all duration-200 text-white/20 cursor-not-allowed"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                                <span className="text-white/30 text-xs ml-1">
                                  AI Powered Discovery
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                            {[].map((item, idx) => {
                              // This section has been replaced with AI-powered search
                              
                              // 디버깅 로그 제거 (무한 루프 방지)
                              
                              return (
                              <div 
                                key={idx} 
                                className="cursor-pointer select-none group transition-transform duration-200 hover:scale-[1.02]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDirectAlbumSearch(track.title);
                                }}
                              >
                                <div className="w-[92%] aspect-square bg-white/5 overflow-hidden mb-4 relative mx-auto transition-all duration-200 group-hover:shadow-lg group-hover:shadow-white/5">
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
                    <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[320px] md:w-[360px] lg:w-[400px] xl:w-[440px] 2xl:w-[480px] backdrop-blur-md transform transition-transform duration-300 ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{background: 'linear-gradient(135deg, rgba(22, 15, 20, 0.97) 0%, rgba(28, 20, 25, 0.95) 20%, rgba(32, 22, 28, 0.93) 35%, rgba(26, 18, 23, 0.95) 50%, rgba(20, 14, 18, 0.96) 65%, rgba(16, 11, 15, 0.97) 80%, rgba(10, 8, 12, 0.98) 100%)', borderLeft: '2px solid rgba(255, 255, 255, 0.06)'}}>
                      {/* Body */}
                      <div className="overflow-y-auto h-full">
                        {/* Artist image - Full width header style with overlay header */}
                        <div className="w-full rounded-none overflow-hidden bg-white/5 relative">
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
                              <div className="w-full aspect-[5/4]">
                                <img src={src} alt="Artist or album" className="w-full h-full object-cover object-top" />
                                
                                {/* Header overlay */}
                                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/40 via-black/20 to-transparent p-5 pt-8">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="text-sm text-white/90 uppercase tracking-wide mb-2">About Artist</p>
                                      <h3 className="text-3xl font-semibold text-white drop-shadow-lg">
                                        {panelSpotifyData?.artists?.[0] || (panelData?.artist ? panelData.artist.split(',')[0]?.trim() : 'Artist')}
                                      </h3>
                                    </div>
                                    <button onClick={closePanel} className="p-2 rounded-md hover:bg-white/10 text-white/90 hover:text-white transition-colors backdrop-blur-sm" aria-label="Close">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        
                        {/* Content section with padding */}
                        <div className="p-5 space-y-4">
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
                              {safeJoinArtists(panelSpotifyData?.artists) || panelData?.artist || 'Unknown Artist'}
                            </p>
                            <p className="text-sm text-white/65 font-normal">{panelData?.year || 'Unknown Year'}</p>
                          </div>
                        </div>



                        {/* Artist information and bio */}
                        <div className="space-y-4">
                          {/* Show available info from flat structure */}
                          {panelSpotifyData && (
                            <div className="space-y-2">
                              {panelSpotifyData.genres && panelSpotifyData.genres.length > 0 && (
                                <div>
                                  <span className="text-white/60 text-sm">Genres</span>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {(panelSpotifyData?.genres || []).map((genre, index) => (
                                      <span key={index} className="px-3 py-1.5 text-xs font-medium bg-white/8 text-white/75 rounded-full tracking-wide border border-white/10">
                                        {genre.charAt(0).toUpperCase() + genre.slice(1)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {panelSpotifyData.artists && panelSpotifyData.artists.length > 0 && (
                                <div>
                                  <span className="text-white/60 text-sm">Artist</span>
                                  <div className="text-white font-medium">{panelSpotifyData?.artists?.[0] || 'Unknown Artist'}</div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Spotify stats (if available) */}
                          {panelSpotifyData?.artist && panelSpotifyData.artist.popularity > 0 && (
                            <div>
                              <span className="text-white/60 text-sm">Popularity</span>
                              <div className="text-white font-medium mt-1">
                                {Math.round(panelSpotifyData.artist.popularity / 10)}/10
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
                    </div>
                    {/* Backdrop */}
                    {panelOpen && (
                      <button className="fixed inset-0 z-40 bg-[#161228]/52" onClick={closePanel} aria-label="Close panel backdrop"></button>
                    )}
                    
                    {/* Footer for Results Page */}
                    <footer className="relative mt-64 py-16 px-6">
                        {/* Very dark subtle background */}
                        <div className="absolute inset-0 bg-gray-950/60"></div>
                        
                        <div className="relative w-full px-6">
                          
                          {/* Top row with logo and main info */}
                          <div className="flex items-start justify-between mb-6">
                            
                            {/* Left: Logo */}
                            <div className="flex-shrink-0">
                              <h1 className="text-white/60 font-bitcount text-2xl tracking-wide leading-tight">
                                samplefindr
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
      {!hasSearched && (
        <footer className="relative mt-32 py-16 px-6">
          {/* Very dark subtle background */}
          <div className="absolute inset-0 bg-gray-950/60"></div>
          
          <div className="relative w-full px-6">
            
            {/* Top row with logo and main info */}
            <div className="flex items-start justify-between mb-6">
              
              {/* Left: Logo */}
              <div className="flex-shrink-0">
                <h1 className="text-white/60 font-bitcount text-2xl tracking-wide leading-tight">
                  samplefindr
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
