<div align="center">
 
<br/>
 
```
 ███████╗███╗   ███╗ █████╗ ██████╗ ████████╗     ██████╗ 
 ██╔════╝████╗ ████║██╔══██╗██╔══██╗╚══██╔══╝    ██╔═══██╗
 ███████╗██╔████╔██║███████║██████╔╝   ██║       ██║   ██║
 ╚════██║██║╚██╔╝██║██╔══██║██╔══██╗   ██║       ██║▄▄ ██║
 ███████║██║ ╚═╝ ██║██║  ██║██║  ██║   ██║       ╚██████╔╝
 ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝        ╚══▀▀═╝ 
```
 
### Smart Queue Management System with Live Crowd Prediction
 
<br/>
 
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
 
<br/>
 
> *Eliminating physical queues through intelligent, real-time digital queue management.*
 
<br/>
 
</div>
 
---
 
## 📌 Overview
 
**Smart'Q** is a modern, full-stack **Smart Queue Management System** built for service environments — hospitals, banks, restaurants, and government offices. It goes far beyond basic token generation by offering **real-time queue tracking**, **ML-powered predictions**, and **dedicated interfaces** for both customers and administrators.
 
---
 
## ⚡ The Problem
 
| Traditional Systems | Smart'Q |
|---|---|
| Physical waiting lines | Digital queue joining from any device |
| Manual token handling | Automatic token generation |
| No crowd visibility | Live crowd-level insights |
| Static, refresh-dependent updates | Auto-updating real-time positions |
| No wait time estimates | ML-based waiting time prediction |
 
---
 
## 🎯 Objectives
 
- 🚫 Eliminate physical queues through fully digital queue management  
- 📱 Allow customers to join via login or **QR code scanning**  
- 🔄 Provide **real-time** queue position updates without page refresh  
- 🧠 Estimate waiting time using **live and historical data**  
- 🖥️ Enable admins to manage queues and counters efficiently  
- 📉 Reduce overcrowding and improve overall service experience  
- 🌐 Design a **scalable** system suitable for multi-branch deployment  
 
---
 
## 🗂️ System Modules
 
<details>
<summary><b>👤 Customer Module</b></summary>
 
<br/>
 
- Join the queue digitally or via **QR code**
- View **live queue position** updates in real time
- Track **estimated waiting time**
- Access from any mobile or desktop browser — no app install required
 
</details>
 
<details>
<summary><b>🛠️ Admin Module</b></summary>
 
<br/>
 
- Monitor **active queues** in real time
- Control queue flow: `Waiting → In Progress → Completed`
- Manage service **counters** and routing
- View system **analytics** and crowd trend dashboards
 
</details>
 
---
 
## 🏗️ Architecture
 
Smart'Q follows a clean **full-stack, REST-based architecture**:
 
```
┌─────────────────────────────────────────────────────────┐
│                        FRONTEND                         │
│              React · JavaScript · HTML/CSS              │
│                   Chart Visualizations                  │
└────────────────────────┬────────────────────────────────┘
                         │  REST API
┌────────────────────────▼────────────────────────────────┐
│                        BACKEND                          │
│              Node.js · Express.js · CORS                │
│                   RESTful API Layer                     │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
┌──────────────▼──────┐  ┌────────────▼────────────────── ┐
│      DATABASE       │  │         ML SERVICE              │
│    MongoDB Atlas    │  │   Python · Random Forest        │
│  (Cloud NoSQL DB)   │  │   Flask · scikit-learn          │
└─────────────────────┘  └─────────────────────────────────┘
```
 
Real-time behaviour is achieved through **frequent data synchronization** between the frontend and backend layers.
 
---
 
## 🛠️ Tech Stack
 
| Layer | Technologies |
|---|---|
| **Frontend** | React, JavaScript, HTML & CSS, Chart.js |
| **Backend** | Node.js, Express.js, RESTful APIs, CORS |
| **Database** | MongoDB Atlas (Cloud NoSQL) |
| **ML Service** | Python, scikit-learn (Random Forest) |
| **Dev Tools** | Git & GitHub, VS Code, Postman / Thunder Client |
 
---
 
## ✨ Core Features
 
### 👤 Customer-Facing
 
| Feature | Description |
|---|---|
| 🎫 Digital Queue Joining | Join remotely — no physical presence needed |
| 🔢 Auto Token Generation | Instant, unique token assigned on join |
| 📡 Live Queue Movement | Position updates without manual refresh |
| ⏱️ Wait Time Estimate | ML-powered estimated wait in minutes |
| 📱 Cross-Device UI | Clean interface on mobile & desktop |
 
### 🛠️ Admin-Facing
 
| Feature | Description |
|---|---|
| 🔁 Queue Lifecycle Control | Move tokens: `Waiting → In Progress → Completed` |
| 📊 Real-Time Monitoring | Live dashboard of all active queues |
| 📅 Event Management | Create and manage service events |
| 📈 Analytics Dashboard | Crowd trends and service performance |
 
---
 
## 🤖 ML Analytics & Predictions
 
Smart'Q integrates **Machine Learning** (Random Forest models) for intelligent crowd insights:
 
| Prediction | Description |
|---|---|
| ⏳ **Waiting Time** | Estimate wait based on position, service type & time patterns |
| 📊 **Queue Length** | Forecast crowd size for specific upcoming times |
| 🚶 **No-Show Probability** | Estimate likelihood a customer won't show up |
| 🕐 **Best Time to Visit** | Recommend optimal low-wait visit windows |
| 🔥 **Peak Hours** | Identify busy periods and queue density patterns |
 
### ML Setup
 
**1. Install dependencies:**
```bash
cd backend/ml
pip install -r requirements.txt
```
 
**2. Start the ML service:**
```bash
cd backend
python ml/ml_service.py
# Runs on http://localhost:5001
```
 
**3. Train models:**
```bash
POST http://localhost:5000/api/ml/train
```
 
### ML API Endpoints
 
```
Base: /api/ml/
 
POST   /predict/waiting-time    →  Predict customer wait time
POST   /predict/queue-length    →  Forecast queue/crowd size
POST   /predict/no-show         →  Estimate no-show probability
POST   /suggest/best-time       →  Get optimal visit time suggestions
POST   /predict/peak-hours      →  Identify peak usage periods
POST   /train                   →  Train all ML models
GET    /status                  →  Check ML service health
```
 
> 📖 See [`ML_SETUP_GUIDE.md`](./ML_SETUP_GUIDE.md) for full setup instructions.
 
---
 
## ⚙️ Production Configuration
 
Use environment-based URLs so `localhost ↔ production` switching requires **zero code edits**.
 
### Frontend — `frontend/.env`
```env
REACT_APP_API_URL=https://your-backend-domain.com
```
 
### Backend — `backend/.env`
```env
FRONTEND_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
ML_SERVICE_URL=https://your-ml-service-domain.com
```
 
### ML Service Environment
```env
FRONTEND_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
```
 
> **Note:** After each push, redeploy **frontend + backend + ML service** to reflect changes in production.
 
---
 
## 🔭 Future Scope
 
- 🧠 Enhanced ML models with external signals (weather, local events)
- ⚡ **WebSocket-based** real-time updates for zero-latency sync
- 📱 Native mobile apps (Android & iOS)
- 🔔 SMS / Email / Push notifications
- 🏢 **Multi-branch** queue management
- 📅 Integration with appointment booking systems
 
---
 
## 🎓 Academic Significance
 
This project demonstrates:
 
- ✅ Full-stack web application development (React + Node.js + MongoDB)
- ✅ REST API design, integration, and documentation
- ✅ Database modelling and cloud persistence
- ✅ Machine Learning integration in a real-world system
- ✅ Real-world problem solving using software engineering principles
- ✅ Collaborative development using Git & GitHub
 
---
 
## 👥 Project Team
 
| Name | Roll Number |
|---|---|
| **Abhay Krishna** | 233BCAB05 |
| **Nishan Rosary** | 233BCAB11 |
| **Stephen Fleming** | 233BCAB24 |
 
**Project Guide:** Ms. Junaida Nallakkandy
 
---
 
## 📝 Conclusion
 
**Smart'Q** presents a modern, scalable approach to queue management — combining **digital queue joining**, **real-time updates**, **ML-driven predictions**, and **administrative control** in one unified system.
 
It moves far beyond basic token generation, delivering a strong foundation for **intelligent, data-driven service management** deployable in real-world environments at scale.
 
---
 
<div align="center">
 
<br/>
 
*Built with ❤️ — Smart'Q Team · 2025*
 
</div>
 
