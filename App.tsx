
import React from 'react';
import CollectionForm from './components/CollectionForm';
import { ginzaLogoBase64 } from './assets/logo';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      <header className="bg-white shadow-lg sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={ginzaLogoBase64} alt="Ginza Industries Logo" className="h-12 w-auto" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">Ginza Industries Ltd.</h1>
              <p className="text-sm text-gray-500">Sales Collection Form</p>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CollectionForm />
      </main>
      <footer className="text-center py-6 text-gray-500 text-sm bg-white border-t mt-8">
        <p>&copy; {new Date().getFullYear()} Ginza Industries Limited. All Rights Reserved.</p>
      </footer>
    </div>
  );
};

export default App;
