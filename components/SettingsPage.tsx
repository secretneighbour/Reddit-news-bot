import React, { useState, useEffect } from 'react';
import type { RedditAuth, Flair, AutomationSettings } from '../types';
import * as redditService from '../services/redditService';

interface SettingsPageProps {
    redditAuth: RedditAuth | null;
    onLogin: (creds: Omit<RedditAuth, 'token'>) => Promise<void>;
    onLogout: () => void;
    onNavigate: (view: 'dashboard') => void;
    onDetectFlairs: (subreddit: string) => Promise<void>;
    flairCache: Record<string, Flair[]>;
    isDetectingFlairs: boolean;
    flairError: string | null;
    automationSettings: AutomationSettings;
    onSaveSettings: (settings: AutomationSettings) => void;
    onResetApp: () => void;
    onResetLearnedData?: () => void;
    learnedBiasCount?: number;
}

const FlairChip: React.FC<{flair: Flair}> = ({ flair }) => {
    const isLight = flair.text_color === 'light';
    const textColor = isLight ? '#FFFFFF' : '#000000';
    const backgroundColor = flair.background_color || 'transparent';
    const borderColor = isLight ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';

    return (
        <span 
            className="px-2 py-1 text-xs font-semibold rounded"
            style={{
                color: textColor,
                backgroundColor: backgroundColor,
                border: `1px solid ${borderColor}`
            }}
        >
            {flair.text}
        </span>
    );
};

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    return (
        <details className="border-b" style={{borderColor: 'var(--color-border)'}} open>
            <summary className="cursor-pointer py-4 list-none flex justify-between items-center">
                <h3 className="text-2xl font-semibold text-primary font-display" style={{color: 'var(--color-text-primary)'}}>{title}</h3>
                <svg className="w-5 h-5 transition-transform transform details-arrow" style={{color: 'var(--color-text-secondary)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <style>{`details[open] .details-arrow { transform: rotate(180deg); }`}</style>
            </summary>
            <div className="pb-8 pt-4">
                {children}
            </div>
        </details>
    );
};


const SettingsPage: React.FC<SettingsPageProps> = ({ 
    redditAuth, 
    onLogin, 
    onLogout, 
    onNavigate,
    onDetectFlairs,
    flairCache,
    isDetectingFlairs,
    flairError,
    automationSettings,
    onSaveSettings,
    onResetApp,
    onResetLearnedData,
    learnedBiasCount = 0
}) => {
    const [localSettings, setLocalSettings] = useState<AutomationSettings>(automationSettings);
    const [settingsSaved, setSettingsSaved] = useState(false);
    
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isTestingCreds, setIsTestingCreds] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [testMessage, setTestMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    const [validationStatus, setValidationStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string | null }>({ type: 'idle', message: null });


    const detectedFlairs = flairCache[localSettings.targetSubreddit.trim().replace(/^r\//i, '').replace(/\/$/, '')] || [];

    useEffect(() => {
        setLocalSettings(automationSettings);
        if (redditAuth) {
            setClientId(redditAuth.clientId);
            setClientSecret(redditAuth.clientSecret);
            setUsername(redditAuth.username);
        }
    }, [redditAuth, automationSettings]);

    const handleSaveSettings = () => {
        onSaveSettings(localSettings);
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
    };

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (name === 'targetSubreddit') {
            setValidationStatus({ type: 'idle', message: null });
        }

        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setLocalSettings(prev => ({ ...prev, [name]: checked }));
        } else {
            setLocalSettings(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleTestCredentials = async () => {
        setIsTestingCreds(true);
        setTestMessage(null);
        try {
            await redditService.verifyCredentials(clientId, clientSecret, username, password);
            setTestMessage({type: 'success', text: 'Credentials are valid!'});
        } catch (error) {
            setTestMessage({type: 'error', text: error instanceof Error ? error.message : 'An unknown error occurred.'});
        } finally {
            setIsTestingCreds(false);
        }
    }

    const handleLoginAttempt = async () => {
        setLoginError(null);
        setIsLoggingIn(true);
        try {
            await onLogin({ clientId, clientSecret, username, password });
            setPassword('');
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : "An unknown login error occurred.");
        } finally {
            setIsLoggingIn(false);
        }
    };
    
    const handleValidateSubreddit = async () => {
        if (!localSettings.targetSubreddit.trim() || !redditAuth?.token) return;
        setValidationStatus({ type: 'loading', message: 'Validating...' });
        try {
            const result = await redditService.validateSubreddit(redditAuth.token, localSettings.targetSubreddit);
            setValidationStatus({ type: 'success', message: result.message });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Validation failed.';
            setValidationStatus({ type: 'error', message });
        }
    };
    
    const handleResetApp = () => {
        if (window.confirm("Are you sure you want to reset the application? All settings, credentials, and history will be permanently deleted.")) {
            onResetApp();
        }
    };
    
    const handleResetLearnedDataClick = () => {
        if (window.confirm("Reset all learned biases? The bot will forget which topics you disliked.")) {
            onResetLearnedData?.();
        }
    };

    const inputStyle = "w-full bg-transparent border-0 border-b-2 text-primary focus:ring-0 focus:border-accent transition duration-300";
    const textareaStyle = "w-full bg-transparent border-2 text-primary focus:ring-accent focus:border-accent transition duration-300 rounded-md p-2";
    const primaryButtonStyle = "px-6 py-3 font-bold uppercase tracking-wider text-sm rounded-md transition-all duration-300 border border-accent text-accent hover:bg-accent hover:text-background disabled:opacity-50 disabled:cursor-not-allowed";
    
    const handleDetectFlairsClick = () => {
        if (localSettings.targetSubreddit.trim()) {
            onDetectFlairs(localSettings.targetSubreddit.trim()).catch(() => {});
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in p-4 md:p-8 rounded-lg" style={{backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)'}}>
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold text-primary font-display" style={{color: 'var(--color-text-primary)'}}>Settings</h2>
                <button 
                    onClick={() => onNavigate('dashboard')}
                    className="font-semibold text-sm uppercase tracking-wider text-secondary transition-colors hover:text-accent" style={{color: 'var(--color-text-secondary)'}}
                >
                    Back to Dashboard
                </button>
            </div>
            <div className="space-y-4">
                
                <SettingsSection title="Reddit Credentials">
                     <div className="border rounded-md p-3 text-sm mb-6" style={{borderColor: 'rgba(210, 153, 34, 0.2)', backgroundColor: 'rgba(210, 153, 34, 0.05)', color: 'var(--color-accent)'}}>
                        <strong>Security Notice:</strong> Credentials are saved in your browser's local storage. Intended for personal use on non-shared computers only.
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div>
                            <label htmlFor="clientId" className="block text-sm font-medium text-secondary mb-1" style={{color: 'var(--color-text-secondary)'}}>Client ID</label>
                            <input type="text" id="clientId" value={clientId} onChange={e => setClientId(e.target.value)} className={inputStyle} style={{borderColor: 'var(--color-border)'}}/>
                        </div>
                         <div>
                            <label htmlFor="clientSecret" className="block text-sm font-medium text-secondary mb-1" style={{color: 'var(--color-text-secondary)'}}>Client Secret</label>
                            <input type="password" id="clientSecret" value={clientSecret} onChange={e => setClientSecret(e.target.value)} className={inputStyle} style={{borderColor: 'var(--color-border)'}}/>
                        </div>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-secondary mb-1" style={{color: 'var(--color-text-secondary)'}}>Reddit Username</label>
                            <input type="text" id="username" value={username} onChange={e => setUsername(e.target.value)} className={inputStyle} style={{borderColor: 'var(--color-border)'}}/>
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-secondary mb-1" style={{color: 'var(--color-text-secondary)'}}>Reddit Password</label>
                            <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={redditAuth?.token ? "Leave blank to keep current login" : ""} className={inputStyle} style={{borderColor: 'var(--color-border)'}}/>
                        </div>
                     </div>
                     <div className="text-sm text-secondary p-4 mt-6 border rounded-md" style={{color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)'}}>
                            <h4 className="font-semibold text-primary mb-2" style={{color: 'var(--color-text-primary)'}}>How to get credentials:</h4>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Go to <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noreferrer" className="underline hover:text-accent" style={{color: 'var(--color-accent)'}}>Reddit Apps</a>.</li>
                                <li>Click "create another app...".</li>
                                <li>Choose a name, select <strong>"script"</strong> for the app type.</li>
                                <li>Set `redirect uri` to any URL (e.g., http://localhost).</li>
                                <li>Click "create app". Your Client ID is under the app name. Your Client Secret is labeled "secret".</li>
                            </ol>
                        </div>
                        {testMessage && <p className={`text-sm text-center mt-4 ${testMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{testMessage.text}</p>}
                        {loginError && <p className="text-sm text-center mt-4 text-red-400" >{loginError}</p>}
                        {redditAuth?.token && !loginError && <p className="text-sm text-center mt-4 text-green-400">Successfully authenticated as u/{redditAuth.username}.</p>}
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-4 pt-6">
                            <button onClick={onLogout} disabled={!redditAuth} className="font-semibold text-sm uppercase tracking-wider text-secondary transition-colors hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed" style={{color: 'var(--color-text-secondary)'}}>Logout</button>
                            <button onClick={handleTestCredentials} disabled={isTestingCreds} className="px-6 py-3 font-bold uppercase tracking-wider text-sm rounded-md transition-all duration-300 border border-secondary text-secondary hover:bg-secondary hover:text-background disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto">
                                {isTestingCreds ? 'Testing...' : 'Test Credentials'}
                            </button>
                            <button onClick={handleLoginAttempt} disabled={isLoggingIn} className={`${primaryButtonStyle} w-full sm:w-auto`}>
                                {isLoggingIn ? 'Verifying...' : 'Save & Verify Login'}
                            </button>
                        </div>
                </SettingsSection>

                <SettingsSection title="Automation">
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                        <div className="md:col-span-2">
                             <label htmlFor="targetSubreddit" className="block text-sm font-medium text-secondary mb-1" style={{color: 'var(--color-text-secondary)'}}>
                                Target Subreddit (e.g., gamingnews or r/gamingnews)
                            </label>
                            <div className="flex items-end gap-2">
                                <input
                                    type="text"
                                    id="targetSubreddit"
                                    name="targetSubreddit"
                                    value={localSettings.targetSubreddit}
                                    onChange={handleSettingsChange}
                                    placeholder="gamingnews"
                                    className={inputStyle}
                                    style={{borderColor: 'var(--color-border)'}}
                                />
                                 <button 
                                    onClick={handleValidateSubreddit}
                                    disabled={validationStatus.type === 'loading' || !localSettings.targetSubreddit.trim() || !redditAuth}
                                    className="px-4 py-2 text-sm font-semibold rounded-md transition-colors border text-secondary hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    style={{borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)'}}
                                >
                                    {validationStatus.type === 'loading' ? "Validating..." : "Validate"}
                                </button>
                                <button 
                                    onClick={handleDetectFlairsClick}
                                    disabled={isDetectingFlairs || !localSettings.targetSubreddit.trim() || !redditAuth}
                                    className="px-4 py-2 text-sm font-semibold rounded-md transition-colors border text-secondary hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    style={{borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)'}}
                                >
                                    {isDetectingFlairs ? "Detecting..." : "Detect Flairs"}
                                </button>
                            </div>
                            <div className="mt-2 text-xs h-4">
                                {validationStatus.type !== 'idle' && (
                                     <p className={`
                                        ${validationStatus.type === 'success' ? 'text-green-400' : ''}
                                        ${validationStatus.type === 'error' ? 'text-red-400' : ''}
                                        ${validationStatus.type === 'loading' ? 'text-secondary' : ''}
                                     `}>
                                        {validationStatus.message}
                                     </p>
                                )}
                            </div>
                            {!redditAuth && <p className="text-xs mt-2" style={{color: 'var(--color-text-secondary)'}}>Login required to validate subreddit or detect flairs.</p>}
                            <div className="mt-4">
                                {flairError && <p className="text-sm" style={{color: 'var(--color-accent)'}}>Error detecting flairs: {flairError}</p>}
                                {detectedFlairs.length > 0 && (
                                    <div className="border rounded-md p-3 space-y-2" style={{borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)'}}>
                                        <p className="text-sm font-semibold mb-2" style={{color: 'var(--color-text-primary)'}}>Detected Flairs:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {detectedFlairs.map(flair => <FlairChip key={flair.id} flair={flair} />)}
                                        </div>
                                         <div className="pt-4 mt-4 border-t" style={{borderColor: 'var(--color-border)'}}>
                                                <label htmlFor="defaultFlairId" className="block text-sm font-medium text-secondary mb-1" style={{color: 'var(--color-text-secondary)'}}>
                                                    Default Flair for All Posts
                                                </label>
                                                <select 
                                                    id="defaultFlairId"
                                                    name="defaultFlairId"
                                                    value={localSettings.defaultFlairId}
                                                    onChange={handleSettingsChange}
                                                    className="w-full bg-transparent border-2 rounded-md p-2 focus:ring-accent focus:border-accent transition duration-300"
                                                    style={{borderColor: 'var(--color-border)', color: 'var(--color-text-primary)'}}
                                                >
                                                    <option value="" style={{backgroundColor: 'var(--color-background)'}}>-- No Flair --</option>
                                                    {detectedFlairs.map(flair => (
                                                        <option key={flair.id} value={flair.id} style={{backgroundColor: 'var(--color-background)'}}>{flair.text}</option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-secondary mt-1" style={{color: 'var(--color-text-secondary)'}}>This flair will be used for all posts from the queue.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="checkInterval" className="block text-sm font-medium text-secondary mb-1" style={{color: 'var(--color-text-secondary)'}}>
                                Post Interval (min)
                            </label>
                            <input
                                type="number"
                                id="checkInterval"
                                name="checkInterval"
                                value={localSettings.checkInterval}
                                min="1"
                                onChange={handleSettingsChange}
                                className={inputStyle}
                                style={{borderColor: 'var(--color-border)'}}
                            />
                        </div>
                        <div>
                            <label htmlFor="postLimit" className="block text-sm font-medium text-secondary mb-1" style={{color: 'var(--color-text-secondary)'}}>
                                Post Limit Per Cycle
                            </label>
                            <input
                                type="number"
                                id="postLimit"
                                name="postLimit"
                                value={localSettings.postLimit}
                                min="1"
                                onChange={handleSettingsChange}
                                className={inputStyle}
                                style={{borderColor: 'var(--color-border)'}}
                            />
                        </div>
                        <div className="md:col-span-2">
                             <div className="flex items-center gap-3 mt-4">
                                 <input
                                    type="checkbox"
                                    id="useProactiveDuplicateCheck"
                                    name="useProactiveDuplicateCheck"
                                    checked={localSettings.useProactiveDuplicateCheck}
                                    onChange={handleSettingsChange}
                                    className="h-5 w-5 rounded bg-transparent text-accent focus:ring-accent border-2"
                                    style={{borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-1)'}}
                                  />
                                <label htmlFor="useProactiveDuplicateCheck" className="font-medium text-primary" style={{color: 'var(--color-text-primary)'}}>
                                    Enable Smart Duplicate Check
                                </label>
                            </div>
                             <p className="text-sm text-secondary mt-2 pl-8" style={{color: 'var(--color-text-secondary)'}}>
                                Uses a fast, local algorithm to semantically compare new articles against your post history to find topical duplicates, even if headlines are different. This does not use an external API.
                            </p>
                        </div>
                         <div className="md:col-span-2">
                            <label htmlFor="rssFeedUrls" className="block text-sm font-medium text-secondary mb-1" style={{color: 'var(--color-text-secondary)'}}>
                                Custom RSS Feed URLs (one per line)
                            </label>
                             <p className="text-xs text-secondary mt-1 mb-2" style={{color: 'var(--color-text-secondary)'}}>
                                <strong>Note:</strong> Presets for IGN, GameSpot, Game Informer, DualShockers, VGC, and PC Gamer are now built-in. Use this field for other custom news sources.
                             </p>
                            <textarea
                                id="rssFeedUrls"
                                name="rssFeedUrls"
                                value={localSettings.rssFeedUrls}
                                onChange={handleSettingsChange}
                                rows={4}
                                placeholder="Correct: https://www.pcgamer.com/rss/&#10;Incorrect: https://www.pcgamer.com/"
                                className={textareaStyle}
                                style={{borderColor: 'var(--color-border)'}}
                            />
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection title="Advanced Filtering (Local AI)">
                    <div className="space-y-6">
                        <div className="border rounded-md p-3 text-sm" style={{borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)'}}>
                           The bot uses a scoring system to determine an article's relevance. Each article starts with <strong>0 points</strong>.
                           <ol className="list-decimal list-inside mt-2 pl-2 space-y-1">
                               <li>Keywords from the <strong>Inclusion</strong> list <strong>add points</strong>.</li>
                               <li>Keywords from the <strong>Exclusion</strong> list <strong>subtract points</strong>.</li>
                               <li className="pl-2 border-l-2" style={{borderColor: 'var(--color-accent)'}}>
                                  <strong className="text-accent">Automatic Bonus:</strong> Positive keywords found in an article's <strong className="font-semibold">title</strong> get a <strong className="font-semibold">50% score bonus</strong>.
                               </li>
                               <li className="pl-2 border-l-2" style={{borderColor: 'var(--color-accent)'}}>
                                  <strong className="text-accent">Recency Boost:</strong> Articles get up to <strong>+5 points</strong> for being less than 12 hours old.
                               </li>
                                <li className="pl-2 border-l-2" style={{borderColor: 'var(--color-accent)'}}>
                                  <strong className="text-accent">Source Authority:</strong> Articles gain or lose points based on your trusted domains list.
                               </li>
                               <li>An article is posted only if its final score meets the <strong>Minimum Score to Post</strong>.</li>
                           </ol>
                        </div>

                         <div>
                            <label htmlFor="minimumScore" className="block text-sm font-medium text-primary mb-1" style={{color: 'var(--color-text-primary)'}}>
                                Minimum Score to Post
                            </label>
                             <input
                                type="number"
                                id="minimumScore"
                                name="minimumScore"
                                value={localSettings.minimumScore}
                                onChange={handleSettingsChange}
                                className={inputStyle}
                                style={{borderColor: 'var(--color-border)', width: '120px'}}
                            />
                             <p className="text-xs text-secondary mt-2" style={{color: 'var(--color-text-secondary)'}}>
                                Articles must score at least this high to be considered for posting.
                             </p>
                        </div>

                        <div>
                            <label htmlFor="includeKeywords" className="block text-sm font-medium text-primary mb-1" style={{color: 'var(--color-text-primary)'}}>
                                Inclusion Keywords & Scores
                            </label>
                             <p className="text-xs text-secondary mb-2" style={{color: 'var(--color-text-secondary)'}}>
                                One per line. Use `keyword: score` format. If no score is provided, it defaults to 1.
                             </p>
                            <textarea
                                id="includeKeywords"
                                name="includeKeywords"
                                value={localSettings.includeKeywords}
                                onChange={handleSettingsChange}
                                rows={4}
                                placeholder="e.g.&#10;release date: 10&#10;announced: 8&#10;update: 5&#10;patch"
                                className={textareaStyle}
                                style={{borderColor: 'var(--color-border)'}}
                            />
                        </div>
                         <div>
                            <label htmlFor="excludeKeywords" className="block text-sm font-medium text-primary mb-1" style={{color: 'var(--color-text-primary)'}}>
                                Exclusion Keywords & Scores
                            </label>
                             <p className="text-xs text-secondary mb-2" style={{color: 'var(--color-text-secondary)'}}>
                                Scores here will be subtracted. `deal: 10` will subtract 10 points.
                             </p>
                            <textarea
                                id="excludeKeywords"
                                name="excludeKeywords"
                                value={localSettings.excludeKeywords}
                                onChange={handleSettingsChange}
                                rows={4}
                                placeholder="e.g.&#10;deal: 10&#10;sale: 10&#10;guide: 5&#10;rumor"
                                className={textareaStyle}
                                style={{borderColor: 'var(--color-border)'}}
                            />
                        </div>
                        
                        <div>
                            <label htmlFor="sourceAuthorityScores" className="block text-sm font-medium text-primary mb-1" style={{color: 'var(--color-text-primary)'}}>
                                Source Authority & Scores
                            </label>
                             <p className="text-xs text-secondary mb-2" style={{color: 'var(--color-text-secondary)'}}>
                                Assign scores to specific domains. Useful for prioritizing trusted sources or penalizing clickbait.
                             </p>
                            <textarea
                                id="sourceAuthorityScores"
                                name="sourceAuthorityScores"
                                value={localSettings.sourceAuthorityScores}
                                onChange={handleSettingsChange}
                                rows={4}
                                placeholder="e.g.&#10;ign.com: 5&#10;reuters.com: 3&#10;clickbait-site.com: -10"
                                className={textareaStyle}
                                style={{borderColor: 'var(--color-border)'}}
                            />
                        </div>
                    </div>
                </SettingsSection>
                
                <SettingsSection title="AI Learning">
                    <div className="space-y-4">
                         <div className="flex items-center gap-3">
                                 <input
                                    type="checkbox"
                                    id="useAdaptiveLearning"
                                    name="useAdaptiveLearning"
                                    checked={localSettings.useAdaptiveLearning}
                                    onChange={handleSettingsChange}
                                    className="h-5 w-5 rounded bg-transparent text-accent focus:ring-accent border-2"
                                    style={{borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-1)'}}
                                  />
                                <label htmlFor="useAdaptiveLearning" className="font-medium text-primary" style={{color: 'var(--color-text-primary)'}}>
                                    Enable Adaptive Learning
                                </label>
                        </div>
                         <div className="text-sm text-secondary" style={{color: 'var(--color-text-secondary)'}}>
                           When enabled, the bot learns from your actions. If you manually remove an article from the queue, the bot will identify the key topics in that article's title and apply a negative bias (-1 score) to them in the future.
                        </div>
                         <div className="flex justify-between items-center border rounded-md p-3" style={{borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)'}}>
                             <div>
                                <span className="text-sm font-semibold" style={{color: 'var(--color-text-primary)'}}>Learned Biases:</span>
                                <span className="text-sm ml-2 font-mono" style={{color: 'var(--color-accent)'}}>{learnedBiasCount} items</span>
                             </div>
                             <button 
                                onClick={onResetLearnedData}
                                disabled={learnedBiasCount === 0}
                                className="px-3 py-1 text-xs font-semibold rounded-md transition-colors border text-secondary hover:border-red-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{borderColor: 'var(--color-border)'}}
                             >
                                Reset Memory
                             </button>
                        </div>
                    </div>
                </SettingsSection>
                
                <SettingsSection title="Danger Zone">
                    <div className="border border-red-500/50 rounded-lg p-4 bg-red-900/10">
                        <h4 className="text-xl font-bold font-display text-red-400">Reset Application</h4>
                        <p className="text-sm text-red-400/80 mt-2 mb-4">
                            This will permanently delete all your stored data, including credentials, settings, posting history, and the article queue. This action cannot be undone.
                        </p>
                        <button 
                            onClick={handleResetApp}
                            className="px-6 py-3 font-bold uppercase tracking-wider text-sm rounded-md transition-all duration-300 border border-red-500/50 text-red-400 hover:bg-red-500/20"
                        >
                            Reset Application
                        </button>
                    </div>
                </SettingsSection>


                 <div className="pt-6 flex justify-end items-center gap-4 mt-8 border-t" style={{borderColor: 'var(--color-border)'}}>
                        {settingsSaved && <p className="text-sm text-green-400 animate-fade-in">Settings Saved</p>}
                        <button 
                            onClick={handleSaveSettings}
                            className={primaryButtonStyle}
                        >
                            Save All Settings
                        </button>
                    </div>
            </div>
        </div>
    );
};

export default SettingsPage;