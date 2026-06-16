import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DietPlanner from "./pages/DietPlanner";
import AdminPage from "./pages/AdminPage";
import PostureAnalysis from "./pages/PostureAnalysis";
import ContractPrint from "./pages/ContractPrint";

const path = window.location.pathname;
const App = path.startsWith("/admin")    ? AdminPage
           : path.startsWith("/posture") ? PostureAnalysis
           : path.startsWith("/contract") ? ContractPrint
           : DietPlanner;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
