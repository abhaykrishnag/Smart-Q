#!/usr/bin/env node
/**
 * SMTP Configuration Test Script
 * 
 * This script validates SMTP configuration and tests email sending.
 * Usage: node backend/scripts/testSmtpConfig.js
 * 
 * For production use from within the app, set environment variables first:
 * - Set SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_FROM
 * OR
 * - Set EMAIL_USER and EMAIL_PASS for legacy configuration
 */

require("dotenv").config();

const nodemailer = require("nodemailer");
const { validateSmtpConfig } = require("../utils/envValidation");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  bold: "\x1b[1m"
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.blue}${msg}${colors.reset}\n`)
};

const testSmtpConfig = async () => {
  log.header("=== SMTP Configuration Test ===");

  // Validate configuration
  const validation = validateSmtpConfig();
  
  log.info("Checking environment variables...");
  console.log(JSON.stringify(validation.config, null, 2));

  if (validation.issues.length > 0) {
    log.error("Configuration Issues Found:");
    validation.issues.forEach((issue) => {
      log.error(`  • ${issue}`);
    });
    console.log("\n📖 For setup instructions, see SMTP_CONFIGURATION.md\n");
    return false;
  }

  log.success("All required environment variables are set!");

  // Test SMTP connection
  log.header("Testing SMTP Connection...");

  const trimEnv = (value) => (typeof value === "string" ? value.trim() : value);

  const smtpPort = Number(trimEnv(process.env.SMTP_PORT) || 465);
  const smtpSecureRaw = trimEnv(process.env.SMTP_SECURE);
  const smtpSecure =
    typeof smtpSecureRaw === "string" && smtpSecureRaw.length > 0
      ? smtpSecureRaw.toLowerCase() === "true"
      : smtpPort === 465;

  const effectiveSMTP_SECURE =
    smtpPort === 465 ? true : smtpPort === 587 ? false : smtpSecure;

  const config = {
    host: trimEnv(process.env.SMTP_HOST) || "smtp.gmail.com",
    port: smtpPort,
    secure: effectiveSMTP_SECURE,
    auth: {
      user: trimEnv(process.env.SMTP_USER) || trimEnv(process.env.EMAIL_USER),
      pass: trimEnv(process.env.SMTP_PASS) || trimEnv(process.env.EMAIL_PASS)
    }
  };

  console.log(`Host: ${config.host}`);
  console.log(`Port: ${config.port}`);
  console.log(`Secure: ${config.secure}`);
  console.log(`User: ${config.auth.user}\n`);

  try {
    const transporter = nodemailer.createTransport(config);
    
    log.info("Verifying SMTP connection...");
    await transporter.verify();
    log.success("SMTP connection successful!");

    // Test email
    log.header("Testing Email Send...");

    const testEmail = process.env.SMTP_FROM || config.auth.user;
    const mailOptions = {
      from: testEmail,
      to: testEmail,
      subject: "Smart-Q OTP Service - Test Email",
      text: "This is a test email from Smart-Q OTP service.\n\nIf you received this, SMTP is working correctly!",
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;background:#f0f0f0;">
          <h2>Smart-Q OTP Service Test</h2>
          <p>This is a test email from Smart-Q OTP service.</p>
          <p><strong>If you received this, SMTP is working correctly!</strong></p>
          <p style="color:#666;font-size:12px;margin-top:20px;">
            Sent at: ${new Date().toISOString()}
          </p>
        </div>
      `
    };

    log.info("Sending test email to:", testEmail);
    const result = await transporter.sendMail(mailOptions);
    log.success("Test email sent successfully!");
    console.log(`Message ID: ${result.messageId}\n`);

    log.header("✓ All Tests Passed!");
    log.success("SMTP is properly configured and working.");
    log.info("OTP emails should now be sent successfully.");
    
    return true;

  } catch (error) {
    log.error("SMTP Connection Failed!");
    console.log(`${colors.red}Error: ${error.message}${colors.reset}\n`);

    // Provide helpful error messages
    const errorCode = error.code || error.responseCode;
    
    if (errorCode === "EAUTH" || errorCode === 534 || errorCode === 535) {
      log.error("Authentication failed. Check your credentials:");
      log.info("- For Gmail: Use an App Password (not your regular password)");
      log.info("- Ensure 2-Factor Authentication is enabled");
      log.info("- Check that SMTP_USER and SMTP_PASS are correct");
    } else if (errorCode === "ETIMEDOUT") {
      log.error("Connection timed out. Check your network:");
      log.info("- Verify SMTP_HOST is correct");
      log.info("- Check if firewall is blocking the SMTP port");
      log.info("- Try a different port (465 or 587)");
    } else if (["ECONNECTION", "ENOTFOUND", "EHOSTUNREACH"].includes(errorCode)) {
      log.error("Could not connect to SMTP server:");
      log.info("- Verify SMTP_HOST and SMTP_PORT are correct");
      log.info("- Check your internet connection");
      log.info("- Try running: ping " + (process.env.SMTP_HOST || "smtp.gmail.com"));
    }

    console.log("\n📖 For setup instructions, see SMTP_CONFIGURATION.md\n");
    return false;
  }
};

// Run test
testSmtpConfig()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    log.error("Unexpected error:", error.message);
    process.exit(1);
  });
