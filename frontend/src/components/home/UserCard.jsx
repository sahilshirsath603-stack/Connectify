import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Sparkles, UserPlus, Check, UserX } from "lucide-react";
import "./UserCard.css";
import ConfirmModal from "../ui/ConfirmModal";

// Helper to generate initials from name or username
function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Vibrant preset gradients for avatar fallback
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

export default function UserCard({ user, currentUser, sentRequests, isOnline, isInRoom }) {
    const [isPending, setIsPending] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Prefer explicit backend flags if provided, fallback to matching arrays
        if (user.isConnected !== undefined) {
            setIsConnected(user.isConnected);
        } else if (currentUser && currentUser.connections) {
            setIsConnected(currentUser.connections.includes(user._id));
        }

        if (user.isPendingRequest !== undefined) {
            setIsPending(user.isPendingRequest);
        } else if (sentRequests && sentRequests.includes(user._id)) {
            setIsPending(true);
        }
    }, [currentUser, sentRequests, user._id, user.isConnected, user.isPendingRequest]);

    const handleConnect = async (e, receiverId) => {
        e.stopPropagation(); // Prevent opening profile when clicking connect
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/connections/request`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ receiverId })
            });
            if (res.ok) {
                setIsPending(true);
            }
        } catch (err) {
            console.error("Failed to connect", err);
        }
    };

    const handleCardClick = () => {
        navigate(`/profile/${user._id}`);
    };

    const handleMessageClick = (e) => {
        e.stopPropagation();
        navigate(`/messages/${user._id}`);
    };

    const handleDisconnectClick = (e) => {
        e.stopPropagation();
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
                setIsPending(false); // Just in case
            }
        } catch (err) {
            console.error("Failed to disconnect", err);
        } finally {
            setShowConfirm(false);
        }
    };

    // Calculate Aura styling
    const hasAura = user.aura && user.aura.type;
    const auraColor = hasAura ? user.aura.color : "transparent";

    const displayName = user.name || user.username || "Anonymous User";
    const usernameHandle = user.username ? `@${user.username}` : null;
    const initials = getInitials(displayName);
    const fallbackBg = getAvatarGradient(user._id || displayName);

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
            <div className="user-card clickable-card" onClick={handleCardClick}>
                {/* Status Badges */}
                <div className="card-top-badges">
                    {isInRoom && (
                        <div className="room-badge">
                            <span className="live-dot"></span> 🔊 In Room
                        </div>
                    )}
                    {isOnline && (
                        <div className="online-pill-badge">
                            <span className="pulse-green-dot"></span> Active Now
                        </div>
                    )}
                </div>

                {/* Avatar Container */}
                <div className="avatar-container">
                    <div 
                        className="avatar-ring" 
                        style={{ 
                            background: hasAura 
                                ? `linear-gradient(135deg, ${auraColor}, var(--accent-1))` 
                                : `linear-gradient(135deg, rgba(255,122,24,0.8), rgba(255,61,129,0.8))` 
                        }}
                    ></div>
                    <div className="avatar-inner">
                        {user.avatar ? (
                            <div 
                                className="avatar-img" 
                                style={{ backgroundImage: `url("${user.avatar}")` }}
                            />
                        ) : (
                            <div 
                                className="avatar-fallback"
                                style={{ background: fallbackBg }}
                            >
                                <span className="avatar-initials">{initials}</span>
                            </div>
                        )}
                    </div>
                    <div 
                        className={`online-indicator ${isOnline ? 'online' : 'offline'}`} 
                        title={isOnline ? 'Online' : 'Offline'}
                    />
                </div>

                {/* Name & Handle */}
                <h3 className="user-name-text">
                    {displayName}
                </h3>
                {usernameHandle && user.name && (
                    <span className="user-handle-text">{usernameHandle}</span>
                )}
                
                {/* Bio text */}
                <p className="user-bio-text">
                    {user.about || user.bio || "Passionate about connecting with others."}
                </p>

                {/* Tags / Vibe Pill */}
                <div className="tags-container">
                    {hasAura ? (
                        <div className="vibe-tag" style={{ borderColor: auraColor }}>
                            <span>{user.aura.icon}</span>
                            <span>{user.aura.label} Vibe</span>
                        </div>
                    ) : (
                        <div className="vibe-tag default-tag">
                            <Sparkles size={12} className="sparkle-icon" /> Member
                        </div>
                    )}
                </div>

                {/* Card Actions */}
                <div className="card-actions-fixed">
                    {!isConnected ? (
                        <button
                            onClick={(e) => handleConnect(e, user._id)}
                            disabled={isPending}
                            className={`cta-button ${isPending ? 'pending' : ''}`}
                        >
                            {isPending ? (
                                <>
                                    <Check size={16} /> Request Sent
                                </>
                            ) : (
                                <>
                                    <UserPlus size={16} /> Connect Now
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="connected-actions-row">
                            <button 
                                onClick={handleMessageClick} 
                                className="action-btn message-btn"
                                title="Send Direct Message"
                            >
                                <MessageCircle size={16} /> Message
                            </button>
                            <button 
                                onClick={handleDisconnectClick} 
                                className="action-btn disconnect-btn"
                                title="Disconnect"
                            >
                                <UserX size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
