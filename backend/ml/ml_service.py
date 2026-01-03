from flask import Flask, request, jsonify
from flask_cors import CORS
from models import QueueMLModels
import json
import sys

app = Flask(__name__)
CORS(app)

ml_models = QueueMLModels()

@app.route('/predict/waiting-time', methods=['POST'])
def predict_waiting_time():
    try:
        data = request.json
        prediction = ml_models.predict_waiting_time(data)
        return jsonify({'waitingTime': prediction, 'unit': 'minutes'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict/queue-length', methods=['POST'])
def predict_queue_length():
    try:
        data = request.json
        prediction = ml_models.predict_queue_length(data)
        return jsonify({'queueLength': prediction})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict/no-show', methods=['POST'])
def predict_no_show():
    try:
        data = request.json
        probability = ml_models.predict_no_show_probability(data)
        return jsonify({'noShowProbability': probability, 'percentage': round(probability * 100, 1)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict/peak-hours', methods=['POST'])
def predict_peak_hours():
    try:
        data = request.json
        density = ml_models.predict_peak_hours(data)
        return jsonify({'queueDensity': density, 'isPeak': density > 25})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/suggest/best-time', methods=['POST'])
def suggest_best_time():
    try:
        data = request.json
        service = data.get('service', 'General')
        day_of_week = data.get('dayOfWeek')
        suggestions = ml_models.suggest_best_time(service, day_of_week)
        return jsonify({'suggestions': suggestions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/train', methods=['POST'])
def train_models():
    try:
        data = request.json.get('data', [])
        
        if not data:
            return jsonify({'error': 'No training data provided'}), 400
        
        results = {}
        
        # Train all models
        results['waitingTime'] = ml_models.train_waiting_time_model(data)
        results['queueLength'] = ml_models.train_queue_length_model(data)
        results['noShow'] = ml_models.train_no_show_model(data)
        results['peakHours'] = ml_models.train_peak_hours_model(data)
        
        ml_models.is_trained = True
        
        return jsonify({
            'message': 'Models trained successfully',
            'results': results
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ML service is running', 'trained': ml_models.is_trained})

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
    app.run(host='0.0.0.0', port=port, debug=False)

