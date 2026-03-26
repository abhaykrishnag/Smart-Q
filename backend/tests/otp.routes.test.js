process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";
process.env.NODE_ENV = "test";

const request = require("supertest");

const mockCustomerUser = {
  _id: "507f191e810c19729de860ef",
  name: "OTP Customer",
  email: "otp_customer@example.com",
  phone: null,
  role: "customer",
  isActive: true
};

const mockOtpStore = new Map();
const mockSendLoginOtpEmail = jest.fn(async () => ({ sent: false, reason: "smtp-auth-failed" }));

jest.mock("../models/user", () => ({
  findOne: jest.fn(async (query) => {
    if (query?.email === mockCustomerUser.email) {
      return mockCustomerUser;
    }
    return null;
  }),
  findById: jest.fn(async () => null)
}));

jest.mock("../models/otp", () => ({
  deleteMany: jest.fn(async (query) => {
    mockOtpStore.delete(query.email);
    return { acknowledged: true, deletedCount: 1 };
  }),
  create: jest.fn(async (payload) => {
    const existing = mockOtpStore.get(payload.email) || [];
    const record = {
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockOtpStore.set(payload.email, [...existing, record]);
    return record;
  }),
  findOne: jest.fn((query) => ({
    sort: jest.fn(async () => {
      const records = mockOtpStore.get(query.email) || [];
      return records[records.length - 1] || null;
    })
  })),
  updateOne: jest.fn(async (query) => {
    const records = [...(mockOtpStore.get(mockCustomerUser.email) || [])];
    const index = records.findIndex((record) => String(record._id || "") === String(query._id || ""));
    if (index >= 0) {
      records[index] = {
        ...records[index],
        updatedAt: new Date()
      };
      mockOtpStore.set(mockCustomerUser.email, records);
    }
    return { acknowledged: true, matchedCount: index >= 0 ? 1 : 0, modifiedCount: index >= 0 ? 1 : 0 };
  })
}));

jest.mock("../models/queue", () => ({
  syncIndexes: jest.fn(async () => undefined)
}));

jest.mock("../services/emailService", () => ({
  sendQueueRegistrationEmail: jest.fn(async () => ({ sent: true })),
  sendLoginOtpEmail: mockSendLoginOtpEmail
}));

jest.mock("../services/eventCleanupService", () => ({
  purgeExpiredEvents: jest.fn(async () => ({ deletedEvents: 0, deletedQueues: 0 }))
}));

const { app } = require("../app");

describe("OTP routes", () => {
  beforeEach(() => {
    mockOtpStore.clear();
    mockSendLoginOtpEmail.mockReset();
    mockSendLoginOtpEmail.mockImplementation(async () => ({ sent: false, reason: "smtp-auth-failed" }));
  });

  test("send-otp falls back in test mode when email delivery fails", async () => {
    const res = await request(app)
      .post("/api/otp/send-otp")
      .send({ email: mockCustomerUser.email });

    expect(res.status).toBe(200);
    expect(res.body.delivery).toBe("fallback");
    expect(res.body.devOtp).toMatch(/^\d{6}$/);
    const records = mockOtpStore.get(mockCustomerUser.email) || [];
    expect(records[records.length - 1]?.otp).toBe(res.body.devOtp);
  });

  test("verify-otp accepts trimmed OTP values", async () => {
    mockOtpStore.set(mockCustomerUser.email, [
      {
        email: mockCustomerUser.email,
        otp: "123456",
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    const res = await request(app)
      .post("/api/otp/verify-otp")
      .send({ email: mockCustomerUser.email, otp: " 123456 " });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe(mockCustomerUser.email);
  });

  test("verify-otp uses the newest OTP when stale records exist", async () => {
    mockOtpStore.set(mockCustomerUser.email, [
      {
        email: mockCustomerUser.email,
        otp: "111111",
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(Date.now() - 20_000),
        updatedAt: new Date(Date.now() - 20_000)
      },
      {
        email: mockCustomerUser.email,
        otp: "239308",
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    const res = await request(app)
      .post("/api/otp/verify-otp")
      .send({ email: mockCustomerUser.email, otp: "239308" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  test("send-otp reuses an unexpired OTP instead of replacing it", async () => {
    mockOtpStore.set(mockCustomerUser.email, [
      {
        _id: "otp-1",
        email: mockCustomerUser.email,
        otp: "127473",
        expiresAt: new Date(Date.now() + 4 * 60 * 1000),
        createdAt: new Date(Date.now() - 60_000),
        updatedAt: new Date(Date.now() - 60_000)
      }
    ]);

    const res = await request(app)
      .post("/api/otp/send-otp")
      .send({ email: mockCustomerUser.email });

    expect(res.status).toBe(200);
    expect(res.body.delivery).toBe("fallback");
    expect(res.body.devOtp).toBe("127473");
  });

  test("send-otp returns pending when email delivery times out", async () => {
    mockSendLoginOtpEmail.mockImplementation(async () => ({ sent: false, reason: "smtp-timeout" }));

    const res = await request(app)
      .post("/api/otp/send-otp")
      .send({ email: mockCustomerUser.email });

    expect(res.status).toBe(200);
    expect(res.body.delivery).toBe("pending");
    expect(String(res.body.message || "")).toContain("may take a short while");
  });
});
