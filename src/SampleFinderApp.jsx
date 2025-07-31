import { useState } from "react";
import ReactPlayer from "react-player";

export default function SampleFinderApp() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

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
          youtube: "https://www.youtube.com/watch?v=bLJ_s4GzHms",
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
    <div className="bg-gray-900 min-h-screen text-white p-16">
      <h1 className="text-4xl mb-4">Sample Finder</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8 max-w-2xl">
        <input
          type="text"
          placeholder="Type a song title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-3 py-3 rounded-md bg-gray-800 text-white border-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button 
          type="submit" 
          className="px-4 py-3 rounded-md bg-indigo-600 text-white border-none hover:bg-indigo-700 transition-colors"
        >
          Search
        </button>
      </form>

      <div className="max-w-4xl mt-4">
        {results.length === 0 && (
          <div className="text-gray-400">Try searching a known track (e.g., "She Knows")</div>
        )}
        {results.map((item, i) => (
          <div key={i} className="space-y-8 mt-8">
            {/* Current Track */}
            <div className="bg-gray-800 rounded-2xl p-8">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Album Art & Info */}
                <div className="flex-shrink-0">
                  <img 
                    src={item.thumbnail} 
                    alt={`${item.title} album art`}
                    className="w-64 h-64 rounded-xl object-cover shadow-2xl" 
                  />
                  <div className="mt-4 text-center">
                    <h2 className="text-2xl font-bold text-white">{item.title}</h2>
                    <p className="text-lg text-gray-300">{item.artist}</p>
                    <p className="text-sm text-gray-500">{item.year}</p>
                  </div>
                </div>
                
                {/* Video Player */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-300 mb-4">Listen to the Track</h3>
                  <div className="aspect-video rounded-lg overflow-hidden">
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
              </div>
            </div>

            {/* Sampled From */}
            <div className="bg-gray-800 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">Sampled From</h3>
              <div className="flex flex-col md:flex-row gap-8">
                {/* Album Art & Info */}
                <div className="flex-shrink-0">
                  <img 
                    src={item.sampledFrom.thumbnail} 
                    alt={`${item.sampledFrom.title} album art`}
                    className="w-64 h-64 rounded-xl object-cover shadow-2xl" 
                  />
                  <div className="mt-4 text-center">
                    <h2 className="text-2xl font-bold text-white">{item.sampledFrom.title}</h2>
                    <p className="text-lg text-gray-300">{item.sampledFrom.artist}</p>
                    <p className="text-sm text-gray-500">{item.sampledFrom.year}</p>
                  </div>
                </div>
                
                {/* Video Player */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-300 mb-4">Listen to the Original</h3>
                  <div className="aspect-video rounded-lg overflow-hidden">
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
          </div>
        ))}
      </div>
    </div>
  );
}
