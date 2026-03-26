# Complete Line-by-Line Explanation: ML Service Files

## 📄 File 1: ml_service.py

### ===== IMPORTS & STARTUP =====

```python
import sys
import time
import os
```
**Why:**
- `sys` - System-specific parameters (used in production for debugging)
- `time` - Measure startup duration
- `os` - Read environment variables (PORT, FRONTEND_ORIGINS)

---

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
```
**Why:**
- `Flask` - Web framework for creating API endpoints
- `request` - Access incoming JSON data from frontend
- `jsonify` - Convert Python dictionaries to JSON responses
- `CORS` - Allow Cross-Origin requests (frontend calling backend)

---

```python
STARTUP_TS = time.time()
print("[ML] Booting service. Loading ML dependencies...", flush=True)
```
**Why:**
- `STARTUP_TS` - Record start time to measure how long loading takes
- `print(..., flush=True)` - Immediately show message (don't buffer output)
- This tells you the ML service is starting (first load takes 60 seconds)

---

```python
from models import QueueMLModels
print(f"[ML] ML dependencies loaded in {time.time() - STARTUP_TS:.1f}s", flush=True)
```
**Why:**
- Import the ML models class (defined in models.py)
- Calculate and display how many seconds loading took
- `.1f` format shows 1 decimal place (e.g., "45.2s")

---

```python
app = Flask(__name__)
```
**Why:**
- Create Flask application instance
- `__name__` = "ml_service" (identifies this app)
- This is the main web server object

---

```python
default_origins = [
    "http://localhost:3000",
    "https://smart-q.vercel.app",
    "https://smartq-system.vercel.app"
]
```
**Why:**
- List of allowed frontend URLs that can call this API
- `localhost:3000` = local development frontend
- `vercel.app` = production deployment URLs
- Prevents CORS errors when frontend calls ML endpoints

---

```python
configured_origins = [
    origin.strip()
    for origin in str(os.environ.get("FRONTEND_ORIGINS", "")).split(",")
    if origin.strip()
]
```
**Why:**
- Read `FRONTEND_ORIGINS` environment variable
- Split by comma (allows multiple origins)
- `.strip()` removes extra spaces
- `if origin.strip()` filters out empty strings
- Allows custom origins via environment variable

**Example:**
If `FRONTEND_ORIGINS="https://custom1.com, https://custom2.com"`
→ `configured_origins = ["https://custom1.com", "https://custom2.com"]`

---

```python
CORS(app, origins=configured_origins or default_origins)
```
**Why:**
- Enable CORS on the Flask app
- Use custom origins if set, otherwise use defaults
- Allows frontend to call `/predict`, `/train` endpoints without CORS errors

---

```python
ml_models = QueueMLModels()
```
**Why:**
- Create single instance of ML models (only once, reused for all requests)
- This loads all 4 trained models from disk (if saved)
- Used by all endpoints below

---

### ===== ENDPOINT 1: AUTO TRAIN =====

```python
@app.route('/queue/joined', methods=['POST'])
def user_joined():
    """
    Called automatically from Node.js when a user joins.
    Buffers data and auto-trains every 5 records.
    """
```
**Why:**
- `@app.route` = Create API endpoint
- `/queue/joined` = Endpoint URL path
- `POST` = Accept HTTP POST requests (receiving data)
- Docstring explains: Auto-trains when 5 users join queue

---

```python
    try:
        record = request.json
        if record is None:
            return jsonify({'error': 'Invalid or missing JSON payload'}), 400
```
**Why:**
- `try` - Handle any errors that might occur
- `record = request.json` - Get JSON body from POST request
- Return 400 error if JSON is missing/invalid
- Example: `{"queueLength": 10, "waitingTime": 15}`

---

```python
        result = ml_models.on_user_joined(record)
        return jsonify(result)
```
**Why:**
- Call ML models' buffer function (adds to buffer, trains if threshold reached)
- Returns status: `{"buffered": true, "buffer_size": 2, "trains_at": 5}`
- `jsonify` converts to JSON response

---

```python
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```
**Why:**
- Catch any errors (missing fields, type mismatch, etc.)
- Return 500 error with error message
- Prevents server crash if data is malformed

---

### ===== ENDPOINT 2-5: PREDICTIONS =====

```python
@app.route('/predict/waiting-time', methods=['POST'])
def predict_waiting_time():
    try:
        data = request.json
        if data is None:
            return jsonify({'error': 'Invalid or missing JSON payload'}), 400
        prediction = ml_models.predict_waiting_time(data)
        return jsonify({'waitingTime': prediction, 'unit': 'minutes'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

**What it does:**
- Endpoint: `POST /predict/waiting-time`
- Accepts: `{"dayOfWeek": 2, "hourOfDay": 14, "service": "Billing", ...}`
- Returns: `{"waitingTime": 12.5, "unit": "minutes"}`
- Calls ML model's predict function
- Same pattern for all 4 prediction endpoints

**Why this pattern:**
1. Validate input (not None)
2. Call ML model
3. Return result with unit
4. Catch errors gracefully

---

```python
@app.route('/predict/queue-length', methods=['POST'])
def predict_queue_length():
```
**Why:** Predicts how many people will be in queue at given time

---

```python
@app.route('/predict/no-show', methods=['POST'])
def predict_no_show():
    ...
    return jsonify({'noShowProbability': probability, 'percentage': round(probability * 100, 1)})
```
**Why:** 
- Predicts likelihood user won't show up (0-1)
- Converts to percentage (e.g., 0.15 → 15.0%)
- Example response: `{"noShowProbability": 0.15, "percentage": 15.0}`

---

```python
@app.route('/predict/peak-hours', methods=['POST'])
def predict_peak_hours():
    ...
    return jsonify({'queueDensity': density, 'isPeak': density > 25})
```
**Why:**
- Returns queue density (number of people)
- Also tells if it's a peak hour (`density > 25` means peak)
- Example: `{"queueDensity": 30, "isPeak": true}`

---

```python
@app.route('/suggest/best-time', methods=['POST'])
def suggest_best_time():
    try:
        data = request.json
        if data is None:
            return jsonify({'error': 'Invalid or missing JSON payload'}), 400
        suggestions = ml_models.suggest_best_time(
            data.get('service', 'General'), 
            data.get('dayOfWeek')
        )
        return jsonify({'suggestions': suggestions})
```
**Why:**
- Endpoint: `/suggest/best-time`
- Accepts: `{"service": "Billing", "dayOfWeek": 2}`
- Returns 3 best times with low queue/wait time
- Example response:
```json
{
  "suggestions": [
    {"hour": 10, "queueLength": 3, "waitingTime": 5},
    {"hour": 14, "queueLength": 5, "waitingTime": 8},
    {"hour": 16, "queueLength": 4, "waitingTime": 7}
  ]
}
```

---

### ===== ENDPOINT 6: MANUAL TRAINING =====

```python
@app.route('/train', methods=['POST'])
def train_models():
    """Manual bulk train — still available if needed"""
    try:
        data = request.json.get('data', [])
        if not data:
            return jsonify({'error': 'No training data provided'}), 400
```
**Why:**
- Manual endpoint (not auto-called)
- Admin can send historical data to retrain
- `get('data', [])` - Get data array, default to empty if missing

---

```python
        results = {
            'waitingTime': ml_models.train_waiting_time_model(data),
            'queueLength': ml_models.train_queue_length_model(data),
            'noShow':      ml_models.train_no_show_model(data),
            'peakHours':   ml_models.train_peak_hours_model(data)
        }
        ml_models.is_trained = True
        return jsonify({'message': 'Models trained successfully', 'results': results})
```
**Why:**
- Train all 4 models in sequence
- Set `is_trained = True` flag
- Return training scores for each model
- Example response:
```json
{
  "message": "Models trained successfully",
  "results": {
    "waitingTime": {"score": 0.89},
    "queueLength": {"score": 0.76},
    "noShow": {"score": 0.82},
    "peakHours": {"score": 0.85}
  }
}
```

---

### ===== ENDPOINT 7: HEALTH CHECK =====

```python
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ML service is running',
        'trained': ml_models.is_trained,
        'total_records': ml_models.total_records,
        'buffer_size': len(ml_models.buffer),
        'trains_at': ml_models.RETRAIN_EVERY if hasattr(ml_models, 'RETRAIN_EVERY') else 5
    })
```

**Why:**
- Health check endpoint (monitoring)
- Shows ML service status without predictions
- `hasattr()` checks if attribute exists before using it

**Response example:**
```json
{
  "status": "ML service is running",
  "trained": true,
  "total_records": 245,
  "buffer_size": 2,
  "trains_at": 5
}
```

---

### ===== MAIN ENTRY POINT =====

```python
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
```

**Why:**
- `if __name__ == '__main__'` - Only run when this file is executed directly (not imported)
- `os.environ.get("PORT", 5001)` - Get PORT from environment, default to 5001
- `app.run()` - Start Flask server
- `host="0.0.0.0"` - Listen on all network interfaces (not just localhost)
- `debug=False` - Disable debug mode in production

---

## 📄 File 2: models.py

### ===== IMPORTS & CONSTANTS =====

```python
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import joblib
import os
from datetime import datetime
```

**Why each import:**
- `pandas` - Data manipulation (DataFrames)
- `numpy` - Numerical arrays and math
- `RandomForestRegressor` - ML algorithm for predicting numbers (waiting time, queue length)
- `RandomForestClassifier` - ML algorithm for predicting categories (yes/no - will show up or not)
- `train_test_split` - Divide data into training/testing (80/20)
- `LabelEncoder` - Convert text to numbers (e.g., "Billing"→1, "Support"→2)
- `joblib` - Save/load models to disk
- `os` - File operations
- `datetime` - Get current date/time

---

```python
MIN_REAL_SAMPLES = 5
RETRAIN_EVERY = 5
```

**Why:**
- `MIN_REAL_SAMPLES = 5` - Don't train until we have 5 real records (prevents overfitting)
- `RETRAIN_EVERY = 5` - Auto-retrain after every 5 new records
- Both prevent training on insufficient data

---

### ===== CLASS INITIALIZATION =====

```python
class QueueMLModels:
    def __init__(self):
        self.models_dir = os.path.join(os.path.dirname(__file__), 'saved_models')
        os.makedirs(self.models_dir, exist_ok=True)
```

**Why:**
- Create class to hold all ML models
- `self.models_dir` = path to save models (e.g., `/backend/ml/saved_models`)
- `os.path.dirname(__file__)` = directory of this file (`/backend/ml/`)
- `os.makedirs(..., exist_ok=True)` - Create folder if doesn't exist, don't error if already exists

---

```python
        self.waiting_time_model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
        self.queue_length_model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
        self.no_show_model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10)
        self.peak_hours_model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
```

**Why each model:**
- `waiting_time_model` - Predicts: How many minutes wait (number)
- `queue_length_model` - Predicts: How many people in queue (number)
- `no_show_model` - Predicts: Will user show up? (yes/no)
- `peak_hours_model` - Predicts: How busy will it be? (number)

**Model parameters:**
- `n_estimators=100` - Use 100 decision trees (more trees = better but slower)
- `random_state=42` - Fixed randomness (reproducible results)
- `max_depth=10` - Trees max 10 levels deep (prevents overfitting)

---

```python
        self.label_encoders = {}
        self.is_trained = False
        self.total_records = 0
        self.buffer = []

        self._load_all_models()
```

**Why each variable:**
- `self.label_encoders` - Dictionary storing text→number converters (e.g., "Billing"→1)
- `self.is_trained` - Flag: Are models ready to make predictions?
- `self.total_records` - Counter: How many records trained on?
- `self.buffer` - Array: Store incoming records until threshold (5 records)
- `self._load_all_models()` - Load previously saved models from disk if they exist

---

### ===== AUTO TRAIN SECTION =====

```python
    def on_user_joined(self, queue_record):
        """Called when user joins queue (from Node.js backend)"""
        self.buffer.append(queue_record)
        print(f"[ML] Buffer: {len(self.buffer)}/{RETRAIN_EVERY} | Total trained: {self.total_records}")
```

**Why:**
- Called by `/queue/joined` endpoint
- `queue_record` = new user data (e.g., `{"service": "Billing", "waitingTime": 12}`)
- `append()` - Add to buffer
- `print()` - Show progress (e.g., "Buffer: 3/5")

---

```python
        if len(self.buffer) >= RETRAIN_EVERY:
            print("[ML] Threshold reached — starting auto training...")
            self._auto_train()

        return {
            "buffered": True,
            "buffer_size": len(self.buffer),
            "trains_at": RETRAIN_EVERY,
            "total_records": self.total_records
        }
```

**Why:**
- When buffer reaches 5 records, auto-train
- Return status to frontend/backend
- Example: `{"buffered": true, "buffer_size": 5, "trains_at": 5, "total_records": 50}`

---

```python
    def _auto_train(self):
        """Internal method to train models on buffered data"""
        if len(self.buffer) < MIN_REAL_SAMPLES:
            print(f"[ML] Not enough data. Need {MIN_REAL_SAMPLES}, have {len(self.buffer)}")
            return
```

**Why:**
- Check if buffer has minimum data (5 records)
- If not, skip training and exit
- Safety check to prevent training on too little data

---

```python
        data = self.buffer.copy()
        trained_any = False

        try:
```

**Why:**
- `self.buffer.copy()` - Make copy of data (don't modify original)
- `trained_any` - Track if any model trained successfully
- `try` - Catch any errors during training

---

```python
            r1 = self.train_waiting_time_model(data)
            r2 = self.train_queue_length_model(data)
            r3 = self.train_no_show_model(data)
            r4 = self.train_peak_hours_model(data)

            if any(r.get('score') is not None for r in [r1, r2, r3, r4]):
                trained_any = True
```

**Why:**
- Train all 4 models with buffered data
- `any(...for r in [r1, r2, r3, r4])` - Check if ANY model returned a score
- If models trained successfully, set `trained_any = True`

---

```python
            if trained_any:
                self.is_trained = True
                self.total_records += len(self.buffer)
                self.buffer = []
                self._save_metadata()
                print(f"[ML] ✓ Auto training complete on REAL data. Total: {self.total_records}")
            else:
                print("[ML] No models trained — waiting for more real data")
                self.buffer = []
```

**Why:**
- If training succeeded:
  - `is_trained = True` - Mark models as ready
  - `total_records += len(self.buffer)` - Increment total count
  - `self.buffer = []` - Clear buffer for next batch
  - `_save_metadata()` - Save progress to disk
- If training failed (not enough real data):
  - Clear buffer anyway and wait for more data

---

```python
        except Exception as e:
            print(f"[ML] Auto training failed: {e}")
```

**Why:**
- Catch any errors during training (data issues, memory, etc.)
- Print error for debugging
- Don't crash, just log and continue

---

### ===== FEATURE PREPARATION =====

```python
    def prepare_features(self, df, fit_encoders=False):
        """Convert raw data into ML-ready features"""
        df = df.copy()
```

**Why:**
- Prepare data for ML models
- `df.copy()` - Make copy so we don't modify original data
- This is called before training and predicting

---

```python
        if 'joinedAt' in df.columns:
            df['joinedAt'] = pd.to_datetime(df['joinedAt'])
            df['dayOfWeek']  = df['joinedAt'].dt.dayofweek
            df['hourOfDay']  = df['joinedAt'].dt.hour
            df['month']      = df['joinedAt'].dt.month
            df['dayOfMonth'] = df['joinedAt'].dt.day
```

**Why:**
- Extract datetime features from timestamp
- Example: `"2026-03-26T14:30:00"` →
  - `dayOfWeek = 3` (Thursday = 3, Monday = 0)
  - `hourOfDay = 14` (2 PM)
  - `month = 3` (March)
  - `dayOfMonth = 26`
- ML models can't understand timestamps, only numbers

---

```python
        if 'service' in df.columns:
            if fit_encoders or 'service' not in self.label_encoders:
                self.label_encoders['service'] = LabelEncoder()
                df['service_encoded'] = self.label_encoders['service'].fit_transform(df['service'].astype(str))
```

**Why:**
- Convert text service names to numbers
- `fit_encoders=True` during training (create mapping)
- `fit_encoders=False` during prediction (reuse mapping)
- Example:
  - "Billing" → 0
  - "Support" → 1
  - "Account" → 2
- ML models work with numbers, not text

---

```python
            else:
                encoder = self.label_encoders['service']
                known = set(encoder.classes_)
                df['service_encoded'] = df['service'].apply(
                    lambda v: int(encoder.transform([v])[0]) if v in known else -1
                )
```

**Why:**
- During prediction with existing encoder
- `known = set(encoder.classes_)` - All service types we've seen before
- `lambda v: ...` - For each service value:
  - If we've seen it before: encode to number
  - If new: encode as -1 (unknown)
- Prevents errors when new service types appear

---

### ===== TRAINING FUNCTIONS =====

```python
    def train_waiting_time_model(self, data):
        """Train model to predict waiting time"""
        df = pd.DataFrame(data)
        df = self.prepare_features(df, fit_encoders=True)
```

**Why:**
- Convert list of records to DataFrame (table format)
- Prepare features (extract datetime, encode text)
- `fit_encoders=True` - Create new encoders during training

---

```python
        feature_cols = ['dayOfWeek', 'hourOfDay', 'month', 'dayOfMonth', 'service_encoded', 'positionInQueue']
        feature_cols = [c for c in feature_cols if c in df.columns]

        X = df[feature_cols].fillna(0)
        y = df['waitingTime'].fillna(0) if 'waitingTime' in df.columns else pd.Series([0]*len(df))
```

**Why:**
- **Features (X)**: Input data
  - What day/time/service? How many ahead in queue?
  - `fillna(0)` - Replace missing values with 0
- **Target (y)**: What we're predicting
  - How long they actually waited
  - If missing, assume 0 minutes
- List comprehension filters to only columns that exist

---

```python
        if len(X) < MIN_REAL_SAMPLES:
            print("[ML] Not enough real data yet, skipping waiting_time model.")
            return {'score': None, 'message': 'Waiting for real data'}
```

**Why:**
- Safety check: Don't train if fewer than 5 records
- Return None score to indicate no training happened

---

```python
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        self.waiting_time_model.fit(X_train, y_train)
```

**Why:**
- Split data: 80% training, 20% testing
- Train model on 80% (learn patterns)
- Test on 20% (measure accuracy)
- `random_state=42` - Same split each time (reproducible)

---

```python
        joblib.dump(self.waiting_time_model, os.path.join(self.models_dir, 'waiting_time_model.pkl'))
        joblib.dump(self.label_encoders,     os.path.join(self.models_dir, 'label_encoders.pkl'))

        score = self.waiting_time_model.score(X_test, y_test)
        return {'score': round(score, 4)}
```

**Why:**
- Save trained model to disk (so it persists after restart)
- Save encoders too (needed for predicting)
- Calculate accuracy score on test data (e.g., 0.89 = 89% accurate)
- Return rounded score (4 decimal places)

---

```python
    def train_queue_length_model(self, data):
        # Similar pattern to waiting_time but:
```

**Why:**
- Same training pattern for queue length prediction
- Differences:
  - Predicts `queueLength` instead of `waitingTime`
  - Different features (no `positionInQueue` needed)

---

```python
        if 'status' in df.columns:
            df['queueLength'] = df.groupby(['dayOfWeek', 'hourOfDay'])['status'].transform(
                lambda x: (x == 'Waiting').sum()
            )
```

**Why:**
- Calculate queue length from status field
- Group by day and hour
- Count how many have status='Waiting'
- Example: On Thursday 2PM, 7 people were waiting → queueLength=7

---

```python
    def train_no_show_model(self, data):
        # ...
        if len(X) < MIN_REAL_SAMPLES or len(set(y)) < 2:
            print("[ML] Not enough real data yet, skipping no_show model.")
            return {'score': None, 'message': 'Waiting for real data'}
```

**Why:**
- Extra check: `len(set(y)) < 2`
- For classification, need examples of BOTH classes (showed up AND didn't show up)
- If all records show "showed up", can't train classifier

---

```python
    def train_peak_hours_model(self, data):
        # ...
        if 'status' in df.columns:
            df['queueDensity'] = df.groupby(['dayOfWeek', 'hourOfDay'])['status'].transform('count')
```

**Why:**
- Count total people at each day/hour
- `transform('count')` - Count records per group
- Example: Thursday 2PM had 15 people → queueDensity=15

---

### ===== PREDICTION FUNCTIONS =====

```python
    def predict_waiting_time(self, features):
        """Predict waiting time given features"""
        try:
            self._load_model_if_needed('waiting_time')
            df = pd.DataFrame([features])
            df = self.prepare_features(df)
```

**Why:**
- Load model from disk if not already loaded
- Convert input (dict) to DataFrame (1 row)
- Prepare features (extract datetime, encode text)
- `[features]` - Make it a list so DataFrame works

---

```python
            cols = [c for c in ['dayOfWeek', 'hourOfDay', 'month', 'dayOfMonth', 'service_encoded', 'positionInQueue'] if c in df.columns]
            return max(0, round(float(self.waiting_time_model.predict(df[cols].fillna(0))[0]), 2))
```

**Why:**
- Get only columns the model was trained on
- Predict using model
- `[0]` - Extract single prediction value
- `max(0, ...)` - Ensure result is not negative (can't have -5 minutes!)
- `round(..., 2)` - 2 decimal places (e.g., 12.45 minutes)

---

```python
        except Exception as e:
            print(f"[ML] predict_waiting_time error: {e}")
            return features.get('positionInQueue', 0) * 2
```

**Why:**
- If prediction fails, fallback to simple calculation
- Assume 2 minutes wait per person ahead
- `features.get('positionInQueue', 0)` - Get queue position, default to 0
- Example: Position 5 → predict 10 minutes

---

```python
    def predict_queue_length(self, features):
        # Similar pattern with fallback to 10
```

**Similar pattern, different fallback**

---

```python
    def predict_no_show_probability(self, features):
        # ...
        prob = self.no_show_model.predict_proba(df[cols].fillna(0))[0][1]
        return round(float(prob), 3)
```

**Why:**
- `predict_proba()` - Returns probabilities, not class
- Returns array like `[[0.85, 0.15]]` (85% show, 15% no-show)
- `[0][1]` - Get second probability (no-show probability)
- `round(..., 3)` - 3 decimal places (e.g., 0.153)

---

```python
    def predict_peak_hours(self, features):
        # Returns queue density (number of people)
        # Fallback: 20 people
```

---

```python
    def suggest_best_time(self, service, day_of_week=None):
        """Find 3 best times to visit (lowest queue/wait)"""
        try:
            target_day = day_of_week if day_of_week is not None else datetime.now().weekday()
```

**Why:**
- Find optimal times for user to visit
- If user specifies day: use that
- Otherwise: use today's day of week

---

```python
            best_times = []

            for hour in range(9, 18):  # Hours 9 AM to 5 PM
                features = {
                    'service': service,
                    'dayOfWeek': target_day,
                    'hourOfDay': hour,
                    'month': datetime.now().month,
                    'dayOfMonth': datetime.now().day,
                    'positionInQueue': 1
                }
                q = self.predict_queue_length(features)
                w = self.predict_waiting_time(features)
                best_times.append({
                    'hour': hour, 
                    'queueLength': q, 
                    'waitingTime': w, 
                    'score': q * 0.6 + w * 0.4
                })
```

**Why:**
- Loop through each hour (9 AM to 5 PM)
- For each hour, predict queue length and wait time
- Calculate composite score:
  - `q * 0.6` - 60% weight on queue length
  - `w * 0.4` - 40% weight on wait time
  - Lower score = better time to visit
- Example: 10 AM has 5 people waiting, 8 min wait → score = 5*0.6 + 8*0.4 = 6.2

---

```python
            best_times.sort(key=lambda x: x['score'])
            return [{'hour': t['hour'], 'queueLength': t['queueLength'], 'waitingTime': t['waitingTime']}
                    for t in best_times[:3]]
```

**Why:**
- Sort by score (lowest first = best times)
- Return top 3 best times (remove scores from response)
- Example response:
```json
[
  {"hour": 10, "queueLength": 3, "waitingTime": 5},
  {"hour": 14, "queueLength": 5, "waitingTime": 8},
  {"hour": 16, "queueLength": 4, "waitingTime": 7}
]
```

---

```python
        except Exception as e:
            return [
                {'hour': 10, 'queueLength': 5, 'waitingTime': 10},
                {'hour': 14, 'queueLength': 7, 'waitingTime': 14},
                {'hour': 16, 'queueLength': 6, 'waitingTime': 12}
            ]
```

**Why:**
- Fallback hardcoded suggestions if prediction fails
- Still provides useful info to user

---

### ===== SAVE/LOAD HELPERS =====

```python
    def _load_model_if_needed(self, model_type):
        """Load model from disk only if not already in memory"""
        paths = {
            'waiting_time': ('waiting_time_model.pkl', 'waiting_time_model'),
            'queue_length': ('queue_length_model.pkl', 'queue_length_model'),
            'no_show':      ('no_show_model.pkl',      'no_show_model'),
            'peak_hours':   ('peak_hours_model.pkl',   'peak_hours_model'),
        }
        filename, attr = paths[model_type]
        model = getattr(self, attr)
```

**Why:**
- Lazy loading: Load model from disk only when needed (for predictions)
- `paths` dict maps model types to filenames
- `getattr(self, attr)` - Get the model object (e.g., `self.waiting_time_model`)

---

```python
        if not hasattr(model, 'feature_importances_'):
            path = os.path.join(self.models_dir, filename)
            if os.path.exists(path):
                setattr(self, attr, joblib.load(path))
                encoders_path = os.path.join(self.models_dir, 'label_encoders.pkl')
                if os.path.exists(encoders_path):
                    self.label_encoders = joblib.load(encoders_path)
```

**Why:**
- `hasattr(model, 'feature_importances_')` - Check if model is already trained
  - Trained models have this attribute, untrained don't
- If not trained:
  - Check if saved file exists on disk
  - Load it and store in `self.waiting_time_model`
  - Also load encoders (needed for predicting)
- This avoids loading if already in memory (fast!)

---

```python
    def _load_all_models(self):
        """Load all 4 models from disk on startup"""
        for model_type in ['waiting_time', 'queue_length', 'no_show', 'peak_hours']:
            self._load_model_if_needed(model_type)
```

**Why:**
- Called in `__init__` to load all saved models at startup
- Checks if previously trained models exist on disk
- If they do, loads them so predictions work immediately

---

```python
        meta_path = os.path.join(self.models_dir, 'metadata.pkl')
        if os.path.exists(meta_path):
            meta = joblib.load(meta_path)
            self.is_trained    = meta.get('is_trained', False)
            self.total_records = meta.get('total_records', 0)
            print(f"[ML] Models loaded. Trained on {self.total_records} records.")
```

**Why:**
- Load metadata (how many records trained on)
- `meta.get(..., default)` - Get value with default if key missing
- Show startup message with training info
- Example: `"[ML] Models loaded. Trained on 245 records."`

---

```python
    def _save_metadata(self):
        """Save training progress to disk"""
        joblib.dump(
            {'is_trained': self.is_trained, 'total_records': self.total_records},
            os.path.join(self.models_dir, 'metadata.pkl')
        )
```

**Why:**
- After training, save metadata
- So on restart, we know how many records we've trained on
- Stored as dictionary with 2 keys
- File: `/backend/ml/saved_models/metadata.pkl`

---

## 🎯 High-Level Summary

### **ml_service.py** (Flask API)
- Creates web endpoints that accept HTTP requests
- Calls ML models to predict queue metrics
- Returns JSON responses to frontend
- 7 endpoints:
  1. `/queue/joined` - Auto-train endpoint
  2. `/predict/waiting-time` - Predict wait time
  3. `/predict/queue-length` - Predict queue size
  4. `/predict/no-show` - Predict no-show probability
  5. `/predict/peak-hours` - Predict queue density
  6. `/suggest/best-time` - Suggest 3 best times
  7. `/train` - Manual training endpoint
  8. `/health` - Health check

### **models.py** (ML Logic)
- 4 machine learning models using Random Forests
- Auto-trains every 5 records (buffer system)
- Feature engineering (datetime extraction, text encoding)
- Predictions with fallbacks
- Saves/loads models from disk
- Metadata tracking

### **Data Flow**
```
User joins queue (Node.js backend)
        ↓
POST /queue/joined
        ↓
Add to buffer
        ↓
When 5 records buffered:
        ↓
Train 4 models
        ↓
Save to disk
        ↓
Next request uses trained models
        ↓
/predict/* endpoints give accurate predictions
```

### **Why This Architecture**
- **Auto-training**: Learns from real queue data automatically
- **Lazy loading**: Models only loaded when needed (efficient)
- **Fallback prediction**: If model fails, use simple formulas
- **Metadata tracking**: Know how much data was used to train
- **Persistence**: Models saved so learning persists after restart
