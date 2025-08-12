import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css"; 

// Default API base for static hosts if not provided at build time
if (!import.meta.env.VITE_API_BASE && typeof window !== 'undefined') {
  const isGithubPages = /github\.io$/.test(window.location.hostname);
  if (isGithubPages) {
    window.__VITE_API_BASE__ = 'https://samplr-red.vercel.app';
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
