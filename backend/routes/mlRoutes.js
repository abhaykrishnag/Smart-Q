const express = require("express");
const router = express.Router();
const Queue = require("../models/queue");
const { spawn } = require("child_process");
const axios = require("axios");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

// Helper function to prepare features from queue data
const prepareFeatures = (queueItem, additionalData = {}) => {
  const now = new Date();
  const joinedAt = queueItem.joinedAt ? new Date(queueItem.joinedAt) : now;
  
  return {
    service: queueItem.service || "General",
    dayOfWeek: joinedAt.getDay(),
    hourOfDay: joinedAt.getHours(),
    month: joinedAt.getMonth() + 1,
    dayOfMonth: joinedAt.getDate(),
    positionInQueue: queueItem.positionInQueue || additionalData.positionInQueue || 1,
    ...additionalData
  };
};

// Helper function to call ML service
const callMLService = async (endpoint, data) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}${endpoint}`, data, {
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error(`ML Service Error (${endpoint}):`, error.message);
    // Return fallback predictions
    return getFallbackPrediction(endpoint);
  }
};

const getFallbackPrediction = (endpoint) => {
  if (endpoint.includes('waiting-time')) {
    return { waitingTime: 15, unit: 'minutes' };
  } else if (endpoint.includes('queue-length')) {
    return { queueLength: 10 };
  } else if (endpoint.includes('no-show')) {
    return { noShowProbability: 0.15, percentage: 15 };
  } else if (endpoint.includes('peak-hours')) {
    return { queueDensity: 20, isPeak: false };
  }
  return {};
};

// ⏱️ PREDICT WAITING TIME
router.post("/predict/waiting-time", async (req, res) => {
  try {
    const { tokenNumber, service, positionInQueue } = req.body;
    
    let queueItem = null;
    if (tokenNumber) {
      queueItem = await Queue.findOne({ tokenNumber });
    }
    
    if (!queueItem && !service) {
      return res.status(400).json({ message: "Token number or service is required" });
    }
    
    // Get current position if not provided
    let position = positionInQueue;
    if (!position && queueItem) {
      const waitingCount = await Queue.countDocuments({
        service: queueItem.service,
        status: "Waiting",
        createdAt: { $lt: queueItem.createdAt }
      });
      position = waitingCount + 1;
    }
    
    const features = prepareFeatures(
      queueItem || { service, joinedAt: new Date() },
      { positionInQueue: position || 1 }
    );
    
    const prediction = await callMLService("/predict/waiting-time", features);
    
    res.json({
      ...prediction,
      features: features
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 📈 PREDICT QUEUE LENGTH / CROWD
router.post("/predict/queue-length", async (req, res) => {
  try {
    const { service, date, hour } = req.body;
    
    const targetDate = date ? new Date(date) : new Date();
    const targetHour = hour !== undefined ? hour : targetDate.getHours();
    
    const features = {
      service: service || "General",
      dayOfWeek: targetDate.getDay(),
      hourOfDay: targetHour,
      month: targetDate.getMonth() + 1,
      dayOfMonth: targetDate.getDate()
    };
    
    const prediction = await callMLService("/predict/queue-length", features);
    
    res.json({
      ...prediction,
      features: features
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 👥 PREDICT NO-SHOW PROBABILITY
router.post("/predict/no-show", async (req, res) => {
  try {
    const { tokenNumber, service, positionInQueue } = req.body;
    
    let queueItem = null;
    if (tokenNumber) {
      queueItem = await Queue.findOne({ tokenNumber });
    }
    
    const features = prepareFeatures(
      queueItem || { service, joinedAt: new Date() },
      { positionInQueue: positionInQueue || 1 }
    );
    
    const prediction = await callMLService("/predict/no-show", features);
    
    res.json({
      ...prediction,
      features: features
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 🕒 SUGGEST BEST TIME TO VISIT
router.post("/suggest/best-time", async (req, res) => {
  try {
    const { service, dayOfWeek } = req.body;
    
    const data = {
      service: service || "General",
      dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : new Date().getDay()
    };
    
    const suggestions = await callMLService("/suggest/best-time", data);
    
    res.json({
      ...suggestions,
      service: data.service,
      dayOfWeek: data.dayOfWeek
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ⚠️ PREDICT PEAK HOURS
router.post("/predict/peak-hours", async (req, res) => {
  try {
    const { service, date, hour } = req.body;
    
    const targetDate = date ? new Date(date) : new Date();
    const targetHour = hour !== undefined ? hour : targetDate.getHours();
    
    const features = {
      service: service || "General",
      dayOfWeek: targetDate.getDay(),
      hourOfDay: targetHour,
      month: targetDate.getMonth() + 1,
      dayOfMonth: targetDate.getDate()
    };
    
    const prediction = await callMLService("/predict/peak-hours", features);
    
    // Get predictions for all hours of the day
    const hourlyPredictions = [];
    for (let h = 9; h < 18; h++) {
      const hourFeatures = { ...features, hourOfDay: h };
      const hourPred = await callMLService("/predict/peak-hours", hourFeatures);
      hourlyPredictions.push({
        hour: h,
        queueDensity: hourPred.queueDensity || 20,
        isPeak: hourPred.isPeak || false
      });
    }
    
    res.json({
      current: prediction,
      hourlyPredictions: hourlyPredictions,
      peakHours: hourlyPredictions
        .filter(h => h.isPeak)
        .map(h => h.hour)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// TRAIN MODELS
router.post("/train", async (req, res) => {
  try {
    // Fetch all queue data
    const queueData = await Queue.find({});
    
    if (queueData.length === 0) {
      return res.status(400).json({ 
        message: "No training data available. Please add queue entries first." 
      });
    }
    
    // Prepare data for ML service
    const trainingData = queueData.map(item => {
      const joinedAt = item.joinedAt ? new Date(item.joinedAt) : item.createdAt;
      const startedAt = item.startedAt ? new Date(item.startedAt) : null;
      const completedAt = item.completedAt ? new Date(item.completedAt) : null;
      
      // Calculate waiting time
      let waitingTime = 0;
      if (startedAt && joinedAt) {
        waitingTime = Math.round((startedAt - joinedAt) / (1000 * 60)); // minutes
      }
      
      // Calculate service time
      let serviceTime = 0;
      if (completedAt && startedAt) {
        serviceTime = Math.round((completedAt - startedAt) / (1000 * 60)); // minutes
      }
      
      return {
        service: item.service,
        status: item.status,
        waitingTime: waitingTime,
        serviceTime: serviceTime,
        positionInQueue: item.positionInQueue || 0,
        noShow: item.noShow || false,
        joinedAt: joinedAt.toISOString(),
        startedAt: startedAt ? startedAt.toISOString() : null,
        completedAt: completedAt ? completedAt.toISOString() : null,
        dayOfWeek: joinedAt.getDay(),
        hourOfDay: joinedAt.getHours(),
        month: joinedAt.getMonth() + 1,
        dayOfMonth: joinedAt.getDate()
      };
    });
    
    // Call ML service to train
    const response = await axios.post(`${ML_SERVICE_URL}/train`, {
      data: trainingData
    }, {
      timeout: 30000
    });
    
    res.json({
      message: "Models trained successfully",
      dataPoints: trainingData.length,
      results: response.data.results
    });
  } catch (error) {
    console.error("Training error:", error);
    res.status(500).json({ 
      message: error.message,
      note: "Make sure ML service is running on port 5001"
    });
  }
});

// GET ML SERVICE STATUS
router.get("/status", async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`, {
      timeout: 2000
    });
    res.json({
      mlService: "connected",
      ...response.data
    });
  } catch (error) {
    res.json({
      mlService: "disconnected",
      error: error.message,
      note: "Start ML service with: python ml/ml_service.py"
    });
  }
});

module.exports = router;

