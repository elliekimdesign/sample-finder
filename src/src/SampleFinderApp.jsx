import { useState } from "react";
import ReactPlayer from "react-player";

export default function SampleFinderApp() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const sampleDB = {
    "she knows": [
      {
        title: "J. Cole – She Knows (feat. Amber Coffman)",
        youtube: "https://www.youtube.com/watch?v=Zcps2fJKuAI",
        thumbnail: "/sheknows.jpg",
        sampledFrom: {
          title: "Cults – Bad Things",
          youtube: "https://www.youtube.com/watch?v=bLJ_s4GzHms",
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

  return (
    <div style={{ background: "#111", minHeight: "100vh", color: "#fff", padding: "4rem" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>Sample Finder</h1>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", maxWidth: "600px" }}>
        <input
          type="text"
          placeholder="Type a song title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, padding: "0.75rem", borderRadius: "6px", background: "#222", color: "#fff", border: "none" }}
        />
        <button type="submit" style={{ padding: "0.75rem 1rem", borderRadius: "6px", background: "#6366F1", color: "#fff", border: "none" }}>
          Search
        </button>
      </form>

      <div style={{ maxWidth: "800px", marginTop: "1rem" }}>
        {results.length === 0 && (
          <div style={{ color: "#aaa" }}>Try searching a known track (e.g., "She Knows")</div>
        )}
        {results.map((item, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: "#1f1f1f", borderRadius: "12px", padding: "1rem", marginTop: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#888" }}>Current Track</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "600" }}>{item.title}</div>
              <img src={item.thumbnail} alt="" style={{ width: 120, height: 120, borderRadius: 8, marginTop: 8, objectFit: "cover" }} />
              <div style={{ marginTop: 8 }}>
                <ReactPlayer url={item.youtube} controls width="100%" height="160px" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#888" }}>Sampled From</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "600" }}>{item.sampledFrom.title}</div>
              <img src={item.sampledFrom.thumbnail} alt="" style={{ width: 120, height: 120, borderRadius: 8, marginTop: 8, objectFit: "cover" }} />
              <div style={{ marginTop: 8 }}>
                <ReactPlayer url={item.sampledFrom.youtube} controls width="100%" height="160px" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
