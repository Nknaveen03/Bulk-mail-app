import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings, Mail, Users, Terminal, CheckCircle2, AlertTriangle, Play, Sparkles } from 'lucide-react';
import { API_URL } from '../config';

export default function Dashboard() {
  // Form State
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState('');
  
  // SMTP Configuration State
  const [useCustomSmtp, setUseCustomSmtp] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: '587',
    secure: false,
    user: '',
    pass: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Campaign progress tracking
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [progress, setProgress] = useState({
    total: 0,
    successCount: 0,
    failureCount: 0,
    status: 'pending',
  });
  const [logs, setLogs] = useState([]);
  
  const logEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Auto scroll logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Clean up poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const addLog = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, text, type }]);
  };

  const handleSmtpChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSmtpConfig((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = () => {
    if (!subject.trim()) {
      setError('Email subject is required');
      return false;
    }
    if (!body.trim()) {
      setError('Email body is required');
      return false;
    }
    if (!recipients.trim()) {
      setError('Recipient email addresses are required');
      return false;
    }

    if (useCustomSmtp) {
      if (!smtpConfig.host.trim() || !smtpConfig.user.trim() || !smtpConfig.pass.trim()) {
        setError('Please fill in all SMTP fields or disable custom SMTP to use Auto-test mode');
        return false;
      }
    }

    setError('');
    return true;
  };

  // Poll campaign status from server
  const startPollingStatus = (campaignId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/mail/status/${campaignId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Failed to fetch status');
        
        const campaign = await response.json();
        
        setProgress({
          total: campaign.totalRecipients,
          successCount: campaign.successCount,
          failureCount: campaign.failureCount,
          status: campaign.status,
        });

        // Sync logs for finished or progressing recipients
        const newLogs = [];
        campaign.recipients.forEach(rec => {
          if (rec.status !== 'pending') {
            const hasLog = logs.some(l => l.text.includes(rec.email));
            if (!hasLog) {
              if (rec.status === 'success') {
                let msg = `Sent to ${rec.email} successfully.`;
                if (rec.previewUrl) {
                  msg += ` Preview URL: ${rec.previewUrl}`;
                }
                newLogs.push({ text: msg, type: 'success' });
              } else {
                newLogs.push({ text: `Failed to send to ${rec.email}: ${rec.error}`, type: 'error' });
              }
            }
          }
        });

        if (newLogs.length > 0) {
          const time = new Date().toLocaleTimeString();
          setLogs(prev => [
            ...prev,
            ...newLogs.map(l => ({ time, text: l.text, type: l.type }))
          ]);
        }

        if (['success', 'failed', 'partial'].includes(campaign.status)) {
          clearInterval(pollIntervalRef.current);
          setLoading(false);
          setActiveCampaign(null);
          
          if (campaign.status === 'success') {
            setSuccess(`All ${campaign.totalRecipients} emails sent successfully!`);
            addLog(`Campaign completed! All ${campaign.totalRecipients} emails delivered.`, 'success');
          } else if (campaign.status === 'partial') {
            setSuccess(`Campaign complete: ${campaign.successCount} sent, ${campaign.failureCount} failed.`);
            addLog(`Campaign completed with partial errors. Success: ${campaign.successCount}, Failures: ${campaign.failureCount}.`, 'warning');
          } else {
            setError('Campaign failed completely.');
            addLog('Campaign failed completely.', 'error');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);
  };

  const handleSendMail = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setSuccess('');
    setError('');
    setActiveCampaign(true);
    setLogs([]);
    
    addLog('Initializing campaign...', 'info');

    try {
      const token = localStorage.getItem('token');
      const payload = {
        subject,
        body,
        recipients,
        smtpConfig: useCustomSmtp ? smtpConfig : null,
      };

      addLog('Connecting to server and preparing transporter...', 'info');
      
      const response = await fetch(`${API_URL}/mail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to dispatch bulk email');
      }

      addLog(`Mailing campaign dispatched. Campaign ID: ${data.campaignId}`, 'info');
      addLog(`Sending to ${data.totalCount} recipients...`, 'info');
      
      setProgress({
        total: data.totalCount,
        successCount: 0,
        failureCount: 0,
        status: 'sending',
      });

      startPollingStatus(data.campaignId);

    } catch (err) {
      setError(err.message || 'An error occurred during mailing setup');
      addLog(`Setup Error: ${err.message}`, 'error');
      setLoading(false);
      setActiveCampaign(null);
    }
  };

  const progressPercent = progress.total > 0 
    ? Math.round(((progress.successCount + progress.failureCount) / progress.total) * 100) 
    : 0;

  return (
    <div className="dashboard-grid">
      {/* Mail Composer Card */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <h3 className="card-title">
          <Send size={20} style={{ color: '#6366f1' }} />
          New Bulk Email Campaign
        </h3>

        {error && (
          <div className="alert alert-error">
            <AlertTriangle size={20} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={20} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSendMail}>
          <div className="form-group">
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              type="text"
              className="input-control"
              placeholder="e.g., Exciting updates from AeroSend!"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="recipients">Recipients (comma, newline or semicolon separated)</label>
            <textarea
              id="recipients"
              className="input-control"
              placeholder="recipient1@example.com, recipient2@example.com&#10;recipient3@example.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              disabled={loading}
              style={{ minHeight: '100px' }}
            />
            <div className="recipient-helper">
              <span>Paste lists directly. Invalid formats will be automatically skipped.</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="body">Email Body (HTML supported)</label>
            <textarea
              id="body"
              className="input-control"
              placeholder="<h1>Hello!</h1><p>This is a bulk test email.</p>"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={loading}
              style={{ minHeight: '180px' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}
            disabled={loading}
          >
            <Play size={16} />
            {loading ? 'Processing Campaign...' : 'Launch Mailing Campaign'}
          </button>
        </form>
      </div>

      {/* SMTP and Real-time Status Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* SMTP Configuration */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 className="card-title">
            <Settings size={20} style={{ color: '#a855f7' }} />
            SMTP Configuration
          </h3>

          <div className="switch-group" onClick={() => !loading && setUseCustomSmtp(!useCustomSmtp)}>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={useCustomSmtp} 
                onChange={() => {}} 
                disabled={loading}
              />
              <span className="slider"></span>
            </label>
            <span style={{ fontSize: '0.95rem', fontWeight: 500, color: useCustomSmtp ? '#f3f4f6' : '#9ca3af' }}>
              Use Custom SMTP Server
            </span>
          </div>

          {!useCustomSmtp ? (
            <div className="alert alert-info" style={{ margin: 0, padding: '0.85rem' }}>
              <Sparkles size={24} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Auto-Test Mode Active:</strong> We will dynamically create a secure Ethereal.email test account. Sent emails won't go to actual inboxes, and preview links will be generated!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s ease' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>SMTP Host</label>
                <input
                  type="text"
                  name="host"
                  placeholder="smtp.gmail.com"
                  className="input-control"
                  value={smtpConfig.host}
                  onChange={handleSmtpChange}
                  disabled={loading}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>SMTP Port</label>
                  <input
                    type="text"
                    name="port"
                    placeholder="587"
                    className="input-control"
                    value={smtpConfig.port}
                    onChange={handleSmtpChange}
                    disabled={loading}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label className="switch-group" style={{ marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      name="secure"
                      checked={smtpConfig.secure}
                      onChange={(e) => setSmtpConfig(prev => ({ ...prev, secure: e.target.checked }))}
                      disabled={loading}
                    />
                    <span style={{ fontSize: '0.85rem' }}>SSL/TLS</span>
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Username / Email</label>
                <input
                  type="text"
                  name="user"
                  placeholder="user@example.com"
                  className="input-control"
                  value={smtpConfig.user}
                  onChange={handleSmtpChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Password / App Key</label>
                <input
                  type="password"
                  name="pass"
                  placeholder="••••••••••••"
                  className="input-control"
                  value={smtpConfig.pass}
                  onChange={handleSmtpChange}
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Delivery Terminal & Progress */}
        {activeCampaign && (
          <div className="glass-card progress-card" style={{ animation: 'fadeIn 0.3s ease' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Mail size={18} style={{ color: '#6366f1' }} />
              Live Sending Campaign
            </h4>
            
            <div className="progress-header">
              <span>Delivery Progress</span>
              <strong>{progress.successCount + progress.failureCount} / {progress.total} ({progressPercent}%)</strong>
            </div>

            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <div className="progress-stats">
              <div className="stat-box">
                <div className="stat-num primary-text">{progress.total}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-box">
                <div className="stat-num success-text">{progress.successCount}</div>
                <div className="stat-label">Sent</div>
              </div>
              <div className="stat-box">
                <div className="stat-num error-text">{progress.failureCount}</div>
                <div className="stat-label">Failed</div>
              </div>
            </div>

            {/* Terminal console */}
            <div className="log-terminal">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem', color: '#9ca3af' }}>
                <Terminal size={14} />
                <span>REAL-TIME DISPATCH LOGS</span>
              </div>
              {logs.map((log, index) => (
                <div key={index} className={`log-entry ${log.type}`}>
                  [{log.time}] {log.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
