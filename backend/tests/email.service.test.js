describe("emailService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "hello.smartqueue@gmail.com",
      SMTP_PASS: "app-password",
      SMTP_FROM: "hello.smartqueue@gmail.com",
      SMTP_ENABLE_FALLBACK: "true"
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
    jest.unmock("nodemailer");
  });

  test("retries with Gmail STARTTLS fallback after connection timeout", async () => {
    const sendMail465 = jest.fn(async () => {
      const error = new Error("Connection timeout");
      error.code = "ETIMEDOUT";
      throw error;
    });
    const sendMail587 = jest.fn(async () => ({ messageId: "fallback-ok" }));

    const createTransport = jest.fn((options) => ({
      sendMail: options.port === 465 ? sendMail465 : sendMail587,
      close: jest.fn()
    }));

    jest.doMock("nodemailer", () => ({
      createTransport
    }));

    const { sendLoginOtpEmail } = require("../services/emailService");

    const result = await sendLoginOtpEmail({
      toEmail: "customer@example.com",
      userName: "Customer",
      otp: "123456"
    });

    expect(result).toEqual({ sent: true, transport: "gmail-starttls-fallback" });
    expect(createTransport).toHaveBeenCalledTimes(2);
    expect(sendMail465).toHaveBeenCalledTimes(1);
    expect(sendMail587).toHaveBeenCalledTimes(1);
  });

  test("returns auth failure without retrying alternate transport", async () => {
    const sendMail = jest.fn(async () => {
      const error = new Error("Invalid login");
      error.code = "EAUTH";
      error.responseCode = 535;
      throw error;
    });

    const createTransport = jest.fn(() => ({
      sendMail,
      close: jest.fn()
    }));

    jest.doMock("nodemailer", () => ({
      createTransport
    }));

    const { sendLoginOtpEmail } = require("../services/emailService");

    const result = await sendLoginOtpEmail({
      toEmail: "customer@example.com",
      userName: "Customer",
      otp: "123456"
    });

    expect(result).toEqual({ sent: false, reason: "smtp-auth-failed" });
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
