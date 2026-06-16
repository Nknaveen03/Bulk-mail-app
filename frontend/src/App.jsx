import React, { useState, useEffect } from 'react';
import { Send, History as HistoryIcon, LogOut, Mail, Lock, Loader2 } from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import History from './components/History';
import { API_URL } from './config';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' or 'history'

  useEffect(() => {
    // Check if token exists
    const verifyUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('username');
        }
      } catch (error) {
        console.error('Session validation error:', error);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser({ username: userData.username });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', background: '#0a0a0f' }}>
        <Loader2 size={40} className="animate-spin" style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: '#9ca3af', fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem' }}>Restoring AeroSend Session...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If not logged in, show Login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div>
      {/* Navigation Header */}
      <header className="navbar">
        <div className="logo-container">
          <div className="logo-icon">A</div>
          <span className="logo-text">AeroSend</span>
        </div>

        <div className="nav-links">
          <button
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Send size={16} />
            New Campaign
          </button>
          
          <button
            className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <HistoryIcon size={16} />
            History & Logs
          </button>

          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '1rem', padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
            Admin: <strong>{user.username}</strong>
          </span>

          <button onClick={handleLogout} className="nav-btn logout-btn">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container">
        {activeTab === 'dashboard' ? <Dashboard /> : <History />}
      </main>
    </div>
  );
}
