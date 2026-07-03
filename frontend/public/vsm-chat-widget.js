(function () {
  const cfg = window.VSM_CHAT || {};
  const apiUrl = (cfg.apiUrl || "").replace(/\/$/, "");
  if (!apiUrl) {
    console.warn("[VSM Chat] window.VSM_CHAT.apiUrl manquant");
    return;
  }

  const sessionKey = "vsm_chat_session";
  let sessionId = localStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(sessionKey, sessionId);
  }

  const brand = cfg.brand || "VSM Collection";
  let welcome = "Bonjour ! Comment puis-je t'aider ?";
  let open = false;
  let loading = false;
  const messages = [];

  const style = document.createElement("style");
  style.textContent = `
    #vsm-chat-btn{position:fixed;bottom:20px;right:20px;z-index:99998;width:56px;height:56px;border-radius:50%;background:#c41e3a;color:#fff;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.35);font-size:22px}
    #vsm-chat-panel{position:fixed;bottom:88px;right:20px;z-index:99999;width:min(360px,calc(100vw - 40px));height:480px;background:#0a0a0a;border:1px solid #333;display:none;flex-direction:column;font-family:system-ui,sans-serif;color:#f5f0e8}
    #vsm-chat-panel.open{display:flex}
    #vsm-chat-header{padding:12px 14px;background:#111;border-bottom:1px solid #c41e3a;font-weight:600;font-size:14px}
    #vsm-chat-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
    .vsm-msg{max-width:85%;padding:8px 12px;font-size:13px;line-height:1.45;word-break:break-word}
    .vsm-msg.user{align-self:flex-end;background:#c41e3a;color:#fff}
    .vsm-msg.bot{align-self:flex-start;background:#1a1a1a;border:1px solid #333}
    #vsm-chat-form{display:flex;border-top:1px solid #333}
    #vsm-chat-input{flex:1;background:#111;border:none;color:#fff;padding:10px 12px;font-size:13px;outline:none}
    #vsm-chat-send{background:#c41e3a;color:#fff;border:none;padding:0 16px;cursor:pointer;font-size:13px}
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.id = "vsm-chat-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Ouvrir le chat");
  btn.innerHTML = "💬";

  const panel = document.createElement("div");
  panel.id = "vsm-chat-panel";
  panel.innerHTML = `
    <div id="vsm-chat-header">${brand}</div>
    <div id="vsm-chat-msgs"></div>
    <form id="vsm-chat-form">
      <input id="vsm-chat-input" type="text" placeholder="Écris ton message…" autocomplete="off" />
      <button id="vsm-chat-send" type="submit">→</button>
    </form>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  const msgsEl = panel.querySelector("#vsm-chat-msgs");
  const form = panel.querySelector("#vsm-chat-form");
  const input = panel.querySelector("#vsm-chat-input");

  function render() {
    msgsEl.innerHTML = messages.map((m) =>
      `<div class="vsm-msg ${m.role}">${escapeHtml(m.content)}</div>`
    ).join("");
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function addMsg(role, content) {
    messages.push({ role, content });
    render();
  }

  fetch(apiUrl + "/api/webchat/config")
    .then((r) => r.json())
    .then((d) => { if (d.welcome) welcome = d.welcome; })
    .catch(() => {});

  btn.addEventListener("click", () => {
    open = !open;
    panel.classList.toggle("open", open);
    if (open && messages.length === 0) {
      addMsg("bot", welcome);
    }
    if (open) input.focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || loading) return;
    input.value = "";
    addMsg("user", text);
    loading = true;
    try {
      const r = await fetch(apiUrl + "/api/webchat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erreur");
      addMsg("bot", data.reply || "…");
    } catch (err) {
      addMsg("bot", "Désolé, je ne suis pas disponible pour le moment.");
      console.error("[VSM Chat]", err);
    } finally {
      loading = false;
    }
  });
})();
