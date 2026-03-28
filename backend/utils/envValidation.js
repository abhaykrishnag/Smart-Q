// Environment validation utility
const validateSmtpConfig = () => {
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

  // If SMTP_SECURE and SMTP_PORT are mismatched, prefer the port convention.
  const effectiveSMTP_SECURE =
    SMTP_PORT === 465 ? true : SMTP_PORT === 587 ? false : SMTP_SECURE;

  const config = {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE: effectiveSMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM
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
