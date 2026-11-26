// 「一念 · Xiu Xin」核心交互逻辑
(function () {
  const DATA = window.DHARMA_DATA;
  const STORAGE_KEY = "scroll_dharma_demo_v2";

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
    customSutras: [],
    customVerseNotes: {},
    discoverFilter: "all",
    activePlanId: "plan-xinjing",
    mineSubTab: "liked",
    proUnlocked: false,
    proPreviewCount: 0,
    posterSkin: "paper",
    onboardDone: false
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("scroll_dharma_demo_v1");
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
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
  let uploadSplitMode = "newline";
  let toastTimer = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ==================== 自建经文整合 ====================
  function getCustomVerses() {
    const out = [];
    (state.customSutras || []).forEach((cs) => {
      cs.segments.forEach((seg, idx) => {
        const vid = `${cs.id}-${idx + 1}`;
        const note = (state.customVerseNotes && state.customVerseNotes[vid]) || "";
        out.push({
          id: vid,
          sutra: cs.id,
          sutraName: cs.title,
          sutraFullName: cs.title,
          chapter: `第 ${idx + 1} 屏`,
          indexInSutra: idx + 1,
          cardTitle: seg.slice(0, 18) + (seg.length > 18 ? "…" : ""),
          text: seg,
          isRedLetter: idx === 0,
          moodTags: ["自建"],
          isCustom: true,
          author: cs.author || "个人上传",
          plain: {
            literal: note || "暂未填写释义，可在下方写下你对这句经文的理解。",
            takeaway: "自建经句 · 随时记录个人一念批注"
          },
          sanskrit: {
            term: cs.title,
            roman: cs.author || "个人上传",
            literal: "支持竖滑静读、全篇上下文定位与生成禅意日签。",
            insight: "在「白话释义」中可以随时写下并保存属于你自己的注释。"
          },
          deepStudy: {
            meaning: note || seg,
            history: cs.author ? `出处 / 译者：${cs.author}` : "用户自行上传整理的经典段落。",
            applyIt: "点击下方工具，将此句设为锁屏组件或保存禅意日签。"
          },
          didYouKnow: cs.author
            ? `自建经卷《${cs.title}》（${cs.author}），共 ${cs.segments.length} 屏。`
            : `个人上传经卷《${cs.title}》，共 ${cs.segments.length} 屏。`,
          relatedIds: [],
          altVersion: {
            translator: cs.author || "原文录入",
            text: seg
          },
          likes: 1,
          comments: []
        });
      });
    });
    return out;
  }

  function getAllVerses() {
    return [...DATA.VERSES, ...getCustomVerses()];
  }

  function getVerseById(id) {
    return getAllVerses().find((v) => v.id === id) || DATA.VERSES[0];
  }

  function getAllSutrasMeta() {
    const builtIn = [
      { id: "xinjing", label: "心经", fullTitle: "般若波罗蜜多心经", subtitle: "唐 · 玄奘译", count: DATA.VERSES.filter((v) => v.sutra === "xinjing").length, isCustom: false },
      { id: "jingang", label: "金刚经", fullTitle: "金刚般若波罗蜜经", subtitle: "姚秦 · 鸠摩罗什译", count: DATA.VERSES.filter((v) => v.sutra === "jingang").length, isCustom: false },
      { id: "dizang", label: "地藏经", fullTitle: "地藏菩萨本愿经", subtitle: "唐 · 实叉难陀译", count: DATA.VERSES.filter((v) => v.sutra === "dizang").length, isCustom: false },
      { id: "yaoshi", label: "药师经", fullTitle: "药师琉璃光如来本愿功德经", subtitle: "唐 · 玄奘译", count: DATA.VERSES.filter((v) => v.sutra === "yaoshi").length, isCustom: false }
    ];
    const custom = (state.customSutras || []).map((cs) => ({
      id: cs.id,
      label: cs.title,
      fullTitle: cs.title,
      subtitle: cs.author || "个人上传",
      count: cs.segments.length,
      isCustom: true
    }));
    return [...builtIn, ...custom];
  }

  function getCommentsForVerse(verse) {
    const extra = state.customComments[verse.id] || [];
    return [...extra, ...(verse.comments || [])];
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

  function sutraDotColor(sutraKey) {
    const map = {
      xinjing: "#A63429",
      jingang: "#B08446",
      dizang: "#52627A",
      yaoshi: "#4F6D60"
    };
    return map[sutraKey] || "#7D6B5D";
  }

  function showToast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function getFeedList() {
    const all = getAllVerses();
    let list;
    if (state.sutraMode !== "mixed") {
      list = all.filter((v) => v.sutra === state.sutraMode);
      if (list.length === 0) {
        state.sutraMode = "xinjing";
        list = all.filter((v) => v.sutra === "xinjing");
      }
    } else {
      const sutraOrder = getAllSutrasMeta().map((s) => s.id);
      const buckets = sutraOrder.map((id) => all.filter((v) => v.sutra === id));
      const maxLen = Math.max(0, ...buckets.map((b) => b.length));
      list = [];
      for (let i = 0; i < maxLen; i++) {
        buckets.forEach((b) => {
          if (b[i]) list.push(b[i]);
        });
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

  function buildRulerAnchors(total) {
    if (total <= 20) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const count = 15;
    const anchors = [];
    for (let k = 0; k < count; k++) {
      anchors.push(Math.round((k * (total - 1)) / (count - 1)));
    }
    return Array.from(new Set(anchors));
  }

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

    // 智能左侧标尺（<=20 全显；>20 等距采样 15 个锚点，避免拥挤溢出）
    const anchors = buildRulerAnchors(list.length);
    rulerEl.classList.toggle("dense", list.length > 12 && list.length <= 20);
    rulerEl.innerHTML = anchors
      .map((anchorIdx) => {
        const v = list[anchorIdx];
        const label = String(anchorIdx + 1).padStart(2, "0");
        const isEdge = anchorIdx === 0 || anchorIdx === list.length - 1;
        return `<button class="ruler-tick" data-jump-idx="${anchorIdx}" data-label="${label}" data-edge="${isEdge}" type="button" aria-label="${v.sutraName} 第${anchorIdx + 1}句">${isEdge ? label : '<span class="ruler-dot"></span>'}</button>`;
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

    // 将高亮状态精确吸附到最近的标尺锚点，并显示当前实时节号
    const ticks = $$(".ruler-tick");
    let closestTick = ticks[0];
    let minDist = Infinity;
    ticks.forEach((t) => {
      const dist = Math.abs(Number(t.dataset.jumpIdx) - idx);
      if (dist < minDist) {
        minDist = dist;
        closestTick = t;
      }
    });

    const activeLabel = String(idx + 1).padStart(2, "0");
    ticks.forEach((t) => {
      const isActive = t === closestTick;
      const isEdge = t.dataset.edge === "true";
      t.classList.toggle("active", isActive);
      if (isActive) {
        t.textContent = activeLabel;
      } else {
        t.innerHTML = isEdge ? t.dataset.label : `<span class="ruler-dot"></span>`;
      }
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
    if (state.activeTab === "discover") renderDiscover();
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

  // ==================== Bottom Sheet: 轻触解经 ====================
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
      const proTag = state.proUnlocked || v.isCustom ? "" : `<span class="pro-micro-tag">PRO</span>`;
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
              <span>${v.isCustom ? "个人释义" : "白话释义"}</span>
            </span>
            <span class="sheet-item-right">${CHEVRON_RIGHT}</span>
          </button>

          <button class="sheet-menu-item" data-study-action="sanskrit" type="button">
            <span class="sheet-item-left">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 10h6"/><path d="M12 7v6"/></svg>
              <span>${v.isCustom ? "出处与概况" : "梵文词源"}</span>
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

          ${
            v.relatedIds.length > 0
              ? `<button class="sheet-menu-item" data-study-action="related" type="button">
                  <span class="sheet-item-left">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <span>关联经句</span>
                  </span>
                  <span class="sheet-item-right">${CHEVRON_RIGHT}</span>
                </button>`
              : ""
          }
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
          if (act === "sanskrit" && !v.isCustom) {
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
      plain: v.isCustom ? "个人释义" : "白话释义",
      sanskrit: v.isCustom ? "出处与概况" : "梵文词源",
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
      if (v.isCustom) {
        const currentNote = (state.customVerseNotes && state.customVerseNotes[v.id]) || "";
        bodyHtml = `
          <div class="study-detail-body">
            <div class="editorial-sec first">
              <div class="ed-label">原文</div>
              <p class="ed-body serif">${v.text}</p>
            </div>
            <div class="editorial-sec">
              <div class="ed-label">写下我的批注</div>
              <div class="custom-note-form">
                <textarea id="customNoteInput" placeholder="记录你对这句自建经文的理解、翻译或感想…">${currentNote}</textarea>
                <button class="black-cta-btn" id="btnSaveCustomNote" type="button" style="height:40px;font-size:13.5px;">保存批注</button>
              </div>
            </div>
          </div>
        `;
      } else {
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
      }
    } else if (studySubView === "sanskrit") {
      bodyHtml = `
        <div class="study-detail-body">
          <div class="sanskrit-monograph">
            <div class="sanskrit-devanagari">${v.sanskrit.term}</div>
            <div class="sanskrit-roman">${v.sanskrit.roman}</div>
          </div>
          <div class="editorial-sec">
            <div class="ed-label">${v.isCustom ? "简介" : "词根"}</div>
            <p class="ed-body">${v.sanskrit.literal}</p>
          </div>
          <div class="editorial-sec">
            <div class="ed-label">${v.isCustom ? "提示" : "微意"}</div>
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

    const saveNoteBtn = $("#btnSaveCustomNote");
    if (saveNoteBtn) {
      saveNoteBtn.addEventListener("click", () => {
        if (!state.customVerseNotes) state.customVerseNotes = {};
        state.customVerseNotes[v.id] = $("#customNoteInput").value.trim();
        saveState();
        showToast("批注已保存");
        if (state.activeTab === "discover") renderDiscover();
      });
    }

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
    const metas = getAllSutrasMeta();
    const builtIn = metas.filter((m) => !m.isCustom);
    const custom = metas.filter((m) => m.isCustom);
    const totalCount = getAllVerses().length;

    wrap.innerHTML = `
      <div class="sheet-top-row">
        <button class="sheet-text-btn" id="btnOpenUploadFromSutra" type="button">+ 上传</button>
        <span class="sheet-nav-title">经卷</span>
        <button class="sheet-text-btn accent" id="btnCloseSutraSheet" type="button">完成</button>
      </div>
      <div class="sutra-switch-grid">
        ${builtIn
          .map(
            (m) => `
          <button class="sutra-mode-btn ${state.sutraMode === m.id ? "active" : ""}" data-sutra-mode="${m.id}" type="button">${m.label} ${m.count}</button>
        `
          )
          .join("")}
      </div>
      ${
        custom.length > 0
          ? `<div class="sutra-switch-grid" style="grid-template-columns:repeat(${Math.min(3, custom.length)},1fr);margin-bottom:8px;">
              ${custom
                .map(
                  (m) => `
                <button class="sutra-mode-btn ${state.sutraMode === m.id ? "active" : ""}" data-sutra-mode="${m.id}" type="button">${m.label} ${m.count}</button>
              `
                )
                .join("")}
            </div>`
          : ""
      }
      <button class="sutra-mode-btn sutra-mode-full ${state.sutraMode === "mixed" ? "active" : ""}" data-sutra-mode="mixed" type="button">全部合流 · ${totalCount} 屏</button>
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
    $("#btnOpenUploadFromSutra").addEventListener("click", () => {
      closeSutraSheet();
      openUploadModal();
    });

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

  // ==================== 发现页 · 全经脉络选择抽屉 ====================
  function openFullSutraSheet() {
    const metas = getAllSutrasMeta();
    $("#fullSutraSheetContent").innerHTML = `
      <div class="sheet-top-row">
        <button class="sheet-text-btn" id="btnOpenUploadFromFullSutra" type="button">+ 上传</button>
        <span class="sheet-nav-title">全经脉络</span>
        <button class="sheet-text-btn accent" id="btnCloseFullSutraSheet" type="button">关闭</button>
      </div>
      <div class="entry-cards">
        ${metas
          .map(
            (m) => `
          <button class="entry-row-card" data-full-ctx="${m.id}" type="button">
            <div>
              <strong>${m.fullTitle}</strong>
              <span>${m.subtitle} · ${m.count} 屏</span>
            </div>
            ${CHEVRON_RIGHT}
          </button>
        `
          )
          .join("")}
      </div>
    `;
    $("#fullSutraSheetBackdrop").classList.remove("hidden");
    $("#btnCloseFullSutraSheet").addEventListener("click", () => $("#fullSutraSheetBackdrop").classList.add("hidden"));
    $("#btnOpenUploadFromFullSutra").addEventListener("click", () => {
      $("#fullSutraSheetBackdrop").classList.add("hidden");
      openUploadModal();
    });
    $("#fullSutraSheetContent")
      .querySelectorAll("[data-full-ctx]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          $("#fullSutraSheetBackdrop").classList.add("hidden");
          openContextModal(btn.dataset.fullCtx, state.currentVerseId);
        });
      });
  }

  // ==================== 自定义经文上传 Modal ====================
  function splitCustomText(raw, mode) {
    const clean = raw.trim();
    if (!clean) return [];
    if (mode === "newline") {
      return clean
        .split(/\r?\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    // 按句号、问号、叹号、分号智能切分并合并短句
    const rawPieces = clean
      .replace(/\r?\n+/g, "")
      .split(/([。！？；]+)/)
      .reduce((acc, part, idx) => {
        if (idx % 2 === 0) {
          if (part.trim()) acc.push(part.trim());
        } else if (acc.length > 0) {
          acc[acc.length - 1] += part;
        }
        return acc;
      }, []);

    const merged = [];
    let buf = "";
    rawPieces.forEach((p) => {
      if (!buf) {
        buf = p;
      } else if (buf.length < 16 && buf.length + p.length <= 54) {
        buf += p;
      } else {
        merged.push(buf);
        buf = p;
      }
    });
    if (buf) merged.push(buf);
    return merged;
  }

  function updateUploadPreview() {
    const segments = splitCustomText($("#uploadTextArea").value, uploadSplitMode);
    $("#uploadPreviewCount").textContent = `将切分为 ${segments.length} 屏`;
    const sampleWrap = $("#uploadPreviewSamples");
    if (segments.length === 0) {
      sampleWrap.innerHTML = `<div style="font-size:11.5px;color:var(--ink-muted);">输入或导入经文后在此预览分屏效果</div>`;
      return;
    }
    sampleWrap.innerHTML = segments
      .slice(0, 2)
      .map((seg, i) => `<div class="up-sample-item">${String(i + 1).padStart(2, "0")} · ${seg}</div>`)
      .join("");
  }

  function openUploadModal() {
    $("#uploadTitleInput").value = "";
    $("#uploadAuthorInput").value = "";
    $("#uploadTextArea").value = "";
    uploadSplitMode = "newline";
    $$("[data-split-mode]").forEach((b) => b.classList.toggle("active", b.dataset.splitMode === "newline"));
    updateUploadPreview();
    $("#uploadModalBackdrop").classList.remove("hidden");
  }

  function closeUploadModal() {
    $("#uploadModalBackdrop").classList.add("hidden");
  }

  function saveUploadedSutra() {
    const title = $("#uploadTitleInput").value.trim();
    const author = $("#uploadAuthorInput").value.trim();
    const rawText = $("#uploadTextArea").value.trim();
    const segments = splitCustomText(rawText, uploadSplitMode);

    if (!title) {
      showToast("请填写经卷名称");
      return;
    }
    if (segments.length === 0) {
      showToast("请先填写经文正文");
      return;
    }

    const id = `custom-${Date.now()}`;
    if (!state.customSutras) state.customSutras = [];
    state.customSutras.unshift({
      id,
      title,
      author,
      segments,
      createdAt: Date.now()
    });

    state.sutraMode = id;
    state.filterLikedOnly = false;
    state.currentVerseId = `${id}-1`;
    saveState();

    closeUploadModal();
    switchTab("feed");
    renderFeed();
    if (state.activeTab === "discover") renderDiscover();
    showToast(`已收录《${title}》${segments.length} 屏`);
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
        ${
          comments.length > 0
            ? comments
                .map(
                  (c) => `
                <div class="comment-item">
                  <div class="comment-meta"><strong>${c.user}</strong><span>${c.time}</span></div>
                  <p>${c.text}</p>
                </div>
              `
                )
                .join("")
            : `<div class="mine-empty" style="padding:20px;">记下你对这句经文的第一念感悟</div>`
        }
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
    let full = DATA.FULL_SUTRAS[sutraKey];
    if (!full) {
      const cs = (state.customSutras || []).find((c) => c.id === sutraKey);
      if (cs) {
        full = {
          title: cs.title,
          subtitle: cs.author || "个人上传",
          segments: cs.segments.map((text, idx) => ({
            id: `${cs.id}-${idx + 1}`,
            prefix: `【第 ${idx + 1} 屏】`,
            text
          }))
        };
      } else {
        full = DATA.FULL_SUTRAS.xinjing;
      }
    }

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
    const reasonText = customReason || "核心竖滑读经、基础笔记与共修计划永远免费。";

    inner.innerHTML = `
      <span class="pw-badge">一念 PRO</span>
      <h2 class="pw-title">让千年智慧，<br/>流淌于当下</h2>
      <p class="pw-sub">${reasonText}</p>

      <div class="pw-compare">
        <div class="pw-row"><span>四经及自建经文竖滑阅读</span><strong>免费</strong></div>
        <div class="pw-row"><span>梵文原典词根拆解</span><strong style="color:var(--bronze);">Pro</strong></div>
        <div class="pw-row"><span>玄奘 · 鸠摩罗什 · 实叉难陀 · 义净异译对照</span><strong style="color:var(--bronze);">Pro</strong></div>
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

  // ==================== TAB 2: 发现 · 极简双列画廊瀑布流 ====================
  function buildMasonryList() {
    const query = ($("#discoverSearch").value || "").trim().toLowerCase();
    const customVerses = getCustomVerses();

    // 当“全部”且无搜索词时，将各部经卷与自建经文交错排列，保持视效静美多样
    let pool;
    if (state.discoverFilter === "all" && !query) {
      const order = ["xinjing", "jingang", "dizang", "yaoshi"];
      const builtInBuckets = order.map((s) => DATA.VERSES.filter((v) => v.sutra === s));
      const customBuckets = (state.customSutras || []).map((cs) => customVerses.filter((v) => v.sutra === cs.id)).filter((b) => b.length > 0);
      const buckets = [...builtInBuckets, ...customBuckets];
      const maxLen = buckets.length ? Math.max(...buckets.map((b) => b.length)) : 0;
      const interleaved = [];
      for (let i = 0; i < maxLen; i++) {
        buckets.forEach((b) => {
          if (b[i]) interleaved.push(b[i]);
        });
      }
      pool = interleaved;
    } else {
      pool = [...customVerses, ...DATA.VERSES];
    }

    return pool.filter((v) => {
      if (state.discoverFilter === "custom" && !v.isCustom) return false;
      if (state.discoverFilter !== "all" && state.discoverFilter !== "custom") {
        if (!v.moodTags.includes(state.discoverFilter)) return false;
      }
      if (query) {
        const hay = `${v.sutraName} ${v.chapter} ${v.cardTitle || ""} ${v.text} ${v.plain.literal} ${v.plain.takeaway} ${v.moodTags.join(" ")} ${v.didYouKnow}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }

  function buildXhsCardHtml(v, idx) {
    const isLiked = state.likedIds.includes(v.id);
    const likeCount = formatCount(v.likes + (isLiked ? 1 : 0));
    const skin = `skin-${idx % 4}`;
    const len = v.text.length;
    let ratioClass = "ratio-mid";
    let estHeight = 192;
    if (len <= 18) {
      ratioClass = "ratio-short";
      estHeight = 162;
    } else if (len > 34) {
      ratioClass = "ratio-tall";
      estHeight = 222;
    }

    const bodyTitle = v.isCustom ? (state.customVerseNotes && state.customVerseNotes[v.id]) || "" : v.cardTitle || "";
    if (!bodyTitle) estHeight -= 24;

    const heartIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="${isLiked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.7"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

    return {
      estHeight,
      html: `
        <article class="xhs-card" data-xhs-id="${v.id}">
          <div class="xhs-cover ${skin} ${ratioClass}">
            <div class="xhs-cover-quote">${v.text}</div>
          </div>
          <div class="xhs-body">
            ${bodyTitle ? `<p class="xhs-title">${bodyTitle}</p>` : ""}
            <div class="xhs-foot">
              <span class="xhs-sutra-name">${v.sutraName}</span>
              <button class="xhs-like-btn ${isLiked ? "liked" : ""}" data-xhs-like="${v.id}" type="button" aria-label="珍藏">${heartIcon}<span>${likeCount}</span></button>
            </div>
          </div>
        </article>
      `
    };
  }

  function jumpFromDiscoverToFeed(verseId) {
    const target = getVerseById(verseId);
    const currentList = getFeedList();
    const inCurrent = currentList.some((item) => item.id === verseId);
    state.filterLikedOnly = false;
    if (!inCurrent) {
      state.sutraMode = target.sutra;
    }
    state.currentVerseId = verseId;
    saveState();
    switchTab("feed");
    renderFeed();
  }

  function renderDiscover() {
    const scrollBox = $("#viewDiscover .discover-scroll");
    const prevScrollTop = scrollBox ? scrollBox.scrollTop : 0;

    const filters = [
      { id: "all", label: "全部" },
      { id: "焦虑内耗", label: "减压" },
      { id: "执念难放", label: "放下" },
      { id: "身心安康", label: "安康" },
      { id: "失眠静心", label: "静眠" },
      { id: "人际无常", label: "处世" }
    ];
    if ((state.customSutras || []).length > 0) {
      filters.push({ id: "custom", label: "自建" });
    } else if (state.discoverFilter === "custom") {
      state.discoverFilter = "all";
    }

    const bar = $("#discoverFilterBar");
    bar.innerHTML = filters
      .map(
        (f) => `<button class="discover-tab ${state.discoverFilter === f.id ? "active" : ""}" data-filter-id="${f.id}" type="button">${f.label}</button>`
      )
      .join("");

    bar.querySelectorAll("[data-filter-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.discoverFilter = btn.dataset.filterId;
        saveState();
        renderDiscover();
      });
    });

    const filtered = buildMasonryList();
    const masonryEl = $("#discoverMasonry");
    const emptyEl = $("#discoverEmpty");

    if (filtered.length === 0) {
      masonryEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    const cols = ["", ""];
    const heights = [0, 0];
    filtered.forEach((v, idx) => {
      const built = buildXhsCardHtml(v, idx);
      const targetCol = heights[0] <= heights[1] ? 0 : 1;
      cols[targetCol] += built.html;
      heights[targetCol] += built.estHeight;
    });

    masonryEl.innerHTML = `
      <div class="masonry-col">${cols[0]}</div>
      <div class="masonry-col">${cols[1]}</div>
    `;

    if (scrollBox) scrollBox.scrollTop = prevScrollTop;

    masonryEl.querySelectorAll("[data-xhs-like]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleLike(btn.dataset.xhsLike);
      });
    });

    masonryEl.querySelectorAll("[data-xhs-id]").forEach((card) => {
      card.addEventListener("click", () => {
        jumpFromDiscoverToFeed(card.dataset.xhsId);
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

      <div class="dd-section-label">${v.isCustom ? "简介" : "本义"}</div>
      <p class="dd-meaning">${v.deepStudy.meaning}</p>

      <div class="did-you-know-box">
        <div class="dyk-title">${v.isCustom ? "出处" : "典故"}</div>
        <p>${v.didYouKnow}</p>
      </div>

      ${
        v.relatedIds.length > 0
          ? `<div class="dd-related-row">
              ${v.relatedIds
                .map((rid) => {
                  const rv = getVerseById(rid);
                  return `<button class="related-pill" data-dd-rel="${rv.id}" type="button">${rv.sutraName} · ${shortChapter(rv)}</button>`;
                })
                .join("")}
            </div>`
          : ""
      }

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
    $("#todayReadCount").textContent = String(Math.min(state.readIds.length, getAllVerses().length));
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

    // 渲染自建经卷列表
    const customWrap = $("#mineCustomList");
    const customs = state.customSutras || [];
    if (customs.length === 0) {
      customWrap.innerHTML = `<div class="mine-empty" style="padding:18px 14px;">尚未上传自建经文</div>`;
    } else {
      customWrap.innerHTML = customs
        .map(
          (cs) => `
          <div class="mine-custom-row">
            <button class="mine-custom-info" data-open-custom="${cs.id}" type="button">
              <strong>${cs.title}</strong>
              <span>${cs.author ? cs.author + " · " : ""}${cs.segments.length} 屏</span>
            </button>
            <button class="mine-del-btn" data-del-custom="${cs.id}" type="button">删除</button>
          </div>
        `
        )
        .join("");

      customWrap.querySelectorAll("[data-open-custom]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cid = btn.dataset.openCustom;
          state.sutraMode = cid;
          state.filterLikedOnly = false;
          state.currentVerseId = `${cid}-1`;
          saveState();
          switchTab("feed");
          renderFeed();
        });
      });

      customWrap.querySelectorAll("[data-del-custom]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cid = btn.dataset.delCustom;
          state.customSutras = state.customSutras.filter((c) => c.id !== cid);
          if (state.sutraMode === cid) {
            state.sutraMode = "xinjing";
            state.currentVerseId = "xj-1";
          }
          saveState();
          renderMine();
          renderFeed();
          showToast("已删除");
        });
      });
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
      const all = getAllVerses();
      const candidates = all.filter((v) => v.id !== state.currentVerseId);
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

    // Discover 折叠搜索、全经弹窗与瀑布流联动
    const searchWrap = $("#discoverSearchWrap");
    const searchInput = $("#discoverSearch");
    $("#btnToggleDiscoverSearch").addEventListener("click", () => {
      const willOpen = searchWrap.classList.contains("hidden");
      searchWrap.classList.toggle("hidden", !willOpen);
      if (willOpen) {
        searchInput.focus();
      } else if (searchInput.value.trim()) {
        searchInput.value = "";
        renderDiscover();
      }
    });
    searchInput.addEventListener("input", () => {
      renderDiscover();
    });
    $("#searchCancel").addEventListener("click", () => {
      searchInput.value = "";
      searchWrap.classList.add("hidden");
      renderDiscover();
    });
    $("#btnOpenFullSutraPicker").addEventListener("click", openFullSutraSheet);

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

    // 上传经文 Modal
    $("#btnOpenUploadFromMine").addEventListener("click", openUploadModal);
    $("#btnCloseUploadModal").addEventListener("click", closeUploadModal);
    $("#btnSaveUpload").addEventListener("click", saveUploadedSutra);
    $("#uploadTextArea").addEventListener("input", updateUploadPreview);

    $("#btnFillSampleUpload").addEventListener("click", () => {
      const sample = DATA.SAMPLE_UPLOAD_TEXT;
      $("#uploadTitleInput").value = sample.title;
      $("#uploadAuthorInput").value = sample.author;
      $("#uploadTextArea").value = sample.text;
      updateUploadPreview();
    });

    $("#uploadFileInput").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const baseName = file.name.replace(/\.(txt|md|text)$/i, "");
      if (!$("#uploadTitleInput").value.trim()) {
        $("#uploadTitleInput").value = baseName;
      }
      const reader = new FileReader();
      reader.onload = () => {
        $("#uploadTextArea").value = String(reader.result || "");
        updateUploadPreview();
      };
      reader.readAsText(file, "utf-8");
      e.target.value = "";
    });

    $$("[data-split-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        uploadSplitMode = btn.dataset.splitMode;
        $$("[data-split-mode]").forEach((b) => b.classList.toggle("active", b === btn));
        updateUploadPreview();
      });
    });

    // Mine 选项卡 & 操作
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

    // Sheets / Modals 背景遮罩关闭
    $("#studySheetBackdrop").addEventListener("click", (e) => {
      if (e.target === $("#studySheetBackdrop")) closeStudySheet();
    });
    $("#sutraSheetBackdrop").addEventListener("click", (e) => {
      if (e.target === $("#sutraSheetBackdrop")) closeSutraSheet();
    });
    $("#fullSutraSheetBackdrop").addEventListener("click", (e) => {
      if (e.target === $("#fullSutraSheetBackdrop")) $("#fullSutraSheetBackdrop").classList.add("hidden");
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
        !$("#sutraSheetBackdrop").classList.contains("hidden") ||
        !$("#uploadModalBackdrop").classList.contains("hidden")
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
      const metas = getAllSutrasMeta();
      const idx = metas.findIndex((m) => m.id === state.sutraMode);
      const next = metas[(idx + 1) % metas.length];
      state.sutraMode = next.id;
      state.filterLikedOnly = false;
      const list = getFeedList();
      state.currentVerseId = list[0].id;
      saveState();
      switchTab("feed");
      renderFeed();
      showToast(next.label);
    });
    $("#deskOpenUpload").addEventListener("click", openUploadModal);
    $("#deskOpenPaywall").addEventListener("click", () => openPaywallModal());
  }

  updatePhoneScale();
  applyTheme();
  initOnboarding();
  renderFeed();
  switchTab(state.activeTab || "feed");
  bindEvents();
})();
