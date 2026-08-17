import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Shield, Info, AlertTriangle, Sparkles } from "lucide-react";
import api, { deleteAccount, getMe } from "../services/api";
import ConfirmModal from "../components/ui/ConfirmModal";
import "./Settings.css";

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

export default function Settings() {
    const navigate = useNavigate();

    // Permanently enforce Dark Theme (Chhaya)
    useEffect(() => {
        localStorage.setItem('theme', 'chhaya');
        document.documentElement.setAttribute('data-theme', 'chhaya');
    }, []);

    const [user, setUser] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [deletePassword, setDeletePassword] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [showOnlineStatus, setShowOnlineStatus] = useState(true);
    const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
    
    // Username States
    const [username, setUsername] = useState("");
    const [tempUsername, setTempUsername] = useState("");
    const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const userData = await getMe();
                if (userData) {
                    setUser(userData);
                    if (userData.showOnlineStatus !== undefined) setShowOnlineStatus(userData.showOnlineStatus);
                    const userUsername = userData.username || "";
                    setUsername(userUsername);
                    setTempUsername(userUsername);
                }
            } catch (err) {
                console.error("Failed to fetch user settings", err);
            }
        };
        fetchSettings();
    }, []);

    const handleUpdateUsername = async () => {
        if (!tempUsername.trim()) return;
        if (tempUsername === username) return;

        setIsUpdatingUsername(true);
        setUsernameStatus({ type: '', message: '' });
        
        try {
            const res = await api.put('/auth/users/profile', { username: tempUsername });
            setUsername(res.data.username);
            setTempUsername(res.data.username);
            setUsernameStatus({ type: 'success', message: 'Username updated successfully!' });
            
            setTimeout(() => setUsernameStatus({ type: '', message: '' }), 3000);
        } catch (error) {
            console.error("Failed to update username", error);
            setUsernameStatus({ 
                type: 'error', 
                message: error.response?.data?.message || 'Failed to update username' 
            });
        } finally {
            setIsUpdatingUsername(false);
        }
    };

    const handleTogglePrivacy = async () => {
        setIsUpdatingPrivacy(true);
        const newValue = !showOnlineStatus;
        try {
            const res = await api.patch('/settings/online-status', { showOnlineStatus: newValue });
            setShowOnlineStatus(res.data.showOnlineStatus);
        } catch (error) {
            console.error("Failed to update privacy settings", error);
        } finally {
            setIsUpdatingPrivacy(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!deletePassword) {
            setPasswordError("Password is required.");
            return;
        }
        setIsDeleting(true);
        setPasswordError("");
        try {
            await deleteAccount(deletePassword);
            localStorage.removeItem("token");
            window.location.href = "/login";
        } catch (error) {
            console.error("Error deleting account", error);
            setPasswordError(error.response?.data?.message || "Failed to delete account. Incorrect password?");
            setIsDeleting(false);
            setDeletePassword("");
        }
    };

    const displayName = user ? (user.name || user.username || user.email?.split('@')[0]) : "User Settings";
    const initials = getInitials(displayName);
    const fallbackBg = getAvatarGradient(user?._id || displayName);

    return (
        <div className="settings-wrapper">
            <div className="settings-container">
                {/* Top Navigation Bar */}
                <div className="settings-top-bar">
                    <button 
                        onClick={() => navigate(-1)}
                        className="back-btn-circle"
                        title="Go Back"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h2 className="settings-title">Settings</h2>
                </div>

                {/* User Profile Hero Banner Card */}
                {user && (
                    <div className="profile-hero-card">
                        <div className="profile-hero-avatar-wrapper">
                            {user.avatar ? (
                                <div 
                                    className="profile-hero-avatar" 
                                    style={{ backgroundImage: `url("${user.avatar}")` }}
                                />
                            ) : (
                                <div 
                                    className="profile-hero-avatar fallback"
                                    style={{ background: fallbackBg }}
                                >
                                    <span>{initials}</span>
                                </div>
                            )}
                        </div>

                        <div className="profile-hero-info">
                            <h3 className="profile-hero-name">{displayName}</h3>
                            <div className="profile-hero-badges">
                                {username && (
                                    <span className="profile-handle-badge">@{username}</span>
                                )}
                                {user.email && (
                                    <span className="profile-email-badge">{user.email}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Settings Sections */}
                <div className="settings-sections-list">
                    {/* PROFILE INFO SECTION */}
                    <div className="settings-section-card">
                        <div className="section-header">
                            <div className="section-icon-badge profile">
                                <User size={18} />
                            </div>
                            <h3 className="section-title">Profile Info</h3>
                        </div>

                        <div className="username-input-block">
                            <label className="mr-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>
                                Username
                            </label>
                            <div className="username-input-wrapper">
                                <div className="input-at-field">
                                    <span className="input-at-symbol">@</span>
                                    <input 
                                        type="text"
                                        className="glass-setting-input"
                                        value={tempUsername}
                                        onChange={(e) => setTempUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                        placeholder="new_username"
                                    />
                                </div>
                                <button
                                    onClick={handleUpdateUsername}
                                    disabled={isUpdatingUsername || tempUsername === username || !tempUsername}
                                    className="update-username-btn"
                                >
                                    <Sparkles size={14} />
                                    {isUpdatingUsername ? 'Updating...' : 'Update'}
                                </button>
                            </div>

                            {usernameStatus.message && (
                                <div className={`status-feedback-msg ${usernameStatus.type}`}>
                                    {usernameStatus.message}
                                </div>
                            )}
                            <p className="setting-hint-text">
                                Username can only contain lowercase letters, numbers, and underscores (3-20 chars).
                            </p>
                        </div>
                    </div>

                    {/* PRIVACY SECTION */}
                    <div className="settings-section-card">
                        <div className="section-header">
                            <div className="section-icon-badge privacy">
                                <Shield size={18} />
                            </div>
                            <h3 className="section-title">Privacy & Security</h3>
                        </div>

                        <div className="setting-row-item">
                            <div>
                                <div className="setting-item-label">Show Online Status</div>
                                <div className="setting-item-desc">Allow others to see when you are active online</div>
                            </div>
                            <label className="glass-switch">
                                <input
                                    type="checkbox"
                                    checked={showOnlineStatus}
                                    onChange={handleTogglePrivacy}
                                    disabled={isUpdatingPrivacy}
                                />
                                <span className="glass-switch-slider"></span>
                            </label>
                        </div>
                    </div>

                    {/* ABOUT SECTION */}
                    <div className="settings-section-card">
                        <div className="section-header">
                            <div className="section-icon-badge about">
                                <Info size={18} />
                            </div>
                            <h3 className="section-title">About App</h3>
                        </div>

                        <div className="about-pills-grid">
                            <span className="about-pill">Connectify v1.0.0</span>
                            <span className="about-pill">Ultra Glass Engine</span>
                            <span className="about-pill">Real-time WebSockets</span>
                        </div>
                    </div>

                    {/* DANGER ZONE SECTION */}
                    <div className="settings-section-card danger-section">
                        <div className="section-header">
                            <div className="section-icon-badge danger">
                                <AlertTriangle size={18} />
                            </div>
                            <h3 className="section-title" style={{ color: '#fca5a5' }}>Danger Zone</h3>
                        </div>

                        <div className="setting-row-item">
                            <div>
                                <div className="setting-item-label" style={{ color: '#fca5a5' }}>Delete Account</div>
                                <div className="setting-item-desc">Permanently remove your profile, messages, and connections</div>
                            </div>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="delete-acc-btn"
                            >
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            {showDeleteModal && (
                <ConfirmModal
                    title="Delete your account?"
                    confirmText={isDeleting ? "Deleting..." : "Permanently Delete"}
                    cancelText="Cancel"
                    onConfirm={handleDeleteAccount}
                    onCancel={() => {
                        setShowDeleteModal(false);
                        setDeletePassword("");
                        setPasswordError("");
                    }}
                >
                    <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                        <p style={{ color: 'var(--color-text-secondary, #cbd5e1)', fontSize: '14px', lineHeight: '1.5', marginTop: 0 }}>
                            This action will permanently remove:
                        </p>
                        <ul style={{ color: 'var(--color-text-secondary, #cbd5e1)', paddingLeft: '20px', margin: '8px 0', fontSize: '14px' }}>
                            <li>Your profile</li>
                            <li>All messages you sent</li>
                            <li>Your connections</li>
                            <li>Your micro rooms</li>
                            <li>Your media</li>
                        </ul>
                        <p style={{ color: 'var(--color-text-secondary, #cbd5e1)', fontSize: '14px', marginBottom: 0 }}>
                            <strong>This action cannot be undone.</strong>
                        </p>
                    </div>

                    <div style={{ textAlign: 'left', marginTop: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                            Enter your <strong>PASSWORD</strong> to confirm:
                        </label>
                        <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => { setDeletePassword(e.target.value); setPasswordError(""); }}
                            placeholder="Your password"
                            style={{
                                width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.25)', color: 'var(--color-text-primary)'
                            }}
                        />
                        {passwordError && (
                            <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px', marginBottom: 0 }}>
                                {passwordError}
                            </p>
                        )}
                    </div>
                </ConfirmModal>
            )}
        </div>
    );
}
