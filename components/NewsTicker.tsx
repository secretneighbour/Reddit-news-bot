import React from 'react';
import type { FetchedArticle } from '../types';

interface NewsTickerProps {
    headlines: FetchedArticle[];
}

const NewsTicker: React.FC<NewsTickerProps> = ({ headlines }) => {
    if (headlines.length === 0) {
        return null; // Don't render if there are no headlines
    }

    // Duplicate the headlines to create a seamless looping effect
    const tickerContent = [...headlines, ...headlines].map((headline, index) => (
        <a 
            key={`${headline.id}-${index}`}
            href={headline.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block px-8 text-sm font-semibold transition-colors duration-300"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--color-accent)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            title={headline.title}
        >
            {headline.title}
        </a>
    ));

    return (
        <div 
            className="w-full overflow-hidden rounded-lg mb-8 animate-fade-in"
            style={{
                backgroundColor: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                padding: '0.75rem 0'
            }}
        >
            <div className="whitespace-nowrap ticker-wrapper">
                <div 
                    className="inline-block"
                    style={{ animation: `ticker-scroll ${headlines.length * 4}s linear infinite` }}
                >
                    {tickerContent}
                </div>
            </div>
        </div>
    );
};

export default NewsTicker;
