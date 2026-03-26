# Complete SMTP Email Automation System - Full Explanation

## 🎯 Overview

The SMTP email system in Smart-Q handles sending OTP (One-Time Password) emails and queue registration confirmations. It uses **Nodemailer** to connect to Gmail SMTP servers for sending emails.

---

## 📋 Architecture Overview

```
User Request
    ↓
Express Route (otpRoutes.js)
    ↓
Email Service (emailService.js)
    ↓
Nodemailer (SMTP)
    ↓
Gmail SMTP Server
    ↓
User's Email Inbox
```

---

## 📁 Core Files & Components

### 1️⃣ `backend/services/emailService.js` - Email Service Core

This is the **main email sending engine**.

#### Part 1: Environment Configuration Setup

```javascript
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
```

**What it does:**
- Reads SMTP configuration from environment variables (`.env` file)
- Provides **default values** if not set (Gmail defaults)
- Supports **legacy variables** (`EMAIL_USER`, `EMAIL_PASS`) for backward compatibility

**Why it's used:**
- ✅ Security: Credentials are in `.env`, not hardcoded
- ✅ Flexibility: Can use Gmail, SendGrid, Mailgun, or any SMTP provider
- ✅ Different configs: Can have dev/staging/production with different SMTP servers

| Variable | Default | Purpose |
|----------|---------|---------|
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server address |
| `SMTP_PORT` | `465` | SMTP connection port (465=SSL, 587=TLS) |
| `SMTP_SECURE` | `true` | Use SSL/TLS encryption |
| `SMTP_USER` | - | Email address (authentication) |
| `SMTP_PASS` | - | Password/API key |
| `SMTP_FROM` | `SMTP_USER` | Sender email address |

---

#### Part 2: Startup Configuration Check

```javascript
if (!SMTP_USER || !SMTP_PASS) {
  console.warn("[emailService] WARNING: SMTP is not fully configured...");
} else {
  console.log("[emailService] SMTP configured for user:", SMTP_USER.substring(0, 3) + "***");
}
```

**What it does:**
- Checks if SMTP credentials are set when service loads
- Shows warning if missing
- Logs successfully configured (masked password for security)

**Why it's used:**
- ✅ Fail-fast: Developers know immediately if email won't work
- ✅ Security: Password is masked, only shows first 3 characters
- ✅ Debugging: Easy to spot configuration issues at startup

---

#### Part 3: Session Management Function - `getTransporter()`

```javascript
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      connectionTimeout: 10000,      // 10 seconds
      greetingTimeout: 10000,        // 10 seconds
      socketTimeout: 10000,          // 10 seconds
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }
  return transporter;
};
```

**What it does:**
- Creates SMTP connection using Nodemailer
- **Reuses** the same connection (singleton pattern)
- Sets timeouts for network operations

**Why it's used:**
- ✅ **Connection Pooling**: Reuses connections = faster email sending
- ✅ **Lazy Loading**: Connection created only when needed
- ✅ **Timeouts**: Prevents hanging if SMTP server is slow/down
- ✅ **Professional Pattern**: Singleton = memory efficient

**How it works:**
1. First call: Creates transporter, stores in `transporter` variable
2. Second+ calls: Returns existing transporter (no new connection)

---

#### Part 4: Error Mapping - `mapSmtpErrorReason()`

```javascript
const mapSmtpErrorReason = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const responseCode = Number(error?.responseCode || 0);

  if (code === "EAUTH" || responseCode === 534 || responseCode === 535) {
    return "smtp-auth-failed";  // Wrong password/credentials
  }
  if (code === "ETIMEDOUT") {
    return "smtp-timeout";  // Server too slow/down
  }
  if (["ECONNECTION", "ESOCKET", "ENOTFOUND"...].includes(code)) {
    return "smtp-connection-failed";  // Can't connect to host
  }
  return "smtp-send-failed";  // Generic failure
};
```

**What it does:**
- **Translates** technical SMTP errors into human-readable reasons
- Maps error codes to meaningful messages

**Why it's used:**
- ✅ **Debugging**: Know the real issue (connectivity vs. auth vs. timeout)
- ✅ **User Messages**: Can show appropriate message to customer
- ✅ **Error Handling**: Different responses for different problems

**Error Types:**
- `EAUTH` / `534` / `535` → **Bad credentials** (wrong password)
- `ETIMEDOUT` → **Network issue** (server slow/down)
- `ECONNECTION` / `ESOCKET` → **Can't reach server** (host wrong, firewall)
- Generic → **Unknown failure**

---

#### Part 5: Safe Email Sending - `sendMailSafe()`

```javascript
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
```

**What it does:**
- Wraps Nodemailer's `sendMail()` in try-catch
- **Never throws**: Always returns object with status
- Logs detailed error information for debugging

**Why it's used:**
- ✅ **Graceful Failure**: Errors are handled, don't crash server
- ✅ **Consistent Response**: Caller always gets object with `sent` + `reason`
- ✅ **Detailed Logging**: Full error context for troubleshooting
- ✅ **Context Parameter**: Different log messages for queue vs. OTP emails

**Returns:**
```javascript
{ sent: true }  // Success
{ sent: false, reason: "smtp-auth-failed" }  // Failure with reason
```

---

#### Part 6: HTML Email Templates

```javascript
const buildHtmlTemplate = ({ userName, tokenNumber, serviceName, estimatedWaitTime }) => {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;...">
      <h2>Queue Registration Confirmation - Smart'Q</h2>
      <p>Dear ${userName},</p>
      ...
    </div>
  `;
};
```

**What it does:**
- Generates professional HTML email template
- Fills in user-specific data (name, OTP, token, etc.)

**Why it's used:**
- ✅ **Professional Look**: HTML emails look better than plain text
- ✅ **Branding**: Uses consistent styling with Smart-Q branding
- ✅ **Dynamic Content**: Different data for each user
- ✅ **Responsive**: CSS ensures looks good on all devices

---

#### Part 7: OTP Email Function - `sendLoginOtpEmail()`

```javascript
const sendLoginOtpEmail = async ({ toEmail, userName, otp }) => {
  // Validation
  if (!isValidEmail(toEmail)) return { sent: false, reason: "invalid-recipient" };
  if (!hasSmtpConfig()) return { sent: false, reason: "smtp-not-configured" };

  // Email options
  const mailOptions = {
    from: SMTP_FROM,
    to: toEmail,
    subject: "Your Smart-Q Login OTP",
    text: `Hi ${safeName},\n\nYour Smart-Q OTP is ${otp}.\n...`,
    html: `<div>...OTP HTML template...</div>`
  };

  return sendMailSafe(mailOptions, "login-otp");
};
```

**What it does:**
- Validates email format and SMTP config
- Creates mail options with OTP code
- Sends using `sendMailSafe()`

**Why it's used:**
- ✅ **OTP Authentication**: Allows passwordless login
- ✅ **Security**: One-time use, short expiration (5 minutes)
- ✅ **User Verification**: Confirms user owns email address
- ✅ **Dual Format**: Both plain text + HTML for compatibility

---

#### Part 8: Queue Registration Email - `sendQueueRegistrationEmail()`

```javascript
const sendQueueRegistrationEmail = async ({
  toEmail,
  userName,
  tokenNumber,
  serviceName,
  estimatedWaitTime
}) => {
  // Similar validation and sending...
};
```

**What it does:**
- Sends email when customer successfully joins a queue
- Includes token number and estimated wait time

**Why it's used:**
- ✅ **Confirmation**: User knows they're registered
- ✅ **Information**: Shows token number for tracking
- ✅ **Transparency**: Shows estimated wait time

---

### 2️⃣ `backend/routes/otpRoutes.js` - OTP Routes

This handles the **API endpoints** for OTP operations.

#### Endpoint 1: Diagnostic - `GET /api/otp/diagnostic`

```javascript
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
```

**What it does:**
- Returns SMTP configuration status
- Shows any missing configuration
- No sensitive data exposed

**Why it's used:**
- ✅ **Debugging**: Quickly check if SMTP is configured
- ✅ **Production Support**: Diagnose issues without code
- ✅ **Health Check**: Can be monitored by uptime services

**Response Example:**
```json
{
  "smtpConfigured": false,
  "issues": ["SMTP_USER environment variable is not set"],
  "config": {"SMTP_USER": "NOT_SET", "SMTP_PASS": "NOT_SET"}
}
```

---

#### Endpoint 2: Send OTP - `POST /api/otp/send-otp`

```javascript
router.post("/send-otp", otpSendLimiter, async (req, res) => {
  // 1. Validate email
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // 2. Find user
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.role !== "customer") {
    return res.status(404).json({ message: "User not found" });
  }

  // 3. Check if active
  if (!user.isActive) {
    return res.status(401).json({ message: "Account inactive" });
  }

  // 4. Generate 6-digit OTP
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);  // 5 minutes

  // 5. Save OTP to database
  await Otp.findOneAndUpdate(
    { email: normalizedEmail },
    { otp, expiresAt },
    { upsert: true, new: true }
  );

  // 6. Send email
  const mailResult = await sendLoginOtpEmail({
    toEmail: normalizedEmail,
    userName: user.name,
    otp
  });

  // 7. Handle failure with detailed error
  if (!mailResult.sent) {
    let userMessage = "Failed to send OTP";
    if (mailResult.reason === "smtp-not-configured") {
      userMessage = "Email service is not configured...";
    } else if (mailResult.reason === "smtp-auth-failed") {
      userMessage = "Email service authentication failed...";
    }
    // ... more error handling
    return res.status(500).json({
      message: userMessage,
      reason: mailResult.reason
    });
  }

  res.json({ message: "OTP sent successfully" });
});
```

**Flow Diagram:**
```
POST /api/otp/send-otp
    ↓
Validate email provided
    ↓
Find user in database
    ↓
Check if user is active
    ↓
Generate random 6-digit OTP
    ↓
Set expiration (5 minutes from now)
    ↓
Save OTP to database
    ↓
Send via email
    ↓
Return result to frontend
```

**Why each step:**
- ✅ **Validation**: Email must be provided
- ✅ **User Verification**: Ensure user exists and is a customer
- ✅ **Account Status**: Inactive accounts can't get OTP
- ✅ **Randomness**: 6-digit random code is secure
- ✅ **Expiration**: OTP expires after 5 minutes (security)
- ✅ **Database Storage**: Need to verify later
- ✅ **Error Handling**: Different messages for different failures

**Security Features:**
- Rate limited: Max 3 requests per 15 minutes per email
- Email normalization: Prevents case sensitivity issues
- Expiration: Can't use old OTPs
- User validation: Can't send to non-existent users

---

#### Endpoint 3: Verify OTP - `POST /api/otp/verify-otp`

```javascript
router.post("/verify-otp", otpVerifyLimiter, async (req, res) => {
  // 1. Get email and OTP from request
  const { email, otp } = req.body;
  const normalizedEmail = String(email).trim().toLowerCase();

  // 2. Validate inputs
  if (!normalizedEmail || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  // 3. Find user
  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.role !== "customer") {
    return res.status(404).json({ message: "User not found" });
  }

  // 4. Check if user active
  if (!user.isActive) {
    return res.status(401).json({ message: "Account inactive" });
  }

  // 5. Find stored OTP record
  const record = await Otp.findOne({ email: normalizedEmail });
  if (!record) {
    return res.status(400).json({ message: "OTP not found" });
  }

  // 6. Check expiration
  if (record.expiresAt < new Date()) {
    return res.status(400).json({ message: "OTP expired" });
  }

  // 7. Verify OTP matches
  if (record.otp !== otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  // 8. Delete OTP (one-time use)
  await Otp.deleteOne({ email: normalizedEmail });

  // 9. Generate JWT token
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );

  res.json({
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});
```

**Verification Flow:**
```
POST /api/otp/verify-otp { email, otp }
    ↓
Validate inputs provided
    ↓
Find user in database
    ↓
Find OTP record
    ↓
Check OTP not expired
    ↓
Check OTP matches
    ↓
Delete OTP (one-time only)
    ↓
Generate JWT token
    ↓
Send token + user data
```

**Why each step:**
- ✅ **Input Validation**: Prevent empty/invalid data
- ✅ **User Check**: Ensure user exists
- ✅ **Expiration Check**: Prevent old OTPs from working
- ✅ **OTP Verification**: Check code matches
- ✅ **One-time Use**: Delete after using (security)
- ✅ **JWT Generation**: Create session token
- ✅ **User Data**: Send user info to frontend

**Security:**
- Rated limited: Max 5 verification attempts per 10 minutes
- Delete after use: Can't replay OTP
- Expiration check: Prevents brute force with old OTPs

---

### 3️⃣ `backend/utils/envValidation.js` - Environment Validator

```javascript
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
      SMTP_USER: config.SMTP_USER ? "***configured***" : "NOT_SET",
      SMTP_PASS: config.SMTP_PASS ? "***configured***" : "NOT_SET",
      // ... other config
    },
    issues: []
  };

  // Check for missing config
  if (!config.SMTP_USER) {
    validation.issues.push("SMTP_USER environment variable is not set");
  }
  if (!config.SMTP_PASS) {
    validation.issues.push("SMTP_PASS environment variable is not set");
  }

  return validation;
};
```

**What it does:**
- Reads all SMTP configuration
- Checks which variables are set
- Returns validation result with issues

**Why it's used:**
- ✅ **Centralized**: Single place to get config status
- ✅ **Reusable**: Used by diagnostic endpoint and startup check
- ✅ **Security**: Masks actual values
- ✅ **Helpful**: Lists missing variables

---

### 4️⃣ Rate Limiting - `backend/middleware/rateLimiters.js`

```javascript
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,          // 15 minutes
  max: 3,                            // Max 3 requests
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => buildKey(req, [getClientKey(req), req.body?.email]),
  message: buildMessage("Too many OTP requests...")
});

const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,          // 10 minutes
  max: 5,                            // Max 5 attempts
  keyGenerator: (req) => buildKey(req, [getClientKey(req), req.body?.email]),
  message: buildMessage("Too many verification attempts...")
});
```

**What it does:**
- **Send OTP**: Max 3 requests per email per 15 minutes
- **Verify OTP**: Max 5 attempts per email per 10 minutes
- Limits by IP + email combination

**Why it's used:**
- ✅ **Security**: Prevents brute force attacks
- ✅ **Resource Protection**: Prevents email spam
- ✅ **User Protection**: Prevents account takeover
- ✅ **Fair Usage**: Prevents abuse

**How it works:**
```
User 1 sends OTP → count = 1
User 1 sends OTP → count = 2
User 1 sends OTP → count = 3
User 1 sends OTP → BLOCKED (limit reached)
Wait 15 minutes → count resets
```

---

## 🔄 Complete Example Flow

### Scenario: Customer Login with OTP

```
STEP 1: SEND OTP
================
Customer enters email: user@gmail.com
Frontend calls: POST /api/otp/send-otp { email: "user@gmail.com" }

Backend:
  1. Validates email provided ✓
  2. Rate limiting check: Is this email under limit? ✓
  3. Queries database: Find user with email
  4. Gets user name: "John Doe"
  5. Generates 6-digit code: "123456"
  6. Creates expiration: 5 minutes from now
  7. Saves to database: { email, otp: "123456", expiresAt: ... }
  8. Calls emailService.sendLoginOtpEmail()
     - Validates email format ✓
     - Checks SMTP configured ✓
     - Creates Nodemailer connection
     - Builds HTML email with OTP
     - Sends to Gmail SMTP
  9. Returns: { message: "OTP sent successfully" }

Result: Customer receives email with OTP code


STEP 2: VERIFY OTP
==================
Customer enters: email: "user@gmail.com", otp: "123456"
Frontend calls: POST /api/otp/verify-otp { email, otp }

Backend:
  1. Rate limiting check: Is this email under limit? ✓
  2. Validates email and OTP provided ✓
  3. Queries database: Find user
  4. Gets user from database
  5. Queries database: Find OTP record
  6. Checks: Is OTP expired? No ✓
  7. Checks: Does OTP match? Yes ✓
  8. Deletes OTP from database (one-time use)
  9. Generates JWT token: sign({ userId, role }, secret)
  10. Returns: { accessToken, user: {...} }

Result: Customer gets access token and logged in
```

---

## 🛠️ Configuration Setup

### `.env` file should contain:

```env
# SMTP Configuration (Gmail)
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx      # 16-char app password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FROM=your-gmail@gmail.com

# OR Legacy format:
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx

# JWT Secrets
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Database
MONGODB_URI=your-mongo-connection
```

---

## 📊 Data Models

### OTP Model (MongoDB)

```javascript
{
  _id: ObjectId,
  email: "user@gmail.com",           // Indexed for fast lookup
  otp: "123456",                      // 6-digit code
  expiresAt: Date,                    // When OTP expires
  createdAt: Date,                    // When created
  updatedAt: Date                     // When last updated
}
```

### User Model (includes email field)

```javascript
{
  _id: ObjectId,
  name: "John Doe",
  email: "user@gmail.com",
  phone: "+1234567890",
  password: "hashed_password",
  role: "customer",                   // or "admin"
  isActive: true,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔒 Security Summary

| Feature | Protection |
|---------|-----------|
| Email Validation | Prevents invalid emails |
| User Verification | Only valid users get OTP |
| Account Status Check | Inactive accounts blocked |
| OTP Expiration | 5-minute limit |
| One-Time Use | OTP deleted after use |
| Rate Limiting | Max 3 sends / 5 verifies |
| Credential Masking | Passwords hidden in logs |
| HTTPS | In production |
| JWT Tokens | 15-minute expiration |

---

## 🚀 Why This Architecture?

### Separation of Concerns
- `emailService.js` → Handles email
- `otpRoutes.js` → Handles API logic
- `envValidation.js` → Handles config
- `rateLimiters.js` → Handles security

### Reusability
- `sendMailSafe()` → Used by multiple email types
- `validateSmtpConfig()` → Used by diagnostic + startup

### Security
- Never expose credentials in code
- Rate limiting prevents abuse
- OTP expiration prevents old codes
- One-time use prevents replay attacks

### Maintainability
- Clear error messages for debugging
- Centralized configuration
- Comprehensive logging
- Professional error handling

---

## ✅ Debugging Checklist

When OTP isn't sending:

```
1. Check diagnostic: curl http://localhost:5000/api/otp/diagnostic
2. Check .env file: backend/.env exists with credentials
3. Check logs: [emailService] or [OTP] prefix
4. Verify credentials: SMTP_USER and SMTP_PASS correct
5. Test script: node backend/scripts/testSmtpConfig.js
6. Check rate limit: Not exceeded in 15 minutes
7. Verify user: User exists and is active
8. Check email: Valid format (has @)
```

