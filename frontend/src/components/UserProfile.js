import React, { useState, useRef, useEffect } from 'react';
import { 
    User, Settings, MessageSquare, UserPlus, UserCheck, UserMinus, 
    Share2, Edit3, Camera, Sparkles, Radio, Activity, LogOut, X, 
    Check, Clock 
} from 'lucide-react';
import { updateProfile, uploadAvatar, getRoomArchives, updateAura } from '../services/api';
import '../styles/UserProfile.css';
import AvatarCropModal from './AvatarCropModal';
import AvatarViewerModal from './AvatarViewerModal';
import { AURA_PRESETS } from '../constants/auraConfig';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ui/ConfirmModal';

// Helper to generate initials from name or email
function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Preset vibrant gradients for fallback avatar
const AVATAR_GRADIENTS = [
    "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
    "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
    "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
    "linear-gradient(135deg, #f97316 0%, #e11d48 100%)",
    "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
    "linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)",
];

function getAvatarGradient(idOrName) {
    if (!idOrName) return AVATAR_GRADIENTS[0];
    let hash = 0;
    const str = String(idOrName);
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function UserProfile({ user, onClose, userStatuses = {}, mediaMessages = [], showOverlay = true, isFullTab = false, onProfileUpdate, currentUser, onMediaClick, onSettingsClick, onSetAura }) {
  const navigate = useNavigate();
  
  const [editingName, setEditingName] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [tempName, setTempName] = useState(user?.name || user?.email || '');
  const [tempAbout, setTempAbout] = useState(user?.about || '');
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
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

  const isSelf = Boolean(
    currentUser && user && (
      currentUser._id?.toString() === user._id?.toString() ||
      currentUser.email === user.email
    )
  );

  const [localAura, setLocalAura] = useState(user?.aura || null);

  useEffect(() => {
    setLocalAura(user?.aura || null);
  }, [user?.aura]);

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
    if (isSelf && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      setShowAvatarViewer(true);
    }
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
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onProfileUpdate) onProfileUpdate(updatedUser);
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      alert('Failed to upload avatar');
    }
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/profile/${user._id}`;
    navigator.clipboard.writeText(profileUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  if (!user) return null;

  const hasAura = Boolean(localAura && localAura.type);
  const auraColor = hasAura ? localAura.color : "transparent";

  const handleVibeClick = async (preset) => {
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
    const newAuraData = preset
      ? { type: preset.type, label: preset.label, color: preset.color, icon: preset.icon, expiresAt }
      : { type: null, label: null, color: null, icon: null, expiresAt: null };
    setLocalAura(newAuraData);
    if (onSetAura) {
      onSetAura(newAuraData);
    }
    try {
      const updatedUser = await updateAura(newAuraData);
      if (onProfileUpdate && updatedUser) {
        onProfileUpdate(updatedUser);
      }
    } catch (err) {
      console.error("Error persisting vibe via API:", err);
    }
  };

  const displayName = user.name || user.username || user.email?.split('@')[0] || "User";
  const initials = getInitials(displayName);
  const fallbackBg = getAvatarGradient(user._id || displayName);

  // Mock activity data
  const recentActivities = [
    { id: 1, type: 'connection', text: `Connected on Connectify`, time: 'Recently' },
    { id: 2, type: 'room', text: 'Joined a live micro room', time: 'Active' },
  ];

  return (
    <>
      {showConfirm && (
          <ConfirmModal 
              title="Disconnect User"
              message={`Are you sure you want to disconnect from ${displayName}?`}
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

      {/* Main Profile Panel */}
      <div className={`modern-profile-panel ${isFullTab ? 'full-tab' : ''}`}>
        {/* Top Header Bar */}
        <div className="modern-profile-header-bar">
          <div className="modern-profile-title">
            <div className="title-icon-badge">
              <User size={18} />
            </div>
            <span>{isSelf ? "My Profile" : `${displayName}'s Profile`}</span>
          </div>

          {onClose && (
            <button onClick={onClose} className="modern-icon-btn" title="Close">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Scrollable Body Content */}
        <div className="modern-profile-content">
          
          {/* HERO AVATAR & USER DETAILS */}
          <div className="modern-profile-hero">
            <div
              className={`modern-hero-avatar ${isSelf ? 'pointable' : ''}`}
              style={{
                '--aura-color': auraColor,
                background: user.avatar ? '#1e293b' : fallbackBg,
                boxShadow: hasAura ? `0 0 25px ${auraColor}` : '0 10px 30px rgba(0,0,0,0.5)',
                cursor: isSelf ? 'pointer' : 'default',
                border: hasAura ? `3px solid ${auraColor}` : '3px solid rgba(255,255,255,0.15)'
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
                <span className="modern-avatar-initial">{initials}</span>
              )}

              {/* Camera overlay on hover for personal avatar edit */}
              {isSelf && (
                <div className="avatar-camera-overlay">
                  <Camera size={20} />
                  <span>Edit</span>
                </div>
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
                    <button onClick={handleSaveName} className="modern-btn-save"><Check size={14} /></button>
                    <button onClick={handleCancelName} className="modern-btn-cancel"><X size={14} /></button>
                  </div>
                </div>
              ) : (
                <div className="modern-name-row">
                  <h2 className="modern-hero-name">{displayName}</h2>
                  {isSelf && (
                    <button onClick={() => setEditingName(true)} className="modern-edit-icon" title="Edit Display Name">
                      <Edit3 size={14} />
                    </button>
                  )}
                </div>
              )}
              
              <div className="modern-hero-id">@{user.username || user._id?.slice(-6)}</div>
              <div className="modern-hero-status">
                <Clock size={12} /> {status}
              </div>
            </div>

            {/* ACTION DOCK: PERSONAL PROFILE vs OTHER USER PROFILE */}
            <div className="modern-hero-actions">
              {isSelf ? (
                <>
                  <button className="modern-btn secondary" onClick={() => navigate("/settings")}>
                    <Settings size={15} /> Settings
                  </button>
                  <button className="modern-btn secondary" onClick={handleShareProfile}>
                    <Share2 size={15} /> {shareCopied ? "Copied!" : "Share Link"}
                  </button>
                </>
              ) : (
                <>
                  {isConnected ? (
                    <>
                      <button className="modern-btn primary" onClick={() => navigate(`/messages/${user._id}`)}>
                        <MessageSquare size={16} /> Send Message
                      </button>
                      <button className="modern-btn danger" onClick={handleDisconnectClick}>
                        <UserMinus size={16} /> Disconnect
                      </button>
                    </>
                  ) : (
                    <button 
                      className="modern-btn primary" 
                      disabled={isPending} 
                      onClick={handleConnectRequest}
                    >
                      {isPending ? (
                        <>
                          <Clock size={16} /> Requested
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} /> Connect Now
                        </>
                      )}
                    </button>
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

          {/* STATS DASHBOARD GRID */}
          <div className="modern-stats-grid">
            <div className="modern-stat-card">
              <div className="stat-icon" style={{ color: '#FF7A18' }}>
                <UserCheck size={18} />
              </div>
              <div className="stat-value">{user.connections?.length || 0}</div>
              <div className="stat-label">Connections</div>
            </div>

            <div className="modern-stat-card">
              <div className="stat-icon" style={{ color: '#a855f7' }}>
                <Radio size={18} />
              </div>
              <div className="stat-value">{roomArchives?.length || 0}</div>
              <div className="stat-label">Rooms</div>
            </div>

            <div className="modern-stat-card">
              <div className="stat-icon" style={{ color: '#10b981' }}>
                <Activity size={18} />
              </div>
              <div className="stat-value">{user.posts?.length || 0}</div>
              <div className="stat-label">Activity</div>
            </div>
          </div>

          {/* MOOD / VIBE SECTION */}
          {(hasAura || isSelf) && (
            <div className="modern-card modern-mood-card">
              <div className="modern-card-header">
                <h3>
                  <Sparkles size={16} style={{ color: '#FF7A18', display: 'inline', marginRight: '6px' }} />
                  Current Vibe
                </h3>
              </div>
              
              {hasAura ? (
                <div className="current-vibe-display" style={{ background: `linear-gradient(135deg, ${auraColor}22, ${auraColor}44)`, borderLeft: `3px solid ${auraColor}` }}>
                  <span className="vibe-icon">{localAura?.icon}</span>
                  <span className="vibe-text">{AURA_PRESETS.find(p => p.type === localAura?.type)?.label || localAura?.label || 'Vibing'}</span>
                </div>
              ) : (
                <div className="current-vibe-empty">No vibe set right now</div>
              )}

              {isSelf && (
                <div className="vibe-picker">
                  <p className="vibe-hint">Set your current vibe (lasts 24 hours — change anytime)</p>
                  <div className="vibe-badges">
                    {AURA_PRESETS.map((preset) => (
                      <button
                        key={preset.type}
                        type="button"
                        onClick={() => handleVibeClick(preset)}
                        className={`vibe-badge ${localAura?.type === preset.type ? 'active' : ''}`}
                        style={{
                          '--vibe-color': preset.color
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                    {localAura?.type && (
                      <button
                        type="button"
                        onClick={() => handleVibeClick(null)}
                        className="vibe-badge clear-vibe"
                      >
                        Clear Vibe
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
              <h3>About {isSelf ? 'Me' : displayName.split(' ')[0]}</h3>
              {isSelf && !editingAbout && (
                <button onClick={() => setEditingAbout(true)} className="modern-edit-icon" title="Edit About Bio">
                  <Edit3 size={14} />
                </button>
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
                    {activity.type === 'connection' ? <UserCheck size={16} /> : <Radio size={16} />}
                  </div>
                  <div className="activity-info">
                    <div className="activity-text">{activity.text}</div>
                    <div className="activity-time">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LOGOUT BUTTON FOR PERSONAL PROFILE (FULL TAB) */}
          {isSelf && isFullTab && (
            <div className="modern-logout-section">
              <button className="modern-logout-btn" onClick={() => {
                localStorage.removeItem('token');
                window.location.href = "/login";
              }}>
                <LogOut size={18} /> Logout Account
              </button>
            </div>
          )}
          
        </div>
      </div>
    </>
  );
}

export default UserProfile;

