# ⚡ Quick Action Checklist: Fix OTP Email Issue

## 🔍 Step 1: Diagnose The Issue (1 minute)

### Check Server Logs
Restart your backend server and look for this message:
```
⚠️  WARNING: SMTP is not configured!
```

OR check the diagnostic endpoint:
```bash
curl http://localhost:5000/api/otp/diagnostic
```

**Expected output if unconfigured:**
```json
{
  "smtpConfigured": false,
  "issues": [
    "SMTP_USER environment variable is not set (also checked EMAIL_USER)",
    "SMTP_PASS environment variable is not set (also checked EMAIL_PASS)"
  ]
}
```

---

## 🛠️ Step 2: Configure SMTP (5 minutes - Gmail Option)

### A. Set Up Gmail App Password

```
1. Go to myaccount.google.com
2. Click "Security" on left menu
3. Scroll to "App passwords" 
4. Select "Mail" and "Windows Computer"
5. Click "Generate"
6. Copy the 16-character password (without spaces)
```

### B. Update Environment Variables

**For Development (Localhost):**

Create file: `backend/.env`
```env
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FROM=your-gmail@gmail.com
```

**For Production (Vercel/Railway/Heroku/Azure):**

Add these as environment variables in your deployment platform's dashboard.

### C. Restart Backend
```bash
# Kill current process (Ctrl+C)
npm start
```

---

## ✅ Step 3: Verify It Works (2 minutes)

### Option 1: Run Test Script
```bash
node backend/scripts/testSmtpConfig.js
```

Expected output:
```
✓ All required environment variables are set!
✓ SMTP connection successful!
✓ Test email sent successfully!
✓ All Tests Passed!
```

### Option 2: Check Diagnostic Again
```bash
curl http://localhost:5000/api/otp/diagnostic
```

Expected:
```json
{
  "smtpConfigured": true,
  "issues": []
}
```

### Option 3: Test With Frontend
1. Open Customer Login page
2. Click "Forgot Password"
3. Enter your registered email
4. Click "Send OTP"
5. Wait 5 seconds
6. Check your email inbox for the OTP code

---

## 📋 Checklist

- [ ] Check diagnostic endpoint to confirm SMTP is not configured
- [ ] Have Gmail 2FA enabled
- [ ] Generated Gmail App Password
- [ ] Created `backend/.env` file with SMTP credentials
- [ ] Restarted backend server
- [ ] Ran test script (`testSmtpConfig.js`) - all tests pass
- [ ] Confirmed diagnostic endpoint shows `"smtpConfigured": true`
- [ ] Tested OTP send from frontend - received email
- [ ] OTP works for customer login

---

## 🆘 Still Not Working?

### Check Server Logs
Look for any of these prefixes:
- `[emailService]` - Configuration issues
- `[OTP]` - Sending failures
- `⚠️ WARNING` - Configuration warnings

### Try Each Step
1. Verify environment variables are set:
   ```bash
   echo %SMTP_USER%  # Windows
   # or
   echo $SMTP_USER   # Mac/Linux
   ```

2. Double-check credentials:
   - Used Gmail app password (not regular password)? ✓
   - Copied full 16 characters? ✓
   - No extra spaces before/after password? ✓

3. Try port 587 instead of 465:
   ```env
   SMTP_PORT=587
   SMTP_SECURE=false
   ```

4. Check `.env` file location:
   Must be: `backend/.env` (not root directory)

### Get Help
See full setup guide: `SMTP_CONFIGURATION.md`

---

## 📚 Files You Created/Modified

Created:
- ✓ `backend/utils/envValidation.js` - Validation utility
- ✓ `backend/scripts/testSmtpConfig.js` - Test script
- ✓ `SMTP_CONFIGURATION.md` - Setup guide
- ✓ `OTP_SENDING_FIX_SUMMARY.md` - Detailed summary

Modified:
- ✓ `backend/routes/otpRoutes.js` - Better error logging
- ✓ `backend/app.js` - Startup validation
- ✓ `backend/services/emailService.js` - Startup warnings

---

## 🎯 Key Points

✓ OTP route: `POST /api/otp/send-otp`  
✓ Diagnostic: `GET /api/otp/diagnostic`  
✓ Test script: `node backend/scripts/testSmtpConfig.js`  
✓ Environment file: `backend/.env`  
✓ Setup guide: `SMTP_CONFIGURATION.md`

---

**Once configured, OTP emails will be sent automatically for customer login!**

Last updated: 2026-03-26
