# OTP Email Configuration Guide

## Problem
OTP emails are not being sent for customer login. This is because the SMTP (email service) is not configured.

## Root Cause
The backend requires SMTP credentials to send emails. Without these environment variables set, the email service cannot send OTP codes.

## Required Environment Variables

You need to set **one of these two configurations**:

### Option 1: Gmail SMTP (Recommended for Development)
```env
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FROM=your-gmail@gmail.com
```

### Option 2: Alternative Email Service (e.g., SendGrid, Mailgun, etc.)
```env
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
SMTP_HOST=smtp.sendgrid.net  # or your provider's SMTP host
SMTP_PORT=587  # or 465
SMTP_SECURE=true  # or false depending on port
SMTP_FROM=no-reply@yourcompany.com
```

### Option 3: Legacy Configuration (Still Supported)
```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
```

## Setting Up Gmail SMTP

### Step 1: Enable 2-Factor Authentication
1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Click "Security" in the left menu
3. Enable "2-Step Verification"

### Step 2: Generate App Password
1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Windows Computer" (or your device)
3. Click "Generate"
4. Copy the 16-character password (without spaces)

### Step 3: Update Environment Variables

#### For Development (Localhost)
Create or update `.env` file in the `backend/` directory:

```env
# Database
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=development

# Email Configuration (Gmail)
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_FROM=your-gmail@gmail.com

# JWT Secrets
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

#### For Production
Set these environment variables in your deployment platform:
- **Vercel**: Settings → Environment Variables
- **Railway**: Variables
- **Heroku**: Config Vars
- **Azure**: Application Settings

### Step 4: Verify Configuration

1. **Check Diagnostic Endpoint**:
   ```bash
   curl http://localhost:5000/api/otp/diagnostic
   ```
   
   Expected response if configured:
   ```json
   {
     "service": "OTP Service",
     "smtpConfigured": true,
     "config": {
       "SMTP_HOST": "smtp.gmail.com",
       "SMTP_PORT": 465,
       "SMTP_SECURE": true,
       "SMTP_USER": "***configured***",
       "SMTP_PASS": "***configured***",
       "SMTP_FROM": "your-gmail@gmail.com"
     },
     "issues": [],
     "timestamp": "2026-03-26T10:30:00.000Z"
   }
   ```

2. **Check Server Logs**:
   Look for startup message:
   ```
   [emailService] SMTP configured for user: you***
   ```

## Troubleshooting

### Issue: "SMTP_USER environment variable is not set"
**Solution**: Add `SMTP_USER` or `EMAIL_USER` to your `.env` file or deployment platform environment variables.

### Issue: "SMTP_PASS environment variable is not set"
**Solution**: Add `SMTP_PASS` or `EMAIL_PASS` to your `.env` file or deployment platform environment variables.

### Issue: "Email service authentication failed"
**Solution**: 
- For Gmail: Ensure you generated an App Password (not your regular Gmail password)
- Check that credentials are correct and have no extra spaces
- For 2FA issues with Gmail, visit [Less secure app access settings](https://myaccount.google.com/u/0/security/lesssecureapps) (if available)

### Issue: "Could not connect to email service"
**Solution**:
- Verify SMTP_HOST and SMTP_PORT are correct
- Check if firewall is blocking SMTP port
- Try port 587 or 465 depending on your email provider
- For Gmail: Use `smtp.gmail.com:465` with `SMTP_SECURE=true`

### Issue: "Email service timed out"
**Solution**:
- Network issue - retry after a moment
- Try a different SMTP port (commonly 587 or 465)
- Check your internet connection

## Testing OTP Email Sending

### Using cURL (Development)
```bash
curl -X POST http://localhost:5000/api/otp/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test-email@gmail.com"}'
```

### Using Frontend
1. Go to Customer Login page
2. Click "Forgot Password" or try "Send OTP"
3. Enter your registered email
4. Click "Send OTP"
5. Check your email inbox for the OTP code

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_USER` | Yes* | - | Email address for SMTP authentication |
| `SMTP_PASS` | Yes* | - | Password/API key for SMTP authentication |
| `SMTP_HOST` | No | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | No | `465` | SMTP server port |
| `SMTP_SECURE` | No | `true` | Use TLS/SSL connection |
| `SMTP_FROM` | No | `SMTP_USER` | Email address to send from |
| `EMAIL_USER` | Yes* | - | Legacy: Alternative to `SMTP_USER` |
| `EMAIL_PASS` | Yes* | - | Legacy: Alternative to `SMTP_PASS` |

*Either `SMTP_USER` + `SMTP_PASS` OR `EMAIL_USER` + `EMAIL_PASS` is required

## Next Steps

1. **Restart Backend**: After setting environment variables, restart your Node.js server
   ```bash
   npm start
   ```

2. **Check Logs**: Look for confirmation message in server logs

3. **Test OTP**: Send an OTP and verify email is received

4. **Monitor**: Check console logs for any SMTP errors

## Production Considerations

- **Security**: Never commit `.env` file to version control. Use platform-specific secret management.
- **Email Limits**: Gmail limits to ~1500 emails/day. Consider using SendGrid or similar for production.
- **Rate Limiting**: OTP has a 3-request/15-minute limit per email to prevent spam.
- **Error Messages**: Sanitize error messages shown to users to avoid disclosing SMTP details.

## Support

If OTP emails still don't work after setup:
1. Run diagnostic: `GET /api/otp/diagnostic`
2. Check console logs for errors starting with `[emailService]` or `[OTP]`
3. Verify all environment variables are set correctly
4. Test with a simple email service first (Gmail is most reliable for testing)
