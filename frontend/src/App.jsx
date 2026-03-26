import React, { useState, useEffect } from "react";
import { checkBackendHealth, getEventById, setAuthToken } from "./services/api";
import "./styles/global.css";

// Customer Components
import LandingPage from "./components/customer/LandingPage";
import CustomerLogin from "./components/customer/CustomerLogin";
import CustomerDashboard from "./components/customer/CustomerDashboard";
import JoinQueue from "./components/customer/JoinQueue";
import WelcomePage from "./components/customer/WelcomePage";

// Admin Components
import AdminLogin from "./components/admin/AdminLogin";
import AdminDashboard from "./components/admin/AdminDashboard";
import EventScheduler from "./components/admin/EventScheduler";
import EventHistory from "./components/admin/EventHistory";
import QueueManagement from "./components/admin/QueueManagement";
import CounterManagement from "./components/admin/CounterManagement";
import Analytics from "./components/admin/Analytics";
import Predictions from "./components/admin/Predictions";
import AdminSettings from "./components/admin/AdminSettings";

function App() {

  const [currentPage, setCurrentPage] = useState("landing");

  const [pageData, setPageData] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [backendStatus, setBackendStatus] = useState("");
  const [customerData, setCustomerData] = useState(null);

  const navigate = (page, data = null) => {
    if (page !== currentPage) {
      setNavigationHistory((prev) => [...prev, currentPage]);
    }

    // Persist customer identity so JoinQueue can send token confirmation emails.
    // Don't require `data.name` because OTP-based auth may return empty/undefined name.
    if (page === "customer-dashboard" && data && (data.name || data.email || data.phone)) {
      setCustomerData(data);
    }

    setCurrentPage(page);
    localStorage.setItem("currentPage", page);
    setPageData(data);
  };

  const handleCustomerLogout = () => {
    setCustomerData(null);
    setPageData(null);
    setNavigationHistory([]);
    localStorage.removeItem("currentPage");
    setCurrentPage("landing");
  };

  const goBack = () => {
    if (navigationHistory.length > 0) {
      const previousPage = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory((prev) => prev.slice(0, -1));
      setCurrentPage(previousPage);
      localStorage.setItem("currentPage", previousPage);
      setPageData(null);
    } else {
      setCurrentPage("landing");
      localStorage.setItem("currentPage", "landing");
      setPageData(null);
    }
  };

  useEffect(() => {
    checkBackendHealth()
      .then((data) => setBackendStatus(data.message))
      .catch(() => setBackendStatus("Backend not reachable ❌"));
  }, []);

  // 🔥 Restore token on refresh
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setAuthToken(token);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("eventId");
    if (!eventId) return;

    const openEventFromQr = async () => {
      try {
        const event = await getEventById(eventId);
        if (!event) return;

        setCurrentPage("join-queue");
        setPageData({ event, isCustomer: false });
        localStorage.setItem("currentPage", "join-queue");
        window.history.replaceState({}, "", window.location.pathname);
      } catch (error) {
        // Keep default page when event lookup fails.
      }
    };

    openEventFromQr();
  }, []);

  const renderPage = () => {
    switch (currentPage) {

      case "landing":
        return <LandingPage onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "login":
        return <CustomerLogin onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "customer-dashboard":
        return <CustomerDashboard onNavigate={navigate} goBack={goBack} currentPage={currentPage} customerData={customerData} onLogout={handleCustomerLogout} />;

      case "join-queue":
        return <JoinQueue onNavigate={navigate} goBack={goBack} currentPage={currentPage} eventData={pageData} customerData={customerData} />;

      case "welcome":
        return <WelcomePage onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "admin-login":
        return <AdminLogin onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "admin-dashboard":
        return <AdminDashboard onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "event-scheduler":
        return <EventScheduler onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "event-history":
        return <EventHistory onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "queue-management":
        return <QueueManagement onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "counter-management":
        return <CounterManagement onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "analytics":
        return <Analytics onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "predictions":
        return <Predictions onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      case "settings":
        return <AdminSettings onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;

      default:
        return <LandingPage onNavigate={navigate} goBack={goBack} currentPage={currentPage} />;
    }
  };

  return <div className="App">{renderPage()}</div>;
}

export default App;
