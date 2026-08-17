import React, { useState, useEffect } from 'react';
import { Radio, X, Sparkles, Users, Clock, Flame, Plus, ArrowRight, History } from 'lucide-react';
import { getRoomArchives } from '../services/api';
import { useSocket } from '../context/SocketContext';
import './Rooms.css';

function Rooms({ onJoinRoom, onCreateRoom }) {
    const socket = useSocket();
    const [activeMicroRooms, setActiveMicroRooms] = useState([]);
    const [archivedRooms, setArchivedRooms] = useState([]);

    // Modal state
    const [showMicroRoomModal, setShowMicroRoomModal] = useState(false);
    const [microRoomForm, setMicroRoomForm] = useState({ title: '', durationHours: 1 });

    useEffect(() => {
        const fetchArchives = async () => {
            try {
                const data = await getRoomArchives();
                setArchivedRooms(data);
            } catch (error) {
                console.error('Failed to fetch room archives:', error);
            }
        };
        fetchArchives();
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleActiveMicroRoomsData = (roomsData) => {
            setActiveMicroRooms(roomsData);
        };

        const handleMicroRoomCreated = (room) => {
            setActiveMicroRooms(prev => [...prev, room]);
        };

        const handleMicroRoomExpired = (roomId) => {
            setActiveMicroRooms(prev => prev.filter(r => r._id !== roomId));
        };

        socket.on('active-micro-rooms-data', handleActiveMicroRoomsData);
        socket.on('micro-room-created', handleMicroRoomCreated);
        socket.on('micro-room-expired', handleMicroRoomExpired);

        // Initial fetch
        socket.emit('get-active-micro-rooms');

        return () => {
            socket.off('active-micro-rooms-data', handleActiveMicroRoomsData);
            socket.off('micro-room-created', handleMicroRoomCreated);
            socket.off('micro-room-expired', handleMicroRoomExpired);
        };
    }, [socket]);

    return (
        <div className="rooms-page">
            <div className="rooms-header-section">
                <div className="rooms-header-left">
                    <div className="rooms-header-icon">
                        <Radio size={22} />
                    </div>
                    <div>
                        <h2>Micro Rooms</h2>
                        <p className="rooms-subtitle">Ephemeral audio & chat spaces that auto-expire</p>
                    </div>
                </div>

                <button className="create-room-btn" onClick={() => {
                    if (onCreateRoom) {
                        onCreateRoom();
                    } else {
                        setShowMicroRoomModal(true);
                    }
                }}>
                    <Plus size={16} /> Create Room
                </button>
            </div>

            <div className="rooms-list-scroll">
                {activeMicroRooms.length > 0 ? (
                    <div className="rooms-section">
                        <div className="rooms-section-header">
                            <h4 className="rooms-section-title">
                                <Flame size={16} className="title-fire-icon" /> Live & Trending Spaces
                            </h4>
                            <span className="live-count-badge">{activeMicroRooms.length} Active</span>
                        </div>

                        <div className="rooms-grid">
                            {activeMicroRooms.map(r => {
                                const score = (r.stats?.messageCount * 2 || 0) + ((r.participants?.length || 1) * 3) + (r.stats?.reactionCount || 0);
                                const isTrending = score >= 15;
                                const diffStr = r.expiresAt ? (
                                    (() => {
                                        const diff = new Date(r.expiresAt) - new Date();
                                        if (diff <= 0) return '0m';
                                        const mins = Math.floor(diff / 60000);
                                        return mins > 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`;
                                    })()
                                ) : '';

                                const participantCount = r.participants?.length || 1;

                                return (
                                    <div 
                                        key={r._id} 
                                        className={`room-card ${isTrending ? 'trending' : ''}`} 
                                        onClick={() => {
                                            if (onJoinRoom) {
                                                onJoinRoom(r._id);
                                            } else {
                                                socket?.emit('join-micro-room', { roomId: r._id });
                                            }
                                        }}
                                    >
                                        <div className="room-card-top">
                                            <div className="room-badge-group">
                                                <span className="live-pulse-badge">
                                                    <span className="pulse-dot"></span> LIVE
                                                </span>
                                                {isTrending && (
                                                    <span className="trending-badge">
                                                        <Flame size={12} /> Hot
                                                    </span>
                                                )}
                                            </div>

                                            {diffStr && (
                                                <span className="time-left-chip">
                                                    <Clock size={12} /> {diffStr} left
                                                </span>
                                            )}
                                        </div>

                                        <div className="room-card-body">
                                            <h3 className="room-card-title">{r.title}</h3>
                                        </div>

                                        <div className="room-card-footer">
                                            <div className="room-meta-pill">
                                                <Users size={13} />
                                                <span>{participantCount} {participantCount === 1 ? 'user' : 'users'} active</span>
                                            </div>

                                            <div className="join-room-action">
                                                <span>Join</span>
                                                <ArrowRight size={14} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="no-rooms-state">
                        <div className="empty-radio-icon">
                            <Radio size={32} />
                        </div>
                        <h3>No active micro rooms right now</h3>
                        <p>Create a temporary audio/chat room for your community or friends to hang out.</p>
                        <button className="empty-create-btn" onClick={() => setShowMicroRoomModal(true)}>
                            <Plus size={16} /> Create Micro Room
                        </button>
                    </div>
                )}

                {archivedRooms.length > 0 && (
                    <div className="rooms-archive-section">
                        <h4 className="rooms-section-title">
                            <History size={16} /> Your Archives
                        </h4>
                        <div className="rooms-grid">
                            {archivedRooms.map((r, idx) => (
                                <div key={`archive-${idx}`} className="room-card archive-card">
                                    <div className="room-card-top">
                                        <span className="archive-chip">Ended</span>
                                    </div>
                                    <h3 className="room-card-title">{r.title}</h3>
                                    <div className="room-meta-pill">
                                        <Users size={13} />
                                        <span>Peak: {r.peakParticipants || 0} users • {r.durationHours || 1}h</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MICRO ROOM CREATE MODAL */}
            {
                showMicroRoomModal && (
                    <div className="micro-room-overlay" onClick={(e) => e.target === e.currentTarget && setShowMicroRoomModal(false)}>
                        <div className="micro-room-modal">
                            <div className="mr-header">
                                <div className="mr-header-title">
                                    <div className="mr-header-icon">
                                        <Radio size={18} />
                                    </div>
                                    <span>Create Micro Room</span>
                                </div>
                                <button className="mr-close-btn" onClick={() => setShowMicroRoomModal(false)} aria-label="Close">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="mr-field">
                                <label className="mr-label">Room Title</label>
                                <input
                                    type="text"
                                    className="mr-input"
                                    placeholder="E.g. Weekend Plans"
                                    value={microRoomForm.title}
                                    onChange={(e) => setMicroRoomForm({ ...microRoomForm, title: e.target.value })}
                                    autoFocus
                                />
                            </div>

                            <div className="mr-field">
                                <label className="mr-label">Duration</label>
                                <div className="duration-chips-grid">
                                    {[
                                        { hours: 1, label: '1 Hour' },
                                        { hours: 3, label: '3 Hours' },
                                        { hours: 6, label: '6 Hours' },
                                        { hours: 24, label: '24 Hours' }
                                    ].map(option => (
                                        <button
                                            key={option.hours}
                                            type="button"
                                            className={`duration-chip ${microRoomForm.durationHours === option.hours ? 'active' : ''}`}
                                            onClick={() => setMicroRoomForm({ ...microRoomForm, durationHours: option.hours })}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mr-footer">
                                <button
                                    className="mr-cancel-btn"
                                    onClick={() => setShowMicroRoomModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="mr-submit-btn"
                                    onClick={() => {
                                        if (!microRoomForm.title.trim()) return;
                                        socket?.emit('create-micro-room', {
                                            parentChatId: 'global',
                                            title: microRoomForm.title,
                                            durationHours: microRoomForm.durationHours
                                        });
                                        setShowMicroRoomModal(false);
                                        setMicroRoomForm({ title: '', durationHours: 1 });
                                    }}
                                >
                                    <Sparkles size={16} /> Create Room
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}

export default Rooms;
