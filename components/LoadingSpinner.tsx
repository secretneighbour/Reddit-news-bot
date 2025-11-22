import React from 'react';

const LoadingSpinner: React.FC = () => {
    return (
        <div className="flex flex-col justify-center items-center h-full my-24">
             <div
                className="w-16 h-16 border-4 rounded-full animate-spin"
                style={{
                    borderColor: 'var(--color-border)',
                    borderTopColor: 'var(--color-accent)'
                }}
            ></div>
            <p className="text-secondary mt-6 text-lg font-display" style={{color: 'var(--color-text-secondary)'}}>
                Fetching Articles...
            </p>
        </div>
    );
};

export default LoadingSpinner;
