const ConnectionRequest = require("../models/ConnectionRequest");
const Notification = require("../models/Notification");
const User = require("../models/User");

exports.sendRequest = async (req, res) => {
    const sender = req.user.id;
    const receiver = req.body.receiverId;

    if (sender === receiver) {
        return res.status(400).json({ message: "Cannot connect to yourself" });
    }

    const existing = await ConnectionRequest.findOne({
        sender,
        receiver,
        status: "pending"
    });

    if (existing) {
        return res.status(400).json({ message: "Request already sent" });
    }

    const alreadyConnected = await User.findOne({
        _id: sender,
        connections: receiver
    });

    if (alreadyConnected) {
        return res.status(400).json({ message: "Already connected" });
    }

    await ConnectionRequest.create({ sender, receiver });

    // Fire socket event so receiver gets it instantly
    if (global.io) {
        // Find if receiver is online, if so emit to their socket room
        const { socketIds } = require('../sockets/socket');
        const receiverSocketId = socketIds.get(receiver);
        if (receiverSocketId) {
            global.io.to(receiverSocketId).emit('new-connection-request', { senderId: sender });
        }
    }

    res.json({ message: "Request sent" });
};

exports.acceptRequest = async (req, res) => {
    const request = await ConnectionRequest.findById(req.params.id);

    if (!request || request.status !== "pending") {
        return res.status(400).json({ message: "Invalid request" });
    }

    request.status = "accepted";
    await request.save();

    const Notification = require('../models/Notification');
    const senderData = await User.findById(request.sender);
    const receiverData = await User.findById(request.receiver);

    // Create a notification for the sender that the receiver accepted
    await Notification.create({
        user: request.sender,
        type: "connection_accepted",
        from: request.receiver,
        message: `${receiverData.name || receiverData.username || receiverData.email.split('@')[0]} accepted your connection request. You can now message them.`
    });

    await User.findByIdAndUpdate(request.sender, {
        $addToSet: { connections: request.receiver }
    });

    await User.findByIdAndUpdate(request.receiver, {
        $addToSet: { connections: request.sender }
    });

    // Fire socket events so both users update their Chat/Home screens instantly
    if (global.io) {
        const { socketIds } = require('../sockets/socket');

        const senderSocketId = socketIds.get(request.sender.toString());
        if (senderSocketId) {
            global.io.to(senderSocketId).emit('connection-accepted', { receiverId: request.receiver });
        }

        const receiverSocketId = socketIds.get(request.receiver.toString());
        if (receiverSocketId) {
            global.io.to(receiverSocketId).emit('connection-accepted', { receiverId: request.sender });
        }
    }

    res.json({ message: "Connection accepted" });
};

exports.declineRequest = async (req, res) => {
    try {
        const request = await ConnectionRequest.findById(req.params.id);

        if (!request || request.status !== "pending") {
            return res.status(400).json({ message: "Invalid request" });
        }

        request.status = "declined";
        await request.save();

        res.json({ message: "Connection declined" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.getPendingRequests = async (req, res) => {
    try {
        const requests = await ConnectionRequest.find({
            receiver: req.user.id,
            status: "pending"
        }).populate("sender", "name email avatar");

        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.getAllRequests = async (req, res) => {
    try {
        const requests = await ConnectionRequest.find({
            receiver: req.user.id
        }).populate("sender", "name email avatar").sort({ createdAt: -1 });

        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.getSentRequests = async (req, res) => {
    try {
        const requests = await ConnectionRequest.find({
            sender: req.user.id,
            status: "pending"
        });

        // Return array of receiver IDs for easy checking on frontend
        const sentToIds = requests.map(req => req.receiver);
        res.json(sentToIds);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate("connections", "name email avatar about");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user.connections);
    } catch (err) {
        console.error("Get friends error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.removeConnection = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.id;

        // 1. Remove from each other's connections arrays
        await User.findByIdAndUpdate(currentUserId, {
            $pull: { connections: targetUserId }
        });

        await User.findByIdAndUpdate(targetUserId, {
            $pull: { connections: currentUserId }
        });

        // 2. Delete any existing ConnectionRequests (pending, accepted, etc.) between them
        await ConnectionRequest.deleteMany({
            $or: [
                { sender: currentUserId, receiver: targetUserId },
                { sender: targetUserId, receiver: currentUserId }
            ]
        });

        // Optionally, delete their 1-on-1 Chat/Messages (skipped for now as per plan, chat history remains)
        
        // Fire socket event to update clients
        if (global.io) {
            const { socketIds } = require('../sockets/socket');

            const currentSocketId = socketIds.get(currentUserId.toString());
            if (currentSocketId) {
                global.io.to(currentSocketId).emit('connection-removed', { userId: targetUserId });
            }

            const targetSocketId = socketIds.get(targetUserId.toString());
            if (targetSocketId) {
                global.io.to(targetSocketId).emit('connection-removed', { userId: currentUserId });
            }
        }

        res.json({ message: "Connection removed" });
    } catch (err) {
        console.error("Remove connection error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
