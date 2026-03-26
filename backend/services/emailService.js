const nodemailer = require("nodemailer");

const trimEnv = (value) => (typeof value === "string" ? value.trim() : value);

const SMTP_HOST = trimEnv(process.env.SMTP_HOST) || "smtp.gmail.com";
const SMTP_PORT = Number(trimEnv(process.env.SMTP_PORT) || 465);

// If SMTP_SECURE isn't explicitly set, infer from the port:
// - 465 => secure true (implicit TLS/SSL)
// - 587 => secure false (STARTTLS)
const smtpSecureRaw = trimEnv(process.env.SMTP_SECURE);
const SMTP_SECURE =
  typeof smtpSecureRaw === "string" && smtpSecureRaw.length > 0
    ? smtpSecureRaw.toLowerCase() === "true"
    : SMTP_PORT === 465;

const SMTP_USER = trimEnv(process.env.SMTP_USER) || trimEnv(process.env.EMAIL_USER);
const SMTP_PASS = trimEnv(process.env.SMTP_PASS) || trimEnv(process.env.EMAIL_PASS);
const SMTP_FROM = trimEnv(process.env.SMTP_FROM) || SMTP_USER;

// Log SMTP configuration status on startup (without exposing sensitive data)
if (!SMTP_USER || !SMTP_PASS) {
  console.warn("[emailService] WARNING: SMTP is not fully configured. OTP emails will fail. Required env vars: SMTP_USER (or EMAIL_USER) and SMTP_PASS (or EMAIL_PASS)");
} else {
  console.log("[emailService] SMTP configured for user:", SMTP_USER.substring(0, 3) + "***");
}

const hasSmtpConfig = () => Boolean(SMTP_USER && SMTP_PASS && SMTP_FROM);

const isValidEmail = (value) => {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
};

const maskEmail = (value) => {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "NOT_SET";
  const [local, domain] = s.split("@");
  if (!local || !domain) return "INVALID_FORMAT";
  const safeLocal = local.length <= 3 ? local[0] + "***" : local.slice(0, 3) + "***";
  return `${safeLocal}@${domain}`;
};

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }
  return transporter;
};

const mapSmtpErrorReason = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const responseCode = Number(error?.responseCode || 0);

  if (code === "EAUTH" || responseCode === 534 || responseCode === 535) {
    return "smtp-auth-failed";
  }
  if (code === "ETIMEDOUT") {
    return "smtp-timeout";
  }
  if (["ECONNECTION", "ESOCKET", "ENOTFOUND", "EHOSTUNREACH", "ECONNREFUSED"].includes(code)) {
    return "smtp-connection-failed";
  }
  return "smtp-send-failed";
};

const sendMailSafe = async (mailOptions, context) => {
  try {
    await getTransporter().sendMail(mailOptions);
    return { sent: true };
  } catch (error) {
    const reason = mapSmtpErrorReason(error);
    console.error(`[email:${context}] send failed`, {
      reason,
      code: error?.code || null,
      responseCode: error?.responseCode || null,
      command: error?.command || null
    });
    return { sent: false, reason };
  }
};

const buildHtmlTemplate = ({ userName, tokenNumber, serviceName, estimatedWaitTime }) => {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;">
      <h2 style="margin:0 0 16px;color:#111827;">Queue Registration Confirmation - Smart'Q</h2>
      <p style="margin:0 0 14px;color:#374151;">Dear ${userName},</p>
      <p style="margin:0 0 16px;color:#374151;">This email confirms your successful registration in the queue.</p>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;">
        <p style="margin:0 0 8px;color:#111827;"><strong>Token Number:</strong> ${tokenNumber}</p>
        <p style="margin:0 0 8px;color:#111827;"><strong>Service Type:</strong> ${serviceName}</p>
        <p style="margin:0;color:#111827;"><strong>Estimated Waiting Time:</strong> ${estimatedWaitTime} minutes</p>
      </div>
      <p style="margin:16px 0 0;color:#374151;">Kindly be available near the service counter before your turn.</p>
      <p style="margin:16px 0 0;color:#374151;">Thank you for using Smart'Q.</p>
      <p style="margin:16px 0 0;color:#374151;">Sincerely,<br/>Smart'Q Support Team</p>
    </div>
  `;
};

const sendQueueRegistrationEmail = async ({
  toEmail,
  userName,
  tokenNumber,
  serviceName,
  estimatedWaitTime
}) => {
  if (!isValidEmail(toEmail)) {
    console.warn("[email:queue-registration] invalid recipient:", {
      toEmail: maskEmail(toEmail)
    });
    return { sent: false, reason: "invalid-recipient" };
  }
  if (!hasSmtpConfig()) {
    console.warn("[email:queue-registration] SMTP not configured.");
    return { sent: false, reason: "smtp-not-configured" };
  }

  const mailOptions = {
    from: SMTP_FROM,
    to: toEmail,
    subject: "Queue Registration Confirmation - Smart'Q",
    text:
      `Dear ${userName},\n\n` +
      "This email confirms your successful registration in the queue.\n\n" +
      `Token Number: ${tokenNumber}\n` +
      `Service Type: ${serviceName}\n` +
      `Estimated Waiting Time: ${estimatedWaitTime} minutes\n\n` +
      "Kindly be available near the service counter before your turn.\n\n" +
      "Thank you for using Smart'Q.\n\n" +
      "Sincerely,\nSmart'Q Support Team",
    html: buildHtmlTemplate({ userName, tokenNumber, serviceName, estimatedWaitTime })
  };

  return sendMailSafe(mailOptions, "queue-registration");
};

const sendLoginOtpEmail = async ({ toEmail, userName, otp }) => {
  if (!isValidEmail(toEmail)) {
    console.warn("[email:login-otp] invalid recipient:", {
      toEmail: maskEmail(toEmail)
    });
    return { sent: false, reason: "invalid-recipient" };
  }
  if (!hasSmtpConfig()) {
    console.warn("[email:login-otp] SMTP not configured.");
    return { sent: false, reason: "smtp-not-configured" };
  }

  const safeName = userName || "User";
  const mailOptions = {
    from: SMTP_FROM,
    to: toEmail,
    subject: "Your Smart-Q Login OTP",
    text:
      `Hi ${safeName},\n\n` +
      `Your Smart-Q OTP is ${otp}.\n` +
      "It will expire in 5 minutes.\n\n" +
      "If you did not request this, you can ignore this email.",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 16px;color:#111827;">Smart-Q Login Verification</h2>
        <p style="margin:0 0 14px;color:#374151;">Hi ${safeName},</p>
        <p style="margin:0 0 16px;color:#374151;">Use the OTP below to complete your sign in:</p>
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;letter-spacing:6px;color:#111827;"><strong>${otp}</strong></p>
        </div>
        <p style="margin:16px 0 0;color:#374151;">This OTP expires in 5 minutes.</p>
      </div>
    `
  };

  return sendMailSafe(mailOptions, "login-otp");
};

module.exports = {
  sendQueueRegistrationEmail,
  sendLoginOtpEmail
};
