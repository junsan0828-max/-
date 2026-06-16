import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DietPlanner from "./pages/DietPlanner";
import AdminPage from "./pages/AdminPage";
import PostureAnalysis from "./pages/PostureAnalysis";
import ContractPrint from "./pages/ContractPrint";
import ContractForm from "./pages/ContractForm";

const path   = window.location.pathname;
const params = new URLSearchParams(window.location.search);
const isContractView = path.startsWith("/contract") && (params.has("name") || params.has("contractDate") || params.has("program"));

const App = path.startsWith("/admin")    ? AdminPage
           : path.startsWith("/posture") ? PostureAnalysis
           : path.startsWith("/contract") ? (isContractView ? ContractPrint : ContractForm)
           : DietPlanner;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
