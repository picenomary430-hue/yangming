/**
 * 养茗·春信 — 手账关卡系统 (#handbook-modal)
 * 依赖 window.Yangming（由 script.js 注入）
 */
(function () {
  "use strict";

  function Y() {
    return window.Yangming;
  }

  var elModal = document.getElementById("handbook-modal");
  var elLeft = null;
  var elRight = null;
  var flipZIndexTimer = null;
  var elFootnote = document.getElementById("handbook-footnote");
  var elZhun = document.getElementById("handbook-zhun-stamp");
  var elBackdrop = document.getElementById("handbook-backdrop");
  var btnClose = document.getElementById("btn-handbook-close");
  var btnNavPrev = document.getElementById("handbook-nav-prev");
  var btnNavNext = document.getElementById("handbook-nav-next");
  var elBook = document.getElementById("handbook-book");
  var elLeaves = document.getElementById("handbook-leaves");
  var leafEls = [];
  var handbookErrorSfx = document.getElementById("handbook-error-sfx");
  var handbookEpilogueNarration = document.getElementById("handbook-epilogue-narration-audio");

  var activeDestroy = null;
  /** 本次打开手账期间终页配音是否已播过（不循环、不重复自动播） */
  var epilogueNarrationPlayed = false;
  var sealBusy = false;
  var currentSpreadIndex = 0;
  var flipAnimating = false;

  var NUM_LEAVES = 6;
  /** 第一关右页：山与水示意（替换为你的图，建议与左页插图比例接近） */
  var HB_L1_RIGHT_SCENE_IMG = "assets/images/hb-l1-right-scene.png";
  /** 手账终页左图：爷爷的背影·茶山 → assets/images/hb-epilogue-young-tea-mountain.png */
  var HB_EPILOGUE_IMG = "assets/images/hb-epilogue-young-tea-mountain.png";
  /** 第四关右页 · 揉捻序列帧：assets/images/hb-l4-kneading/001.png … 026 */
  var HB_L4_KNEAD_FRAME_DIR = "assets/images/hb-l4-kneading/";
  var HB_L4_KNEAD_FRAME_EXT = ".png";
  var HB_L4_KNEAD_FRAME_COUNT = 26;
  var HB_L4_KNEAD_FRAME_PAD = 3;
  var HB_L4_KNEAD_FRAME_MS = 80;
  /** 三段止帧（含，1-based）；第三项 null 表示到最后一帧。留空则 26 帧均分三段 */
  var HB_L4_KNEAD_SEGMENT_END_FRAMES = null;

  function cacheLeafEls() {
    elLeaves = document.getElementById("handbook-leaves");
    elBook = document.getElementById("handbook-book");
    leafEls = [];
    if (!elLeaves) return;
    for (var s = 0; s < NUM_LEAVES; s++) {
      var L = elLeaves.querySelector('.leaf[data-spread="' + s + '"]');
      if (L) leafEls.push(L);
    }
  }

  function getLeafFront(spreadIndex) {
    if (!elLeaves) return null;
    var leaf = elLeaves.querySelector('.leaf[data-spread="' + spreadIndex + '"]');
    return leaf ? leaf.querySelector(".front") : null;
  }

  function getLeafBack(spreadIndex) {
    if (!elLeaves) return null;
    var leaf = elLeaves.querySelector('.leaf[data-spread="' + spreadIndex + '"]');
    return leaf ? leaf.querySelector(".back") : null;
  }

  function clearFlipZIndexTimer() {
    if (flipZIndexTimer != null) {
      window.clearTimeout(flipZIndexTimer);
      flipZIndexTimer = null;
    }
  }

  /**
   * RTL 叠放：未翻（左叠）index 越大 z 越高；已翻（右叠）index 越小 z 越高。
   * leaf--dual 当前篇再 +280；翻页中途 bumpLeaf 再 +100。
   */
  function refreshLeafZIndex(bumpLeaf) {
    var n = leafEls.length || NUM_LEAVES;
    for (var j = 0; j < leafEls.length; j++) {
      var leaf = leafEls[j];
      var z;
      if (leaf.classList.contains("flipped")) {
        z = n - j;
      } else {
        z = n + j;
        if (leaf.classList.contains("leaf--dual")) {
          z += 280;
        }
      }
      if (bumpLeaf === leaf) {
        z += 100;
      }
      leaf.style.zIndex = String(z);
    }
  }

  function syncDualSpreadLeaf() {
    for (var j = 0; j < leafEls.length; j++) {
      leafEls[j].classList.remove("leaf--dual");
    }
    var cur = leafEls[currentSpreadIndex];
    if (cur && !cur.classList.contains("flipped")) {
      cur.classList.add("leaf--dual");
    }
  }

  function bindStoryMount() {
    elLeft = getLeafFront(currentSpreadIndex);
    elRight = getLeafBack(currentSpreadIndex);
  }

  function destroyLevel() {
    if (typeof activeDestroy === "function") {
      try {
        activeDestroy();
      } catch (e) {}
    }
    activeDestroy = null;
    stopEpilogueNarration();
  }

  function stopEpilogueNarration() {
    if (!handbookEpilogueNarration) return;
    if (handbookEpilogueNarration._epilogueNarrationDone) {
      handbookEpilogueNarration.removeEventListener(
        "ended",
        handbookEpilogueNarration._epilogueNarrationDone
      );
      handbookEpilogueNarration.removeEventListener(
        "error",
        handbookEpilogueNarration._epilogueNarrationDone
      );
      handbookEpilogueNarration._epilogueNarrationDone = null;
    }
    handbookEpilogueNarration.pause();
    handbookEpilogueNarration.currentTime = 0;
  }

  /** 进入终页时自动播放寄语配音一次（loop 关闭；同一次打开手账内不重复自动播） */
  function playEpilogueNarration() {
    if (!handbookEpilogueNarration || epilogueNarrationPlayed) return;
    stopEpilogueNarration();
    handbookEpilogueNarration.loop = false;
    function onDone() {
      if (handbookEpilogueNarration._epilogueNarrationDone !== onDone) return;
      handbookEpilogueNarration.removeEventListener("ended", onDone);
      handbookEpilogueNarration.removeEventListener("error", onDone);
      handbookEpilogueNarration._epilogueNarrationDone = null;
      epilogueNarrationPlayed = true;
    }
    handbookEpilogueNarration._epilogueNarrationDone = onDone;
    handbookEpilogueNarration.addEventListener("ended", onDone);
    handbookEpilogueNarration.addEventListener("error", onDone);
    handbookEpilogueNarration.currentTime = 0;
    if (typeof handbookEpilogueNarration.volume === "number") {
      handbookEpilogueNarration.volume = 1;
    }
    var playPromise = handbookEpilogueNarration.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(function () {
          epilogueNarrationPlayed = true;
        })
        .catch(function () {
          onDone();
        });
    } else {
      epilogueNarrationPlayed = true;
    }
  }

  function playHandbookErrorSfx() {
    if (!handbookErrorSfx) return;
    try {
      handbookErrorSfx.pause();
      handbookErrorSfx.currentTime = 0;
      if (typeof handbookErrorSfx.volume === "number") handbookErrorSfx.volume = 0.78;
      var p = handbookErrorSfx.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {}
  }

  function screenShake(opts) {
    opts = opts || {};
    var silentSfx = opts.silentSfx === true;
    var root = document.getElementById("game-root");
    if (!root || !Y()) return;
    if (!silentSfx) playHandbookErrorSfx();
    root.classList.remove("screen-shake");
    void root.offsetWidth;
    root.classList.add("screen-shake");
    window.setTimeout(function () {
      root.classList.remove("screen-shake");
    }, 450);
  }

  /** 过关：盖「准」章 → 合上手账 → 播放生长过场 → 推进进度 */
  function finishLevel(levelIndex) {
    if (sealBusy || !Y()) return;
    var st = Y().getState();
    if (levelIndex <= st.levelProgress) return;

    sealBusy = true;
    function afterStamp() {
      sealBusy = false;
      closeHandbook();
      /* 关卡与春信在生长视频结束、遮罩仍不透明时由 playGrowthCutscene 内写入并切底图 */
      Y().playGrowthCutscene(levelIndex, function () {});
    }

    if (!elZhun) {
      afterStamp();
      return;
    }
    elZhun.classList.add("is-visible");
    window.setTimeout(function () {
      elZhun.classList.remove("is-visible");
      afterStamp();
    }, 750);
  }

  function getMaxSpreadIndex() {
    if (!Y()) return 0;
    var lp = Y().getState().levelProgress;
    if (lp >= 5) return 5;
    return lp;
  }

  function setPageLabelForSpread(si) {
    var el = document.getElementById("handbook-page-label");
    if (!el) return;
    var cn = ["壹", "贰", "叁", "肆", "伍", "终"];
    el.textContent = cn[si] != null ? cn[si] : "—";
  }

  function mountSpreadAt(index, skipDestroy) {
    if (!skipDestroy) destroyLevel();
    currentSpreadIndex = index;
    cacheLeafEls();
    bindStoryMount();
    if (!elLeft || !elRight) return;
    elLeft.innerHTML = "";
    elRight.innerHTML = "";
    elFootnote.textContent = "";
    var shell = elModal ? elModal.querySelector(".handbook-shell") : null;
    if (shell) shell.classList.remove("hb-shell-epilogue");
    setPageLabelForSpread(index);
    if (index === 5) {
      mountGrandpaEpilogue();
    } else {
      var lp = Y() ? Y().getState().levelProgress : 0;
      if (index < lp) {
        mountCompletedSpread(index + 1);
      } else {
        mountLevel(index + 1);
      }
    }
    updateNav();
    syncDualSpreadLeaf();
    refreshLeafZIndex();
  }

  /** 与 mountLevel1–5 左半页一致，供已通关翻阅时展示解说 */
  function handbookLeftPageInnerHtml(levelNum) {
    switch (levelNum) {
      case 1:
        return (
          '<div class="hb-l1-left-illustration hb-left-illustration--level1" aria-hidden="true">' +
          '<img class="hb-l1-left-illustration-img" src="assets/images/hb-l1-left-illustration.png" alt="" loading="lazy" decoding="async" />' +
          "</div>" +
          "<h3>第一关 · 择地</h3>" +
          "<p>龙井茶区上空常年聚集着从西湖飘来的水汽，形成大片云雾，植被茂密。种植地的土壤为白沙岩土，肥沃、透气、排水良好，富含矿物质和微量元素，钾含量极高。</p>"
        );
      case 2:
        return (
          '<div class="hb-l1-left-illustration" aria-hidden="true">' +
          '<img class="hb-l1-left-illustration-img" src="assets/images/hb-l2-left-illustration.png" alt="" loading="lazy" decoding="async" />' +
          "</div>" +
          "<h3>第二关 · 采青</h3>" +
          "<p>龙井茶的采摘时间一般在春季，以清明前后为最佳时期。采摘时要选用新长出的嫩芽，芽叶完整，条索匀齐。采摘标准通常为一芽一叶，要求手法轻柔，避免对茶叶造成损伤。</p>"
        );
      case 3:
        return (
          '<div class="hb-l1-left-illustration hb-left-illustration--level3" aria-hidden="true">' +
          '<img class="hb-l1-left-illustration-img" src="assets/images/hb-l3-left-illustration.png" alt="" loading="lazy" decoding="async" />' +
          "</div>" +
          "<h3>第三关 · 杀青</h3>" +
          "<p>杀青是龙井茶制作的关键步骤，通过高温处理使茶叶停止发酵，保持其绿色。传统方法是将茶叶放入炒锅中，温度控制在200℃至250℃之间，炒制时间为2至3分钟。</p>"
        );
      case 4:
        return (
          '<div class="hb-l1-left-illustration" aria-hidden="true">' +
          '<img class="hb-l1-left-illustration-img" src="assets/images/hb-l4-left-illustration.png" alt="" loading="lazy" decoding="async" />' +
          "</div>" +
          "<h3>第四关 · 揉捻</h3>" +
          "<p>杀青后的茶叶需要进行揉捻，使茶叶形成条索状，增强茶叶的触感和香气。揉捻时要按照抖、搭、捺三个手法步骤，注意力度适中，既要保证茶叶的完整，又要使其形状紧实。</p>"
        );
      case 5:
        return (
          '<div class="hb-l1-left-illustration hb-l5-left-illustration" aria-hidden="true">' +
          '<img class="hb-l1-left-illustration-img" src="assets/images/hb-l5-left-illustration.png" alt="" loading="lazy" decoding="async" />' +
          "</div>" +
          "<h3>第五关 · 炒制</h3>" +
          "<p>炒制是龙井茶制作的重要环节，通过高温炒制使茶叶内部的水分蒸发，形成茶叶的香气，同时使茶叶变得扁平。炒制过程包括青锅、回潮、辉锅三个阶段，每个阶段的温度和手法都有所不同。</p>"
        );
      default:
        return "<h3>茶事手账</h3><p>此篇章已钤「准」印。</p>";
    }
  }

  /** 已通关关卡：仅阅览，不挂载小游戏（避免计时器等副作用） */
  function mountCompletedSpread(levelNum) {
    elLeft.classList.add("hb-l1-left-page");
    elLeft.innerHTML = handbookLeftPageInnerHtml(levelNum);
    elRight.innerHTML =
      '<div class="hb-level-done" role="status">' +
      '<p class="hb-level-done-mark" aria-hidden="true">准</p>' +
      '<p class="hb-level-done-caption">已通关</p>' +
      "</div>";
    elFootnote.textContent = "左页为当时解说；右页为通关印记。已通关篇仅可翻阅，不再计功。";
    activeDestroy = null;
  }

  function updateNav() {
    var maxI = getMaxSpreadIndex();
    var atFirst = currentSpreadIndex <= 0;
    var atLast = currentSpreadIndex >= maxI;
    var busy = sealBusy || flipAnimating;
    /*
     * RTL 线装动线：左下 (‹ handbook-nav-prev) = 往后翻篇；右下 (› handbook-nav-next) = 往回翻篇。
     * 仅当真正在终篇 (currentSpreadIndex >= maxI) 时禁用「往后」；在首篇时禁用「往回」。
     * 不使用 visibility:hidden，避免误认为按钮消失。
     */
    if (btnNavPrev) btnNavPrev.disabled = atLast || busy;
    if (btnNavNext) btnNavNext.disabled = atFirst || busy;
  }

  function prefersReducedFlip() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isTransformProp(name) {
    return name === "transform" || name === "-webkit-transform";
  }

  function tryGoNext() {
    if (flipAnimating || sealBusy) return;
    if (currentSpreadIndex >= getMaxSpreadIndex()) return;
    cacheLeafEls();
    var leaf = leafEls[currentSpreadIndex];
    if (!leaf || !elBook) return;

    function doneNext() {
      currentSpreadIndex++;
      mountSpreadAt(currentSpreadIndex);
      flipAnimating = false;
      elBook.classList.remove("handbook-leaf-busy");
      updateNav();
    }

    if (prefersReducedFlip()) {
      flipAnimating = true;
      elBook.classList.add("handbook-leaf-busy");
      leaf.classList.remove("leaf--dual");
      leaf.classList.add("flipped");
      doneNext();
      return;
    }

    flipAnimating = true;
    elBook.classList.add("handbook-leaf-busy");
    leaf.classList.remove("leaf--dual");

    var finished = false;
    function finishOnce() {
      if (finished) return;
      finished = true;
      clearFlipZIndexTimer();
      refreshLeafZIndex();
      leaf.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallbackId);
      doneNext();
    }

    function onEnd(e) {
      if (e.target !== leaf) return;
      if (!isTransformProp(e.propertyName)) return;
      finishOnce();
    }

    leaf.addEventListener("transitionend", onEnd);
    var fallbackId = window.setTimeout(finishOnce, 1100);
    flipZIndexTimer = window.setTimeout(function () {
      refreshLeafZIndex(leaf);
    }, 500);
    window.requestAnimationFrame(function () {
      leaf.classList.add("flipped");
    });
  }

  function tryGoPrev() {
    if (flipAnimating || sealBusy) return;
    if (currentSpreadIndex <= 0) return;
    cacheLeafEls();
    var leafIdx = currentSpreadIndex - 1;
    var leaf = leafEls[leafIdx];
    if (!leaf || !elBook) return;

    function donePrev() {
      currentSpreadIndex--;
      mountSpreadAt(currentSpreadIndex);
      flipAnimating = false;
      elBook.classList.remove("handbook-leaf-busy");
      updateNav();
    }

    if (prefersReducedFlip()) {
      flipAnimating = true;
      elBook.classList.add("handbook-leaf-busy");
      leaf.classList.remove("flipped");
      donePrev();
      return;
    }

    flipAnimating = true;
    elBook.classList.add("handbook-leaf-busy");

    var finished = false;
    function finishOnce() {
      if (finished) return;
      finished = true;
      clearFlipZIndexTimer();
      refreshLeafZIndex();
      leaf.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallbackId);
      donePrev();
    }

    function onEnd(e) {
      if (e.target !== leaf) return;
      if (!isTransformProp(e.propertyName)) return;
      finishOnce();
    }

    leaf.addEventListener("transitionend", onEnd);
    var fallbackId = window.setTimeout(finishOnce, 1100);
    flipZIndexTimer = window.setTimeout(function () {
      refreshLeafZIndex(leaf);
    }, 500);
    window.requestAnimationFrame(function () {
      leaf.classList.remove("flipped");
    });
  }

  function closeHandbook() {
    stopEpilogueNarration();
    epilogueNarrationPlayed = false;
    destroyLevel();
    flipAnimating = false;
    cacheLeafEls();
    clearFlipZIndexTimer();
    if (elBook) {
      elBook.classList.remove("handbook-leaf-busy", "leaf-no-transition");
    }
    for (var j = 0; j < leafEls.length; j++) {
      leafEls[j].classList.remove("flipped", "leaf--dual");
      leafEls[j].style.zIndex = "";
    }
    if (!elModal) return;
    elModal.classList.add("hidden");
    elModal.setAttribute("hidden", "");
    elModal.setAttribute("aria-hidden", "true");
    document.dispatchEvent(new CustomEvent("yangming:handbook-close"));
  }

  function openHandbook() {
    sealBusy = false;
    flipAnimating = false;
    var api = Y();
    if (!api || !elModal) return;
    cacheLeafEls();
    var st = api.getState();
    if (!st.playerName) return;
    var target = st.levelProgress >= 5 ? 5 : st.levelProgress;
    if (!getLeafFront(target)) return;
    elModal.classList.remove("hidden");
    elModal.removeAttribute("hidden");
    elModal.setAttribute("aria-hidden", "false");
    if (elBook) elBook.classList.add("leaf-no-transition");
    for (var j = 0; j < leafEls.length; j++) {
      leafEls[j].classList.remove("flipped", "leaf--dual");
      if (j < target) leafEls[j].classList.add("flipped");
    }
    mountSpreadAt(target);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (elBook) elBook.classList.remove("leaf-no-transition");
      });
    });
    document.dispatchEvent(new CustomEvent("yangming:handbook-open"));
  }

  /* ========== 第一关 · 择地：拖拽标签入山水轮廓，正确后上色 ========== */
  function mountLevel1() {
    elLeft.classList.add("hb-l1-left-page");
    elLeft.innerHTML = handbookLeftPageInnerHtml(1);
    elRight.innerHTML =
      '<div class="hb-l1-wrap">' +
      '<div class="hb-l1-scene" aria-hidden="true">' +
      '<img class="hb-l1-scene-img" src="' +
      HB_L1_RIGHT_SCENE_IMG +
      '" alt="" width="280" height="200" loading="lazy" decoding="async" />' +
      "</div>" +
      '<div class="hb-l1-drops">' +
      '<div class="hb-drop-zone" data-accept="sand" id="hb-drop-mountain"><span class="hb-drop-hint">山影</span></div>' +
      '<div class="hb-drop-zone" data-accept="water" id="hb-drop-water"><span class="hb-drop-hint">水纹</span></div>' +
      "</div>" +
      '<div class="hb-l1-tags" id="hb-l1-tags">' +
      '<span class="hb-draggable" draggable="true" data-tag="sand">砂土</span>' +
      '<span class="hb-draggable" draggable="true" data-tag="water">泉水</span>' +
      "</div></div>";

    elFootnote.textContent = "拖拽标签到对应区域；两处皆对则页面设色。";

    var placed = { sand: false, water: false };
    var selectedTag = "";
    var sceneWrap = elRight.querySelector(".hb-l1-scene");

    function paintPage() {
      if (!sceneWrap) return;
      sceneWrap.classList.add("hb-l1-colored");
    }

    function checkWin() {
      if (placed.sand && placed.water) {
        var zs = elRight.querySelectorAll(".hb-drop-zone");
        for (var i = 0; i < zs.length; i++) {
          zs[i].classList.add("is-correct-fill");
        }
        paintPage();
        window.setTimeout(function () {
          finishLevel(1);
        }, 600);
      }
    }

    function onDragStart(e) {
      var t = e.target;
      if (!t.classList.contains("hb-draggable")) return;
      if (t.classList.contains("is-placed")) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", t.getAttribute("data-tag"));
      e.dataTransfer.effectAllowed = "move";
    }

    function onDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }

    function onDrop(e) {
      e.preventDefault();
      var zone = e.currentTarget;
      var accept = zone.getAttribute("data-accept");
      var tag = e.dataTransfer.getData("text/plain");
      placeTagIntoZone(tag, zone);
    }

    function placeTagIntoZone(tag, zone) {
      if (!zone) return;
      var accept = zone.getAttribute("data-accept");
      if (!tag || tag !== accept || placed[tag]) return;
      selectedTag = "";
      clearSelectedTagUi();
      placed[tag] = true;
      zone.classList.add("is-filled", "is-correct-fill");
      var hint = zone.querySelector(".hb-drop-hint");
      if (hint) hint.textContent = tag === "sand" ? "砂土" : "泉水";
      var drag = elRight.querySelector('.hb-draggable[data-tag="' + tag + '"]');
      if (drag) {
        drag.classList.add("is-placed");
        drag.setAttribute("draggable", "false");
        drag.style.opacity = "0.5";
      }
      checkWin();
    }

    function clearSelectedTagUi() {
      var allTags = elRight.querySelectorAll(".hb-draggable");
      for (var i = 0; i < allTags.length; i++) {
        allTags[i].classList.remove("is-selected");
      }
    }

    function onTagTap(e) {
      var tagEl = e.target.closest(".hb-draggable");
      if (!tagEl || !elRight.contains(tagEl) || tagEl.classList.contains("is-placed")) return;
      var tag = tagEl.getAttribute("data-tag") || "";
      if (!tag) return;
      if (selectedTag === tag) {
        selectedTag = "";
        clearSelectedTagUi();
        return;
      }
      selectedTag = tag;
      clearSelectedTagUi();
      tagEl.classList.add("is-selected");
    }

    function onZoneTap(e) {
      var zone = e.target.closest(".hb-drop-zone");
      if (!zone || !elRight.contains(zone) || !selectedTag) return;
      placeTagIntoZone(selectedTag, zone);
    }

    elRight.addEventListener("dragstart", onDragStart);
    elRight.addEventListener("click", onTagTap);
    elRight.addEventListener("click", onZoneTap);
    var zones = elRight.querySelectorAll(".hb-drop-zone");
    for (var z = 0; z < zones.length; z++) {
      zones[z].addEventListener("dragover", onDragOver);
      zones[z].addEventListener("drop", onDrop);
    }

    activeDestroy = function () {
      elRight.removeEventListener("dragstart", onDragStart);
      elRight.removeEventListener("click", onTagTap);
      elRight.removeEventListener("click", onZoneTap);
      for (var j = 0; j < zones.length; j++) {
        zones[j].removeEventListener("dragover", onDragOver);
        zones[j].removeEventListener("drop", onDrop);
      }
    };
  }

  /* ========== 第二关 · 采青：10 秒内点中 3 个「一芽一叶」，错则震动 ========== */
  function mountLevel2() {
    elLeft.classList.add("hb-l1-left-page");
    elLeft.innerHTML = handbookLeftPageInnerHtml(2);
    var cardDefs = [
      { correct: true, kind: "bud-1-1" },
      { correct: false, kind: "bud-1-2" },
      { correct: true, kind: "bud-1-1" },
      { correct: false, kind: "bud-many" },
      { correct: false, kind: "bud-1-2" },
      { correct: true, kind: "bud-1-1" },
    ];
    var teaImageMap = {
      "bud-1-1": "assets/images/l2-bud-1-1.png",
      "bud-1-2": "assets/images/l2-bud-1-2.png",
      "bud-many": "assets/images/l2-bud-many.png",
    };
    var cells = "";
    for (var i = 0; i < cardDefs.length; i++) {
      var card = cardDefs[i];
      var src = teaImageMap[card.kind];
      var altText =
        card.kind === "bud-1-1"
          ? "一芽一叶"
          : card.kind === "bud-1-2"
          ? "一芽两叶"
          : "一芽多叶";
      cells +=
        '<button type="button" class="hb-tea-cell" data-idx="' +
        i +
        '" data-correct="' +
        (card.correct ? "1" : "0") +
        '" data-kind="' +
        card.kind +
        '">' +
        '<img class="hb-tea-sprout" src="' +
        src +
        '" alt="' +
        altText +
        '" loading="lazy" decoding="async" />' +
        "</button>";
    }
    elRight.innerHTML =
      '<div class="hb-timer" id="hb-l2-timer">剩余 10.0 秒</div><div class="hb-tea-grid">' + cells + "</div>";
    elFootnote.textContent = "点错会惊动茶山（屏幕震动）；找对三处即过关。";

    var found = 0;
    var ended = false;
    var deadline = Date.now() + 10000;

    function win() {
      if (ended) return;
      ended = true;
      window.clearInterval(timerId);
      finishLevel(2);
    }

    function loseTime() {
      if (ended) return;
      ended = true;
      window.clearInterval(timerId);
      screenShake({ silentSfx: true });
      window.setTimeout(closeHandbook, 900);
    }

    var timerId = window.setInterval(function () {
      var left = (deadline - Date.now()) / 1000;
      var el = document.getElementById("hb-l2-timer");
      if (el) el.textContent = "剩余 " + Math.max(0, left).toFixed(1) + " 秒";
      if (left <= 0) loseTime();
    }, 100);

    function onCellClick(e) {
      var btn = e.target.closest(".hb-tea-cell");
      if (!btn || ended) return;
      if (btn.classList.contains("is-picked")) return;
      var ok = btn.getAttribute("data-correct") === "1";
      if (ok) {
        btn.classList.add("is-picked");
        found++;
        if (found >= 3) win();
      } else {
        screenShake();
      }
    }

    elRight.addEventListener("click", onCellClick);

    activeDestroy = function () {
      window.clearInterval(timerId);
      elRight.removeEventListener("click", onCellClick);
    };
  }

  /* ========== 第三关 · 杀青（平衡条）==========
   * 机制：指针随时间自动右移（升温）；点击「降温」左退。
   * 判定区为轨道中央 20%（0.4–0.6）；在区内累计满 5s 过关；出区立刻清空计时。
   * 成功后 finishLevel(3) → 主流程推进 levelProgress 并 updateGrowth（等同 stage 前进与换背景）。
   */
  function mountLevel3() {
    elLeft.classList.add("hb-l1-left-page");
    elLeft.innerHTML = handbookLeftPageInnerHtml(3);
    elRight.innerHTML =
      '<div class="hb-l3-balance">' +
      '<div class="hb-l3-countdown" id="hb-l3-countdown" aria-live="polite">—</div>' +
      '<div class="hb-l3-track-wrap">' +
      '<div class="hb-l3-track" id="hb-l3-track" role="presentation">' +
      '<div class="hb-l3-zone" title="最佳摊青区"></div>' +
      '<div class="hb-l3-thumb" id="hb-l3-thumb"></div>' +
      "</div></div>" +
      '<button type="button" class="hb-l3-tap" id="hb-l3-tap">点按 · 降温</button>' +
      '<p class="hb-l3-hint" id="hb-l3-hint">指针在中央浅绿区内时开始倒数；离区即重置。</p>' +
      "</div>";
    elFootnote.textContent = "指针靠右为热，点按拉回；区内稳满 5 秒即过关。";

    var thumb = elRight.querySelector("#hb-l3-thumb");
    var countdownEl = elRight.querySelector("#hb-l3-countdown");
    var hintEl = elRight.querySelector("#hb-l3-hint");
    var tapBtn = elRight.querySelector("#hb-l3-tap");

    /** 指针中心在轨道上的归一化位置 0（左）~ 1（右） */
    var pos = 0.12;
    /** 判定区：中央 20% */
    var ZONE_LO = 0.4;
    var ZONE_HI = 0.6;
    /** 每秒自动右移量（归一化） */
    var DRIFT_PER_SEC = 0.052;
    /** 每次点击左退量 */
    var NUDGE = 0.095;
    /** 区内需累计毫秒 */
    var WIN_MS = 5000;

    var rafId = null;
    var lastTs = performance.now();
    var zoneAccumMs = 0;
    var ended = false;

    function isInJudgeZone(p) {
      return p >= ZONE_LO && p <= ZONE_HI;
    }

    function renderThumb() {
      if (!thumb) return;
      var pct = pos * 100;
      thumb.style.left = pct + "%";
    }

    function renderCountdown() {
      if (!countdownEl) return;
      if (!isInJudgeZone(pos)) {
        countdownEl.textContent = "—";
        countdownEl.classList.remove("is-active");
        return;
      }
      countdownEl.classList.add("is-active");
      var remain = Math.max(0, WIN_MS - zoneAccumMs);
      var sec = remain / 1000;
      if (remain <= 0) countdownEl.textContent = "0";
      else if (sec >= 1) countdownEl.textContent = String(Math.ceil(sec));
      else countdownEl.textContent = sec.toFixed(1);
    }

    function tick(now) {
      if (ended) return;
      var dt = Math.min(64, now - lastTs);
      lastTs = now;

      pos += DRIFT_PER_SEC * (dt / 1000);
      if (pos > 1) pos = 1;

      if (isInJudgeZone(pos)) {
        zoneAccumMs += dt;
        if (zoneAccumMs >= WIN_MS) {
          ended = true;
          if (countdownEl) countdownEl.textContent = "成";
          if (hintEl) hintEl.textContent = "草青气已匀。";
          window.cancelAnimationFrame(rafId);
          window.setTimeout(function () {
            finishLevel(3);
          }, 280);
          return;
        }
      } else {
        zoneAccumMs = 0;
      }

      renderThumb();
      renderCountdown();
      rafId = window.requestAnimationFrame(tick);
    }

    /** 点击 / 触摸：指针左退（降温），移动端用 pointerdown 避免重复触发 */
    var lastNudgeAt = 0;
    function onNudge(e) {
      if (ended) return;
      if (e && e.cancelable) e.preventDefault();
      if (e.type === "pointerdown" && typeof e.button === "number" && e.button !== 0) return;
      var t = performance.now();
      if (t - lastNudgeAt < 45) return;
      lastNudgeAt = t;
      pos -= NUDGE;
      if (pos < 0) pos = 0;
      renderThumb();
      renderCountdown();
    }

    function bindTap() {
      if (window.PointerEvent) {
        tapBtn.addEventListener("pointerdown", onNudge);
      } else {
        tapBtn.addEventListener("touchstart", onNudge, { passive: false });
        tapBtn.addEventListener("mousedown", onNudge);
      }
    }

    function unbindTap() {
      if (window.PointerEvent) {
        tapBtn.removeEventListener("pointerdown", onNudge);
      } else {
        tapBtn.removeEventListener("touchstart", onNudge);
        tapBtn.removeEventListener("mousedown", onNudge);
      }
    }

    bindTap();

    renderThumb();
    renderCountdown();
    rafId = window.requestAnimationFrame(tick);

    activeDestroy = function () {
      ended = true;
      window.cancelAnimationFrame(rafId);
      unbindTap();
    };
  }

  /* ========== 第四关 · 揉捻：按「抖 → 搭 → 捺」顺序点击，右页序列帧分段播放 ========== */
  function mountLevel4() {
    elLeft.classList.add("hb-l1-left-page");
    elLeft.innerHTML = handbookLeftPageInnerHtml(4);
    elRight.innerHTML =
      '<div class="hb-l4-video-wrap"><canvas id="hb-l4-knead-canvas" class="hb-l4-knead-canvas" aria-label="揉捻手法演示"></canvas></div>' +
      '<div class="hb-calligraphy-btns">' +
      '<button type="button" data-move="0">抖</button>' +
      '<button type="button" data-move="1">搭</button>' +
      '<button type="button" data-move="2">捺</button>' +
      "</div>";
    elFootnote.textContent = "须按抖、搭、捺依次各点一次。";

    var kneadCanvas = elRight.querySelector("#hb-l4-knead-canvas");
    var kneadCtx = kneadCanvas ? kneadCanvas.getContext("2d") : null;
    var kneadCanvasSized = false;
    var frameCache = [];
    var expect = 0;
    var seq = [0, 1, 2];
    var l4done = false;
    var isPlaying = false;
    var segmentsReady = false;
    var segmentStartFrames = [1, 1, 1];
    var segmentEndFrames = [1, 1, 1];
    var playTimer = null;
    var currentFrame = 1;

    function buildFrameSrc(frameNo) {
      var n = Math.max(1, Math.min(HB_L4_KNEAD_FRAME_COUNT, frameNo));
      var num = String(n);
      while (num.length < HB_L4_KNEAD_FRAME_PAD) num = "0" + num;
      return HB_L4_KNEAD_FRAME_DIR + num + HB_L4_KNEAD_FRAME_EXT;
    }

    function stopSegmentWatch() {
      if (playTimer) {
        window.clearInterval(playTimer);
        playTimer = null;
      }
      isPlaying = false;
    }

    function drawFrame(frameNo) {
      if (!kneadCanvas || !kneadCtx) return;
      currentFrame = Math.max(1, Math.min(HB_L4_KNEAD_FRAME_COUNT, frameNo));
      var im = frameCache[currentFrame - 1];
      if (!im || !im.complete || !im.naturalWidth) return;
      if (!kneadCanvasSized) {
        kneadCanvas.width = im.naturalWidth;
        kneadCanvas.height = im.naturalHeight;
        kneadCanvasSized = true;
      }
      var cw = kneadCanvas.width;
      var ch = kneadCanvas.height;
      kneadCtx.fillStyle = "#c5d4c0";
      kneadCtx.fillRect(0, 0, cw, ch);
      kneadCtx.drawImage(im, 0, 0, cw, ch);
    }

    function resetToFirstFrame() {
      stopSegmentWatch();
      drawFrame(1);
    }

    function buildSegments() {
      var total = HB_L4_KNEAD_FRAME_COUNT;
      var ends = HB_L4_KNEAD_SEGMENT_END_FRAMES;
      if (ends && ends.length >= 3) {
        segmentEndFrames[0] = Math.max(1, Math.min(total, Math.round(Number(ends[0]))));
        segmentEndFrames[1] = Math.max(1, Math.min(total, Math.round(Number(ends[1]))));
        segmentEndFrames[2] = ends[2] == null ? total : Math.max(1, Math.min(total, Math.round(Number(ends[2]))));
      } else {
        segmentEndFrames[0] = Math.ceil(total / 3);
        segmentEndFrames[1] = Math.ceil((total * 2) / 3);
        segmentEndFrames[2] = total;
      }
      segmentStartFrames[0] = 1;
      segmentStartFrames[1] = segmentEndFrames[0] + 1;
      segmentStartFrames[2] = segmentEndFrames[1] + 1;
      segmentsReady = true;
      resetToFirstFrame();
    }

    function playSegment(segIndex) {
      if (!kneadCanvas || !segmentsReady || l4done) return;
      stopSegmentWatch();
      isPlaying = true;
      var endFrame = segmentEndFrames[segIndex];
      drawFrame(segmentStartFrames[segIndex]);
      playTimer = window.setInterval(function () {
        if (currentFrame >= endFrame) {
          stopSegmentWatch();
          drawFrame(endFrame);
          if (segIndex >= 2) {
            l4done = true;
            window.setTimeout(function () {
              finishLevel(4);
            }, 450);
          }
          return;
        }
        drawFrame(currentFrame + 1);
      }, HB_L4_KNEAD_FRAME_MS);
    }

    function onBtn(e) {
      if (l4done) return;
      var b = e.target.closest("button[data-move]");
      if (!b) return;
      var m = parseInt(b.getAttribute("data-move"), 10);
      if (m !== seq[expect]) {
        expect = 0;
        resetToFirstFrame();
        screenShake();
        return;
      }
      if (isPlaying) return;
      playSegment(expect);
      expect++;
    }

    function preloadFrames() {
      var i;
      for (i = 1; i <= HB_L4_KNEAD_FRAME_COUNT; i++) {
        (function (frameNo) {
          var im = new Image();
          im.decoding = "sync";
          im.onload = function () {
            if (typeof im.decode === "function") {
              im.decode().then(function () {
                if (frameNo === 1) buildSegments();
                else if (frameNo === currentFrame) drawFrame(frameNo);
              }).catch(function () {
                if (frameNo === 1) buildSegments();
              });
            } else if (frameNo === 1) {
              buildSegments();
            }
          };
          im.onerror = function () {
            if (frameNo === 1) {
              segmentsReady = false;
              var wrap = elRight.querySelector(".hb-l4-video-wrap");
              if (wrap) {
                wrap.innerHTML =
                  '<p class="hb-l4-video-fallback">请将揉捻序列帧放在<br><code>assets/images/hb-l4-kneading/001.png</code> … <code>026.png</code></p>';
              }
            }
          };
          im.src = buildFrameSrc(frameNo);
          frameCache[frameNo - 1] = im;
        })(i);
      }
    }

    preloadFrames();

    elRight.addEventListener("click", onBtn);

    activeDestroy = function () {
      elRight.removeEventListener("click", onBtn);
      stopSegmentWatch();
      frameCache = [];
      kneadCanvasSized = false;
    };
  }

  /* ========== 第五关 · 炒制：沿中线快速左右滑动 10 个来回，茶叶转糙米绿 ========== */
  function mountLevel5() {
    elLeft.classList.add("hb-l1-left-page");
    elLeft.innerHTML = handbookLeftPageInnerHtml(5);
    elRight.innerHTML =
      '<div class="hb-swipe-track" id="hb-l5-track">' +
      '<div class="hb-swipe-line"></div>' +
      '<div class="hb-swipe-leaf" id="hb-l5-leaf"></div>' +
      "</div>" +
      '<p class="hb-swipe-count" id="hb-l5-count">来回：0 / 10</p>' +
      '<div class="hb-l5-pan-seq-wrap" aria-hidden="true">' +
      '<canvas id="hb-l5-pan-seq" class="hb-l5-pan-seq" width="1000" height="1000"></canvas>' +
      "</div>";
    elFootnote.textContent = "在轨道内拖动，从左缘到右缘再回左算一次来回。";

    var track = elRight.querySelector("#hb-l5-track");
    var leaf = elRight.querySelector("#hb-l5-leaf");
    var countEl = elRight.querySelector("#hb-l5-count");
    var panSeqCanvas = elRight.querySelector("#hb-l5-pan-seq");
    var panSeqCtx = panSeqCanvas ? panSeqCanvas.getContext("2d") : null;
    var PAN_FRAME_COUNT = 50;
    var PAN_FRAME_PREFIX = "assets/images/hb-l5-pan/";
    var PAN_FRAME_EXT = ".png";
    var PAN_FRAME_PAD = 3;
    var currentPanFrame = 1;
    var panFrameImgList = [];
    var panCanvasSizedByFrame = false;
    /** 半次行程计数：左→右、右→左各计 1，满 20 即 10 个来回 */
    var strokeCount = 0;
    var armedForRight = true;
    var armedForLeft = false;
    var targetStrokes = 20;
    var dragging = false;
    var finished = false;
    var lastXPercent = 50;

    function buildPanFrameSrc(frameNo) {
      var n = Math.max(1, Math.min(PAN_FRAME_COUNT, frameNo));
      var num = String(n);
      while (num.length < PAN_FRAME_PAD) num = "0" + num;
      return PAN_FRAME_PREFIX + num + PAN_FRAME_EXT;
    }

    function preloadPanFrames() {
      for (var i = 1; i <= PAN_FRAME_COUNT; i++) {
        var src = buildPanFrameSrc(i);
        var im = new Image();
        (function (frameNo, imageEl) {
          imageEl.onload = function () {
            if (!panCanvasSizedByFrame && panSeqCanvas && imageEl.naturalWidth > 0 && imageEl.naturalHeight > 0) {
              panSeqCanvas.width = imageEl.naturalWidth;
              panSeqCanvas.height = imageEl.naturalHeight;
              panCanvasSizedByFrame = true;
            }
            if (frameNo === currentPanFrame) drawPanFrame(frameNo);
          };
        })(i, im);
        im.decoding = "async";
        im.src = src;
        panFrameImgList.push(im);
      }
    }

    function drawPanFrame(frameNo) {
      if (!panSeqCanvas || !panSeqCtx) return;
      var idx = Math.max(1, Math.min(PAN_FRAME_COUNT, frameNo)) - 1;
      var frameImg = panFrameImgList[idx];
      if (!frameImg || !frameImg.complete) return;
      var cw = panSeqCanvas.width;
      var ch = panSeqCanvas.height;
      panSeqCtx.clearRect(0, 0, cw, ch);
      var iw = frameImg.naturalWidth || cw;
      var ih = frameImg.naturalHeight || ch;
      var scale = Math.min(cw / iw, ch / ih);
      var dw = iw * scale;
      var dh = ih * scale;
      var dx = (cw - dw) / 2;
      var dy = (ch - dh) / 2;
      panSeqCtx.drawImage(frameImg, dx, dy, dw, dh);
    }

    function updatePanFrameByX(xPercent) {
      if (!panSeqCanvas) return;
      var t = (xPercent - 6) / 88;
      t = Math.max(0, Math.min(1, t));
      var frameNo = Math.round(t * (PAN_FRAME_COUNT - 1)) + 1;
      if (frameNo === currentPanFrame) return;
      currentPanFrame = frameNo;
      drawPanFrame(frameNo);
    }

    preloadPanFrames();
    drawPanFrame(1);

    function setLeafX(clientX) {
      if (finished) return;
      var rect = track.getBoundingClientRect();
      var x = ((clientX - rect.left) / rect.width) * 100;
      x = Math.max(6, Math.min(94, x));
      if (leaf) leaf.style.left = x + "%";
      var t = strokeCount / targetStrokes;
      var r = Math.round(245 - t * 75);
      var g = Math.round(242 - t * 90);
      var b = Math.round(235 - t * 55);
      if (leaf) leaf.style.background = "rgb(" + r + "," + g + "," + b + ")";

      /* 判别逻辑：仅在经过边界时计次，避免在端点停留重复累计 */
      var crossRight = lastXPercent <= 82 && x > 82;
      var crossLeft = lastXPercent >= 18 && x < 18;
      lastXPercent = x;
      updatePanFrameByX(x);
      if (crossRight && armedForRight) {
        strokeCount++;
        armedForRight = false;
        armedForLeft = true;
      } else if (crossLeft && armedForLeft) {
        strokeCount++;
        armedForLeft = false;
        armedForRight = true;
      }

      var rounds = Math.floor(strokeCount / 2);
      if (countEl) countEl.textContent = "来回：" + rounds + " / 10";
      if (strokeCount >= targetStrokes) {
        finished = true;
        dragging = false;
        finishLevel(5);
      }
    }

    function onDown(e) {
      dragging = true;
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      setLeafX(cx);
    }

    function onMove(e) {
      if (!dragging) return;
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      setLeafX(cx);
    }

    function onUp() {
      dragging = false;
    }

    track.addEventListener("mousedown", onDown);
    track.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    track.addEventListener("touchstart", onDown, { passive: true });
    track.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);

    activeDestroy = function () {
      dragging = false;
      track.removeEventListener("mousedown", onDown);
      track.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      track.removeEventListener("touchstart", onDown);
      track.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }

  /* ========== 手账终页：爷爷的终信（五关完成后打开手账） ========== */
  function mountGrandpaEpilogue() {
    elLeft.innerHTML =
      '<div class="hb-epilogue-left">' +
      '<div class="hb-epilogue-silhouette" aria-hidden="true">' +
      '<img class="hb-epilogue-img" src="' +
      HB_EPILOGUE_IMG +
      '" alt="" loading="lazy" decoding="async" />' +
      "</div>" +
      "<p class=\"hb-epilogue-caption\">爷爷的背影·茶山</p></div>";
    elRight.innerHTML =
      '<div class="hb-epilogue-right">' +
      "<p class=\"hb-epilogue-quote\">孩子，茶要经风霜、历火焙才能成香。人也一样。累了就坐下来，喝杯茶。这杯茶里，有山，有云，有我，也有一直没忘根的你。</p>" +
      "</div>";
    elFootnote.textContent = "终页缓展 · 爷爷的留笔";
    var shell = elModal ? elModal.querySelector(".handbook-shell") : null;
    if (shell) {
      shell.classList.remove("hb-shell-epilogue");
      void shell.offsetWidth;
      shell.classList.add("hb-shell-epilogue");
    }
    activeDestroy = function () {
      stopEpilogueNarration();
      if (shell) shell.classList.remove("hb-shell-epilogue");
    };
    playEpilogueNarration();
  }

  function mountLevel(n) {
    destroyLevel();
    elLeft.classList.remove("hb-l1-left-page");
    elLeft.innerHTML = "";
    elRight.innerHTML = "";
    elFootnote.textContent = "";
    var shell = elModal ? elModal.querySelector(".handbook-shell") : null;
    if (shell) shell.classList.remove("hb-shell-epilogue");
    switch (n) {
      case 1:
        mountLevel1();
        break;
      case 2:
        mountLevel2();
        break;
      case 3:
        mountLevel3();
        break;
      case 4:
        mountLevel4();
        break;
      case 5:
        mountLevel5();
        break;
      default:
        elLeft.textContent = "未知关卡";
        elRight.textContent = "";
    }
  }

  if (btnClose) btnClose.addEventListener("click", closeHandbook);
  if (elBackdrop) elBackdrop.addEventListener("click", closeHandbook);
  /*
   * 古籍 RTL：左下 handbook-nav-prev (‹) → 往后翻篇（给当前 leaf 加 .flipped）= tryGoNext；
   * 右下 handbook-nav-next (›) → 往回翻（移除 leaf .flipped）= tryGoPrev。
   */
  if (btnNavPrev) {
    btnNavPrev.addEventListener("click", function (ev) {
      console.log(
        "[handbook] 左下 ‹ 点击 → tryGoNext | target:",
        ev.target,
        "| currentTarget:",
        ev.currentTarget
      );
      tryGoNext();
    });
  }
  if (btnNavNext) {
    btnNavNext.addEventListener("click", function (ev) {
      console.log(
        "[handbook] 右下 › 点击 → tryGoPrev | target:",
        ev.target,
        "| currentTarget:",
        ev.currentTarget
      );
      tryGoPrev();
    });
  }

  window.Handbook = {
    open: openHandbook,
    close: closeHandbook,
  };

  /* 第一关过关：右页场景图设色（原 SVG 路径已改为位图） */
  var style = document.createElement("style");
  style.textContent =
    ".hb-l1-scene.hb-l1-colored .hb-l1-scene-img{filter:saturate(1.14) hue-rotate(-8deg) brightness(1.06) contrast(1.02)}" +
    ".hb-l1-scene.hb-l1-colored::after{content:'';position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:linear-gradient(165deg,rgba(118,158,108,0.22),rgba(130,188,198,0.28))}";
  document.head.appendChild(style);
})();
