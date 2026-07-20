import { installLocalApi } from "./local/localApi";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Backend local: toda la data vive en este navegador, sin servidor externo.
installLocalApi();

createRoot(document.getElementById("root")!).render(<App />);
