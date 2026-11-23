// 「一念 · Scroll Dharma」核心交互逻辑
(function () {
  const DATA = window.DHARMA_DATA;
  const STORAGE_KEY = "scroll_dharma_demo_v1";

  const CHEVRON_RIGHT = `<svg class="chev-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
  const SUN_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2.5" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="21.5"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2.5" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="21.5" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>`;
  const MOON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  const defaultState = {
    activeTab: "feed",
    sutraMode: "xinjing",
    filterLikedOnly: false,
    currentVerseId: "xj-1",
    theme: "light",
    likedIds: [],
    bookmarkedIds: [],
    readIds: ["xj-1"],
    customComments: {},
    activePlanId: "plan-xinjing",
    mineSubTab: "liked",
    proUnlocked: false,
    proPreviewCount: 0,
    posterSkin: "paper",
    onboardDone: false
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultState };
      return { ...defaultState, ...JSON.parse(raw) };
    } catch (_) {
      return { ...defaultState };
    }
  }

  let state = loadState();
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  let autoScrollTimer = null;
  let autoScrollProgress = 0;
  let discoverQueue = [];
  let discoverIdx = 0;
  let studyVerseId = null;
  let studySubView = "menu";
  let commentVerseId = null;
  let selectedPaywallPlan = "yearly";
  let toastTimer = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function getVerseById(id) {
    return DATA.VERSES.find((v) => v.id === id) || DATA.VERSES[0];
  }

  function getCommentsForVerse(verse) {
    const extra = state.customComments[verse.id] || [];
    return [...extra, ...verse.comments];
  }

  function formatCount(n) {
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return String(n);
  }

  function shortChapter(v) {
    return v.chapter.split(" · ")[1] || v.chapter;
  }

  function showToast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function getFeedList() {
    let list;
    if (state.sutraMode === "xinjing") {
      list = DATA.VERSES.filter((v) => v.sutra === "xinjing");
    } else if (state.sutraMode === "jingang") {
      list = DATA.VERSES.filter((v) => v.sutra === "jingang");
    } else {
      const xj = DATA.VERSES.filter((v) => v.sutra === "xinjing");
      const jg = DATA.VERSES.filter((v) => v.sutra === "jingang");
      list = [];
      for (let i = 0; i < Math.max(xj.length, jg.length); i++) {
        if (xj[i]) list.push(xj[i]);
        if (jg[i]) list.push(jg[i]);
      }
    }

    if (state.filterLikedOnly) {
      const filtered = list.filter((v) => state.likedIds.includes(v.id));
      if (filtered.length > 0) return filtered;
    }
    return list;
  }

  // ==================== 桌面视口自适配缩放 ====================
  function updatePhoneScale() {
    const container = $("#phoneScaleContainer");
    if (!container) return;
    if (window.innerWidth <= 480) {
      container.style.transform = "none";
      return;
    }
    const maxH = window.innerHeight - 36;
    const maxW = window.innerWidth > 900 ? window.innerWidth - 320 : window.innerWidth - 32;
    const scaleH = maxH / 872;
    const scaleW = maxW / 413;
    const scale = Math.max(0.58, Math.min(1, scaleH, scaleW));
    container.style.transform = `scale(${scale.toFixed(3)})`;
  }

  // ==================== 主题切换 ====================
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    const btn = $("#btnThemeToggle");
    if (btn) btn.innerHTML = state.theme === "dark" ? MOON_SVG : SUN_SVG;
    const mineBtn = $("#btnMineToggleTheme");
    if (mineBtn) mineBtn.textContent = state.theme === "dark" ? "宣纸模式" : "静夜模式";
  }

  function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
    saveState();
    showToast(state.theme === "dark" ? "静夜" : "宣纸");
  }

  // ==================== Onboarding 引导 ====================
  function initOnboarding() {
    const overlay = $("#onboardingOverlay");
    if (state.onboardDone) {
      overlay.classList.add("hidden");
    } else {
      overlay.classList.remove("hidden");
      $("#onboardStep1").classList.add("active");
      $("#onboardStep2").classList.remove("active");
    }
  }

  function finishOnboarding(targetVerseId) {
    state.onboardDone = true;
    saveState();
    $("#onboardingOverlay").classList.add("hidden");
    if (targetVerseId) {
      const v = getVerseById(targetVerseId);
      state.sutraMode = v.sutra;
      state.filterLikedOnly = false;
      renderFeed();
      scrollToVerseId(targetVerseId, false);
    }
  }

  // ==================== TAB 1: 主经流渲染与观测 ====================
  let feedObserver = null;

  function renderFeed() {
    const scrollEl = $("#feedScroll");
    const rulerEl = $("#verseRuler");
    const list = getFeedList();

    scrollEl.innerHTML = list
      .map((v, idx) => {
        const isLong = v.text.length > 52;
        const swipeCue =
          idx === 0
            ? `<div class="swipe-cue" id="swipeCue" aria-hidden="true">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
               </div>`
            : "";

        return `
          <article class="verse-slide" data-id="${v.id}" data-idx="${idx}">
            <div class="verse-stage" data-open-study="${v.id}">
              <div class="enso-badge">
                <svg class="enso-bare" width="40" height="40" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                  <path d="M74 26C62 14 40 13 26 26C12 39 12 62 25 75C38 88 61 88 75 74C86 63 87 43 77 32" stroke="currentColor" stroke-width="4.6" stroke-linecap="round"/>
                </svg>
                <span class="enso-hint">轻触解经</span>
              </div>
              <p class="verse-text ${v.isRedLetter ? "red-letter" : ""} ${isLong ? "long-verse" : ""}">${v.text}</p>
              <div class="verse-citation">${v.sutraName} · ${shortChapter(v)}</div>
            </div>
            ${swipeCue}
          </article>
        `;
      })
      .join("");

    // 左侧节号标尺（仅首末显示数字，中间平时静默微点，当前节展开数字胶囊）
    rulerEl.innerHTML = list
      .map((v, idx) => {
        const label = String(idx + 1).padStart(2, "0");
        const isEdge = idx === 0 || idx === list.length - 1;
        return `<button class="ruler-tick" data-jump-idx="${idx}" data-label="${label}" data-edge="${isEdge}" type="button" aria-label="${v.sutraName} 第${idx + 1}句">${isEdge ? label : '<span class="ruler-dot"></span>'}</button>`;
      })
      .join("");

    rulerEl.querySelectorAll(".ruler-tick").forEach((btn) => {
      btn.addEventListener("click", () => {
        scrollToVerseIndex(Number(btn.dataset.jumpIdx), true);
      });
    });

    scrollEl.querySelectorAll("[data-open-study]").forEach((stage) => {
      stage.addEventListener("click", () => {
        openStudySheet(stage.dataset.openStudy, "menu");
      });
    });

    if (feedObserver) feedObserver.disconnect();
    feedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            const vid = entry.target.dataset.id;
            const vidx = Number(entry.target.dataset.idx);
            onActiveVerseChanged(vid, vidx, list.length);
          }
        });
      },
      { root: scrollEl, threshold: [0.6] }
    );

    scrollEl.querySelectorAll(".verse-slide").forEach((slide) => feedObserver.observe(slide));

    const targetIdx = Math.max(0, list.findIndex((v) => v.id === state.currentVerseId));
    onActiveVerseChanged(list[targetIdx].id, targetIdx, list.length);
    scrollToVerseIndex(targetIdx, false);
  }

  function onActiveVerseChanged(verseId, idx, total) {
    state.currentVerseId = verseId;
    if (!state.readIds.includes(verseId)) {
      state.readIds.push(verseId);
    }
    saveState();

    const v = getVerseById(verseId);
    const modePrefix = state.sutraMode === "mixed" ? "合流" : v.sutraName;
    $("#sutraPillLabel").textContent = `${modePrefix} ${idx + 1}/${total}`;

    $$(".ruler-tick").forEach((t, i) => {
      const isActive = i === idx;
      const isEdge = t.dataset.edge === "true";
      t.classList.toggle("active", isActive);
      t.innerHTML = isActive || isEdge ? t.dataset.label : `<span class="ruler-dot"></span>`;
    });

    $("#btnTopBookmark").classList.toggle("bookmarked", state.bookmarkedIds.includes(verseId));
    $("#btnFilterLiked").classList.toggle("active-filter", state.filterLikedOnly);

    const isLiked = state.likedIds.includes(verseId);
    const likeBtn = $("#actLike");
    likeBtn.classList.toggle("liked", isLiked);
    $("#actLikeCount").textContent = formatCount(v.likes + (isLiked ? 1 : 0));
    $("#actCommentCount").textContent = String(getCommentsForVerse(v).length);

    const cue = $("#swipeCue");
    if (cue && idx > 0) cue.style.opacity = "0";

    if (autoScrollTimer) autoScrollProgress = 0;
  }

  function scrollToVerseIndex(idx, smooth = true) {
    const scrollEl = $("#feedScroll");
    const slides = scrollEl.querySelectorAll(".verse-slide");
    if (!slides[idx]) return;
    scrollEl.scrollTo({
      top: slides[idx].offsetTop,
      behavior: smooth ? "smooth" : "auto"
    });
  }

  function scrollToVerseId(id, smooth = true) {
    let list = getFeedList();
    let idx = list.findIndex((v) => v.id === id);
    if (idx === -1) {
      const target = getVerseById(id);
      state.filterLikedOnly = false;
      state.sutraMode = target.sutra;
      renderFeed();
      list = getFeedList();
      idx = list.findIndex((v) => v.id === id);
    }
    if (idx >= 0) {
      scrollToVerseIndex(idx, smooth);
    }
  }

  // ==================== 点赞与书签联动 ====================
  function toggleLike(id) {
    const i = state.likedIds.indexOf(id);
    if (i >= 0) {
      state.likedIds.splice(i, 1);
      showToast("已移出珍藏");
    } else {
      state.likedIds.push(id);
      showToast("已珍藏");
    }
    saveState();

    if (state.filterLikedOnly && state.likedIds.length === 0) {
      state.filterLikedOnly = false;
      renderFeed();
      return;
    }

    if (id === state.currentVerseId) {
      const list = getFeedList();
      const idx = Math.max(0, list.findIndex((v) => v.id === id));
      onActiveVerseChanged(id, idx, list.length);
    }
    if (state.activeTab === "plans") renderPlans();
    if (state.activeTab === "mine") renderMine();
  }

  function toggleBookmark(id) {
    const i = state.bookmarkedIds.indexOf(id);
    if (i >= 0) {
      state.bookmarkedIds.splice(i, 1);
      showToast("已取消书签");
    } else {
      state.bookmarkedIds.push(id);
      showToast("已收藏");
    }
    saveState();
    $("#btnTopBookmark").classList.toggle("bookmarked", state.bookmarkedIds.includes(state.currentVerseId));
    if (state.activeTab === "mine") renderMine();
  }

  // ==================== Bottom Sheet: 轻触解经 (极简高定版) ====================
  function openStudySheet(verseId, subView = "menu") {
    studyVerseId = verseId;
    studySubView = subView;
    renderStudySheet();
    $("#studySheetBackdrop").classList.remove("hidden");
  }

  function closeStudySheet() {
    $("#studySheetBackdrop").classList.add("hidden");
  }

  function handleProFeatureAccess(callback) {
    if (state.proUnlocked) {
      callback();
      return;
    }
    state.proPreviewCount += 1;
    saveState();
    if (state.proPreviewCount <= 2) {
      callback();
    } else {
      closeStudySheet();
      openPaywallModal("解锁全部梵文词源与历代异译对照");
    }
  }

  function renderStudySheet() {
    const v = getVerseById(studyVerseId);
    const wrap = $("#studySheetContent");

    if (studySubView === "menu") {
      const proTag = state.proUnlocked ? "" : `<span class="pro-micro-tag">PRO</span>`;
      wrap.innerHTML = `
        <div class="sheet-top-row">
          <button class="sheet-text-btn" id="btnCancelStudySheet" type="button">取消</button>
          <span class="sheet-top-spacer"></span>
        </div>
        <div class="sheet-verse-header">
          <h3>${v.sutraName} · ${shortChapter(v)}</h3>
          <p class="sheet-quote-clamp">“${v.text}”</p>
        </div>

        <div class="sheet-menu-group">
          <button class="sheet-menu-item" data-study-action="plain" type="button">
            <span class="sheet-item-left">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.4 1 2.3h6c0-.9.3-1.7 1-2.3A7 7 0 0 0 12 2z"/></svg>
              <span>白话释义</span>
            </span>
            <span class="sheet-item-right">${CHEVRON_RIGHT}</span>
          </button>

          <button class="sheet-menu-item" data-study-action="sanskrit" type="button">
            <span class="sheet-item-left">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 10h6"/><path d="M12 7v6"/></svg>
              <span>梵文词源</span>
            </span>
            <span class="sheet-item-right">${proTag}${CHEVRON_RIGHT}</span>
          </button>

          <button class="sheet-menu-item" data-study-action="deep" type="button">
            <span class="sheet-item-left">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span>深解义理</span>
            </span>
            <span class="sheet-item-right">${CHEVRON_RIGHT}</span>
          </button>

          <button class="sheet-menu-item" data-study-action="related" type="button">
            <span class="sheet-item-left">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              <span>关联经句</span>
            </span>
            <span class="sheet-item-right">${CHEVRON_RIGHT}</span>
          </button>
        </div>

        <div class="sheet-divider"></div>

        <div class="sheet-menu-group">
          <button class="sheet-menu-item" data-util-action="context" type="button">
            <span class="sheet-item-left">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              <span>全经上下文</span>
            </span>
            <span class="sheet-item-right">${CHEVRON_RIGHT}</span>
          </button>

          <button class="sheet-menu-item" data-util-action="widget" type="button">
            <span class="sheet-item-left">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
              <span>锁屏组件</span>
            </span>
            <span class="sheet-item-right">${CHEVRON_RIGHT}</span>
          </button>

          <button class="sheet-menu-item" data-util-action="snapshot" type="button">
            <span class="sheet-item-left">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M4 16v2a2 2 0 0 0 2 2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M16 20h2a2 2 0 0 0 2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>
              <span>禅意日签</span>
            </span>
            <span class="sheet-item-right">${CHEVRON_RIGHT}</span>
          </button>

          <button class="sheet-menu-item" data-util-action="autoscroll" type="button">
            <span class="sheet-item-left">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><polyline points="8.5 12 12 15.5 15.5 12"/><line x1="12" y1="8.5" x2="12" y2="15.5"/></svg>
              <span>自动禅滑</span>
            </span>
            <span class="sheet-item-right"><span class="sheet-state-tag">${autoScrollTimer ? "开" : "关"}</span>${CHEVRON_RIGHT}</span>
          </button>
        </div>
      `;

      $("#btnCancelStudySheet").addEventListener("click", closeStudySheet);
      wrap.querySelectorAll("[data-study-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const act = btn.dataset.studyAction;
          if (act === "sanskrit") {
            handleProFeatureAccess(() => {
              studySubView = "sanskrit";
              renderStudySheet();
            });
          } else {
            studySubView = act;
            renderStudySheet();
          }
        });
      });

      wrap.querySelectorAll("[data-util-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const act = btn.dataset.utilAction;
          closeStudySheet();
          if (act === "context") openContextModal(v.sutra, v.id);
          if (act === "widget") openWidgetModal(v.id);
          if (act === "snapshot") openSnapshotModal(v.id);
          if (act === "autoscroll") toggleAutoScroll();
        });
      });
      return;
    }

    const titles = {
      plain: "白话释义",
      sanskrit: "梵文词源",
      deep: "深解义理",
      related: "关联经句"
    };

    const subTopBar = `
      <div class="sheet-top-row">
        <button class="sheet-text-btn" id="btnBackStudyMenu" type="button">‹ 返回</button>
        <span class="sheet-nav-title">${titles[studySubView] || ""}</span>
        <button class="sheet-text-btn accent" id="btnCloseStudyDetail" type="button">完成</button>
      </div>
    `;

    let bodyHtml = "";
    if (studySubView === "plain") {
      bodyHtml = `
        <div class="study-detail-body">
          <div class="editorial-sec first">
            <div class="ed-label">译文</div>
            <p class="ed-body">${v.plain.literal}</p>
          </div>
          <div class="editorial-sec ed-callout sage">
            <div class="ed-label">点破</div>
            <p class="ed-body">${v.plain.takeaway}</p>
          </div>
          <div class="editorial-sec">
            <div class="ed-label">${v.altVersion.translator}</div>
            <p class="ed-body serif">${v.altVersion.text}</p>
          </div>
        </div>
      `;
    } else if (studySubView === "sanskrit") {
      bodyHtml = `
        <div class="study-detail-body">
          <div class="sanskrit-monograph">
            <div class="sanskrit-devanagari">${v.sanskrit.term}</div>
            <div class="sanskrit-roman">${v.sanskrit.roman}</div>
          </div>
          <div class="editorial-sec">
            <div class="ed-label">词根</div>
            <p class="ed-body">${v.sanskrit.literal}</p>
          </div>
          <div class="editorial-sec">
            <div class="ed-label">微意</div>
            <p class="ed-body">${v.sanskrit.insight}</p>
          </div>
        </div>
      `;
    } else if (studySubView === "deep") {
      bodyHtml = `
        <div class="study-detail-body">
          <div class="editorial-sec first">
            <div class="ed-label">义理</div>
            <p class="ed-body">${v.deepStudy.meaning}</p>
          </div>
          <div class="editorial-sec">
            <div class="ed-label">典故</div>
            <p class="ed-body">${v.deepStudy.history}</p>
          </div>
          <div class="editorial-sec ed-callout cinnabar">
            <div class="ed-label">当下</div>
            <p class="ed-body">${v.deepStudy.applyIt}</p>
          </div>
        </div>
      `;
    } else if (studySubView === "related") {
      const relatedCards = v.relatedIds
        .map((rid) => {
          const rv = getVerseById(rid);
          return `
            <button class="editorial-related-row" data-jump-verse="${rv.id}" type="button">
              <div class="er-content">
                <div class="er-meta">${rv.sutraName} · ${shortChapter(rv)}</div>
                <div class="er-text">${rv.text}</div>
              </div>
              ${CHEVRON_RIGHT}
            </button>
          `;
        })
        .join("");

      bodyHtml = `<div class="study-detail-body">${relatedCards}</div>`;
    }

    wrap.innerHTML = subTopBar + bodyHtml;
    $("#btnBackStudyMenu").addEventListener("click", () => {
      studySubView = "menu";
      renderStudySheet();
    });
    $("#btnCloseStudyDetail").addEventListener("click", closeStudySheet);
    wrap.querySelectorAll("[data-jump-verse]").forEach((card) => {
      card.addEventListener("click", () => {
        const targetId = card.dataset.jumpVerse;
        closeStudySheet();
        closeDiscoverCard();
        switchTab("feed");
        scrollToVerseId(targetId, true);
      });
    });
  }

  // ==================== 选经 / 跳句抽屉 ====================
  function openSutraSheet() {
    renderSutraSheet();
    $("#sutraSheetBackdrop").classList.remove("hidden");
  }

  function closeSutraSheet() {
    $("#sutraSheetBackdrop").classList.add("hidden");
  }

  function renderSutraSheet() {
    const list = getFeedList();
    const wrap = $("#sutraSheetContent");
    const modes = [
      { id: "xinjing", label: "心经 · 九屏" },
      { id: "jingang", label: "金刚经 · 九屏" },
      { id: "mixed", label: "合流" }
    ];

    wrap.innerHTML = `
      <div class="sheet-top-row">
        <span class="sheet-nav-title">经卷</span>
        <button class="sheet-text-btn accent" id="btnCloseSutraSheet" type="button">完成</button>
      </div>
      <div class="sutra-switch-grid">
        ${modes
          .map(
            (m) => `
          <button class="sutra-mode-btn ${state.sutraMode === m.id ? "active" : ""}" data-sutra-mode="${m.id}" type="button">${m.label}</button>
        `
          )
          .join("")}
      </div>
      <div class="jump-list">
        ${list
          .map(
            (v, idx) => `
          <button class="jump-row ${v.id === state.currentVerseId ? "current" : ""}" data-jump-id="${v.id}" type="button">
            <span class="jump-idx">${String(idx + 1).padStart(2, "0")}</span>
            <span class="jump-txt">${v.text}</span>
          </button>
        `
          )
          .join("")}
      </div>
    `;

    $("#btnCloseSutraSheet").addEventListener("click", closeSutraSheet);
    wrap.querySelectorAll("[data-sutra-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.sutraMode = btn.dataset.sutraMode;
        state.filterLikedOnly = false;
        const nextList = getFeedList();
        state.currentVerseId = nextList[0].id;
        saveState();
        renderFeed();
        renderSutraSheet();
      });
    });

    wrap.querySelectorAll("[data-jump-id]").forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.dataset.jumpId;
        closeSutraSheet();
        scrollToVerseId(id, true);
      });
    });
  }

  // ==================== 感悟抽屉 ====================
  function openCommentSheet(verseId) {
    commentVerseId = verseId;
    renderCommentSheet();
    $("#commentSheetBackdrop").classList.remove("hidden");
  }

  function closeCommentSheet() {
    $("#commentSheetBackdrop").classList.add("hidden");
  }

  function renderCommentSheet() {
    const v = getVerseById(commentVerseId);
    const comments = getCommentsForVerse(v);
    const wrap = $("#commentSheetContent");

    wrap.innerHTML = `
      <div class="sheet-top-row">
        <span class="sheet-nav-title">感悟 · ${comments.length}</span>
        <button class="sheet-text-btn" id="btnCloseCommentSheet" type="button">关闭</button>
      </div>
      <p class="sheet-quote-sub">“${v.text}”</p>
      <div class="comment-list">
        ${comments
          .map(
            (c) => `
          <div class="comment-item">
            <div class="comment-meta"><strong>${c.user}</strong><span>${c.time}</span></div>
            <p>${c.text}</p>
          </div>
        `
          )
          .join("")}
      </div>
      <form class="comment-form" id="commentForm">
        <input type="text" id="commentInput" placeholder="记下这一念…" maxlength="140" required />
        <button type="submit">记下</button>
      </form>
    `;

    $("#btnCloseCommentSheet").addEventListener("click", closeCommentSheet);
    $("#commentForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#commentInput");
      const text = input.value.trim();
      if (!text) return;
      if (!state.customComments[v.id]) state.customComments[v.id] = [];
      state.customComments[v.id].unshift({
        user: "我",
        time: "刚刚",
        text
      });
      if (!state.bookmarkedIds.includes(v.id)) {
        state.bookmarkedIds.push(v.id);
      }
      saveState();
      renderCommentSheet();
      const list = getFeedList();
      const idx = Math.max(0, list.findIndex((item) => item.id === state.currentVerseId));
      onActiveVerseChanged(state.currentVerseId, idx, list.length);
      showToast("已收录");
    });
  }

  // ==================== 全经上下文 Modal ====================
  function openContextModal(sutraKey, highlightId) {
    const key = sutraKey === "jingang" ? "jingang" : "xinjing";
    const full = DATA.FULL_SUTRAS[key];
    $("#contextModalTitle").textContent = full.title;
    const body = $("#contextModalBody");

    body.innerHTML = `
      <div class="context-sub">${full.subtitle}</div>
      ${full.segments
        .map(
          (seg) => `
        <div class="context-segment ${seg.id === highlightId ? "highlight" : ""}" data-ctx-id="${seg.id}">
          ${seg.prefix ? `<span class="context-prefix">${seg.prefix}</span>` : ""}
          <span>${seg.text}</span>
        </div>
      `
        )
        .join("")}
    `;

    $("#contextModalBackdrop").classList.remove("hidden");
    const activeEl = body.querySelector(".context-segment.highlight");
    if (activeEl) {
      setTimeout(() => activeEl.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
    }

    body.querySelectorAll("[data-ctx-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const targetId = el.dataset.ctxId;
        $("#contextModalBackdrop").classList.add("hidden");
        closeDiscoverCard();
        switchTab("feed");
        scrollToVerseId(targetId, true);
      });
    });
  }

  // ==================== 锁屏组件预览 Modal ====================
  function openWidgetModal(verseId) {
    const v = getVerseById(verseId);
    const now = new Date();
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`;

    $("#widgetPreviewBody").innerHTML = `
      <div class="ls-date">${dateStr}</div>
      <div class="ls-clock">09:41</div>
      <div class="ls-widget-card">
        <div class="ls-widget-head">
          <span>一念 · ${v.sutraName}</span>
          <span>${shortChapter(v)}</span>
        </div>
        <div class="ls-widget-verse">“${v.text}”</div>
      </div>
      <p class="ls-caption">抬手点亮屏幕，先见一念清净</p>
    `;
    $("#widgetModalBackdrop").classList.remove("hidden");
  }

  // ==================== 禅意日签海报 Modal ====================
  function openSnapshotModal(verseId) {
    const v = getVerseById(verseId);
    renderSnapshotModal(v);
    $("#snapshotModalBackdrop").classList.remove("hidden");
  }

  function renderSnapshotModal(v) {
    const skins = [
      { id: "paper", label: "宣纸" },
      { id: "sage", label: "竹青" },
      { id: "cinnabar", label: "朱砂" }
    ];

    $("#snapshotModalBody").innerHTML = `
      <div class="poster-card skin-${state.posterSkin}" id="posterCardPreview">
        <div class="poster-enso">
          <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
            <path d="M74 26C62 14 40 13 26 26C12 39 12 62 25 75C38 88 61 88 75 74C86 63 87 43 77 32" stroke="currentColor" stroke-width="5.2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="poster-quote">${v.text}</div>
        <div class="poster-foot">
          <span>${v.sutraFullName} · ${shortChapter(v)}</span>
          <span>一念</span>
        </div>
      </div>

      <div class="skin-picker">
        ${skins
          .map(
            (s) => `
          <button class="skin-btn ${state.posterSkin === s.id ? "active" : ""}" data-skin="${s.id}" type="button">${s.label}</button>
        `
          )
          .join("")}
      </div>

      <div class="snapshot-actions">
        <button class="black-cta-btn" id="btnSavePosterPng" type="button">保存日签</button>
        <button class="ghost-row-btn" id="btnCopyVerseText" type="button">复制经句</button>
      </div>
    `;

    $("#snapshotModalBody")
      .querySelectorAll("[data-skin]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          state.posterSkin = btn.dataset.skin;
          saveState();
          renderSnapshotModal(v);
        });
      });

    $("#btnSavePosterPng").addEventListener("click", () => downloadPosterPng(v));
    $("#btnCopyVerseText").addEventListener("click", () => {
      const copyStr = `“${v.text}”\n——《${v.sutraFullName}》`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyStr).then(() => showToast("已复制"));
      } else {
        showToast("已复制");
      }
    });
  }

  function downloadPosterPng(v) {
    const canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");

    const palettes = {
      paper: { bg: "#FAF8F2", fg: "#1C1A17", sub: "#6C665C" },
      sage: { bg: "#24332C", fg: "#F4F1EA", sub: "#B5C3BC" },
      cinnabar: { bg: "#2E1715", fg: "#F8EFE6", sub: "#CFAEA7" }
    };
    const p = palettes[state.posterSkin] || palettes.paper;

    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, 750, 1000);

    ctx.strokeStyle = p.sub;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 44, 662, 912);
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(118, 130, 32, 0.4, Math.PI * 2 - 0.15);
    ctx.strokeStyle = p.fg;
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.fillStyle = p.fg;
    ctx.font = '38px "Songti SC", "STSong", serif';
    const chars = Array.from(v.text);
    const lines = [];
    let current = "";
    for (const ch of chars) {
      if (ctx.measureText(current + ch).width > 560) {
        lines.push(current);
        current = ch;
      } else {
        current += ch;
      }
    }
    if (current) lines.push(current);

    const startY = 470 - (lines.length * 64) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, 92, startY + i * 64);
    });

    ctx.fillStyle = p.sub;
    ctx.font = '23px "PingFang SC", sans-serif';
    ctx.fillText(`${v.sutraFullName} · ${shortChapter(v)}`, 92, 875);
    ctx.fillText("一念", 614, 875);

    const link = document.createElement("a");
    link.download = `一念-${v.sutraName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("已保存");
  }

  // ==================== Paywall Modal ====================
  function openPaywallModal(customReason) {
    renderPaywallModal(customReason);
    $("#paywallModalBackdrop").classList.remove("hidden");
  }

  function renderPaywallModal(customReason) {
    const inner = $("#paywallInner");
    const reasonText =
      customReason ||
      "核心竖滑读经、基础笔记与共修计划永远免费。";

    inner.innerHTML = `
      <span class="pw-badge">一念 PRO</span>
      <h2 class="pw-title">让千年智慧，<br/>流淌于当下</h2>
      <p class="pw-sub">${reasonText}</p>

      <div class="pw-compare">
        <div class="pw-row"><span>心经 · 金刚经竖滑阅读</span><strong>免费</strong></div>
        <div class="pw-row"><span>梵文原典词根拆解</span><strong style="color:var(--bronze);">Pro</strong></div>
        <div class="pw-row"><span>玄奘 · 鸠摩罗什 · 义净异译对照</span><strong style="color:var(--bronze);">Pro</strong></div>
        <div class="pw-row"><span>全套禅意日签皮肤</span><strong style="color:var(--bronze);">Pro</strong></div>
      </div>

      <div class="pw-plans">
        <button class="pw-plan-card ${selectedPaywallPlan === "yearly" ? "selected" : ""}" data-pw="yearly" type="button">
          <span style="color:var(--bronze);font-weight:600;">含 7 日免费</span>
          <strong>¥128 / 年</strong>
          <span>约 ¥10.6 / 月</span>
        </button>
        <button class="pw-plan-card ${selectedPaywallPlan === "monthly" ? "selected" : ""}" data-pw="monthly" type="button">
          <span>按月</span>
          <strong>¥18 / 月</strong>
          <span>随时取消</span>
        </button>
      </div>

      <button class="black-cta-btn" id="btnSimulateUnlockPro" type="button">
        ${state.proUnlocked ? "已开启一念 Pro" : "开启 7 日静修体验"}
      </button>
      <button class="text-skip-btn" id="btnDismissPaywall" type="button" style="margin-top:8px;">暂不升级</button>
    `;

    inner.querySelectorAll("[data-pw]").forEach((card) => {
      card.addEventListener("click", () => {
        selectedPaywallPlan = card.dataset.pw;
        renderPaywallModal(customReason);
      });
    });

    $("#btnSimulateUnlockPro").addEventListener("click", () => {
      state.proUnlocked = true;
      saveState();
      $("#paywallModalBackdrop").classList.add("hidden");
      showToast("已开启一念 Pro");
      if (state.activeTab === "mine") renderMine();
    });

    $("#btnDismissPaywall").addEventListener("click", () => {
      $("#paywallModalBackdrop").classList.add("hidden");
    });
  }

  // ==================== 自动禅滑 ====================
  function toggleAutoScroll() {
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer);
      autoScrollTimer = null;
      autoScrollProgress = 0;
      $("#autoscrollFill").style.width = "0%";
      $("#autoscrollPill").classList.add("hidden");
      showToast("自动禅滑已关");
      return;
    }

    $("#autoscrollPill").classList.remove("hidden");
    showToast("自动禅滑已开");
    const stepMs = 100;
    const totalMs = 7000;

    autoScrollTimer = setInterval(() => {
      if (state.activeTab !== "feed") return;
      autoScrollProgress += stepMs;
      $("#autoscrollFill").style.width = `${Math.min(100, (autoScrollProgress / totalMs) * 100)}%`;
      if (autoScrollProgress >= totalMs) {
        autoScrollProgress = 0;
        const list = getFeedList();
        const curIdx = list.findIndex((v) => v.id === state.currentVerseId);
        const nextIdx = (curIdx + 1) % list.length;
        scrollToVerseIndex(nextIdx, true);
      }
    }, stepMs);
  }

  // ==================== TAB 2: 发现 Discover ====================
  function getMoodIconSvg(type, color) {
    const svgs = {
      knot: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"><path d="M12 3a4 4 0 0 0-4 4c0 3 4 5 4 5s4-2 4-5a4 4 0 0 0-4-4z"/><path d="M12 21a4 4 0 0 1-4-4c0-3 4-5 4-5s4 2 4 5a4 4 0 0 1-4 4z"/><path d="M3 12a4 4 0 0 1 4-4c3 0 5 4 5 4s-2 4-5 4a4 4 0 0 1-4-4z"/><path d="M21 12a4 4 0 0 0-4-4c-3 0-5 4-5 4s2 4 5 4a4 4 0 0 0 4-4z"/></svg>`,
      anchor: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="6" r="2.5"/><line x1="12" y1="8.5" x2="12" y2="20"/><path d="M5 13a7 7 0 0 0 14 0"/><line x1="9" y1="12" x2="15" y2="12"/></svg>`,
      moon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
      waves: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"><path d="M2 8c2.5-2.5 5.5-2.5 8 0s5.5 2.5 8 0 3-1.5 4 0"/><path d="M2 15c2.5-2.5 5.5-2.5 8 0s5.5 2.5 8 0 3-1.5 4 0"/></svg>`
    };
    return svgs[type] || svgs.knot;
  }

  function renderDiscover() {
    $("#moodRail").innerHTML = DATA.MOOD_TOPICS.map(
      (m) => `
      <button class="mood-card" data-mood-id="${m.id}" type="button">
        <div>
          <strong>${m.title}</strong>
          <span>${m.subtitle}</span>
        </div>
        <div class="mood-icon">${getMoodIconSvg(m.icon, m.color)}</div>
      </button>
    `
    ).join("");

    $("#storyRail").innerHTML = DATA.DISCOVER_STORIES.map(
      (s) => `
      <button class="story-card" data-story-verse="${s.verseId}" type="button">
        <span class="story-tag">${s.tag}</span>
        <strong>${s.title}</strong>
        <p>${s.snippet}</p>
      </button>
    `
    ).join("");

    $$("[data-mood-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const mood = DATA.MOOD_TOPICS.find((m) => m.id === card.dataset.moodId);
        if (mood) openDiscoverCards(mood.verseIds, 0);
      });
    });

    $$("[data-story-verse]").forEach((card) => {
      card.addEventListener("click", () => {
        const allStoryIds = DATA.DISCOVER_STORIES.map((s) => s.verseId);
        const startIdx = Math.max(0, allStoryIds.indexOf(card.dataset.storyVerse));
        openDiscoverCards(allStoryIds, startIdx);
      });
    });
  }

  function handleDiscoverSearch(query) {
    const q = query.trim().toLowerCase();
    const clearBtn = $("#searchClear");
    const resWrap = $("#searchResultsWrap");
    const defBody = $("#discoverDefaultBody");

    clearBtn.classList.toggle("hidden", !q);
    if (!q) {
      resWrap.classList.add("hidden");
      defBody.classList.remove("hidden");
      return;
    }

    defBody.classList.add("hidden");
    resWrap.classList.remove("hidden");

    const matches = DATA.VERSES.filter((v) => {
      const hay = `${v.sutraName} ${v.chapter} ${v.text} ${v.plain.literal} ${v.plain.takeaway} ${v.moodTags.join(" ")} ${v.didYouKnow}`.toLowerCase();
      return hay.includes(q);
    });

    $("#searchResultCount").textContent = `${matches.length} 条`;
    const listEl = $("#searchResultsList");
    if (matches.length === 0) {
      listEl.innerHTML = `<div class="mine-empty">未见匹配经句</div>`;
      return;
    }

    listEl.innerHTML = matches
      .map(
        (v) => `
      <button class="search-result-card" data-search-vid="${v.id}" type="button">
        <div class="meta">${v.sutraName} · ${shortChapter(v)}</div>
        <div class="quote">${v.text}</div>
      </button>
    `
      )
      .join("");

    listEl.querySelectorAll("[data-search-vid]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openDiscoverCards([btn.dataset.searchVid], 0);
      });
    });
  }

  // ==================== Discover 沉浸知识单卡 ====================
  function openDiscoverCards(verseIds, startIdx = 0) {
    discoverQueue = verseIds;
    discoverIdx = startIdx;
    renderDiscoverCard();
    $("#discoverCardPage").classList.remove("hidden");
    $("#discoverCardPage").setAttribute("aria-hidden", "false");
  }

  function closeDiscoverCard() {
    $("#discoverCardPage").classList.add("hidden");
    $("#discoverCardPage").setAttribute("aria-hidden", "true");
  }

  function renderDiscoverCard() {
    const vid = discoverQueue[discoverIdx];
    const v = getVerseById(vid);
    if (!state.readIds.includes(v.id)) {
      state.readIds.push(v.id);
      saveState();
    }

    $("#discoverCardCounter").textContent = `${discoverIdx + 1} / ${discoverQueue.length}`;
    $("#btnPrevDiscoverCard").disabled = discoverIdx === 0;
    $("#btnNextDiscoverCard").disabled = discoverIdx === discoverQueue.length - 1;

    const isLiked = state.likedIds.includes(v.id);
    const isBookmarked = state.bookmarkedIds.includes(v.id);

    $("#discoverDetailCard").innerHTML = `
      <span class="dd-tag">${v.moodTags[0] || "般若"}</span>
      <h2 class="dd-title">${v.sutraName}</h2>
      <div class="dd-sub">${shortChapter(v)}</div>
      <p class="dd-quote">“${v.text}”</p>

      <div class="dd-section-label">本义</div>
      <p class="dd-meaning">${v.deepStudy.meaning}</p>

      <div class="did-you-know-box">
        <div class="dyk-title">典故</div>
        <p>${v.didYouKnow}</p>
      </div>

      <div class="dd-related-row">
        ${v.relatedIds
          .map((rid) => {
            const rv = getVerseById(rid);
            return `<button class="related-pill" data-dd-rel="${rv.id}" type="button">${rv.sutraName} · ${shortChapter(rv)}</button>`;
          })
          .join("")}
      </div>

      <button class="dd-deep-link" id="btnDdDeepStudy" type="button">
        <span>解经</span>
        ${CHEVRON_RIGHT}
      </button>

      <div class="dd-action-bar">
        <button class="dd-act-btn ${isBookmarked ? "active" : ""}" id="ddActBookmark" type="button" aria-label="书签">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="${isBookmarked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button class="dd-act-btn" id="ddActComment" type="button" aria-label="感悟">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        </button>
        <button class="dd-act-btn" id="ddActShare" type="button" aria-label="日签">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
        <button class="dd-act-btn ${isLiked ? "active" : ""}" id="ddActReadDone" type="button" aria-label="珍藏">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="${isLiked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
    `;

    $("#discoverDetailCard")
      .querySelectorAll("[data-dd-rel]")
      .forEach((pill) => {
        pill.addEventListener("click", () => {
          const rid = pill.dataset.ddRel;
          if (!discoverQueue.includes(rid)) discoverQueue.push(rid);
          discoverIdx = discoverQueue.indexOf(rid);
          renderDiscoverCard();
        });
      });

    $("#btnDdDeepStudy").addEventListener("click", () => openStudySheet(v.id, "menu"));
    $("#ddActBookmark").addEventListener("click", () => {
      toggleBookmark(v.id);
      renderDiscoverCard();
    });
    $("#ddActComment").addEventListener("click", () => openCommentSheet(v.id));
    $("#ddActShare").addEventListener("click", () => openSnapshotModal(v.id));
    $("#ddActReadDone").addEventListener("click", () => {
      toggleLike(v.id);
      renderDiscoverCard();
    });
  }

  // ==================== TAB 3: 修行 Plans ====================
  function renderPlans() {
    $("#todayReadCount").textContent = String(Math.min(state.readIds.length, 18));
    $("#totalReadCount").textContent = String(state.readIds.length);
    $("#savedSummaryCount").textContent = String(state.likedIds.length);

    const activePlan = DATA.READING_PLANS.find((p) => p.id === state.activePlanId) || DATA.READING_PLANS[0];
    const pct = Math.max(12, Math.round((activePlan.currentDay / activePlan.totalDays) * 100));

    $("#activePlanCard").innerHTML = `
      <div class="ap-top">
        <div class="ap-thumb">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </div>
        <div class="ap-info">
          <h3>${activePlan.title}</h3>
          <p>第 ${activePlan.currentDay}/${activePlan.totalDays} 天</p>
        </div>
      </div>
      <div class="ap-progress-track">
        <div class="ap-progress-fill" style="width:${pct}%"></div>
      </div>
      <button class="ap-cta" id="btnContinuePlan" type="button">继续静读</button>
    `;

    $("#btnContinuePlan").addEventListener("click", () => {
      state.sutraMode = activePlan.sutra;
      state.filterLikedOnly = false;
      renderFeed();
      switchTab("feed");
      scrollToVerseId(activePlan.startVerseId, true);
    });

    $("#plansList").innerHTML = DATA.READING_PLANS.map(
      (p) => `
      <button class="plan-card ${p.id === state.activePlanId ? "selected" : ""}" data-plan-id="${p.id}" type="button">
        ${p.badge ? `<span class="seal-badge">初入</span>` : ""}
        <div class="plan-card-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        <div>
          <strong>${p.title}</strong>
          <span>${p.duration}</span>
        </div>
      </button>
    `
    ).join("");

    $$("[data-plan-id]").forEach((card) => {
      card.addEventListener("click", () => {
        state.activePlanId = card.dataset.planId;
        saveState();
        renderPlans();
        const chosen = DATA.READING_PLANS.find((p) => p.id === state.activePlanId);
        showToast(chosen.title);
      });
    });
  }

  // ==================== TAB 4: 我的 Mine ====================
  function renderMine() {
    $("#mineLikedNum").textContent = String(state.likedIds.length);
    const noteIds = Array.from(new Set([...state.bookmarkedIds, ...Object.keys(state.customComments)]));
    $("#mineBookmarkedNum").textContent = String(noteIds.length);

    if (state.proUnlocked) {
      $("#mineProBadge").textContent = "一念 PRO · 已开启";
      $("#mineProTitle").textContent = "梵文词源与异译对照";
      $("#btnOpenPaywallFromMine").textContent = "详情";
    }

    $$("[data-mine-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.mineTab === state.mineSubTab);
    });

    const targetIds = state.mineSubTab === "liked" ? state.likedIds : noteIds;
    const listEl = $("#mineList");

    if (targetIds.length === 0) {
      listEl.innerHTML =
        state.mineSubTab === "liked"
          ? `<div class="mine-empty">暂无珍藏经句</div>`
          : `<div class="mine-empty">暂无书签或感悟</div>`;
      return;
    }

    listEl.innerHTML = targetIds
      .map((id) => {
        const v = getVerseById(id);
        const myNotes = state.customComments[id] || [];
        const noteHtml =
          myNotes.length > 0 ? `<div class="mv-note">${myNotes[0].text}</div>` : "";
        return `
          <button class="mine-verse-card" data-mine-jump="${v.id}" type="button">
            <div class="mv-meta"><span>${v.sutraName} · ${shortChapter(v)}</span>${CHEVRON_RIGHT}</div>
            <div class="mv-text">${v.text}</div>
            ${noteHtml}
          </button>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-mine-jump]").forEach((card) => {
      card.addEventListener("click", () => {
        switchTab("feed");
        scrollToVerseId(card.dataset.mineJump, true);
      });
    });
  }

  // ==================== Tab 切换 ====================
  function switchTab(tabName) {
    state.activeTab = tabName;
    saveState();

    const map = {
      feed: "#viewFeed",
      discover: "#viewDiscover",
      plans: "#viewPlans",
      mine: "#viewMine"
    };

    $$(".view").forEach((v) => v.classList.remove("active"));
    $(map[tabName]).classList.add("active");

    $$(".tab-item").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tabName);
    });

    if (tabName === "discover") renderDiscover();
    if (tabName === "plans") renderPlans();
    if (tabName === "mine") renderMine();
  }

  // ==================== 事件绑定初始化 ====================
  function bindEvents() {
    window.addEventListener("resize", updatePhoneScale);

    $$(".tab-item").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    $("#btnOnboardNext").addEventListener("click", () => {
      $("#onboardStep1").classList.remove("active");
      $("#onboardStep2").classList.add("active");
    });
    $("#btnOnboardBack").addEventListener("click", () => {
      $("#onboardStep2").classList.remove("active");
      $("#onboardStep1").classList.add("active");
    });
    $("#btnOnboardSkip").addEventListener("click", () => finishOnboarding("xj-1"));
    $$(".intention-card").forEach((card) => {
      card.addEventListener("click", () => finishOnboarding(card.dataset.intent));
    });

    $("#btnRandomVerse").addEventListener("click", () => {
      const candidates = DATA.VERSES.filter((v) => v.id !== state.currentVerseId);
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      scrollToVerseId(picked.id, true);
      showToast(picked.sutraName);
    });

    $("#btnFilterLiked").addEventListener("click", () => {
      if (!state.filterLikedOnly && state.likedIds.length === 0) {
        showToast("暂无珍藏");
        return;
      }
      state.filterLikedOnly = !state.filterLikedOnly;
      saveState();
      renderFeed();
      showToast(state.filterLikedOnly ? "仅看珍藏" : "全部经流");
    });

    $("#btnThemeToggle").addEventListener("click", toggleTheme);
    $("#btnTopBookmark").addEventListener("click", () => toggleBookmark(state.currentVerseId));
    $("#btnSutraPicker").addEventListener("click", openSutraSheet);
    $("#autoscrollPill").addEventListener("click", toggleAutoScroll);

    $("#actLike").addEventListener("click", () => toggleLike(state.currentVerseId));
    $("#actComment").addEventListener("click", () => openCommentSheet(state.currentVerseId));
    $("#actShare").addEventListener("click", () => openSnapshotModal(state.currentVerseId));

    const searchInput = $("#discoverSearch");
    searchInput.addEventListener("input", (e) => handleDiscoverSearch(e.target.value));
    $("#searchClear").addEventListener("click", () => {
      searchInput.value = "";
      handleDiscoverSearch("");
    });

    $("#btnStartDiscoverCards").addEventListener("click", () => {
      openDiscoverCards(["xj-1", "jg-1", "jg-2", "xj-7", "jg-5"], 0);
    });
    $("#btnOpenContextXinjing").addEventListener("click", () => openContextModal("xinjing", state.currentVerseId));
    $("#btnOpenContextJingang").addEventListener("click", () => openContextModal("jingang", state.currentVerseId));

    $("#btnCloseDiscoverCard").addEventListener("click", closeDiscoverCard);
    $("#btnPrevDiscoverCard").addEventListener("click", () => {
      if (discoverIdx > 0) {
        discoverIdx -= 1;
        renderDiscoverCard();
      }
    });
    $("#btnNextDiscoverCard").addEventListener("click", () => {
      if (discoverIdx < discoverQueue.length - 1) {
        discoverIdx += 1;
        renderDiscoverCard();
      }
    });

    $$("[data-mine-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mineSubTab = btn.dataset.mineTab;
        saveState();
        renderMine();
      });
    });
    $("#btnOpenPaywallFromMine").addEventListener("click", () => openPaywallModal());
    $("#btnMineReplayOnboarding").addEventListener("click", () => {
      state.onboardDone = false;
      saveState();
      initOnboarding();
    });
    $("#btnMineToggleTheme").addEventListener("click", toggleTheme);

    $("#studySheetBackdrop").addEventListener("click", (e) => {
      if (e.target === $("#studySheetBackdrop")) closeStudySheet();
    });
    $("#sutraSheetBackdrop").addEventListener("click", (e) => {
      if (e.target === $("#sutraSheetBackdrop")) closeSutraSheet();
    });
    $("#commentSheetBackdrop").addEventListener("click", (e) => {
      if (e.target === $("#commentSheetBackdrop")) closeCommentSheet();
    });
    $("#btnCloseContextModal").addEventListener("click", () => $("#contextModalBackdrop").classList.add("hidden"));
    $("#btnCloseWidgetModal").addEventListener("click", () => $("#widgetModalBackdrop").classList.add("hidden"));
    $("#btnCloseSnapshotModal").addEventListener("click", () => $("#snapshotModalBackdrop").classList.add("hidden"));
    $("#btnClosePaywall").addEventListener("click", () => $("#paywallModalBackdrop").classList.add("hidden"));

    window.addEventListener("keydown", (e) => {
      if (
        state.activeTab !== "feed" ||
        !$("#onboardingOverlay").classList.contains("hidden") ||
        !$("#studySheetBackdrop").classList.contains("hidden") ||
        !$("#commentSheetBackdrop").classList.contains("hidden") ||
        !$("#sutraSheetBackdrop").classList.contains("hidden")
      ) {
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = getFeedList();
        const cur = Math.max(0, list.findIndex((v) => v.id === state.currentVerseId));
        const next = e.key === "ArrowDown" ? Math.min(list.length - 1, cur + 1) : Math.max(0, cur - 1);
        scrollToVerseIndex(next, true);
      }
    });

    $("#deskReplayOnboard").addEventListener("click", () => {
      state.onboardDone = false;
      saveState();
      initOnboarding();
    });
    $("#deskToggleTheme").addEventListener("click", toggleTheme);
    $("#deskSwitchSutra").addEventListener("click", () => {
      state.sutraMode = state.sutraMode === "xinjing" ? "jingang" : "xinjing";
      state.filterLikedOnly = false;
      const list = getFeedList();
      state.currentVerseId = list[0].id;
      saveState();
      switchTab("feed");
      renderFeed();
      showToast(state.sutraMode === "xinjing" ? "心经" : "金刚经");
    });
    $("#deskOpenPaywall").addEventListener("click", () => openPaywallModal());
  }

  updatePhoneScale();
  applyTheme();
  initOnboarding();
  renderFeed();
  switchTab(state.activeTab || "feed");
  bindEvents();
})();
