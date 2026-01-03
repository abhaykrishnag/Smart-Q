const express = require("express");
const router = express.Router();
const Event = require("../models/event");

// CREATE EVENT (Admin)
router.post("/", async (req, res) => {
  try {
    const { title, organization, date, time, location } = req.body;

    const event = new Event({
      title,
      organization,
      date,
      time,
      location
    });

    await event.save();

    res.status(201).json({
      message: "Event created successfully",
      event
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET ALL EVENTS (Customer/Admin)
router.get("/", async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
