import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import Dashboard from "@/pages/Dashboard";
import ChatbotAmbassador from "@/pages/ChatbotAmbassador";
import { Toaster } from "sonner";

const toastOptions = {
  style: {
    background: "var(--vsm-surface)",
    border: "1px solid var(--vsm-border-strong)",
    color: "var(--vsm-cream)",
    borderRadius: 0,
    fontFamily: "var(--font-body)",
  },
};

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--vsm-black)] text-[var(--vsm-cream)]">
      <BrowserRouter>
        <Routes>
          <Route path="/chatbot" element={<ChatbotAmbassador />} />
          <Route path="/*" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" toastOptions={toastOptions} />
    </div>
  );
}
