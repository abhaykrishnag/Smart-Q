const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");

require("dotenv").config();

const connectDB = require("./config/db");

const queueRoutes = require("./routes/queueRoutes");
const eventRoutes = require("./routes/eventRoutes");
const eventHistoryRoutes = require("./routes/eventHistoryRoutes");
const mlRoutes = require("./routes/mlRoutes");
const predictionRoutes = require("./routes/predictionRoutes");
const otpRoutes = require("./routes/otpRoutes");
const authRoutes = require("./routes/authRoutes");
const Queue = require("./models/queue");

const { sendQueueRegistrationEmail } = require("./services/emailService");
const { authMiddleware } = require("./middleware/auth");
const { testEmailLimiter } = require("./middleware/rateLimiters");
const { purgeExpiredEvents } = require("./services/eventCleanupService");

const app = express();
const server = http.createServer(app);

app.set("trust proxy", 1);
app.use(helmet());

const defaultFrontendOrigins = [
  "http://localhost:3000",
  "https://smart-q.vercel.app",
  "https://smartq-system.vercel.app"
];

const configuredFrontendOrigins = String(process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = configuredFrontendOrigins.length > 0
  ? configuredFrontendOrigins
  : defaultFrontendOrigins;

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return origin.endsWith(".vercel.app");
};

app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

/* ================= BODY PARSER ================= */

app.use(
  express.json({
    limit: "10kb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10kb"
  })
);

app.use(cookieParser());

/* ================= SECURITY ================= */

const expressVersion = require("express/package.json").version;
const expressMajor = parseInt(expressVersion.split(".")[0], 10);

if (expressMajor < 5) {
  app.use(
    mongoSanitize({
      replaceWith: "_"
    })
  );

  app.use(hpp());
} else {
  console.log("Express 5 detected; mongoSanitize/hpp middleware skipped for compatibility.");
}

/* ================= RATE LIMIT ================= */

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

app.use("/api", apiLimiter);

/* ================= HTTPS REDIRECT ================= */

if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    const proto = req.headers["x-forwarded-proto"];

    if (proto && proto !== "https") {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }

    return next();
  });
}

/* ================= SOCKET.IO ================= */

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.set("io", io);

/* ================= ROUTES ================= */

app.use("/api/auth", authRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/event-history", eventHistoryRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/otp", otpRoutes);

app.get("/api/test-protected", authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: "Protected route accessed",
    user: req.user
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Frontend and Backend connected"
  });
});

app.get("/api/test-email", testEmailLimiter, async (req, res, next) => {
  try {
    const result = await sendQueueRegistrationEmail({
      toEmail: req.query.toEmail || "nishanrosary908@gmail.com",
      userName: req.query.userName || "Nishan",
      tokenNumber: req.query.tokenNumber || "A123",
      serviceName: req.query.serviceName || "General Service",
      estimatedWaitTime: Number(req.query.estimatedWaitTime || 15)
    });

    res.json({
      success: true,
      message: "Test email request processed",
      result
    });
  } catch (error) {
    next(error);
  }
});

/* ================= ERROR HANDLING ================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

/* ================= SOCKET CONNECTION ================= */

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

/* ================= CLEANUP SERVICE ================= */

const runExpiredEventCleanup = async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    const result = await purgeExpiredEvents();

    if (result.deletedEvents > 0) {
      console.log(
        `Expired events cleanup: removed ${result.deletedEvents} event(s) and ${result.deletedQueues} queue item(s)`
      );
    }
  } catch (error) {
    console.error("Expired events cleanup failed:", error.message);
  }
};

/* ================= START SERVER ================= */

const resolvePort = (value) => {
  const fallbackPort = 5000;

  if (value === undefined || value === null || value === "") {
    return fallbackPort;
  }

  const parsedPort = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
    console.warn(
      `Invalid PORT value "${value}" provided. Falling back to ${fallbackPort}.`
    );
    return fallbackPort;
  }

  return parsedPort;
};

const startServer = async (port = resolvePort(process.env.PORT)) => {
  await connectDB();
  await Queue.syncIndexes();

  return new Promise((resolve, reject) => {
    server.once("error", reject);

    server.listen(port, async () => {
      server.removeListener("error", reject);

      await runExpiredEventCleanup();
      setInterval(runExpiredEventCleanup, 60 * 60 * 1000);

      console.log(`Server running on port ${port}`);
      resolve(server);
    });
  });
};

module.exports = {
  app,
  server,
  io,
  startServer,
  runExpiredEventCleanup
};
