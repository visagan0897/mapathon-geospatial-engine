import { useEffect, useState } from "react";
import { APP_CONFIG } from "./config";

type BackendStatus = {
  status: string;
};

function App() {
  const [backendStatus, setBackendStatus] = useState("Connecting...");
  const [error, setError] = useState("");

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/health");

        if (!response.ok) {
          throw new Error("Backend request failed");
        }

        const data: BackendStatus = await response.json();
        setBackendStatus(data.status);
      } catch {
        setError("Backend connection failed");
      }
    };

    checkBackend();
  }, []);

  return (
    <main>
      <h1>{APP_CONFIG.name}</h1>

      <p>
        Backend Status:{" "}
        <strong>{error || backendStatus}</strong>
      </p>

      <p>Version: {APP_CONFIG.version}</p>
    </main>
  );
}

export default App;