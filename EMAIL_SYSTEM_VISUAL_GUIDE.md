# Email System - Visual Architecture & Flow Diagrams

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  Customer Login Page → "Send OTP" Button                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ POST /api/otp/send-otp
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (Express)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ otpRoutes.js                                         │        │
│  │ - Rate Limiter (max 3 requests/15min)              │        │
│  │ - Validate email                                     │        │
│  │ - Find user in database                             │        │
│  │ - Generate 6-digit OTP                              │        │
│  │ - Save OTP with 5min expiration                     │        │
│  └────────────────┬─────────────────────────────────────┘        │
│                   │                                               │
│                   ↓                                               │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ emailService.js                                      │        │
│  │ - Read SMTP config from environment                 │        │
│  │ - Validate email address                            │        │
│  │ - Build HTML email template                         │        │
│  │ - Get/create Nodemailer transporter                │        │
│  │ - Send email with error handling                    │        │
│  └────────────────┬─────────────────────────────────────┘        │
│                   │                                               │
│                   ↓                                               │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ Database (MongoDB)                                   │        │
│  │ - Save OTP record { email, otp, expiresAt }        │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ Email sent via SMTP
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Gmail (SMTP Server)                            │
│  - SMTP Host: smtp.gmail.com                                    │
│  - Port: 465 (SSL) or 587 (TLS)                                │
│  - Credentials: SMTP_USER & SMTP_PASS                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   User Email Inbox                               │
│  Receives: "Your Smart-Q OTP is 123456"                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📨 OTP Send Flow (Detailed)

```
┌────────────────────────────────────────────────────────────────┐
│ STEP 1: User clicks "Send OTP" on frontend                    │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 2: Frontend makes API call                               │
│ POST /api/otp/send-otp                                        │
│ { email: "user@gmail.com" }                                   │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 3: Backend Route Handler (otpRoutes.js)                 │
├────────────────────────────────────────────────────────────────┤
│ ✓ Check rate limit                                             │
│   └─ Max 3 requests per 15 minutes per email                 │
│ ✓ Validate email provided                                      │
│   └─ Return 400 if missing                                     │
│ ✓ Normalize email                                              │
│   └─ Trim spaces, convert to lowercase                        │
│ ✓ Query database for user                                      │
│   └─ Find user by email                                        │
│   └─ Check role is "customer"                                  │
│ ✓ Check user is active                                         │
│   └─ Return 401 if inactive                                    │
│ ✓ Generate random 6-digit OTP                                 │
│   └─ generateOtp() returns Math.random() * 900000            │
│ ✓ Calculate expiration                                         │
│   └─ expiresAt = NOW + 5 minutes                             │
│ ✓ Save to MongoDB                                              │
│   └─ upsert: true (create or update)                         │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 4: Send Email (emailService.js)                          │
├────────────────────────────────────────────────────────────────┤
│ ✓ Validate email format                                        │
│   └─ Check if looks like email (xxx@xxx.xx)                 │
│ ✓ Check SMTP is configured                                     │
│   └─ SMTP_USER and SMTP_PASS must be set                     │
│ ✓ Create mail options object                                   │
│   ├─ from: SMTP_FROM                                           │
│   ├─ to: user@gmail.com                                        │
│   ├─ subject: "Your Smart-Q Login OTP"                        │
│   ├─ text: Plain text version                                  │
│   └─ html: Beautiful HTML version with OTP displayed         │
│ ✓ Get Nodemailer transporter                                   │
│   └─ Reuses existing connection if available                 │
│ ✓ Try to send email                                            │
│   └─ await transporter.sendMail(mailOptions)                 │
│ ✓ Handle errors                                                │
│   └─ Map error code to reason (auth, timeout, etc)          │
│   └─ Log detailed error for debugging                         │
│ ✓ Return result                                                │
│   └─ { sent: true } on success                               │
│   └─ { sent: false, reason: "..." } on failure              │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 5: Connect to Gmail SMTP                                 │
├────────────────────────────────────────────────────────────────┤
│ Nodemailer connects to:                                        │
│ - Host: smtp.gmail.com                                         │
│ - Port: 465 (encrypted)                                        │
│ - Authentication:                                               │
│   ├─ user: SMTP_USER (gmail address)                          │
│   └─ pass: SMTP_PASS (app password)                           │
│                                                                 │
│ Connection attempts:                                            │
│ - TLS negotiation: 10s timeout                                 │
│ - Greeting from server: 10s timeout                            │
│ - Authenticate: Verify credentials                             │
│ - Send message: Transfer email data                            │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 6: Gmail receives and queues email                       │
│ Email is now in Gmail's queue for delivery                    │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 7: Backend returns response to frontend                  │
│ 200 OK: { message: "OTP sent successfully" }                 │
│ OR                                                              │
│ 500 Error: { message: "Email service is not configured" }    │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 8: Frontend receives response                            │
│ ✓ Shows success message to user                               │
│ ✗ Shows error message if failed                               │
│ ✓ Starts 60-second cooldown timer                             │
│ ✓ Shows "Resend OTP in 60s"                                   │
└────────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 9: Email delivered to inbox                              │
│ User receives email with OTP code                             │
│ "Hi John, Your Smart-Q OTP is 123456"                         │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔐 OTP Verify Flow (Detailed)

```
┌────────────────────────────────────────────────────────────────┐
│ STEP 1: User enters OTP from email                            │
│ Enters: "123456"                                               │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 2: Frontend submits verification                         │
│ POST /api/otp/verify-otp                                      │
│ { email: "user@gmail.com", otp: "123456" }                   │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 3: Backend verification (otpRoutes.js)                  │
├────────────────────────────────────────────────────────────────┤
│ ✓ Check rate limit                                             │
│   └─ Max 5 attempts per 10 minutes                            │
│ ✓ Validate inputs provided                                     │
│   └─ email and otp required                                   │
│ ✓ Normalize email                                              │
│   └─ Trim, lowercase                                           │
│ ✓ Find user in database                                        │
│   └─ Check exists and role is "customer"                     │
│ ✓ Check user is active                                         │
│ ✓ Find OTP record in database                                 │
│   └─ Query by email                                            │
│ ✓ Check OTP not expired                                        │
│   └─ expiresAt > NOW                                          │
│ ✓ Check OTP matches                                            │
│   └─ database OTP === submitted OTP                           │
│ ✓ Delete OTP from database                                     │
│   └─ One-time use only!                                       │
│ ✓ Generate JWT token                                           │
│   └─ sign({ userId, role }, secret)                          │
│   └─ expires in 15 minutes                                     │
│ ✓ Return token and user data                                   │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 4: Frontend receives token                               │
│ 200 OK                                                         │
│ {                                                               │
│   "accessToken": "eyJhbGc...",                                │
│   "user": { id, name, email, phone, role }                   │
│ }                                                               │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 5: Frontend stores token                                 │
│ localStorage.setItem('token', accessToken)                    │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│ STEP 6: User logged in                                         │
│ Redirected to Customer Dashboard                              │
│ Token automatically sent with all API requests                │
│ Headers: { Authorization: "Bearer eyJhbGc..." }             │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
                    .env File
                    ├── SMTP_USER
                    ├── SMTP_PASS
                    ├── SMTP_HOST
                    ├── SMTP_PORT
                    └── SMTP_SECURE
                         │
                         ↓
            emailService.js reads config
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ↓                ↓                ↓
    At Startup      Diagnostic       Send Email
    Log message      Endpoint          Function
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ↓
        Create Nodemailer Transporter
        (reused for all emails)
                         │
        ┌────────────────┼────────────────┐
        ↓                │                ↓
    OTP Emails      Regular Emails   Queue Emails
    (Send to user)  (other types)    (confirmation)
```

---

## 🛡️ Security Layers

```
┌─────────────────────────────────────────────────────┐
│           Security Layer 1: Rate Limiting           │
│                                                     │
│  Line 1: Send OTP - max 3 per 15 minutes          │
│  └─ Prevents email/SMS spam attacks                 │
│                                                     │
│  Line 2: Verify OTP - max 5 attempts per 10min     │
│  └─ Prevents brute force (only 1 million combos)  │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│        Security Layer 2: Input Validation           │
│                                                     │
│  Email: Must match pattern xxx@xx.xx               │
│  OTP: Must be 6 digits                             │
│  User: Must exist and be "customer" role           │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│      Security Layer 3: Expiration & One-Time        │
│                                                     │
│  OTP Expires: 5 minutes (prevents old codes)       │
│  One-Time Use: Deleted after verification          │
│  └─ Can't use same OTP twice                       │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│       Security Layer 4: Session Management          │
│                                                     │
│  JWT Token: 15-minute expiration                   │
│  Secure: Only sent over HTTPS in production        │
│  Signature: Verified with JWT_ACCESS_SECRET        │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Error Handling Flow

```
Frontend: Send OTP
    ↓
Backend: Process Request
    ↓
Try sending email
    │
    ├─ Success ✓
    │  └─ Return 200: { message: "OTP sent successfully" }
    │
    ├─ Email not valid ✗
    │  └─ Return 500: { reason: "invalid-recipient" }
    │
    ├─ SMTP not configured ✗
    │  └─ Return 500: { reason: "smtp-not-configured" }
    │     └─ Log: "Check environment variables: SMTP_USER/EMAIL_USER and SMTP_PASS/EMAIL_PASS"
    │
    ├─ SMTP authentication failed ✗
    │  └─ Return 500: { reason: "smtp-auth-failed" }
    │     └─ Log: "Check your email credentials"
    │
    ├─ SMTP connection failed ✗
    │  └─ Return 500: { reason: "smtp-connection-failed" }
    │     └─ Log: "Check host and port"
    │
    └─ SMTP timeout ✗
       └─ Return 500: { reason: "smtp-timeout" }
          └─ Log: "Server is slow or down, retry later"
```

---

## 💾 Database Operations

### When OTP is sent:
```
MongoDB: OTP Collection
OPERATION: findOneAndUpdate (upsert)
INPUT: { email: "user@gmail.com" }
UPDATE: { otp: "123456", expiresAt: 2026-03-26T10:35:00Z }
RESULT: New or updated document saved
```

### When OTP is verified:
```
MongoDB: OTP Collection
OPERATION 1: findOne
INPUT: { email: "user@gmail.com" }
CHECK: expiresAt > NOW
CHECK: otp === "123456"

OPERATION 2: deleteOne
INPUT: { email: "user@gmail.com" }
RESULT: OTP removed (can't be reused)
```

---

## 🔌 Integration Points

```
Frontend Component
(CustomerLogin.jsx)
        ↓
API Service Layer
(services/api.js)
├─ sendCustomerLoginOtp(email)
└─ verifyCustomerLoginOtp({email, otp})
        ↓
Axios HTTP Client
        ↓
Backend Routes
(routes/otpRoutes.js)
├─ POST /api/otp/send-otp
└─ POST /api/otp/verify-otp
        ↓
Email Service
(services/emailService.js)
        ↓
Nodemailer
        ↓
Gmail SMTP
        ↓
User's Email
```

---

## 📝 Configuration Checklist

```
Before deployment, ensure:

□ .env file exists in backend/
  └─ backend/.env (not root/.env)

□ SMTP_USER is set
  └─ Your Gmail address

□ SMTP_PASS is set
  └─ 16-character app password (not regular password)

□ SMTP_HOST is configured
  └─ smtp.gmail.com for Gmail

□ SMTP_PORT is correct
  └─ 465 for Gmail

□ SMTP_FROM is set
  └─ Usually same as SMTP_USER

□ JWT_ACCESS_SECRET is strong
  └─ Random 32+ characters

□ NODE_ENV is set appropriately
  └─ "development" or "production"

□ Database connection is working
  └─ Can connect to MongoDB

□ Server starts without SMTP warnings
  └─ Look for: "✓ SMTP is configured"
```

This visual guide complements the detailed explanation in EMAIL_SYSTEM_COMPLETE_EXPLANATION.md
