import "./styles/base.css";
import "./styles/themes.css";
import { OverlayApp } from "./overlay/OverlayApp";

const root = document.getElementById("app");
const app = new OverlayApp(root);

app.init().catch((error) => {
  console.error("[Creator OS] Overlay failed to boot", error);
  root.innerHTML = `<div class="overlay-empty-state">Overlay boot failed. Enable debug mode for details.</div>`;
});
