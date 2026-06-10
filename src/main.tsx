import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DietPlanner from "./pages/DietPlanner";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DietPlanner />
  </StrictMode>
);
