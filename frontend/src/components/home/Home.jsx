import { useEffect, useState } from "react";
import axios from "axios";
import { useSocket } from "../../context/SocketContext";
import "./Home.css";
import DiscoverGrid from "./DiscoverGrid";
import SearchBar from "../SearchBar";

export default function Home({ token }) {
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [sentRequests, setSentRequests] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [activeRooms, setActiveRooms] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const socket = useSocket();

    useEffect(() => {
        const fetchData = async () => {
            const tokenHeaders = { headers: { Authorization: `Bearer ${token}` } };
            try {
                const [meRes, allUsersRes, sentRes, presenceRes] = await Promise.all([
                    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/me`, tokenHeaders),
                    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/users`, tokenHeaders),
                    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/connections/sent`, tokenHeaders),
                    axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/auth/presence`, tokenHeaders)
                ]);

                setCurrentUser(meRes.data);
                setSentRequests(sentRes.data);

                // Build simple Set of online user IDs
                const onlineSet = new Set(presenceRes.data.filter(u => u.online).map(u => u._id));
                setOnlineUsers(onlineSet);

                let filtered = allUsersRes.data.filter(
                    user => user._id !== meRes.data._id
                );

                // Smart Discovery Sorting:
                // 1. Online users first
                // 2. Has aura set
                // 3. Fallback
                filtered.sort((a, b) => {
                    const aOnline = onlineSet.has(a._id) ? 1 : 0;
                    const bOnline = onlineSet.has(b._id) ? 1 : 0;
                    if (aOnline !== bOnline) return bOnline - aOnline;

                    const aAura = (a.aura && a.aura.type) ? 1 : 0;
                    const bAura = (b.aura && b.aura.type) ? 1 : 0;
                    return bAura - aAura;
                });

                setUsers(filtered);

            } catch (err) {
                console.error("Failed to fetch discovery data", err);
            }
        };

        fetchData();
    }, [token]);

    useEffect(() => {
        if (!socket || !token) return;

        socket.on('connection-accepted', () => {
            // Re-fetch users to remove the newly connected user from Home
            const fetchData = async () => {
                const me = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/me`, { headers: { Authorization: `Bearer ${token}` } });
                const allUsers = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/users`, { headers: { Authorization: `Bearer ${token}` } });
                setCurrentUser(me.data);
                const filtered = allUsers.data.filter(user => user._id !== me.data._id);
                setUsers(filtered);
            };
            fetchData().catch(console.error);
        });

        // Listen for global presence updates
        socket.on('online-users', (userIds) => {
            setOnlineUsers(new Set(userIds));
        });

        socket.on('user-offline', ({ userId }) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        });

        socket.on('aura-updated', ({ userId, aura }) => {
            setUsers(prev => prev.map(u => u._id?.toString() === userId?.toString() ? { ...u, aura } : u));
        });

        socket.on('active-micro-rooms-data', (rooms) => {
            setActiveRooms(rooms);
        });

        // Request active rooms on mount
        socket.emit('get-active-micro-rooms');

        return () => {
            socket.off('connection-accepted');
            socket.off('online-users');
            socket.off('user-offline');
            socket.off('aura-updated');
            socket.off('active-micro-rooms-data');
        };
    }, [socket, token]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/users/search?username=${searchQuery.trim()}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSearchResults(res.data);
            } catch (err) {
                console.error("Search failed", err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, token]);

    return (
        <div className="home-wrapper">
            <div className="home-container">
                <SearchBar value={searchQuery} onChange={setSearchQuery} />

                {isSearching ? (
                    <p style={{ textAlign: "center", color: "#888", padding: "40px" }}>Searching...</p>
                ) : (
                    <DiscoverGrid
                        users={searchQuery.trim() ? searchResults : users}
                        currentUser={currentUser}
                        sentRequests={sentRequests}
                        onlineUsers={onlineUsers}
                        activeRooms={activeRooms}
                    />
                )}
            </div>
        </div>
    );
}
