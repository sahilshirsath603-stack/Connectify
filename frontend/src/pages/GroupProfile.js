import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import '../styles/UserProfile.css';
import AvatarCropModal from '../components/AvatarCropModal';
import AvatarViewerModal from '../components/AvatarViewerModal';
import Icon from '../components/ui/Icon';
import { APP_ICONS } from '../constants/icons';
import { ICON_SIZES } from '../constants/iconSizes';

function GroupProfile({ groupId, token, users, onClose }) {
  const [group, setGroup] = useState(null);
  const [media, setMedia] = useState([]);
  const [activeTab, setActiveTab] = useState('media');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);

  const fileInputRef = useRef(null);

  // Helper functions to handle members as strings or objects
  const getId = (item) => typeof item === 'string' ? item : item?._id;
  const getEmail = (member) => typeof member === 'string' ? member : member?.email;

  useEffect(() => {
    if (groupId && token) {
      fetchGroupDetails();
      fetchGroupMedia();
    }
  }, [groupId, token]);

  // Decode current user ID and check admin status
  useEffect(() => {
    if (token && group) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.userId;
        setCurrentUserId(userId);
        const isAdmin =
          (group.admins || []).length > 0
            ? (group.admins || []).some(admin => admin?._id?.toString() === userId)
            : group.createdBy?._id?.toString() === userId;
        setIsAdmin(isAdmin);
      } catch (err) {
        console.error('Error decoding token:', err);
      }
    }
  }, [token, group]);

  // ESC key handler for closing preview and arrow navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedMedia) {
        if (e.key === 'Escape') {
          setSelectedMedia(null);
        } else if (e.key === 'ArrowLeft') {
          const filteredMedia = getFilteredMedia();
          const currentIndex = previewIndex;
          const newIndex = currentIndex > 0 ? currentIndex - 1 : filteredMedia.length - 1;
          setSelectedMedia(filteredMedia[newIndex]);
          setPreviewIndex(newIndex);
        } else if (e.key === 'ArrowRight') {
          const filteredMedia = getFilteredMedia();
          const currentIndex = previewIndex;
          const newIndex = currentIndex < filteredMedia.length - 1 ? currentIndex + 1 : 0;
          setSelectedMedia(filteredMedia[newIndex]);
          setPreviewIndex(newIndex);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedMedia, previewIndex]);

  const fetchGroupDetails = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroup(response.data);
    } catch (err) {
      setError('Failed to load group details');
      console.error('Error fetching group details:', err);
    }
  };

  const fetchGroupMedia = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/groups/${groupId}/media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedia(response.data);
    } catch (err) {
      console.error('Error fetching group media:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (createdAt) => {
    return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getDateLabel = (dateString) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (dateString === today) return 'Today';
    if (dateString === yesterday) return 'Yesterday';
    return new Date(dateString).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const groupByDate = (messages) => {
    const groups = {};
    messages.forEach((msg) => {
      const date = new Date(msg.createdAt).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const extractLinks = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  const getFilteredMedia = () => {
    if (activeTab === 'media') {
      return media.filter(m => m.type === 'image' || m.type === 'video');
    } else if (activeTab === 'docs') {
      return media.filter(m => m.type === 'file');
    } else if (activeTab === 'links') {
      return media.filter(m => m.text && extractLinks(m.text).length > 0);
    }
    return [];
  };

  const getEmptyState = () => {
    if (activeTab === 'media') {
      return { icon: APP_ICONS.media, text: 'No media shared' };
    } else if (activeTab === 'docs') {
      return { icon: APP_ICONS.docs, text: 'No documents shared' };
    } else if (activeTab === 'links') {
      return { icon: APP_ICONS.link, text: 'No links shared' };
    }
    return { icon: APP_ICONS.media, text: 'No content' };
  };

  const fetchFriends = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/connections/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter out existing members
      const friends = response.data.filter(user =>
        !group.members.some(member => getId(member) === user._id)
      );
      setAllUsers(friends);
    } catch (err) {
      console.error('Error fetching friends:', err);
    }
  };

  const handleAddMember = async () => {
    if (selectedUsers.length === 0) return;

    setAddingMember(true);
    try {
      for (const userId of selectedUsers) {
        await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/groups/${groupId}/members`, {
          userId
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      // Refresh group details
      await fetchGroupDetails();
      setShowAddMemberModal(false);
      setSelectedUsers([]);
      setSearchQuery('');
    } catch (err) {
      console.error('Error adding member:', err);
      alert('Failed to add member(s)');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (removingMember) return;

    setRemovingMember(userId);
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/groups/${groupId}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh group details
      await fetchGroupDetails();
    } catch (err) {
      console.error('Error removing member:', err);
      alert('Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  const openAddMemberModal = () => {
    fetchFriends();
    setShowAddMemberModal(true);
  };

  const handleRenameGroup = async () => {
    if (!newGroupName.trim() || newGroupName.trim() === group.name) {
      setEditingName(false);
      setNewGroupName('');
      return;
    }

    setRenaming(true);
    try {
      await axios.put(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/groups/${groupId}/rename`, {
        name: newGroupName.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Optimistic update
      setGroup({ ...group, name: newGroupName.trim() });
      setEditingName(false);
      setNewGroupName('');
    } catch (err) {
      console.error('Error renaming group:', err);
      alert('Failed to rename group');
    } finally {
      setRenaming(false);
    }
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
      // Upload the cropped avatar
      const formData = new FormData();
      formData.append('avatar', croppedBlob);

      const response = await axios.put(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/groups/${groupId}/update`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setGroup(response.data);
      setShowCropModal(false);
      setImageSrc(null);
      fileInputRef.current.value = '';
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

  if (loading) {
    return (
      <div className="profile-overlay">
        <div className="profile-panel">
          <div className="profile-loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="profile-overlay">
        <div className="profile-panel">
          <div className="profile-error">{error || 'Group not found'}</div>
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    );
  }

  const dateGroups = groupByDate(media);

  // Compute isAdmin inline for immediate availability
  const computedIsAdmin =
    (group?.admins || []).length > 0
      ? (group.admins || []).some(a => a?._id?.toString() === currentUserId)
      : group.createdBy?._id?.toString() === currentUserId;

  return (
    <div className="modern-profile-panel full-tab">
      {/* Header Bar */}
      <div className="modern-profile-header-bar">
        <div className="modern-profile-title">
          <button onClick={onClose} className="modern-icon-btn" title="Go Back">
            <Icon name={APP_ICONS.back || 'arrow_back'} size={ICON_SIZES.small} />
          </button>
          <span>Group Info</span>
        </div>
      </div>

      <div className="modern-profile-content">
        {/* Hero Section */}
        <div className="modern-profile-hero">
          <div
            className={`modern-hero-avatar pointable`}
            onClick={handleAvatarClick}
          >
            {group.avatar ? (
              <img
                src={group.avatar}
                alt="Group Avatar"
                className="modern-avatar-img"
              />
            ) : (
              <span className="modern-avatar-initial">
                {group.name.charAt(0).toUpperCase()}
              </span>
            )}
            {computedIsAdmin && (
              <div 
                className="modern-edit-icon" 
                style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--accent-color, #6b7aff)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #0e1628' }}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}
              >
                <Icon name={APP_ICONS.camera || 'camera'} size={14} color="#fff" />
              </div>
            )}
            {computedIsAdmin && (
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleAvatarChange}
              />
            )}
          </div>

          <div className="modern-name-row">
            {editingName ? (
              <div className="modern-edit-inline">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="modern-edit-input"
                  style={{ width: '220px' }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameGroup();
                    } else if (e.key === 'Escape') {
                      setEditingName(false);
                      setNewGroupName('');
                    }
                  }}
                />
                <div className="modern-edit-actions">
                  <button
                    onClick={handleRenameGroup}
                    disabled={!newGroupName.trim() || renaming}
                    className="modern-btn-save"
                  >
                    {renaming ? '...' : '✓'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setNewGroupName('');
                    }}
                    className="modern-btn-cancel"
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="modern-hero-name">{group.name}</h3>
                {computedIsAdmin && (
                  <button
                    onClick={() => {
                      setEditingName(true);
                      setNewGroupName(group.name);
                    }}
                    className="modern-edit-icon"
                  >
                    <Icon name={APP_ICONS.edit} size={ICON_SIZES.small} />
                  </button>
                )}
              </>
            )}
          </div>
          <div className="modern-hero-status">{group.members.length} members</div>
        </div>

        {/* Members List */}
        <div className="modern-card">
          <div className="modern-card-header">
            <h3>Members</h3>
            {computedIsAdmin && (
              <button 
                onClick={openAddMemberModal} 
                className="modern-btn primary"
                style={{ padding: '6px 14px', fontSize: '0.85rem' }}
              >
                + Add Member
              </button>
            )}
          </div>
          <div className="modern-members-list">
            {group.members.map((member) => {
              const memberId = getId(member);
              const user = users.find(u => u._id === memberId);
              return (
                <div key={memberId} className="modern-member-item">
                  <div className="modern-member-avatar">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt="Avatar"
                        className="modern-member-avatar-img"
                      />
                    ) : (
                      (user?.name || user?.email || "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="modern-member-info">
                    <span className="modern-member-name">{user?.name || user?.email}</span>
                    {((group.admins || []).length > 0
                      ? (group.admins || []).some(admin => admin?._id?.toString() === memberId)
                      : group.createdBy?._id?.toString() === memberId) && (
                        <span className="modern-admin-badge">Admin</span>
                      )}
                  </div>
                  {computedIsAdmin && memberId !== getId(group.createdBy) && ((group.admins || []).length > 1 || memberId !== currentUserId) && (
                    <button
                      onClick={() => handleRemoveMember(memberId)}
                      disabled={removingMember === memberId}
                      className="modern-remove-btn"
                    >
                      {removingMember === memberId ? '...' : '×'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Media Tabs */}
        <div className="modern-card">
          <div className="modern-profile-tabs">
            <button
              className={`modern-profile-tab ${activeTab === 'media' ? 'active' : ''}`}
              onClick={() => setActiveTab('media')}
            >
              Media
            </button>
            <button
              className={`modern-profile-tab ${activeTab === 'docs' ? 'active' : ''}`}
              onClick={() => setActiveTab('docs')}
            >
              Docs
            </button>
            <button
              className={`modern-profile-tab ${activeTab === 'links' ? 'active' : ''}`}
              onClick={() => setActiveTab('links')}
            >
              Links
            </button>
          </div>

          {/* Media Content */}
          <div className="modern-media-content">
            {(() => {
              const filteredMedia = getFilteredMedia();
              const emptyState = getEmptyState();

              if (filteredMedia.length === 0) {
                return (
                  <div className="current-vibe-empty">
                    {emptyState.text}
                  </div>
                );
              }

              if (activeTab === 'media') {
                const dateGroups = groupByDate(filteredMedia);
                return Object.keys(dateGroups)
                  .sort((a, b) => new Date(b) - new Date(a))
                  .map((dateKey) => {
                    const messagesForDate = dateGroups[dateKey];
                    if (messagesForDate.length === 0) return null;

                    return (
                      <div key={dateKey} style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>{getDateLabel(dateKey)}</div>
                        <div className="modern-media-grid">
                          {messagesForDate.map((m) => (
                            <div
                              key={m._id}
                              className="modern-media-item"
                              onClick={() => {
                                setSelectedMedia(m);
                                setPreviewIndex(filteredMedia.findIndex(item => item._id === m._id));
                              }}
                              title={new Date(m.createdAt).toLocaleString()}
                            >
                              {m.type === 'image' && (
                                <img
                                  src={m.fileUrl}
                                  alt="Media"
                                  className="modern-media-img"
                                  loading="lazy"
                                />
                              )}
                              {m.type === 'video' && (
                                <>
                                  <img
                                    src={m.fileUrl.replace('.webm', '.png').replace('.mp4', '.png')}
                                    alt="Video thumbnail"
                                    className="modern-media-img"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                  <div className="video-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                                    <span className="play-icon" style={{ color: 'white', fontSize: '24px' }}>▶</span>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
              } else if (activeTab === 'docs') {
                return filteredMedia.map((m) => (
                  <div key={m._id} className="modern-doc-item">
                    <div className="modern-doc-icon"><Icon name={APP_ICONS.docs} size={ICON_SIZES.large} /></div>
                    <div className="modern-item-info">
                      <div className="modern-item-title">{m.fileName}</div>
                      <div className="modern-item-meta">
                        {m.fileSize ? `${Math.round(m.fileSize / 1024)} KB` : ''} • {getDateLabel(new Date(m.createdAt).toDateString())}
                      </div>
                    </div>
                    <button
                      className="modern-icon-btn"
                      onClick={() => window.open(m.fileUrl, '_blank')}
                      style={{ width: '32px', height: '32px' }}
                    >
                      <Icon name={APP_ICONS.download || 'download'} size={14} />
                    </button>
                  </div>
                ));
              } else if (activeTab === 'links') {
                return filteredMedia.map((m) => {
                  const links = extractLinks(m.text);
                  return links.map((link, linkIndex) => (
                    <div key={`${m._id}-${linkIndex}`} className="modern-link-item">
                      <div className="modern-link-icon"><Icon name={APP_ICONS.link} size={ICON_SIZES.large} /></div>
                      <div className="modern-item-info">
                        <div className="modern-item-title" style={{ color: '#6b7aff', cursor: 'pointer' }} onClick={() => window.open(link, '_blank')}>
                          {link}
                        </div>
                        <div className="modern-item-meta">
                          {m.sender?.email || 'Unknown'} • {getDateLabel(new Date(m.createdAt).toDateString())}
                        </div>
                      </div>
                    </div>
                  ));
                });
              }

              return null;
            })()}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="modern-modal-overlay">
          <div className="modern-modal">
            <h3 className="modern-modal-title">Add Members</h3>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="modern-search-input"
            />
            <div className="modern-members-list" style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '24px' }}>
              {allUsers
                .filter(user => (user.name || user.email).toLowerCase().includes(searchQuery.toLowerCase()))
                .map(user => (
                  <div
                    key={user._id}
                    onClick={() => {
                      if (selectedUsers.includes(user._id)) {
                        setSelectedUsers(selectedUsers.filter(id => id !== user._id));
                      } else {
                        setSelectedUsers([...selectedUsers, user._id]);
                      }
                    }}
                    className={`modern-member-item ${selectedUsers.includes(user._id) ? 'active' : ''}`}
                    style={{ cursor: 'pointer', border: selectedUsers.includes(user._id) ? '1px solid #6b7aff' : '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div className="modern-member-avatar">
                      {user.avatar ? (
                        <img src={user.avatar} className="modern-member-avatar-img" alt="" />
                      ) : (
                        (user.name || user.email).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="modern-member-info">
                      <span className="modern-member-name">{user.name || user.email}</span>
                      <span className="modern-item-meta">{user.email}</span>
                    </div>
                    {selectedUsers.includes(user._id) && (
                      <div className="modern-admin-badge" style={{ background: '#6b7aff', color: '#fff' }}>Selected</div>
                    )}
                  </div>
                ))}
            </div>
            <div className="modern-edit-actions" style={{ justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedUsers([]);
                  setSearchQuery('');
                }}
                className="modern-btn secondary"
                style={{ padding: '10px 20px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={selectedUsers.length === 0 || addingMember}
                className="modern-btn primary"
                style={{ padding: '10px 20px' }}
              >
                {addingMember ? 'Adding...' : `Add ${selectedUsers.length} Member${selectedUsers.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

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
          group={group}
          currentUser={{ _id: currentUserId }}
          onClose={() => setShowAvatarViewer(false)}
        />
      )}

      {/* Media Preview Modal */}
      {selectedMedia && (
        <div className="modern-modal-overlay">
          <div className="modern-modal" style={{ maxWidth: '90vw', maxHeight: '90vh', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <button
              className="modern-icon-btn"
              onClick={() => setSelectedMedia(null)}
              style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, width: '40px', height: '40px' }}
            >
              ×
            </button>
            {(() => {
              const filteredMedia = getFilteredMedia();
              const currentIndex = previewIndex;
              const hasPrev = currentIndex > 0;
              const hasNext = currentIndex < filteredMedia.length - 1;

              return (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {hasPrev && (
                    <button
                      className="modern-icon-btn"
                      style={{ position: 'absolute', left: '0', zIndex: 10, width: '48px', height: '48px' }}
                      onClick={() => {
                        const newIndex = currentIndex - 1;
                        setSelectedMedia(filteredMedia[newIndex]);
                        setPreviewIndex(newIndex);
                      }}
                    >
                      ‹
                    </button>
                  )}
                  {hasNext && (
                    <button
                      className="modern-icon-btn"
                      style={{ position: 'absolute', right: '0', zIndex: 10, width: '48px', height: '48px' }}
                      onClick={() => {
                        const newIndex = currentIndex + 1;
                        setSelectedMedia(filteredMedia[newIndex]);
                        setPreviewIndex(newIndex);
                      }}
                    >
                      ›
                    </button>
                  )}
                  {selectedMedia.type === 'image' && (
                    <img
                      src={selectedMedia.fileUrl}
                      alt="Preview"
                      style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '12px', objectFit: 'contain' }}
                    />
                  )}
                  {selectedMedia.type === 'video' && (
                    <video
                      src={selectedMedia.fileUrl}
                      controls
                      style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '12px' }}
                      autoPlay
                    />
                  )}
                  <div style={{ position: 'absolute', bottom: '-40px', left: '50%', transform: 'translateX(-50%)', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', pointerEvents: 'none' }}>
                    {selectedMedia.fileName || 'Media File'} • {new Date(selectedMedia.createdAt).toLocaleDateString()}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// styles removed


export default GroupProfile;
