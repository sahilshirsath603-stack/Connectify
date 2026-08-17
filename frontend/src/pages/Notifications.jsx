import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { Bell, Check, X, CheckCheck, Trash2, UserPlus, MessageSquare } from "lucide-react";
import "./Notifications.css";

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

export default function Notifications({ token }) {
    const [requests, setRequests] = useState([]);
    const [generalNotifications, setGeneralNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("all"); // 'all', 'requests', 'activity'
    const socket = useSocket();
    const navigate = useNavigate();

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token]);

    useEffect(() => {
        if (!socket) return;

        socket.on('new-connection-request', () => {
            fetchRequests();
        });
        
        socket.on('new-notification', () => {
            fetchNotifications();
        });

        return () => {
            socket.off('new-connection-request');
            socket.off('new-notification');
        };
    }, [socket, token]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchRequests(), fetchNotifications()]);
        setLoading(false);
    };

    const fetchRequests = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/connections/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRequests(res.data);
        } catch (err) {
            console.error("Failed to fetch requests", err);
        }
    };

    const fetchNotifications = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGeneralNotifications(res.data);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    const handleAccept = async (requestId) => {
        try {
            await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/connections/accept/${requestId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setRequests(requests.map(req =>
                req._id === requestId ? { ...req, status: 'accepted' } : req
            ));
        } catch (err) {
            console.error("Failed to accept request", err);
        }
    };

    const handleDecline = async (requestId) => {
        try {
            await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/connections/decline/${requestId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setRequests(requests.map(req =>
                req._id === requestId ? { ...req, status: 'declined' } : req
            ));
        } catch (err) {
            console.error("Failed to decline request", err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await axios.put(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/notifications/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGeneralNotifications(generalNotifications.map(n => ({ ...n, read: true })));
        } catch (err) {
            console.error("Failed to mark notifications as read", err);
        }
    };

    const handleClearAll = async () => {
        try {
            await axios.delete(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGeneralNotifications([]);
        } catch (err) {
            console.error("Failed to clear all notifications", err);
        }
    };

    // Deduplication logic to clean up 3x duplicate events
    const requestUserIds = new Set(requests.map(r => r.sender?._id?.toString()).filter(Boolean));

    const cleanedGeneralNotifications = generalNotifications.filter(n => {
        if (!n.message || !n.message.trim()) return false;
        // Skip duplicate connection request notification if request card already exists
        if (n.type === 'connection_request' && n.from && requestUserIds.has(n.from._id?.toString())) {
            return false;
        }
        // Skip duplicate connection accepted notification if request card is accepted
        if (n.type === 'connection_accepted' && n.from) {
            const matchingReq = requests.find(r => r.sender?._id?.toString() === n.from._id?.toString());
            if (matchingReq && matchingReq.status === 'accepted') {
                return false;
            }
        }
        return true;
    });

    // Combine and sort
    const allItems = [
        ...requests.map(r => ({ ...r, itemType: 'request', date: new Date(r.createdAt) })),
        ...cleanedGeneralNotifications.map(n => ({ ...n, itemType: 'notification', date: new Date(n.createdAt) }))
    ].sort((a, b) => b.date - a.date);

    const filteredItems = allItems.filter(item => {
        if (activeTab === 'all') return true;
        if (activeTab === 'requests') return item.itemType === 'request';
        if (activeTab === 'activity') return item.itemType === 'notification';
        return true;
    });

    const formatTimeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return `1d ago`;
        return `${diffDays}d ago`;
    };

    const renderRequestCard = (req) => {
        const user = req.sender;
        if (!user) return null;

        const displayName = user.name || user.username || user.email?.split('@')[0] || "User";
        const initials = getInitials(displayName);
        const fallbackBg = getAvatarGradient(user._id || displayName);

        return (
            <div key={req._id} className={`notification-row request-row ${req.status === 'pending' ? 'unread' : ''}`}>
                <div className="row-content" onClick={() => navigate(`/profile/${user._id}`)}>
                    <div className="row-avatar-wrapper">
                        {user.avatar ? (
                            <div 
                                className="row-avatar" 
                                style={{ backgroundImage: `url("${user.avatar}")` }}
                            />
                        ) : (
                            <div 
                                className="row-avatar fallback"
                                style={{ background: fallbackBg }}
                            >
                                <span>{initials}</span>
                            </div>
                        )}
                        <div className="row-badge-icon request">
                            <UserPlus size={12} />
                        </div>
                    </div>

                    <div className="row-text">
                        <div className="row-title">
                            <span className="username">{displayName}</span>
                        </div>
                        <div className="row-subtitle">
                            {req.status === 'accepted' ? 'You are now connected' : 
                             req.status === 'declined' ? 'Request declined' : 
                             'sent you a connection request'}
                        </div>
                    </div>
                </div>

                <div className="row-aside">
                    {req.status === 'accepted' ? (
                        <div className="status-text success">
                            <Check size={14} /> Connected
                        </div>
                    ) : req.status === 'declined' ? (
                        <div className="status-text error">
                            <X size={14} /> Declined
                        </div>
                    ) : (
                        <div className="row-actions">
                            <button className="action-btn accept" onClick={() => handleAccept(req._id)}>
                                <Check size={14} /> Accept
                            </button>
                            <button className="action-btn decline" onClick={() => handleDecline(req._id)}>
                                Ignore
                            </button>
                        </div>
                    )}
                    <div className="row-time">{formatTimeAgo(req.createdAt)}</div>
                </div>
            </div>
        );
    };

    const renderNotificationCard = (notif) => {
        const user = notif.from;
        const displayName = user ? (user.name || user.username || user.email?.split('@')[0]) : 'Connectify';
        const initials = getInitials(displayName);
        const fallbackBg = getAvatarGradient(user ? (user._id || displayName) : 'system');

        let typeClass = "system-row";
        if (notif.type === 'message') typeClass = "message-row";
        else if (notif.type === 'connection_accepted') typeClass = "success-row";

        return (
            <div key={notif._id} className={`notification-row ${typeClass} ${!notif.read ? 'unread' : ''}`}>
                <div className="row-content" onClick={() => user && navigate(`/profile/${user._id}`)}>
                    <div className="row-avatar-wrapper">
                        {user && user.avatar ? (
                            <div 
                                className="row-avatar" 
                                style={{ backgroundImage: `url("${user.avatar}")` }}
                            />
                        ) : (
                            <div 
                                className="row-avatar fallback"
                                style={{ background: fallbackBg }}
                            >
                                <span>{initials}</span>
                            </div>
                        )}
                        <div className="row-badge-icon activity">
                            <Bell size={12} />
                        </div>
                    </div>

                    <div className="row-text">
                        <div className="row-title">
                            <span className="username">{displayName}</span>
                        </div>
                        <div className="row-subtitle">
                            {notif.message}
                        </div>
                    </div>
                </div>

                <div className="row-aside">
                    {notif.type === 'message' && (
                        <div className="row-actions">
                            <button className="action-btn reply" onClick={() => navigate('/messages')}>
                                <MessageSquare size={14} /> Reply
                            </button>
                        </div>
                    )}
                    <div className="row-time">{formatTimeAgo(notif.createdAt)}</div>
                </div>
            </div>
        );
    };

    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const unreadActivityCount = cleanedGeneralNotifications.filter(n => !n.read).length;

    return (
        <div className="smart-notifications-wrapper">
            <div className="smart-notifications-container">
                {/* Header */}
                <div className="sn-header">
                    <div className="sn-header-left">
                        <div className="sn-bell-icon">
                            <Bell size={22} />
                        </div>
                        <h2>Notifications</h2>
                    </div>

                    <div className="sn-header-actions">
                        <button className="text-btn" onClick={handleMarkAllRead} title="Mark all as read">
                            <CheckCheck size={16} /> Mark read
                        </button>
                        <button className="text-btn danger" onClick={handleClearAll} title="Clear all activity">
                            <Trash2 size={16} /> Clear all
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="sn-tabs">
                    <button 
                        className={`sn-tab ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All
                    </button>
                    <button 
                        className={`sn-tab ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                    >
                        Requests
                        {pendingCount > 0 && (
                            <span className="tab-badge">{pendingCount}</span>
                        )}
                    </button>
                    <button 
                        className={`sn-tab ${activeTab === 'activity' ? 'active' : ''}`}
                        onClick={() => setActiveTab('activity')}
                    >
                        Activity
                        {unreadActivityCount > 0 && (
                            <span className="tab-badge">{unreadActivityCount}</span>
                        )}
                    </button>
                </div>

                {/* List */}
                <div className="sn-list">
                    {loading ? (
                        <div className="sn-loading">
                            <div className="spinner"></div>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="sn-empty">
                            <div className="empty-bell">
                                <Bell size={36} />
                            </div>
                            <h3>You're all caught up!</h3>
                            <p>No new notifications or connection requests right now.</p>
                        </div>
                    ) : (
                        <div className="sn-items-container">
                            {filteredItems.map(item => 
                                item.itemType === 'request' ? renderRequestCard(item) : renderNotificationCard(item)
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

