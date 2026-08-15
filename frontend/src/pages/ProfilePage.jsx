import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import UserProfile from "../components/UserProfile";
import { useSocket } from "../context/SocketContext";

export default function ProfilePage({ token }) {
    const { id } = useParams();
    const [currentUser, setCurrentUser] = useState(null);
    const [displayUser, setDisplayUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userStatuses, setUserStatuses] = useState({});
    const socket = useSocket();

    useEffect(() => {
        const fetchProfileData = async () => {
            try {
                const tokenHeaders = { headers: { Authorization: `Bearer ${token}` } };
                
                // Fetch me and presence in parallel
                const [meRes, presenceRes] = await Promise.all([
                    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/me`, tokenHeaders),
                    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/auth/presence`, tokenHeaders)
                ]);
                
                setCurrentUser(meRes.data);

                // Initialize statuses
                const statusMap = {};
                presenceRes.data.forEach(u => {
                    statusMap[u._id] = { online: u.online, lastSeen: u.lastSeen };
                });
                
                // Ensure current user is marked online locally if they are the viewer
                if (meRes.data && meRes.data._id) {
                    statusMap[meRes.data._id] = { online: true };
                }
                
                setUserStatuses(statusMap);

                if (id && id !== meRes.data._id) {
                    const userRes = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/users/${id}`, tokenHeaders);
                    setDisplayUser(userRes.data);
                } else {
                    setDisplayUser(meRes.data);
                }
            } catch (error) {
                console.error("Failed to fetch profile data", error);
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchProfileData();
    }, [token, id]);

    useEffect(() => {
        if (!socket) return;

        const handleAuraUpdate = ({ userId, aura }) => {
            if (currentUser && userId?.toString() === currentUser._id?.toString()) {
                setCurrentUser(prev => ({ ...prev, aura }));
            }
            if (displayUser && userId?.toString() === displayUser._id?.toString()) {
                setDisplayUser(prev => ({ ...prev, aura }));
            }
        };

        const handleOnlineUsers = (userIds) => {
            setUserStatuses(prev => {
                const newStatuses = { ...prev };
                userIds.forEach(uid => {
                    newStatuses[uid] = { ...newStatuses[uid], online: true };
                });
                return newStatuses;
            });
        };

        const handleUserOffline = ({ userId, lastSeen }) => {
            setUserStatuses(prev => ({
                ...prev,
                [userId]: { ...prev[userId], online: false, lastSeen }
            }));
        };

        const handleStatusChanged = ({ userId, online, lastSeen }) => {
            setUserStatuses(prev => ({
                ...prev,
                [userId]: { ...prev[userId], online, lastSeen }
            }));
        };

        socket.on('aura-updated', handleAuraUpdate);
        socket.on('online-users', handleOnlineUsers);
        socket.on('user-offline', handleUserOffline);
        socket.on('user-online-status-changed', handleStatusChanged);

        return () => {
            socket.off('aura-updated', handleAuraUpdate);
            socket.off('online-users', handleOnlineUsers);
            socket.off('user-offline', handleUserOffline);
            socket.off('user-online-status-changed', handleStatusChanged);
        };
    }, [socket, currentUser, displayUser]);

    const handleProfileUpdate = (updatedUser) => {
        if (updatedUser._id === currentUser?._id) setCurrentUser(updatedUser);
        if (updatedUser._id === displayUser?._id) setDisplayUser(updatedUser);
    };

    const handleSetAura = (auraData) => {
        if (socket) {
            socket.emit('set-aura', auraData);
        }
    };

    if (loading || !currentUser || !displayUser) {
        return <div style={{ padding: "40px", textAlign: "center", color: "#888" }}>Loading profile...</div>;
    }

    return (
        <div style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(180deg, #0b1220 0%, #0e1628 100%)",
            overflowY: "auto"
        }}>
            <UserProfile
                user={displayUser}
                currentUser={currentUser}
                userStatuses={userStatuses}
                isFullTab={true}
                showOverlay={false}
                onProfileUpdate={handleProfileUpdate}
                onSetAura={handleSetAura}
                onClose={() => { window.history.back(); }}
            />
        </div>
    );
}
