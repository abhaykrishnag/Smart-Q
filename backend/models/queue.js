const mongoose = require("mongoose");

const queueSchema = new mongoose.Schema(
  {
    tokenNumber: {
      type: String,
      required: true,
      unique: true
    },
    service: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["Waiting", "In Progress", "Completed", "No-Show"],
      default: "Waiting"
    },
    waitingTime: {
      type: Number, // in minutes
      default: 0
    },
    serviceTime: {
      type: Number, // in minutes
      default: 0
    },
    positionInQueue: {
      type: Number,
      default: 0
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    noShow: {
      type: Boolean,
      default: false
    },
    dayOfWeek: {
      type: Number, // 0-6 (Sunday-Saturday)
    },
    hourOfDay: {
      type: Number, // 0-23
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Queue", queueSchema);
