import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import joblib
import os
from datetime import datetime

class QueueMLModels:
    def __init__(self):
        self.models_dir = os.path.join(os.path.dirname(__file__), 'saved_models')
        os.makedirs(self.models_dir, exist_ok=True)
        
        # Initialize models
        self.waiting_time_model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
        self.queue_length_model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
        self.no_show_model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10)
        self.peak_hours_model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
        
        self.label_encoders = {}
        self.is_trained = False
        
    def prepare_features(self, df):
        """Prepare features from raw data"""
        df = df.copy()
        
        # Extract time features
        if 'joinedAt' in df.columns:
            df['joinedAt'] = pd.to_datetime(df['joinedAt'])
            df['dayOfWeek'] = df['joinedAt'].dt.dayofweek
            df['hourOfDay'] = df['joinedAt'].dt.hour
            df['month'] = df['joinedAt'].dt.month
            df['dayOfMonth'] = df['joinedAt'].dt.day
        
        # Encode categorical features
        if 'service' in df.columns:
            if 'service' not in self.label_encoders:
                self.label_encoders['service'] = LabelEncoder()
                df['service_encoded'] = self.label_encoders['service'].fit_transform(df['service'])
            else:
                df['service_encoded'] = self.label_encoders['service'].transform(df['service'])
        
        return df
    
    def train_waiting_time_model(self, data):
        """Train model to predict waiting time"""
        df = pd.DataFrame(data)
        df = self.prepare_features(df)
        
        # Features for waiting time prediction
        feature_cols = ['dayOfWeek', 'hourOfDay', 'month', 'dayOfMonth', 'service_encoded', 'positionInQueue']
        feature_cols = [col for col in feature_cols if col in df.columns]
        
        X = df[feature_cols].fillna(0)
        y = df['waitingTime'].fillna(0)
        
        if len(X) < 10:
            # Generate synthetic data for initial training
            X, y = self._generate_synthetic_data('waiting_time')
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        self.waiting_time_model.fit(X_train, y_train)
        
        # Save model
        joblib.dump(self.waiting_time_model, os.path.join(self.models_dir, 'waiting_time_model.pkl'))
        joblib.dump(self.label_encoders, os.path.join(self.models_dir, 'label_encoders.pkl'))
        
        return {'score': self.waiting_time_model.score(X_test, y_test)}
    
    def train_queue_length_model(self, data):
        """Train model to predict queue length"""
        df = pd.DataFrame(data)
        df = self.prepare_features(df)
        
        feature_cols = ['dayOfWeek', 'hourOfDay', 'month', 'dayOfMonth', 'service_encoded']
        feature_cols = [col for col in feature_cols if col in df.columns]
        
        X = df[feature_cols].fillna(0)
        
        # Calculate queue length (number of people waiting)
        df['queueLength'] = df.groupby(['dayOfWeek', 'hourOfDay', 'service'])['status'].transform(
            lambda x: (x == 'Waiting').sum()
        )
        y = df['queueLength'].fillna(0)
        
        if len(X) < 10:
            X, y = self._generate_synthetic_data('queue_length')
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        self.queue_length_model.fit(X_train, y_train)
        
        joblib.dump(self.queue_length_model, os.path.join(self.models_dir, 'queue_length_model.pkl'))
        
        return {'score': self.queue_length_model.score(X_test, y_test)}
    
    def train_no_show_model(self, data):
        """Train model to predict no-show probability"""
        df = pd.DataFrame(data)
        df = self.prepare_features(df)
        
        feature_cols = ['dayOfWeek', 'hourOfDay', 'month', 'dayOfMonth', 'service_encoded', 'positionInQueue']
        feature_cols = [col for col in feature_cols if col in df.columns]
        
        X = df[feature_cols].fillna(0)
        y = df['noShow'].fillna(False).astype(int)
        
        if len(X) < 10:
            X, y = self._generate_synthetic_data('no_show')
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        self.no_show_model.fit(X_train, y_train)
        
        joblib.dump(self.no_show_model, os.path.join(self.models_dir, 'no_show_model.pkl'))
        
        return {'score': self.no_show_model.score(X_test, y_test)}
    
    def train_peak_hours_model(self, data):
        """Train model to predict peak hours"""
        df = pd.DataFrame(data)
        df = self.prepare_features(df)
        
        # Calculate queue density per hour
        df['queueDensity'] = df.groupby(['dayOfWeek', 'hourOfDay'])['status'].transform('count')
        
        feature_cols = ['dayOfWeek', 'hourOfDay', 'month', 'dayOfMonth', 'service_encoded']
        feature_cols = [col for col in feature_cols if col in df.columns]
        
        X = df[feature_cols].fillna(0)
        y = df['queueDensity'].fillna(0)
        
        if len(X) < 10:
            X, y = self._generate_synthetic_data('peak_hours')
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        self.peak_hours_model.fit(X_train, y_train)
        
        joblib.dump(self.peak_hours_model, os.path.join(self.models_dir, 'peak_hours_model.pkl'))
        
        return {'score': self.peak_hours_model.score(X_test, y_test)}
    
    def _generate_synthetic_data(self, model_type):
        """Generate synthetic training data when real data is insufficient"""
        np.random.seed(42)
        n_samples = 100
        
        X = pd.DataFrame({
            'dayOfWeek': np.random.randint(0, 7, n_samples),
            'hourOfDay': np.random.randint(0, 24, n_samples),
            'month': np.random.randint(1, 13, n_samples),
            'dayOfMonth': np.random.randint(1, 29, n_samples),
            'service_encoded': np.random.randint(0, 5, n_samples),
            'positionInQueue': np.random.randint(1, 50, n_samples)
        })
        
        if model_type == 'waiting_time':
            y = X['positionInQueue'] * 2 + X['hourOfDay'] * 0.5 + np.random.normal(0, 5, n_samples)
            y = np.maximum(y, 0)
        elif model_type == 'queue_length':
            y = 10 + X['hourOfDay'] * 0.8 + np.random.normal(0, 3, n_samples)
            y = np.maximum(y, 0)
        elif model_type == 'no_show':
            y = (X['hourOfDay'] > 18).astype(int) + (np.random.random(n_samples) > 0.85).astype(int)
            y = np.minimum(y, 1)
        else:  # peak_hours
            y = 20 + X['hourOfDay'] * 1.5 + np.random.normal(0, 5, n_samples)
            y = np.maximum(y, 0)
        
        return X, y
    
    def predict_waiting_time(self, features):
        """Predict waiting time in minutes"""
        try:
            # Load model if not loaded
            if not hasattr(self.waiting_time_model, 'feature_importances_'):
                model_path = os.path.join(self.models_dir, 'waiting_time_model.pkl')
                if os.path.exists(model_path):
                    self.waiting_time_model = joblib.load(model_path)
                    encoders_path = os.path.join(self.models_dir, 'label_encoders.pkl')
                    if os.path.exists(encoders_path):
                        self.label_encoders = joblib.load(encoders_path)
            
            df = pd.DataFrame([features])
            df = self.prepare_features(df)
            
            feature_cols = ['dayOfWeek', 'hourOfDay', 'month', 'dayOfMonth', 'service_encoded', 'positionInQueue']
            feature_cols = [col for col in feature_cols if col in df.columns]
            
            X = df[feature_cols].fillna(0)
            prediction = self.waiting_time_model.predict(X)[0]
            
            return max(0, round(prediction, 2))
        except Exception as e:
            # Return default prediction
            return features.get('positionInQueue', 0) * 2
    
    def predict_queue_length(self, features):
        """Predict queue length"""
        try:
            model_path = os.path.join(self.models_dir, 'queue_length_model.pkl')
            if os.path.exists(model_path):
                self.queue_length_model = joblib.load(model_path)
            
            df = pd.DataFrame([features])
            df = self.prepare_features(df)
            
            feature_cols = ['dayOfWeek', 'hourOfDay', 'month', 'dayOfMonth', 'service_encoded']
            feature_cols = [col for col in feature_cols if col in df.columns]
            
            X = df[feature_cols].fillna(0)
            prediction = self.queue_length_model.predict(X)[0]
            
            return max(0, round(prediction))
        except Exception as e:
            return 10
    
    def predict_no_show_probability(self, features):
        """Predict no-show probability (0-1)"""
        try:
            model_path = os.path.join(self.models_dir, 'no_show_model.pkl')
            if os.path.exists(model_path):
                self.no_show_model = joblib.load(model_path)
            
            df = pd.DataFrame([features])
            df = self.prepare_features(df)
            
            feature_cols = ['dayOfWeek', 'hourOfDay', 'month', 'dayOfMonth', 'service_encoded', 'positionInQueue']
            feature_cols = [col for col in feature_cols if col in df.columns]
            
            X = df[feature_cols].fillna(0)
            probability = self.no_show_model.predict_proba(X)[0][1]
            
            return round(probability, 3)
        except Exception as e:
            return 0.15
    
    def predict_peak_hours(self, features):
        """Predict queue density for peak hours"""
        try:
            model_path = os.path.join(self.models_dir, 'peak_hours_model.pkl')
            if os.path.exists(model_path):
                self.peak_hours_model = joblib.load(model_path)
            
            df = pd.DataFrame([features])
            df = self.prepare_features(df)
            
            feature_cols = ['dayOfWeek', 'hourOfDay', 'month', 'dayOfMonth', 'service_encoded']
            feature_cols = [col for col in feature_cols if col in df.columns]
            
            X = df[feature_cols].fillna(0)
            prediction = self.peak_hours_model.predict(X)[0]
            
            return max(0, round(prediction, 2))
        except Exception as e:
            return 20
    
    def suggest_best_time(self, service, day_of_week=None):
        """Suggest best time to visit based on historical data"""
        try:
            # Predict for all hours of the day
            best_times = []
            target_day = day_of_week if day_of_week is not None else datetime.now().weekday()
            
            for hour in range(9, 18):  # Business hours 9 AM to 6 PM
                features = {
                    'service': service,
                    'dayOfWeek': target_day,
                    'hourOfDay': hour,
                    'month': datetime.now().month,
                    'dayOfMonth': datetime.now().day,
                    'positionInQueue': 1
                }
                
                queue_length = self.predict_queue_length(features)
                waiting_time = self.predict_waiting_time(features)
                
                # Score: lower is better (less crowded, less waiting)
                score = queue_length * 0.6 + waiting_time * 0.4
                
                best_times.append({
                    'hour': hour,
                    'queueLength': queue_length,
                    'waitingTime': waiting_time,
                    'score': score
                })
            
            # Sort by score and return top 3
            best_times.sort(key=lambda x: x['score'])
            return [{'hour': t['hour'], 'queueLength': t['queueLength'], 'waitingTime': t['waitingTime']} 
                   for t in best_times[:3]]
        except Exception as e:
            # Default suggestions
            return [
                {'hour': 10, 'queueLength': 5, 'waitingTime': 10},
                {'hour': 14, 'queueLength': 7, 'waitingTime': 14},
                {'hour': 16, 'queueLength': 6, 'waitingTime': 12}
            ]

