# Reddit News Bot

**Repository:** [https://github.com/secretneighbour/Reddit-news-bot](https://github.com/secretneighbour/Reddit-news-bot)

This directory contains the dedicated Node.js backend server for the Reddit News Bot application. This server handles all communication with external services like the Reddit API and RSS feeds, making the application self-contained and reliable.

## Why this architecture?

-   **Reliability:** The app no longer depends on public, third-party proxy services that can be slow or unavailable.
-   **Performance:** A dedicated backend handles network requests efficiently.
-   **No CORS Issues:** By moving all external API calls to the server, we completely eliminate browser-based Cross-Origin Resource Sharing (CORS) problems.

## Setup and Installation

### 1. Navigate to Project Directory

Open your terminal or command prompt and navigate into the main project directory.

### 2. Install Dependencies

Run the following command to install the required packages (express, cors, node-fetch).

```bash
npm install
```

### 3. Start the Server

While still in your project directory, run the server:

```bash
node server.js
```

You should see a message in your terminal:
`Reddit News Bot server is running on http://localhost:3001`

## How to Use

1.  Start the server (`node server.js`).
2.  Open `index.html` in your browser.
3.  Configure your Reddit API credentials in the Settings tab.
4.  Start the bot from the Dashboard.