import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import state from "./config/db.js";

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Chat Collaboration backend is running." });
});

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  }
});

const broadcastUsers = () => {
  io.emit("activeUsers", state.activeUsers);
};

io.on("connection", (socket) => {
  socket.on("join", ({ name }) => {
    const existing = state.activeUsers.find((user) => user.id === socket.id);
    if (!existing) {
      state.activeUsers.push({ id: socket.id, name });
    }

    socket.emit("initData", {
      messages: state.messages,
      activeUsers: state.activeUsers,
      collabDoc: state.collabDoc
    });

    broadcastUsers();

    socket.broadcast.emit("serverMessage", {
      author: "System",
      text: `${name} joined the room.`,
      createdAt: new Date().toISOString()
    });
  });

  socket.on("sendMessage", ({ author, text }) => {
    const message = {
      id: Date.now(),
      author,
      text,
      createdAt: new Date().toISOString()
    };
    state.messages.push(message);
    io.emit("newMessage", message);
  });

  socket.on("docChange", ({ text }) => {
    state.collabDoc = text;
    socket.broadcast.emit("docUpdate", { text });
  });

  socket.on("typing", ({ author, active }) => {
    socket.broadcast.emit("typing", { author, active });
  });

  socket.on("disconnect", () => {
    const user = state.activeUsers.find((item) => item.id === socket.id);
    state.activeUsers = state.activeUsers.filter((item) => item.id !== socket.id);
    broadcastUsers();
    if (user) {
      io.emit("serverMessage", {
        author: "System",
        text: `${user.name} left the room.`,
        createdAt: new Date().toISOString()
      });
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
