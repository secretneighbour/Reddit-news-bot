import type { Flair } from '../types';
import { normalizeUrl } from '../utils';

const API_BASE_URL = 'http://localhost:3001/api';

const handleApiResponse = async (response: Response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'An unknown server error occurred.');
    }
    return response.json();
};

export const verifyCredentials = async (
    clientId: string,
    clientSecret: string,
    username: string,
    password: string,
): Promise<void> => {
     if (!clientId || !clientSecret || !username || !password) {
        throw new Error("All Reddit credential fields are required for testing.");
    }
    
    const response = await fetch(`${API_BASE_URL}/reddit/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret, username, password })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Credential test failed: ${errorData.message}`);
    }
};

export const loginWithPasswordGrant = async (
    clientId: string,
    clientSecret: string,
    username: string,
    password: string,
): Promise<string> => {
    if (!clientId || !clientSecret || !username || !password) {
        throw new Error("All Reddit credential fields are required.");
    }
    
    const response = await fetch(`${API_BASE_URL}/reddit/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret, username, password })
    });
    
    const data = await handleApiResponse(response);
    return data.token;
};

export const getLinkFlairs = async (token: string, subreddit: string): Promise<Flair[]> => {
    const response = await fetch(`${API_BASE_URL}/reddit/flairs?subreddit=${encodeURIComponent(subreddit)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleApiResponse(response);
};

export const validateSubreddit = async (token: string, subreddit: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/reddit/validate-subreddit?subreddit=${encodeURIComponent(subreddit)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleApiResponse(response);
};

export const submitPost = async (token: string, subreddit: string, title: string, url: string, flairId?: string): Promise<{ url: string, id: string }> => {
    const response = await fetch(`${API_BASE_URL}/reddit/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subreddit, title, url, flairId })
    });
    const data = await handleApiResponse(response);
    return data; // Expects { url, id }
};

export const submitComment = async (token: string, parentId: string, text: string): Promise<void> => {
     await fetch(`${API_BASE_URL}/reddit/comment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ parentId, text })
    });
    // We don't need to handle the response unless there's an error, which handleApiResponse does.
};
