import React from 'react';
import type { FetchedArticle } from '../types';

interface ArticleQueueProps {
    articles: FetchedArticle[];
    onRemove: (articleId: string) => void;
}

const QueuedArticleCard: React.FC<{ article: FetchedArticle; onRemove: (id: string) => void }> = ({ article, onRemove }) => {
    return (
        <div 
            className="p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in"
            style={{backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)'}}
        >
            <div className="flex-grow overflow-hidden">
                 <p className='text-sm font-semibold' style={{color: 'var(--color-text-secondary)'}}>
                    {article.sourceName}
                 </p>
                <h3 className="font-semibold truncate" style={{color: 'var(--color-text-primary)'}} title={article.title}>
                    {article.title}
                </h3>
                 <p className="text-xs truncate" style={{color: 'var(--color-text-secondary)'}}>
                    {article.description}
                </p>
            </div>
            <div className="flex-shrink-0">
                <button 
                    onClick={() => onRemove(article.id)}
                    className="font-semibold text-sm transition-colors text-red-400/80 hover:text-red-400"
                    aria-label={`Remove ${article.title} from queue`}
                >
                    Remove
                </button>
            </div>
        </div>
    );
};

const ArticleQueue: React.FC<ArticleQueueProps> = ({ articles, onRemove }) => {
    return (
         <div className="border rounded-lg p-4 sm:p-6" style={{borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-1)'}}>
            <h2 className="text-xl font-bold font-display text-primary mb-4" style={{color: 'var(--color-text-primary)'}}>
                Article Queue ({articles.length})
            </h2>
             <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {articles.length > 0 ? (
                    articles.map(item => <QueuedArticleCard key={item.id} article={item} onRemove={onRemove} />)
                ) : (
                    <div className="text-center my-12">
                        <h3 className="text-2xl font-bold font-display">Queue is Empty</h3>
                        <p style={{color: 'var(--color-text-secondary)'}}>Use "Fetch Now" or start the bot to find new articles.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArticleQueue;