import React, { useState, useRef, useEffect } from 'react';
import { updateProfile, uploadAvatar, getRoomArchives } from '../services/api';
import '../styles/UserProfile.css';
import AvatarCropModal from './AvatarCropModal';
import AvatarViewerModal from './AvatarViewerModal';
import { AURA_PRESETS } from '../constants/auraConfig';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ui/ConfirmModal';

function UserProfile({ user, onClose, userStatuses = {}, mediaMessages = [], showOverlay = true, isFullTab = false, onProfileUpdate, currentUser, onMediaClick, onSettingsClick, onSetAura }) {
  const navigate = useNavigate();

  const handleMediaClick = (media) => {
    const userMediaMessages = mediaMessages.filter(m => (m.type === 'image' || m.type === 'video') && (m.senderId === user._id || m.receiverId === user._id));
    const startIndex = userMediaMessages.findIndex(m => m._id === media._id);

    if (onMediaClick) {
      onMediaClick({ mediaMessages: userMediaMessages, startIndex });
    }
  };
  
  const [editingName, setEditingName] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [tempName, setTempName] = useState(user?.name || user?.email || '');
  const [tempAbout, setTempAbout] = useState(user?.about || '');
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setImgError(false);
  }, [user?._id, user?.avatar]);

  const status = userStatuses[user?._id]?.online
    ? 'Online'
    : userStatuses[user?._id]?.lastSeen
      ? `Last seen ${new Date(userStatuses[user?._id].lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Offline';
  
  const isOnline = userStatuses[user?._id]?.online;

  const isSelf = currentUser && user && currentUser._id === user._id;

  const [roomArchives, setRoomArchives] = useState([]);
  const [isPending, setIsPending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (currentUser && user) {
      if (currentUser.connections && currentUser.connections.includes(user._id)) {
        setIsConnected(true);
      }
    }
  }, [currentUser, user]);

  const handleConnectRequest = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/connections/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ receiverId: user._id })
      });
      if (res.ok) {
        setIsPending(true);
      }
    } catch (err) {
      console.error("Failed to connect", err);
    }
  };

  const handleDisconnectClick = () => {
    setShowConfirm(true);
  };

  const confirmDisconnectAction = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/connections/${user._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setIsConnected(false);
        setIsPending(false);
      }
    } catch (err) {
      console.error("Failed to disconnect", err);
    } finally {
      setShowConfirm(false);
    }
  };

  useEffect(() => {
    if (isSelf) {
      const fetchArchives = async () => {
        try {
          const data = await getRoomArchives();
          setRoomArchives(data);
        } catch (error) {
          console.error('Failed to fetch room archives:', error);
        }
      };
      fetchArchives();
    }
  }, [isSelf]);

  const handleSaveName = async () => {
    try {
      const updatedUser = await updateProfile({ name: tempName });
      setEditingName(false);
      if (onProfileUpdate) onProfileUpdate(updatedUser);
    } catch (error) {
      console.error('Failed to update name:', error);
      alert('Failed to update name');
    }
  };

  const handleCancelName = () => {
    setTempName(user.name || user.email);
    setEditingName(false);
  };

  const handleSaveAbout = async () => {
    try {
      const updatedUser = await updateProfile({ about: tempAbout });
      setEditingAbout(false);
      if (onProfileUpdate) onProfileUpdate(updatedUser);
    } catch (error) {
      console.error('Failed to update about:', error);
      alert('Failed to update about');
    }
  };

  const handleCancelAbout = () => {
    setTempAbout(user.about || '');
    setEditingAbout(false);
  };

  const handleAvatarClick = () => {
    setShowAvatarViewer(true);
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = async (croppedBlob) => {
    try {
      const updatedUser = await uploadAvatar(croppedBlob);
      setShowCropModal(false);
      setImageSrc(null);
      fileInputRef.current.value = '';
      if (onProfileUpdate) onProfileUpdate(updatedUser);
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      alert('Failed to upload avatar');
    }
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageSrc(null);
    fileInputRef.current.value = '';
  };

  if (!user) return null;

  const hasAura = user.aura && user.aura.type;
  const auraColor = hasAura ? user.aura.color : "transparent";
  
  // Mock activity data
  const recentActivities = [
    { id: 1, type: 'connection', text: `Became connected with ${currentUser?.name || 'someone'}`, time: '2h ago' },
    { id: 2, type: 'room', text: 'Joined a live room', time: '1d ago' },
  ];

  return (
    <>
      {showConfirm && (
          <ConfirmModal 
              title="Disconnect User"
              message={`Are you sure you want to disconnect from ${user.name || user.username || user.email}?`}
              confirmText="Disconnect"
              cancelText="Cancel"
              onConfirm={confirmDisconnectAction}
              onCancel={() => setShowConfirm(false)}
          />
      )}
      {/* Overlay */}
      {showOverlay && <div className="profile-overlay" onClick={onClose}></div>}

      {/* Crop Modal */}
      {showCropModal && (
        <AvatarCropModal
          imageSrc={imageSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}

      {/* Avatar Viewer Modal */}
      {showAvatarViewer && (
        <AvatarViewerModal
          user={user}
          currentUser={currentUser}
          onClose={() => setShowAvatarViewer(false)}
          onProfileUpdate={onProfileUpdate}
        />
      )}

      {/* Panel */}
      <div className={`modern-profile-panel ${isFullTab ? 'full-tab' : ''}`}>
        <div className="modern-profile-header-bar">
          <div className="modern-profile-title">
            <span className="title-icon">👤</span> Profile
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                className="modern-icon-btn"
                title="Settings"
              >
                ⚙️
              </button>
            )}
            {onClose && <button onClick={onClose} className="modern-icon-btn">✕</button>}
          </div>
        </div>

        <div className="modern-profile-content">
          
          {/* HERO SECTION */}
          <div className="modern-profile-hero">
            <div
              className={`modern-hero-avatar ${isSelf ? 'pointable' : ''}`}
              style={{
                '--aura-color': auraColor,
                boxShadow: hasAura ? `0 0 25px ${auraColor}` : '0 10px 30px rgba(0,0,0,0.5)',
                cursor: isSelf ? 'pointer' : 'default',
                border: hasAura ? `3px solid ${auraColor}` : '3px solid rgba(255,255,255,0.1)'
              }}
              onClick={handleAvatarClick}
            >
              {user.avatar && !imgError ? (
                <img 
                  src={user.avatar} 
                  alt="Avatar" 
                  className="modern-avatar-img" 
                  onError={() => setImgError(true)} 
                />
              ) : (
                <span className="modern-avatar-initial">{(user.name || user.email || '?').charAt(0).toUpperCase()}</span>
              )}
              <div className={`modern-status-dot ${isOnline ? 'online' : 'offline'}`} />
            </div>

            <div className="modern-hero-info">
              {editingName ? (
                <div className="modern-edit-inline">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="modern-edit-input"
                    autoFocus
                  />
                  <div className="modern-edit-actions">
                    <button onClick={handleSaveName} className="modern-btn-save">✓</button>
                    <button onClick={handleCancelName} className="modern-btn-cancel">✕</button>
                  </div>
                </div>
              ) : (
                <div className="modern-name-row">
                  <h2 className="modern-hero-name">{user.name || user.email}</h2>
                  {isSelf && <button onClick={() => setEditingName(true)} className="modern-edit-icon">✏️</button>}
                </div>
              )}
              
              <div className="modern-hero-id">@{user.username || user._id.slice(-6)}</div>
              <div className="modern-hero-status">{status}</div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="modern-hero-actions">
              {isSelf ? (
                 <button className="modern-btn secondary" onClick={() => navigate("/settings")}>Settings</button>
              ) : (
                <>
                  {!isConnected ? (
                    <button className="modern-btn primary" disabled={isPending} onClick={handleConnectRequest}>
                      {isPending ? "Requested" : "Connect"}
                    </button>
                  ) : (
                    <>
                      <button className="modern-btn primary" onClick={() => navigate(`/messages/${user._id}`)}>
                        <span style={{marginRight: '6px'}}>💬</span> Message
                      </button>
                      <button className="modern-btn danger" onClick={handleDisconnectClick}>
                        Disconnect
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleAvatarChange}
          />

          {/* STATS SECTION */}
          <div className="modern-stats-grid">
            <div className="modern-stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-value">{user.connections?.length || 0}</div>
              <div className="stat-label">Connections</div>
            </div>
            <div className="modern-stat-card">
              <div className="stat-icon">🎙️</div>
              <div className="stat-value">{roomArchives?.length || 0}</div>
              <div className="stat-label">Rooms</div>
            </div>
            <div className="modern-stat-card">
              <div className="stat-icon">⚡</div>
              <div className="stat-value">{user.posts?.length || 0}</div>
              <div className="stat-label">Activity</div>
            </div>
          </div>

          {/* MOOD / VIBE SECTION */}
          {(hasAura || isSelf) && (
            <div className="modern-card modern-mood-card">
              <div className="modern-card-header">
                <h3>Current Vibe</h3>
              </div>
              
              {hasAura ? (
                <div className="current-vibe-display" style={{ background: `linear-gradient(135deg, ${auraColor}22, ${auraColor}44)`, borderLeft: `3px solid ${auraColor}` }}>
                  <span className="vibe-icon">{user.aura.icon}</span>
                  <span className="vibe-text">{AURA_PRESETS.find(p => p.type === user.aura.type)?.label || 'Vibing'}</span>
                </div>
              ) : (
                <div className="current-vibe-empty">No vibe set</div>
              )}

              {isSelf && (
                <div className="vibe-picker">
                  <p className="vibe-hint">Set your current vibe (lasts 24 hours — change anytime)</p>
                  <div className="vibe-badges">
                    {AURA_PRESETS.map((preset) => (
                      <button
                        key={preset.type}
                        onClick={() => {
                          if (onSetAura) {
                            const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
                            onSetAura({ ...preset, expiresAt });
                          }
                        }}
                        className={`vibe-badge ${user.aura?.type === preset.type ? 'active' : ''}`}
                        style={{
                          '--vibe-color': preset.color
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                    {user.aura?.type && (
                      <button
                        onClick={() => onSetAura && onSetAura({ type: null, color: null, icon: null, expiresAt: null })}
                        className="vibe-badge clear-vibe"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABOUT SECTION */}
          <div className="modern-card modern-about-card">
            <div className="modern-card-header">
              <h3>About {isSelf ? 'Me' : user.name?.split(' ')[0] || 'User'}</h3>
              {isSelf && !editingAbout && (
                <button onClick={() => setEditingAbout(true)} className="modern-edit-icon">✏️</button>
              )}
            </div>
            <div className="modern-card-body">
              {editingAbout ? (
                <div className="modern-edit-block">
                  <textarea
                    value={tempAbout}
                    onChange={(e) => setTempAbout(e.target.value)}
                    className="modern-edit-textarea"
                    placeholder="Write something about yourself..."
                    autoFocus
                  />
                  <div className="modern-edit-actions right">
                    <button onClick={handleSaveAbout} className="modern-btn-save px">Save</button>
                    <button onClick={handleCancelAbout} className="modern-btn-cancel px">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="about-text-content">
                  {user.about ? user.about : <span className="empty-text">No bio provided.</span>}
                </div>
              )}
            </div>
          </div>

          {/* RECENT ACTIVITY SECTION */}
          <div className="modern-card modern-activity-card">
            <div className="modern-card-header">
              <h3>Recent Activity</h3>
            </div>
            <div className="modern-activity-list">
              {recentActivities.map(activity => (
                <div key={activity.id} className="modern-activity-item">
                  <div className="activity-icon">
                    {activity.type === 'connection' ? '🤝' : '🎙️'}
                  </div>
                  <div className="activity-info">
                    <div className="activity-text">{activity.text}</div>
                    <div className="activity-time">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isSelf && isFullTab && (
            <div className="modern-logout-section">
              <button className="modern-logout-btn" onClick={() => {
                localStorage.removeItem('token');
                window.location.href = "/login";
              }}>
                <span className="icon">🚪</span> Logout
              </button>
            </div>
          )}
          
        </div>
      </div>
    </>
  );
}

export default UserProfile;
