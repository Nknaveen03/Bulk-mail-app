import React, { useState, useEffect } from 'react';
import { Calendar, Mail, CheckCircle2, XCircle, Search, ChevronDown, ChevronUp, ExternalLink, BarChart3, Database } from 'lucide-react';
import { API_URL } from '../config';

export default function History() {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    totalSent: 0,
    totalSuccess: 0,
    totalFailure: 0,
    successRate: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch history list
      const historyRes = await fetch(`${API_URL}/mail/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!historyRes.ok) throw new Error('Failed to fetch mail history');
      const historyData = await historyRes.json();
      setHistory(historyData);

      // Fetch aggregate stats
      const statsRes = await fetch(`${API_URL}/mail/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!statsRes.ok) throw new Error('Failed to fetch aggregate stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleCampaign = (id) => {
    if (expandedCampaign === id) {
      setExpandedCampaign(null);
    } else {
      setExpandedCampaign(id);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <span className="badge badge-success">Success</span>;
      case 'failed':
        return <span className="badge badge-failed">Failed</span>;
      case 'partial':
        return <span className="badge badge-partial">Partial</span>;
      case 'sending':
        return <span className="badge badge-sending">Sending</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  // Filter and search history list
  const filteredHistory = history.filter((campaign) => {
    const matchesSearch = 
      campaign.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.body.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || campaign.status === statusFilter;
      
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading history records...</div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="alert alert-error">
          <XCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate Stats Cards */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper blue">
            <Mail size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalCampaigns}</span>
            <span className="stat-desc">Total Campaigns</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper purple">
            <Database size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalSent}</span>
            <span className="stat-desc">Emails Processed</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper green">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.successRate}%</span>
            <span className="stat-desc">Avg Success Rate</span>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper orange">
            <BarChart3 size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalFailure}</span>
            <span className="stat-desc">Total Failures</span>
          </div>
        </div>
      </div>

      {/* History Filters Section */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="history-filters">
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input
              type="text"
              className="input-control search-input"
              placeholder="Search by subject or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <select
            className="input-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '180px', cursor: 'pointer' }}
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
            <option value="sending">Sending</option>
          </select>
        </div>

        {/* Campaign History List */}
        {filteredHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No campaigns match your filters.
          </div>
        ) : (
          <div className="history-list">
            {filteredHistory.map((campaign) => {
              const isExpanded = expandedCampaign === campaign._id;
              const formattedDate = new Date(campaign.sentAt).toLocaleString();

              return (
                <div key={campaign._id} className="glass-card history-item">
                  <div className="history-item-header" onClick={() => toggleCampaign(campaign._id)}>
                    <div className="history-summary">
                      <span className="history-subject">{campaign.subject}</span>
                      <span className="history-date">
                        <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        {formattedDate}
                      </span>
                    </div>

                    <div className="history-meta">
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {campaign.successCount}/{campaign.totalRecipients} sent
                      </span>
                      {getStatusBadge(campaign.status)}
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {/* Expanded Details Panel */}
                  {isExpanded && (
                    <div className="history-details">
                      <div className="details-grid">
                        
                        {/* SMTP Config Metadata */}
                        {campaign.smtpConfig && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.02)', padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
                            <strong>SMTP Server Config:</strong> {campaign.smtpConfig.host}:{campaign.smtpConfig.port} | <strong>User:</strong> {campaign.smtpConfig.user}
                          </div>
                        )}

                        <div>
                          <h5 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Email Content</span>
                            <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', textTransform: 'uppercase', background: campaign.bodyType === 'text' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)', color: campaign.bodyType === 'text' ? 'var(--info)' : 'var(--accent-secondary)' }}>
                              {campaign.bodyType || 'html'}
                            </span>
                          </h5>
                          {campaign.bodyType === 'text' ? (
                            <div className="email-body-preview" style={{ whiteSpace: 'pre-wrap' }}>
                              {campaign.body}
                            </div>
                          ) : (
                            <div className="email-body-preview" dangerouslySetInnerHTML={{ __html: campaign.body }} />
                          )}
                        </div>

                        <div>
                          <h5 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Recipients Status Log</span>
                            <span>{campaign.successCount} Success, {campaign.failureCount} Failed</span>
                          </h5>
                          <div className="recipient-table-wrapper">
                            <table className="recipient-table">
                              <thead>
                                <tr>
                                  <th>Email</th>
                                  <th>Status</th>
                                  <th>Details / Preview Links</th>
                                </tr>
                              </thead>
                              <tbody>
                                {campaign.recipients.map((recipient) => (
                                  <tr key={recipient._id}>
                                    <td>{recipient.email}</td>
                                    <td>
                                      {recipient.status === 'success' ? (
                                        <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓ Success</span>
                                      ) : recipient.status === 'failed' ? (
                                        <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>✗ Failed</span>
                                      ) : (
                                        <span style={{ color: 'var(--info)' }}>⏳ Pending</span>
                                      )}
                                    </td>
                                    <td>
                                      {recipient.status === 'success' && recipient.previewUrl ? (
                                        <a href={recipient.previewUrl} target="_blank" rel="noreferrer" className="preview-link">
                                          View Preview <ExternalLink size={12} style={{ display: 'inline', marginLeft: '2px', verticalAlign: 'middle' }} />
                                        </a>
                                      ) : recipient.status === 'failed' ? (
                                        <span style={{ color: 'var(--error)' }}>{recipient.error}</span>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
