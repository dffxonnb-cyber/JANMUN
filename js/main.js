(() => {
  "use strict";

  // 01. Article catalogue and local preferences
  const articles = [
    { id: "about", n: "01", title: "설립의 말", sub: "문학의 바깥을 읽는 이유", type: "창립 문서" },
    { id: "editorial", n: "02", title: "편집 철학", sub: "무엇을 남길 것인가.", type: "창립 문서" },
    { id: "ethics", n: "03", title: "창작 윤리", sub: "완벽함이 아니라 정직함.", type: "창립 문서" },
    { id: "members", n: "04", title: "잔문 동인", sub: "서로의 가장 이른 독자로", type: "창립 문서" }
  ];
  const pages = ["home", ...articles.map(article => article.id), "books", "submission", "archive", "saved", "news", "journal"];

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
    $$(".nav a, .mobile-dock a").forEach(link => {
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
    if ($("#quote-dialog").open) $("#quote-dialog").close();
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
    renderLibrary();
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

  // 07. Private reading records and portable text exports
  const storedQuotes = read("quotes", []);
  const quotes = Array.isArray(storedQuotes) ? storedQuotes.filter(q =>
    q && validIds.has(q.article) && typeof q.text === "string" && typeof q.id === "string") : [];
  const storedNotes = read("notes", {});
  const notes = Object.create(null);
  for (const article of articles) {
    if (typeof storedNotes?.[article.id] === "string" && storedNotes[article.id].trim()) {
      notes[article.id] = storedNotes[article.id];
    }
  }
  const quoteDialog = $("#quote-dialog");
  let pendingSelection = null;

  function libraryTab(name) {
    $$("[data-library-tab]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.libraryTab === name));
    });
    $$(".library-panel").forEach(panel => { panel.hidden = panel.id !== "library-" + name; });
  }

  function recordButton(label, key, value) {
    const button = element("button", "outline", label);
    button.type = "button";
    button.dataset[key] = value;
    return button;
  }

  function renderLibrary() {
    $("#finished-count").textContent = state.finished.length;
    $("#quote-count").textContent = quotes.length;
    $("#note-count").textContent = Object.keys(notes).length;

    const quoteList = $("#quote-list");
    quoteList.replaceChildren();
    for (const quote of [...quotes].reverse()) {
      const article = articles.find(a => a.id === quote.article);
      const item = element("div", "record-item");
      const meta = element("span", "eyebrow");
      const source = element("a", "", article.title);
      source.href = "#" + article.id;
      meta.append(source);
      const actions = element("div", "actions");
      actions.append(recordButton("문장 복사", "quoteCopy", quote.id),
        recordButton("삭제", "quoteRemove", quote.id));
      item.append(meta, element("blockquote", "", quote.text), actions);
      quoteList.append(item);
    }
    if (!quotes.length) quoteList.append(element("p", "empty", "아직 수집한 문장이 없습니다. 글의 문장 수집 버튼으로 시작하세요."));

    const noteList = $("#note-list");
    noteList.replaceChildren();
    for (const article of articles) {
      if (!notes[article.id]) continue;
      const item = element("div", "record-item");
      const source = element("a", "eyebrow", article.title + " ↗");
      source.href = "#" + article.id;
      const actions = element("div", "actions");
      actions.append(recordButton("메모 수정", "noteEdit", article.id),
        recordButton("삭제", "noteRemove", article.id));
      item.append(source, element("p", "record-text", notes[article.id]), actions);
      noteList.append(item);
    }
    if (!Object.keys(notes).length) noteList.append(element("p", "empty", "아직 독서 메모가 없습니다."));
    fillList($("#history-list"), articles.filter(a => state.finished.includes(a.id)), "읽음 표시한 글이 아직 없습니다.");
    updateSaves();
  }

  function addQuote(id, text) {
    text = text.trim();
    if (!text || !validIds.has(id)) return;
    if (quotes.some(q => q.article === id && q.text === text)) {
      notify("이미 수집한 문장입니다.");
      return;
    }
    quotes.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), article: id, text });
    write("quotes", quotes);
    renderLibrary();
    notify("나의 서재에 문장을 남겼어요.");
  }

  function selectedQuote() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || !validIds.has(state.page)) return null;
    const prose = $("#page-" + state.page + " .prose");
    const range = selection.getRangeAt(0);
    if (!prose.contains(range.startContainer) || !prose.contains(range.endContainer)) return null;
    const text = selection.toString().trim();
    return text ? { article: state.page, text } : null;
  }

  function openQuote(id) {
    const current = selectedQuote() || pendingSelection;
    pendingSelection = null;
    if (current?.article === id) {
      addQuote(id, current.text);
      return;
    }
    const options = $("#quote-options");
    options.replaceChildren();
    $$("#page-" + id + " .prose p").forEach(paragraph => {
      const button = element("button", "quote-option", paragraph.textContent.trim());
      button.type = "button";
      button.addEventListener("click", () => {
        addQuote(id, paragraph.textContent);
        quoteDialog.close();
      });
      options.append(button);
    });
    if (!quoteDialog.open) quoteDialog.showModal();
  }

  function openNote(id) {
    const editor = $("[data-note-editor=" + id + "]");
    const textarea = $("[data-note-text=" + id + "]");
    editor.hidden = false;
    textarea.value = notes[id] || "";
    textarea.focus();
  }

  function saveNote(id) {
    const value = $("[data-note-text=" + id + "]").value.trim();
    if (value) notes[id] = value;
    else delete notes[id];
    write("notes", notes);
    $("[data-note-editor=" + id + "]").hidden = true;
    renderLibrary();
    notify(value ? "독서 메모를 저장했어요." : "빈 메모는 저장하지 않았어요.");
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      notify("문장을 복사했어요.");
    } catch {
      window.prompt("문장을 복사하세요.", value);
    }
  }

  function exportLibrary() {
    const title = id => articles.find(a => a.id === id)?.title || id;
    const sections = [
      "잔문 — 나의 서재",
      "[보관한 글]\n" + state.saved.map(title).join("\n"),
      "[읽은 글]\n" + state.finished.map(title).join("\n"),
      "[수집한 문장]\n" + quotes.map(q => title(q.article) + "\n" + q.text).join("\n\n"),
      "[독서 메모]\n" + Object.keys(notes).map(id => title(id) + "\n" + notes[id]).join("\n\n")
    ];
    const url = URL.createObjectURL(new Blob([sections.join("\n\n")], { type: "text/plain;charset=utf-8" }));
    const link = element("a");
    link.href = url;
    link.download = "janmun-reading-library.txt";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("서재 기록을 파일로 내려받았어요.");
  }

  $("#quote-close").addEventListener("click", () => quoteDialog.close());
  quoteDialog.addEventListener("click", event => { if (event.target === quoteDialog) quoteDialog.close(); });
  $("#library-export").addEventListener("click", exportLibrary);
  document.addEventListener("selectionchange", () => {
    const selection = selectedQuote();
    if (selection) pendingSelection = selection;
  });
  window.addEventListener("hashchange", () => { pendingSelection = null; });
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const data = button.dataset;
    if (data.libraryTab) libraryTab(data.libraryTab);
    if (data.collect) openQuote(data.collect);
    if (data.noteOpen) openNote(data.noteOpen);
    if (data.noteClose) $("[data-note-editor=" + data.noteClose + "]").hidden = true;
    if (data.noteSave) saveNote(data.noteSave);
    if (data.noteEdit) {
      location.hash = data.noteEdit;
      setTimeout(() => openNote(data.noteEdit), 50);
    }
    if (data.noteRemove) {
      delete notes[data.noteRemove];
      write("notes", notes);
      renderLibrary();
      notify("메모를 삭제했어요.");
    }
    if (data.quoteCopy) {
      const quote = quotes.find(q => q.id === data.quoteCopy);
      if (quote) copyText(quote.text);
    }
    if (data.quoteRemove) {
      const index = quotes.findIndex(q => q.id === data.quoteRemove);
      if (index !== -1) {
        quotes.splice(index, 1);
        write("quotes", quotes);
        renderLibrary();
        notify("문장을 삭제했어요.");
      }
    }
  });

  // 08. Editorial quote rotation
  const frontQuotes = [
    { id: "editorial", text: "무엇을 남길 것인가." },
    { id: "about", text: "그렇게 만든 책이 누군가의 책장에 오래 남아 있기를 바란다." },
    { id: "ethics", text: "잔문이 창작자에게 바라는 것은 완벽함이 아니라 정직함이다." },
    { id: "members", text: "서로의 가장 이른 독자이자, 가장 늦게까지 남아 있는 독자로." }
  ];
  let frontQuoteIndex = 0;
  $("#next-quote").addEventListener("click", () => {
    frontQuoteIndex = (frontQuoteIndex + 1) % frontQuotes.length;
    const quote = frontQuotes[frontQuoteIndex];
    const article = articles.find(item => item.id === quote.id);
    $("#front-quote").textContent = quote.text;
    $("#front-quote-source").href = "#" + article.id;
    $("#front-quote-source").textContent = article.title;
  });

  // 09. Initialization
  applyTheme();
  applySize();
  renderLists();
  route();
})();
