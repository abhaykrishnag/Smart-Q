const express = require("express");
const router = express.Router();
const Queue = require("../models/queue");

// JOIN QUEUE
router.post("/join", async (req, res) => {
  try {
    const { service } = req.body;

    if (!service) {
      return res.status(400).json({ message: "Service is required" });
    }

    // Generate token number
    const count = await Queue.countDocuments();
    const tokenNumber = `T${count + 1}`;

    // Calculate position in queue
    const waitingCount = await Queue.countDocuments({
      service,
      status: "Waiting"
    });
    const positionInQueue = waitingCount + 1;

    // Get current date/time for ML features
    const now = new Date();

    const newQueue = new Queue({
      tokenNumber,
      service,
      positionInQueue,
      joinedAt: now,
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours()
    });

    await newQueue.save();

    res.status(201).json({
      message: "Joined queue successfully",
      token: tokenNumber,
      positionInQueue: positionInQueue
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET QUEUE LIST (Admin)
router.get("/", async (req, res) => {
  try {
    const queue = await Queue.find().sort({ createdAt: 1 });
    res.json(queue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// START SERVING TOKEN
router.put("/:id/start", async (req, res) => {
  try {
    const queueItem = await Queue.findById(req.params.id);
    
    if (!queueItem) {
      return res.status(404).json({ message: "Queue item not found" });
    }

    const now = new Date();
    const startedAt = queueItem.startedAt || now;
    
    // Calculate waiting time
    const joinedAt = queueItem.joinedAt || queueItem.createdAt;
    const waitingTime = Math.round((startedAt - joinedAt) / (1000 * 60)); // minutes

    const updatedQueue = await Queue.findByIdAndUpdate(
      req.params.id,
      { 
        status: "In Progress",
        startedAt: startedAt,
        waitingTime: waitingTime
      },
      { new: true }
    );

    res.json(updatedQueue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// COMPLETE TOKEN
router.put("/:id/complete", async (req, res) => {
  try {
    const queueItem = await Queue.findById(req.params.id);
    
    if (!queueItem) {
      return res.status(404).json({ message: "Queue item not found" });
    }

    const now = new Date();
    const completedAt = queueItem.completedAt || now;
    
    // Calculate service time
    const startedAt = queueItem.startedAt || queueItem.joinedAt || queueItem.createdAt;
    const serviceTime = Math.round((completedAt - startedAt) / (1000 * 60)); // minutes

    const updatedQueue = await Queue.findByIdAndUpdate(
      req.params.id,
      { 
        status: "Completed",
        completedAt: completedAt,
        serviceTime: serviceTime
      },
      { new: true }
    );

    res.json(updatedQueue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
