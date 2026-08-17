import UserCard from "./UserCard";
import { UserX } from "lucide-react";

export default function DiscoverGrid({ users, currentUser, sentRequests, onlineUsers, activeRooms }) {
    if (!users || !users.length) {
        return (
            <div className="empty-discover-state">
                <div className="empty-icon-wrapper">
                    <UserX size={32} />
                </div>
                <h3>No members found</h3>
                <p>Try searching for a different username or check back later.</p>
            </div>
        );
    }

    return (
        <div className="discover-grid">
            {users.map(user => {
                const isOnline = onlineUsers ? onlineUsers.has(user._id) : false;
                const isInRoom = activeRooms ? activeRooms.some(r => r.participants.includes(user._id)) : false;

                return (
                    <UserCard
                        key={user._id}
                        user={user}
                        currentUser={currentUser}
                        sentRequests={sentRequests}
                        isOnline={isOnline}
                        isInRoom={isInRoom}
                    />
                );
            })}
        </div>
    );
}

