(function () {
  "use strict";
  /**
   * Loop Embed Widget — herhangi bir siteye <script> ile gömülür.
   * Kullanım:
   *   <div id="loop-board"></div>
   *   <script src="https://your-loop.app/loop-widget.js"
   *           data-key="loop_pk_..."
   *           data-host="https://your-loop.app"
   *           data-target="#loop-board"
   *           data-theme="light"
   *           data-locale="tr"></script>
   */
  var script = document.currentScript;
  if (!script) return;
  var KEY = script.getAttribute("data-key");
  var HOST = (script.getAttribute("data-host") || new URL(script.src).origin).replace(/\/$/, "");
  var TARGET = script.getAttribute("data-target") || "#loop-board";
  var THEME = script.getAttribute("data-theme") || "light";
  var LOCALE = script.getAttribute("data-locale") || "tr";

  if (!KEY) {
    console.error("[loop] data-key gerekli");
    return;
  }

  var STR =
    LOCALE === "en"
      ? {
          title: "Feedback",
          placeholder: "Suggest something…",
          submit: "Post",
          empty: "No feedback yet. Be the first.",
          planned: "Planned",
          progress: "In progress",
          done: "Done",
          posting: "Posting…",
          error: "Something went wrong.",
        }
      : {
          title: "Geri bildirim",
          placeholder: "Bir fikrini yaz…",
          submit: "Paylaş",
          empty: "Henüz fikir yok. İlk sen ekle.",
          planned: "Planlandı",
          progress: "Geliştiriliyor",
          done: "Tamamlandı",
          posting: "Gönderiliyor…",
          error: "Bir şeyler ters gitti.",
        };

  // Anonim kullanıcı için kararlı id
  var STORAGE = "loop_uid_v1";
  var uid = localStorage.getItem(STORAGE);
  if (!uid) {
    uid = "u_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(STORAGE, uid);
  }

  function api(path, opts) {
    opts = opts || {};
    return fetch(HOST + path, {
      method: opts.method || "GET",
      headers: Object.assign(
        {
          Authorization: "Bearer " + KEY,
          "Content-Type": "application/json",
          "X-Loop-External-User": uid,
        },
        opts.headers || {},
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      if (!r.ok)
        return r.json().then(function (j) {
          throw new Error((j.error && j.error.message) || r.statusText);
        });
      return r.json();
    });
  }

  function mount() {
    var root = document.querySelector(TARGET);
    if (!root) return console.error("[loop] target bulunamadı:", TARGET);

    root.innerHTML =
      "" +
      '<div class="loop-widget loop-theme-' +
      THEME +
      '">' +
      "  <style>" +
      CSS +
      "</style>" +
      "  <header><h3>" +
      STR.title +
      "</h3></header>" +
      '  <form class="loop-form">' +
      '    <input type="text" maxlength="140" placeholder="' +
      STR.placeholder +
      '" required minlength="3" />' +
      '    <button type="submit">' +
      STR.submit +
      "</button>" +
      "  </form>" +
      '  <ul class="loop-list" aria-live="polite"></ul>' +
      "</div>";

    var listEl = root.querySelector(".loop-list");
    var formEl = root.querySelector(".loop-form");
    var inputEl = formEl.querySelector("input");
    var btnEl = formEl.querySelector("button");
    var votedSet = new Set();

    function render(posts) {
      if (!posts.length) {
        listEl.innerHTML = '<li class="loop-empty">' + STR.empty + "</li>";
        return;
      }
      listEl.innerHTML = posts
        .map(function (p) {
          var statusLabel = STR[p.status] || p.status;
          var voted = votedSet.has(p.id);
          return (
            "" +
            '<li class="loop-item" data-id="' +
            p.id +
            '">' +
            '  <button class="loop-vote ' +
            (voted ? "is-voted" : "") +
            '" aria-label="Oy">' +
            '    <svg viewBox="0 0 24 24"><path d="M12 4l8 10H4z" fill="currentColor"/></svg>' +
            "    <span>" +
            p.votes_count +
            "</span>" +
            "  </button>" +
            '  <div class="loop-body">' +
            '    <p class="loop-title">' +
            escapeHtml(p.title) +
            "</p>" +
            '    <span class="loop-status loop-status-' +
            p.status +
            '">' +
            statusLabel +
            "</span>" +
            "  </div>" +
            "</li>"
          );
        })
        .join("");

      listEl.querySelectorAll(".loop-vote").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.closest(".loop-item").dataset.id;
          api("/api/v1/posts/" + id + "/vote", { method: "POST", body: { external_user_id: uid } })
            .then(function (r) {
              if (r.voted) votedSet.add(id);
              else votedSet.delete(id);
              refresh();
            })
            .catch(function (e) {
              console.error("[loop] vote", e);
            });
        });
      });
    }

    function refresh() {
      return api("/api/v1/posts?limit=20")
        .then(function (r) {
          render(r.data || []);
        })
        .catch(function (e) {
          listEl.innerHTML = '<li class="loop-empty loop-error">' + escapeHtml(e.message) + "</li>";
        });
    }

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      var title = inputEl.value.trim();
      if (title.length < 3) return;
      btnEl.disabled = true;
      btnEl.textContent = STR.posting;
      api("/api/v1/posts", {
        method: "POST",
        body: { title: title, source: "embed", external_user_id: uid },
      })
        .then(function () {
          inputEl.value = "";
          return refresh();
        })
        .catch(function (e) {
          alert(STR.error + " " + e.message);
        })
        .finally(function () {
          btnEl.disabled = false;
          btnEl.textContent = STR.submit;
        });
    });

    refresh();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var CSS =
    "" +
    ".loop-widget{font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a}" +
    ".loop-widget *{box-sizing:border-box}" +
    ".loop-widget header h3{font-size:18px;font-weight:600;margin:0 0 12px;letter-spacing:-0.01em}" +
    ".loop-form{display:flex;gap:6px;margin-bottom:16px}" +
    ".loop-form input{flex:1;padding:10px 14px;border-radius:12px;border:1px solid #e2e2e2;font-size:14px;outline:none;background:#fff}" +
    ".loop-form input:focus{border-color:#1a1a1a}" +
    ".loop-form button{padding:10px 18px;border-radius:12px;background:#1a1a1a;color:#fff;border:none;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap}" +
    ".loop-form button:disabled{opacity:0.5}" +
    ".loop-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}" +
    ".loop-item{display:flex;gap:12px;padding:12px;border:1px solid #ececec;border-radius:14px;background:#fafafa;transition:border-color 0.15s}" +
    ".loop-item:hover{border-color:#d4d4d4}" +
    ".loop-vote{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:48px;padding:6px 10px;border:none;background:#fff;border-radius:10px;cursor:pointer;color:#1a1a1a;font-weight:600;font-size:13px}" +
    ".loop-vote svg{width:12px;height:12px}" +
    ".loop-vote.is-voted{background:#1a1a1a;color:#fff}" +
    ".loop-body{flex:1;min-width:0}" +
    ".loop-title{margin:0;font-size:14px;line-height:1.4;font-weight:500}" +
    ".loop-status{display:inline-flex;align-items:center;gap:4px;margin-top:4px;font-size:11px;color:#666}" +
    '.loop-status:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}' +
    ".loop-status-planned{color:#a78bfa}.loop-status-progress{color:#f59e0b}.loop-status-done{color:#10b981}" +
    ".loop-empty{text-align:center;padding:24px;color:#999;font-size:13px;background:#fafafa;border-radius:14px;list-style:none}" +
    ".loop-error{color:#dc2626}" +
    ".loop-theme-dark{color:#fafafa}" +
    ".loop-theme-dark .loop-form input{background:#1a1a1a;border-color:#333;color:#fafafa}" +
    ".loop-theme-dark .loop-form button{background:#fafafa;color:#1a1a1a}" +
    ".loop-theme-dark .loop-item{background:#1a1a1a;border-color:#2a2a2a}" +
    ".loop-theme-dark .loop-vote{background:#0a0a0a;color:#fafafa}" +
    ".loop-theme-dark .loop-empty{background:#1a1a1a;color:#666}";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
