import { useState, useEffect } from "react";
import ReactPlayer from "react-player";

export default function SampleFinderApp() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  
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
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Side - New Song Info */}
                            <div className="flex items-center gap-6">
                              <img 
                                src={item.thumbnail} 
                                alt={`${item.title} album art`}
                                className="w-32 h-32 rounded-xl object-cover shadow-xl" 
                              />
                              <div>
                                <h3 className="text-xl font-bold text-white">New Song</h3>
                                <p className="text-lg text-gray-300">{item.title} - {item.artist}</p>
                                <p className="text-sm text-gray-500">{item.year}</p>
                              </div>
                            </div>

                            {/* Right Side - Original Song Info */}
                            <div className="flex items-center gap-6">
                              <img 
                                src={item.sampledFrom.thumbnail} 
                                alt={`${item.sampledFrom.title} album art`}
                                className="w-32 h-32 rounded-xl object-cover shadow-xl" 
                              />
                              <div>
                                <h3 className="text-xl font-bold text-white">Original Song</h3>
                                <p className="text-lg text-gray-300">{item.sampledFrom.title} - {item.sampledFrom.artist}</p>
                                <p className="text-sm text-gray-500">{item.sampledFrom.year}</p>
                              </div>
                            </div>
                          </div>

                          {/* Video Player Cards */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Side - New Song Video */}
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                              <h3 className="text-lg font-semibold text-gray-300 mb-4">New Song</h3>
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

                            {/* Right Side - Original Song Video */}
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                              <h3 className="text-lg font-semibold text-gray-300 mb-4">Original Song</h3>
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
                      ))}
                    </div>
      </div>
    </div>
  );
}
