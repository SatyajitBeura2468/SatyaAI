import { createRoot } from "react-dom/client";
import { Intro } from "./Intro";

// Mounted in its own root so the intro stays independent of the app.
const host = document.createElement("div");
host.id = "intro-root";
document.body.appendChild(host);
createRoot(host).render(<Intro />);
