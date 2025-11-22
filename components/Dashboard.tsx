import React from 'react';
import type { LogEntry, PostedItem, FetchedArticle } from '../types';
import ArticleQueue from './ArticleQueue';

interface DashboardProps {
    isRunning: boolean;
    status: string;
    logs: LogEntry[];
    targetSubreddit: string;
    onToggleAutomation: () => void;
    isAuthenticated: boolean;
    pendingArticles: FetchedArticle[];
    onManualFetch: () => void;
    isFetching: boolean;
    postingHistory: PostedItem[];
    onRemoveArticleFromQueue: (articleId: string) => void;
}

const LogDisplay: React.FC<{ log: LogEntry }> = React.memo(({ log }) => {
    let levelColor = 'var(--color-text-secondary)';
    switch (log.level) {
        case 'SUCCESS': levelColor = '#34D399'; break; // green-400
        case 'ERROR': levelColor = '#F87171'; break; // red-400
        case 'WARN': levelColor = '#FBBF24'; break; // amber-400
    }

    return (
        <div className="flex gap-x-3 whitespace-pre-wrap animate-fade-in">
            <span className="opacity-60">{log.timestamp}</span>
            <span className="font-bold" style={{ color: levelColor }}>[{log.level}]</span>
            <p className="flex-1">{log.message}</p>
        </div>
    );
});

const PostedItemCard: React.FC<{ item: PostedItem; }> = ({ item }) => {
    return (
        <div 
            className="p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in"
            style={{backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)'}}
        >
            <div className="flex-grow overflow-hidden">
                 <p className='text-sm' style={{color: 'var(--color-text-secondary)'}}>
                    {new Date(item.postedAt).toLocaleString()}
                 </p>
                <h3 className="font-semibold truncate" style={{color: 'var(--color-text-primary)'}} title={item.title}>
                    {item.title}
                </h3>
                 <a href={item.postedUrl} target="_blank" rel="noopener noreferrer" className="text-xs truncate hover:text-accent" style={{color: 'var(--color-text-secondary)'}}>
                    View on Reddit
                </a>
            </div>
            <div className="flex-shrink-0">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm transition-colors hover:text-accent" style={{color: 'var(--color-text-secondary)'}}>
                    Source
                </a>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({
    isRunning, status, logs, targetSubreddit, onToggleAutomation,
    isAuthenticated, pendingArticles, onManualFetch, isFetching, postingHistory,
    onRemoveArticleFromQueue
}) => {
    const statusColor = isRunning ? 'var(--color-accent)' : 'var(--color-text-secondary)';

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Control Panel and Status */}
            <div className="border rounded-lg p-4 sm:p-6 shadow-md" style={{borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-1)'}}>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-primary font-display" style={{color: 'var(--color-text-primary)'}}>Bot Dashboard</h2>
                        <p className="text-sm text-secondary mt-1 flex flex-wrap items-center gap-x-2" style={{color: 'var(--color-text-secondary)'}}>
                            <span>Status: <span className="font-semibold" style={{color: statusColor}}>{status}</span></span>
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <button
                            onClick={onManualFetch}
                            disabled={isFetching}
                             className="px-6 py-3 font-bold uppercase tracking-wider text-sm rounded-md transition-all duration-300 w-full sm:w-auto border"
                             style={{borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)'}}
                        >
                            {isFetching ? 'Fetching...' : 'Fetch Now'}
                        </button>
                        <button
                            onClick={onToggleAutomation}
                            disabled={!isAuthenticated}
                            className={`px-6 py-3 font-bold uppercase tracking-wider text-sm rounded-md transition-all duration-300 w-full sm:w-auto border disabled:opacity-50 disabled:cursor-not-allowed ${
                                isRunning ? 'border-red-500/50 text-red-400 hover:bg-red-500/10' : 'border-accent text-accent hover:bg-accent hover:text-background'
                            }`}
                        >
                            {isRunning ? 'Stop Bot' : 'Start Bot'}
                        </button>
                    </div>
                </div>
                {!isAuthenticated && (
                    <p className="text-center text-sm bg-amber-900/20 border rounded-md p-3 mt-4" style={{borderColor: 'rgba(210, 153, 34, 0.2)', backgroundColor: 'rgba(210, 153, 34, 0.05)', color: 'var(--color-accent)'}}>
                        Please log in via <strong>Settings</strong> to enable the bot.
                    </p>
                )}
            </div>
            
            {/* Stats and Activity Log */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-8">
                    {/* Stats Widget */}
                    <div className="border rounded-lg p-4 sm:p-6 h-full" style={{borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-1)'}}>
                        <h3 className="text-xl font-bold font-display text-primary mb-4 pb-2 border-b" style={{borderColor: 'var(--color-border)'}}>Statistics</h3>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between items-center">
                                <span style={{color: 'var(--color-text-secondary)'}}>Posting To</span>
                                <span className="font-semibold" style={{color: targetSubreddit ? 'var(--color-accent)' : 'var(--color-text-secondary)'}}>
                                    {targetSubreddit ? `r/${targetSubreddit}` : 'Not Set'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span style={{color: 'var(--color-text-secondary)'}}>Articles in Queue</span>
                                <span className="font-mono font-bold text-lg">{pendingArticles.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span style={{color: 'var(--color-text-secondary)'}}>Total Posts</span>
                                <span className="font-mono font-bold text-lg">{postingHistory.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    {/* Activity Log */}
                    <div className="border rounded-lg p-4 sm:p-6" style={{borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-1)'}}>
                        <h3 className="text-xl font-bold font-display text-primary mb-4" style={{color: 'var(--color-text-primary)'}}>Activity Log</h3>
                        <div className="border rounded-md p-3 h-64 overflow-y-auto font-mono text-xs space-y-2" style={{borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-background)'}}>
                            {logs.length > 0 ? logs.map((log, index) => (
                                <LogDisplay key={`${log.timestamp}-${index}`} log={log} />
                            )) : <p className="p-4 text-center">System idle. Start the bot to see activity.</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Article Queue */}
            <div>
                 <ArticleQueue articles={pendingArticles} onRemove={onRemoveArticleFromQueue} />
            </div>

            {/* Posting History */}
            <div>
                 <div className="border rounded-lg p-4 sm:p-6" style={{borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-1)'}}>
                    <h2 className="text-xl font-bold font-display text-primary mb-4" style={{color: 'var(--color-text-primary)'}}>
                        Posting History
                    </h2>
                     <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {postingHistory.length > 0 ? (
                            postingHistory.map(item => <PostedItemCard key={item.id} item={item} />)
                        ) : (
                            <div className="text-center my-12">
                                <h3 className="text-2xl font-bold font-display">No Posts Yet</h3>
                                <p style={{color: 'var(--color-text-secondary)'}}>Start the bot to begin posting. History will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;