document.addEventListener("DOMContentLoaded", () => {
  if (!window.speechSynthesis) return;

  // --- Build UI ---
  const bar = document.createElement("div");
  bar.id = "tts-bar";
  bar.innerHTML = `
    <button id="tts-play"  title="Read aloud">▶ Read</button>
    <button id="tts-pause" title="Pause" style="display:none">⏸ Pause</button>
    <button id="tts-resume"title="Resume"style="display:none">▶ Resume</button>
    <button id="tts-stop"  title="Stop"  style="display:none">⏹ Stop</button>
    <span id="tts-status"></span>
  `;
  document.body.appendChild(bar);

  const btnPlay   = document.getElementById("tts-play");
  const btnPause  = document.getElementById("tts-pause");
  const btnResume = document.getElementById("tts-resume");
  const btnStop   = document.getElementById("tts-stop");
  const status    = document.getElementById("tts-status");

  // --- Section-based reading ---
  function getSections() {
    const article = document.querySelector("article.md-content__inner") ||
                    document.querySelector(".md-content__inner") ||
                    document.querySelector("main");
    if (!article) return [];

    const sections = [];
    let currentHeading = null;
    let currentNodes = [];

    function flush() {
      const clone = document.createElement("div");
      currentNodes.forEach(n => clone.appendChild(n.cloneNode(true)));
      clone.querySelectorAll("pre, code, .mermaid, svg, [aria-hidden]").forEach(el => el.remove());
      const text = clone.innerText.replace(/\s+/g, " ").trim();
      if (text) sections.push({ heading: currentHeading, text });
    }

    for (const child of article.children) {
      if (/^H[1-6]$/.test(child.tagName)) {
        flush();
        currentHeading = child;
        currentNodes = [child];
      } else {
        currentNodes.push(child);
      }
    }
    flush();
    return sections;
  }

  let sections = [];
  let currentIdx = -1;
  let isPlaying = false;

  function highlight(idx) {
    document.querySelectorAll(".tts-active-section").forEach(el => {
      el.classList.remove("tts-active-section");
    });
    if (idx < 0 || idx >= sections.length) return;
    const h = sections[idx].heading;
    if (h) {
      h.classList.add("tts-active-section");
      h.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function speakFrom(idx) {
    if (idx >= sections.length) { stop(); return; }
    currentIdx = idx;
    isPlaying = true;
    highlight(idx);
    status.textContent = `Section ${idx + 1}/${sections.length}`;

    const utt = new SpeechSynthesisUtterance(sections[idx].text);
    utt.rate = 0.95;
    utt.onend   = () => { if (isPlaying) speakFrom(idx + 1); };
    utt.onerror = () => stop();
    window.speechSynthesis.speak(utt);
  }

  function show(...btns) {
    [btnPlay, btnPause, btnResume, btnStop].forEach(b => b.style.display = "none");
    btns.forEach(b => b.style.display = "inline-block");
  }

  function stop() {
    isPlaying = false;
    window.speechSynthesis.cancel();
    highlight(-1);
    currentIdx = -1;
    show(btnPlay);
    status.textContent = "";
  }

  function initSections() {
    if (!sections.length) sections = getSections();
  }

  // --- Heading click-to-play ---
  function attachHeadingClicks() {
    const article = document.querySelector("article.md-content__inner") ||
                    document.querySelector(".md-content__inner") ||
                    document.querySelector("main");
    if (!article) return;

    article.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(h => {
      // Add play icon hint
      if (!h.querySelector(".tts-play-hint")) {
        const hint = document.createElement("span");
        hint.className = "tts-play-hint";
        hint.title = "Click to read from here";
        hint.textContent = " ▶";
        h.appendChild(hint);
      }

      h.addEventListener("click", e => {
        // Don't intercept anchor link clicks (the permalink ¶ icon)
        if (e.target.closest("a")) return;

        initSections();
        const idx = sections.findIndex(s => s.heading === h);
        if (idx === -1) return;

        window.speechSynthesis.cancel();
        isPlaying = false;
        show(btnPause, btnStop);
        speakFrom(idx);
      });
    });
  }

  attachHeadingClicks();

  btnPlay.addEventListener("click", () => {
    initSections();
    if (!sections.length) return;
    window.speechSynthesis.cancel();
    isPlaying = false;
    show(btnPause, btnStop);
    speakFrom(0);
  });

  btnPause.addEventListener("click", () => {
    window.speechSynthesis.pause();
    isPlaying = false;
    show(btnResume, btnStop);
    status.textContent = "Paused";
  });

  btnResume.addEventListener("click", () => {
    window.speechSynthesis.resume();
    isPlaying = true;
    show(btnPause, btnStop);
    status.textContent = `Section ${currentIdx + 1}/${sections.length}`;
  });

  btnStop.addEventListener("click", stop);

  // Stop when navigating away (MkDocs SPA navigation)
  document.addEventListener("click", e => {
    if (e.target.closest("a") && !e.target.closest("article")) stop();
  });
});
