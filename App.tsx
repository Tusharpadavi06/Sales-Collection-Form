
import React, { useState, useEffect } from 'react';
import CollectionForm from './components/CollectionForm';
import LoginForm from './components/LoginForm';
import { ginzaLogoUrl } from './assets/logo';

const App: React.FC = () => {
  const [user, setUser] = useState<{ name: string; branch: string; contact: string } | null>(() => {
    const saved = localStorage.getItem('ginza_auth');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (name: string, branch: string, contact: string) => {
    const userData = { name, branch, contact };
    setUser(userData);
    localStorage.setItem('ginza_auth', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('ginza_auth');
  };

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-gray-800 font-sans">
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={ginzaLogoUrl} alt="Ginza Industries Logo" className="h-10 w-auto" />
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-[#1f2937]">Ginza Industries Ltd.</h1>
              <p className="text-xs text-gray-400">Sales Collection Form</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-800">{user.name}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{user.branch} {user.contact ? `• ${user.contact}` : ''}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="text-xs font-bold text-red-500 hover:text-red-700 border border-red-100 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 max-w-6xl py-10">
        <CollectionForm currentUser={user} />
      </main>
    </div>
  );
};

export default App;
