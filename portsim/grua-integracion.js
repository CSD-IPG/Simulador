(() => {
  "use strict";
  const accessConfirmed = () => window.__csdIdentOk
    && document.body.classList.contains("ipg-auth-ok")
    && !document.getElementById("csdPrivacyGate");
  const field = id => document.getElementById(id)?.value.trim() || null;

  const launch = document.createElement("section");
  launch.id = "grua-launch";
  launch.setAttribute("aria-labelledby", "grua-heading");
  launch.innerHTML = `<div class="grua-copy">
    <p class="grua-role">Simulación de grúa portacontenedores</p>
    <h2 id="grua-heading">Grúa y Patio 3D</h2>
    <p>El buque está en el muelle y hay una carga con retiro prioritario. Desde la cabina, alinea el bastidor, iza los contenedores y decide dónde ubicarlos en el patio.</p>
    <p class="grua-modes">Practica en <strong>modo guiado</strong> o pon a prueba tus decisiones en <strong>modo desafío</strong>.</p>
    <button type="button" id="grua-start">Entrar a la cabina 3D</button>
    <p id="grua-status" role="status"></p>
  </div>
  <div class="grua-art"><img class="grua-cover" src="grua-cabina.webp" width="960" height="640" alt="Ilustración de una cabina de grúa con vista al buque y los contenedores del muelle."></div>`;
  document.querySelector(".shell").before(launch);

  const dialog = document.createElement("dialog");
  dialog.id = "grua-dialog";
  dialog.setAttribute("aria-label", "Grúa y Patio 3D");
  dialog.innerHTML = `<header><strong>Grúa y Patio 3D</strong>
    <span id="grua-sync" role="status"></span>
    <button type="button" id="grua-retry" hidden>Reintentar registro</button>
    <button type="button" id="grua-full">Pantalla completa</button>
    <button type="button" id="grua-back">Volver a Operaciones Portuarias</button></header>
    <iframe title="Cabina de grúa y patio 3D"></iframe>`;
  document.body.append(dialog);
  const style = document.createElement("style");
  style.textContent = `
    #grua-launch{box-sizing:border-box;margin:16px auto;max-width:min(1250px,calc(100% - 32px));display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);isolation:isolate;overflow:hidden;border:1px solid #397a9b;border-radius:18px;background:linear-gradient(125deg,#112e4d,#081b31);color:#f3f8ff}
    #grua-launch .grua-copy{padding:clamp(22px,3vw,42px);align-self:center}
    #grua-launch p{margin:0 0 14px;color:#dbeaf6;font-size:1rem;line-height:1.55}
    #grua-launch .grua-role{margin-bottom:7px;color:#80f3dc;font-weight:750;font-size:.88rem}
    #grua-launch h2{margin:0 0 10px;color:#fff;font-size:clamp(1.8rem,4vw,3rem);line-height:1.02;letter-spacing:-.035em}
    #grua-launch .grua-modes{font-size:.94rem}
    #grua-launch .grua-art{position:relative;min-height:270px;background:#12304b}
    #grua-launch .grua-cover{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;object-position:center}
    #grua-status:empty{display:none}
    #grua-launch #grua-status:not(:empty){margin:10px 0 0}
    #grua-launch button,#grua-dialog button{background:#80f3dc;color:#082820;border:0;border-radius:7px;padding:9px 12px;font:700 14px system-ui;cursor:pointer}
    #grua-launch #grua-start{min-height:44px;padding:10px 18px;font-size:1rem}
    #grua-launch #grua-start:hover{background:#b1fae9}
    #grua-launch #grua-start:focus-visible{outline:3px solid #ffd781;outline-offset:4px}
    @media(max-width:680px){#grua-launch{grid-template-columns:minmax(0,1fr)}#grua-launch .grua-art{grid-row:1;aspect-ratio:2/1;min-height:0}}
    #grua-dialog{margin:0;padding:0;border:0;width:100%;max-width:none;height:100%;max-height:none;background:#07121e;color:#f3f8ff}
    #grua-dialog[open]{display:flex;flex-direction:column}
    #grua-dialog header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 12px;background:#12304b}
    #grua-sync{flex:1;font-size:.85rem;min-width:8ch}
    #grua-dialog iframe{width:100%;flex:1;min-height:0;border:0}
    body:has(#grua-dialog[open]){overflow:hidden}
  `;
  document.head.append(style);

  const frame = dialog.querySelector("iframe");
  const sync = document.getElementById("grua-sync");
  const retry = document.getElementById("grua-retry");
  const startButton = document.getElementById("grua-start");
  const status = document.getElementById("grua-status");
  const full = document.getElementById("grua-full");
  const pending = [];
  let flush = null;
  let current = null;
  let attemptNumber = 0;
  let participant;

  function sendPending() {
    if (flush) return flush;
    if (!pending.length) return Promise.resolve(true);
    retry.hidden = true;
    sync.textContent = "Guardando participación…";
    flush = (async () => {
      while (pending.length) {
        const response = await fetch(IPG_TRACE_URL + "/rest/v1/participaciones", {
          method: "POST",
          headers: {
            "Content-Type": "application/json", apikey: IPG_TRACE_ANON,
            Authorization: "Bearer " + (ipgAccessToken() || IPG_TRACE_ANON),
            Prefer: "return=minimal"
          },
          body: JSON.stringify(pending[0]),
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error("Registro rechazado: " + response.status);
        pending.shift();
      }
      sync.textContent = "Participación registrada";
      return true;
    })().catch(() => {
      sync.textContent = "Registro pendiente. Reintenta antes de salir.";
      retry.hidden = false;
      return false;
    }).finally(() => { flush = null; });
    return flush;
  }

  window.addEventListener("message", event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow
      || !dialog.open || !accessConfirmed() || event.data?.type !== "portsim-grua") return;
    const { id, mission, mode, progress, seconds, score } = event.data;
    if (typeof id !== "string" || typeof mission !== "string" || mission.length > 100
      || !["guiado", "desafio"].includes(mode) || !Number.isInteger(progress)
      || progress < 0 || progress > 100 || !Number.isInteger(seconds) || seconds < 0
      || (score !== null && (!Number.isInteger(score) || score < 0 || score > 100 || progress !== 100))) return;
    if (current?.id !== id) {
      current = { id, progress: -1, finished: false };
      attemptNumber += 1;
    }
    if (current.finished || (score === null && current.progress === progress)) return;
    const evento = score !== null ? "finalizacion" : current.progress === -1 ? "inicio" : "avance";
    current.progress = progress;
    current.finished = score !== null;
    pending.push({
      ...participant, session_id: id, evento, simulador: "IPG PORTSIM · Grúa y Patio 3D",
      actividad: mission + " · " + (mode === "guiado" ? "Modo guiado" : "Modo desafío"),
      estado: evento === "finalizacion" ? "Finalizado" : evento === "inicio" ? "Iniciado" : "En progreso",
      avance: progress, puntaje: score, intentos: attemptNumber, tiempo_segundos: seconds
    });
    void sendPending();
  });

  startButton.addEventListener("click", () => {
    if (!accessConfirmed() || !field("studentId")) {
      status.textContent = "Completa el ingreso institucional para abrir la práctica.";
      return;
    }
    participant = {
      nombre: field("student"), rut_id: field("studentId"), carrera: field("career"),
      email_institucional: window.IPG_INSTITUTIONAL_EMAIL,
      seccion: field("section"), docente: field("teacher")
    };
    current = null;
    status.textContent = "";
    sync.textContent = "";
    full.hidden = !dialog.requestFullscreen;
    frame.src = "grua-y-patio.html?v=2";
    dialog.showModal();
    void sendPending();
  });
  full.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === dialog) await document.exitFullscreen();
      else await dialog.requestFullscreen();
    } catch {
      full.textContent = "Vista ampliada";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    full.textContent = document.fullscreenElement === dialog ? "Salir de pantalla completa" : "Pantalla completa";
  });
  retry.addEventListener("click", sendPending);
  async function closeCabin() {
    if (current && !current.finished && !confirm("Esta misión sigue en curso. ¿Quieres salir y conservar el avance registrado?")) return;
    const saved = await sendPending();
    if (!saved && !confirm("Hay registros pendientes de sincronización. ¿Quieres volver al módulo de todos modos?")) return;
    if (document.fullscreenElement === dialog) await document.exitFullscreen();
    dialog.close();
    frame.removeAttribute("src");
    status.textContent = !saved ? "Registro pendiente. Abre la cabina para volver a intentar el envío."
      : current?.finished ? "Misión finalizada. El resultado se registró en el CSD." : "";
    startButton.focus();
  }
  document.getElementById("grua-back").addEventListener("click", closeCabin);
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    void closeCabin();
  });
})();
