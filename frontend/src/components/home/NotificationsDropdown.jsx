import React, { useState, useEffect } from "react";
import axios from "axios";
import { useSocket } from "../../context/SocketContext";

export default function NotificationsDropdown({ token }) {
    const [isOpen, setIsOpen] = useState(false);
    const [requests, setRequests] = useState([]);
    const socket = useSocket();

    useEffect(() => {
        if (isOpen && token) {
            fetchRequests();
        }
    }, [isOpen, token]);

    useEffect(() => {
        if (!socket) return;

        socket.on('new-connection-request', () => {
            // Re-fetch to get details of the sender
            fetchRequests();
        });

        return () => {
            socket.off('new-connection-request');
        };
    }, [socket, token]);

    const fetchRequests = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/connections/pending`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRequests(res.data);
        } catch (err) {
            console.error("Failed to fetch requests", err);
        }
    };

    const handleAccept = async (requestId) => {
        try {
            await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/connections/accept/${requestId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Remove the accepted request from the list
            setRequests(requests.filter(req => req._id !== requestId));

            // Optionally could trigger a re-fetch of current user to update connections
            window.location.reload(); // Simple way to refresh chats/connections for now
        } catch (err) {
            console.error("Failed to accept request", err);
        }
    };

    return (
        <div style={{ position: "relative" }}>
            <span
                onClick={() => setIsOpen(!isOpen)}
                style={{ cursor: "pointer", position: "relative" }}
            >
                🔔
                {requests.length > 0 && (
                    <span style={{
                        position: "absolute",
                        top: "-5px",
                        right: "-5px",
                        background: "red",
                        color: "white",
                        borderRadius: "50%",
                        width: "14px",
                        height: "14px",
                        fontSize: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        {requests.length}
                    </span>
                )}
            </span>

            {isOpen && (
                <div style={{
                    position: "absolute",
                    top: "30px",
                    right: "0",
                    background: "var(--color-bg-surface, #1e293b)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    width: "300px",
                    padding: "10px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    zIndex: 1000,
                    maxHeight: "400px",
                    overflowY: "auto"
                }}>
                    <h4 style={{ margin: "0 0 10px 0", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "10px" }}>
                        Connection Requests
                    </h4>

                    {requests.length === 0 ? (
                        <p style={{ color: "#888", textAlign: "center", margin: "20px 0" }}>No new requests</p>
                    ) : (requests.map(req => (
                        <div key={req._id} style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.05)"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{
                                    width: "30px", height: "30px", borderRadius: "50%",
                                    background: req.sender.avatar ? `url(${req.sender.avatar}) center/cover` : "#ccc",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "12px", color: "#333"
                                }}>
                                    {!req.sender.avatar && (req.sender.name || req.sender.email).charAt(0).toUpperCase()}
                                </div>
                                <div style={{ fontSize: "14px" }}>
                                    <div>{req.sender.name || req.sender.email}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleAccept(req._id)}
                                style={{
                                    background: "#2ecc71",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "5px 10px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    fontWeight: "bold"
                                }}
                            >
                                Accept
                            </button>
                        </div>
                    )))}
                </div>
            )}
        </div>
    );
}
