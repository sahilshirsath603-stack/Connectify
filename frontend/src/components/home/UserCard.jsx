import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Sparkles } from "lucide-react";
import "./UserCard.css";
import ConfirmModal from "../ui/ConfirmModal";

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
    const auraClass = hasAura ? `aura-animated aura-${user.aura.type}` : '';

    return (
        <>
            {showConfirm && (
                <ConfirmModal 
                    title="Disconnect User"
                    message={`Are you sure you want to disconnect from ${user.name || user.username || 'this user'}?`}
                    confirmText="Disconnect"
                    cancelText="Cancel"
                    onConfirm={confirmDisconnectAction}
                    onCancel={() => setShowConfirm(false)}
                />
            )}
            <div className="user-card clickable-card" onClick={handleCardClick}>
                {isInRoom && <div className="room-badge">🔊 In Room</div>}

                <div className="avatar-container">
                    <div 
                        className="avatar-ring" 
                        style={{ background: hasAura ? `linear-gradient(135deg, ${auraColor}, var(--accent-1))` : `linear-gradient(135deg, var(--accent-3), var(--accent-2))` }}
                    ></div>
                    <div className="avatar-inner">
                        <div className="avatar-img" style={{
                            backgroundImage: user.avatar ? `url("${user.avatar}")` : 'none',
                            backgroundColor: user.avatar ? 'transparent' : '#ccc'
                        }}></div>
                    </div>
                    <div className={`online-indicator ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online' : 'Offline'}></div>
                </div>

                <h3 className="user-name-text">
                    {user.name || user.username}
                </h3>
                
                <p className="user-bio-text">
                    {user.about || user.bio || "Passionate about connecting with others."}
                </p>

                <div className="tags-container">
                    {hasAura && (
                        <div className="vibe-tag" style={{ borderColor: auraColor }}>
                            {user.aura.icon} {user.aura.label} Vibe
                        </div>
                    )}
                </div>

                <div className="card-actions-fixed">
                    {!isConnected ? (
                        <button
                            onClick={(e) => handleConnect(e, user._id)}
                            disabled={isPending}
                            className="cta-button">
                            {isPending ? "Request Sent" : <><Sparkles size={16} /> ✨ Connect Now</>}
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <button 
                                onClick={handleMessageClick} 
                                className="action-btn message-btn"
                            >
                                <MessageCircle size={16} /> Message
                            </button>
                            <button 
                                onClick={handleDisconnectClick} 
                                className="action-btn disconnect-btn"
                            >
                                Disconnect
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
