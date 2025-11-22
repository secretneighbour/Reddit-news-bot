import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import SettingsPage from './components/SettingsPage';
import Dashboard from './components/Dashboard';
import NewsTicker from './components/NewsTicker';
import * as redditService from './services/redditService';
import * as rssService from './services/rssService';
import { normalizeUrl, findLocalSemanticDuplicates, parseKeywordsWithScores, calculateArticleScore, extractSignificantKeywords } from './utils';
import type { PostedItem, RedditAuth, Flair, AutomationSettings, FetchedArticle, LogEntry, LogLevel, ScoreDetails } from './types';

// ==========================================
// Constants & Configuration
// ==========================================

const BUILT_IN_FEEDS = [
    "https://feeds.feedburner.com/ign/all",
    "https://www.gamespot.com/feeds/news/",
    "https://www.gameinformer.com/news.xml",
    "https://www.dualshockers.com/feed/",
    "https://www.videogameschronicle.com/feed/",
    "https://www.pcgamer.com/rss/",
];

const MAX_PENDING_ARTICLES = 50;
const FETCH_INTERVAL_MINUTES = 5;

const defaultExcludeKeywords = [
    // General Sales/Promo
    'deal', 'sale', 'discount', 'deals', 'sales', 'discounts',
    'sponsorship', 'giveaway', 'contest', 'free', 'bundle',
    // Hardware General
    'hardware', 'gpu', 'cpu', 'review', 'benchmark', 'driver', 'firmware', 'specs',
    // Components
    'motherboard', 'ram', 'ssd', 'psu', 'case', 'cooler', 'chassis',
    // Brands (Hardware Context)
    'nvidia', 'amd', 'intel', 'ryzen', 'geforce', 'radeon', 'rtx', 'gtx',
    // Peripherals
    'monitor', 'keyboard', 'mouse', 'headset', 'controller', 'chair', 'desk',
    // Devices
    'laptop', 'notebook', 'steam deck', 'rog ally', 'handheld',
    // Misc
    'esports', 'recap', 'guide', 'walkthrough', 'best of',
].join('\n');

const App: React.FC = () => {
    
    // ==========================================
    // State Management
    // ==========================================

    // --- View State ---
    const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');

    // --- Authentication ---
    const [redditAuth, setRedditAuth] = useState<RedditAuth | null>(null);

    // --- Automation Status ---
    const [isAutomationRunning, setIsAutomationRunning] = useState(false);
    const [isFetchingManually, setIsFetchingManually] = useState(false);
    const [automationStatus, setAutomationStatus] = useState('Idle');
    const [activityLog, setActivityLog] = useState<LogEntry[]>([]);

    // --- Settings ---
    const [automationSettings, setAutomationSettings] = useState<AutomationSettings>({
        targetSubreddit: '',
        checkInterval: 15,
        postLimit: 2,
        defaultFlairId: '',
        rssFeedUrls: '',
        includeKeywords: 'release date: 10\nannounced: 8\nupdate: 5\npatch: 5',
        excludeKeywords: defaultExcludeKeywords,
        sourceAuthorityScores: 'ign.com: 5\nkotaku.com: -5',
        minimumScore: 5,
        useProactiveDuplicateCheck: true,
        useAdaptiveLearning: true,
    });

    // --- Data Persistence ---
    const [postingHistory, setPostingHistory] = useState<PostedItem[]>([]);
    const [pendingArticles, setPendingArticles] = useState<FetchedArticle[]>([]);
    const [removedArticleUrls, setRemovedArticleUrls] = useState<Set<string>>(new Set());
    const [learnedBiases, setLearnedBiases] = useState<Map<string, number>>(new Map());

    // --- UI Data (Flairs, Ticker) ---
    const [flairCache, setFlairCache] = useState<Record<string, Flair[]>>({});
    const [isDetectingFlairs, setIsDetectingFlairs] = useState(false);
    const [flairError, setFlairError] = useState<string | null>(null);
    const [tickerHeadlines, setTickerHeadlines] = useState<FetchedArticle[]>([]);

    // --- Refs (Timers) ---
    const intervalRef = useRef<number | null>(null);
    const fetchIntervalRef = useRef<number | null>(null);
    const countdownIntervalRef = useRef<number | null>(null);
    const postCycleRef = useRef<() => Promise<void>>(() => Promise.resolve());
    const fetchCycleRef = useRef<() => Promise<void>>(() => Promise.resolve());

    // ==========================================
    // Effects & Initialization
    // ==========================================

    const logMessage = useCallback((message: string, level: LogLevel = 'INFO') => {
        const timestamp = new Date().toLocaleTimeString();
        const newEntry: LogEntry = { timestamp, message, level };
        setActivityLog(prev => [newEntry, ...prev].slice(0, 100));
    }, []);

    // Load data from localStorage on mount
    useEffect(() => {
        const savedAuth = localStorage.getItem('redditAuth');
        if (savedAuth) setRedditAuth(JSON.parse(savedAuth));

        const savedHistory = localStorage.getItem('postingHistory');
        if (savedHistory) setPostingHistory(JSON.parse(savedHistory));
        
        const savedFlairCache = localStorage.getItem('flairCache');
        if (savedFlairCache) setFlairCache(JSON.parse(savedFlairCache));

        const savedPending = localStorage.getItem('pendingArticles');
        if (savedPending) setPendingArticles(JSON.parse(savedPending));

        const savedRemovedUrls = localStorage.getItem('removedArticleUrls');
        if (savedRemovedUrls) setRemovedArticleUrls(new Set(JSON.parse(savedRemovedUrls) as string[]));

        const savedBiases = localStorage.getItem('learnedBiases');
        if (savedBiases) {
            try {
                setLearnedBiases(new Map(JSON.parse(savedBiases)));
            } catch (e) {
                console.error("Failed to load learned biases", e);
            }
        }

        loadSettings();
    }, []);
    
    // Initial Ticker Fetch
    useEffect(() => {
        const fetchTickerHeadlines = async () => {
            const tickerFeeds = BUILT_IN_FEEDS.join('\n');
            const { articles, errors } = await rssService.fetchAndParseRssFeeds(tickerFeeds);
            if (errors.length > 0) {
                errors.forEach(err => logMessage(`Ticker Error: ${err}`, 'WARN'));
            }
            setTickerHeadlines(articles.slice(0, 20));
        };
        fetchTickerHeadlines();
    }, [logMessage]);

    // ==========================================
    // Helpers & Handlers
    // ==========================================

    const saveHistory = (history: PostedItem[]) => {
        setPostingHistory(history);
        localStorage.setItem('postingHistory', JSON.stringify(history));
    };

    const savePendingArticles = useCallback((articles: FetchedArticle[]) => {
        setPendingArticles(articles);
        localStorage.setItem('pendingArticles', JSON.stringify(articles));
    }, []);
    
    const saveRemovedUrls = (urls: Set<string>) => {
        setRemovedArticleUrls(urls);
        localStorage.setItem('removedArticleUrls', JSON.stringify(Array.from(urls)));
    };

    const saveLearnedBiases = (biases: Map<string, number>) => {
        setLearnedBiases(biases);
        localStorage.setItem('learnedBiases', JSON.stringify(Array.from(biases.entries())));
    };

    const loadSettings = () => {
        const checkInterval = parseInt(localStorage.getItem('automationInterval') || '15', 10);
        const postLimit = parseInt(localStorage.getItem('automationPostLimit') || '2', 10);
        const minimumScore = parseInt(localStorage.getItem('automationMinimumScore') || '5', 10);
        
        const savedSettings: Partial<AutomationSettings> = {
            targetSubreddit: localStorage.getItem('automationTargetSubreddit') || '',
            checkInterval: isNaN(checkInterval) || checkInterval < 1 ? 15 : checkInterval,
            postLimit: isNaN(postLimit) || postLimit < 1 ? 2 : postLimit,
            defaultFlairId: localStorage.getItem('automationDefaultFlairId') || '',
            rssFeedUrls: localStorage.getItem('automationRssFeedUrls') || '',
            includeKeywords: localStorage.getItem('automationIncludeKeywords') || 'release date: 10\nannounced: 8\nupdate: 5\npatch: 5',
            excludeKeywords: localStorage.getItem('automationExcludeKeywords') || defaultExcludeKeywords,
            sourceAuthorityScores: localStorage.getItem('automationSourceAuthorityScores') || 'ign.com: 5\nkotaku.com: -5',
            minimumScore: isNaN(minimumScore) ? 5 : minimumScore,
            useProactiveDuplicateCheck: localStorage.getItem('automationUseProactiveDuplicateCheck') !== 'false',
            useAdaptiveLearning: localStorage.getItem('automationUseAdaptiveLearning') !== 'false',
        };
        setAutomationSettings(prev => ({...prev, ...savedSettings}));
    };
    
    const scoreAndFilterArticles = (
        articles: FetchedArticle[],
        settings: AutomationSettings
    ): FetchedArticle[] => {
        const inclusionMap = parseKeywordsWithScores(settings.includeKeywords, 1);
        const exclusionMap = parseKeywordsWithScores(settings.excludeKeywords, 1);
        const sourceAuthorityMap = parseKeywordsWithScores(settings.sourceAuthorityScores, 0);

        const combinedScoredKeywords = new Map<string, number>();
        inclusionMap.forEach((score, keyword) => combinedScoredKeywords.set(keyword, Math.abs(score)));
        exclusionMap.forEach((score, keyword) => combinedScoredKeywords.set(keyword, -Math.abs(score)));

        const scoredArticles = articles.map(article => {
            const effectiveBiases = settings.useAdaptiveLearning ? learnedBiases : undefined;
            const scoreDetails = calculateArticleScore(article, combinedScoredKeywords, sourceAuthorityMap, effectiveBiases);
            return { article, scoreDetails };
        });
        
        scoredArticles.forEach(({ article, scoreDetails }) => {
            const breakdown = `Base: ${scoreDetails.base}, Title: ${scoreDetails.titleBoost}, Recency: ${scoreDetails.recency}, Source: ${scoreDetails.sourceAuthority}, Bias: ${scoreDetails.learnedBias}`;
            logMessage(`Article "${article.title}" scored: ${scoreDetails.total} (${breakdown})`, 'INFO');
        });

        const filteredArticles = scoredArticles.filter(({ scoreDetails }) => scoreDetails.total >= settings.minimumScore);

        logMessage(`Found ${filteredArticles.length} articles meeting the minimum score of ${settings.minimumScore}.`, 'INFO');
        
        // Sort by score desc, then date desc
        filteredArticles.sort((a, b) => {
            if (b.scoreDetails.total !== a.scoreDetails.total) {
                return b.scoreDetails.total - a.scoreDetails.total;
            }
            return new Date(b.article.pubDate).getTime() - new Date(a.article.pubDate).getTime();
        });

        return filteredArticles.map(item => item.article);
    };

    const handleUpdateSettings = (newSettings: AutomationSettings) => {
        const sanitizedSettings = {
            ...newSettings,
            checkInterval: Math.max(1, Number(newSettings.checkInterval) || 15),
            postLimit: Math.max(1, Number(newSettings.postLimit) || 2),
            minimumScore: Number(newSettings.minimumScore) || 0,
        };

        localStorage.setItem('automationTargetSubreddit', sanitizedSettings.targetSubreddit);
        localStorage.setItem('automationInterval', sanitizedSettings.checkInterval.toString());
        localStorage.setItem('automationPostLimit', sanitizedSettings.postLimit.toString());
        localStorage.setItem('automationMinimumScore', sanitizedSettings.minimumScore.toString());
        localStorage.setItem('automationDefaultFlairId', sanitizedSettings.defaultFlairId);
        localStorage.setItem('automationRssFeedUrls', sanitizedSettings.rssFeedUrls);
        localStorage.setItem('automationIncludeKeywords', sanitizedSettings.includeKeywords);
        localStorage.setItem('automationExcludeKeywords', sanitizedSettings.excludeKeywords);
        localStorage.setItem('automationSourceAuthorityScores', sanitizedSettings.sourceAuthorityScores);
        localStorage.setItem('automationUseProactiveDuplicateCheck', sanitizedSettings.useProactiveDuplicateCheck.toString());
        localStorage.setItem('automationUseAdaptiveLearning', sanitizedSettings.useAdaptiveLearning.toString());

        logMessage("Settings saved. Re-filtering pending articles...", 'INFO');
        const cleanedPendingArticles = scoreAndFilterArticles(pendingArticles, sanitizedSettings);
        savePendingArticles(cleanedPendingArticles);
        
        setAutomationSettings(sanitizedSettings);
    };
    
    // ==========================================
    // Automation Logic
    // ==========================================

    const startCountdown = useCallback((startTime: number) => {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        
        const nextRunTime = startTime + automationSettings.checkInterval * 60 * 1000;

        countdownIntervalRef.current = window.setInterval(() => {
            const remaining = Math.round((nextRunTime - Date.now()) / 1000);
            if (remaining <= 0) {
                setAutomationStatus('Executing post cycle...');
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                return;
            }
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            setAutomationStatus(`Idle (next post in ${minutes}m ${seconds.toString().padStart(2, '0')}s)`);
        }, 1000);
    }, [automationSettings.checkInterval]);
    
    const runFetchCycle = useCallback(async () => {
        logMessage("Fetching new articles for the queue...", 'INFO');
        setAutomationStatus('Fetching feeds...');

        const allFeedUrls = [...BUILT_IN_FEEDS, automationSettings.rssFeedUrls].join('\n');
        const { articles: newArticles, errors } = await rssService.fetchAndParseRssFeeds(allFeedUrls);

        if (errors.length > 0) errors.forEach(err => logMessage(err, 'WARN'));
        if (newArticles.length === 0) {
             setAutomationStatus('Idle');
            return;
        }
        
        const urlsToExclude = new Set([
            ...postingHistory.map(item => normalizeUrl(item.url)),
            ...pendingArticles.map(item => normalizeUrl(item.link))
        ]);
        removedArticleUrls.forEach(url => urlsToExclude.add(url));

        const uniqueNewArticles = newArticles.filter(article => !urlsToExclude.has(normalizeUrl(article.link)));

        if(uniqueNewArticles.length === 0) {
            logMessage("Fetch complete. No new, un-removed articles found.", 'INFO');
            setAutomationStatus('Idle');
            return;
        }
        
        const combined = [...pendingArticles, ...uniqueNewArticles];
        const uniqueArticles = combined.filter((article, index, self) =>
            index === self.findIndex((a) => normalizeUrl(a.link) === normalizeUrl(article.link))
        );

        uniqueArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        let updatedPending = uniqueArticles.slice(0, MAX_PENDING_ARTICLES);
        
        const addedCount = updatedPending.length - pendingArticles.length;
        if (addedCount > 0) logMessage(`Fetch complete. Added ${addedCount} new articles.`, 'SUCCESS');
        else logMessage("Fetch complete. No new articles found.", 'INFO');
        
        savePendingArticles(updatedPending);
        if (!isAutomationRunning) setAutomationStatus('Idle');

    }, [automationSettings, postingHistory, logMessage, savePendingArticles, isAutomationRunning, removedArticleUrls, pendingArticles]);
    
    const runPostingCycle = useCallback(async () => {
        if (!redditAuth || !redditAuth.token || !automationSettings.targetSubreddit) {
            logMessage("Auth or Subreddit missing. Stopping.", 'ERROR');
            setIsAutomationRunning(false);
            return;
        }

        if (pendingArticles.length === 0) {
            logMessage("Queue empty. Waiting for next fetch.", 'INFO');
            return;
        }

        logMessage(`Starting post cycle. Queue size: ${pendingArticles.length}`, 'INFO');
        let articlesToProcess = [...pendingArticles];
        let currentHistory = [...postingHistory];

        // Duplicate Check
        if (automationSettings.useProactiveDuplicateCheck) {
            logMessage("Checking against history for duplicates...", 'INFO');
            const historyTitles = currentHistory.slice(0, 50).map(item => item.title);
            const duplicateArticleIds = findLocalSemanticDuplicates(articlesToProcess, historyTitles);

            if (duplicateArticleIds.length > 0) {
                const duplicateUrlSet = new Set(duplicateArticleIds.map(id => normalizeUrl(id)));
                articlesToProcess = articlesToProcess.filter(a => !duplicateUrlSet.has(normalizeUrl(a.link)));
                logMessage(`Removed ${duplicateArticleIds.length} topical duplicates.`, 'WARN');
            }
        }
        
        // Filter & Score
        const finalFilteredArticles = scoreAndFilterArticles(articlesToProcess, automationSettings);
        let articlesToPost = finalFilteredArticles.slice(0, automationSettings.postLimit);

        if (articlesToPost.length === 0) {
            logMessage("No relevant articles to post this cycle.", 'INFO');
            savePendingArticles(articlesToProcess); 
            return;
        }

        // Post
        let successfulPosts: PostedItem[] = [];
        let articlesPostedThisCycle: FetchedArticle[] = [];

        for (const article of articlesToPost) {
            setAutomationStatus(`Posting to r/${automationSettings.targetSubreddit}...`);
            try {
                const { url: postUrl } = await redditService.submitPost(
                    redditAuth.token, 
                    automationSettings.targetSubreddit, 
                    article.title, 
                    article.link,
                    automationSettings.defaultFlairId
                );
                logMessage(`Success! Posted "${article.title}".`, 'SUCCESS');
                
                successfulPosts.push({
                    id: article.link, url: article.link, title: article.title,
                    postedUrl: postUrl, postedAt: Date.now(),
                });
                articlesPostedThisCycle.push(article);

            } catch (postError) {
                const errorMsg = postError instanceof Error ? postError.message : 'Unknown error';
                logMessage(`Failed to post: ${errorMsg}`, 'ERROR');
                
                if (errorMsg.toLowerCase().includes('already been submitted')) {
                    successfulPosts.push({
                        id: article.link, url: article.link, title: article.title,
                        postedUrl: 'Duplicate', postedAt: Date.now(),
                    });
                    articlesPostedThisCycle.push(article);
                }
            }
        }

        if (articlesPostedThisCycle.length > 0) {
            currentHistory = [...successfulPosts, ...currentHistory];
            const postedLinks = new Set(articlesPostedThisCycle.map(a => normalizeUrl(a.link)));
            const newPending = articlesToProcess.filter(a => !postedLinks.has(normalizeUrl(a.link)));
            savePendingArticles(newPending);
            saveHistory(currentHistory);
        }
    }, [redditAuth, automationSettings, postingHistory, logMessage, pendingArticles, savePendingArticles, saveHistory, learnedBiases]);

    // Update Refs
    useEffect(() => { postCycleRef.current = runPostingCycle; }, [runPostingCycle]);
    useEffect(() => { fetchCycleRef.current = runFetchCycle; }, [runFetchCycle]);

    // ==========================================
    // Event Handlers
    // ==========================================

    const handleManualFetch = async () => {
        setIsFetchingManually(true);
        try { await runFetchCycle(); } 
        catch (e) { logMessage(`Manual fetch failed: ${e}`, 'ERROR'); } 
        finally { setIsFetchingManually(false); }
    };

    const handleToggleAutomation = () => {
        if (isAutomationRunning) {
            setIsAutomationRunning(false);
        } else {
             if (!redditAuth?.token || !automationSettings.targetSubreddit) {
                alert("Please login and set a subreddit first.");
                return;
            }
            setIsAutomationRunning(true);
        }
    };
    
    const handleLogin = async (creds: Omit<RedditAuth, 'token'>) => {
        if (!creds.password) throw new Error("Password required.");
        const token = await redditService.loginWithPasswordGrant(creds.clientId, creds.clientSecret, creds.username, creds.password);
        const authData = { ...creds, token };
        delete authData.password;
        localStorage.setItem('redditAuth', JSON.stringify(authData));
        setRedditAuth(authData);
        logMessage(`Logged in as u/${authData.username}.`, 'SUCCESS');
    };

    const handleLogout = () => {
        setIsAutomationRunning(false);
        localStorage.removeItem('redditAuth');
        setRedditAuth(null);
        logMessage("Logged out.", 'INFO');
    };

    const handleNavigate = (newView: 'dashboard' | 'settings') => {
        setView(newView);
        if (newView === 'dashboard') loadSettings();
    };

    const handleDetectFlairs = async (subreddit: string) => {
        if (!redditAuth?.token) throw new Error("Login required.");
        setIsDetectingFlairs(true);
        setFlairError(null);
        try {
            const flairs = await redditService.getLinkFlairs(redditAuth.token, subreddit);
            const newCache = { ...flairCache, [subreddit]: flairs };
            setFlairCache(newCache);
            localStorage.setItem('flairCache', JSON.stringify(newCache));
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error";
            setFlairError(msg);
            throw error;
        } finally {
            setIsDetectingFlairs(false);
        }
    };

    const handleRemoveArticleFromQueue = (articleId: string) => {
        const articleToRemove = pendingArticles.find(a => a.id === articleId);
        if (articleToRemove) {
            logMessage(`Removed "${articleToRemove.title}" from queue.`, 'WARN');
            const newPending = pendingArticles.filter(a => a.id !== articleId);
            savePendingArticles(newPending);

            const newRemovedUrls = new Set<string>(removedArticleUrls);
            newRemovedUrls.add(normalizeUrl(articleToRemove.link));
            saveRemovedUrls(newRemovedUrls);

            if (automationSettings.useAdaptiveLearning) {
                const keywords = extractSignificantKeywords(articleToRemove.title);
                // Explicitly type the new Map to avoid inference errors
                const newBiases = new Map<string, number>(learnedBiases);
                keywords.forEach(word => newBiases.set(word, (newBiases.get(word) || 0) - 1));
                saveLearnedBiases(newBiases);
                logMessage(`AI learned negative bias for: ${keywords.join(', ')}`, 'INFO');
            }
        }
    };

    const handleResetLearnedData = () => {
        setLearnedBiases(new Map());
        localStorage.removeItem('learnedBiases');
        logMessage("AI learned data reset.", 'SUCCESS');
    };

    const handleResetApp = () => {
        setIsAutomationRunning(false);
        localStorage.clear();
        window.location.reload();
    };

    // Automation Loop Effect
    useEffect(() => {
        if (!isAutomationRunning) return;

        logMessage("Automation started.", 'INFO');
        const postLoop = async () => {
            await postCycleRef.current();
            startCountdown(Date.now());
            intervalRef.current = window.setTimeout(postLoop, automationSettings.checkInterval * 60 * 1000);
        };
        
        postLoop();
        fetchCycleRef.current();
        fetchIntervalRef.current = window.setInterval(() => fetchCycleRef.current(), FETCH_INTERVAL_MINUTES * 60 * 1000);
        
        return () => {
            if (intervalRef.current) clearTimeout(intervalRef.current);
            if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            logMessage("Automation stopped.", 'INFO');
            setAutomationStatus('Idle');
        };
    }, [isAutomationRunning, automationSettings.checkInterval, logMessage, startCountdown]);

    return (
        <div className="min-h-screen">
            <Header onNavigate={handleNavigate} currentView={view} />
            <main className="container mx-auto p-4 sm:p-8">
                {view === 'dashboard' && (
                    <>
                        <NewsTicker headlines={tickerHeadlines} />
                        <Dashboard
                            isRunning={isAutomationRunning}
                            status={automationStatus}
                            logs={activityLog}
                            targetSubreddit={automationSettings.targetSubreddit}
                            onToggleAutomation={handleToggleAutomation}
                            isAuthenticated={!!redditAuth?.token}
                            pendingArticles={pendingArticles}
                            onManualFetch={handleManualFetch}
                            isFetching={isFetchingManually}
                            postingHistory={postingHistory}
                            onRemoveArticleFromQueue={handleRemoveArticleFromQueue}
                        />
                    </>
                )}
                {view === 'settings' && (
                    <SettingsPage 
                         redditAuth={redditAuth}
                         onLogin={handleLogin}
                         onLogout={handleLogout}
                         onNavigate={handleNavigate}
                         onDetectFlairs={handleDetectFlairs}
                         flairCache={flairCache}
                         isDetectingFlairs={isDetectingFlairs}
                         flairError={flairError}
                         automationSettings={automationSettings}
                         onSaveSettings={handleUpdateSettings}
                         onResetApp={handleResetApp}
                         onResetLearnedData={handleResetLearnedData}
                         learnedBiasCount={learnedBiases.size}
                    />
                )}
            </main>                 
            <footer className="text-center p-8 mt-8 text-sm" style={{color: 'var(--color-text-secondary)'}}>
                <p>Reddit News Bot</p>
            </footer>
        </div>
    );
};

export default App;