const express = require("express");
const router = express.Router();
const Otp = require("../models/otp");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { sendLoginOtpEmail } = require("../services/emailService");
const {
  otpSendLimiter,
  otpVerifyLimiter
} = require("../middleware/rateLimiters");
const { validateSmtpConfig } = require("../utils/envValidation");

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ================= DIAGNOSTIC ENDPOINT =================
router.get("/diagnostic", (req, res) => {
  const smtpValidation = validateSmtpConfig();
  res.json({
    service: "OTP Service",
    smtpConfigured: smtpValidation.isConfigured,
    config: smtpValidation.config,
    issues: smtpValidation.issues,
    timestamp: new Date().toISOString()
  });
});

// ================= SEND OTP =================
router.post("/send-otp", otpSendLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || user.role !== "customer") {
      return res.status(404).json({ message: "User not found" });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: "Account inactive" });
    }

    const otp = generateOtp();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email: normalizedEmail },
      { otp, expiresAt },
      { upsert: true, new: true }
    );

    console.log(`[OTP] Attempting to send OTP to ${normalizedEmail}`);

    const mailResult = await sendLoginOtpEmail({
      toEmail: normalizedEmail,
      userName: user.name,
      otp
    });

    if (!mailResult.sent) {
      console.error(`[OTP] Failed to send OTP to ${normalizedEmail}`, {
        reason: mailResult.reason,
        timestamp: new Date().toISOString()
      });

      // Provide more helpful error message based on the reason
      let userMessage = "Failed to send OTP";
      if (mailResult.reason === "smtp-not-configured") {
        userMessage = "Email service is not configured. Please contact support.";
        console.error("[OTP] CRITICAL: SMTP is not configured. Check environment variables: SMTP_USER/EMAIL_USER and SMTP_PASS/EMAIL_PASS");
      } else if (mailResult.reason === "smtp-auth-failed") {
        userMessage = "Email service authentication failed. Please contact support.";
        console.error("[OTP] CRITICAL: SMTP authentication failed. Check your email credentials.");
      } else if (mailResult.reason === "smtp-connection-failed") {
        userMessage = "Could not connect to email service. Please try again later.";
        console.error("[OTP] CRITICAL: Could not connect to SMTP server. Check host and port.");
      } else if (mailResult.reason === "smtp-timeout") {
        userMessage = "Email service timed out. Please try again.";
      }

      return res.status(500).json({
        message: userMessage,
        reason: mailResult.reason,
        debug: process.env.NODE_ENV === "development" ? mailResult.reason : undefined
      });
    }

    console.log(`[OTP] OTP sent successfully to ${normalizedEmail}`);
    res.json({ message: "OTP sent successfully" });

  } catch (error) {
    console.error("[OTP] Unexpected error in send-otp", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ message: "Failed to send OTP", error: error.message });
  }
});

// ================= VERIFY OTP =================
router.post("/verify-otp", otpVerifyLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedOtp = String(otp || "").trim();

    if (!normalizedEmail || !normalizedOtp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || user.role !== "customer") {
      return res.status(404).json({ message: "User not found" });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: "Account inactive" });
    }

    const record = await Otp.findOne({ email: normalizedEmail }).sort({ updatedAt: -1, createdAt: -1 });

    if (!record) {
      return res.status(400).json({ message: "OTP not found" });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (record.otp !== normalizedOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    await Otp.deleteMany({ email: normalizedEmail });

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    res.json({
      token: accessToken,
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "OTP verification failed" });
  }
});

module.exports = router;
