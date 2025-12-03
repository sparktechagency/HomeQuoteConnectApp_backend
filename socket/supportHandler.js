const SupportTicket = require("../models/SupportTicket");
const SupportMessage = require("../models/SupportMessage");
const { cloudinary } = require("../utils/cloudinary"); // Make sure you have Cloudinary configured

// Helper to normalize roles to match your schema enum
const normalizeRole = (role) => {
  if (role === "client") return "user";
  if (role === "agent") return "admin"; // adjust if needed
  return role;
};

const supportHandler = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 Support socket connected:", socket.userId);

    // -------------------------------
    // JOIN SUPPORT TICKET ROOM
    // -------------------------------
    socket.on("join-support-ticket", async ({ ticketId }) => {
      if (!ticketId) return socket.emit("error", { message: "ticketId required" });
      socket.join(`support_ticket_${ticketId}`);
      console.log(`User ${socket.userId} joined ticket room: ${ticketId}`);
    });

    // -------------------------------
    // SEND SUPPORT MESSAGE
    // -------------------------------
    socket.on("support-message", async ({ ticketId, content, messageType = "text" }) => {
      if (!ticketId || !content) return socket.emit("error", { message: "ticketId & content required" });

      try {
        const senderRole = normalizeRole(socket.userRole);

        // -------------------------------
        // Handle image attachments if present
        // -------------------------------
        if (content.attachments?.length) {
          const uploadedAttachments = [];
          for (const att of content.attachments) {
            if (att.url && att.url.startsWith("data:")) {
              // Upload Base64 image to Cloudinary
              const uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                  { folder: "support_messages" },
                  (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                  }
                );
                const base64Data = att.url.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, "base64");
                uploadStream.end(buffer);
              });

              uploadedAttachments.push({
                type: "image",
                url: uploadResult.secure_url,
                filename: att.filename || uploadResult.original_filename,
                mimeType: att.mimeType || uploadResult.format,
                size: att.size || uploadResult.bytes,
                public_id: uploadResult.public_id,
              });
            } else {
              uploadedAttachments.push(att); // if already a proper URL
            }
          }
          content.attachments = uploadedAttachments;
        }

        // -------------------------------
        // Save message in DB
        // -------------------------------
        const message = await SupportMessage.create({
          ticket: ticketId,
          sender: socket.userId,
          senderRole,
          content,
          messageType,
        });

        const populatedMessage = await SupportMessage.findById(message._id)
          .populate("sender", "fullName profilePhoto role")
          .exec();

        io.to(`support_ticket_${ticketId}`).emit("new-support-message", {
          event: "new-support-message",
          data: populatedMessage,
        });

        console.log(`Message sent by ${senderRole} (${socket.userId}) in ticket ${ticketId}`);
      } catch (err) {
        console.error("support-message error:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // -------------------------------
    // TYPING INDICATORS
    // -------------------------------
    socket.on("support-typing-start", ({ ticketId }) => {
      socket.to(`support_ticket_${ticketId}`).emit("support-user-typing", {
        userId: socket.userId,
        isTyping: true,
      });
    });

    socket.on("support-typing-stop", ({ ticketId }) => {
      socket.to(`support_ticket_${ticketId}`).emit("support-user-typing", {
        userId: socket.userId,
        isTyping: false,
      });
    });

    // -------------------------------
    // ADMIN DASHBOARD ROOM
    // -------------------------------
    socket.on("join-support-dashboard", () => {
      if (socket.userRole !== "admin") return socket.emit("error", { message: "Only admin can join dashboard" });
      socket.join("support_dashboard");
      console.log(`Admin ${socket.userId} joined support dashboard`);
    });

    // -------------------------------
    // MARK MESSAGE AS READ
    // -------------------------------
    socket.on("mark-message-read", async ({ messageId }) => {
      try {
        const message = await SupportMessage.findById(messageId);
        if (!message) return;

        await message.markAsRead(socket.userId);
        io.to(`support_ticket_${message.ticket}`).emit("message-read-update", { messageId, userId: socket.userId });
      } catch (err) {
        console.error("mark-message-read error:", err);
      }
    });
  });
};

module.exports = supportHandler;
