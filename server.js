// A dedicated backend server for the Reddit News Bot application.
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
// NOTE: URL and Buffer are built into Node.js, no special imports needed.

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

const REDDIT_API_BASE = "https://www.reddit.com";
const REDDIT_OAUTH_BASE = "https://oauth.reddit.com";
const USER_AGENT = 'WebApp:RedditNewsBot:v1.0 (by /u/yourusername)';

// --- Helper Functions ---

const normalizeUrl = (urlString) => {
    try {
        const url = new URL(urlString);
        const paramsToRemove = [
          'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
          'ref', 'mc_cid', 'mc_eid', 'fbclid', 'gclid'
        ];
        paramsToRemove.forEach(param => url.searchParams.delete(param));
        url.hash = '';
        url.searchParams.sort();
        return url.toString();
    } catch (e) {
        return urlString;
    }
};

const sanitizeSubreddit = (name) => {
    if (!name) return '';
    return name.trim().replace(/^r\//i, '').replace(/\/$/, '');
};


const parseXmlValue = (xml, tag) => {
    // Check for a CDATA section first, then a regular tag
    const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i'));
    if (cdataMatch) return cdataMatch[1].trim();

    const regularMatch = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (regularMatch) {
         // Basic entity decoding
        return regularMatch[1].trim()
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }
    return '';
};

// --- Reddit API Helpers ---

const handleRedditApiError = async (response) => {
    let errorBodyText = await response.text();
    let errorData = {};
    try {
        if (errorBodyText) errorData = JSON.parse(errorBodyText);
    } catch (e) {
        /* not a json response */
    }

    let errorMessage = errorData.error_description || errorData.message || (errorData.json?.errors?.[0]?.[1]) || errorData.reason || response.statusText;
    
    if (response.status === 401) errorMessage = "Invalid credentials or expired token.";
    if (response.status === 403) errorMessage = "You do not have permission for this action.";
    if (response.status === 404) errorMessage = "Subreddit not found or API endpoint does not exist.";

    return { status: response.status, message: errorMessage };
};

const getRedditToken = async (clientId, clientSecret, username, password) => {
    const { URLSearchParams } = require('url');
    const body = new URLSearchParams({ grant_type: "password", username, password });
    const response = await fetch(`${REDDIT_API_BASE}/api/v1/access_token`, {
        method: "POST",
        headers: {
            "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
        },
        body: body.toString(),
    });
    if (!response.ok) {
        const error = await handleRedditApiError(response);
        throw new Error(error.message);
    }
    const data = await response.json();
    return data.access_token;
};

// --- Reddit API Routes ---

app.post('/api/reddit/verify', async (req, res) => {
    const { clientId, clientSecret, username, password } = req.body;
    try {
        await getRedditToken(clientId, clientSecret, username, password);
        res.status(200).json({ message: 'Credentials are valid!' });
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
});

app.post('/api/reddit/login', async (req, res) => {
    const { clientId, clientSecret, username, password } = req.body;
    try {
        const token = await getRedditToken(clientId, clientSecret, username, password);
        res.status(200).json({ token });
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
});

const withAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization token is required.' });
    }
    req.token = authHeader.split(' ')[1];
    next();
};

const makeRedditApiRequest = async (token, endpoint, options = {}) => {
    const response = await fetch(`${REDDIT_OAUTH_BASE}${endpoint}`, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'User-Agent': USER_AGENT,
        }
    });
    if (!response.ok) {
        const error = await handleRedditApiError(response);
        throw new Error(error.message);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
};


app.get('/api/reddit/flairs', withAuth, async (req, res) => {
    let { subreddit } = req.query;
    if (!subreddit) return res.status(400).json({ message: 'Subreddit query parameter is required.' });
    
    subreddit = sanitizeSubreddit(subreddit);

    try {
        const data = await makeRedditApiRequest(req.token, `/r/${subreddit}/api/link_flair_v2.json`);
        const flairs = (Array.isArray(data) ? data : [])
            .filter(flair => flair.type !== 'text' || !flair.mod_only)
            .map(flair => ({
                id: flair.id,
                text: flair.richtext?.map(e => e.t).join('') || flair.text,
                type: flair.type,
                text_color: flair.text_color,
                background_color: flair.background_color,
                css_class: flair.css_class,
            }));
        res.status(200).json(flairs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/reddit/validate-subreddit', withAuth, async (req, res) => {
    let { subreddit } = req.query;
    if (!subreddit) return res.status(400).json({ message: 'Subreddit query parameter is required.' });

    subreddit = sanitizeSubreddit(subreddit);
    if (!subreddit) return res.status(400).json({ message: 'Subreddit name cannot be empty.' });

    try {
        const data = await makeRedditApiRequest(req.token, `/r/${subreddit}/about.json`);
        const subscribers = data?.data?.subscribers;
        if (typeof subscribers !== 'number') {
             throw new Error("Could not confirm subreddit details.");
        }
        res.status(200).json({ 
            message: `Success! Found r/${subreddit} with ${subscribers.toLocaleString()} subscribers.` 
        });
    } catch (error) {
         res.status(404).json({ message: `Error: Subreddit '${subreddit}' could not be found.` });
    }
});

app.post('/api/reddit/submit', withAuth, async (req, res) => {
    const { URLSearchParams } = require('url');
    let { subreddit, title, url, flairId } = req.body;

    subreddit = sanitizeSubreddit(subreddit);

    try {
        const body = new URLSearchParams({ sr: subreddit, kind: 'link', title, url, api_type: 'json' });
        if (flairId) body.append('flair_id', flairId);
        
        const data = await makeRedditApiRequest(req.token, '/api/submit', {
            method: 'POST',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        });
        
        if (data?.json?.errors?.length > 0) {
            // Specifically check for "ALREADY_SUBMITTED"
            if (data.json.errors.some(err => err[0] === 'ALREADY_SUBMITTED')) {
                 throw new Error("This link has already been submitted to this subreddit.");
            }
            throw new Error(data.json.errors[0][1]);
        }
        if (!data?.json?.data?.url) throw new Error("Post created, but could not retrieve its URL.");

        const postData = data.json.data;
        const postUrl = postData.url.startsWith('http') ? postData.url : `https://www.reddit.com${postData.url}`;
        const postId = postData.name; // This is the fullname, e.g., "t3_xxxxxx"

        res.status(200).json({ url: postUrl, id: postId });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/reddit/comment', withAuth, async (req, res) => {
    const { URLSearchParams } = require('url');
    const { parentId, text } = req.body;
    if (!parentId || !text) {
        return res.status(400).json({ message: 'Parent ID and text are required.' });
    }

    try {
        const body = new URLSearchParams({
            api_type: 'json',
            thing_id: parentId,
            text: text,
        });

        await makeRedditApiRequest(req.token, '/api/comment', {
            method: 'POST',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        });

        res.status(204).send(); // Success, no content
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// --- RSS Fetching Route ---

app.post('/api/rss/fetch', async (req, res) => {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ message: 'A JSON array of URLs is required.' });
    }

    const processSingleFeed = async (url) => {
        // Use AbortController for timeouts, which is more robust.
        const AbortController = global.AbortController || require('abort-controller');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 10000); // 10-second timeout

        try {
            const response = await fetch(url, { 
                headers: { 'User-Agent': USER_AGENT },
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`Request failed with status: ${response.status}`);
            }
            const xmlText = await response.text();
            
            const sourceName = parseXmlValue(xmlText.split(/<item|<entry/)[0], 'title');
            
            const itemRegex = /<(item|entry)>([\s\S]*?)<\/\1>/g;
            let match;
            const articlesFromFeed = [];
            while ((match = itemRegex.exec(xmlText)) !== null) {
                const itemXml = match[2];
                const title = parseXmlValue(itemXml, 'title');
                let link = parseXmlValue(itemXml, 'link');

                if (!link) {
                    const linkTag = itemXml.match(/<link[^>]*href="([^"]+)"/i);
                    if (linkTag && linkTag[1]) {
                         link = linkTag[1];
                    }
                }
                
                if (!title || !link) continue;
                
                const pubDate = parseXmlValue(itemXml, 'pubDate') || parseXmlValue(itemXml, 'published');
                const description = parseXmlValue(itemXml, 'description') || parseXmlValue(itemXml, 'summary') || parseXmlValue(itemXml, 'content');

                articlesFromFeed.push({
                    id: link,
                    title,
                    link,
                    sourceName: sourceName || new URL(url).hostname,
                    pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                    description: description.replace(/<[^>]+>/g, ''),
                });
            }
            return articlesFromFeed;
        } finally {
            clearTimeout(timeoutId);
        }
    };
    
    const feedPromises = urls.map(url => processSingleFeed(url));
    const results = await Promise.allSettled(feedPromises);

    const articles = [];
    const errors = [];

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            articles.push(...result.value);
        } else {
            const url = urls[index];
            let errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
            if (result.reason.name === 'AbortError') {
                errorMessage = 'Request timed out after 10 seconds.';
            }
            errors.push(`Error processing feed ${url}: ${errorMessage}`);
        }
    });

    res.status(200).json({ articles, errors });
});

// Catch-all to serve the index.html for any non-API route (Single Page App support)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'Not Found' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});


app.listen(PORT, () => {
    console.log(`Reddit News Bot server is running on http://localhost:${PORT}`);
});