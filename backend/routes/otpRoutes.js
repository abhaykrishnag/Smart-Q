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

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const canUseOtpFallback = () => {
  if (String(process.env.ALLOW_OTP_FALLBACK || "").toLowerCase() === "true") {
    return true;
  }

  return process.env.NODE_ENV !== "production";
};

const buildOtpSendFailureMessage = (reason) => {
  switch (reason) {
    case "smtp-not-configured":
      return "OTP email service is not configured.";
    case "smtp-auth-failed":
      return "OTP email authentication failed.";
    case "smtp-timeout":
    case "smtp-connection-failed":
      return "Could not connect to email service. Please try again later.";
    default:
      return "Failed to send OTP";
  }
};

const isDeferredDeliveryReason = (reason) =>
  reason === "smtp-timeout" || reason === "smtp-connection-failed";

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

    const now = new Date();
    const existingRecord = await Otp.findOne({ email: normalizedEmail }).sort({ updatedAt: -1, createdAt: -1 });
    const hasReusableOtp = existingRecord && existingRecord.expiresAt > now;

    const otp = hasReusableOtp ? existingRecord.otp : generateOtp();
    const expiresAt = hasReusableOtp
      ? existingRecord.expiresAt
      : new Date(now.getTime() + 5 * 60 * 1000);

    if (hasReusableOtp) {
      await Otp.updateOne(
        { _id: existingRecord._id },
        { $set: { updatedAt: now } }
      );
    } else {
      await Otp.deleteMany({ email: normalizedEmail });
      await Otp.create({
        email: normalizedEmail,
        otp,
        expiresAt
      });
    }

    const mailResult = await sendLoginOtpEmail({
      toEmail: normalizedEmail,
      userName: user.name,
      otp
    });
    if (!mailResult.sent) {
      if (isDeferredDeliveryReason(mailResult.reason)) {
        return res.json({
          message: "OTP request processed. Email delivery may take a short while. Please check your inbox and spam folder.",
          delivery: "pending",
          reason: mailResult.reason
        });
      }

      if (canUseOtpFallback()) {
        return res.json({
          message: "OTP generated. Email delivery is unavailable, so the OTP is shown for local use.",
          delivery: "fallback",
          devOtp: otp,
          reason: mailResult.reason
        });
      }

      return res.status(500).json({
        message: buildOtpSendFailureMessage(mailResult.reason),
        reason: mailResult.reason
      });
    }

    res.json({ message: "OTP sent successfully", delivery: "email" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send OTP" });
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
