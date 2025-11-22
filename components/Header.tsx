import React from 'react';

interface HeaderProps {
    onNavigate: (view: 'dashboard' | 'settings') => void;
    currentView: 'dashboard' | 'settings';
}

const Header: React.FC<HeaderProps> = ({ onNavigate, currentView }) => {
    
    const navButtonStyle = "p-2 transition-colors duration-300 focus:outline-none focus:text-accent";

    return (
        <header className="sticky top-0 z-20 p-4 sm:p-6 border-b" style={{backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)'}}>
            <div className="container mx-auto flex justify-between items-center">
                <button onClick={() => onNavigate('dashboard')} className="group">
                    <h1 className="text-2xl sm:text-3xl font-bold text-primary font-display" style={{color: 'var(--color-text-primary)'}}>
                       Reddit News Bot
                    </h1>
                    <h2>Made by Mukul/Secret</h2> 
                </button>
                <div className="flex items-center gap-4 sm:gap-6">
                     <button
                        onClick={() => onNavigate('settings')}
                        className={`${navButtonStyle} ${currentView === 'settings' ? 'text-accent' : 'text-secondary'} hover:text-accent`}
                        aria-label="Open settings"
                        style={{color: currentView === 'settings' ? 'var(--color-accent)' : 'var(--color-text-secondary)'}}
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;