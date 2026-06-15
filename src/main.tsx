import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DietPlanner from "./pages/DietPlanner";
import AdminPage from "./pages/AdminPage";

const isAdmin = window.location.pathname.startsWith("/admin");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdmin ? <AdminPage /> : <DietPlanner />}
  </StrictMode>
);
