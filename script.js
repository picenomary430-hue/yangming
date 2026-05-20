(function () {
  "use strict";

  /** 手机竖屏：显示横屏引导并隐藏游戏区（网页无法在所有浏览器强制物理横屏） */
  var orientationLockEl = document.getElementById("orientation-lock");
  var portraitMobileMq = window.matchMedia("(orientation: portrait) and (max-width: 1024px)");
  var landscapeLockAttempted = false;

  function isTouchMobile() {
    return (
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: none) and (pointer: coarse)").matches) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      "ontouchstart" in window
    );
  }

  function shouldPortraitLock() {
    return portraitMobileMq.matches && isTouchMobile();
  }

  function syncPortraitLock() {
    var locked = shouldPortraitLock();
    document.documentElement.classList.toggle("is-portrait-locked", locked);
    if (orientationLockEl) {
      orientationLockEl.classList.toggle("is-visible", locked);
      orientationLockEl.hidden = !locked;
    }
  }

  function tryLockLandscape() {
    if (landscapeLockAttempted) return;
    landscapeLockAttempted = true;
    var orientation = screen.orientation;
    if (!orientation || typeof orientation.lock !== "function") return;
    orientation.lock("landscape").catch(function () {
      /* 多数浏览器需全屏或用户手势，失败则忽略 */
    });
  }

  if (typeof portraitMobileMq.addEventListener === "function") {
    portraitMobileMq.addEventListener("change", syncPortraitLock);
  } else if (typeof portraitMobileMq.addListener === "function") {
    portraitMobileMq.addListener(syncPortraitLock);
  }
  window.addEventListener("resize", syncPortraitLock);
  window.addEventListener("orientationchange", syncPortraitLock);
  document.addEventListener(
    "pointerdown",
    function onFirstPointerForLandscape() {
      tryLockLandscape();
      document.removeEventListener("pointerdown", onFirstPointerForLandscape);
    },
    { passive: true, capture: true }
  );
  syncPortraitLock();

  var STORAGE_KEY = "yangming_chunxin_v1";
  var GUARDIAN_SEQ_KEY = "yangming_guardian_seq_v1";
  var BG_CROSSFADE_MS = 2000;

  var GRANDPA_QUOTES = [
    "采茶莫贪大，一芽一叶是宝。",
    "杀青火候差一分，香气便薄一层。",
    "手不离茶，心不离山；非遗不在书上，在手上。",
    "春茶苦，夏茶涩，要好喝，秋白露。",
    "茶青摊得匀，清香才入魂。",
    "揉捻轻重看叶脉，爷爷当年练了十年。",
    "龙井四绝：色绿、香郁、味甘、形美，缺一不算懂。",
    "雨天不采，露水叶不炒，这是规矩。",
    "炭火微红，锅温有度，急不得。",
    "认养一垄茶，便是认养一段节气。",
  ];

  var GRANDPA_DIALOG_DEFAULT = "春山静候。修好手账，茶树自有回应。";

  /** 底部对话气泡 · 爷爷寄语轮播（龙井茶知识库） */
  var grandpaMessages = [
    "孩子，龙井茶讲究「色绿、香郁、味甘、形美」，这四绝缺一不可。",
    "清明前采摘的叫「明前茶」，受了春寒的芽头最是鲜嫩。",
    "炒茶讲究十大手法：抖、搭、捺、跺、扣、甩、磨、挺、压、推。",
    "真正的老茶树，叶片摸起来像绸缎一样，厚实且温润。",
    "泡龙井要用85度的水，水温太高会烫伤嫩叶，茶汤就苦了。",
    "真正的龙井芽头肥壮，形似雀舌，这才是上品。",
    "泡龙井要用玻璃杯，看那茶叶在水中起伏，就像西湖的浪在翻涌。",
    "好茶也要好水配，虎跑梦泉的水配上龙井，才是西湖的双绝。",
    "看这茶干，色泽翠绿略带糙米黄，这才是地道的龙井本色。",
    "闻干茶香，要有淡淡的豆香或板栗香，那是火功到位的证明。",
    "人这一辈子也像这片叶子，要经得起揉捻，受得了火焙，才能出清香。",
  ];

  var WEATHER_FETCH_MS = 10 * 60 * 1000;
  var OPEN_WEATHER_API_KEY =
    typeof window !== "undefined" && window.OPEN_WEATHER_API_KEY
      ? String(window.OPEN_WEATHER_API_KEY)
      : "";

  /** 快递开盒序列帧：parcel-open/001.png … 三位序号；总帧数、帧率、扩展名按你的素材改 */
  var PARCEL_FRAME_DIR = "assets/images/parcel-open/";
  var PARCEL_FRAME_EXT = ".png";
  var PARCEL_FRAME_COUNT = 48;
  /** 横向拖动映射到帧：数值越大同一段滑动跨越多帧（越灵敏） */
  var PARCEL_SCRUB_WIDTH_FRAC = 0.48;

  function defaultState() {
    return {
      playerName: "",
      growth: 0,
      levelProgress: 0,
      introSeen: false,
      teaTreeId: "",
      guardianRank: 0,
      contractParcelOpened: false,
      contractLetterDismissed: false,
      certificateAutoShown: false,
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return defaultState();
      var base = defaultState();
      if (typeof parsed.playerName === "string") base.playerName = parsed.playerName;
      if (typeof parsed.growth === "number" && !isNaN(parsed.growth))
        base.growth = Math.max(0, Math.min(100, Math.round(parsed.growth)));
      if (typeof parsed.levelProgress === "number" && !isNaN(parsed.levelProgress))
        base.levelProgress = Math.min(5, Math.max(0, Math.round(parsed.levelProgress)));
      if (typeof parsed.introSeen === "boolean") base.introSeen = parsed.introSeen;
      else if (parsed.playerName) base.introSeen = true;
      if (typeof parsed.teaTreeId === "string") base.teaTreeId = parsed.teaTreeId;
      if (typeof parsed.guardianRank === "number" && !isNaN(parsed.guardianRank))
        base.guardianRank = Math.max(0, Math.round(parsed.guardianRank));
      if (typeof parsed.contractParcelOpened === "boolean")
        base.contractParcelOpened = parsed.contractParcelOpened;
      if (typeof parsed.contractLetterDismissed === "boolean")
        base.contractLetterDismissed = parsed.contractLetterDismissed;
      if (typeof parsed.certificateAutoShown === "boolean")
        base.certificateAutoShown = parsed.certificateAutoShown;
      else if (base.growth >= 100 && base.levelProgress >= 5) base.certificateAutoShown = true;
      else base.certificateAutoShown = false;
      return base;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* quota or private mode */
    }
  }

  function showEl(el) {
    if (!el) return;
    el.classList.remove("hidden");
    el.removeAttribute("hidden");
  }

  function hideEl(el) {
    if (!el) return;
    el.classList.add("hidden");
    el.setAttribute("hidden", "");
  }

  var gameState = loadState();

  var elContract = document.getElementById("scene-contract");
  var elMain = document.getElementById("scene-main");
  var elMainScene = document.getElementById("main-scene");
  var elInk = document.getElementById("ink-transition");
  var inputName = document.getElementById("player-name");
  var btnSeal = document.getElementById("btn-seal");
  var displayName = document.getElementById("display-name");
  var elGuardianName = document.getElementById("guardian-name");
  var elStageLabel = document.getElementById("stage-label");
  var elGrowthDisplay = document.getElementById("growth-display");
  var elGrandpa = document.getElementById("grandpa-mutter");
  var elDialogText = document.getElementById("dialog-text");
  var elEnvTime = document.getElementById("env-time");
  var elEnvWeather = document.getElementById("env-weather");
  var elEnvHumidity = document.getElementById("env-humidity");
  var elRainEffect = document.getElementById("rain-effect");
  var rainCanvas = document.getElementById("rain-canvas");
  var weatherDebugSelect = document.getElementById("weather-debug-select");
  var elBgStack = document.getElementById("main-bg-stack");
  var elBgs = document.querySelectorAll(".main-bg");
  var stage1BgVideo = document.getElementById("stage1-bg-video");
  var stage2BgVideo = document.getElementById("stage2-bg-video");
  var stage3BgVideo = document.getElementById("stage3-bg-video");
  var stage4BgVideo = document.getElementById("stage4-bg-video");
  var stage5BgVideo = document.getElementById("stage5-bg-video");
  var elVictoryBanner = document.getElementById("victory-banner");
  var btnNotebook = document.getElementById("btn-notebook");
  var mainSceneBgmAudio = document.getElementById("main-scene-bgm-audio");
  var elIntro = document.getElementById("scene-intro");
  var introVideo = document.getElementById("intro-video");
  var introCta = document.getElementById("intro-cta");
  var introStartOverlay = document.getElementById("intro-start-overlay");
  var btnEnterMountain = document.getElementById("btn-enter-mountain");
  var btnStartGame = document.getElementById("btn-start-game");
  var growthCutsceneEl = document.getElementById("growth-cutscene");
  var growthCutsceneVideo = document.getElementById("growth-cutscene-video");
  var elCertModal = document.getElementById("certificate-modal");
  var certBackdrop = document.getElementById("certificate-backdrop");
  var certTeaImg = document.getElementById("cert-tea-img");
  var certGuardianRankEl = document.getElementById("cert-guardian-rank");
  var certTeaIdEl = document.getElementById("cert-tea-id");
  var btnCertExit = document.getElementById("btn-cert-exit");
  var btnCertRestart = document.getElementById("btn-cert-restart");
  var btnOpenArchives = document.getElementById("btn-open-archives");
  var contractLetterScreen = document.getElementById("contract-letter-screen");
  var contractDocScreen = document.getElementById("contract-doc-screen");
  var contractLetterNarrationAudio = document.getElementById("contract-letter-narration-audio");
  var contractParcelScreen = document.getElementById("contract-parcel-screen");
  var contractParcelCanvas = document.getElementById("contract-parcel-canvas");
  var contractParcelHintAudio = document.getElementById("contract-parcel-hint-audio");

  var parcelScrubFrame = 1;
  var parcelScrubbing = false;
  var parcelScrubPointerId = null;
  var parcelScrubGestureStartX = 0;
  var parcelScrubGestureStartY = 0;
  var parcelScrubAnchorFrame = 1;
  var parcelLoadStarted = false;
  var parcelFrameImages = null;

  /** 爷爷的信旁白播完前不可进入认养协议书；loop 关闭，仅播一遍 */
  var contractLetterNarrationAllowDismiss = true;

  var envTimer = null;
  var weatherTimer = null;
  var grandpaTimer = null;
  var grandpaHideTimer = null;
  var dialogRotateTimer = null;
  var dialogRotateDelayTimer = null;
  var dialogTypeTimer = null;
  var dialogAnimBusy = false;
  var lastGrandpaMessageIndex = -1;
  var mainHooksStarted = false;

  var DIALOG_FADE_MS = 320;
  var DIALOG_TYPE_MS = 480;
  var DIALOG_INITIAL_HOLD_MS = 5000;

  var displayedBgIndex = null;
  var bgCrossfading = false;
  /** 生长剧变时尚未执行的最终背景档（0–4） */
  var pendingFinalBgIndex = null;
  /** 依次淡入的每一档目标，例如 0→50 时为 [1,2] */
  var bgStepQueue = [];
  var crossfadeEndTimer = null;
  var introOverlayDismissTimer = null;
  var introFromUserGestureBegun = false;
  var stageBgAudioUnlocked = false;
  var currentWeather = "晴";
  var debugWeatherOverride = "auto";
  var rainRafId = 0;
  var rainDrops = [];
  var rainSplashes = [];
  var rainCtx = null;
  var rainFramePrev = 0;
  var rainDropTargetCount = 90;
  var rainWindX = -70;

  function nextGuardianSerial() {
    var n = parseInt(localStorage.getItem(GUARDIAN_SEQ_KEY), 10);
    if (isNaN(n)) n = 32;
    localStorage.setItem(GUARDIAN_SEQ_KEY, String(n + 1));
    return n;
  }

  /** 生成并持久化茶树编号、守护人序号（首次进入认养流程时） */
  function ensureContractMeta() {
    var changed = false;
    if (!gameState.teaTreeId) {
      var y = new Date().getFullYear();
      var suf = String(Math.floor(1000 + Math.random() * 9000));
      gameState.teaTreeId = "茶07-" + y + "-" + suf;
      changed = true;
    }
    if (!gameState.guardianRank) {
      gameState.guardianRank = nextGuardianSerial();
      changed = true;
    }
    if (changed) saveState(gameState);
    var cid = document.getElementById("contract-tea-id");
    if (cid) cid.textContent = gameState.teaTreeId;
    if (certTeaIdEl) certTeaIdEl.textContent = gameState.teaTreeId;
    if (certGuardianRankEl) certGuardianRankEl.textContent = String(gameState.guardianRank);
  }

  function parcelFrameUrl(index) {
    var n = String(index);
    while (n.length < 3) n = "0" + n;
    return PARCEL_FRAME_DIR + n + PARCEL_FRAME_EXT;
  }

  /** 滑动起点须在画面中央带内，避免与边缘系统手势冲突 */
  function parcelPointerInCenterBand(clientX, clientY) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    return (
      clientX >= vw * 0.14 &&
      clientX <= vw * 0.86 &&
      clientY >= vh * 0.22 &&
      clientY <= vh * 0.78
    );
  }

  function isParcelScreenActive() {
    return (
      contractParcelScreen &&
      !contractParcelScreen.classList.contains("hidden") &&
      !gameState.contractParcelOpened &&
      !gameState.contractLetterDismissed
    );
  }

  function parcelScrubPixelsPerFrame() {
    var vw = window.innerWidth || 400;
    return Math.max(10, (vw * PARCEL_SCRUB_WIDTH_FRAC) / Math.max(1, PARCEL_FRAME_COUNT - 1));
  }

  function ensureParcelFrameImagesLoading() {
    if (parcelLoadStarted) return;
    parcelLoadStarted = true;
    parcelFrameImages = new Array(PARCEL_FRAME_COUNT);
    var first = new Image();
    first.decoding = "async";
    first.onload = function () {
      parcelFrameImages[0] = first;
      if (isParcelScreenActive()) tryDrawParcelScrubFrame();
      loadParcelRemainingFrames(2);
    };
    first.onerror = function () {
      parcelFrameImages[0] = first;
      loadParcelRemainingFrames(2);
    };
    first.src = parcelFrameUrl(1);
  }

  function loadParcelRemainingFrames(fromIndex) {
    var i;
    for (i = fromIndex; i <= PARCEL_FRAME_COUNT; i++) {
      var img = new Image();
      img.decoding = "async";
      img.src = parcelFrameUrl(i);
      parcelFrameImages[i - 1] = img;
    }
  }

  function maybePreloadParcelFrames() {
    ensureParcelFrameImagesLoading();
  }

  function tryDrawParcelScrubFrame() {
    if (!contractParcelCanvas || !parcelFrameImages) return;
    drawParcelFrameToCanvas(parcelScrubFrame);
  }

  function applyParcelScrubClientX(clientX) {
    var step = parcelScrubPixelsPerFrame();
    var n = Math.round(parcelScrubAnchorFrame + (clientX - parcelScrubGestureStartX) / step);
    if (n < 1) n = 1;
    if (n > PARCEL_FRAME_COUNT) n = PARCEL_FRAME_COUNT;
    if (n !== parcelScrubFrame) {
      parcelScrubFrame = n;
      tryDrawParcelScrubFrame();
    }
  }

  function drawParcelFrameToCanvas(frameIndex1) {
    var canvas = contractParcelCanvas;
    if (!canvas || !parcelFrameImages) return;
    var img = parcelFrameImages[frameIndex1 - 1];
    if (!img || !img.complete || !img.naturalWidth) return;
    var dpr = window.devicePixelRatio || 1;
    var cw = canvas.clientWidth | 0;
    var ch = canvas.clientHeight | 0;
    if (cw < 4 || ch < 4) return;
    var rw = Math.max(1, Math.floor(cw * dpr));
    var rh = Math.max(1, Math.floor(ch * dpr));
    if (canvas.width !== rw || canvas.height !== rh) {
      canvas.width = rw;
      canvas.height = rh;
    }
    var ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality !== undefined) ctx.imageSmoothingQuality = "high";
    var nw = img.naturalWidth;
    var nh = img.naturalHeight;
    var scale = Math.max(rw / nw, rh / nh);
    var dw = nw * scale;
    var dh = nh * scale;
    var dx = (rw - dw) * 0.5;
    var dy = (rh - dh) * 0.5;
    ctx.fillStyle = "#0c100e";
    ctx.fillRect(0, 0, rw, rh);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function setParcelFirstFrame() {
    parcelScrubFrame = 1;
    tryDrawParcelScrubFrame();
  }

  function stopContractLetterNarration() {
    if (!contractLetterNarrationAudio) return;
    if (contractLetterNarrationAudio._narrationDone) {
      contractLetterNarrationAudio.removeEventListener("ended", contractLetterNarrationAudio._narrationDone);
      contractLetterNarrationAudio.removeEventListener("error", contractLetterNarrationAudio._narrationDone);
      contractLetterNarrationAudio._narrationDone = null;
    }
    contractLetterNarrationAudio.pause();
    contractLetterNarrationAudio.currentTime = 0;
  }

  function updateContractLetterTapHint() {
    var hint = contractLetterScreen ? contractLetterScreen.querySelector(".contract-tap-hint") : null;
    if (!hint) return;
    hint.textContent = contractLetterNarrationAllowDismiss
      ? "点击任意处展信"
      : "旁白播放结束后可点击进入下一阶段";
  }

  function releaseContractLetterNarrationWait() {
    contractLetterNarrationAllowDismiss = true;
    if (contractLetterNarrationAudio && contractLetterNarrationAudio._narrationDone) {
      contractLetterNarrationAudio.removeEventListener("ended", contractLetterNarrationAudio._narrationDone);
      contractLetterNarrationAudio.removeEventListener("error", contractLetterNarrationAudio._narrationDone);
      contractLetterNarrationAudio._narrationDone = null;
    }
    if (contractLetterScreen) {
      contractLetterScreen.classList.remove("contract-letter-screen--narration-wait");
      contractLetterScreen.removeAttribute("aria-disabled");
      contractLetterScreen.setAttribute("aria-label", "展信");
    }
    updateContractLetterTapHint();
  }

  function playContractLetterReveal() {
    if (!contractLetterScreen) return;
    contractLetterScreen.classList.remove("is-letter-revealed");
    var stage = contractLetterScreen.querySelector(".contract-letter-flip-stage");
    if (stage) {
      stage.classList.remove("is-letter-revealed");
      void stage.offsetWidth;
    } else {
      void contractLetterScreen.offsetWidth;
    }
    contractLetterScreen.classList.add("is-letter-revealed");
    if (stage) stage.classList.add("is-letter-revealed");
  }

  function showContractLetterScreen() {
    if (!contractLetterScreen) return;
    showEl(contractLetterScreen);
    playContractLetterReveal();
    beginContractLetterNarration();
  }

  function beginContractLetterNarration() {
    if (!contractLetterScreen || contractLetterScreen.classList.contains("hidden")) return;
    if (gameState.contractLetterDismissed) return;
    stopContractLetterNarration();
    contractLetterNarrationAllowDismiss = false;
    contractLetterScreen.classList.add("contract-letter-screen--narration-wait");
    contractLetterScreen.setAttribute("aria-disabled", "true");
    contractLetterScreen.setAttribute("aria-label", "聆听爷爷旁白，结束后可展信");
    updateContractLetterTapHint();
    if (!contractLetterNarrationAudio) {
      releaseContractLetterNarrationWait();
      return;
    }
    contractLetterNarrationAudio.loop = false;
    function onNarrationDone() {
      releaseContractLetterNarrationWait();
    }
    contractLetterNarrationAudio._narrationDone = onNarrationDone;
    contractLetterNarrationAudio.addEventListener("ended", onNarrationDone);
    contractLetterNarrationAudio.addEventListener("error", onNarrationDone);
    contractLetterNarrationAudio.currentTime = 0;
    var playPromise = contractLetterNarrationAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () {
        onNarrationDone();
      });
    }
  }

  function stopContractParcelHint() {
    if (!contractParcelHintAudio) return;
    try {
      contractParcelHintAudio.pause();
      contractParcelHintAudio.currentTime = 0;
    } catch (e) {}
  }

  /** 进入认养开盒界面时播放提示音（不循环，播完即停） */
  function playContractParcelHint() {
    if (!contractParcelHintAudio) return;
    try {
      contractParcelHintAudio.loop = false;
      contractParcelHintAudio.pause();
      contractParcelHintAudio.currentTime = 0;
      if (typeof contractParcelHintAudio.volume === "number") {
        contractParcelHintAudio.volume = 1;
      }
      var p = contractParcelHintAudio.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {});
      }
    } catch (e) {}
  }

  function finishParcelOpen() {
    stopContractParcelHint();
    parcelScrubbing = false;
    if (contractParcelScreen && parcelScrubPointerId !== null) {
      try {
        contractParcelScreen.releasePointerCapture(parcelScrubPointerId);
      } catch (e2) {}
    }
    parcelScrubPointerId = null;
    if (contractParcelScreen) contractParcelScreen.classList.remove("contract-parcel-screen--scrubbing");
    gameState.contractParcelOpened = true;
    saveState(gameState);
    if (contractParcelScreen) hideEl(contractParcelScreen);
    showContractLetterScreen();
  }

  function applyContractUiState() {
    ensureContractMeta();
    if (gameState.contractLetterDismissed) {
      if (contractParcelScreen) hideEl(contractParcelScreen);
      stopContractParcelHint();
      hideEl(contractLetterScreen);
      stopContractLetterNarration();
      releaseContractLetterNarrationWait();
      showContractDocScreen();
      return;
    }
    hideEl(contractDocScreen);
    if (gameState.contractParcelOpened) {
      if (contractParcelScreen) hideEl(contractParcelScreen);
      stopContractParcelHint();
      showContractLetterScreen();
    } else {
      hideEl(contractLetterScreen);
      stopContractLetterNarration();
      if (contractParcelScreen) {
        parcelScrubbing = false;
        if (parcelScrubPointerId !== null) {
          try {
            contractParcelScreen.releasePointerCapture(parcelScrubPointerId);
          } catch (e3) {}
          parcelScrubPointerId = null;
        }
        contractParcelScreen.classList.remove("contract-parcel-screen--scrubbing");
        contractParcelScreen.classList.remove("contract-parcel-screen--playing");
        parcelScrubFrame = 1;
        showEl(contractParcelScreen);
        playContractParcelHint();
        maybePreloadParcelFrames();
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(setParcelFirstFrame);
        });
      } else {
        showContractLetterScreen();
      }
    }
  }

  var CONTRACT_DOC_HANDWRITE_MS = 48;
  var contractDocInnerHtmlTemplate = null;

  function getContractDocInner() {
    return contractDocScreen ? contractDocScreen.querySelector(".contract-doc-inner") : null;
  }

  function cacheContractDocInnerTemplate() {
    var inner = getContractDocInner();
    if (inner && contractDocInnerHtmlTemplate === null) {
      contractDocInnerHtmlTemplate = inner.innerHTML;
    }
  }

  function restoreContractDocInner() {
    var inner = getContractDocInner();
    if (!inner || contractDocInnerHtmlTemplate === null) return;
    inner.innerHTML = contractDocInnerHtmlTemplate;
    inner.classList.remove("is-handwriting-active", "is-handwriting-done");
    inner.removeAttribute("data-handwrite-ready");
    ensureContractMeta();
    refreshContractDocControls();
  }

  function wrapHandwriteElement(el) {
    if (!el || el.dataset.handwriteWrapped === "1") return 0;
    var text = el.textContent;
    if (!text) return 0;
    el.textContent = "";
    el.dataset.handwriteWrapped = "1";
    var count = 0;
    Array.from(text).forEach(function (ch) {
      var span = document.createElement("span");
      span.className = "contract-doc-char";
      if (/\s/.test(ch)) span.classList.add("is-space");
      span.textContent = ch;
      el.appendChild(span);
      count += 1;
    });
    return count;
  }

  function prepareContractDocHandwriting(inner) {
    var total = 0;
    total += wrapHandwriteElement(inner.querySelector(".contract-doc-title"));
    total += wrapHandwriteElement(inner.querySelector(".contract-plan-tag"));
    inner.querySelectorAll(".contract-meta-row dt").forEach(function (el) {
      total += wrapHandwriteElement(el);
    });
    inner.querySelectorAll(".contract-meta-row dd").forEach(function (el) {
      total += wrapHandwriteElement(el);
    });
    total += wrapHandwriteElement(inner.querySelector(".contract-doc-body"));
    total += wrapHandwriteElement(inner.querySelector(".sign-label"));
    inner.dataset.handwriteReady = "1";
    return total;
  }

  function playContractDocHandwriting() {
    var inner = getContractDocInner();
    if (!inner) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      inner.classList.add("is-handwriting-active", "is-handwriting-done");
      return;
    }

    var total = prepareContractDocHandwriting(inner);
    var chars = inner.querySelectorAll(".contract-doc-char");
    var i;
    for (i = 0; i < chars.length; i++) {
      chars[i].style.setProperty("--write-delay", String(i * CONTRACT_DOC_HANDWRITE_MS) + "ms");
    }
    inner.style.setProperty(
      "--sign-reveal-delay",
      String(total * CONTRACT_DOC_HANDWRITE_MS + 240) + "ms"
    );

    inner.classList.remove("is-handwriting-active", "is-handwriting-done");
    void inner.offsetWidth;
    inner.classList.add("is-handwriting-active");

    window.setTimeout(function () {
      if (inner) inner.classList.add("is-handwriting-done");
    }, total * CONTRACT_DOC_HANDWRITE_MS + 520);
  }

  function showContractDocScreen() {
    if (!contractDocScreen) return;
    restoreContractDocInner();
    showEl(contractDocScreen);
    playContractDocHandwriting();
  }

  function dismissContractLetter() {
    if (gameState.contractLetterDismissed) return;
    if (!contractLetterNarrationAllowDismiss) return;
    stopContractLetterNarration();
    gameState.contractLetterDismissed = true;
    saveState(gameState);
    contractLetterScreen.classList.remove("is-letter-revealed");
    hideEl(contractLetterScreen);
    showContractDocScreen();
  }

  var CERT_HANDWRITE_MS = 44;
  var CERT_FLIP_BEFORE_WRITE_MS = 1200;
  var certificatePosterInnerTemplate = null;
  var certHandwriteStartTimer = null;
  var certHandwriteDoneTimer = null;

  function getCertificatePoster() {
    return elCertModal ? elCertModal.querySelector(".certificate-poster") : null;
  }

  function cacheCertificatePosterTemplate() {
    var poster = getCertificatePoster();
    if (poster && certificatePosterInnerTemplate === null) {
      certificatePosterInnerTemplate = poster.innerHTML;
    }
  }

  function refreshCertificateDomRefs() {
    certGuardianRankEl = document.getElementById("cert-guardian-rank");
    certTeaIdEl = document.getElementById("cert-tea-id");
    certTeaImg = document.getElementById("cert-tea-img");
    btnCertExit = document.getElementById("btn-cert-exit");
    btnCertRestart = document.getElementById("btn-cert-restart");
  }

  function restoreCertificatePoster() {
    var poster = getCertificatePoster();
    if (!poster || certificatePosterInnerTemplate === null) return;
    poster.innerHTML = certificatePosterInnerTemplate;
    poster.classList.remove("is-handwriting-active", "is-handwriting-done");
    poster.removeAttribute("data-cert-handwrite-ready");
    refreshCertificateDomRefs();
    bindCertTeaImgError();
  }

  function stopCertificateAnimation() {
    if (certHandwriteStartTimer) {
      window.clearTimeout(certHandwriteStartTimer);
      certHandwriteStartTimer = null;
    }
    if (certHandwriteDoneTimer) {
      window.clearTimeout(certHandwriteDoneTimer);
      certHandwriteDoneTimer = null;
    }
    if (elCertModal) elCertModal.classList.remove("is-cert-revealed");
    var poster = getCertificatePoster();
    if (poster) poster.classList.remove("is-handwriting-active", "is-handwriting-done");
  }

  function wrapCertHandwriteElement(el) {
    if (!el || el.dataset.certHandwriteWrapped === "1") return 0;
    var text = el.textContent;
    if (!text) return 0;
    el.textContent = "";
    el.dataset.certHandwriteWrapped = "1";
    var count = 0;
    Array.from(text).forEach(function (ch) {
      var span = document.createElement("span");
      span.className = "cert-char";
      if (/\s/.test(ch)) span.classList.add("is-space");
      span.textContent = ch;
      el.appendChild(span);
      count += 1;
    });
    return count;
  }

  function prepareCertificateHandwriting(poster) {
    var total = 0;
    total += wrapCertHandwriteElement(poster.querySelector(".certificate-title"));
    poster.querySelectorAll(".certificate-stats li").forEach(function (el) {
      total += wrapCertHandwriteElement(el);
    });
    total += wrapCertHandwriteElement(poster.querySelector(".certificate-signoff"));
    poster.dataset.certHandwriteReady = "1";
    return total;
  }

  function playCertificateHandwriting(poster) {
    if (!poster) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      poster.classList.add("is-handwriting-active", "is-handwriting-done");
      return;
    }

    var total = prepareCertificateHandwriting(poster);
    var chars = poster.querySelectorAll(".cert-char");
    var i;
    for (i = 0; i < chars.length; i++) {
      chars[i].style.setProperty("--write-delay", String(i * CERT_HANDWRITE_MS) + "ms");
    }
    poster.style.setProperty(
      "--cert-actions-delay",
      String(total * CERT_HANDWRITE_MS + 200) + "ms"
    );

    poster.classList.remove("is-handwriting-active", "is-handwriting-done");
    void poster.offsetWidth;
    poster.classList.add("is-handwriting-active");

    certHandwriteDoneTimer = window.setTimeout(function () {
      if (poster) poster.classList.add("is-handwriting-done");
      certHandwriteDoneTimer = null;
    }, total * CERT_HANDWRITE_MS + 480);
  }

  function fillCertificateDom() {
    ensureContractMeta();
    if (certGuardianRankEl) certGuardianRankEl.textContent = String(gameState.guardianRank || "——");
    if (certTeaIdEl) certTeaIdEl.textContent = gameState.teaTreeId || "——";
  }

  function bindCertTeaImgError() {
    var img = document.getElementById("cert-tea-img");
    if (!img || img.dataset.certErrorBound === "1") return;
    img.dataset.certErrorBound = "1";
    img.addEventListener("error", function () {
      img.style.display = "none";
    });
  }

  function openCertificateModal() {
    if (!elCertModal) return;
    stopCertificateAnimation();
    restoreCertificatePoster();
    fillCertificateDom();
    showEl(elCertModal);
    elCertModal.setAttribute("aria-hidden", "false");

    var poster = getCertificatePoster();
    if (!poster) return;

    elCertModal.classList.remove("is-cert-revealed");
    void elCertModal.offsetWidth;
    elCertModal.classList.add("is-cert-revealed");

    var writeDelay =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : CERT_FLIP_BEFORE_WRITE_MS;
    certHandwriteStartTimer = window.setTimeout(function () {
      certHandwriteStartTimer = null;
      playCertificateHandwriting(poster);
    }, writeDelay);
  }

  function closeCertificateModal() {
    if (!elCertModal) return;
    stopCertificateAnimation();
    hideEl(elCertModal);
    elCertModal.setAttribute("aria-hidden", "true");
  }

  function restartGameFull() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    window.location.reload();
  }

  function exitGameTry() {
    window.close();
    window.setTimeout(function () {
      window.alert("感谢游玩《养茗·春信》。若浏览器未关闭窗口，请手动关闭本页。");
    }, 220);
  }

  /** 0–4 对应 stage1.png … stage5.png；25/50/75/100 为分界 */
  function getBgIndexForGrowth(growth) {
    var g = Math.max(0, Math.min(100, growth));
    if (g >= 100) return 4;
    if (g >= 75) return 3;
    if (g >= 50) return 2;
    if (g >= 25) return 1;
    return 0;
  }

  function getStageInfo(growth) {
    var g = Math.max(0, Math.min(100, growth));
    if (g >= 100) return { label: "春信圆满·茶园通关", bgIndex: 4 };
    if (g >= 75) return { label: "当前阶段：四阶·春信期", bgIndex: 3 };
    if (g >= 50) return { label: "当前阶段：三阶·蓄养期", bgIndex: 2 };
    if (g >= 25) return { label: "当前阶段：二阶·展叶期", bgIndex: 1 };
    return { label: "当前阶段：一阶·萌芽期", bgIndex: 0 };
  }

  function getBgEl(index) {
    for (var i = 0; i < elBgs.length; i++) {
      var el = elBgs[i];
      if (parseInt(el.getAttribute("data-stage-index"), 10) === index) return el;
    }
    return null;
  }

  function tryPlayStageBgVideo(videoEl) {
    if (!videoEl || !videoEl.paused) return;
    var playPromise = videoEl.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {
        videoEl.muted = true;
        var retry = videoEl.play();
        if (retry && retry.catch) retry.catch(function () {});
      });
    }
  }

  function syncStageBgVideos(visibleIndex) {
    var videos = [
      { el: stage1BgVideo, idx: 0 },
      { el: stage2BgVideo, idx: 1 },
      { el: stage3BgVideo, idx: 2 },
      { el: stage4BgVideo, idx: 3 },
      { el: stage5BgVideo, idx: 4 },
    ];
    for (var i = 0; i < videos.length; i++) {
      var item = videos[i];
      if (!item.el) continue;
      if (visibleIndex === item.idx) {
        item.el.muted = !stageBgAudioUnlocked;
        tryPlayStageBgVideo(item.el);
      } else if (!item.el.paused) {
        item.el.pause();
      }
    }
  }

  function unlockStageBgAudioFromGesture() {
    if (stageBgAudioUnlocked) return;
    if (!elMain || elMain.classList.contains("hidden")) return;
    stageBgAudioUnlocked = true;
    if (displayedBgIndex !== null) syncStageBgVideos(displayedBgIndex);
  }

  function applyBgImmediate(visibleIndex) {
    if (!elBgs.length) return;
    for (var i = 0; i < elBgs.length; i++) {
      var el = elBgs[i];
      var idx = parseInt(el.getAttribute("data-stage-index"), 10);
      el.style.transition = "none";
      if (idx === visibleIndex) {
        el.style.opacity = "1";
        el.style.zIndex = "1";
      } else {
        el.style.opacity = "0";
        el.style.zIndex = "0";
      }
    }
    if (elBgStack) void elBgStack.offsetWidth;
    for (var j = 0; j < elBgs.length; j++) {
      elBgs[j].style.transition = "";
    }
    displayedBgIndex = visibleIndex;
    syncStageBgVideos(visibleIndex);
  }

  function planBgSteps(fromIdx, toIdx) {
    var steps = [];
    if (toIdx > fromIdx) {
      for (var i = fromIdx + 1; i <= toIdx; i++) steps.push(i);
    } else if (toIdx < fromIdx) {
      for (var j = fromIdx - 1; j >= toIdx; j--) steps.push(j);
    }
    return steps;
  }

  function applyPendingTargetIfAny() {
    if (pendingFinalBgIndex === null) return;
    var target = pendingFinalBgIndex;
    pendingFinalBgIndex = null;
    if (target === displayedBgIndex) return;
    bgStepQueue = planBgSteps(displayedBgIndex, target);
  }

  function runBgStepProcessor() {
    applyPendingTargetIfAny();
    if (!bgStepQueue.length) {
      bgCrossfading = false;
      return;
    }
    var fromIdx = displayedBgIndex;
    var toIdx = bgStepQueue[0];
    startCrossfade(fromIdx, toIdx, function onOneStepDone() {
      bgStepQueue.shift();
      runBgStepProcessor();
    });
  }

  function queueBackgroundForGrowth(prevIdx, newIdx) {
    if (prevIdx === newIdx) return;

    if (bgCrossfading) {
      pendingFinalBgIndex = newIdx;
      return;
    }

    bgStepQueue = planBgSteps(prevIdx, newIdx);
    if (!bgStepQueue.length) return;
    bgCrossfading = true;
    runBgStepProcessor();
  }

  function startCrossfade(fromIdx, toIdx, onDone) {
    if (typeof onDone !== "function") onDone = function () {};

    if (fromIdx === toIdx) {
      applyBgImmediate(toIdx);
      window.setTimeout(onDone, 0);
      return;
    }

    var fromEl = getBgEl(fromIdx);
    var toEl = getBgEl(toIdx);
    if (!fromEl || !toEl) {
      applyBgImmediate(toIdx);
      window.setTimeout(onDone, 0);
      return;
    }

    if (crossfadeEndTimer) {
      window.clearTimeout(crossfadeEndTimer);
      crossfadeEndTimer = null;
    }

    for (var i = 0; i < elBgs.length; i++) {
      var el = elBgs[i];
      el.style.transition = "opacity " + BG_CROSSFADE_MS / 1000 + "s ease";
      el.style.opacity = "0";
      el.style.zIndex = "0";
    }

    fromEl.style.zIndex = "1";
    toEl.style.zIndex = "2";
    fromEl.style.opacity = "1";
    toEl.style.opacity = "0";

    if (elBgStack) void elBgStack.offsetWidth;

    fromEl.style.opacity = "0";
    toEl.style.opacity = "1";

    crossfadeEndTimer = window.setTimeout(function () {
      crossfadeEndTimer = null;
      applyBgImmediate(toIdx);
      onDone();
    }, BG_CROSSFADE_MS);
  }

  function refreshStageUi() {
    var info = getStageInfo(gameState.growth);
    if (elStageLabel) elStageLabel.textContent = info.label;
    if (elGrowthDisplay) elGrowthDisplay.textContent = String(gameState.growth);
  }

  function refreshVictoryUi() {
    var complete = gameState.growth >= 100;
    var fullyComplete = complete && gameState.levelProgress >= 5;
    if (elMainScene) {
      if (complete) elMainScene.classList.add("game-complete");
      else elMainScene.classList.remove("game-complete");
      if (fullyComplete) elMainScene.classList.add("fully-complete");
      else elMainScene.classList.remove("fully-complete");
    }
    if (elVictoryBanner) {
      if (fullyComplete) {
        elVictoryBanner.classList.remove("hidden");
        elVictoryBanner.removeAttribute("hidden");
      } else {
        elVictoryBanner.classList.add("hidden");
        elVictoryBanner.setAttribute("hidden", "");
      }
    }
    if (btnOpenArchives) {
      if (fullyComplete) btnOpenArchives.removeAttribute("hidden");
      else btnOpenArchives.setAttribute("hidden", "");
    }
    if (fullyComplete && !gameState.certificateAutoShown) {
      gameState.certificateAutoShown = true;
      saveState(gameState);
    }
  }

  function refreshMainScene() {
    if (!bgCrossfading) {
      var idx = getBgIndexForGrowth(gameState.growth);
      applyBgImmediate(idx);
    }
    refreshStageUi();
    refreshVictoryUi();
    var nameText = gameState.playerName || "——";
    if (displayName) displayName.textContent = nameText;
    if (elGuardianName) elGuardianName.textContent = nameText;
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function resizeRainCanvas() {
    if (!rainCanvas) return;
    var host = elRainEffect || rainCanvas.parentElement;
    if (!host) return;
    var rect = host.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    rainCanvas.width = Math.round(w * dpr);
    rainCanvas.height = Math.round(h * dpr);
    rainCanvas.style.width = w + "px";
    rainCanvas.style.height = h + "px";
    if (rainCtx) rainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rainDropTargetCount = Math.max(50, Math.min(140, Math.round((w * h) / 18000)));
  }

  function createRainDrop(width, height) {
    var len = 9 + Math.random() * 16;
    var speedY = 300 + Math.random() * 260;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: rainWindX + Math.random() * 18,
      vy: speedY,
      len: len,
      alpha: 0.22 + Math.random() * 0.3,
      lineW: 0.7 + Math.random() * 0.7,
    };
  }

  function spawnRainSplash(x, y) {
    if (rainSplashes.length > 80) return;
    for (var i = 0; i < 2; i++) {
      rainSplashes.push({
        x: x + (Math.random() * 6 - 3),
        y: y,
        vx: (Math.random() * 30 - 15),
        vy: -40 - Math.random() * 25,
        life: 0.26 + Math.random() * 0.16,
        age: 0,
      });
    }
  }

  function ensureRainDrops(width, height) {
    while (rainDrops.length < rainDropTargetCount) {
      rainDrops.push(createRainDrop(width, height));
    }
    if (rainDrops.length > rainDropTargetCount) rainDrops.length = rainDropTargetCount;
  }

  function tickRainFrame(ts) {
    if (!rainCtx || !rainCanvas || !elRainEffect || !elRainEffect.classList.contains("is-active")) {
      rainRafId = 0;
      return;
    }
    if (!rainFramePrev) rainFramePrev = ts;
    var dt = Math.min(0.033, (ts - rainFramePrev) / 1000);
    rainFramePrev = ts;

    var width = rainCanvas.width / (Math.min(2, window.devicePixelRatio || 1));
    var height = rainCanvas.height / (Math.min(2, window.devicePixelRatio || 1));
    ensureRainDrops(width, height);

    rainCtx.clearRect(0, 0, width, height);
    rainCtx.lineCap = "round";
    for (var i = 0; i < rainDrops.length; i++) {
      var d = rainDrops[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      if (d.y > height + d.len) {
        spawnRainSplash(d.x, height - 2);
        var reset = createRainDrop(width, height);
        reset.x = Math.random() * width;
        reset.y = -8 - Math.random() * 40;
        rainDrops[i] = reset;
        d = rainDrops[i];
      } else if (d.x < -30 || d.x > width + 30) {
        d.x = Math.random() * width;
      }

      rainCtx.strokeStyle = "rgba(150,150,150," + d.alpha.toFixed(3) + ")";
      rainCtx.lineWidth = d.lineW;
      rainCtx.beginPath();
      rainCtx.moveTo(d.x, d.y);
      rainCtx.lineTo(d.x - d.vx * 0.03, d.y - d.len);
      rainCtx.stroke();
    }

    for (var j = rainSplashes.length - 1; j >= 0; j--) {
      var s = rainSplashes[j];
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 220 * dt;
      if (s.age >= s.life) {
        rainSplashes.splice(j, 1);
        continue;
      }
      var a = 1 - s.age / s.life;
      rainCtx.fillStyle = "rgba(170,170,170," + (a * 0.32).toFixed(3) + ")";
      rainCtx.fillRect(s.x, s.y, 1.5, 1.5);
    }

    rainRafId = window.requestAnimationFrame(tickRainFrame);
  }

  function showRainEffect() {
    if (!elRainEffect) return;
    elRainEffect.classList.remove("hidden");
    elRainEffect.classList.add("is-active");
    if (elMainScene) elMainScene.classList.add("is-rainy");
    if (!rainCanvas) return;
    if (!rainCtx) rainCtx = rainCanvas.getContext("2d");
    resizeRainCanvas();
    if (!rainRafId) {
      rainFramePrev = 0;
      rainRafId = window.requestAnimationFrame(tickRainFrame);
    }
  }

  function hideRainEffect() {
    if (!elRainEffect) return;
    elRainEffect.classList.remove("is-active");
    elRainEffect.classList.add("hidden");
    if (elMainScene) elMainScene.classList.remove("is-rainy");
    if (rainRafId) {
      window.cancelAnimationFrame(rainRafId);
      rainRafId = 0;
    }
    rainDrops = [];
    rainSplashes = [];
    rainFramePrev = 0;
    if (rainCtx && rainCanvas) {
      var w = rainCanvas.width / (Math.min(2, window.devicePixelRatio || 1));
      var h = rainCanvas.height / (Math.min(2, window.devicePixelRatio || 1));
      rainCtx.clearRect(0, 0, w, h);
    }
  }

  function normalizeWeatherLabel(raw) {
    var text = (raw || "").toLowerCase();
    if (text.indexOf("rain") >= 0 || text.indexOf("drizzle") >= 0 || text.indexOf("thunder") >= 0 || text.indexOf("雨") >= 0) return "雨";
    if (text.indexOf("cloud") >= 0 || text.indexOf("overcast") >= 0 || text.indexOf("云") >= 0) return "云";
    return "晴";
  }

  /** Mock：用于毕设演示，无 API key 时自动启用 */
  function fetchMockWeather() {
    return Promise.resolve({
      city: "杭州",
      weather: "晴",
      humidity: 62,
    });
  }

  function fetchWeatherByOpenWeather() {
    if (!OPEN_WEATHER_API_KEY) return fetchMockWeather();
    return new Promise(function (resolve) {
      if (!navigator.geolocation) {
        fetchMockWeather().then(resolve);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (position) {
          var lat = position.coords.latitude;
          var lon = position.coords.longitude;
          var url =
            "https://api.openweathermap.org/data/2.5/weather?lat=" +
            encodeURIComponent(lat) +
            "&lon=" +
            encodeURIComponent(lon) +
            "&appid=" +
            encodeURIComponent(OPEN_WEATHER_API_KEY) +
            "&units=metric&lang=zh_cn";
          fetch(url)
            .then(function (res) {
              if (!res.ok) throw new Error("weather http " + res.status);
              return res.json();
            })
            .then(function (json) {
              var main = json && json.weather && json.weather[0] ? json.weather[0].main || json.weather[0].description : "";
              resolve({
                city: (json && json.name) || "本地",
                weather: normalizeWeatherLabel(main),
                humidity: json && json.main ? json.main.humidity : null,
              });
            })
            .catch(function () {
              fetchMockWeather().then(resolve);
            });
        },
        function () {
          fetchMockWeather().then(resolve);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 5 * 60 * 1000 }
      );
    });
  }

  function applyWeatherState(weatherLabel, humidity) {
    currentWeather = weatherLabel || "晴";
    if (elEnvWeather) elEnvWeather.textContent = currentWeather;
    if (typeof humidity === "number" && elEnvHumidity) {
      elEnvHumidity.textContent = Math.max(0, Math.min(100, Math.round(humidity))) + "%";
    }
    if (currentWeather === "雨") showRainEffect();
    else hideRainEffect();
  }

  function syncWeatherNow() {
    if (debugWeatherOverride !== "auto") {
      applyWeatherState(debugWeatherOverride, null);
      return;
    }
    fetchWeatherByOpenWeather().then(function (data) {
      applyWeatherState(normalizeWeatherLabel(data.weather), data.humidity);
    });
  }

  function tickEnvTime() {
    if (!elEnvTime) return;
    var now = new Date();
    elEnvTime.textContent =
      pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());
  }

  function startEnvClock() {
    if (envTimer) window.clearInterval(envTimer);
    if (weatherTimer) window.clearInterval(weatherTimer);
    tickEnvTime();
    syncWeatherNow();
    envTimer = window.setInterval(tickEnvTime, 1000);
    weatherTimer = window.setInterval(syncWeatherNow, WEATHER_FETCH_MS);
  }

  function pickGrandpaQuote() {
    var i = Math.floor(Math.random() * GRANDPA_QUOTES.length);
    return GRANDPA_QUOTES[i];
  }

  function hideGrandpaMutter() {
    if (!elGrandpa) return;
    elGrandpa.classList.remove("is-visible");
    elGrandpa.classList.add("is-hiding");
    window.setTimeout(function () {
      elGrandpa.classList.remove("is-hiding");
      elGrandpa.textContent = "";
    }, 900);
  }

  function showGrandpaMutter() {
    if (!elGrandpa) return;
    elGrandpa.textContent = pickGrandpaQuote();
    elGrandpa.classList.remove("is-hiding");
    void elGrandpa.offsetWidth;
    elGrandpa.classList.add("is-visible");
    if (grandpaHideTimer) window.clearTimeout(grandpaHideTimer);
    grandpaHideTimer = window.setTimeout(hideGrandpaMutter, 5200);
  }

  function startGrandpaLoop() {
    if (grandpaTimer) window.clearInterval(grandpaTimer);
    window.setTimeout(showGrandpaMutter, DIALOG_INITIAL_HOLD_MS);
    grandpaTimer = window.setInterval(showGrandpaMutter, 10000);
  }

  function stopGrandpaDialogRotation() {
    if (dialogRotateTimer) {
      window.clearTimeout(dialogRotateTimer);
      dialogRotateTimer = null;
    }
    if (dialogRotateDelayTimer) {
      window.clearTimeout(dialogRotateDelayTimer);
      dialogRotateDelayTimer = null;
    }
    if (dialogTypeTimer) {
      window.clearTimeout(dialogTypeTimer);
      dialogTypeTimer = null;
    }
    dialogAnimBusy = false;
  }

  function pickGrandpaMessageIndex() {
    var n = grandpaMessages.length;
    if (n === 0) return -1;
    if (n === 1) return 0;
    var i;
    do {
      i = Math.floor(Math.random() * n);
    } while (i === lastGrandpaMessageIndex);
    return i;
  }

  function scheduleNextGrandpaDialog() {
    if (!elDialogText || !elMain || elMain.classList.contains("hidden")) return;
    if (dialogRotateTimer) window.clearTimeout(dialogRotateTimer);
    var waitMs = 8000 + Math.floor(Math.random() * 2001);
    dialogRotateTimer = window.setTimeout(function () {
      var idx = pickGrandpaMessageIndex();
      if (idx < 0) return;
      lastGrandpaMessageIndex = idx;
      playGrandpaDialogTransition(grandpaMessages[idx]);
    }, waitMs);
  }

  function typeGrandpaDialogText(text, onDone) {
    if (!elDialogText) {
      if (onDone) onDone();
      return;
    }
    var chars = Array.from(text);
    var i = 0;
    elDialogText.textContent = "";
    elDialogText.classList.remove("is-fading-out");
    elDialogText.classList.add("is-typing", "is-fading-in");

    function tick() {
      if (!elDialogText) return;
      if (i < chars.length) {
        elDialogText.textContent += chars[i];
        i += 1;
        var step = chars.length > 0 ? Math.max(26, Math.floor(DIALOG_TYPE_MS / chars.length)) : 0;
        dialogTypeTimer = window.setTimeout(tick, step);
        return;
      }
      elDialogText.classList.remove("is-typing", "is-fading-in");
      elDialogText.classList.add("is-visible");
      dialogTypeTimer = null;
      if (onDone) onDone();
    }

    tick();
  }

  function playGrandpaDialogTransition(text) {
    if (!elDialogText || dialogAnimBusy) return;
    if (!elMain || elMain.classList.contains("hidden")) return;
    dialogAnimBusy = true;

    elDialogText.classList.remove("is-visible", "is-fading-in", "is-typing");
    elDialogText.classList.add("is-fading-out");

    window.setTimeout(function () {
      if (!elDialogText || !elMain || elMain.classList.contains("hidden")) {
        dialogAnimBusy = false;
        return;
      }
      elDialogText.classList.remove("is-fading-out");
      typeGrandpaDialogText(text, function () {
        dialogAnimBusy = false;
        scheduleNextGrandpaDialog();
      });
    }, DIALOG_FADE_MS);
  }

  function startGrandpaDialogRotation() {
    stopGrandpaDialogRotation();
    if (!elDialogText) return;
    elDialogText.textContent = GRANDPA_DIALOG_DEFAULT;
    elDialogText.classList.remove("is-fading-out", "is-fading-in", "is-typing");
    elDialogText.classList.add("is-visible");
    lastGrandpaMessageIndex = -1;
    dialogRotateDelayTimer = window.setTimeout(function () {
      dialogRotateDelayTimer = null;
      scheduleNextGrandpaDialog();
    }, DIALOG_INITIAL_HOLD_MS);
  }

  function startMainSceneHooks() {
    if (mainHooksStarted) return;
    mainHooksStarted = true;
    startEnvClock();
    startGrandpaLoop();
    startGrandpaDialogRotation();
  }

  function showMainScene() {
    if (elContract) {
      elContract.classList.add("hidden");
      elContract.setAttribute("hidden", "");
    }
    if (contractParcelScreen) hideEl(contractParcelScreen);
    stopContractLetterNarration();
    releaseContractLetterNarrationWait();
    if (elMain) {
      elMain.classList.remove("hidden");
      elMain.removeAttribute("hidden");
    }
    refreshMainScene();
    startMainSceneHooks();
    tryStartMainSceneBgm();
  }

  function tryStartMainSceneBgm() {
    if (!mainSceneBgmAudio || !elMain || elMain.classList.contains("hidden")) return;
    mainSceneBgmAudio.loop = true;
    if (typeof mainSceneBgmAudio.volume === "number") mainSceneBgmAudio.volume = 0.38;
    var p = mainSceneBgmAudio.play();
    if (p && typeof p.catch === "function") {
      p.catch(function () {});
    }
  }

  function pauseMainSceneBgm() {
    if (!mainSceneBgmAudio) return;
    mainSceneBgmAudio.pause();
  }

  function updateGrowth(amount, bgOpts) {
    var add = Number(amount);
    if (isNaN(add)) return gameState.growth;
    bgOpts = bgOpts || {};

    var prevIdx = getBgIndexForGrowth(gameState.growth);
    gameState.growth = Math.max(0, Math.min(100, Math.round(gameState.growth + add)));
    var newIdx = getBgIndexForGrowth(gameState.growth);

    saveState(gameState);
    refreshStageUi();
    refreshVictoryUi();
    var nameText = gameState.playerName || "——";
    if (displayName) displayName.textContent = nameText;
    if (elGuardianName) elGuardianName.textContent = nameText;

    if (bgOpts.immediateBg) {
      if (crossfadeEndTimer) {
        window.clearTimeout(crossfadeEndTimer);
        crossfadeEndTimer = null;
      }
      bgCrossfading = false;
      bgStepQueue = [];
      pendingFinalBgIndex = null;
      applyBgImmediate(newIdx);
    } else {
      queueBackgroundForGrowth(prevIdx, newIdx);
    }

    return gameState.growth;
  }

  function openNotebook() {
    if (window.Handbook && typeof window.Handbook.open === "function") {
      window.Handbook.open();
      return;
    }
    document.dispatchEvent(new CustomEvent("yangming:notebook-open"));
  }

  /**
   * 关卡过场：播放 assets/video/growth_{1..5}.mp4，结束后淡出再回调（无文件则短时跳过）
   */
  function playGrowthCutscene(levelIndex, onDone) {
    if (typeof onDone !== "function") onDone = function () {};
    if (!growthCutsceneEl || !growthCutsceneVideo) {
      window.setTimeout(function () {
        onHandbookLevelComplete({ immediateBg: true });
        onDone();
      }, 0);
      return;
    }

    var src = "assets/video/growth_" + levelIndex + ".mp4";
    growthCutsceneVideo.src = src;
    showEl(growthCutsceneEl);
    growthCutsceneEl.classList.remove("is-fading");
    growthCutsceneEl.setAttribute("aria-hidden", "false");

    var cutsceneFinished = false;
    function endCutscene() {
      if (cutsceneFinished) return;
      cutsceneFinished = true;
      growthCutsceneVideo.removeEventListener("ended", endCutscene);
      growthCutsceneVideo.removeEventListener("error", endCutscene);
      /*
       * 遮罩仍为不透明时先推进关卡、春信并瞬间切主场景底图，再淡出。
       * 若先淡出再 updateGrowth，半透明阶段会看到旧阶段图 + crossfade，衔接断裂。
       */
      onHandbookLevelComplete({ immediateBg: true });
      growthCutsceneEl.classList.add("is-fading");
      window.setTimeout(function () {
        hideEl(growthCutsceneEl);
        growthCutsceneEl.classList.remove("is-fading");
        growthCutsceneEl.setAttribute("aria-hidden", "true");
        try {
          growthCutsceneVideo.pause();
          growthCutsceneVideo.removeAttribute("src");
          growthCutsceneVideo.load();
        } catch (e) {}
        onDone();
      }, 850);
    }

    growthCutsceneVideo.addEventListener("ended", endCutscene);
    growthCutsceneVideo.addEventListener("error", endCutscene);
    var playPromise = growthCutsceneVideo.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {
        window.setTimeout(endCutscene, 600);
      });
    }
  }

  /** 手账单关结算：推进关卡 + 春信 +25（生长过场内在淡出前调用时会带 immediateBg） */
  function onHandbookLevelComplete(bgOpts) {
    gameState.levelProgress = Math.min(5, gameState.levelProgress + 1);
    saveState(gameState);
    updateGrowth(25, bgOpts);
  }

  if (btnNotebook) btnNotebook.addEventListener("click", openNotebook);
  if (weatherDebugSelect) {
    weatherDebugSelect.addEventListener("change", function () {
      debugWeatherOverride = weatherDebugSelect.value || "auto";
      syncWeatherNow();
    });
  }
  window.addEventListener("resize", function () {
    if (elRainEffect && elRainEffect.classList.contains("is-active")) resizeRainCanvas();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) hideRainEffect();
    else if (currentWeather === "雨") showRainEffect();
  });
  window.addEventListener("pagehide", function () {
    hideRainEffect();
    stopGrandpaDialogRotation();
    stopContractParcelHint();
  });

  function runInkTransition(onMidpoint) {
    if (!elInk) {
      if (onMidpoint) onMidpoint();
      return;
    }

    elInk.classList.remove("fade-out", "ink-held");
    elInk.classList.add("active");

    var holdMs = 280;
    var bloomDone = false;

    function onAnimEnd(e) {
      if (e.animationName !== "ink-bloom") return;
      afterBloom();
    }

    function afterBloom() {
      if (bloomDone) return;
      bloomDone = true;
      elInk.removeEventListener("animationend", onAnimEnd);
      elInk.classList.remove("active");
      elInk.classList.add("ink-held");
      if (onMidpoint) onMidpoint();
      window.setTimeout(function () {
        elInk.classList.remove("ink-held");
        elInk.classList.add("fade-out");
        window.setTimeout(function () {
          elInk.classList.remove("fade-out");
        }, 1100);
      }, holdMs);
    }

    elInk.addEventListener("animationend", onAnimEnd);
    window.setTimeout(function () {
      if (!elInk.classList.contains("active")) return;
      afterBloom();
    }, 1600);
  }

  function triggerSeal(name) {
    ensureContractMeta();
    gameState.playerName = name;
    saveState(gameState);

    runInkTransition(function () {
      showMainScene();
    });
  }

  function refreshContractDocControls() {
    inputName = document.getElementById("player-name");
    btnSeal = document.getElementById("btn-seal");
  }

  function onSealClick() {
    var nameInput = document.getElementById("player-name");
    var raw = nameInput ? nameInput.value.trim() : "";
    if (!raw) {
      var sealBtn = document.getElementById("btn-seal");
      if (sealBtn) {
        sealBtn.classList.remove("shake");
        void sealBtn.offsetWidth;
        sealBtn.classList.add("shake");
      }
      if (nameInput) nameInput.focus();
      return;
    }
    triggerSeal(raw);
  }

  if (contractDocScreen) {
    contractDocScreen.addEventListener("click", function (e) {
      if (!contractDocScreen.classList.contains("hidden") && e.target.closest("#btn-seal")) {
        onSealClick();
      }
    });
    contractDocScreen.addEventListener("keydown", function (e) {
      if (e.target.id !== "player-name") return;
      if (e.key === "Enter") onSealClick();
    });
  }


  function resumeAudioContextIfPossible() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!window.__yangmingAudioCtx) {
        window.__yangmingAudioCtx = new AC();
      }
      var ctx = window.__yangmingAudioCtx;
      if (ctx.state === "suspended") {
        var pr = ctx.resume();
        if (pr && pr.catch) pr.catch(function () {});
      }
    } catch (e) {}
  }

  function hideIntroStartOverlayImmediate() {
    if (introOverlayDismissTimer) {
      window.clearTimeout(introOverlayDismissTimer);
      introOverlayDismissTimer = null;
    }
    if (!introStartOverlay) return;
    introStartOverlay.classList.remove("intro-start-overlay--leaving");
    introStartOverlay.classList.add("hidden");
    introStartOverlay.setAttribute("hidden", "");
    introStartOverlay.setAttribute("aria-hidden", "true");
  }

  function hideIntroStartOverlay() {
    if (!introStartOverlay || introStartOverlay.classList.contains("hidden")) return;
    introStartOverlay.classList.add("intro-start-overlay--leaving");
    introOverlayDismissTimer = window.setTimeout(function () {
      introOverlayDismissTimer = null;
      introStartOverlay.classList.add("hidden");
      introStartOverlay.setAttribute("hidden", "");
      introStartOverlay.setAttribute("aria-hidden", "true");
      introStartOverlay.classList.remove("intro-start-overlay--leaving");
    }, 460);
  }

  /** 用户点击「入山」后：解锁音频、取消静音、再 play()（满足浏览器自动播放策略） */
  function beginIntroFromUserGesture() {
    if (introFromUserGestureBegun) return;
    introFromUserGestureBegun = true;
    resumeAudioContextIfPossible();
    if (btnEnterMountain) btnEnterMountain.disabled = true;
    if (!introVideo) {
      hideIntroStartOverlayImmediate();
      showIntroCta();
      return;
    }
    introVideo.muted = false;
    hideIntroStartOverlay();
    var playPromise = introVideo.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {
        hideIntroStartOverlayImmediate();
        introFromUserGestureBegun = false;
        if (btnEnterMountain) btnEnterMountain.disabled = false;
        showIntroCta();
      });
    }
  }

  function showIntroCta() {
    hideIntroStartOverlayImmediate();
    if (introVideo) introVideo.classList.add("intro-video-finished");
    if (introCta) {
      introCta.classList.remove("intro-cta--visible");
      showEl(introCta);
      void introCta.offsetWidth;
      window.requestAnimationFrame(function () {
        introCta.classList.add("intro-cta--visible");
      });
    } else {
      showEl(introCta);
    }
  }

  function bindIntroVideo() {
    if (!introVideo) {
      hideIntroStartOverlayImmediate();
      showIntroCta();
      return;
    }
    introVideo.addEventListener("ended", function () {
      introVideo.pause();
      showIntroCta();
    });
    introVideo.addEventListener("error", showIntroCta);
    /* 不在此处 play()：须用户点击遮罩「入山」触发 beginIntroFromUserGesture，方可带声播放 */
  }

  if (btnEnterMountain) {
    btnEnterMountain.addEventListener("click", function (e) {
      e.preventDefault();
      beginIntroFromUserGesture();
    });
  }

  if (btnStartGame) {
    btnStartGame.addEventListener("click", function () {
      gameState.introSeen = true;
      saveState(gameState);
      hideEl(elIntro);
      showEl(elContract);
      applyContractUiState();
    });
  }

  if (contractParcelScreen) {
    contractParcelScreen.addEventListener(
      "pointerdown",
      function (e) {
        if (gameState.contractParcelOpened || gameState.contractLetterDismissed) return;
        if (!parcelPointerInCenterBand(e.clientX, e.clientY)) return;
        if (parcelScrubbing) {
          try {
            if (parcelScrubPointerId !== null) contractParcelScreen.releasePointerCapture(parcelScrubPointerId);
          } catch (x) {}
          contractParcelScreen.classList.remove("contract-parcel-screen--scrubbing");
          parcelScrubPointerId = null;
          parcelScrubbing = false;
        }
        parcelScrubbing = true;
        parcelScrubPointerId = e.pointerId;
        parcelScrubGestureStartX = e.clientX;
        parcelScrubGestureStartY = e.clientY;
        parcelScrubAnchorFrame = parcelScrubFrame;
        contractParcelScreen.classList.add("contract-parcel-screen--scrubbing");
        try {
          contractParcelScreen.setPointerCapture(e.pointerId);
        } catch (err) {}
      },
      { passive: true }
    );
    contractParcelScreen.addEventListener(
      "pointermove",
      function (e) {
        if (!parcelScrubbing || e.pointerId !== parcelScrubPointerId) return;
        var dx = e.clientX - parcelScrubGestureStartX;
        var dy = e.clientY - parcelScrubGestureStartY;
        if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
        applyParcelScrubClientX(e.clientX);
      },
      { passive: true }
    );
    function endParcelScrubPointer(e) {
      if (e.pointerId !== parcelScrubPointerId) return;
      parcelScrubbing = false;
      contractParcelScreen.classList.remove("contract-parcel-screen--scrubbing");
      try {
        contractParcelScreen.releasePointerCapture(e.pointerId);
      } catch (err2) {}
      parcelScrubPointerId = null;
      if (gameState.contractParcelOpened || gameState.contractLetterDismissed) return;
      if (parcelScrubFrame >= PARCEL_FRAME_COUNT) finishParcelOpen();
    }
    contractParcelScreen.addEventListener("pointerup", endParcelScrubPointer);
    contractParcelScreen.addEventListener("pointercancel", endParcelScrubPointer);
    contractParcelScreen.addEventListener("keydown", function (e) {
      if (gameState.contractParcelOpened || gameState.contractLetterDismissed) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        ensureParcelFrameImagesLoading();
        if (parcelScrubFrame < PARCEL_FRAME_COUNT) {
          parcelScrubFrame++;
          tryDrawParcelScrubFrame();
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        ensureParcelFrameImagesLoading();
        if (parcelScrubFrame > 1) {
          parcelScrubFrame--;
          tryDrawParcelScrubFrame();
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (parcelScrubFrame >= PARCEL_FRAME_COUNT) finishParcelOpen();
      }
    });
  }

  if (contractLetterScreen) {
    contractLetterScreen.addEventListener("click", function (e) {
      e.preventDefault();
      if (!contractLetterNarrationAllowDismiss) return;
      dismissContractLetter();
    });
    contractLetterScreen.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!contractLetterNarrationAllowDismiss) return;
        dismissContractLetter();
      }
    });
  }

  if (certBackdrop) certBackdrop.addEventListener("click", closeCertificateModal);
  if (elCertModal) {
    elCertModal.addEventListener("click", function (e) {
      if (e.target.closest("#btn-cert-exit")) exitGameTry();
      if (e.target.closest("#btn-cert-restart")) restartGameFull();
    });
  }
  if (btnOpenArchives) btnOpenArchives.addEventListener("click", openCertificateModal);

  if (growthCutsceneEl) hideEl(growthCutsceneEl);
  if (elCertModal) hideEl(elCertModal);

  cacheContractDocInnerTemplate();
  cacheCertificatePosterTemplate();
  bindCertTeaImgError();

  if (gameState.playerName) {
    if (inputName) inputName.value = gameState.playerName;
    hideIntroStartOverlayImmediate();
    hideEl(elIntro);
    hideEl(elContract);
    if (contractParcelScreen) hideEl(contractParcelScreen);
    showMainScene();
  } else if (gameState.introSeen) {
    hideIntroStartOverlayImmediate();
    hideEl(elIntro);
    showEl(elContract);
    applyContractUiState();
  } else {
    hideEl(introCta);
    showEl(elIntro);
    hideEl(elContract);
    if (contractParcelScreen) hideEl(contractParcelScreen);
    bindIntroVideo();
  }

  var introVideoAudioPrimed = false;
  document.addEventListener(
    "pointerdown",
    function yangmingPrimeAudioFromGesture() {
      resumeAudioContextIfPossible();
      if (!introVideoAudioPrimed && introVideo) {
        introVideoAudioPrimed = true;
        introVideo.muted = false;
      }
      unlockStageBgAudioFromGesture();
      tryStartMainSceneBgm();
    },
    { capture: true }
  );

  document.addEventListener("visibilitychange", function () {
    if (!mainSceneBgmAudio || !elMain) return;
    if (document.hidden) {
      pauseMainSceneBgm();
      return;
    }
    if (!elMain.classList.contains("hidden")) tryStartMainSceneBgm();
  });

  window.gameState = gameState;
  window.__yangmingSave = function () {
    saveState(gameState);
  };
  window.updateGrowth = updateGrowth;
  window.Yangming = {
    getState: function () {
      return gameState;
    },
    saveState: saveState,
    updateGrowth: updateGrowth,
    refreshMainScene: refreshMainScene,
    playGrowthCutscene: playGrowthCutscene,
    onHandbookLevelComplete: onHandbookLevelComplete,
    openCertificateModal: openCertificateModal,
    closeCertificateModal: closeCertificateModal,
    ensureContractMeta: ensureContractMeta,
  };
})();
