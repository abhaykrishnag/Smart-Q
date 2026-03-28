#!/usr/bin/env node
/**
 * SMTP Configuration Test Script
 *
 * This script validates SMTP configuration and tests email sending
 * through the same email service used by the app.
 * Usage: node backend/scripts/testSmtpConfig.js
 */

require("dotenv").config();

const { validateSmtpConfig } = require("../utils/envValidation");
const { sendLoginOtpEmail } = require("../services/emailService");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  bold: "\x1b[1m"
};

const log = {
  success: (msg) => console.log(`${colors.green}[ok]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[error]${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}[info]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[warn]${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.blue}${msg}${colors.reset}\n`)
};

const testSmtpConfig = async () => {
  log.header("SMTP Configuration Test");

  const validation = validateSmtpConfig();

  log.info("Checking environment variables...");
  console.log(JSON.stringify(validation.config, null, 2));

  if (validation.issues.length > 0) {
    log.error("Configuration issues found:");
    validation.issues.forEach((issue) => {
      log.error(`- ${issue}`);
    });
    console.log("\nSee SMTP_CONFIGURATION.md for setup details.\n");
    return false;
  }

  log.success("All required environment variables are set.");

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpSecureRaw = process.env.SMTP_SECURE;
  const smtpSecure =
    typeof smtpSecureRaw === "string" && smtpSecureRaw.trim().length > 0
      ? smtpSecureRaw.trim().toLowerCase() === "true"
      : smtpPort === 465;
  const testEmail = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;

  log.header("Testing SMTP Send");
  console.log(`Host: ${smtpHost}`);
  console.log(`Port: ${smtpPort}`);
  console.log(`Secure: ${smtpSecure}`);
  console.log(`User: ${process.env.SMTP_USER || process.env.EMAIL_USER}`);
  console.log(`Test recipient: ${testEmail}\n`);

  try {
    const result = await sendLoginOtpEmail({
      toEmail: testEmail,
      userName: "Smart-Q Admin",
      otp: "123456"
    });

    if (!result.sent) {
      const error = new Error(`SMTP send failed with reason: ${result.reason}`);
      error.code = result.reason;
      throw error;
    }

    log.success("Test email sent successfully.");
    log.info(`Transport used: ${result.transport || "primary"}`);
    log.success("SMTP is properly configured and working.");
    return true;
  } catch (error) {
    log.error("SMTP send failed.");
    console.log(`${colors.red}Error: ${error.message}${colors.reset}\n`);

    const errorCode = error.code || error.responseCode;

    if (errorCode === "EAUTH" || errorCode === 534 || errorCode === 535 || errorCode === "smtp-auth-failed") {
      log.error("Authentication failed. Check your credentials:");
      log.info("- For Gmail, use an App Password instead of your account password.");
      log.info("- Ensure 2-Step Verification is enabled.");
      log.info("- Verify SMTP_USER and SMTP_PASS.");
    } else if (errorCode === "ETIMEDOUT" || errorCode === "smtp-timeout") {
      log.error("SMTP timed out.");
      log.info("- Keep SMTP_ENABLE_FALLBACK=true.");
      log.info("- Try SMTP_PORT=587 with SMTP_SECURE=false.");
      log.info("- Check firewall or hosting egress restrictions.");
    } else if (["ECONNECTION", "ENOTFOUND", "EHOSTUNREACH", "smtp-connection-failed"].includes(errorCode)) {
      log.error("Could not connect to the SMTP server.");
      log.info("- Verify SMTP_HOST and SMTP_PORT.");
      log.info("- Confirm your server has outbound access.");
      log.info("- Try SMTP_PORT=587 with SMTP_SECURE=false.");
    }

    console.log("\nSee SMTP_CONFIGURATION.md for setup details.\n");
    return false;
  }
};

testSmtpConfig()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    log.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  });
