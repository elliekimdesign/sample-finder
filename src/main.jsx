import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx"; // 확장자 맞춰서

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
