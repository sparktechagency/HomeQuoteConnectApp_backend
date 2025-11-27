const SupportTicket = require("../models/SupportTicket");
const SupportMessage = require("../models/SupportMessage");

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

        const message = await SupportMessage.create({
          ticket: ticketId,
          sender: socket.userId,
          senderRole,
          content: { text: content, attachments: [] },
          messageType,
        });

        const populatedMessage = await SupportMessage.findById(message._id)
          .populate("sender", "fullName profilePhoto role")
          .exec();

        // Emit message to everyone in the ticket
        io.to(`support_ticket_${ticketId}`).emit("new-support-message", {
          event: "new-support-message",
          data: populatedMessage,
        });

        console.log(`Message sent by ${senderRole} (${socket.userId}) in ticket ${ticketId}`);
      } catch (err) {
        console.error("support-message error:", err);
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
        // Optional: emit updated message to the room
        io.to(`support_ticket_${message.ticket}`).emit("message-read-update", { messageId, userId: socket.userId });
      } catch (err) {
        console.error("mark-message-read error:", err);
      }
    });
  });
};

module.exports = supportHandler;
