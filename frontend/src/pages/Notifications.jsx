import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import "./Notifications.css";

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
        
        // Also listen to general notification events if backend emits them
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

            // Update the accepted request status locally to avoid full refetch
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

            // Update the request status locally
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
            
            // Local update
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
            
            // Local update (we only clear general notifications, connection requests stay until handled?) 
            // Better to clear only general notifications as connection requests are managed via Connections API
            setGeneralNotifications([]);
        } catch (err) {
            console.error("Failed to clear all notifications", err);
        }
    };
    
    // Combine and sort
    const allItems = [
        ...requests.map(r => ({ ...r, itemType: 'request', date: new Date(r.createdAt) })),
        ...generalNotifications.map(n => ({ ...n, itemType: 'notification', date: new Date(n.createdAt) }))
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
        const userName = user.name || user.email;
        const initial = userName.charAt(0).toUpperCase();
        
        return (
            <div key={req._id} className={`notification-row request-row ${req.status === 'pending' ? 'unread' : ''}`}>
                <div className="row-content" onClick={() => navigate(`/profile/${user._id}`)}>
                    <div className="row-avatar" style={{
                        backgroundImage: user.avatar ? `url("${user.avatar}")` : 'none',
                        backgroundColor: user.avatar ? 'transparent' : 'var(--color-bg-active, #333)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}>
                        {!user.avatar && initial}
                    </div>
                    <div className="row-text">
                        <div className="row-title">
                            <span className="username">{userName}</span>
                        </div>
                        <div className="row-subtitle">
                            {req.status === 'accepted' ? 'You are now connected' : 
                             req.status === 'declined' ? 'Request declined' : 
                             'wants to connect with you'}
                        </div>
                    </div>
                </div>
                
                <div className="row-aside">
                    {req.status === 'accepted' ? (
                        <div className="status-text success">
                            <span className="icon">✓</span> Connected
                        </div>
                    ) : req.status === 'declined' ? (
                        <div className="status-text error">
                            <span className="icon">✕</span> Declined
                        </div>
                    ) : (
                        <div className="row-actions">
                            <button className="action-btn accept" onClick={() => handleAccept(req._id)}>Accept</button>
                            <button className="action-btn decline" onClick={() => handleDecline(req._id)}>Ignore</button>
                        </div>
                    )}
                    <div className="row-time">{formatTimeAgo(req.createdAt)}</div>
                </div>
            </div>
        );
    };

    const renderNotificationCard = (notif) => {
        const user = notif.from;
        const userName = user ? (user.name || user.email) : 'System';
        const initial = userName.charAt(0).toUpperCase();
        
        let typeClass = "system-row";
        if (notif.type === 'message') typeClass = "message-row";
        else if (notif.type === 'connection_accepted') typeClass = "success-row";
        
        return (
            <div key={notif._id} className={`notification-row ${typeClass} ${!notif.read ? 'unread' : ''}`}>
                <div className="row-content" onClick={() => user && navigate(`/profile/${user._id}`)}>
                    <div className="row-avatar" style={{
                        backgroundImage: (user && user.avatar) ? `url("${user.avatar}")` : 'none',
                        backgroundColor: (user && user.avatar) ? 'transparent' : 'var(--color-bg-active, #333)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}>
                        {!(user && user.avatar) && initial}
                    </div>
                    <div className="row-text">
                        <div className="row-title">
                            <span className="username">{userName}</span>
                        </div>
                        <div className="row-subtitle">
                            {notif.message}
                        </div>
                    </div>
                </div>
                
                <div className="row-aside">
                    {notif.type === 'message' && (
                        <div className="row-actions">
                            <button className="action-btn reply" onClick={() => navigate('/messages')}>Reply</button>
                        </div>
                    )}
                    <div className="row-time">{formatTimeAgo(notif.createdAt)}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="smart-notifications-wrapper">
            <div className="smart-notifications-container">
                {/* Header */}
                <div className="sn-header">
                    <h2>Notifications</h2>
                    <div className="sn-header-actions">
                        <button className="text-btn" onClick={handleMarkAllRead}>Mark all as read</button>
                        <button className="text-btn danger" onClick={handleClearAll}>Clear all</button>
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
                        {requests.filter(r => r.status === 'pending').length > 0 && (
                            <span className="tab-badge">{requests.filter(r => r.status === 'pending').length}</span>
                        )}
                    </button>
                    <button 
                        className={`sn-tab ${activeTab === 'activity' ? 'active' : ''}`}
                        onClick={() => setActiveTab('activity')}
                    >
                        Activity
                        {generalNotifications.filter(n => !n.read).length > 0 && (
                            <span className="tab-badge">{generalNotifications.filter(n => !n.read).length}</span>
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
                            <div className="empty-bell">🔔</div>
                            <h3>You're all caught up</h3>
                            <p>No new notifications</p>
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
