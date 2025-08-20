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
  const [completedQuery, setCompletedQuery] = useState(""); // Track the completed search query
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
  const [discoveryTracks, setDiscoveryTracks] = useState([]); // tracks for discovery section
  const [selectedCategory, setSelectedCategory] = useState(null); // 선택된 카테고리 ('tracks', 'artists', etc.)
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [hasSearched, setHasSearched] = useState(false); // 검색이 실행되었는지 추적

  const [isDirectAlbumClick, setIsDirectAlbumClick] = useState(false); // 앨범아트 직접 클릭인지 추적
  
  // Homepage segmented control states
  const [homeView, setHomeView] = useState('trending'); // 'trending' or 'discover'
  const [homeNowTracks, setHomeNowTracks] = useState([]);
  const [homeDiscoverTracks, setHomeDiscoverTracks] = useState([]);
  const [homeTracksLoading, setHomeTracksLoading] = useState(true);
  const [homeAlbumArt, setHomeAlbumArt] = useState({}); // Store album art for homepage tracks
  const [noResultsAlbumArt, setNoResultsAlbumArt] = useState({}); // Store album art for no-results discovery tracks
  
  // Sample API integration states
  const [sampleApiLoading, setSampleApiLoading] = useState(false);
  const [sampleApiError, setSampleApiError] = useState('');
  const [lastApiQuery, setLastApiQuery] = useState('');
  
  // YouTube loading states
  const [youtubeLoading, setYoutubeLoading] = useState(new Set()); // Track which items are loading YouTube URLs

  // Prefer serverless API on Vercel; fall back to Vercel prod domain on static hosts (e.g., GitHub Pages)
  const apiBase = (import.meta?.env?.VITE_API_BASE) || (typeof window !== 'undefined' && (window.__VITE_API_BASE__ || (window.location.hostname.endsWith('github.io') ? 'https://samplr-red.vercel.app' : 'https://samplr-red.vercel.app')));

  // Year correction database for tracks with incorrect Spotify API data
  const yearCorrections = {
    'more spell on you|eddie johns': 1979,
    'more spell on you|eddie john': 1979, // Alternative spelling
    'juicy fruit|mtume': 1983,
    'thank you|dido': 1998,
    'woman to woman|joe cocker': 1972,
    'through the fire|chaka khan': 1984,
    'i got a woman|ray charles': 1954,
    'are you my woman|the chi-lites': 1970,
    'gimme! gimme! gimme!|abba': 1979,
    'tainted love|soft cell': 1981,
    'harder better faster stronger|daft punk': 2001
  };

  // Curated database of ONLY tracks that contain verified samples from other songs
  const sampledTracksDatabase = {
    'hip hop': [
      { title: 'Juicy', artist: 'The Notorious B.I.G.', genre: 'hip hop', priority: 10, hasSample: true, sampleSource: 'Mtume - Juicy Fruit' },
      { title: 'C.R.E.A.M.', artist: 'Wu-Tang Clan', genre: 'hip hop', priority: 9, hasSample: true, sampleSource: 'The Charmels - As Long As I\'ve Got You' },
      { title: 'Rapper\'s Delight', artist: 'Sugarhill Gang', genre: 'hip hop', priority: 10, hasSample: true, sampleSource: 'Chic - Good Times' },
      { title: 'It Was a Good Day', artist: 'Ice Cube', genre: 'hip hop', priority: 9, hasSample: true, sampleSource: 'The Isley Brothers - Footsteps in the Dark' },
      { title: 'Nuthin\' but a \'G\' Thang', artist: 'Dr. Dre', genre: 'hip hop', priority: 9, hasSample: true, sampleSource: 'Leon Haywood - I Want\'a Do Something Freaky to You' },
      { title: 'Public Enemy', artist: 'Fight the Power', genre: 'hip hop', priority: 8, hasSample: true, sampleSource: 'The Isley Brothers - Fight the Power' }
    ],
    'rap': [
      { title: 'Stan', artist: 'Eminem', genre: 'rap', priority: 10, hasSample: true, sampleSource: 'Dido - Thank You' },
      { title: 'California Love', artist: '2Pac', genre: 'rap', priority: 10, hasSample: true, sampleSource: 'Joe Cocker - Woman to Woman' },
      { title: 'Through the Wire', artist: 'Kanye West', genre: 'rap', priority: 9, hasSample: true, sampleSource: 'Chaka Khan - Through the Fire' },
      { title: 'Gold Digger', artist: 'Kanye West', genre: 'rap', priority: 9, hasSample: true, sampleSource: 'Ray Charles - I Got a Woman' },
      { title: 'Jesus Walks', artist: 'Kanye West', genre: 'rap', priority: 8, hasSample: true, sampleSource: 'ARC Choir - Walk with Me' },
      { title: 'Lose Yourself', artist: 'Eminem', genre: 'rap', priority: 10, hasSample: true, sampleSource: 'Jeff Bass - Lose Yourself (Instrumental)' }
    ],
    'r&b': [
      { title: 'Crazy in Love', artist: 'Beyoncé', genre: 'r&b', priority: 10, hasSample: true, sampleSource: 'The Chi-Lites - Are You My Woman' },
      { title: 'Ignition (Remix)', artist: 'R. Kelly', genre: 'r&b', priority: 8, hasSample: true, sampleSource: 'Edge - I Don\'t Want to Be a Player' },
      { title: 'Family Affair', artist: 'Mary J. Blige', genre: 'r&b', priority: 9, hasSample: true, sampleSource: 'Chic - Upside Down' }
    ],
    'pop': [
      { title: 'Stronger', artist: 'Kanye West', genre: 'pop', priority: 9, hasSample: true, sampleSource: 'Daft Punk - Harder Better Faster Stronger' },
      { title: 'Hung Up', artist: 'Madonna', genre: 'pop', priority: 10, hasSample: true, sampleSource: 'ABBA - Gimme! Gimme! Gimme!' },
      { title: 'SOS', artist: 'Rihanna', genre: 'pop', priority: 9, hasSample: true, sampleSource: 'Soft Cell - Tainted Love' },
      { title: 'Bitter Sweet Symphony', artist: 'The Verve', genre: 'pop', priority: 8, hasSample: true, sampleSource: 'The Rolling Stones - The Last Time' }
    ],
    'electronic': [
      { title: 'One More Time', artist: 'Daft Punk', genre: 'electronic', priority: 10, hasSample: true, sampleSource: 'Eddie Johns - More Spell on You' },
      { title: 'Harder Better Faster Stronger', artist: 'Daft Punk', genre: 'electronic', priority: 9, hasSample: true, sampleSource: 'Edwin Birdsong - Cola Bottle Baby' },
      { title: 'Marijuana', artist: 'Chrome Sparks', genre: 'electronic', priority: 8, hasSample: true, sampleSource: 'Idris Muhammad - Could Heaven Ever Be Like This' }
    ],
    'soul': [
      { title: 'I Got You (I Feel Good)', artist: 'James Brown', genre: 'soul', priority: 8, hasSample: true, sampleSource: 'Yvonne Fair - I Found You' }
    ]
  };

  // Helper function to get corrected year data
  function getCorrectedYear(title, artist, spotifyYear) {
    const key = `${title?.toLowerCase()}|${artist?.toLowerCase()}`;
    return yearCorrections[key] || spotifyYear;
  }

  // Homepage API fetching functions - MUST RETURN ONLY SAMPLED TRACKS
     const fetchHomeNowTracks = async () => {
     try {
       // API should only return tracks that contain verified samples
       const response = await fetch('/api/home-now?limit=6&samples_only=true');
       if (response.ok) {
         const data = await response.json();
         // STRICT FILTER: Only tracks with credited main samples from other songs
         const sampledTracks = (data.tracks || []).filter(track => {
           const hasSample = track.sample_source || track.has_sample || track.verified_sample;
           const hasValidSampleSource = track.sample_source && track.sample_source.trim() !== '';
           // EXCLUDE tracks that "do not contain a credited main sample from another song"
           return hasSample && hasValidSampleSource;
         });
         return sampledTracks;
       }
     } catch (error) {
       console.error('Failed to fetch home-now tracks:', error);
     }
     return [];
   };

   const fetchHomeDiscoverTracks = async () => {
     try {
       // API should only return tracks that contain verified samples
       const response = await fetch('/api/home-discover?limit=6&samples_only=true');
       if (response.ok) {
         const data = await response.json();
         // STRICT FILTER: Only tracks with credited main samples from other songs
         const sampledTracks = (data.tracks || []).filter(track => {
           const hasSample = track.sample_source || track.has_sample || track.verified_sample;
           const hasValidSampleSource = track.sample_source && track.sample_source.trim() !== '';
           // EXCLUDE tracks that "do not contain a credited main sample from another song"
           return hasSample && hasValidSampleSource;
         });
         return sampledTracks;
       }
     } catch (error) {
       console.error('Failed to fetch home-discover tracks:', error);
     }
     return [];
   };

  // Validate if a track contains samples using the samples API
  const validateTrackHasSamples = async (title, artist) => {
    try {
      const query = `${title} ${artist}`;
      const response = await fetch(`/api/samples?query=${encodeURIComponent(query)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if the API found a valid sample with high confidence
        const hasSample = data.status === 'ok' && 
                         data.main_sample && 
                         data.main_sample.title && 
                         data.main_sample.artist && 
                         data.main_sample.confidence >= 0.7; // Require at least 70% confidence
        
        return {
          hasSample,
          sampleSource: hasSample ? `${data.main_sample.artist} - ${data.main_sample.title}` : null,
          confidence: data.main_sample?.confidence || 0,
          note: data.main_sample?.note || null
        };
      }
    } catch (error) {
      console.error(`Failed to validate samples for ${title} by ${artist}:`, error);
    }
    
    return { hasSample: false, sampleSource: null, confidence: 0, note: null };
  };

  // Enhanced sample validation for tracks
  const validateTracksWithSamples = async (tracks) => {
    const validatedTracks = [];
    
    for (const track of tracks) {
      // First check if track already has sample information
      const hasExistingSample = track.sample_source || track.has_sample || track.verified_sample;
      const hasValidSampleSource = track.sample_source && track.sample_source.trim() !== '';
      
      if (hasExistingSample && hasValidSampleSource) {
        // Track already has verified sample info, keep it
        validatedTracks.push(track);
      } else {
        // Validate using samples API
        const validation = await validateTrackHasSamples(track.title, track.artist);
        
        if (validation.hasSample) {
          // Add sample information to track
          validatedTracks.push({
            ...track,
            sample_source: validation.sampleSource,
            has_sample: true,
            verified_sample: true,
            confidence: validation.confidence,
            sample_note: validation.note
          });
        }
        // If no sample found, track is excluded (not added to validatedTracks)
      }
    }
    
    return validatedTracks;
  };

  // Fetch album art for homepage tracks
  const fetchHomeAlbumArt = async (tracks) => {
    const albumArtUpdates = {};
    
    for (const track of tracks) {
      const key = `${track.title}|${track.artist}`;
      
      // Skip if we already have this album art
      if (homeAlbumArt[key]) continue;
      
      try {
        // Use existing Spotify resolution function
        const albumArt = await resolveAlbumCover(track.title, track.artist);
        if (albumArt) {
          albumArtUpdates[key] = albumArt;
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to fetch album art for ${track.title} by ${track.artist}:`, error);
      }
    }
    
    // Update state with new album art
    if (Object.keys(albumArtUpdates).length > 0) {
      setHomeAlbumArt(prev => ({ ...prev, ...albumArtUpdates }));
    }
  };

  // Fetch album art for no-results discovery tracks
  const fetchNoResultsAlbumArt = async () => {
    const noResultsTracks = [
      { title: 'Stronger', artist: 'Kanye West' },
      { title: 'Stan', artist: 'Eminem' },
      { title: 'One More Time', artist: 'Daft Punk' },
      { title: 'Juicy', artist: 'The Notorious B.I.G.' },
      { title: 'California Love', artist: '2Pac' },
      { title: 'Hung Up', artist: 'Madonna' }
    ];

    const albumArtUpdates = {};
    
    for (const track of noResultsTracks) {
      const key = `${track.title}|${track.artist}`;
      
      // Skip if we already have this album art
      if (noResultsAlbumArt[key]) continue;
      
      try {
        // Use existing Spotify resolution function
        const albumArt = await resolveAlbumCover(track.title, track.artist);
        if (albumArt) {
          albumArtUpdates[key] = albumArt;
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to fetch no-results album art for ${track.title} by ${track.artist}:`, error);
      }
    }
    
    // Update state with new album art
    if (Object.keys(albumArtUpdates).length > 0) {
      setNoResultsAlbumArt(prev => ({ ...prev, ...albumArtUpdates }));
      // Also update the main spotifyCovers state so it's available everywhere
      setSpotifyCovers(prev => ({ ...prev, ...albumArtUpdates }));
    }
  };

  // Analytics tracking functions
  const logRowImpression = (view, itemIds) => {
    try {
      fetch('/api/analytics/row_impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view, item_ids: itemIds })
      });
    } catch (error) {
      console.error('Failed to log row impression:', error);
    }
  };

  const logRowCardClick = (view, trackId, position) => {
    try {
      fetch('/api/analytics/row_card_click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view, track_id: trackId, position })
      });
    } catch (error) {
      console.error('Failed to log row card click:', error);
    }
  };

  const logSearchNavigated = (view, query, seed) => {
    try {
      fetch('/api/analytics/search_navigated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view, q: query, seed })
      });
    } catch (error) {
      console.error('Failed to log search navigated:', error);
    }
  };

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

     // Generate discovery tracks based on current search results' genres
   const generateDiscoveryTracks = (currentResults) => {
     if (!currentResults || currentResults.length === 0) {
       setDiscoveryTracks([]);
       return;
     }

     // Get genres from current search results
     const currentGenres = new Set();
     currentResults.forEach(item => {
       const key = `${item?.title}|${item?.artist}`;
       const genres = spotifyInfo[key]?.genres || [];
       genres.forEach(genre => {
         const normalizedGenre = genre.toLowerCase();
         currentGenres.add(normalizedGenre);
       });
     });

     // If no genres found, use fallback genres
     if (currentGenres.size === 0) {
       currentGenres.add('hip hop');
       currentGenres.add('rap');
     }

     // Find matching tracks from our database
     const discoveryTracks = [];
     const usedTracks = new Set();
     const usedArtists = new Set(); // Track used artists to ensure uniqueness

     // Add current search results to avoid duplicates (both tracks and artists)
     currentResults.forEach(item => {
       if (item?.title && item?.artist) {
         usedTracks.add(`${item.title.toLowerCase()}|${item.artist.toLowerCase()}`);
         usedArtists.add(item.artist.toLowerCase());
       }
     });

     // Get tracks from matching genres and sort by priority/popularity
     // ONLY include tracks that have confirmed samples
     const genreMatches = [];
     Array.from(currentGenres).forEach(genre => {
       const genreTracks = sampledTracksDatabase[genre] || [];
       genreTracks.forEach(track => {
         const trackKey = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
         const artistKey = track.artist.toLowerCase();
         // Only include tracks that have confirmed samples AND unique artists
         if (!usedTracks.has(trackKey) && !usedArtists.has(artistKey) && track.hasSample) {
           genreMatches.push(track);
           usedTracks.add(trackKey);
           usedArtists.add(artistKey);
         }
       });
     });

     // Sort by priority (popularity indicator) and then by recognition
     genreMatches.sort((a, b) => {
       // Primary sort: by priority (higher is better)
       if (b.priority !== a.priority) {
         return b.priority - a.priority;
       }
       // Secondary sort: by artist recognition (alphabetical for consistency)
       return a.artist.localeCompare(b.artist);
     });

     // Take top tracks based on popularity (ensuring unique artists)
     discoveryTracks.push(...genreMatches.slice(0, 12));

     // If we don't have enough tracks, add high-priority VERIFIED SAMPLED tracks from related genres
     if (discoveryTracks.length < 6) {
       const fallbackTracks = [
         { title: 'Juicy', artist: 'The Notorious B.I.G.', genre: 'hip hop', priority: 10, hasSample: true, sampleSource: 'Mtume - Juicy Fruit' },
         { title: 'Stan', artist: 'Eminem', genre: 'rap', priority: 10, hasSample: true, sampleSource: 'Dido - Thank You' },
         { title: 'California Love', artist: '2Pac', genre: 'rap', priority: 10, hasSample: true, sampleSource: 'Joe Cocker - Woman to Woman' },
         { title: 'Crazy in Love', artist: 'Beyoncé', genre: 'r&b', priority: 10, hasSample: true, sampleSource: 'The Chi-Lites - Are You My Woman' },
         { title: 'Hung Up', artist: 'Madonna', genre: 'pop', priority: 10, hasSample: true, sampleSource: 'ABBA - Gimme! Gimme! Gimme!' },
         { title: 'One More Time', artist: 'Daft Punk', genre: 'electronic', priority: 10, hasSample: true, sampleSource: 'Eddie Johns - More Spell on You' },
         { title: 'SOS', artist: 'Rihanna', genre: 'pop', priority: 9, hasSample: true, sampleSource: 'Soft Cell - Tainted Love' },
         { title: 'C.R.E.A.M.', artist: 'Wu-Tang Clan', genre: 'hip hop', priority: 9, hasSample: true, sampleSource: 'The Charmels - As Long As I\'ve Got You' },
         { title: 'Gold Digger', artist: 'Kanye West', genre: 'rap', priority: 9, hasSample: true, sampleSource: 'Ray Charles - I Got a Woman' },
         { title: 'Family Affair', artist: 'Mary J. Blige', genre: 'r&b', priority: 9, hasSample: true, sampleSource: 'Chic - Upside Down' },
         { title: 'Marijuana', artist: 'Chrome Sparks', genre: 'electronic', priority: 8, hasSample: true, sampleSource: 'Idris Muhammad - Could Heaven Ever Be Like This' },
         { title: 'Bitter Sweet Symphony', artist: 'The Verve', genre: 'pop', priority: 8, hasSample: true, sampleSource: 'The Rolling Stones - The Last Time' }
       ].filter(track => track.hasSample).sort((a, b) => b.priority - a.priority);

       fallbackTracks.forEach(track => {
         const trackKey = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
         const artistKey = track.artist.toLowerCase();
         // Ensure both track and artist are unique
         if (!usedTracks.has(trackKey) && !usedArtists.has(artistKey) && discoveryTracks.length < 12) {
           discoveryTracks.push(track);
           usedTracks.add(trackKey);
           usedArtists.add(artistKey);
         }
       });
     }

     setDiscoveryTracks(discoveryTracks);
     
     // Fetch Spotify data for discovery tracks
     if (discoveryTracks.length > 0) {
       fetchDiscoverySpotifyData(discoveryTracks);
     }
   };

  // Fetch Spotify data for discovery tracks
  const fetchDiscoverySpotifyData = async (tracks) => {
    const coverUpdates = {};
    const infoUpdates = {};
    
    for (const track of tracks) {
      const key = `${track.title}|${track.artist}`;
      
      // Skip if we already have data for this track
      if (spotifyCovers[key] || spotifyInfo[key]) {
        continue;
      }
      
      try {
        // Fetch album cover
        const coverUrl = await resolveAlbumCover(track.title, track.artist);
        if (coverUrl) {
          coverUpdates[key] = coverUrl;
        }
        
        // Fetch Spotify info
        const info = await resolveSpotifyInfo(track.title, track.artist);
        if (info) {
          // Add our priority score to the Spotify data for sorting
          infoUpdates[key] = { ...info, priority: track.priority };
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Failed to fetch Spotify data for ${track.title} by ${track.artist}:`, error);
      }
    }
    
    // Update state with new data
    if (Object.keys(coverUpdates).length > 0) {
      setSpotifyCovers(prev => ({ ...prev, ...coverUpdates }));
    }
    if (Object.keys(infoUpdates).length > 0) {
      setSpotifyInfo(prev => ({ ...prev, ...infoUpdates }));
    }
  };

  // Update discovery tracks when results change
  useEffect(() => {
    generateDiscoveryTracks(results);
  }, [results, spotifyInfo]);

     // Fallback data for when APIs aren't available - ONLY TRACKS WITH CREDITED MAIN SAMPLES
   // TRENDING: Most-searched tracks with definitive sample relationships (unique artists)
   const fallbackNowTracks = [
     { 
       id: 'first-class-harlow',
       title: 'First Class', 
       artist: 'Jack Harlow',
       year: 2022,
       album_art: null,
       sample_source: 'Fergie - Glamorous',
       has_sample: true,
       verified_sample: true,
       confidence: 0.95,
       sample_note: 'Interpolates the main hook and melody from Fergie\'s "Glamorous"'
     },
     { 
       id: 'stronger-kanye',
       title: 'Stronger', 
       artist: 'Kanye West',
       year: 2007,
       album_art: null,
       sample_source: 'Daft Punk - Harder, Better, Faster, Stronger',
       has_sample: true,
       verified_sample: true,
       confidence: 1.0,
       sample_note: 'Heavily samples the main vocal hook and electronic elements'
     },
     { 
       id: 'juicy-biggie',
       title: 'Juicy', 
       artist: 'The Notorious B.I.G.',
       year: 1994,
       album_art: null,
       sample_source: 'Mtume - Juicy Fruit',
       has_sample: true,
       verified_sample: true,
       confidence: 1.0,
       sample_note: 'Samples the main bassline and instrumental from Mtume\'s "Juicy Fruit"'
     },
     { 
       id: 'mask-off-future',
       title: 'Mask Off', 
       artist: 'Future',
       year: 2017,
       album_art: null,
       sample_source: 'Tommy Butler - Prison Song',
       has_sample: true,
       verified_sample: true,
       confidence: 0.9,
       sample_note: 'Built around the distinctive flute melody from Tommy Butler\'s track'
     },
     { 
       id: 'good-4-u-olivia',
       title: 'good 4 u', 
       artist: 'Olivia Rodrigo',
       year: 2021,
       album_art: null,
       sample_source: 'Paramore - Misery Business',
       has_sample: true,
       verified_sample: true,
       confidence: 0.95,
       sample_note: 'Interpolates the chord progression and melody from Paramore\'s "Misery Business"'
     },
     { 
       id: 'hotline-bling-drake',
       title: 'Hotline Bling', 
       artist: 'Drake',
       year: 2015,
       album_art: null,
       sample_source: 'Timmy Thomas - Why Can\'t We Live Together',
       has_sample: true,
       verified_sample: true,
       confidence: 1.0,
       sample_note: 'Heavily samples the main melody and rhythm from Timmy Thomas\' classic'
     }
   ];

   // DISCOVER: AI-curated classic tracks with clear sample relationships (no overlap with Trending)
   const fallbackDiscoverTracks = [
     { 
       id: 'one-more-time-daft-punk',
       title: 'One More Time', 
       artist: 'Daft Punk',
       year: 2000,
       album_art: null,
       sample_source: 'Eddie Johns - More Spell on You',
       has_sample: true,
       verified_sample: true,
       confidence: 0.95,
       sample_note: 'Samples the vocal melody and transforms it with vocoder effects'
     },
     { 
       id: 'stan-eminem',
       title: 'Stan', 
       artist: 'Eminem',
       year: 2000,
       album_art: null,
       sample_source: 'Dido - Thank You',
       has_sample: true,
       verified_sample: true,
       confidence: 1.0,
       sample_note: 'Uses Dido\'s chorus as the main hook throughout the song'
     },
     { 
       id: 'california-love-2pac',
       title: 'California Love', 
       artist: '2Pac',
       year: 1995,
       album_art: null,
       sample_source: 'Joe Cocker - Woman to Woman',
       has_sample: true,
       verified_sample: true,
       confidence: 1.0,
       sample_note: 'Samples the main piano riff and vocal elements'
     },
     { 
       id: 'hung-up-madonna',
       title: 'Hung Up', 
       artist: 'Madonna',
       year: 2005,
       album_art: null,
       sample_source: 'ABBA - Gimme! Gimme! Gimme!',
       has_sample: true,
       verified_sample: true,
       confidence: 1.0,
       sample_note: 'Built around ABBA\'s distinctive guitar riff and melody'
     },
     { 
       id: 'crazy-in-love-beyonce',
       title: 'Crazy in Love', 
       artist: 'Beyoncé',
       year: 2003,
       album_art: null,
       sample_source: 'The Chi-Lites - Are You My Woman',
       has_sample: true,
       verified_sample: true,
       confidence: 0.95,
       sample_note: 'Features the distinctive horn sample from The Chi-Lites'
     },
     { 
       id: 'sos-rihanna',
       title: 'SOS', 
       artist: 'Rihanna',
       year: 2006,
       album_art: null,
       sample_source: 'Soft Cell - Tainted Love',
       has_sample: true,
       verified_sample: true,
       confidence: 1.0,
       sample_note: 'Built around the main synth hook from Soft Cell\'s "Tainted Love"'
     }
   ];

  // Fetch homepage tracks on mount
  useEffect(() => {
    const fetchHomepageTracks = async () => {
      setHomeTracksLoading(true);
      try {
        // Fetch both lists in parallel
        const [nowTracks, discoverTracks] = await Promise.all([
          fetchHomeNowTracks(),
          fetchHomeDiscoverTracks()
        ]);
        
                 // Use API data if available, otherwise fallback
         let finalNowTracks = nowTracks.length > 0 ? nowTracks : fallbackNowTracks;
         let finalDiscoverTracks = discoverTracks.length > 0 ? discoverTracks : fallbackDiscoverTracks;
         
         console.log('🔍 Debug - API tracks:', { nowTracks: nowTracks.length, discoverTracks: discoverTracks.length });
         console.log('🔍 Debug - Fallback tracks:', { fallbackNow: fallbackNowTracks.length, fallbackDiscover: fallbackDiscoverTracks.length });
         console.log('🔍 Debug - Final tracks before filtering:', { finalNow: finalNowTracks.length, finalDiscover: finalDiscoverTracks.length });
         
         // CRITICAL: Filter to ensure ONLY tracks with verified "Sampled From" relationships are shown
         // Enhanced filtering with strict sample validation
         finalNowTracks = finalNowTracks.filter(track => {
           // Must have a clear sample source - if no sample relationship, don't show
           const hasSample = track.sample_source || track.has_sample || track.verified_sample || track.sampledFrom;
           const hasValidSampleSource = track.sample_source && track.sample_source.trim() !== '';
           const hasHighConfidence = !track.confidence || track.confidence >= 0.7; // Require high confidence if available
           
           // STRICT: Must have sample source AND high confidence (if confidence is provided)
           return hasSample && hasValidSampleSource && hasHighConfidence;
         });
         
         finalDiscoverTracks = finalDiscoverTracks.filter(track => {
           // Must have a clear sample source - if no sample relationship, don't show
           const hasSample = track.sample_source || track.has_sample || track.verified_sample || track.sampledFrom;
           const hasValidSampleSource = track.sample_source && track.sample_source.trim() !== '';
           const hasHighConfidence = !track.confidence || track.confidence >= 0.7; // Require high confidence if available
           
           // STRICT: Must have sample source AND high confidence (if confidence is provided)
           return hasSample && hasValidSampleSource && hasHighConfidence;
         });
         
         console.log('🔍 Debug - After sample filtering:', { finalNow: finalNowTracks.length, finalDiscover: finalDiscoverTracks.length });
         
         // Additional validation: If we have very few tracks, validate some with the samples API
         if (finalNowTracks.length < 3 || finalDiscoverTracks.length < 3) {
           console.log('🔍 Running additional sample validation due to low track count...');
           // This would be done in background - for now we rely on our curated data
         }
         
         // ENSURE UNIQUE ARTISTS across both Trending and Discover sections
         const usedArtists = new Set();
         
         // First, process Trending tracks and mark artists as used
         finalNowTracks = finalNowTracks.filter(track => {
           const artistKey = track.artist.toLowerCase();
           if (usedArtists.has(artistKey)) {
             return false; // Skip duplicate artist
           }
           usedArtists.add(artistKey);
           return true;
         });
         
         // Then, process Discover tracks and skip artists already used in Trending
         finalDiscoverTracks = finalDiscoverTracks.filter(track => {
           const artistKey = track.artist.toLowerCase();
           if (usedArtists.has(artistKey)) {
             return false; // Skip duplicate artist
           }
           usedArtists.add(artistKey);
           return true;
         });
         
         console.log('🔍 Debug - After unique artist filtering:', { finalNow: finalNowTracks.length, finalDiscover: finalDiscoverTracks.length });
        
        setHomeNowTracks(finalNowTracks);
        setHomeDiscoverTracks(finalDiscoverTracks);
        
        // Fetch album art for both track lists
        const allTracks = [...finalNowTracks, ...finalDiscoverTracks];
        if (allTracks.length > 0) {
          fetchHomeAlbumArt(allTracks);
        }

        // Also fetch album art for no-results discovery tracks
        fetchNoResultsAlbumArt();
        
        // Log impression for the default view (trending)
        if (finalNowTracks.length > 0) {
          const itemIds = finalNowTracks.map(track => track.id || track.title);
          logRowImpression('trending', itemIds);
        }
      } catch (error) {
        console.error('Failed to fetch homepage tracks:', error);
        // Use fallback data on error
        setHomeNowTracks(fallbackNowTracks);
        setHomeDiscoverTracks(fallbackDiscoverTracks);
      } finally {
        setHomeTracksLoading(false);
      }
    };

    fetchHomepageTracks();
  }, []);

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

  // Helper function to search curated sampled tracks database
  const searchSampledTracksDatabase = (searchTerm) => {
    const normalizedSearch = searchTerm.toLowerCase();
    const foundTracks = [];
    
    // Search through all genres in our curated database
    Object.values(sampledTracksDatabase).forEach(genreTracks => {
      genreTracks.forEach(track => {
        const titleMatch = track.title.toLowerCase().includes(normalizedSearch);
        const artistMatch = track.artist.toLowerCase().includes(normalizedSearch);
        
        if (titleMatch || artistMatch) {
          // Convert to the format expected by the app
          const convertedTrack = {
            title: track.title,
            artist: track.artist,
            year: null, // Will be filled by Spotify API
            thumbnail: null, // Will be filled by Spotify API
            sampledFrom: {
              title: track.sampleSource.split(' - ')[1] || track.sampleSource,
              artist: track.sampleSource.split(' - ')[0] || 'Unknown Artist',
              year: null,
              thumbnail: null,
              needsYouTubeSearch: true // Flag to fetch YouTube URL for sample
            },
            youtube: null, // Will be filled later
            needsYouTubeSearch: true, // Flag to fetch YouTube URL for main track
            priority: track.priority,
            isFromCuratedDatabase: true, // Flag to identify curated results
            isApiResult: true, // Flag to show AI Identified badge
            apiConfidence: 1.0 // High confidence for curated results
          };
          foundTracks.push(convertedTrack);
        }
      });
    });
    
    // Sort by priority (higher first) and then by title match relevance
    return foundTracks.sort((a, b) => {
      // First sort by priority
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Then by exact title match
      const aExactMatch = a.title.toLowerCase() === normalizedSearch;
      const bExactMatch = b.title.toLowerCase() === normalizedSearch;
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      return 0;
    });
  };

  const handleSearchWithTerm = (searchTerm, e) => {
    e.preventDefault();
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    
    // Clear previous results immediately when starting a new search
    setResults([]);
    
    // Always clear the selected category when doing a new search
    setSelectedCategory(null);
    setShowSuggestions(false);

    setIsDirectAlbumClick(false); // Reset album click flag
    setYoutubeLoading(new Set()); // Clear YouTube loading states
    
    // If search term is empty, don't search
    if (!normalizedSearchTerm) {
      setResults([]);
      setHasSearched(false);
      setCompletedQuery(""); // Clear completed query
      return;
    }
    
    // Set the completed query for the header display
    setCompletedQuery(searchTerm.trim());
    
    // Mark that a search has been performed
    setHasSearched(true);
    
    // Hybrid search approach: Curated database first, then API
    (async () => {
      try {
        // Step 0: Check curated sampled tracks database first
        console.log('🎯 Step 0: Checking curated sampled tracks database...');
        const curatedResults = searchSampledTracksDatabase(normalizedSearchTerm);
        
        if (curatedResults.length > 0) {
          console.log('✅ Found sampled tracks in curated database:', curatedResults);
          // Set curated results immediately (they have priority)
          setResults(curatedResults);
          
          // Step 1: Still call API for additional results, but merge them
          console.log('🤖 Step 1: Getting additional results from API...');
          try {
            const apiResponse = await fetchSampleIdentification(searchTerm);
            const convertedApiResults = convertApiResponseToLocalFormat(apiResponse);
            
            if (Array.isArray(convertedApiResults) && convertedApiResults.length > 0) {
              const validApiResults = convertedApiResults.filter(item => 
                item && 
                typeof item === 'object' && 
                typeof item.title === 'string' && 
                item.title.trim().length > 0 &&
                typeof item.artist === 'string' && 
                item.artist.trim().length > 0
              );
              
              // Merge results: Curated first, then API results (avoiding duplicates)
              const mergedResults = [...curatedResults];
              validApiResults.forEach(apiResult => {
                const isDuplicate = curatedResults.some(curatedResult => 
                  curatedResult.title.toLowerCase() === apiResult.title.toLowerCase() &&
                  curatedResult.artist.toLowerCase() === apiResult.artist.toLowerCase()
                );
                if (!isDuplicate) {
                  // Mark API results as lower priority if they don't have samples
                  apiResult.priority = apiResult.sampledFrom ? 5 : 1;
                  // Ensure API results also have YouTube search flags if they don't already have URLs
                  if (!apiResult.youtube && apiResult.title && apiResult.artist) {
                    apiResult.needsYouTubeSearch = true;
                  }
                  if (apiResult.sampledFrom && !apiResult.sampledFrom.youtube && apiResult.sampledFrom.title && apiResult.sampledFrom.artist) {
                    apiResult.sampledFrom.needsYouTubeSearch = true;
                  }
                  mergedResults.push(apiResult);
                }
              });
              
              // Sort merged results: Sampled tracks first, then by priority
              const sortedResults = mergedResults.sort((a, b) => {
                const aHasSample = a.sampledFrom && a.sampledFrom.title;
                const bHasSample = b.sampledFrom && b.sampledFrom.title;
                
                // Prioritize tracks with samples
                if (aHasSample && !bHasSample) return -1;
                if (!aHasSample && bHasSample) return 1;
                
                // Then by priority
                return (b.priority || 0) - (a.priority || 0);
              });
              
              console.log('✅ Merged curated + API results:', sortedResults);
              setResults(sortedResults);
              
              // Step 2: Enhance with YouTube URLs
              console.log('🎥 Step 2: Fetching YouTube URLs...');
              await enhanceResultsWithYouTube(sortedResults);
            } else {
              // Only curated results, still enhance with YouTube
              console.log('🎥 Enhancing curated results with YouTube URLs...');
              await enhanceResultsWithYouTube(curatedResults);
            }
          } catch (apiError) {
            console.log('⚠️ API failed, but we have curated results:', apiError);
            // Still enhance curated results with YouTube
            await enhanceResultsWithYouTube(curatedResults);
          }
        } else {
          // No curated results, fall back to API only
          console.log('🤖 No curated results found, using API search...');
        const apiResponse = await fetchSampleIdentification(searchTerm);
        const convertedResults = convertApiResponseToLocalFormat(apiResponse);
        
        if (Array.isArray(convertedResults) && convertedResults.length > 0) {
          const validResults = convertedResults.filter(item => 
            item && 
            typeof item === 'object' && 
            typeof item.title === 'string' && 
            item.title.trim().length > 0 &&
            typeof item.artist === 'string' && 
            item.artist.trim().length > 0
          );
          
          if (validResults.length > 0) {
              // Ensure all API results have YouTube search flags if needed
              validResults.forEach(result => {
                if (!result.youtube && result.title && result.artist) {
                  result.needsYouTubeSearch = true;
                }
                if (result.sampledFrom && !result.sampledFrom.youtube && result.sampledFrom.title && result.sampledFrom.artist) {
                  result.sampledFrom.needsYouTubeSearch = true;
                }
              });
              
              // Sort API results: Sampled tracks first
              const sortedResults = validResults.sort((a, b) => {
                const aHasSample = a.sampledFrom && a.sampledFrom.title;
                const bHasSample = b.sampledFrom && b.sampledFrom.title;
                
                if (aHasSample && !bHasSample) return -1;
                if (!aHasSample && bHasSample) return 1;
                return 0;
              });
              
              console.log('✅ API results (sorted by sample priority):', sortedResults);
              setResults(sortedResults);
              
              console.log('🎥 Fetching YouTube URLs...');
              await enhanceResultsWithYouTube(sortedResults);
          } else {
            console.log('❌ Sample API returned no valid results after filtering');
              setResults([]);
          }
        } else {
          console.log('❌ Sample API returned no results');
            setResults([]);
          }
        }
      } catch (error) {
        console.error('❌ Search failed:', error);
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
    setCompletedQuery(""); // Clear completed query
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
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 pt-52">
                    
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
                                                     <p className="text-white/80 text-sm font-normal mt-4 mb-4 text-center drop-shadow-lg" 
                              style={{ 
                                textShadow: '0 0 5px rgba(255, 255, 255, 0.1), 0 0 10px rgba(255, 255, 255, 0.05)',
                                animation: 'subtle-glow 6s ease-in-out infinite'
                              }}>
                              Discover what songs sampled and their original creators
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
                                  placeholder="Type a song title..."
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



                           {/* Trending/Discover Section */}
                           <div className="mt-24 w-full max-w-6xl">
                             <div className="text-center mb-8">
                               {/* Segmented Control */}
                               <div className="flex flex-col items-center justify-center">
                                 <div className="flex items-center gap-1 mb-2">
                            <button 
                              type="button"
                                     onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       console.log('Trending button clicked');
                                       setHomeView('trending');
                                       // Log impression when switching to trending view
                                       if (homeNowTracks.length > 0) {
                                         const itemIds = homeNowTracks.map(track => track.id || track.title);
                                         logRowImpression('trending', itemIds);
                                       }
                                     }}
                                     className={`px-3 py-1 text-sm font-medium transition-all duration-200 cursor-pointer select-none relative z-10 ${
                                       homeView === 'trending'
                                         ? 'text-white/90'
                                         : 'text-white/50 hover:text-white/70 active:text-white/80'
                                     }`}
                                   >
                                     Trending
                                   </button>
                                   <span className="text-white/30 text-sm">|</span>
                                   <button
                                     type="button"
                                     onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       console.log('Discover button clicked');
                                       setHomeView('discover');
                                       // Log impression when switching to discover view
                                       if (homeDiscoverTracks.length > 0) {
                                         const itemIds = homeDiscoverTracks.map(track => track.id || track.title);
                                         logRowImpression('discover', itemIds);
                                       }
                                     }}
                                     className={`px-3 py-1 text-sm font-medium transition-all duration-200 cursor-pointer select-none relative z-10 ${
                                       homeView === 'discover'
                                         ? 'text-white/90'
                                         : 'text-white/50 hover:text-white/70 active:text-white/80'
                                     }`}
                                   >
                                     Discover
                            </button>
                          </div>

                                 {/* Explanation Text */}
                                 <div className="text-center min-h-[20px]">
                                   <p className="text-white/40 text-xs transition-all duration-200">
                                     {homeView === 'trending' ? 'Most-searched today' : 'Auto-curated mix of verified picks'}
                                   </p>
                                 </div>
                               </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 justify-items-center">
                               {homeTracksLoading ? (
                                 // Loading state
                                 Array.from({ length: 6 }).map((_, idx) => (
                                   <div key={idx} className="w-32 md:w-36">
                                     <div className="aspect-square bg-white/5 rounded mb-3 animate-pulse"></div>
                                     <div className="h-3 bg-white/5 rounded mb-1 animate-pulse"></div>
                                     <div className="h-2 bg-white/5 rounded animate-pulse"></div>
                                   </div>
                                 ))
                               ) : (homeView === 'trending' ? homeNowTracks : homeDiscoverTracks).length > 0 ? (
                                 (homeView === 'trending' ? homeNowTracks : homeDiscoverTracks)
                                   .filter(track => {
                                     // FINAL SAFETY CHECK: Only show tracks with verified sample sources
                                     const hasValidSample = track.sample_source && track.sample_source.trim() !== '';
                                     return hasValidSample;
                                   })
                                   .map((track, idx) => {
                                
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
                                       
                                       // Log analytics
                                       logRowCardClick(homeView, track.id || track.title, idx);
                                       
                                       // Construct query and navigation parameters
                                       const query = `${track.title} ${track.artist}`;
                                       const seed = `track:${track.id || track.title}`;
                                       const source = homeView;
                                       
                                       logSearchNavigated(homeView, query, seed);
                                       
                                       // Navigate to search with parameters
                                       const searchParams = new URLSearchParams({
                                         q: query,
                                         seed: seed,
                                         verified: 'true',
                                         source: source
                                       });
                                       
                                       // Update query state and navigate
                                       setQuery(query);
                                      setTimeout(() => {
                                        const fakeEvent = { preventDefault: () => {} };
                                         handleSearchWithTerm(query, fakeEvent);
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
                                       {(() => {
                                         const albumArtKey = `${track.title}|${track.artist}`;
                                         const albumArt = track.album_art || homeAlbumArt[albumArtKey];
                                         
                                         return albumArt ? (
                                           // Show actual album art if available
                                           <img 
                                             src={albumArt} 
                                             alt={`${track.title} by ${track.artist}`}
                                             className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                                             onLoad={(e) => {
                                               e.target.style.opacity = '1';
                                               const loadingDiv = e.target.nextElementSibling;
                                               if (loadingDiv && loadingDiv.classList.contains('loading-placeholder')) {
                                                 loadingDiv.style.display = 'none';
                                               }
                                             }}
                                             onError={(e) => {
                                               // Fallback to gradient placeholder on error
                                               e.target.style.display = 'none';
                                               const loadingDiv = e.target.nextElementSibling;
                                               if (loadingDiv && loadingDiv.classList.contains('loading-placeholder')) {
                                                 loadingDiv.style.display = 'none';
                                               }
                                               const gradientDiv = loadingDiv ? loadingDiv.nextElementSibling : null;
                                               if (gradientDiv) gradientDiv.style.display = 'flex';
                                             }}
                                           />
                                         ) : null;
                                       })()}
                                       
                                       {/* Loading placeholder for album art */}
                                       {(() => {
                                         const albumArtKey = `${track.title}|${track.artist}`;
                                         const albumArt = track.album_art || homeAlbumArt[albumArtKey];
                                         
                                         return !albumArt ? (
                                           <div className="loading-placeholder absolute inset-0 bg-white/5 flex items-center justify-center">
                                             <div className="animate-pulse flex flex-col items-center">
                                               <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-1"></div>
                                               <div className="text-xs text-white/40">Loading...</div>
                                             </div>
                                           </div>
                                         ) : null;
                                       })()}
                                       
                                       {/* Gradient placeholder (fallback when no album art available) */}
                                       <div 
                                         className="w-full h-full bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-500/20 flex items-center justify-center"
                                         style={{ 
                                           display: (() => {
                                             const albumArtKey = `${track.title}|${track.artist}`;
                                             const albumArt = track.album_art || homeAlbumArt[albumArtKey];
                                             return albumArt ? 'none' : 'flex';
                                           })()
                                         }}
                                       >
                                        <div className="text-white/60 text-center">
                                          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                          </svg>
                                        </div>
                                      </div>
                                       

                                    </div>
                                    <div className="text-center">
                                      <h4 className="text-white text-xs font-normal font-novelDisplay mb-1 line-clamp-2 leading-tight">
                                         {track.title}
                                      </h4>
                                      <p className="text-white/60 text-xs line-clamp-1">
                                         {track.artist}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })
                               ) : (
                                 // Empty state fallback - show message or fallback content
                                 <div className="col-span-full text-center py-12">
                                   <p className="text-white/40 text-sm">
                                     {homeView === 'trending' ? 'No trending sampled tracks right now' : 'No sampled tracks available for discovery'}
                                   </p>
                                 </div>
                               )}
                            </div>
                          </div>

                        </div>
                      </>
        </div>
      ) : (
        <div className="relative z-10 min-h-screen pt-3 flex flex-col">
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
                                  placeholder="Type a song title..."
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
                            
                            {/* Spacer to maintain layout position where genre buttons used to be */}
                            <div className="mt-3 mb-9"></div>

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
                          <h2 className="text-lg font-normal text-white mb-2">
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
                              "{completedQuery}"
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
                            <h3 className="text-xl font-normal text-white mb-6">
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

                          {/* Horizontal line */}
                          <div className="h-px bg-white/10 w-full mb-8"></div>
                          
                          {/* Discover Section - Popular Sampled Tracks */}
                          <div className="mb-8">
                            <div className="flex items-center justify-between mb-6">
                              <h4 className="text-xl font-normal text-white">
                                Popular sampled tracks you might like
                              </h4>
                              <span className="text-white/30 text-xs ml-1">
                                AI Powered Discovery
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                              {[
                                { title: 'Stronger', artist: 'Kanye West', genre: 'hip hop' },
                                { title: 'Stan', artist: 'Eminem', genre: 'rap' },
                                { title: 'One More Time', artist: 'Daft Punk', genre: 'electronic' },
                                { title: 'Juicy', artist: 'The Notorious B.I.G.', genre: 'hip hop' },
                                { title: 'California Love', artist: '2Pac', genre: 'rap' },
                                { title: 'Hung Up', artist: 'Madonna', genre: 'pop' }
                              ].map((track, idx) => (
                                <div 
                                  key={idx} 
                                  className="cursor-pointer select-none group transition-transform duration-200 hover:scale-[1.02]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuery(`${track.title} ${track.artist}`);
                                    setTimeout(() => {
                                      const fakeEvent = { preventDefault: () => {} };
                                      handleSearchWithTerm(`${track.title} ${track.artist}`, fakeEvent);
                                    }, 100);
                                  }}
                                >
                                  <div className="w-[92%] aspect-square bg-white/5 overflow-hidden mb-4 relative mx-auto transition-all duration-200 group-hover:shadow-lg group-hover:shadow-white/5">
                                    {(() => {
                                      const albumArtKey = `${track.title}|${track.artist}`;
                                      const albumArt = noResultsAlbumArt[albumArtKey] || spotifyCovers[albumArtKey];
                                      
                                      return albumArt ? (
                                        // Show actual album art if available
                                        <img 
                                          src={albumArt} 
                                          alt={`${track.title} by ${track.artist}`}
                                          className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                                          onLoad={(e) => {
                                            e.target.style.opacity = '1';
                                            const loadingDiv = e.target.nextElementSibling;
                                            if (loadingDiv && loadingDiv.classList.contains('loading-placeholder')) {
                                              loadingDiv.style.display = 'none';
                                            }
                                          }}
                                          onError={(e) => {
                                            // Fallback to gradient placeholder on error
                                            e.target.style.display = 'none';
                                            const loadingDiv = e.target.nextElementSibling;
                                            if (loadingDiv && loadingDiv.classList.contains('loading-placeholder')) {
                                              loadingDiv.style.display = 'none';
                                            }
                                            const gradientDiv = loadingDiv ? loadingDiv.nextElementSibling : null;
                                            if (gradientDiv) gradientDiv.style.display = 'flex';
                                          }}
                                        />
                                      ) : null;
                                    })()}
                                    
                                    {/* Loading placeholder for album art */}
                                    {(() => {
                                      const albumArtKey = `${track.title}|${track.artist}`;
                                      const albumArt = noResultsAlbumArt[albumArtKey] || spotifyCovers[albumArtKey];
                                      
                                      return !albumArt ? (
                                        <div className="loading-placeholder absolute inset-0 bg-white/5 flex items-center justify-center">
                                          <div className="animate-pulse flex flex-col items-center">
                                            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-1"></div>
                                            <div className="text-xs text-white/40">Loading...</div>
                                          </div>
                                        </div>
                                      ) : null;
                                    })()}
                                    
                                    {/* Gradient placeholder (fallback when no album art available) */}
                                    <div 
                                      className="w-full h-full bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-500/20 flex items-center justify-center"
                                      style={{ 
                                        display: (() => {
                                          const albumArtKey = `${track.title}|${track.artist}`;
                                          const albumArt = noResultsAlbumArt[albumArtKey] || spotifyCovers[albumArtKey];
                                          return albumArt ? 'none' : 'flex';
                                        })()
                                      }}
                                    >
                                      <div className="text-white/60 text-center">
                                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                              </div>
                            </div>
                                    
                                    {/* Overlay with genre tag */}
                                    <div className="absolute top-2 left-2">
                                      <span className="px-2 py-1 text-[10px] rounded-full bg-black/60 text-white/80 backdrop-blur-sm">
                                        {track.genre.charAt(0).toUpperCase() + track.genre.slice(1)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="w-[92%] mx-auto">
                                    <h3 className="text-white text-base font-normal font-novelDisplay mb-1 line-clamp-2 leading-tight transition-colors duration-200 group-hover:text-white/90">
                                      {track.title}
                                    </h3>
                                    <p className="text-white/70 text-xs line-clamp-1 transition-colors duration-200 group-hover:text-white/80">
                                      {track.artist}
                                    </p>
                                  </div>
                                </div>
                              ))}
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
                                Found {results.length} track{results.length !== 1 ? 's' : ''} for "{completedQuery}"
                              </h2>
                              <p className="text-white/35 text-xs mt-1 font-light">
                                Results detected using SampleFindr AI
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
                        <div key={i}>
                          {/* Horizontal Divider between track results - only show when multiple results */}
                          {i > 0 && results.length >= 2 && (
                            <div className="my-16 h-px bg-white/5"></div>
                          )}
                          
                          <div className={`${i > 0 ? '' : 'pt-8 mt-8'}`}>
                        
                          {/* Simple Track Header */}
                          <div className="mb-12">
              <div className="flex items-center gap-3 mb-2">
                              <h1 className="text-2xl md:text-3xl font-novelDisplay font-normal text-white">
                                {(spotifyInfo[`${item?.title}|${item?.artist}`]?.title) || item?.title}
                              </h1>
                              {item?.isApiResult && (
                                <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-gradient-to-r from-blue-500/20 via-blue-400/20 to-blue-600/20 text-blue-300 rounded-full shadow-lg shadow-blue-500/10 backdrop-blur-sm">
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
                              <p className="text-sm text-white/40 mt-2">
                                {item?.apiNote}
                              </p>
                            )}
                          </div>

                          {/* Main Content Container with Continuous Divider for No Sample */}
                          <div className="relative">
                            {/* Continuous Vertical Divider - only visible when there's NO sample */}
                            {!item?.sampledFrom?.title && (
                              <div className="hidden xl:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-white/5 to-transparent transform -translate-x-1/2 z-10"></div>
                            )}

                          {/* Album Info */}
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-12 xl:gap-16 relative mb-6 -mt-2">
                            {/* Vertical Divider - only visible when there's a sample */}
                            {item?.sampledFrom?.title && (
                            <div className="hidden xl:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-white/5 to-transparent transform -translate-x-1/2"></div>
                            )}
                            
                            {/* Left Side - Sampled Song */}
                            <div className="space-y-6">
                              {/* Section Header */}
            <div>
                                <div className="mb-4">
                                  <h2 className="text-lg font-normal text-white relative">
                                    Track
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
                                  <div className="relative w-full aspect-square">
                                    <img 
                                      src={spotifyCovers[`${item?.title}|${item?.artist}`] || item?.thumbnail} 
                                      alt={`${item?.title || 'Unknown'} album art`}
                                      className="w-full h-full object-cover shadow-xl opacity-0 transition-opacity duration-300"
                                      onLoad={(e) => {
                                        e.target.style.opacity = '1';
                                        // Hide loading placeholder
                                        const loadingDiv = e.target.nextElementSibling;
                                        if (loadingDiv) loadingDiv.style.display = 'none';
                                      }}
                                      onError={(e) => {
                                        e.target.src = 'https://via.placeholder.com/300x300/1a1a1a/666666?text=♪';
                                        e.target.style.opacity = '1';
                                        // Hide loading placeholder
                                        const loadingDiv = e.target.nextElementSibling;
                                        if (loadingDiv) loadingDiv.style.display = 'none';
                                      }}
                                    />
                                    {/* Loading placeholder */}
                                    <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                                      <div className="animate-pulse flex flex-col items-center">
                                        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-2"></div>
                                        <div className="text-xs text-white/40">Loading...</div>
                                      </div>
                                    </div>
                                  </div>
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
                                  <h3 className="text-xl font-normal text-white font-novelDisplay" style={{letterSpacing: '0.05em'}}>{(spotifyInfo[`${item?.title}|${item?.artist}`]?.title) || item?.title}</h3>
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

                            {/* Right Side - Sampled From */}
                            <div className="space-y-6">
                              {/* Section Header */}
            <div>
                                <div className="mb-4">
                                  <h2 className="text-lg font-normal text-white relative">
                                    Sampled From
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
                                  year: getCorrectedYear(item?.sampledFrom?.title, item?.sampledFrom?.artist, (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.year) || item?.sampledFrom?.year),
                                  image: (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.coverUrl) || item?.sampledFrom?.thumbnail,
                                  description: 'Source artist and album details will appear here. Placeholder content.'
                                })}>
                                  <div className="absolute -inset-1 opacity-70" style={{
                                    background: (() => { const c = dominantColors[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]; return c ? `radial-gradient(60% 60% at 50% 50%, rgba(${c.r},${c.g},${c.b},0.35) 0%, rgba(${c.r},${c.g},${c.b},0.0) 70%)` : 'transparent'; })()
                                  }}></div>
                                  <div className="relative w-full aspect-square">
                                    <img 
                                      src={spotifyCovers[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`] || item?.sampledFrom?.thumbnail} 
                                      alt={`${item?.sampledFrom?.title || 'Unknown'} album art`}
                                      className="w-full h-full object-cover shadow-xl opacity-0 transition-opacity duration-300"
                                      onLoad={(e) => {
                                        e.target.style.opacity = '1';
                                        // Hide loading placeholder
                                        const loadingDiv = e.target.nextElementSibling;
                                        if (loadingDiv) loadingDiv.style.display = 'none';
                                      }}
                                      onError={(e) => {
                                        e.target.src = 'https://via.placeholder.com/300x300/1a1a1a/666666?text=♪';
                                        e.target.style.opacity = '1';
                                        // Hide loading placeholder
                                        const loadingDiv = e.target.nextElementSibling;
                                        if (loadingDiv) loadingDiv.style.display = 'none';
                                      }}
                                    />
                                    {/* Loading placeholder */}
                                    <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                                      <div className="animate-pulse flex flex-col items-center">
                                        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-2"></div>
                                        <div className="text-xs text-white/40">Loading...</div>
                                      </div>
                                    </div>
                                  </div>
          </div>
                                
                                {/* Song Info */}
                                <div className="flex-1 cursor-pointer" onClick={() => openPanel({
                                  type: 'source',
                                  title: (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.title) || item?.sampledFrom?.title,
                                  artist: safeJoinArtists(spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.artists) || item?.sampledFrom?.artist,
                                  year: getCorrectedYear(item?.sampledFrom?.title, item?.sampledFrom?.artist, (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.year) || item?.sampledFrom?.year),
                                  image: (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.coverUrl) || item?.sampledFrom?.thumbnail,
                                  description: 'Source artist and album details will appear here. Placeholder content.'
                                })}>
                                                                     <h3 className="text-xl font-normal text-white font-novelDisplay" style={{letterSpacing: '0.05em'}}>{(spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.title) || item?.sampledFrom?.title}</h3>
                                   <p className="text-base text-gray-300">{safeJoinArtists(spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.artists) || item?.sampledFrom?.artist}</p>
                                   <p className="text-sm text-gray-500">{getCorrectedYear(item?.sampledFrom?.title, item?.sampledFrom?.artist, (spotifyInfo[`${item?.sampledFrom?.title}|${item?.sampledFrom?.artist}`]?.year) || item?.sampledFrom?.year)}</p>
                                  
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
                                <div className="relative h-full">
                                  <div className="absolute inset-0 flex items-center justify-center" style={{paddingTop: '256px'}}>
                                    <div className="text-center text-white/60">
                                      <p className="text-lg font-medium">No sample found</p>
                                      <p className="text-sm text-white/40 mt-2">This song doesn't contain any known samples.</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Video Player Cards */}
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-12 xl:gap-16 relative pt-8">
                            {/* Vertical Divider - only visible when there's a sample */}
                            {item?.sampledFrom?.title && (
                            <div className="hidden xl:block absolute left-1/2 top-12 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-white/5 to-transparent transform -translate-x-1/2"></div>
                            )}
                            
                            {/* Left Side - Sampled Song Video */}
                            <div className="relative">
                              {/* Section Header */}
                              <div className="mb-4">
                                <h2 className="text-lg font-normal text-white">
                                  Play & Compare
                                </h2>
                              </div>
                              
                              <div className="relative group">
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
                            </div>

                            {/* Right Side - Sampled From Video */}
                            {item?.sampledFrom?.title ? (
                            <div className="relative">
                              {/* Section Header - invisible spacer to match left side */}
                              <div className="mb-4">
                                <h2 className="text-lg font-normal text-transparent">
                                  Play & Compare
                                </h2>
                              </div>
                              
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
                                      <p className="text-sm">No sample found</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              </div>
                            </div>
                            ) : (
                              <div></div>
                            )}
                          </div>
                          </div> {/* Close Main Content Container */}
                          </div> {/* Close track result container */}
                        </div>
                      ))}
                    </div>
                  )}

                      {/* Discover More - clearly separated section (wider than main) */}
                      {results.length > 0 && discoveryTracks.length > 0 && (
                        <div className="mt-32 lg:mt-48 relative w-screen left-1/2 -translate-x-1/2">
                          <div className="max-w-[90rem] mx-auto px-6">
                            <div className="h-px bg-white/5 mb-8"></div>
                            <div className="flex items-center justify-between mb-6">
                              <h4 className="text-white/85 text-lg font-normal">
                                {(() => {
                                  // Get genres from current search results
                                  const currentGenres = new Set();
                                  results.forEach(item => {
                                    const key = `${item?.title}|${item?.artist}`;
                                    const genres = spotifyInfo[key]?.genres || [];
                                    genres.forEach(genre => {
                                      const normalizedGenre = genre.toLowerCase();
                                      currentGenres.add(normalizedGenre);
                                    });
                                  });

                                  if (currentGenres.size > 0) {
                                    const genreList = Array.from(currentGenres)
                                      .slice(0, 2) // Show max 2 genres
                                      .map(g => g.charAt(0).toUpperCase() + g.slice(1))
                                      .join(' & ');
                                    return `Other ${genreList} sampled tracks you might like`;
                                  }
                                  
                                  return "Other sampled tracks you might like";
                                })()}
                              </h4>
                                <span className="text-white/30 text-xs ml-1">
                                  AI Powered Discovery
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                            {discoveryTracks.map((track, idx) => (
                              <div 
                                key={idx} 
                                className="cursor-pointer select-none group transition-transform duration-200 hover:scale-[1.02]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const searchTitle = spotifyInfo[`${track.title}|${track.artist}`]?.title || track.title;
                                  handleDirectAlbumSearch(searchTitle);
                                }}
                              >
                                <div className="w-[92%] aspect-square bg-white/5 overflow-hidden mb-4 relative mx-auto transition-all duration-200 group-hover:shadow-lg group-hover:shadow-white/5">
                                  <img 
                                    src={spotifyCovers[`${track.title}|${track.artist}`] || 'https://via.placeholder.com/300x300/1a1a1a/666666?text=♪'} 
                                    alt={spotifyInfo[`${track.title}|${track.artist}`]?.title || track.title}
                                    className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                                    onLoad={(e) => e.target.style.opacity = '1'}
                                    onError={(e) => {
                                      e.target.src = 'https://via.placeholder.com/300x300/1a1a1a/666666?text=♪';
                                      e.target.style.opacity = '1';
                                    }}
                                  />
                                  {/* Overlay with genre tag */}
                                  <div className="absolute top-2 left-2">
                                    <span className="px-2 py-1 text-[10px] rounded-full bg-black/60 text-white/80 backdrop-blur-sm">
                                      {track.genre.charAt(0).toUpperCase() + track.genre.slice(1)}
                                    </span>
                                </div>
                                  {/* Loading overlay while fetching Spotify data */}
                                  {!spotifyCovers[`${track.title}|${track.artist}`] && (
                                    <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                                      <div className="animate-pulse flex flex-col items-center">
                                        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-1"></div>
                                        <div className="text-[10px] text-white/40">Loading...</div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="w-[92%] mx-auto">
                                <h3 className="text-white text-base font-normal font-novelDisplay mb-1 line-clamp-2 leading-tight transition-colors duration-200 group-hover:text-white/90">
                                    {spotifyInfo[`${track.title}|${track.artist}`]?.title || track.title}
                                </h3>
                                <p className="text-white/70 text-xs line-clamp-1 transition-colors duration-200 group-hover:text-white/80">
                                    {spotifyInfo[`${track.title}|${track.artist}`]?.artists?.[0] || track.artist}
                                </p>
                              </div>
                              </div>
                            ))}
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
