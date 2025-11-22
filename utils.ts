import type { FetchedArticle, ScoreDetails } from './types';

// ==========================================
// URL & String Helpers
// ==========================================

/**
 * Normalizes a URL by removing tracking parameters and standardizing the format.
 * Essential for accurate duplicate detection.
 */
export const normalizeUrl = (urlString: string): string => {
    try {
        const url = new URL(urlString);
        // Remove common tracking parameters
        const paramsToRemove = [
          'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
          'ref', 'mc_cid', 'mc_eid', 'fbclid', 'gclid'
        ];
        paramsToRemove.forEach(param => url.searchParams.delete(param));
        url.hash = ''; // Remove fragments
        
        // Remove trailing slash from pathname
        if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
            url.pathname = url.pathname.slice(0, -1);
        }

        url.searchParams.sort(); // Sort params for consistency
        return url.toString();
    } catch (e) {
        // Fallback for invalid URLs
        return urlString;
    }
};

/**
 * Extracts the clean domain name (e.g., "ign.com") from a URL string.
 */
const getDomainFromUrl = (urlString: string): string => {
    try {
        const url = new URL(urlString);
        return url.hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
        return '';
    }
};


// ==========================================
// Local Smart AI & Logic
// ==========================================

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', "aren't", 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', "can't", 'cannot', 'com', 'could', "couldn't", 'did', "didn't", 'do', 'does', "doesn't", 'doing', "don't", 'down', 'during',
  'each', 'few', 'for', 'from', 'further', 'had', "hadn't", 'has', "hasn't", 'have', "haven't", 'having', 'he', "he'd", "he'll", "he's", 'her', 'here', "here's", 'hers', 'herself', 'him', 'himself', 'his', 'how', "how's",
  'i', "i'd", "i'll", "i'm", "i've", 'if', 'in', 'into', 'is', "isn't", 'it', "it's", 'its', 'itself',
  'just', 'k', "let's", 'like', 'me', 'more', 'most', "mustn't", 'my', 'myself',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'r', 'same', 'shan\'t', 'she', "she'd", "she'll", "she's", 'should', "shouldn't", 'so', 'some', 'such',
  'than', 'that', "that's", 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', "there's", 'these', 'they', "they'd", "they'll", "they're", "they've", 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', "wasn't", 'we', "we'd", "we'll", "we're", "we've", 'were', "weren't", 'what', "what's", 'when', "when's", 'where', "where's", 'which', 'while', 'who', "who's", 'whom', 'why', "why's", 'will', 'with', "won't", 'would', "wouldn't",
  'you', "you'd", "you'll", "you're", "you've", 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenizes text into a set of meaningful words, removing punctuation and stop words.
 */
const normalizeAndGetWords = (text: string): Set<string> => {
    const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // remove punctuation
        .split(/\s+/) // split by whitespace
        .filter(word => word.length > 1 && !STOP_WORDS.has(word));
    return new Set(words);
};

/**
 * Extracts a list of significant keywords from a text string. 
 * Used for the Adaptive Learning feature.
 */
export const extractSignificantKeywords = (text: string): string[] => {
    return Array.from(normalizeAndGetWords(text));
};

/**
 * Calculates Jaccard Similarity between two sets of words.
 * Returns a value between 0 (no overlap) and 1 (identical).
 */
const calculateJaccardSimilarity = (set1: Set<string>, set2: Set<string>): number => {
    const intersectionSize = new Set([...set1].filter(x => set2.has(x))).size;
    const unionSize = new Set([...set1, ...set2]).size;
    return unionSize === 0 ? 0 : intersectionSize / unionSize;
};

/**
 * Finds semantic duplicates in a list of new articles by comparing them against 
 * the titles of previously posted articles.
 */
export const findLocalSemanticDuplicates = (
    newArticles: FetchedArticle[],
    historyTitles: string[],
    similarityThreshold = 0.5 // 50% keyword overlap
): string[] => {
    if (newArticles.length === 0 || historyTitles.length === 0) {
        return [];
    }
    
    const duplicateArticleIds: string[] = [];
    const historyTitleWordSets = historyTitles.map(normalizeAndGetWords);

    newArticles.forEach(article => {
        const articleWordSet = normalizeAndGetWords(article.title);

        for (const historySet of historyTitleWordSets) {
            const similarity = calculateJaccardSimilarity(articleWordSet, historySet);
            if (similarity >= similarityThreshold) {
                duplicateArticleIds.push(article.id);
                return; 
            }
        }
    });

    return duplicateArticleIds;
};

// ==========================================
// Scoring Engine
// ==========================================

/**
 * Parses a multiline string of keywords and their optional scores.
 * @param keywordsString The raw string (e.g., "keyword: 10\nother").
 * @param defaultScore Score to use if none specified (default: 1).
 */
export const parseKeywordsWithScores = (keywordsString: string, defaultScore: number = 1): Map<string, number> => {
    const keywordMap = new Map<string, number>();
    keywordsString
        .split('\n')
        .filter(Boolean)
        .map(line => line.trim().toLowerCase())
        .forEach(line => {
            const parts = line.split(':');
            if (parts.length === 2) {
                const keyword = parts[0].trim();
                const score = parseInt(parts[1].trim(), 10);
                if (keyword && !isNaN(score)) {
                    keywordMap.set(keyword, score);
                }
            } else if (line) {
                keywordMap.set(line, defaultScore);
            }
        });
    return keywordMap;
};

/**
 * The Core AI Brain.
 * Calculates a detailed relevance score for an article.
 * 
 * Logic:
 * 1. **Keywords**: Sum of scores from included/excluded keywords.
 * 2. **Title Boost**: 50% bonus if a positive keyword is in the title.
 * 3. **Recency**: Bonus points for articles < 12 hours old.
 * 4. **Authority**: Bonus/Penalty based on domain reputation.
 * 5. **Bias**: Penalty based on user's rejected topics.
 */
export const calculateArticleScore = (
    article: FetchedArticle,
    scoredKeywords: Map<string, number>,
    sourceAuthorityMap?: Map<string, number>,
    learnedBiasMap?: Map<string, number>
): ScoreDetails => {
    let baseScore = 0;
    let titleBoost = 0;
    const titleLower = article.title.toLowerCase();
    const descriptionLower = article.description.toLowerCase();

    // 1. Keyword Scoring
    for (const [keyword, value] of scoredKeywords.entries()) {
        const inTitle = titleLower.includes(keyword);
        const inDescription = descriptionLower.includes(keyword);

        if (inTitle || inDescription) {
            baseScore += value;
            // Apply a 50% bonus for positive keywords found in the title
            if (inTitle && value > 0) {
                titleBoost += Math.ceil(value * 0.5);
            }
        }
    }

    // 2. Recency Boost Logic
    let recency = 0;
    try {
        const articleDate = new Date(article.pubDate);
        const hoursAgo = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursAgo <= 2) {
            recency = 5; // Very hot
        } else if (hoursAgo <= 6) {
            recency = 3; // Hot
        } else if (hoursAgo <= 12) {
            recency = 1; // Recent
        }
    } catch (e) {
        // Ignore invalid dates
    }

    // 3. Source Authority Logic
    let sourceAuthority = 0;
    if (sourceAuthorityMap) {
        const domain = getDomainFromUrl(article.link);
        if (domain && sourceAuthorityMap.has(domain)) {
            sourceAuthority = sourceAuthorityMap.get(domain) || 0;
        }
    }

    // 4. Learned Bias Logic
    let learnedBias = 0;
    if (learnedBiasMap) {
        const words = normalizeAndGetWords(article.title);
        words.forEach(word => {
            if (learnedBiasMap.has(word)) {
                learnedBias += (learnedBiasMap.get(word) || 0);
            }
        });
    }

    const total = baseScore + titleBoost + recency + sourceAuthority + learnedBias;
    return { base: baseScore, titleBoost, recency, sourceAuthority, learnedBias, total };
};