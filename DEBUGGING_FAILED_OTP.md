# Debugging "Failed to send OTP" Error

## 🔴 Your Exact Error: Failed to send OTP

This error means the OTP was generated and saved to the database, but the **email sending failed**.

---

## 📊 Debugging Checklist - Do This Now

### Step 1: Check Backend Console Logs

Restart your backend and look for these messages:

```
[emailService] WARNING: SMTP is not fully configured
[OTP] Failed to send OTP to [email]
[OTP] CRITICAL: SMTP is not configured
[OTP] CRITICAL: SMTP authentication failed
```

**What did you see?** Copy the exact message here:
___________________________________________________________

### Step 2: Check if backend/.env File Exists

**Path should be:**
```
c:\Users\Nishan Rosary\Desktop\MY_PROJECTS\Dummy folder\Smart-Q\backend\.env
```

**Run this in backend terminal:**
```powershell
Test-Path .env
```

Did it return `True` or `False`?
___________________________________________________________

### Step 3: Check Environment Variables Are Loaded

**Run this in backend terminal:**
```powershell
$Env:SMTP_USER
$Env:SMTP_PASS
```

**What values are printed?** (Should show your email and password)
___________________________________________________________

### Step 4: Run Diagnostic Endpoint

**Option A: Via browser/Postman:**
```
GET http://localhost:5000/api/otp/diagnostic
```

**Option B: Via terminal:**
```powershell
curl http://localhost:5000/api/otp/diagnostic
```

**What's the response?** Specifically:
- Is `smtpConfigured: true` or `false`?
- What's in the `issues` array?

Copy the full response:
```json
{

}
```

### Step 5: Run Test Script

```bash
node backend/scripts/testSmtpConfig.js
```

**What output do you see?** Does it show:
```
✓ All required environment variables are set!
✓ SMTP connection successful!
✓ Test email sent successfully!
```

Or does it show an error? Copy it:
___________________________________________________________

---

## 🛠️ Common Causes & Fixes

### Cause 1: SMTP_USER / SMTP_PASS Not Set

**Symptoms:**
- Diagnostic shows `smtpConfigured: false`
- Console logs: `[emailService] WARNING: SMTP is not fully configured`
- Error: `smtp-not-configured`

**Fix:**
1. Create/edit file: `backend/.env`
2. Add these lines:
```env
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FROM=your-gmail@gmail.com
```
3. Save file
4. **Restart backend**: `npm start`
5. Re-test OTP send

---

### Cause 2: Wrong Gmail Password

**Symptoms:**
- Test script runs but fails at "Verifying SMTP connection"
- Error: `smtp-auth-failed`
- Console: `SMTP authentication failed`

**Fix:**
1. You MUST use **App Password**, not regular Gmail password
2. Get App Password:
   - Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - If you don't see "App passwords", go to [Security settings](https://myaccount.google.com/security) and enable 2-Factor Auth first
   - Select "Mail" and "Windows Computer"
   - Click "Generate"
   - Copy the 16-character password (without spaces)

3. Update `.env`:
```env
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx   ← Use the 16-char password from step 2
```

4. Restart backend and test again

---

### Cause 3: Can't Connect to Gmail SMTP Server

**Symptoms:**
- Error: `smtp-connection-failed`
- Console: `Could not connect to SMTP server`

**Fixes to Try:**

**Option A: Try port 587 instead of 465**
```env
SMTP_PORT=587          # Changed from 465
SMTP_SECURE=false      # Changed from true
```

**Option B: Check your firewall**
- Gmail SMTP uses port 465 or 587
- Some corporate networks block these ports
- Solution: Try on a different network (hotspot phone)

**Option C: Gmail blocking the connection**
- Go to [Google Account Safety](https://myaccount.google.com/security)
- Look for "Less secure apps" and enable if available
- Or check "Security alerts" for any blocking messages

---

### Cause 4: SMTP Server Timeout

**Symptoms:**
- Error: `smtp-timeout`
- Console: `Email service timed out`

**Fixes:**
- Usually temporary network issue
- **Wait a minute and retry**
- If persistent, try port 587 instead of 465
- Check internet connection

---

## 🎯 Quick Fix Process (Do This Now)

### 1. Verify Diagnostic
```bash
curl http://localhost:5000/api/otp/diagnostic
```

If `smtpConfigured: false`, continue to step 2

### 2. Update .env File

Create file: `backend/.env`
```env
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FROM=your-gmail@gmail.com
```

Replace:
- `your-gmail@gmail.com` with your actual Gmail
- `xxxx xxxx xxxx xxxx` with the 16-character app password

**IMPORTANT:**
- File location: `backend/.env` (in backend folder, not root)
- No quotes around values
- No spaces in password

### 3. Restart Backend
```bash
# Press Ctrl+C to stop current server
# Then:
npm start
```

### 4. Test Diagnostic Again
```bash
curl http://localhost:5000/api/otp/diagnostic
```

Should now show:
```json
{
  "smtpConfigured": true,
  "issues": []
}
```

### 5. Run Test Script
```bash
node backend/scripts/testSmtpConfig.js
```

Should show:
```
✓ All required environment variables are set!
✓ SMTP connection successful!
✓ Test email sent successfully!
✓ All Tests Passed!
```

### 6. Test Frontend OTP
1. Go to Customer Login page
2. Click "Forgot Password"
3. Enter your registered email
4. Click "Send OTP"
5. Check your inbox for email with OTP code

---

## 📋 Troubleshooting Table

| Error | Command to Check | Solution |
|-------|------------------|----------|
| `smtp-not-configured` | `curl http://localhost:5000/api/otp/diagnostic` | Add SMTP vars to .env |
| `smtp-auth-failed` | `node backend/scripts/testSmtpConfig.js` | Use App Password, not Gmail password |
| `smtp-connection-failed` | Check firewall / internet | Try port 587, check network |
| `smtp-timeout` | Wait and retry | Network issue, usually temporary |

---

## ✅ After It Works

Document what finally worked:
- SMTP Server used: ________________
- Port: ________________
- SMTP_SECURE value: ________________

This helps if you need to set up production later.

---

## 🆘 Still Not Working?

If you've done all the above and still getting "Failed to send OTP":

1. **Check .env File Format**
   - Open in VS Code
   - No extra spaces
   - No quotes
   - Each line: `KEY=VALUE`

2. **Check .env Location**
   ```
   backend/.env  ← Correct location
   .env          ← Wrong! Should be in backend folder
   ```

3. **Verify Email Permissions**
   - Go to Gmail account settings
   - Check if Google blocked the login attempt
   - Check "Secure Apps" settings

4. **Clear Node Cache**
   ```bash
   # Ctrl+C to stop server
   npm cache clean --force
   npm start
   ```

5. **Restart Everything**
   - Close VS Code
   - Kill any Node processes
   - Reopen project
   - Run `npm start` from backend folder

---

## 📞 Getting Help

When asking for help, provide:
1. Output of: `curl http://localhost:5000/api/otp/diagnostic`
2. Output of: `node backend/scripts/testSmtpConfig.js`
3. Screenshot of backend console errors
4. Confirm .env file is in `backend/` folder
5. The exact error message shown to user
