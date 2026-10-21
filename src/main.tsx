import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DietPlanner from "./pages/DietPlanner";
import AdminPage from "./pages/AdminPage";
import PostureAnalysis from "./pages/PostureAnalysis";
import ContractPrint from "./pages/ContractPrint";
import ContractForm from "./pages/ContractForm";
import SequenceMaker from "./pages/SequenceMaker";

const path   = window.location.pathname;

if (path === "/academy" || path === "/academy/") {
  fetch("/academy/page.htm", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
    .then((html) => { document.open(); document.write(html); document.close(); })
    .catch(() => { document.body.textContent = "페이지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."; });
} else {
  renderApp();
}

function renderApp() {
  const params = new URLSearchParams(window.location.search);
  const isContractView = path.startsWith("/contract") && (params.has("name") || params.has("contractDate") || params.has("program"));

  const App = path.startsWith("/admin")    ? AdminPage
             : path.startsWith("/posture") ? PostureAnalysis
             : path.startsWith("/sequence") ? SequenceMaker
             : path.startsWith("/contract") ? (isContractView ? ContractPrint : ContractForm)
             : DietPlanner;

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
