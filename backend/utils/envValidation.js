// Environment validation utility
const validateSmtpConfig = () => {
  const config = {
    SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
    SMTP_PORT: Number(process.env.SMTP_PORT || 465),
    SMTP_SECURE: String(process.env.SMTP_SECURE || "true").toLowerCase() === "true",
    SMTP_USER: process.env.SMTP_USER || process.env.EMAIL_USER,
    SMTP_PASS: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER
  };

  const isConfigured = Boolean(config.SMTP_USER && config.SMTP_PASS && config.SMTP_FROM);
  
  const validation = {
    isConfigured,
    config: {
      SMTP_HOST: config.SMTP_HOST,
      SMTP_PORT: config.SMTP_PORT,
      SMTP_SECURE: config.SMTP_SECURE,
      SMTP_USER: config.SMTP_USER ? "***configured***" : "NOT_SET",
      SMTP_PASS: config.SMTP_PASS ? "***configured***" : "NOT_SET",
      SMTP_FROM: config.SMTP_FROM ? config.SMTP_FROM : "NOT_SET"
    },
    issues: []
  };

  if (!config.SMTP_USER) {
    validation.issues.push("SMTP_USER environment variable is not set (also checked EMAIL_USER)");
  }
  if (!config.SMTP_PASS) {
    validation.issues.push("SMTP_PASS environment variable is not set (also checked EMAIL_PASS)");
  }
  if (!config.SMTP_FROM) {
    validation.issues.push("SMTP_FROM environment variable is not set (defaults to SMTP_USER)");
  }

  return validation;
};

module.exports = {
  validateSmtpConfig
};
