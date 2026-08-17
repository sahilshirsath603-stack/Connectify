import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Radio, X, Sparkles } from 'lucide-react';
import './Chat.css';
import './Chat_Modals.css';
import axios from 'axios';
import api, { getMe, getUsers } from '../services/api';
import EmojiPicker from 'emoji-picker-react';
import GroupProfile from './GroupProfile';
import UserProfile from '../components/UserProfile';
import MessageBubble from '../components/MessageBubble';
import MessageContextMenu from '../components/MessageContextMenu';
import AvatarViewerModal from '../components/AvatarViewerModal';
import MediaViewerModal from '../components/MediaViewerModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { io } from 'socket.io-client';

import BottomCommandDock from '../components/BottomCommandDock';
import Rooms from '../components/Rooms';
import MediaTabContent from './MediaTabContent';
import Icon from '../components/ui/Icon';
import { APP_ICONS } from '../constants/icons';
import { ICON_SIZES } from '../constants/iconSizes';

// Theme constants
const THEME_CHHAYA = 'chhaya';
const THEME_PRAKASH = 'prakash';

// Helper functions for timestamps and date separators
const formatTime = (createdAt) => {
  return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const getDateLabel = (dateString) => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (dateString === today) return 'Today';
  if (dateString === yesterday) return 'Yesterday';
  return new Date(dateString).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
};

function Chat({ token, onLogout, theme, toggleTheme }) {
  const { id: routeId } = useParams();
  const navigate = useNavigate();

  // Decode userId from JWT
  const getMyUserId = () => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId;
    } catch {
      return null;
    }
  };
  const myUserId = getMyUserId();

  const refreshConnections = useCallback(async () => {
    try {
      // Fetch current user data
      const userData = await getMe();
      setLoggedInUser(userData);

      // Fetch users list
      const usersData = await getUsers();
      const connectedUsers = usersData.filter(u =>
        u._id !== userData._id && u.isConnected
      );
      setUsers(connectedUsers);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

  // Store token in localStorage for api interceptor
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    }
  }, [token]);

  // Initialize socket once
  useEffect(() => {
    socketRef.current = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001', {
      auth: {
        token: localStorage.getItem("token"),
      },
    });

    socketRef.current.on("connect_error", (err) => {
      if (err.message === "Unauthorized") {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    });

    // Prevent default browser context menu globally within chat
    const preventContext = (e) => e.preventDefault();
    document.addEventListener("contextmenu", preventContext);

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      document.removeEventListener("contextmenu", preventContext);
    };
  }, []);

  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.pathname.startsWith('/rooms') ? 'rooms' : (location.pathname.startsWith('/messages') || location.pathname === '/messages' ? 'chats' : 'chats'));

  // State Declarations
  const socketRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [userStatuses, setUserStatuses] = useState({});
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState({});
  const [groups, setGroups] = useState([]);
  const [text, setText] = useState('');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGroupProfile, setShowGroupProfile] = useState(false);
  const [groupProfileData, setGroupProfileData] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [mediaMessages, setMediaMessages] = useState([]);
  const [mediaTab, setMediaTab] = useState('media');
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [deleteMessageConfirm, setDeleteMessageConfirm] = useState(null);
  const [leaveRoomConfirm, setLeaveRoomConfirm] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showGroupAttachMenu, setShowGroupAttachMenu] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [headerHover, setHeaderHover] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [selectedAvatarUser, setSelectedAvatarUser] = useState(null);
  const [selectedAuraUser, setSelectedAuraUser] = useState(null);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [showMicroRoomModal, setShowMicroRoomModal] = useState(false);
  const [microRoomForm, setMicroRoomForm] = useState({ title: '', durationHours: 1 });
  const [activeMicroRooms, setActiveMicroRooms] = useState([]);
  const [currentMicroRoom, setCurrentMicroRoom] = useState(null);
  const [microRoomMessages, setMicroRoomMessages] = useState({});
  const [microRoomText, setMicroRoomText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);

  const fileInputRef = useRef(null);
  const presenceIntervalRef = useRef(null);
  const microRoomScrollRef = useRef(null);

  // Helper functions
  const getChatId = (userId, groupId) => {
    if (userId) {
      return [myUserId, userId].sort().join('-');
    } else if (groupId) {
      return groupId;
    }
    return null;
  };

  const getMessagePreview = (msg) => {
    if (msg.type === 'text') return msg.text;
    if (msg.type === 'image') return '📷 Photo';
    if (msg.type === 'video') return '📷 Video';
    if (msg.type === 'audio') return '🎤 Voice message';
    if (msg.type === 'file') return '📎 File';
    return '';
  };

  const getOnlineStatus = (userId) => {
    const status = userStatuses[userId];
    if (status?.online) return 'Online';
    if (status?.lastSeen) {
      const lastSeenDate = new Date(status.lastSeen);
      return `Last seen ${lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Offline';
  };

  function formatLastSeen(date) {
    if (!date) return "Offline";
    const d = new Date(date);
    return `Last seen ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  const fetchMessages = async (chatId) => {
    if (!chatId) return;
    try {
      const res = await api.get(`/messages?chatId=${chatId}`);
      setMessages(res.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Effects

  useEffect(() => {
    if (location.pathname.startsWith('/rooms')) {
      setActiveTab('rooms');
    } else if (location.pathname === '/messages' || location.pathname.startsWith('/messages/')) {
      setActiveTab(prev => prev === 'rooms' ? 'chats' : prev);
    }
  }, [location.pathname]);
  useEffect(() => {
    if (!socketRef.current) return;

    const handleTyping = (data) => {
      // Only show typing if it's for the current chat/group/room
      const currentChatId = selectedGroup ? selectedGroup._id : (selectedUser ? getChatId(selectedUser._id) : (currentMicroRoom?._id));
      if (data.chatId === currentChatId && data.senderId !== (loggedInUser?._id)) { 
        setTypingUser(data.senderId);
      }
    };

    const handleStopTyping = (data) => {
      const currentChatId = selectedGroup ? selectedGroup._id : (selectedUser ? getChatId(selectedUser._id) : (currentMicroRoom?._id));
      if (data.chatId === currentChatId) {
        setTypingUser(null);
      }
    };



    socketRef.current.on("typing", handleTyping);
    socketRef.current.on("stop-typing", handleStopTyping);
    socketRef.current.on("connection-accepted", refreshConnections);

    return () => {
      socketRef.current?.off("typing", handleTyping);
      socketRef.current?.off("stop-typing", handleStopTyping);
      socketRef.current?.off("connection-accepted", refreshConnections);
    };
  }, [selectedUser, selectedGroup, currentMicroRoom, loggedInUser, refreshConnections]); // Re-bind when active chat changes to ensure logic is correct (or just check inside)
  // Actually, capturing 'selectedUser' in closure is needed if I use it in the callback.

  // Socket listeners for Auras
  useEffect(() => {
    if (!socketRef.current) return;

    const handleAuraUpdate = ({ userId, aura }) => {
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, aura } : u));
      if (myUserId === userId) {
        setLoggedInUser(prev => prev ? { ...prev, aura } : prev);
      }
      if (selectedUser && selectedUser._id === userId) {
        setSelectedUser(prev => prev ? { ...prev, aura } : prev);
      }
    };

    const handleAurasExpired = () => {
      // Simplest way is let next refetch handle it, or clear all locally.
      // We'll trust the periodic API fetch to refresh it or clear them off.
    };

    socketRef.current.on('aura-updated', handleAuraUpdate);
    socketRef.current.on('auras-expired', handleAurasExpired);

    // Micro Rooms Listeners
    const handleMicroRoomCreated = (room) => {
      setActiveMicroRooms(prev => [...prev, room]);
    };
    const handleMicroRoomExpired = (roomId) => {
      setActiveMicroRooms(prev => prev.filter(r => r._id !== roomId));
      setCurrentMicroRoom(prev => (prev && prev._id === roomId) ? null : prev);
    };
    const handleMicroRoomJoined = (room) => {
      setCurrentMicroRoom(room);
      setMicroRoomMessages(prev => ({ ...prev, [room._id]: [] }));
    };
    const handleMicroRoomMessages = ({ roomId, messages: roomMsgs }) => {
      setMicroRoomMessages(prev => ({ ...prev, [roomId]: roomMsgs }));
    };
    const handleReceiveMicroMessage = (msg) => {
      setMicroRoomMessages(prev => {
        const roomMsgs = prev[msg.roomId] || [];
        return { ...prev, [msg.roomId]: [...roomMsgs, msg] };
      });
    };
    const handleActiveMicroRoomsData = (roomsData) => {
      setActiveMicroRooms(roomsData);
    };

    socketRef.current.on('micro-room-created', handleMicroRoomCreated);
    socketRef.current.on('micro-room-expired', handleMicroRoomExpired);
    socketRef.current.on('micro-room-joined', handleMicroRoomJoined);
    socketRef.current.on('micro-room-messages', handleMicroRoomMessages);
    socketRef.current.on('receive-micro-message', handleReceiveMicroMessage);
    socketRef.current.on('active-micro-rooms-data', handleActiveMicroRoomsData);

    // Initial fetch of active global rooms
    socketRef.current.emit('get-active-micro-rooms');

    return () => {
      socketRef.current?.off('aura-updated', handleAuraUpdate);
      socketRef.current?.off('auras-expired', handleAurasExpired);
      socketRef.current?.off('micro-room-created', handleMicroRoomCreated);
      socketRef.current?.off('micro-room-expired', handleMicroRoomExpired);
      socketRef.current?.off('micro-room-joined', handleMicroRoomJoined);
      socketRef.current?.off('micro-room-messages', handleMicroRoomMessages);
      socketRef.current?.off('receive-micro-message', handleReceiveMicroMessage);
      socketRef.current?.off('active-micro-rooms-data', handleActiveMicroRoomsData);
    };
  }, [myUserId, selectedUser]);


  // Handle media click
  const handleMediaClick = (media) => {
    // Get all media messages for the current chat
    let chatMediaMessages = [];
    if (selectedUser) {
      chatMediaMessages = messages.filter(m => (m.senderId === selectedUser._id || m.receiverId === selectedUser._id) && (m.type === 'image' || m.type === 'video'));
    } else if (selectedGroup) {
      chatMediaMessages = groupMessages[selectedGroup._id] ? groupMessages[selectedGroup._id].filter(m => m.type === 'image' || m.type === 'video') : [];
    }

    // Find the index of the clicked media
    const startIndex = chatMediaMessages.findIndex(m => m._id === media._id);

    setSelectedMedia({ mediaMessages: chatMediaMessages, startIndex });
    setShowMediaViewer(true);
  };

  // Handle profile update callback
  const handleProfileUpdate = async (updatedUser) => {
    // Update currentUser state
    setLoggedInUser(updatedUser);

    // Update users[] by replacing the updated user
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user._id === updatedUser._id ? updatedUser : user
      )
    );
  };

  // Helper functions for timestamps and date separators



  // Fetch messages when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      const chatId = getChatId(selectedUser._id);
      fetchMessages(chatId);
    }
  }, [selectedUser, myUserId]);

  // Sync route param with selection state
  useEffect(() => {
    if (routeId) {
      const user = users.find(u => u._id === routeId);
      if (user) {
        setSelectedUser(user);
        setSelectedGroup(null);
        setCurrentMicroRoom(null);
      } else {
        const group = groups.find(g => g._id === routeId);
        if (group) {
          setSelectedGroup(group);
          setSelectedUser(null);
          setCurrentMicroRoom(null);
        } else {
          const room = activeMicroRooms.find(r => r._id === routeId);
          if (room) {
            setCurrentMicroRoom(room);
            setSelectedUser(null);
            setSelectedGroup(null);
            // Join room if not already in it?
            socketRef.current?.emit('join-micro-room', { roomId: room._id });
          }
        }
      }
    } else {
      setSelectedUser(null);
      setSelectedGroup(null);
      if (location.pathname !== '/rooms') {
        setCurrentMicroRoom(null);
      }
    }
  }, [routeId, users, groups, activeMicroRooms]);



  // Fetch current user and users list on mount
  useEffect(() => {
    if (!token) return;
    refreshConnections();
  }, [token, refreshConnections]);

  // Poll /api/presence every 3 seconds
  useEffect(() => {
    if (!token || !myUserId) return;

    const fetchPresence = () => {
      axios
        .get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/auth/presence`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        .then((res) => {
          const presenceMap = {};
          res.data.forEach((p) => {
            presenceMap[p._id] = { online: p.online, lastSeen: p.lastSeen };
          });
          setUserStatuses(presenceMap);

          // Update users list with lastSeen
          setUsers((prevUsers) =>
            prevUsers.map((u) => ({
              ...u,
              lastSeen: presenceMap[u._id]?.lastSeen || u.lastSeen
            }))
          );
        })
        .catch(console.error);
    };

    fetchPresence(); // Initial fetch
    presenceIntervalRef.current = setInterval(fetchPresence, 3000);

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
    };
  }, [token, myUserId]);

  // Register socket listeners once
  useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.off('receive-message');
    socketRef.current.on('receive-message', (msg) => {
      setMessages((prev) => {
        // Replace temp message if exists
        const tempIndex = prev.findIndex((m) => m._id.startsWith('temp-') && m.text === msg.text && m.senderId === msg.senderId);
        if (tempIndex !== -1) {
          const newMessages = [...prev];
          newMessages[tempIndex] = msg;
          return newMessages;
        }
        // Avoid duplicates
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });

      // Update last messages
      const chatId = getChatId(msg.senderId);
      setLastMessages((prev) => ({
        ...prev,
        [chatId]: { preview: getMessagePreview(msg), timestamp: new Date(msg.createdAt) }
      }));
    });

    socketRef.current.off('user-typing');
    socketRef.current.on('user-typing', ({ senderId }) => {
      if (selectedUser && senderId === selectedUser._id) {
        setIsTyping(true);
      }
    });

    socketRef.current.off('user-stop-typing');
    socketRef.current.on('user-stop-typing', ({ senderId }) => {
      if (selectedUser && senderId === selectedUser._id) {
        setIsTyping(false);
      }
    });

    socketRef.current.off('receive-group-message');
    socketRef.current.on('receive-group-message', (msg) => {
      setGroupMessages((prev) => {
        const groupMsgs = prev[msg.receiverId] || [];
        // Replace temp message if exists
        const tempIndex = groupMsgs.findIndex((m) => m._id.startsWith('temp-') && m.text === msg.text && m.senderId === msg.senderId);
        if (tempIndex !== -1) {
          const newMsgs = [...groupMsgs];
          newMsgs[tempIndex] = msg;
          return { ...prev, [msg.receiverId]: newMsgs };
        }
        // Avoid duplicates
        if (groupMsgs.some((m) => m._id === msg._id)) return prev;
        return {
          ...prev,
          [msg.receiverId]: [...groupMsgs, msg]
        };
      });

      // Update last messages for groups
      setLastMessages((prev) => ({
        ...prev,
        [msg.receiverId]: { preview: getMessagePreview(msg), timestamp: new Date(msg.createdAt) }
      }));
    });

    socketRef.current.off('group-renamed');
    socketRef.current.on('group-renamed', ({ groupId, newName }) => {
      // Update group name in groups list
      setGroups((prevGroups) =>
        prevGroups.map((group) =>
          group._id === groupId ? { ...group, name: newName } : group
        )
      );

      // Update selectedGroup if it's the renamed group
      setSelectedGroup((prevSelected) =>
        prevSelected && prevSelected._id === groupId
          ? { ...prevSelected, name: newName }
          : prevSelected
      );

      // Update groupProfileData if it's the renamed group
      setGroupProfileData((prevData) =>
        prevData && prevData._id === groupId
          ? { ...prevData, name: newName }
          : prevData
      );
    });

    socketRef.current.off('group-updated');
    socketRef.current.on('group-updated', ({ groupId, group }) => {
      // Update group in groups list
      setGroups((prevGroups) =>
        prevGroups.map((g) =>
          g._id === groupId ? { ...g, ...group } : g
        )
      );

      // Update selectedGroup if it's the updated group
      setSelectedGroup((prevSelected) =>
        prevSelected && prevSelected._id === groupId
          ? { ...prevSelected, ...group }
          : prevSelected
      );

      // Update groupProfileData if it's the updated group
      setGroupProfileData((prevData) =>
        prevData && prevData._id === groupId
          ? { ...prevData, ...group }
          : prevData
      );
    });

    socketRef.current.off('reaction-updated');
    socketRef.current.on('reaction-updated', (updatedMessage) => {
      // Immutably update messages for one-to-one chats
      setMessages((prev) =>
        prev.map((m) => (m._id === updatedMessage._id ? { ...updatedMessage } : m))
      );

      // Immutably update groupMessages for group chats
      setGroupMessages((prev) => {
        const groupId = updatedMessage.receiverType === 'group' ? updatedMessage.receiverId : null;
        if (groupId && prev[groupId]) {
          return {
            ...prev,
            [groupId]: prev[groupId].map((m) => (m._id === updatedMessage._id ? { ...updatedMessage } : m))
          };
        }
        return prev;
      });
    });

    socketRef.current.off('message-deleted');
    socketRef.current.on('message-deleted', ({ messageId }) => {
      // Remove message from one-to-one chats
      setMessages((prev) => prev.filter((m) => m._id !== messageId));

      // Remove message from group chats
      setGroupMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((groupId) => {
          updated[groupId] = updated[groupId].filter((m) => m._id !== messageId);
        });
        return updated;
      });
    });


  }, [selectedUser]);

  // Fetch chat history when user is selected
  useEffect(() => {
    if (!selectedUser || !token || !socketRef.current) return;

    const chatId = getChatId(selectedUser._id);

    // Join the chat room for real-time updates
    socketRef.current.emit('join-chat', { chatId });

    api
      .get(`/messages?chatId=${chatId}`)
      .then((res) => {
        setMessages(res.data);
        // Mark messages as read when opening chat
        socketRef.current.emit('mark-read', { chatId });
      })
      .catch(console.error);
  }, [selectedUser?._id]);

  // Fetch group message history when group is selected
  useEffect(() => {
    if (!selectedGroup || !token || !socketRef.current) return;

    // Join the group room for real-time updates
    socketRef.current?.emit('join-group', selectedGroup._id);

    const chatId = getChatId(null, selectedGroup._id);
    api
      .get(`/messages?chatId=${chatId}`)
      .then((res) => {
        setGroupMessages((prev) => ({
          ...prev,
          [selectedGroup._id]: res.data
        }));
        // Mark group messages as read when opening group
        socketRef.current?.emit('mark-group-read', { groupId: selectedGroup._id });
      })
      .catch((error) => {
        console.error('Error fetching group messages:', error);
      });
  }, [selectedGroup?._id]);





  // Fetch groups on mount
  useEffect(() => {
    if (!token) return;

    axios
      .get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/groups`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then((res) => {
        setGroups(res.data);
      })
      .catch((error) => {
        console.error('Error fetching groups:', error);
      });
  }, [token]);

  // Fetch last messages on mount
  useEffect(() => {
    if (!token) return;

    api.get('/messages/last-messages')
      .then((res) => {
        const lastMsgs = {};
        res.data.forEach((item) => {
          lastMsgs[item.chatId] = { preview: item.lastMessage, timestamp: new Date(item.lastMessageAt) };
        });
        setLastMessages(lastMsgs);
      })
      .catch((error) => {
        console.error('Error fetching last messages:', error);
      });
  }, [token]);

  // Fetch media messages when Media tab is active
  useEffect(() => {
    if (activeTab !== 'media' || !token) return;

    setIsLoadingMedia(true);
    axios
      .get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/media`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then((res) => {
        setMediaMessages(res.data);
      })
      .catch((err) => {
        console.error('Error fetching media:', err);
        setMediaMessages([]); // Fallback to empty on error
      })
      .finally(() => {
        setIsLoadingMedia(false);
      });
  }, [activeTab, token]);

  // Send text message
  const handleSendMessage = () => {
    if (text.length === 0) return;

    if (!socketRef.current) {
      console.error("Socket not initialized");
      return;
    }

    const tempMessage = {
      _id: 'temp-' + Date.now(),
      senderId: myUserId,
      text,
      type: 'text',
      createdAt: new Date().toISOString(),
      status: 'sent'
    };

    if (selectedUser) {
      const chatId = getChatId(selectedUser._id);
      setMessages(prev => [...prev, tempMessage]);
      socketRef.current?.emit('send-message', {
        chatId,
        text,
        type: 'text',
        replyTo: replyTo?._id
      });
    } else if (selectedGroup) {
      setGroupMessages(prev => ({
        ...prev,
        [selectedGroup._id]: [...(prev[selectedGroup._id] || []), tempMessage]
      }));
      socketRef.current?.emit('group-message', {
        groupId: selectedGroup._id,
        text,
        type: 'text',
        replyTo: replyTo?._id
      });
    }

    setText('');
    setReplyTo(null);
  };

  // Send group message
  const sendGroupMessage = () => {
    if (text.length === 0 || !selectedGroup || !socketRef.current) return;

    socketRef.current?.emit('group-message', {
      groupId: selectedGroup._id,
      text,
      type: 'text',
      replyTo: replyTo?._id
    });

    setText('');
    setReplyTo(null);
  };

  // Create group
  const handleCreateGroup = async () => {
    setIsCreatingGroup(true);

    try {
      const res = await api.post("/groups", {
        name: newGroupName,
        members: selectedMembers
      });

      setGroups(prev => [...prev, res.data]);

      // Reset modal
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setSelectedMembers([]);
    } catch (err) {
      console.error("CREATE GROUP ERROR", err.response || err);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Upload file (image / video / document)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if we have a valid chat context (User or Group)
    if (!selectedUser && !selectedGroup) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      );

      const fileType = file.type.startsWith('image')
        ? 'image'
        : file.type.startsWith('video')
          ? 'video'
          : 'file';

      if (selectedUser) {
        const chatId = getChatId(selectedUser._id);
        socketRef.current?.emit('send-message', {
          chatId,
          type: fileType,
          fileUrl: res.data.url,
          fileName: file.name,
          fileSize: file.size,
          replyTo: replyTo?._id
        });
      } else if (selectedGroup) {
        socketRef.current?.emit('group-message', {
          groupId: selectedGroup._id,
          type: fileType,
          fileUrl: res.data.url,
          fileName: file.name,
          fileSize: file.size,
          replyTo: replyTo?._id
        });
      } else if (currentMicroRoom) {
        socketRef.current?.emit('send-micro-message', {
          roomId: currentMicroRoom._id,
          type: fileType,
          fileUrl: res.data.url,
          fileName: file.name,
          fileSize: file.size
        });
      }

      setUploadProgress(0);
      setReplyTo(null); // Clear reply context
    } catch (err) {
      console.error('Error uploading file:', err);
      setUploadProgress(0);
    }
  };

  // Handle emoji selection
  const onEmojiClick = (emojiData) => {
    setText((prevText) => prevText + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // Handle input change with typing indicator
  const handleInputChange = (e) => {
    setText(e.target.value);

    if (!selectedUser || !socketRef.current) return;

    const chatId = getChatId(selectedUser._id);
    socketRef.current?.emit('typing', { chatId });

    if (typingTimeout) clearTimeout(typingTimeout);

    const timeout = setTimeout(() => {
      socketRef.current?.emit('stop-typing', { chatId });
    }, 1000);

    setTypingTimeout(timeout);
  };

  // Handle Enter key to send message
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && text.length > 0) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle mic down (start recording)
  const handleMicDown = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await handleAudioUpload(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  // Handle mic up (stop recording)
  const handleMicUp = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  // Upload audio blob
  const handleAudioUpload = async (blob) => {
    if (!selectedUser || !socketRef.current) return;

    const formData = new FormData();
    formData.append('file', blob, 'voice-note.webm');

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      );

      if (selectedUser) {
        const chatId = getChatId(selectedUser._id);
        socketRef.current?.emit('send-message', {
          chatId,
          type: 'audio',
          fileUrl: res.data.url,
          fileName: res.data.fileName,
          fileSize: res.data.fileSize
        });
      } else if (currentMicroRoom) {
        socketRef.current?.emit('send-micro-message', {
          roomId: currentMicroRoom._id,
          type: 'audio',
          fileUrl: res.data.url,
          fileName: res.data.fileName,
          fileSize: res.data.fileSize
        });
      }

      setUploadProgress(0);
    } catch (err) {
      console.error('Error uploading audio:', err);
      setUploadProgress(0);
    }
  };

  // Upload file for groups (image / video / document)
  const handleGroupFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedGroup) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      );

      socketRef.current?.emit('group-message', {
        groupId: selectedGroup._id,
        type: file.type.startsWith('image')
          ? 'image'
          : file.type.startsWith('video')
            ? 'video'
            : 'file',
        fileUrl: res.data.url,
        fileName: file.name,
        fileSize: file.size
      });

      setUploadProgress(0);
    } catch (err) {
      console.error('Error uploading file:', err);
      setUploadProgress(0);
    }
  };

  // Handle mic down for groups (start recording)
  const handleGroupMicDown = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await handleGroupAudioUpload(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  // Handle mic up for groups (stop recording)
  const handleGroupMicUp = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  // Upload audio blob for groups
  const handleGroupAudioUpload = async (blob) => {
    if (!selectedGroup || !socketRef.current) return;

    const formData = new FormData();
    formData.append('file', blob, 'voice-note.webm');

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      );

      socketRef.current?.emit('group-message', {
        groupId: selectedGroup._id,
        type: 'audio',
        fileUrl: res.data.url,
        fileName: res.data.fileName,
        fileSize: res.data.fileSize
      });

      setUploadProgress(0);
    } catch (err) {
      console.error('Error uploading audio:', err);
      setUploadProgress(0);
    }
  };

  // Open group profile
  const openGroupProfile = async (groupId) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroupProfileData(response.data);
      setShowGroupProfile(true);
    } catch (err) {
      console.error('Error fetching group profile:', err);
      alert('Failed to load group profile');
    }
  };

  // Handle context menu
  const handleContextMenu = (e, message, isMine) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 220;
    const menuHeight = 240;
    const padding = 12;

    let top = e.clientY;
    let left = e.clientX;

    // If there's not enough space on the right, open the menu to the LEFT of the cursor
    if (left + menuWidth > window.innerWidth - padding) {
      left = left - menuWidth;
    }

    // If there's not enough space below, open the menu ABOVE the cursor
    if (top + menuHeight > window.innerHeight - padding) {
      top = top - menuHeight;
    }

    // Secondary safety bounds for very small screens
    if (left < padding) left = padding;
    if (top < padding) top = padding;

    setContextMenu({ position: { top, left }, message, isMine });
  };

  const handleReaction = (emoji) => {
    if (!contextMenu?.message || !socketRef.current) return;

    const { message } = contextMenu;
    const chatId = message.chatId;
    const groupId = message.receiverType === 'group' ? message.receiverId : null;

    socketRef.current.emit('toggle-reaction', {
      chatId,
      groupId,
      messageId: message._id,
      emoji
    });
  };

  const handleReactionInline = (emoji, messageArg) => {
    if (!socketRef.current) return;
    const msg = messageArg || contextMenu?.message;
    if (!msg) return;

    const chatId = msg.chatId;
    const groupId = msg.receiverType === 'group' ? msg.receiverId : null;

    socketRef.current.emit('toggle-reaction', {
      chatId,
      groupId,
      messageId: msg._id,
      emoji
    });
  };

  // Handle context menu option selection
  const handleContextMenuOption = (option, message) => {
    switch (option) {
      case 'reply':
        setReplyTo(message);
        break;
      case 'forward':
        setForwardMessage(message);
        setShowForwardModal(true);
        break;
      case 'copy':
        if (message.type === 'text') {
          navigator.clipboard.writeText(message.text);
        }
        break;
      case 'delete':
        setDeleteMessageConfirm(message);
        break;
      default:
        break;
    }
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Scroll refs and state
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Helper to check if user is at bottom
  const isAtBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return false;
    // Use a small threshold (e.g., 100px) to determine "at bottom"
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight < 100
    );
  };

  // Scroll handler
  const handleScroll = () => {
    if (isAtBottom()) {
      setShowScrollButton(false);
    }
  };

  // Auto-scroll to bottom when chat opens
  useEffect(() => {
    shouldScrollRef.current = true;
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      }
    }, 50);
  }, [selectedUser, selectedGroup, activeTab]);

  // Handle new messages scroll
  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const atBottom = isAtBottom();
    const shouldScroll = shouldScrollRef.current;

    setTimeout(() => {
      if (shouldScroll) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        shouldScrollRef.current = false;
      } else if (atBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
  }, [messages, groupMessages]);

  const renderSidebarContent = () => {
    // Show Rooms view if activeTab is 'rooms'
    if (activeTab === 'rooms') {
      return (
        <Rooms
          activeMicroRooms={activeMicroRooms}
          onJoinRoom={(roomId) => navigate(`/rooms/${roomId}`)}
          onCreateRoom={() => setShowMicroRoomModal(true)}
        />
      );
    }

    // Show Groups list if activeTab is 'groups'
    if (activeTab === 'groups') {
      return (
        <div className="sidebar-list">
          <div className="sidebar-header">
            <h3>Groups</h3>
            <button onClick={() => setShowCreateGroupModal(true)} className="create-group-btn">
              + Create Group
            </button>
          </div>
          {groups.map((g) => (
            <div
              key={g._id}
              onClick={() => {
                navigate(`/messages/${g._id}`);
              }}
              className={`list-item ${selectedGroup?._id === g._id ? 'active' : ''}`}
            >
              <div className="item-avatar">
                {g.avatar ? (
                  <img
                    src={g.avatar}
                    alt="Avatar"
                    className="avatar-img"
                  />
                ) : (
                  g.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="item-info">
                <div className="item-name">{g.name}</div>
                <div className="item-last-message">
                  {lastMessages[g._id] ? (
                    <>
                      {lastMessages[g._id].preview}
                      <span className="timestamp-span">
                        {formatTime(lastMessages[g._id].timestamp)}
                      </span>
                    </>
                  ) : 'No messages yet'}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Default: Show Users list (chats, or fallback)
    const usersWithAura = users.filter(u => u.aura && u.aura.type);

    return (
      <div className="sidebar-list">
        {usersWithAura.length > 0 && (
          <div className="aura-strip" style={{ display: 'flex', gap: '12px', padding: '12px 16px', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
            {usersWithAura.map(u => (
              <div
                key={`strip-${u._id}`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                onClick={() => setSelectedAuraUser(u)}
              >
                <div className={`item-avatar aura-active`} style={{ "--aura-color": u.aura.color, margin: '0 4px' }}>
                  {u.avatar ? <img src={u.avatar} alt="Avatar" className="avatar-img" /> : u.email.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', maxWidth: '50px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.name || u.email.split('@')[0]}
                </div>
              </div>
            ))}
          </div>
        )}

        {users.map((u) => (
          <div
            key={u._id}
            className={`list-item ${selectedUser?._id === u._id ? 'active' : ''}`}
            onClick={() => {
              navigate(`/messages/${u._id}`);
              setMediaTab('media');
            }}
          >
            <div
              className={`item-avatar ${u.aura ? 'aura-active' : ''}`}
              style={u.aura ? { "--aura-color": u.aura.color } : {}}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAvatarUser(u);
                setShowAvatarViewer(true);
              }}
            >
              {u.avatar ? (
                <img
                  src={u.avatar}
                  alt="Avatar"
                  className="avatar-img"
                />
              ) : (
                u.email.charAt(0).toUpperCase()
              )}
            </div>
            <div className="item-info">
              <div className="item-name">{u.name || u.email}</div>
              <div className="item-last-message">
                {lastMessages[getChatId(u._id)] ? (
                  <>
                    {lastMessages[getChatId(u._id)].preview}
                    <span className="timestamp-span">
                      {formatTime(lastMessages[getChatId(u._id)].timestamp)}
                    </span>
                  </>
                ) : 'No messages yet'}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };



  const renderRightPanel = () => {
    switch (activeTab) {
      case 'chats':
        return (
          <div className="chat-area">
            <div
              className="chat-header"
            >
              {selectedUser ? (
                <div
                  className="chat-header-left"
                  onClick={() => {
                    setShowUserProfile(true);
                    setSelectedProfileUser(selectedUser);
                  }}
                >

                  <div
                    className={`header-avatar ${selectedUser.aura ? 'aura-active' : ''}`}
                    style={selectedUser.aura ? { "--aura-color": selectedUser.aura.color } : {}}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAvatarUser(selectedUser);
                      setShowAvatarViewer(true);
                    }}
                  >
                    {selectedUser.avatar ? (
                      <img
                        src={selectedUser.avatar}
                        alt="Avatar"
                      />
                    ) : (
                      selectedUser.email.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="header-info">
                    <div className="header-name">{selectedUser.name || selectedUser.email}</div>
                    <div className="header-status">
                      {userStatuses[selectedUser._id]?.online
                        ? "Online"
                        : formatLastSeen(userStatuses[selectedUser._id]?.lastSeen)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="chat-header-left">
                  Select a user
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              </div>
            </div>

            {(selectedUser && loggedInUser?.aura?.type === 'focus' && selectedUser.aura?.type === 'focus' && !activeMicroRooms.find(r => r.parentChatId === getChatId(selectedUser._id) && r.type === 'focus')) && (
              <div
                style={{ background: 'rgba(124, 92, 255, 0.1)', color: '#7C5CFF', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 500 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name={APP_ICONS.activity} size={16} /> Shared Focus Session Available
                </div>
                <button
                  onClick={() => {
                    socketRef.current?.emit('create-micro-room', {
                      parentChatId: getChatId(selectedUser._id),
                      title: 'Deep Work Sync',
                      durationHours: 1,
                      type: 'focus'
                    });
                  }}
                  style={{ background: '#7C5CFF', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Start Now
                </button>
              </div>
            )}

            <div
              className="scroll-container"
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >


              <div className="messages-list">
                <div className="messages-inner">
                  {selectedUser &&
                    messages
                      .filter(
                        (m) =>
                          m.senderId === selectedUser._id ||
                          m.receiverId === selectedUser._id
                      )
                      .reduce((acc, m, i, arr) => {
                        const messageDate = new Date(m.createdAt).toDateString();
                        const prevMessageDate = i > 0 ? new Date(arr[i - 1].createdAt).toDateString() : null;

                        if (messageDate !== prevMessageDate) {
                          acc.push(
                            <div key={`date-${i}`} className="date-separator">
                              {getDateLabel(messageDate)}
                            </div>
                          );
                        }

                        const isFirstFromSender = i === 0 || arr[i - 1].senderId !== m.senderId;
                        const isLastFromSender = i === arr.length - 1 || arr[i + 1].senderId !== m.senderId;
                        const nextIsSameSender = i < arr.length - 1 && arr[i + 1].senderId === m.senderId;

                        acc.push(
                          <MessageBubble
                            key={i}
                            message={m}
                            isSent={m.senderId === myUserId}
                            onMediaClick={handleMediaClick}
                            isGroup={false}
                            users={users}
                            myUserId={myUserId}
                            isFirstFromSender={isFirstFromSender}
                            isLastFromSender={isLastFromSender}
                            nextIsSameSender={nextIsSameSender}
                            onContextMenu={handleContextMenu}
                            onReaction={handleReactionInline}
                          />
                        );

                        return acc;
                      }, [])}
                  {/* Dummy div for auto-scrolling */}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Floating Button for New Messages */}
              {showScrollButton && (
                <button
                  className="new-messages-btn"
                  onClick={() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    setShowScrollButton(false);
                  }}
                >
                  ↓ New Messages
                </button>
              )}
            </div>

            {selectedUser && (
              <div className="chat-footer">
                <div className="input-container">
                  {uploadProgress > 0 && (
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${uploadProgress}%`
                        }}
                      />
                    </div>
                  )}
                  {replyTo && (
                    <div className="reply-preview">
                      <div className="reply-content">
                        <div className="reply-title">
                          Replying to {replyTo.senderId === myUserId ? 'yourself' : (
                            users.find(u => u._id === replyTo.senderId)?.name || 'User'
                          )}
                        </div>
                        <div className="reply-text">
                          {replyTo.type === 'text' ? replyTo.text : `[${replyTo.type}]`}
                        </div>
                      </div>
                      <button onClick={() => setReplyTo(null)} className="close-reply-btn">
                        ✕
                      </button>
                    </div>
                  )}
                  <div className={`typing-wrapper ${typingUser ? "visible" : ""}`}>
                    <div className="typing-bubble">
                      <span className="typing-label">
                        {users.find(u => u._id === typingUser)?.name || selectedUser?.name || 'Someone'} is typing
                      </span>
                      <div className="premium-wave">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                  <div className="smart-dock">
                    <div className="dock-left" style={{ position: 'relative' }}>
                      <button
                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                        className={`action-btn attach-btn ${showAttachMenu ? 'active' : ''}`}
                        disabled={uploadProgress > 0}
                      >
                        <Icon name={showAttachMenu ? "X" : APP_ICONS.attach} size={ICON_SIZES.large} />
                      </button>
                      {showAttachMenu && (
                        <div className="attach-menu glass-popover">
                          <button className="attach-option" onClick={() => { fileInputRef.current.click(); setShowAttachMenu(false); }}>
                            <div className="icon-wrapper img-bg"><Icon name={APP_ICONS.media} size={20} /></div>
                            <span>Image or Video</span>
                          </button>
                          <button className="attach-option" onClick={() => { fileInputRef.current.click(); setShowAttachMenu(false); }}>
                            <div className="icon-wrapper file-bg"><Icon name={APP_ICONS.file} size={20} /></div>
                            <span>Document</span>
                          </button>
                          <button className="attach-option" onClick={() => { alert('Profile sharing coming soon!'); setShowAttachMenu(false); }}>
                            <div className="icon-wrapper prf-bg"><Icon name={APP_ICONS.profile} size={20} /></div>
                            <span>Profile</span>
                          </button>
                        </div>
                      )}
                      <input type="file" onChange={handleFileUpload} disabled={uploadProgress > 0} ref={fileInputRef} style={{ display: 'none' }} />
                    </div>

                    <div className="dock-center">
                      <textarea
                        value={text}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="message-input"
                        disabled={uploadProgress > 0}
                        rows={1}
                        style={{ flex: 1, minWidth: 0, width: '100%', minHeight: '24px', maxHeight: '120px', resize: 'none' }}
                        onInput={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                      />
                    </div>

                    <div className="dock-right" style={{ gap: '8px' }}>
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="action-btn emoji-btn"
                        disabled={uploadProgress > 0}
                      >
                        <Icon name={APP_ICONS.smile} size={ICON_SIZES.large} />
                      </button>
                      {text.length > 0 ? (
                        <button
                          onClick={handleSendMessage}
                          className="send-btn pulse-animation"
                          disabled={uploadProgress > 0}
                        >
                          <Icon name={APP_ICONS.send} size={ICON_SIZES.large} />
                        </button>
                      ) : (
                        <button
                          onMouseDown={handleMicDown}
                          onMouseUp={handleMicUp}
                          onTouchStart={handleMicDown}
                          onTouchEnd={handleMicUp}
                          className={`action-btn mic-btn ${isRecording ? 'recording' : ''}`}
                          disabled={uploadProgress > 0}
                        >
                          <Icon name={APP_ICONS.mic} size={ICON_SIZES.large} />
                        </button>
                      )}
                    </div>
                  </div>
                  {showEmojiPicker && (
                    <div className="emoji-picker-container">
                      <EmojiPicker theme="dark" onEmojiClick={onEmojiClick} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case 'groups':
        return (
          <div className="chat-area">
            <div className="chat-header">
              {selectedGroup ? (
                <div
                  className="chat-header-left"
                  onClick={() => openGroupProfile(selectedGroup._id)}
                >

                  <div className="header-avatar">
                    {selectedGroup.avatar ? (
                      <img
                        src={selectedGroup.avatar}
                        alt="Avatar"
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      selectedGroup.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="header-info">
                    <div className="header-name">{selectedGroup.name}</div>
                    <div className="header-status">
                      {selectedGroup.members.length} members
                    </div>
                  </div>
                </div>
              ) : (
                <div className="chat-header-left">
                  Select a group
                </div>
              )}
              <div className="chat-header-right">
              </div>
            </div>

            <div
              className="scroll-container"
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              <div className="messages-list">
                <div className="messages-inner">
                  {selectedGroup &&
                    (groupMessages[selectedGroup._id] || [])
                      .reduce((acc, m, i, arr) => {
                        const messageDate = new Date(m.createdAt).toDateString();
                        const prevMessageDate = i > 0 ? new Date(arr[i - 1].createdAt).toDateString() : null;

                        if (messageDate !== prevMessageDate) {
                          acc.push(
                            <div key={`date-${i}`} className="date-separator">
                              {getDateLabel(messageDate)}
                            </div>
                          );
                        }

                        const isFirstFromSender = i === 0 || arr[i - 1].senderId !== m.senderId;
                        const isLastFromSender = i === arr.length - 1 || arr[i + 1].senderId !== m.senderId;
                        const nextIsSameSender = i < arr.length - 1 && arr[i + 1].senderId === m.senderId;

                        acc.push(
                          <MessageBubble
                            key={m._id}
                            message={m}
                            isGroup={!!selectedGroup}
                            users={users}
                            myUserId={myUserId}
                            isFirstFromSender={isFirstFromSender}
                            isLastFromSender={isLastFromSender}
                            nextIsSameSender={nextIsSameSender}
                            onContextMenu={handleContextMenu}
                            onReaction={handleReactionInline}
                          />
                        );

                        return acc;
                      }, [])}
                  {/* Dummy div for auto-scrolling */}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Floating Button for New Messages */}
              {showScrollButton && (
                <button
                  className="new-messages-btn"
                  onClick={() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    setShowScrollButton(false);
                  }}
                >
                  ↓ New Messages
                </button>
              )}
            </div>

            {selectedGroup && (
              <div className="chat-footer">
                <div className="input-container">
                  {uploadProgress > 0 && (
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${uploadProgress}%`
                        }}
                      />
                    </div>
                  )}
                  <div className={`typing-wrapper ${typingUser ? "visible" : ""}`}>
                    <div className="typing-bubble">
                      <span className="typing-label">
                        {users.find(u => u._id === typingUser)?.name || 'Someone'} is typing
                      </span>
                      <div className="premium-wave">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                  {replyTo && (
                    <div className="reply-preview">
                      <div className="reply-content">
                        <div className="reply-title">
                          Replying to {replyTo.senderId === myUserId ? 'yourself' : (
                            users.find(u => u._id === replyTo.senderId)?.name || 'User'
                          )}
                        </div>
                        <div className="reply-text">
                          {replyTo.type === 'text' ? replyTo.text : `[${replyTo.type}]`}
                        </div>
                      </div>
                      <button onClick={() => setReplyTo(null)} className="close-reply-btn">
                        ✕
                      </button>
                    </div>
                  )}
                  <div className="smart-dock">
                    <div className="dock-left" style={{ position: 'relative' }}>
                      <button
                        onClick={() => setShowGroupAttachMenu(!showGroupAttachMenu)}
                        className={`action-btn attach-btn ${showGroupAttachMenu ? 'active' : ''}`}
                        disabled={uploadProgress > 0}
                      >
                        <Icon name={showGroupAttachMenu ? "X" : APP_ICONS.attach} size={ICON_SIZES.large} />
                      </button>
                      {showGroupAttachMenu && (
                        <div className="attach-menu glass-popover">
                          <button className="attach-option" onClick={() => { fileInputRef.current.click(); setShowGroupAttachMenu(false); }}>
                            <div className="icon-wrapper img-bg"><Icon name={APP_ICONS.media} size={20} /></div>
                            <span>Image or Video</span>
                          </button>
                          <button className="attach-option" onClick={() => { fileInputRef.current.click(); setShowGroupAttachMenu(false); }}>
                            <div className="icon-wrapper file-bg"><Icon name={APP_ICONS.file} size={20} /></div>
                            <span>Document</span>
                          </button>
                          <button className="attach-option" onClick={() => { alert('Profile sharing coming soon!'); setShowGroupAttachMenu(false); }}>
                            <div className="icon-wrapper prf-bg"><Icon name={APP_ICONS.profile} size={20} /></div>
                            <span>Profile</span>
                          </button>
                        </div>
                      )}
                      <input type="file" onChange={(e) => handleGroupFileUpload(e)} disabled={uploadProgress > 0} ref={fileInputRef} style={{ display: 'none' }} />
                    </div>

                    <div className="dock-center">
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && text.length > 0) {
                            e.preventDefault();
                            sendGroupMessage();
                          }
                        }}
                        placeholder="Type a message..."
                        className="message-input"
                        disabled={uploadProgress > 0}
                        rows={1}
                        style={{ flex: 1, minWidth: 0, width: '100%', minHeight: '24px', maxHeight: '120px', resize: 'none' }}
                        onInput={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                      />
                    </div>

                    <div className="dock-right" style={{ gap: '8px' }}>
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="action-btn emoji-btn"
                        disabled={uploadProgress > 0}
                      >
                        <Icon name={APP_ICONS.smile} size={ICON_SIZES.large} />
                      </button>
                      {text.length > 0 ? (
                        <button
                          onClick={sendGroupMessage}
                          className="send-btn pulse-animation"
                          disabled={uploadProgress > 0}
                        >
                          <Icon name={APP_ICONS.send} size={ICON_SIZES.large} />
                        </button>
                      ) : (
                        <button
                          onMouseDown={handleGroupMicDown}
                          onMouseUp={handleGroupMicUp}
                          onTouchStart={handleGroupMicDown}
                          onTouchEnd={handleGroupMicUp}
                          className={`action-btn mic-btn ${isRecording ? 'recording' : ''}`}
                          disabled={uploadProgress > 0}
                        >
                          <Icon name={APP_ICONS.mic} size={ICON_SIZES.large} />
                        </button>
                      )}
                    </div>
                  </div>
                  {showEmojiPicker && (
                    <div className="emoji-picker-container">
                      <EmojiPicker theme="dark" onEmojiClick={onEmojiClick} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case 'rooms':
        return (
          <div className="chat-area">
            <div className="chat-header">
              {currentMicroRoom ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}>

                  <div style={{ background: '#FF4D6D22', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={APP_ICONS.activity} size={20} color="#FF4D6D" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{currentMicroRoom.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Micro Room • {currentMicroRoom.participants.length} Participant(s)
                    </div>
                  </div>
                </div>
              ) : (
                <div className="chat-header-left">
                  Explore Live Rooms
                </div>
              )}
            </div>

            <div
              className="scroll-container"
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              <div className="messages-list">
                <div className="messages-inner">
                  {currentMicroRoom && (microRoomMessages[currentMicroRoom._id] || []).map((msg, idx) => (
                    <MessageBubble
                      key={`micro-${msg._id}-${idx}`}
                      message={msg}
                      isSent={msg.senderId === myUserId}
                      users={users}
                      myUserId={myUserId}
                      onReaction={(emoji) => handleReaction(msg, emoji)}
                      onContextMenu={(e) => handleContextMenu(e, msg, msg.senderId === myUserId)}
                      onReply={() => setReplyTo(msg)}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            {currentMicroRoom && (
              <div className="chat-footer">
                <div className="input-container">
                  {uploadProgress > 0 && (
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${uploadProgress}%`
                        }}
                      />
                    </div>
                  )}
                  {replyTo && (
                    <div className="reply-preview">
                      <div className="reply-content">
                        <div className="reply-title">
                          Replying to {replyTo.senderId === myUserId ? 'yourself' : (
                            users.find(u => u._id === replyTo.senderId)?.name || 'User'
                          )}
                        </div>
                        <div className="reply-text">
                          {replyTo.type === 'text' ? replyTo.text : `[${replyTo.type}]`}
                        </div>
                      </div>
                      <button onClick={() => setReplyTo(null)} className="close-reply-btn">
                        ✕
                      </button>
                    </div>
                  )}
                  <div className={`typing-wrapper ${typingUser ? "visible" : ""}`}>
                    <div className="typing-bubble">
                      <span className="typing-label">
                        {users.find(u => u._id === typingUser)?.name || 'Someone'} is typing
                      </span>
                      <div className="premium-wave">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                  <div className="smart-dock">
                    <div className="dock-left" style={{ position: 'relative' }}>
                      <button
                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                        className={`action-btn attach-btn ${showAttachMenu ? 'active' : ''}`}
                        disabled={uploadProgress > 0}
                      >
                        <Icon name={showAttachMenu ? "X" : APP_ICONS.attach} size={ICON_SIZES.large} />
                      </button>
                      {showAttachMenu && (
                        <div className="attach-menu glass-popover">
                          <button className="attach-option" onClick={() => { fileInputRef.current.click(); setShowAttachMenu(false); }}>
                            <div className="icon-wrapper img-bg"><Icon name={APP_ICONS.media} size={20} /></div>
                            <span>Image or Video</span>
                          </button>
                          <button className="attach-option" onClick={() => { fileInputRef.current.click(); setShowAttachMenu(false); }}>
                            <div className="icon-wrapper file-bg"><Icon name={APP_ICONS.file} size={20} /></div>
                            <span>Document</span>
                          </button>
                          <button className="attach-option" onClick={() => { alert('Profile sharing coming soon!'); setShowAttachMenu(false); }}>
                            <div className="icon-wrapper prf-bg"><Icon name={APP_ICONS.profile} size={20} /></div>
                            <span>Profile</span>
                          </button>
                        </div>
                      )}
                      <input type="file" onChange={handleFileUpload} disabled={uploadProgress > 0} ref={fileInputRef} style={{ display: 'none' }} />
                    </div>

                    <div className="dock-center">
                      <textarea
                        value={microRoomText}
                        onChange={(e) => setMicroRoomText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && microRoomText.length > 0) {
                            e.preventDefault();
                            if (!microRoomText.trim()) return;
                            socketRef.current?.emit('send-micro-message', {
                              roomId: currentMicroRoom._id,
                              text: microRoomText
                            });
                            setMicroRoomText('');
                          }
                        }}
                        placeholder="Message the Micro Room..."
                        className="message-input"
                        disabled={uploadProgress > 0}
                        rows={1}
                        style={{ flex: 1, minWidth: 0, width: '100%', minHeight: '24px', maxHeight: '120px', resize: 'none' }}
                        onInput={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                      />
                    </div>

                    <div className="dock-right" style={{ gap: '8px' }}>
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="action-btn emoji-btn"
                        disabled={uploadProgress > 0}
                      >
                        <Icon name={APP_ICONS.smile} size={ICON_SIZES.large} />
                      </button>
                      {microRoomText.length > 0 ? (
                        <button
                          onClick={() => {
                            if (!microRoomText.trim()) return;
                            socketRef.current?.emit('send-micro-message', {
                              roomId: currentMicroRoom._id,
                              text: microRoomText
                            });
                            setMicroRoomText('');
                          }}
                          className="send-btn pulse-animation"
                          disabled={uploadProgress > 0}
                        >
                          <Icon name={APP_ICONS.send} size={ICON_SIZES.large} />
                        </button>
                      ) : (
                        <button
                          onMouseDown={handleMicDown}
                          onMouseUp={handleMicUp}
                          onTouchStart={handleMicDown}
                          onTouchEnd={handleMicUp}
                          className={`action-btn mic-btn ${isRecording ? 'recording' : ''}`}
                          disabled={uploadProgress > 0}
                        >
                          <Icon name={APP_ICONS.mic} size={ICON_SIZES.large} />
                        </button>
                      )}
                    </div>
                  </div>
                  {showEmojiPicker && (
                    <div className="emoji-picker-container">
                      <EmojiPicker theme="dark" onEmojiClick={(emojiData) => setMicroRoomText(prev => prev + emojiData.emoji)} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="app-container">
        <div className={`stage-wrapper ${routeId ? 'show-chat' : 'show-users'}`}>
          <div className="stage-screen users-screen">
            <div className="sidebar-content-top">
              {renderSidebarContent()}
            </div>
            {location.pathname !== '/rooms' && (
              <BottomCommandDock
                activeTab={activeTab}
                onTabChange={setActiveTab}
                activeRoomsCount={activeMicroRooms.length}
              />
            )}
          </div>

          <div className="stage-screen chat-screen">
            {routeId ? renderRightPanel() : null}
          </div>
        </div>

        {/* CREATE GROUP MODAL */}
        {/* CREATE GROUP MODAL */}
        {showCreateGroupModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Create New Group</h3>
              <input
                type="text"
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="modal-input"
              />
              <div className="members-list">
                <div className="members-header">
                  <h4>Select Members ({selectedMembers.length})</h4>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
                <div className="members-container">
                  {users
                    .filter((u) => u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((u) => {
                      const isSelected = selectedMembers.includes(u._id);
                      return (
                        <div
                          key={u._id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMembers(selectedMembers.filter(id => id !== u._id));
                            } else {
                              setSelectedMembers([...selectedMembers, u._id]);
                            }
                          }}
                          className={`member-item ${isSelected ? 'selected' : ''}`}
                        >
                          <div className={`member-avatar ${u.aura ? 'aura-active' : ''}`} style={u.aura ? { "--aura-color": u.aura.color } : {}}>
                            {u.avatar ? (
                              <img
                                src={u.avatar}
                                alt="Avatar"
                                className="avatar-img"
                              />
                            ) : (
                              u.email.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="member-info">
                            <div className="member-name">{u.email}</div>
                          </div>
                          {isSelected && (
                            <div className="check-icon">✓</div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="modal-buttons">
                <button
                  onClick={() => {
                    setShowCreateGroupModal(false);
                    setNewGroupName('');
                    setSelectedMembers([]);
                  }}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  className="btn-submit"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GROUP PROFILE MODAL */}
        {showGroupProfile && groupProfileData && (
          <GroupProfile
            groupId={groupProfileData._id}
            token={token}
            users={users}
            onClose={() => {
              setShowGroupProfile(false);
              setGroupProfileData(null);
            }}
          />
        )}

        {/* USER PROFILE PANEL */}
        {showUserProfile && selectedProfileUser && (
          <UserProfile
            user={selectedProfileUser}
            userStatuses={userStatuses}
            mediaMessages={messages.filter(m => m.type === 'image' || m.type === 'video')}
            onClose={() => {
              setShowUserProfile(false);
              setSelectedProfileUser(null);
            }}
            currentUser={loggedInUser}
            onMediaClick={handleMediaClick}
            onSetAura={(aura) => socketRef.current?.emit('set-aura', aura)}
          />
        )}

        {/* AVATAR VIEWER MODAL */}
        {showAvatarViewer && selectedAvatarUser && (
          <AvatarViewerModal
            user={selectedAvatarUser}
            currentUser={loggedInUser}
            onClose={() => {
              setShowAvatarViewer(false);
              setSelectedAvatarUser(null);
            }}
            onProfileUpdate={handleProfileUpdate}
          />
        )}

        {/* MEDIA VIEWER MODAL */}
        {showMediaViewer && selectedMedia && (
          <MediaViewerModal
            mediaMessages={selectedMedia.mediaMessages}
            startIndex={selectedMedia.startIndex}
            onClose={() => {
              setShowMediaViewer(false);
              setSelectedMedia(null);
            }}
          />
        )}

        {/* MESSAGE CONTEXT MENU */}
        {contextMenu && (
          <MessageContextMenu
            position={contextMenu.position}
            message={contextMenu.message}
            isMine={contextMenu.isMine}
            onClose={closeContextMenu}
            onOptionSelect={handleContextMenuOption}
            onReaction={handleReaction}
          />
        )}
      </div>

      {/* FORWARD MESSAGE MODAL - OUTSIDE CHAT LAYOUT */}
      {
        showForwardModal && (
          <div className="tg-float-overlay" onClick={(e) => e.target === e.currentTarget && setShowForwardModal(false)}>
            <div className="tg-float-modal">
              <div className="tg-header">
                Forward to...
              </div>
              <div className="tg-search">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="tg-list">
                {users
                  .filter((u) => u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((u) => (
                    <div
                      key={u._id}
                      onClick={() => {
                        const chatId = getChatId(u._id);
                        socketRef.current?.emit('send-message', {
                          chatId,
                          text: forwardMessage.text,
                          type: forwardMessage.type,
                          fileUrl: forwardMessage.fileUrl,
                          fileName: forwardMessage.fileName,
                          fileSize: forwardMessage.fileSize
                        });
                        setShowForwardModal(false);
                        setForwardMessage(null);
                        alert(`Message forwarded to ${u.name || u.email}`);
                      }}
                      className="tg-user"
                    >
                      <div className={`member-avatar ${u.aura ? 'aura-active' : ''}`} style={u.aura ? { "--aura-color": u.aura.color } : {}}>
                        {u.avatar ? (
                          <img src={u.avatar} alt="Avatar" className="avatar-img" />
                        ) : (
                          u.email.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="member-info">
                        <div className="member-name">{u.name || u.email}</div>
                      </div>
                      <Icon name={APP_ICONS.forward} size={ICON_SIZES.small} />
                    </div>
                  ))}
              </div>
              <div className="tg-footer">
                <button onClick={() => {
                  setShowForwardModal(false);
                  setForwardMessage(null);
                }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }
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
                    socketRef.current?.emit('create-micro-room', {
                      parentChatId: activeTab === 'rooms' ? 'global' : (selectedGroup ? selectedGroup._id : (selectedUser ? getChatId(selectedUser._id) : 'global')),
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


      {/* AURA MINI CARD MODAL */}
      {
        selectedAuraUser && selectedAuraUser.aura && (
          <div className="tg-float-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedAuraUser(null)}>
            <div className="aura-card" style={{ background: 'var(--color-bg-surface)', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', minWidth: '240px', border: `1px solid ${selectedAuraUser.aura.color}55`, boxShadow: `0 8px 32px ${selectedAuraUser.aura.color}33`, animation: 'tgFloatIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)', zIndex: 10001 }}>
              <div style={{ background: `${selectedAuraUser.aura.color}22`, color: selectedAuraUser.aura.color, padding: '16px', borderRadius: '50%', display: 'flex' }}>
                <Icon name={APP_ICONS.activity} size={32} color={selectedAuraUser.aura.color} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>{selectedAuraUser.aura.label || selectedAuraUser.aura.type}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Active Aura</div>
              {selectedAuraUser.aura.type === 'hosting' && (
                <button
                  className="action-btn"
                  onClick={() => setSelectedAuraUser(null)}
                  style={{ marginTop: '12px', width: '100%', padding: '10px', borderRadius: '10px', background: selectedAuraUser.aura.color, color: '#fff', fontWeight: 600 }}
                >
                  Join Session
                </button>
              )}
            </div>
          </div>
        )
      }

      {/* CONFIRM MODALS */}
      {deleteMessageConfirm && (
        <ConfirmModal
          title="Delete Message"
          message="Are you sure you want to delete this message?"
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => {
            if (socketRef.current && deleteMessageConfirm) {
              socketRef.current.emit('delete-message', { messageId: deleteMessageConfirm._id });
            }
            setDeleteMessageConfirm(null);
          }}
          onCancel={() => setDeleteMessageConfirm(null)}
        />
      )}

      {leaveRoomConfirm && (
        <ConfirmModal
          title="Leave Room"
          message={`Are you sure you want to leave ${leaveRoomConfirm.title || 'this room'}?`}
          confirmText="Leave"
          cancelText="Cancel"
          onConfirm={() => {
            setCurrentMicroRoom(null);
            setLeaveRoomConfirm(null);
          }}
          onCancel={() => setLeaveRoomConfirm(null)}
        />
      )}
    </>
  );
}

export default Chat;


