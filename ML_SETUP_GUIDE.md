# Machine Learning Setup Guide for Smart-Q

## Overview

The ML system uses Random Forest models to provide intelligent predictions for queue management:
- ⏱️ Predict waiting time
- 📈 Predict crowd/queue length
- 👥 Predict no-show probability
- 🕒 Suggest best time to visit
- ⚠️ Predict peak hours

## Prerequisites

1. **Python 3.8+** installed on your system
2. **Node.js** backend running
3. **MongoDB** database connected

## Installation Steps

### 1. Install Python Dependencies

Navigate to the backend directory and install ML dependencies:

```bash
cd Smart-Q/backend/ml
pip install -r requirements.txt
```

Or on Windows:
```bash
cd Smart-Q\backend\ml
pip install -r requirements.txt
```

### 2. Start the ML Service

**Option A: Using the startup script (Windows)**
```bash
cd Smart-Q/backend
start_ml_service.bat
```

**Option B: Using the startup script (Linux/Mac)**
```bash
cd Smart-Q/backend
chmod +x start_ml_service.sh
./start_ml_service.sh
```

**Option C: Manual start**
```bash
cd Smart-Q/backend/ml
python ml_service.py
```

The ML service will run on `http://localhost:5001`

### 3. Install Node.js Dependencies

Make sure axios is installed in the backend:

```bash
cd Smart-Q/backend
npm install
```

### 4. Start the Backend Server

In a separate terminal:

```bash
cd Smart-Q/backend
npm start
# or
npm run dev
```

The backend will run on `http://localhost:5000`

## Testing the ML Service

### Check ML Service Status

```bash
GET http://localhost:5000/api/ml/status
```

### Train the Models

First, ensure you have some queue data in your database, then:

```bash
POST http://localhost:5000/api/ml/train
```

### Test Predictions

**Predict Waiting Time:**
```bash
POST http://localhost:5000/api/ml/predict/waiting-time
Body: {
  "tokenNumber": "T1",
  "service": "General",
  "positionInQueue": 5
}
```

**Predict Queue Length:**
```bash
POST http://localhost:5000/api/ml/predict/queue-length
Body: {
  "service": "General",
  "date": "2024-01-15",
  "hour": 14
}
```

**Predict No-Show:**
```bash
POST http://localhost:5000/api/ml/predict/no-show
Body: {
  "tokenNumber": "T1",
  "service": "General"
}
```

**Suggest Best Time:**
```bash
POST http://localhost:5000/api/ml/suggest/best-time
Body: {
  "service": "General",
  "dayOfWeek": 1
}
```

**Predict Peak Hours:**
```bash
POST http://localhost:5000/api/ml/predict/peak-hours
Body: {
  "service": "General",
  "date": "2024-01-15"
}
```

## API Endpoints Summary

All ML endpoints are prefixed with `/api/ml`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ml/status` | GET | Check ML service connection |
| `/api/ml/train` | POST | Train all models with database data |
| `/api/ml/predict/waiting-time` | POST | Predict waiting time |
| `/api/ml/predict/queue-length` | POST | Predict queue length |
| `/api/ml/predict/no-show` | POST | Predict no-show probability |
| `/api/ml/suggest/best-time` | POST | Get best time suggestions |
| `/api/ml/predict/peak-hours` | POST | Predict peak hours |

## How It Works

1. **Data Collection**: The enhanced Queue model automatically tracks:
   - Waiting times
   - Service times
   - Position in queue
   - Timestamps (joined, started, completed)
   - Day of week, hour of day
   - No-show status

2. **Training**: Models are trained using historical queue data with features like:
   - Day of week
   - Hour of day
   - Service type
   - Position in queue
   - Historical patterns

3. **Predictions**: Models use Random Forest algorithms to make predictions based on learned patterns.

4. **Fallback**: If the ML service is unavailable, the system provides reasonable default predictions.

## Troubleshooting

### ML Service Not Starting
- Check Python version: `python --version` (should be 3.8+)
- Verify dependencies: `pip list | grep -E "flask|pandas|scikit-learn"`
- Check port 5001 is not in use

### Models Not Training
- Ensure you have queue data in MongoDB
- Check ML service is running
- Verify database connection

### Predictions Not Working
- Check ML service status: `GET /api/ml/status`
- Train models first: `POST /api/ml/train`
- Check backend logs for errors

## Model Files

Trained models are saved in `backend/ml/saved_models/`:
- Models are automatically saved after training
- Models persist between service restarts
- Delete model files to force retraining

## Next Steps

1. Integrate ML predictions into your frontend
2. Add real-time prediction updates
3. Create admin dashboard for ML insights
4. Set up automated model retraining schedule

