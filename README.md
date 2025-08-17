# samplefindr

An AI-powered music sample detection application that identifies samples in songs and provides YouTube videos for both the original track and the sampled source.

## Features

- **AI-Powered Sample Detection**: Uses OpenAI GPT-4 with web search to identify music samples
- **YouTube Integration**: Automatically finds and displays YouTube videos for both tracks and samples
- **Spotify Integration**: Enriches track data with album art, genres, and artist information
- **Modern UI**: Beautiful, responsive interface with smooth animations

## Setup

### Prerequisites

- Node.js 18+ 
- OpenAI API key with GPT-4 access

### Environment Variables

Create a `.env` file in the root directory:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# API Base URL (optional - will use Vercel deployment by default)
# VITE_API_BASE=https://your-vercel-app.vercel.app
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## API Endpoints

### `/api/samples`
- **Method**: POST
- **Body**: `{ "query": "song title artist" }`
- **Response**: JSON with sample identification and YouTube URLs

### `/api/spotify/search`
- **Method**: GET
- **Query**: `?q=search_term`
- **Response**: Spotify track and artist data

## How It Works

1. **Sample Detection**: Uses OpenAI GPT-4 with web search to identify samples in songs
2. **YouTube Search**: Automatically finds the best YouTube URLs for both the query song and its sample
3. **Data Enrichment**: Fetches additional metadata from Spotify (album art, genres, etc.)
4. **Video Display**: Embeds YouTube players for side-by-side comparison

## Technologies Used

- **Frontend**: React, Vite, Tailwind CSS
- **AI**: OpenAI GPT-4 with web search capabilities
- **APIs**: YouTube (via web search), Spotify
- **Deployment**: Vercel (serverless functions)

## License

© 2025 Ellie Kim
