(() => {
  "use strict";

  // 01. Article catalogue and local preferences
  const articles = [
    { id: "about", n: "01", title: "설립의 말", sub: "문학의 바깥을 읽는 이유", type: "창립 문서" },
    { id: "editorial", n: "02", title: "편집 철학", sub: "우리가 좋아하는 소설에 대하여", type: "창립 문서" },
    { id: "ethics", n: "03", title: "창작 윤리", sub: "남긴 문장에 대한 책임", type: "창립 문서" },
    { id: "members", n: "04", title: "잔문 동인", sub: "서로의 가장 이른 독자로", type: "창립 문서" }
  ];
  const pages = ["home", ...articles.map(article => article.id), "books", "submission", "archive", "saved"];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem("janmun:" + key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem("janmun:" + key, JSON.stringify(value));
    } catch {
      // Reading tools still work for this session when storage is unavailable.
    }
  }

  const validIds = new Set(articles.map(article => article.id));
  function readIds(key) {
    const value = read(key, []);
    return Array.isArray(value) ? [...new Set(value.filter(id => validIds.has(id)))] : [];
  }

  const state = {
    saved: readIds("saved"),
    finished: readIds("finished"),
    last: read("last", null),
    theme: read("theme", "light") === "dark" ? "dark" : "light",
    size: Number(read("size", 18)),
    focus: false,
    page: "home"
  };
  state.size = Number.isFinite(state.size) ? Math.min(25, Math.max(15, state.size)) : 18;

  const nav = $(".nav");
  const mobile = $("#mobile");
  const dialog = $("#search-dialog");
  const toast = $("#toast");
  let toastTimer;

  function notify(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  // 02. Appearance and page navigation
  function applyTheme() {
    const dark = state.theme === "dark";
    document.documentElement.dataset.theme = state.theme;
    $("#theme").setAttribute("aria-pressed", String(dark));
    $("#theme").title = dark ? "밝은 화면" : "어두운 화면";
    $("#theme").setAttribute("aria-label", dark ? "밝은 화면으로 전환" : "어두운 화면으로 전환");
    const themeMeta = $('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = dark ? "#20221f" : "#f5f2eb";
    write("theme", state.theme);
  }

  function applySize() {
    document.documentElement.style.setProperty("--reading", state.size + "px");
    write("size", state.size);
  }

  function closeNav() {
    nav.classList.remove("open");
    mobile.setAttribute("aria-expanded", "false");
    mobile.setAttribute("aria-label", "메뉴 열기");
  }

  function setFocus(on, restoreFocus = true) {
    state.focus = on;
    document.body.classList.toggle("focus-mode", on);
    if (on) {
      $("#focus-exit").focus({ preventScroll: true });
    } else if (restoreFocus && document.activeElement === $("#focus-exit")) {
      $(".view:not([hidden]) [data-focus]")?.focus({ preventScroll: true });
    }
    updateProgress();
  }

  function route() {
    const requested = location.hash.slice(1) || "home";
    const id = pages.includes(requested) ? requested : "home";
    const changed = state.page !== id;
    setFocus(false, false);
    state.page = id;

    if (validIds.has(id)) {
      state.last = id;
      write("last", id);
    }

    $$(".view").forEach(view => { view.hidden = view.id !== "page-" + id; });
    $$(".nav a").forEach(link => {
      if (link.getAttribute("href") === "#" + id) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    const title = $("#page-" + id + " h1")?.textContent.trim();
    document.title = id === "home"
      ? "잔문 殘文 — 독립 문학 편집실"
      : (title || "잔문") + " | 잔문 殘文";

    closeNav();
    if (dialog.open) dialog.close();
    updateReading();
    if (id === "archive" || id === "saved") renderLists();
    if (changed) $("#main").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
    updateProgress();
  }

  function updateProgress() {
    const available = document.documentElement.scrollHeight - window.innerHeight;
    const fraction = available > 0 ? Math.max(0, Math.min(1, window.scrollY / available)) : 0;
    $(".progress").style.width = fraction * 100 + "%";
  }

  // 03. Reading time, bookmarks and completed articles
  function articleBody(article) {
    return $("#page-" + article.id + " .prose")?.textContent || "";
  }

  function timeFor(article) {
    const length = articleBody(article).replace(/\s/g, "").length;
    return Math.max(1, Math.ceil(length / 350)) + "분 읽기 (예상)";
  }

  function updateReading() {
    articles.forEach(article => {
      const done = state.finished.includes(article.id);
      const time = timeFor(article);
      const meta = $("[data-entry-meta=" + article.id + "]");
      if (meta) meta.textContent = time + (done ? " · 읽음" : "");
      $("[data-reading-time=" + article.id + "]").textContent = time;
      $("[data-reading-status=" + article.id + "]").textContent = done ? "읽음" : "아직 읽지 않은 글";

      const button = $("[data-read=" + article.id + "]");
      button.textContent = done ? "✓ 읽음 · 취소" : "읽음 표시";
      button.setAttribute("aria-pressed", String(done));
    });

    const last = articles.find(article => article.id === state.last);
    $("#resume").hidden = !last;
    if (last) {
      $("#resume-link").href = "#" + last.id;
      $("#resume-link").textContent = last.title + " →";
    }
  }

  function updateSaves() {
    $$("[data-save]").forEach(button => {
      const saved = state.saved.includes(button.dataset.save);
      button.textContent = saved ? "★ 저장됨" : "☆ 읽기 목록에 저장";
      button.setAttribute("aria-pressed", String(saved));
    });
    $("#save-count").textContent = state.saved.length;
  }

  function toggleSave(id) {
    if (!validIds.has(id)) return;
    const removing = state.saved.includes(id);
    state.saved = removing ? state.saved.filter(item => item !== id) : [...state.saved, id];
    write("saved", state.saved);
    renderLists();
    notify(removing ? "읽기 목록에서 삭제했어요." : "읽기 목록에 저장했어요.");
  }

  function toggleRead(id) {
    if (!validIds.has(id)) return;
    const removing = state.finished.includes(id);
    state.finished = removing ? state.finished.filter(item => item !== id) : [...state.finished, id];
    write("finished", state.finished);
    updateReading();
    renderLists();
    notify(removing ? "읽음 표시를 취소했어요." : "읽은 글로 기록했어요.");
  }

  // 04. Search and archive
  function matches(article, query) {
    const haystack = [article.title, article.sub, article.type, articleBody(article)].join(" ");
    return haystack.toLowerCase().includes(query.toLowerCase().trim());
  }

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function makeRow(article) {
    const row = element("div", "archive-row");
    const number = element("span", "eyebrow", article.n);
    const link = element("a");
    link.href = "#" + article.id;
    link.append(
      element("h3", "", article.title),
      element("p", "", article.sub + " · " + timeFor(article) +
        (state.finished.includes(article.id) ? " · 읽음" : ""))
    );
    const button = element("button", "outline");
    button.type = "button";
    button.dataset.save = article.id;
    row.append(number, link, button);
    return row;
  }

  function fillList(target, items, emptyText) {
    target.replaceChildren(...items.map(makeRow));
    if (!items.length) target.append(element("p", "empty", emptyText));
  }

  function renderLists() {
    const query = $("#archive-query").value;
    const filter = $("#archive-filter").value;
    const list = articles.filter(article => {
      if (!matches(article, query)) return false;
      if (filter === "saved") return state.saved.includes(article.id);
      if (filter === "read") return state.finished.includes(article.id);
      if (filter === "unread") return !state.finished.includes(article.id);
      return true;
    });
    $("#archive-count").textContent = list.length + "편 · 전체 " + articles.length + "편";
    fillList($("#archive-list"), list, "조건에 맞는 글이 없습니다.");
    fillList($("#saved-list"), articles.filter(article => state.saved.includes(article.id)),
      "아직 저장한 글이 없습니다. 아카이브에서 읽고 싶은 글을 저장해 보세요.");
    updateSaves();
  }

  function search() {
    const query = $("#search-query").value.trim();
    const target = $("#search-results");
    const results = articles.filter(article => matches(article, query));
    target.replaceChildren();

    for (const article of results) {
      const link = element("a", "", article.title + " — " + article.sub);
      link.href = "#" + article.id;
      const body = articleBody(article).replace(/\s+/g, " ").trim();
      const matchIndex = query ? body.toLowerCase().indexOf(query.toLowerCase()) : 0;
      const start = Math.max(0, matchIndex - 20);
      const excerpt = (start ? "…" : "") + body.slice(start, start + 85)
        + (body.length > start + 85 ? "…" : "");
      link.append(element("small", "", excerpt));
      target.append(link);
    }
    if (!results.length) target.textContent = "검색 결과가 없습니다.";
  }

  function openSearch() {
    if (dialog.open) return;
    dialog.showModal();
    $("#search-query").focus();
    search();
  }

  async function share(id) {
    const url = new URL(location.href);
    url.hash = id;
    try {
      await navigator.clipboard.writeText(url.href);
      notify("링크를 복사했어요.");
    } catch {
      window.prompt("이 링크를 복사하세요.", url.href);
    }
  }

  // 05. Draft preparation — no network submission
  function downloadDraft(form) {
    const data = new FormData(form);
    const content = [
      "잔문 투고 준비용 초안 (미접수)",
      "필명: " + data.get("name"),
      "작품명: " + data.get("title"),
      "분야: " + data.get("genre"),
      "AI 활용 방식: " + data.get("ai"),
      "작품 소개: " + data.get("intro")
    ].join("\n\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = element("a");
    link.href = url;
    link.download = "janmun-submission-draft.txt";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("준비용 초안을 내려받았습니다. 접수된 것은 아닙니다.");
  }

  // 06. Event bindings
  $("#theme").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
  });

  mobile.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    mobile.setAttribute("aria-expanded", String(open));
    mobile.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  });

  nav.addEventListener("click", event => {
    if (event.target.closest("a")) closeNav();
  });
  $("#search-open").addEventListener("click", openSearch);
  $("#search-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  $("#search-query").addEventListener("input", search);
  $("#search-results").addEventListener("click", event => {
    if (event.target.closest("a")) dialog.close();
  });
  $("#archive-query").addEventListener("input", renderLists);
  $("#archive-filter").addEventListener("change", renderLists);
  $("#focus-exit").addEventListener("click", () => setFocus(false));
  $("#resume-clear").addEventListener("click", () => {
    state.last = null;
    write("last", null);
    updateReading();
  });

  $(".skip").addEventListener("click", event => {
    event.preventDefault();
    $("#main").focus();
    $("#main").scrollIntoView();
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".mast") && nav.classList.contains("open")) closeNav();
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.save) toggleSave(button.dataset.save);
    if (button.dataset.share) share(button.dataset.share);
    if (button.dataset.read) toggleRead(button.dataset.read);
    if (button.hasAttribute("data-focus")) setFocus(true);
    if (button.hasAttribute("data-print")) window.print();
    if (button.dataset.size) {
      state.size = Math.min(25, Math.max(15, state.size + Number(button.dataset.size)));
      applySize();
      notify("읽기 글자 크기 " + state.size + "px");
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeNav();
      if (state.focus && !dialog.open) setFocus(false);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
  });

  $("#draft-form").addEventListener("submit", event => {
    event.preventDefault();
    downloadDraft(event.currentTarget);
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);

  // 07. Initialization
  applyTheme();
  applySize();
  renderLists();
  route();
})();
