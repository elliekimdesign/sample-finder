// Vercel Serverless Function: /api/home-discover
// Returns curated discovery tracks that contain verified samples

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  try {
    const limit = parseInt(req.query.limit) || 6;
    const samplesOnly = req.query.samples_only === 'true';

    // Curated discovery tracks with verified samples
    // These are lesser-known gems or classic tracks with interesting sample relationships
    const discoveryTracks = [
      {
        id: 'one-more-time-daft-punk',
        title: 'One More Time',
        artist: 'Daft Punk',
        year: 2000,
        album: 'Discovery',
        sample_source: 'Eddie Johns - More Spell on You',
        has_sample: true,
        verified_sample: true,
        confidence: 0.95,
        sample_note: 'Samples the vocal melody and transforms it with vocoder effects'
      },
      {
        id: 'around-the-world-daft-punk',
        title: 'Around the World',
        artist: 'Daft Punk',
        year: 1997,
        album: 'Homework',
        sample_source: 'Barry White - I\'m Gonna Love You Just a Little More Baby',
        has_sample: true,
        verified_sample: true,
        confidence: 0.9,
        sample_note: 'Uses elements from Barry White\'s orchestral arrangement'
      },
      {
        id: 'california-love-tupac',
        title: 'California Love',
        artist: '2Pac',
        year: 1995,
        album: 'All Eyez on Me',
        sample_source: 'Joe Cocker - Woman to Woman',
        has_sample: true,
        verified_sample: true,
        confidence: 1.0,
        sample_note: 'Samples the main piano riff and vocal elements'
      },
      {
        id: 'nuthin-but-g-thang-dre',
        title: 'Nuthin\' but a \'G\' Thang',
        artist: 'Dr. Dre',
        year: 1992,
        album: 'The Chronic',
        sample_source: 'Leon Haywood - I Want\'a Do Something Freaky to You',
        has_sample: true,
        verified_sample: true,
        confidence: 1.0,
        sample_note: 'Built around Leon Haywood\'s funk bassline and rhythm'
      },
      {
        id: 'passin-me-by-pharcyde',
        title: 'Passin\' Me By',
        artist: 'The Pharcyde',
        year: 1992,
        album: 'Bizarre Ride II The Pharcyde',
        sample_source: 'Quincy Jones - Summer in the City',
        has_sample: true,
        verified_sample: true,
        confidence: 0.95,
        sample_note: 'Samples the jazz-funk instrumental and vocal snippets'
      },
      {
        id: 'they-reminisce-pete-rock',
        title: 'They Reminisce Over You (T.R.O.Y.)',
        artist: 'Pete Rock & CL Smooth',
        year: 1992,
        album: 'Mecca and the Soul Brother',
        sample_source: 'Tom Scott & The L.A. Express - Today',
        has_sample: true,
        verified_sample: true,
        confidence: 1.0,
        sample_note: 'Classic jazz-hip hop fusion using Tom Scott\'s saxophone melody'
      },
      {
        id: '93-til-infinity-souls',
        title: '93 \'til Infinity',
        artist: 'Souls of Mischief',
        year: 1993,
        album: '93 \'til Infinity',
        sample_source: 'Billy Cobham - Heather',
        has_sample: true,
        verified_sample: true,
        confidence: 0.95,
        sample_note: 'Uses Billy Cobham\'s jazz-fusion drums and melody'
      },
      {
        id: 'mass-appeal-gang-starr',
        title: 'Mass Appeal',
        artist: 'Gang Starr',
        year: 1994,
        album: 'Hard to Earn',
        sample_source: 'Vic Juris - Horizon Drive',
        has_sample: true,
        verified_sample: true,
        confidence: 0.9,
        sample_note: 'Samples the guitar melody and jazz elements'
      },
      {
        id: 'award-tour-tribe',
        title: 'Award Tour',
        artist: 'A Tribe Called Quest',
        year: 1993,
        album: 'Midnight Marauders',
        sample_source: 'Weldon Irvine - We Gettin\' Down',
        has_sample: true,
        verified_sample: true,
        confidence: 0.95,
        sample_note: 'Built around Weldon Irvine\'s funk groove and bass'
      }
    ];

    // Filter to only include tracks with verified samples if requested
    let filteredTracks = discoveryTracks;
    if (samplesOnly) {
      filteredTracks = discoveryTracks.filter(track => {
        const hasSample = track.sample_source || track.has_sample || track.verified_sample;
        const hasValidSampleSource = track.sample_source && track.sample_source.trim() !== '';
        return hasSample && hasValidSampleSource && track.confidence >= 0.8;
      });
    }

    // Limit results
    const limitedTracks = filteredTracks.slice(0, limit);

    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900'); // Cache for 30 minutes
    res.statusCode = 200;
    res.end(JSON.stringify({
      tracks: limitedTracks,
      total: limitedTracks.length,
      samples_only: samplesOnly
    }));

  } catch (error) {
    console.error('API /api/home-discover error:', error);
    
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Failed to fetch discovery tracks',
      tracks: [],
      total: 0
    }));
  }
}
