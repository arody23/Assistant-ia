import "@/App.css";
import Dashboard from "@/pages/Dashboard";
import { Toaster } from "sonner";

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--vsm-black)] text-[var(--vsm-cream)]">
      <Dashboard />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--vsm-surface)",
            border: "1px solid var(--vsm-border-strong)",
            color: "var(--vsm-cream)",
            borderRadius: 0,
            fontFamily: "var(--font-body)",
          },
        }}
      />
    </div>
  );
}
