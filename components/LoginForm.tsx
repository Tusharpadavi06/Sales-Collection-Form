
import React, { useState, useMemo } from 'react';
import { ginzaLogoUrl } from '../assets/logo';
import { salesData } from '../data/branchData';

interface LoginFormProps {
  onLogin: (name: string, branch: string, contact: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const branches = useMemo(() => {
    const branchSet = new Set(salesData.map(item => item.branch));
    return Array.from(branchSet).sort();
  }, []);

  const usersForBranch = useMemo(() => {
    if (!selectedBranch) return [];
    return salesData
      .filter(item => item.branch === selectedBranch)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedBranch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedBranch || !selectedName) {
      setError('Please select your branch and name.');
      return;
    }

    // Universal password for all users
    if (password.toLowerCase() !== 'ginza123') {
      setError('Invalid password. Please use the universal password "ginza123".');
      return;
    }

    const userData = usersForBranch.find(u => u.name === selectedName);
    onLogin(selectedName, selectedBranch, userData?.contact || '');
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border-t-8 border-blue-600">
        <div className="flex flex-col items-center mb-8">
          <img src={ginzaLogoUrl} alt="Ginza Industries" className="h-16 w-auto mb-4" />
          <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Ginza Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Universal login for all sales staff</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-lg font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Branch Location</label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setSelectedName('');
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">-- Select Branch --</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Staff Member</label>
            <select
              value={selectedName}
              onChange={(e) => setSelectedName(e.target.value)}
              disabled={!selectedBranch}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
            >
              <option value="">-- Select Name --</option>
              {usersForBranch.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Security Key</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter 'ginza123'"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            <p className="text-[10px] text-blue-500 mt-2 font-bold text-center">Note: The password is "ginza123" for everyone.</p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95 mt-4"
          >
            Access Dashboard
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ginza Industries Limited © 2025</p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
