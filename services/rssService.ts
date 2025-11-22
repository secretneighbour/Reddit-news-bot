import type { FetchedArticle } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

interface FetchResult {
    articles: FetchedArticle[];
    errors: string[];
}

export const fetchAndParseRssFeeds = async (feedUrls: string): Promise<FetchResult> => {
    const urls = feedUrls.split(/[\n,]/).map(url => url.trim()).filter(Boolean);
    if (urls.length === 0) return { articles: [], errors: [] };

    try {
        const response = await fetch(`${API_BASE_URL}/rss/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message || 'Failed to fetch feeds from backend.');
        }

        const data: FetchResult = await response.json();
        return data;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            articles: [],
            errors: [`Failed to communicate with the backend server: ${errorMessage}`],
        };
    }
};