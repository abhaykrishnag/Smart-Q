const express = require("express");
const router = express.Router();
const Queue = require("../models/queue");
const QueueCounter = require("../models/queueCounter");
const Event = require("../models/event");
const User = require("../models/user");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const { queueJoinLimiter } = require("../middleware/rateLimiters");
const { sendQueueRegistrationEmail } = require("../services/emailService");
const { getPredictionsIfTrained } = require("../services/mlPredictionService");
const { purgeExpiredEvents, isEventExpired } = require("../services/eventCleanupService");
const mlConfig = require("../../src/config/mlConfig");
const { callMLInference } = require("../../src/services/mlSafeWrapper");
const jwt = require("jsonwebtoken");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "https://smartq-ml.onrender.com";
const normalizeService = (value) => String(value || "").trim();
const normalizeSector = (value) => String(value || "").trim();
const getTokenScope = (item) =>
  normalizeSector(item?.organizationType) || normalizeService(item?.service);

const getNextTokenNumber = async (scope) => {
  const counter = await QueueCounter.findOneAndUpdate(
    { scope },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return Number(counter?.seq || 1);
};

// =======================
// ML NOTIFICATION HELPER
// =======================
const notifyMLUserJoined = async (queueRecord) => {
  try {
    await callMLInference({
      endpoint: "/queue/joined",
      payload: {
        service: queueRecord.service,
        positionInQueue: queueRecord.position,
        totalInQueue: queueRecord.totalWaiting,
        waitingTime: queueRecord.estimatedWaitTime,
        noShow: false,
        status: "waiting",
        joinedAt: new Date().toISOString()
      },
      mlServiceUrl: ML_SERVICE_URL,
      timeoutMs: mlConfig.inferenceTimeoutMs
    });
    console.log(`[ML] Notified — Token #${queueRecord.tokenNumber} joined`);
  } catch (err) {
    // Non-critical — queue still works even if ML is down
    console.log("[ML] Notification failed (non-critical):", err.message);
  }
};

// =======================
// ML PREDICTION HELPERS
// =======================
const AVG_SERVICE_TIME = 4;

const calculateWaitTime = (position) => {
  const now = new Date();
  const hour = now.getHours();

  let peakMultiplier = 1.0;
  if (hour >= 10 && hour <= 12) peakMultiplier = 1.4;
  else if (hour >= 14 && hour <= 16) peakMultiplier = 1.2;
  else if (hour >= 9 && hour <= 10) peakMultiplier = 1.1;

  const baseWait = position * AVG_SERVICE_TIME * peakMultiplier;
  return Math.max(1, Math.round(baseWait));
};

const getCrowdLevel = (waitingCount) => {
  if (waitingCount <= 5) return "Low";
  if (waitingCount <= 15) return "Medium";
  return "High";
};

const getPredictions = async (positionInQueue, service) => {
  const normalizedService = normalizeService(service);
  const totalWaiting = await Queue.countDocuments({
    status: "waiting",
    ...(normalizedService ? { service: normalizedService } : {})
  });
  return getPredictionsIfTrained({
    service: normalizedService || service,
    positionInQueue: Math.max(1, Number(positionInQueue || 1)),
    totalWaiting
  });
};

const broadcastQueueUpdate = async (io) => {
  try {
    const waitingQueue = await Queue.find({ status: "waiting" }).sort({ organizationType: 1, tokenNumber: 1 }).lean();
    const servingQueue = await Queue.find({ status: "serving" }).lean();
    const serviceTotals = waitingQueue.reduce((acc, item) => {
      const key = getTokenScope(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const servicePositions = {};

    const queueStatus = waitingQueue.map((item) => {
      const service = normalizeService(item.service);
      const scope = getTokenScope(item);
      servicePositions[scope] = (servicePositions[scope] || 0) + 1;
      const position = servicePositions[scope];
      const totalWaiting = serviceTotals[scope] || 0;
      return {
        _id: item._id,
        tokenNumber: item.tokenNumber,
        service,
        status: item.status,
        position,
        estimatedWaitTime: calculateWaitTime(position),
        crowdLevel: getCrowdLevel(totalWaiting),
        totalWaiting,
        joinedAt: item.createdAt
      };
    });

    io.emit("queue:update", {
      queue: queueStatus,
      serving: servingQueue,
      timestamp: new Date()
    });
    return true;
  } catch (err) {
    console.error("broadcastQueueUpdate failed:", err);
    return false;
  }
};

// =======================
// JOIN QUEUE
// =======================
router.post("/join", queueJoinLimiter, async (req, res) => {
  try {
    const {
      service,
      guestName,
      guestMobile,
      guestEmail,
      email,
      isCustomerUser,
      eventId,
      eventName,
      organizationName,
      organizationType
    } = req.body;

    const normalizedService = normalizeService(service);
    const normalizedSector = normalizeSector(organizationType);
    if (!normalizedService || !eventId) {
      return res.status(400).json({ message: "Service and eventId are required" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (isEventExpired(event)) {
      await purgeExpiredEvents();
      return res.status(400).json({
        message: "This event has ended and is no longer available"
      });
    }

    const joinedTokensForEvent = await Queue.countDocuments({
      eventId: String(eventId),
      status: { $ne: "cancelled" }
    });
    const totalTokensForEvent = Number(event.totalTokens) || 0;
    if (joinedTokensForEvent >= totalTokensForEvent) {
      return res.status(400).json({ message: "This event queue is full" });
    }

    const tokenScope = normalizedSector || normalizeSector(event.organizationType) || normalizedService;

    let tokenNumber = null;
    let newQueue = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      tokenNumber = await getNextTokenNumber(tokenScope);
      newQueue = new Queue({
        tokenNumber,
        service: normalizedService,
        guestName: guestName || null,
        guestMobile: guestMobile || null,
        guestEmail: guestEmail || email || null,
        eventId: String(eventId),
        eventName: eventName || event.title || null,
        organizationName: organizationName || event.organizationName || null,
        organizationType: tokenScope
      });

      try {
        await newQueue.save();
        break;
      } catch (saveError) {
        if (saveError?.code === 11000 && attempt < 2) {
          continue;
        }
        throw saveError;
      }
    }

    const waitingAhead = await Queue.countDocuments({
      status: "waiting",
      organizationType: tokenScope,
      tokenNumber: { $lt: tokenNumber }
    });
    const position = waitingAhead + 1;
    const totalWaiting = await Queue.countDocuments({ status: "waiting", organizationType: tokenScope });
    const estimatedWaitTime = calculateWaitTime(position);
    const crowdLevel = getCrowdLevel(totalWaiting);

    const predictions = await getPredictions(position, normalizedService);

    // ── NOTIFY ML SERVICE AUTOMATICALLY ──
    await notifyMLUserJoined({
      tokenNumber,
      service: normalizedService,
      position,
      totalWaiting,
      estimatedWaitTime
    });
    // ─────────────────────────────────────

    let recipientEmail = guestEmail || email;
    let inferredUserName = guestName || null;

    // Fallback: if frontend didn't provide guestEmail/email, infer from Authorization JWT.
    // This makes token-confirmation emails work reliably across localhost/production
    // even when customerData isn't hydrated correctly.
    if (!recipientEmail) {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
          if (decoded?.id) {
            const user = await User.findById(decoded.id).lean();
            if (user?.email) recipientEmail = user.email;
            if (!inferredUserName && user?.name) inferredUserName = user.name;
          }
        } catch (e) {
          // Ignore; recipientEmail may be provided by frontend.
        }
      }
    }
    if (!recipientEmail) {
      console.warn("[queue/join] recipientEmail missing; email will not be sent:", {
        guestEmailIsProvided: guestEmail !== undefined && guestEmail !== null,
        guestEmailValueIsEmpty: !guestEmail,
        emailIsProvided: email !== undefined && email !== null,
        emailValueIsEmpty: !email
      });
    }
    if (recipientEmail) {
      sendQueueRegistrationEmail({
        toEmail: recipientEmail,
        userName: inferredUserName || guestName || "User",
        tokenNumber,
        serviceName: normalizedService,
        estimatedWaitTime
      }).then((mailResult) => {
        if (!mailResult?.sent) {
          console.error("Queue confirmation email failed:", {
            toEmail: recipientEmail,
            reason: mailResult?.reason
          });
        } else {
          console.log(`Queue confirmation email sent to ${recipientEmail}`, {
            messageId: mailResult?.messageId || undefined
          });
        }
      }).catch((mailError) => {
        // sendQueueRegistrationEmail should not throw (it wraps nodemailer errors),
        // but we keep a hard safety net here.
        console.error("Queue confirmation email unexpected error:", mailError?.message || mailError);
      });
    }

    const io = req.app.get("io");
    if (io) {
      await broadcastQueueUpdate(io);
    }

    res.status(201).json({
      tokenNumber,
      service: normalizedService,
      position,
      totalWaiting,
      estimatedWaitTime,
      crowdLevel,
      predictions,
      queueId: newQueue._id
    });
  } catch (error) {
    console.error("Join queue error:", error);
    if (error?.code === 11000 && (error?.keyPattern?.tokenNumber || error?.keyPattern?.organizationType)) {
      return res.status(409).json({
        message: "Token generation conflict. Please try joining again."
      });
    }
    return res.status(500).json({
      message: error?.message || "Failed to join queue"
    });
  }
});

// =======================
// GET MY QUEUE STATUS
// =======================
router.get("/status/:tokenNumber", async (req, res) => {
  try {
    const rawToken = String(req.params.tokenNumber || "").trim();
    const numericToken = rawToken.replace(/\D/g, "");
    const queryService = normalizeService(req.query.service);

    if (!numericToken) {
      return res.status(400).json({ message: "Invalid token number format" });
    }

    const tokenNum = Number.parseInt(numericToken, 10);
    const lookupQuery = { tokenNumber: tokenNum };
    if (queryService) {
      lookupQuery.service = queryService;
    }

    const matches = await Queue.find(lookupQuery).sort({ createdAt: -1 }).limit(2).lean();

    if (matches.length === 0) {
      return res.status(404).json({ message: "Token not found" });
    }

    if (!queryService && matches.length > 1) {
      return res.status(400).json({
        message: "Token exists in multiple services. Please provide service as query param."
      });
    }

    const myEntry = matches[0];

    const scopeForStatus = getTokenScope(myEntry);
    const waitingFilter = { status: "waiting", organizationType: scopeForStatus };

    if (myEntry.status === "completed") {
      return res.json({
        tokenNumber: myEntry.tokenNumber,
        service: myEntry.service,
        status: "completed",
        position: 0,
        estimatedWaitTime: 0,
        crowdLevel: "Low",
        totalWaiting: await Queue.countDocuments(waitingFilter)
      });
    }

    if (myEntry.status === "serving") {
      return res.json({
        tokenNumber: myEntry.tokenNumber,
        service: myEntry.service,
        status: "serving",
        position: 0,
        estimatedWaitTime: 0,
        crowdLevel: getCrowdLevel(await Queue.countDocuments(waitingFilter)),
        totalWaiting: await Queue.countDocuments(waitingFilter)
      });
    }

    if (myEntry.status === "cancelled") {
      return res.json({
        tokenNumber: myEntry.tokenNumber,
        service: myEntry.service,
        status: "cancelled",
        position: 0,
        estimatedWaitTime: 0,
        crowdLevel: getCrowdLevel(await Queue.countDocuments(waitingFilter)),
        totalWaiting: await Queue.countDocuments(waitingFilter)
      });
    }

    const waitingAhead = await Queue.countDocuments({
      status: "waiting",
      organizationType: scopeForStatus,
      tokenNumber: { $lt: tokenNum }
    });
    const position = waitingAhead + 1;
    const totalWaiting = await Queue.countDocuments(waitingFilter);
    const estimatedWaitTime = calculateWaitTime(position);
    const crowdLevel = getCrowdLevel(totalWaiting);
    const predictions = await getPredictions(position, myEntry.service);

    res.json({
      tokenNumber: myEntry.tokenNumber,
      service: myEntry.service,
      status: myEntry.status,
      position,
      totalWaiting,
      estimatedWaitTime,
      crowdLevel,
      predictions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get queue status" });
  }
});

// =======================
// GET QUEUE LIST (Admin)
// =======================
router.get("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const queue = await Queue.find().sort({ organizationType: 1, tokenNumber: 1 }).lean();
    res.json(queue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// =======================
// START SERVING (Admin)
// =======================
router.put("/:id/start", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await Queue.findByIdAndUpdate(
      req.params.id,
      { status: "serving" },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Queue entry not found" });
    }

    const io = req.app.get("io");
    if (io) await broadcastQueueUpdate(io);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// =======================
// COMPLETE (Admin)
// =======================
router.put("/:id/complete", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await Queue.findByIdAndUpdate(
      req.params.id,
      { status: "completed" },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Queue entry not found" });
    }

    const io = req.app.get("io");
    if (io) await broadcastQueueUpdate(io);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// =======================
// CANCEL (Admin)
// =======================
router.put("/:id/cancel", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await Queue.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Queue entry not found" });
    }

    const io = req.app.get("io");
    if (io) await broadcastQueueUpdate(io);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// =======================
// REVOKE (Admin)
// =======================
router.put("/:id/revoke", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await Queue.findByIdAndUpdate(
      req.params.id,
      { status: "waiting" },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Queue entry not found" });
    }

    const io = req.app.get("io");
    if (io) await broadcastQueueUpdate(io);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
