/**
 * NYXEL Interactive Avatar Widget v1.3.1
 * Autonomous, dependency-free, static-hosting friendly.
 */
(function nyxelBootstrap() {
  "use strict";

  if (window.NYXEL && window.NYXEL.__mounted) {
    return;
  }

  var VERSION = "1.3.1";
  var SCRIPT = document.currentScript || Array.prototype.slice.call(document.scripts).find(function (item) {
    return /(?:^|\/)nyxel\.js(?:\?|#|$)/.test(item.src || "");
  });
  var SCRIPT_URL = SCRIPT && SCRIPT.src ? new URL(SCRIPT.src, window.location.href) : new URL("./nyxel-widget/nyxel.js", window.location.href);

  var ASSETS = {
    IDLE: "nyxel-idle.png",
    IDLE_ALT: "nyxel-idle-alt.png",
    LOOK_LEFT: "nyxel-look-left.png",
    LOOK_RIGHT: "nyxel-look-right.png",
    LOOK_UP: "nyxel-look-up.png",
    CURIOUS: "nyxel-curious.png",
    ACTIVE: "nyxel-active.png",
    HOVER: "nyxel-hover.png",
    TOUCH: "nyxel-touch.png",
    SLEEP: "nyxel-sleep.png",
    WAKE: "nyxel-wake.png",
    CONTACT: "nyxel-contact.png",
    WAVE: "nyxel-wave.png",
    SUCCESS: "nyxel-success.png",
    SURPRISED: "nyxel-surprised.png",
    THINK: "nyxel-think.png"
  };

  var DEFAULTS = {
    name: "NYXEL",
    email: "creatixprojet@gmail.com",
    emailSubject: "Contact depuis une application CR3@TIX",
    emailBody: "Bonjour CR3@TIX,\n\nJe vous contacte depuis NYXEL.",
    position: "bottom-right",
    scale: 1,
    zIndex: 2147483000,
    animations: true,
    greeting: true,
    reactionMinDelay: 3500,
    reactionMaxDelay: 7500,
    sleepAfter: 180000,
    sleepVariance: 120000,
    signature: {
      enabled: true,
      chance: 1,
      minDelay: 120000,
      maxDelay: 300000,
      duration: 4800,
      asset: "nyxel-signature.png",
      sessionKey: "nyxel-cr3atix-signature-v1"
    },
    sounds: false,
    contactLabel: "Contacter CR3@TIX",
    assetBase: "",
    debug: false,
    messages: {
      eyebrow: "Assistant numérique",
      title: "NYXEL",
      contact: "Besoin de contacter CR3@TIX ?",
      email: "Envoyer un e-mail",
      close: "Fermer le panneau de contact"
    },
    links: []
  };

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function mergeConfig(base, custom) {
    var output = {};
    Object.keys(base).forEach(function (key) {
      if (isObject(base[key])) {
        output[key] = mergeConfig(base[key], {});
      } else if (Array.isArray(base[key])) {
        output[key] = base[key].slice();
      } else {
        output[key] = base[key];
      }
    });
    if (!isObject(custom)) {
      return output;
    }
    Object.keys(custom).forEach(function (key) {
      if (isObject(custom[key]) && isObject(output[key])) {
        output[key] = mergeConfig(output[key], custom[key]);
      } else if (custom[key] !== undefined) {
        output[key] = custom[key];
      }
    });
    return output;
  }

  function clamp(number, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, number));
  }

  function randomBetween(minimum, maximum) {
    return Math.round(minimum + Math.random() * (maximum - minimum));
  }

  function normalizePosition(value) {
    var allowed = ["bottom-right", "bottom-left", "top-right", "top-left"];
    return allowed.indexOf(value) >= 0 ? value : "bottom-right";
  }

  function safeExternalUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return "";
    }
    try {
      var parsed = new URL(value, window.location.href);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
    } catch (error) {
      return "";
    }
  }

  function iconSvg(type) {
    if (type === "email") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z"/><path d="m4.5 7.5 7.5 6 7.5-6"/></svg>';
    }
    if (type === "instagram") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><path d="M17.3 6.8h.01"/></svg>';
    }
    if (type === "github") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 19c-4 1.2-4-2-5.6-2.5M14.5 21v-3.1c0-.9.3-1.6.8-2-2.8-.3-5.7-1.4-5.7-6.3 0-1.4.5-2.5 1.3-3.4-.1-.3-.6-1.6.1-3.3 0 0 1.1-.3 3.5 1.3a12 12 0 0 1 6.4 0c2.4-1.6 3.5-1.3 3.5-1.3.7 1.7.2 3 .1 3.3.8.9 1.3 2 1.3 3.4 0 4.9-3 6-5.8 6.3.5.4.9 1.2.9 2.4V21" transform="translate(-3)"/></svg>';
    }
    if (type === "redbubble") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h6a4 4 0 0 1 1.2 7.8L15 18.5h-4l-2.3-4.8H8.5v4.8H5z"/><path d="M8.5 8.5h2.2a1.3 1.3 0 0 1 0 2.6H8.5z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
  }

  var config = mergeConfig(DEFAULTS, window.NYXEL_CONFIG || {});
  config.position = normalizePosition(config.position);
  config.scale = clamp(Number(config.scale) || 1, 0.65, 1.6);
  config.zIndex = clamp(Number(config.zIndex) || DEFAULTS.zIndex, 1, 2147483640);
  config.reactionMinDelay = Math.max(1500, Number(config.reactionMinDelay) || DEFAULTS.reactionMinDelay);
  config.reactionMaxDelay = Math.max(config.reactionMinDelay, Number(config.reactionMaxDelay) || DEFAULTS.reactionMaxDelay);
  config.sleepAfter = Math.max(5000, Number(config.sleepAfter) || DEFAULTS.sleepAfter);
  config.sleepVariance = Math.max(0, Number(config.sleepVariance) || 0);
  config.signature = isObject(config.signature) ? config.signature : mergeConfig(DEFAULTS.signature, {});
  config.signature.enabled = config.signature.enabled !== false;
  config.signature.chance = clamp(isFinite(Number(config.signature.chance)) ? Number(config.signature.chance) : DEFAULTS.signature.chance, 0, 1);
  config.signature.minDelay = Math.max(10000, Number(config.signature.minDelay) || DEFAULTS.signature.minDelay);
  config.signature.maxDelay = Math.max(config.signature.minDelay, Number(config.signature.maxDelay) || DEFAULTS.signature.maxDelay);
  config.signature.duration = clamp(Number(config.signature.duration) || DEFAULTS.signature.duration, 3200, 8000);
  config.signature.asset = String(config.signature.asset || DEFAULTS.signature.asset);
  config.signature.sessionKey = String(config.signature.sessionKey || DEFAULTS.signature.sessionKey);
  config.animations = config.animations !== false;
  config.greeting = config.greeting !== false;
  config.sounds = config.sounds === true;

  var assetBase;
  try {
    assetBase = config.assetBase ? new URL(config.assetBase, window.location.href) : new URL("./assets/", SCRIPT_URL);
  } catch (error) {
    assetBase = new URL("./assets/", SCRIPT_URL);
  }

  function assetUrl(state) {
    return new URL(ASSETS[state] || ASSETS.IDLE, assetBase).href;
  }

  function signatureAssetUrl() {
    return new URL(config.signature.asset, assetBase).href;
  }

  var mediaReduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reducedMotion = Boolean(mediaReduced && mediaReduced.matches);
  var motionEnabled = config.animations && !reducedMotion;
  var root = null;
  var avatarButton = null;
  var panel = null;
  var closeButton = null;
  var emailButton = null;
  var signatureImage = null;
  var imageLayers = [];
  var currentLayer = 0;
  var currentState = "IDLE";
  var requestedState = "IDLE";
  var poseToken = 0;
  var panelOpen = false;
  var destroyed = false;
  var lastFocus = null;
  var lastPointerType = "mouse";
  var loadedAssets = {};
  var assetPromises = {};
  var assetFailures = {};
  var timers = new Set();
  var organicTimer = 0;
  var sleepTimer = 0;
  var transientTimer = 0;
  var panelHideTimer = 0;
  var signatureTimer = 0;
  var signatureFoldTimer = 0;
  var signaturePlaybackTimer = 0;
  var pointerFrame = 0;
  var audioContext = null;
  var listeners = [];
  var lastGlobalMove = { x: null, y: null, at: 0 };
  var lastActivityAt = Date.now();
  var lastActivitySignalAt = 0;
  var lastActivityPulseAt = 0;
  var signaturePlaying = false;
  var signatureDecision = null;

  function setTimer(callback, delay) {
    var timer = window.setTimeout(function () {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function clearTimer(timer) {
    if (timer) {
      window.clearTimeout(timer);
      timers.delete(timer);
    }
  }

  function listen(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);
    listeners.push(function () {
      target.removeEventListener(eventName, handler, options);
    });
  }

  function announceEvent(name, detail) {
    if (!root) {
      return;
    }
    root.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail || {} }));
  }

  function createDom() {
    root = document.createElement("div");
    root.className = "nyxel-widget";
    root.id = "nyxel-widget";
    root.dataset.position = config.position;
    root.dataset.state = "IDLE";
    root.setAttribute("aria-live", "off");
    root.style.setProperty("--nyxel-scale", String(config.scale));
    root.style.zIndex = String(config.zIndex);

    root.innerHTML = [
      '<button class="nyxel-avatar" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="nyxel-contact-panel">',
      '  <span class="nyxel-avatar-stage" aria-hidden="true">',
      '    <img class="nyxel-avatar-image nyxel-is-visible" alt="" width="768" height="768" decoding="async" draggable="false">',
      '    <img class="nyxel-avatar-image" alt="" width="768" height="768" decoding="async" draggable="false">',
      "  </span>",
      '  <span class="nyxel-hint" aria-hidden="true"></span>',
      "</button>",
      '<span class="nyxel-signature-effect" aria-hidden="true">',
      '  <span class="nyxel-signature-pulse"></span>',
      '  <span class="nyxel-signature-beam"></span>',
      '  <img class="nyxel-signature-mark" alt="" width="768" height="256" decoding="async" draggable="false">',
      "</span>",
      '<section class="nyxel-panel" id="nyxel-contact-panel" role="dialog" aria-modal="false" aria-labelledby="nyxel-panel-title" aria-describedby="nyxel-panel-text" hidden>',
      '  <div class="nyxel-panel-header">',
      '    <div class="nyxel-panel-copy">',
      '      <span class="nyxel-panel-eyebrow"></span>',
      '      <h2 class="nyxel-panel-title" id="nyxel-panel-title"></h2>',
      "    </div>",
      '    <button class="nyxel-panel-close" type="button"><span aria-hidden="true">&times;</span></button>',
      "  </div>",
      '  <p class="nyxel-panel-text" id="nyxel-panel-text"></p>',
      '  <a class="nyxel-contact-button">',
      '    <span class="nyxel-contact-icon">' + iconSvg("email") + "</span>",
      '    <span class="nyxel-contact-label"></span>',
      '    <span class="nyxel-contact-arrow" aria-hidden="true">&#8599;</span>',
      "  </a>",
      '  <nav class="nyxel-links" aria-label="Liens CR3@TIX"></nav>',
      '  <span class="nyxel-sr-only nyxel-live" aria-live="polite"></span>',
      "</section>"
    ].join("");

    avatarButton = root.querySelector(".nyxel-avatar");
    panel = root.querySelector(".nyxel-panel");
    closeButton = root.querySelector(".nyxel-panel-close");
    emailButton = root.querySelector(".nyxel-contact-button");
    signatureImage = root.querySelector(".nyxel-signature-mark");
    imageLayers = Array.prototype.slice.call(root.querySelectorAll(".nyxel-avatar-image"));

    var name = String(config.name || DEFAULTS.name);
    var messages = config.messages || DEFAULTS.messages;
    avatarButton.setAttribute("aria-label", String(config.contactLabel || ("Ouvrir le contact " + name)));
    root.querySelector(".nyxel-hint").textContent = String(config.contactLabel || DEFAULTS.contactLabel);
    root.querySelector(".nyxel-panel-eyebrow").textContent = String(messages.eyebrow || DEFAULTS.messages.eyebrow);
    root.querySelector(".nyxel-panel-title").textContent = String(messages.title || name);
    root.querySelector(".nyxel-panel-text").textContent = String(messages.contact || DEFAULTS.messages.contact);
    root.querySelector(".nyxel-contact-label").textContent = String(messages.email || DEFAULTS.messages.email);
    closeButton.setAttribute("aria-label", String(messages.close || DEFAULTS.messages.close));

    var email = String(config.email || DEFAULTS.email).replace(/[\r\n]/g, "").trim();
    var subject = encodeURIComponent(String(config.emailSubject || ""));
    var body = encodeURIComponent(String(config.emailBody || ""));
    emailButton.href = "mailto:" + email + "?subject=" + subject + "&body=" + body;

    renderLinks(root.querySelector(".nyxel-links"), config.links);
    imageLayers[0].src = assetUrl("IDLE");
    imageLayers[0].fetchPriority = "high";
    imageLayers[1].fetchPriority = "low";
    signatureImage.src = signatureAssetUrl();
    signatureImage.fetchPriority = "low";
    root.style.setProperty("--nyxel-signature-duration", config.signature.duration + "ms");
    document.body.appendChild(root);
  }

  function renderLinks(container, links) {
    if (!Array.isArray(links)) {
      return;
    }
    links.forEach(function (link) {
      if (!link || link.enabled !== true) {
        return;
      }
      var href = safeExternalUrl(link.url);
      if (!href) {
        return;
      }
      var anchor = document.createElement("a");
      var icon = document.createElement("span");
      var label = document.createElement("span");
      anchor.className = "nyxel-link";
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      icon.className = "nyxel-link-icon";
      icon.innerHTML = iconSvg(String(link.id || "website").toLowerCase());
      label.textContent = String(link.label || "Lien");
      anchor.appendChild(icon);
      anchor.appendChild(label);
      container.appendChild(anchor);
    });
  }

  function ensureAsset(state) {
    if (loadedAssets[state]) {
      return Promise.resolve(assetUrl(state));
    }
    if (assetFailures[state]) {
      return Promise.reject(assetFailures[state]);
    }
    if (assetPromises[state]) {
      return assetPromises[state];
    }
    assetPromises[state] = new Promise(function (resolve, reject) {
      var image = new Image();
      image.decoding = "async";
      image.onload = function () {
        loadedAssets[state] = true;
        resolve(image.src);
      };
      image.onerror = function () {
        var failure = new Error("NYXEL asset unavailable: " + ASSETS[state]);
        assetFailures[state] = failure;
        reject(failure);
      };
      image.src = assetUrl(state);
    });
    return assetPromises[state];
  }

  function setPose(state) {
    var normalized = String(state || "IDLE").toUpperCase().replace(/[ -]+/g, "_");
    if (!ASSETS[normalized]) {
      normalized = "IDLE";
    }
    requestedState = normalized;
    var token = ++poseToken;
    root.dataset.state = normalized;

    if (normalized === currentState && imageLayers[currentLayer].src) {
      return Promise.resolve(normalized);
    }

    return ensureAsset(normalized).then(function (url) {
      if (destroyed || token !== poseToken) {
        return requestedState;
      }
      var nextLayer = currentLayer === 0 ? 1 : 0;
      var incoming = imageLayers[nextLayer];
      var outgoing = imageLayers[currentLayer];
      incoming.src = url;
      incoming.alt = "";

      var swap = function () {
        if (destroyed || token !== poseToken) {
          return;
        }
        incoming.classList.add("nyxel-is-visible");
        outgoing.classList.remove("nyxel-is-visible");
        currentLayer = nextLayer;
        currentState = normalized;
        announceEvent("nyxel:statechange", { state: normalized });
      };

      if (motionEnabled && !document.hidden) {
        window.requestAnimationFrame(swap);
      } else {
        swap();
      }
      return normalized;
    }).catch(function (error) {
      if (config.debug && window.console) {
        console.warn(error.message);
      }
      root.dataset.state = currentState;
      return currentState;
    });
  }

  function setState(state, options) {
    var settings = options || {};
    clearTimer(transientTimer);
    transientTimer = 0;
    var posePromise = setPose(state);
    var commandPoseToken = poseToken;
    if (Number(settings.hold) > 0) {
      posePromise.then(function () {
        if (destroyed || poseToken !== commandPoseToken) {
          return;
        }
        transientTimer = setTimer(function () {
          transientTimer = 0;
          if (destroyed || poseToken !== commandPoseToken) {
            return;
          }
          setPose(settings.returnTo || "IDLE").then(scheduleOrganic);
        }, Number(settings.hold));
      });
    }
    return posePromise;
  }

  function enterTransient(state, minimum, maximum) {
    if (panelOpen || signaturePlaying || currentState === "SLEEP" || document.hidden) {
      return;
    }
    setState(state, { hold: randomBetween(minimum, maximum), returnTo: "IDLE" });
  }

  function scheduleOrganic() {
    clearTimer(organicTimer);
    organicTimer = 0;
    if (!motionEnabled || destroyed || panelOpen || signaturePlaying || document.hidden || currentState === "SLEEP" || requestedState !== "IDLE") {
      return;
    }
    organicTimer = setTimer(function () {
      organicTimer = 0;
      var choices = ["IDLE_ALT", "LOOK_LEFT", "LOOK_RIGHT", "LOOK_UP", "CURIOUS", "CURIOUS", "THINK"];
      var choice = choices[Math.floor(Math.random() * choices.length)];
      enterTransient(choice, choice === "IDLE_ALT" ? 700 : 1150, choice === "THINK" ? 2500 : 2000);
    }, randomBetween(config.reactionMinDelay, config.reactionMaxDelay));
  }

  function readSignatureSessionStatus() {
    try {
      return window.sessionStorage.getItem(config.signature.sessionKey) || "";
    } catch (error) {
      return "";
    }
  }

  function writeSignatureSessionStatus(status) {
    try {
      window.sessionStorage.setItem(config.signature.sessionKey, status);
    } catch (error) {
      // Private browsing or a file preview may disable sessionStorage.
    }
  }

  function signatureIsEligible() {
    if (!config.signature.enabled || config.signature.chance <= 0) {
      return false;
    }
    if (signatureDecision !== null) {
      return signatureDecision;
    }

    var status = readSignatureSessionStatus();
    if (status === "played" || status === "skipped") {
      signatureDecision = false;
      return false;
    }
    if (status === "eligible") {
      signatureDecision = true;
      return true;
    }

    signatureDecision = Math.random() <= config.signature.chance;
    writeSignatureSessionStatus(signatureDecision ? "eligible" : "skipped");
    return signatureDecision;
  }

  function finishSignature(options) {
    var settings = options || {};
    clearTimer(signatureFoldTimer);
    clearTimer(signaturePlaybackTimer);
    signatureFoldTimer = 0;
    signaturePlaybackTimer = 0;

    if (!signaturePlaying) {
      return;
    }
    signaturePlaying = false;
    if (root) {
      root.classList.remove("nyxel-signature-active");
    }
    announceEvent("nyxel:signature", { phase: "end" });

    if (settings.restorePose !== false && !panelOpen && currentState !== "SLEEP") {
      setPose("IDLE").then(scheduleOrganic);
      lastActivityAt = Date.now();
      scheduleSleep();
    }
  }

  function playSignature(options) {
    var settings = options || {};
    var forced = settings.force === true;
    if (destroyed || signaturePlaying || panelOpen || document.hidden || !motionEnabled) {
      return false;
    }
    if (!forced && (!signatureIsEligible() || currentState === "SLEEP" || requestedState !== "IDLE")) {
      return false;
    }

    signaturePlaying = true;
    clearTimer(signatureTimer);
    clearTimer(organicTimer);
    clearTimer(transientTimer);
    clearTimer(sleepTimer);
    signatureTimer = 0;
    organicTimer = 0;
    transientTimer = 0;
    sleepTimer = 0;

    // A manual production trigger also consumes the once-per-session event.
    // Debug mode remains repeatable so the animation can be reviewed freely.
    if (!forced || !config.debug) {
      signatureDecision = false;
      writeSignatureSessionStatus("played");
    }

    setPose("WAVE");
    root.classList.add("nyxel-signature-active");
    announceEvent("nyxel:signature", { phase: "start", forced: forced });

    signatureFoldTimer = setTimer(function () {
      signatureFoldTimer = 0;
      if (signaturePlaying && !panelOpen) {
        setPose("IDLE");
      }
    }, Math.round(config.signature.duration * 0.78));

    signaturePlaybackTimer = setTimer(function () {
      signaturePlaybackTimer = 0;
      finishSignature();
    }, config.signature.duration);
    return true;
  }

  function scheduleSignature(delay) {
    clearTimer(signatureTimer);
    signatureTimer = 0;
    if (destroyed || document.hidden || !motionEnabled || !signatureIsEligible()) {
      return;
    }

    var wait = Number(delay) > 0 ? Number(delay) : randomBetween(config.signature.minDelay, config.signature.maxDelay);
    signatureTimer = setTimer(function attemptSignature() {
      signatureTimer = 0;
      if (destroyed || document.hidden || !motionEnabled || !signatureIsEligible()) {
        return;
      }
      if (panelOpen || signaturePlaying || currentState === "SLEEP" || requestedState !== "IDLE") {
        scheduleSignature(randomBetween(9000, 18000));
        return;
      }
      playSignature();
    }, wait);
  }

  function scheduleSleep() {
    clearTimer(sleepTimer);
    sleepTimer = 0;
    if (destroyed || panelOpen || signaturePlaying || document.hidden) {
      return;
    }
    var activitySnapshot = lastActivityAt;
    var inactivityDelay = config.sleepAfter + randomBetween(0, config.sleepVariance);
    var sleepAt = activitySnapshot + inactivityDelay;

    function sleepIfStillInactive() {
      sleepTimer = 0;
      if (destroyed || panelOpen || document.hidden) {
        return;
      }

      // An interaction that happened after this timer was created always wins,
      // even if a delayed callback was already waiting in the event queue.
      if (lastActivityAt > activitySnapshot) {
        scheduleSleep();
        return;
      }

      var remaining = sleepAt - Date.now();
      if (remaining > 40) {
        sleepTimer = setTimer(sleepIfStillInactive, remaining);
        return;
      }

      clearTimer(organicTimer);
      clearTimer(transientTimer);
      setPose("SLEEP");
      announceEvent("nyxel:sleep", { state: "SLEEP" });
    }

    sleepTimer = setTimer(sleepIfStillInactive, Math.max(50, sleepAt - Date.now()));
  }

  function wake(reason) {
    if (destroyed) {
      return;
    }
    clearTimer(sleepTimer);
    if (currentState === "SLEEP" || requestedState === "SLEEP") {
      setState("WAKE", { hold: motionEnabled ? 1050 : 1, returnTo: "IDLE" });
      announceEvent("nyxel:wake", { reason: reason || "activity" });
    }
    scheduleSleep();
    // Global activity must postpone sleep without restarting an organic
    // reaction that is already scheduled. Otherwise continuous use of the
    // host application would keep postponing every reaction indefinitely.
    if (!organicTimer && currentState === "IDLE" && requestedState === "IDLE") {
      scheduleOrganic();
    }
  }

  function registerActivity(reason) {
    var now = Date.now();
    lastActivityAt = now;

    // Pointer and touch events may describe the same physical gesture.
    // Coalesce those duplicates to avoid needless timer churn.
    if (now - lastActivitySignalAt < 90) {
      return;
    }
    lastActivitySignalAt = now;

    if (panelOpen) {
      clearTimer(sleepTimer);
      return;
    }
    wake(reason);
  }

  function openPanel() {
    if (destroyed || panelOpen) {
      return;
    }
    if (signaturePlaying) {
      finishSignature({ restorePose: false });
    }
    panelOpen = true;
    clearTimer(panelHideTimer);
    clearTimer(organicTimer);
    clearTimer(sleepTimer);
    clearTimer(transientTimer);
    lastFocus = document.activeElement;
    panel.hidden = false;
    root.classList.add("nyxel-is-open");
    avatarButton.setAttribute("aria-expanded", "true");
    setPose("CONTACT");
    playSound("open");
    setTimer(function () {
      if (panelOpen && closeButton) {
        try {
          closeButton.focus({ preventScroll: true });
        } catch (error) {
          closeButton.focus();
        }
      }
    }, motionEnabled ? 190 : 1);
    announceEvent("nyxel:open", { state: "CONTACT" });
  }

  function closePanel(options) {
    if (destroyed || !panelOpen) {
      return;
    }
    var settings = options || {};
    panelOpen = false;
    root.classList.remove("nyxel-is-open");
    avatarButton.setAttribute("aria-expanded", "false");
    clearTimer(panelHideTimer);
    panelHideTimer = setTimer(function () {
      if (!panelOpen) {
        panel.hidden = true;
      }
    }, motionEnabled ? 290 : 1);
    setPose("IDLE").then(scheduleOrganic);
    scheduleSleep();
    if (settings.restoreFocus !== false && lastFocus && typeof lastFocus.focus === "function") {
      try {
        lastFocus.focus({ preventScroll: true });
      } catch (error) {
        lastFocus.focus();
      }
    }
    announceEvent("nyxel:close", { state: "IDLE" });
  }

  function playSound(type) {
    if (!config.sounds || destroyed) {
      return;
    }
    try {
      var AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) {
        return;
      }
      audioContext = audioContext || new AudioClass();
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      var now = audioContext.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(type === "success" ? 720 : 520, now);
      oscillator.frequency.exponentialRampToValueAtTime(type === "success" ? 980 : 680, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.12);
    } catch (error) {
      // Sound is optional; a blocked AudioContext must never affect the widget.
    }
  }

  function resetParallax() {
    if (!root) {
      return;
    }
    root.style.setProperty("--nyxel-rx", "0deg");
    root.style.setProperty("--nyxel-ry", "0deg");
    root.style.setProperty("--nyxel-tx", "0px");
    root.style.setProperty("--nyxel-ty", "0px");
  }

  function updateParallax(event) {
    if (!motionEnabled || panelOpen || event.pointerType === "touch") {
      return;
    }
    lastPointerType = event.pointerType || "mouse";
    var clientX = event.clientX;
    var clientY = event.clientY;
    if (pointerFrame) {
      return;
    }
    pointerFrame = window.requestAnimationFrame(function () {
      pointerFrame = 0;
      if (!avatarButton || destroyed) {
        return;
      }
      var rect = avatarButton.getBoundingClientRect();
      var x = clamp((clientX - rect.left) / Math.max(1, rect.width) - 0.5, -0.5, 0.5);
      var y = clamp((clientY - rect.top) / Math.max(1, rect.height) - 0.5, -0.5, 0.5);
      root.style.setProperty("--nyxel-rx", (-y * 4.6).toFixed(2) + "deg");
      root.style.setProperty("--nyxel-ry", (x * 5.6).toFixed(2) + "deg");
      root.style.setProperty("--nyxel-tx", (x * 2.4).toFixed(2) + "px");
      root.style.setProperty("--nyxel-ty", (y * 1.7).toFixed(2) + "px");
    });
  }

  function onAvatarPointerDown(event) {
    lastPointerType = event.pointerType || "mouse";
    registerActivity("pointer");
    if (panelOpen) {
      return;
    }
    setPose(lastPointerType === "touch" ? "TOUCH" : "ACTIVE");
  }

  function onAvatarClick(event) {
    if (panelOpen) {
      closePanel();
      return;
    }
    var keyboardActivation = event.detail === 0;
    var delay = motionEnabled && !keyboardActivation ? 230 : 1;
    playSound("touch");
    setTimer(openPanel, delay);
  }

  function onAvatarEnter(event) {
    if (event.pointerType === "touch" || panelOpen || currentState === "SLEEP") {
      return;
    }
    clearTimer(organicTimer);
    setPose("HOVER");
  }

  function onAvatarLeave() {
    resetParallax();
    if (!panelOpen && currentState !== "SLEEP" && requestedState !== "SLEEP") {
      setPose("IDLE").then(scheduleOrganic);
    }
  }

  function onDocumentPointerDown(event) {
    registerActivity(event.pointerType === "touch" ? "touch" : "pointer");
    if (!panelOpen || !root) {
      return;
    }
    var path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.indexOf(root) === -1 && !root.contains(event.target)) {
      closePanel({ restoreFocus: false });
    }
  }

  function onDocumentKeyDown(event) {
    registerActivity("keyboard");
    if (event.key === "Escape" && panelOpen) {
      event.preventDefault();
      closePanel();
    }
  }

  function onGlobalPointerMove(event) {
    var now = Date.now();
    if (now - lastGlobalMove.at < 420) {
      return;
    }
    if (lastGlobalMove.x === null) {
      lastGlobalMove = { x: event.clientX, y: event.clientY, at: now };
      return;
    }
    var dx = event.clientX - lastGlobalMove.x;
    var dy = event.clientY - lastGlobalMove.y;
    if (dx * dx + dy * dy >= 3600) {
      lastGlobalMove = { x: event.clientX, y: event.clientY, at: now };
      registerActivity("movement");
    }
  }

  function onActivityPulse(event) {
    var now = Date.now();
    if (now - lastActivityPulseAt < 420) {
      lastActivityAt = now;
      return;
    }
    lastActivityPulseAt = now;
    registerActivity(event && event.type ? event.type : "activity");
  }

  function onVisibilityChange() {
    if (!root) {
      return;
    }
    if (document.hidden) {
      root.classList.add("nyxel-is-paused");
      clearTimer(organicTimer);
      clearTimer(sleepTimer);
      clearTimer(signatureTimer);
      signatureTimer = 0;
      if (signaturePlaying) {
        finishSignature({ restorePose: false });
      }
      resetParallax();
    } else {
      root.classList.remove("nyxel-is-paused");
      scheduleSleep();
      scheduleSignature();
      if (!panelOpen && currentState !== "SLEEP") {
        setPose("IDLE").then(scheduleOrganic);
      }
    }
  }

  function onMotionPreferenceChange(event) {
    reducedMotion = Boolean(event.matches);
    motionEnabled = config.animations && !reducedMotion;
    root.classList.toggle("nyxel-motion-off", !motionEnabled);
    resetParallax();
    if (motionEnabled) {
      scheduleOrganic();
      scheduleSignature();
    } else {
      clearTimer(organicTimer);
      clearTimer(signatureTimer);
      signatureTimer = 0;
      if (signaturePlaying) {
        finishSignature({ restorePose: false });
      }
      setPose(panelOpen ? "CONTACT" : currentState === "SLEEP" ? "SLEEP" : "IDLE");
    }
  }

  function bindEvents() {
    listen(avatarButton, "pointerdown", onAvatarPointerDown, { passive: true });
    listen(avatarButton, "click", onAvatarClick);
    listen(avatarButton, "pointerenter", onAvatarEnter, { passive: true });
    listen(avatarButton, "pointerleave", onAvatarLeave, { passive: true });
    listen(avatarButton, "pointermove", updateParallax, { passive: true });
    listen(closeButton, "click", function () { closePanel(); });
    listen(emailButton, "click", function () {
      setPose("SUCCESS");
      playSound("success");
      announceEvent("nyxel:contact", { method: "email" });
    });
    Array.prototype.slice.call(root.querySelectorAll(".nyxel-link")).forEach(function (link) {
      listen(link, "click", function () {
        setPose("SUCCESS");
        playSound("success");
        announceEvent("nyxel:contact", { method: "external-link", href: link.href });
      });
    });
    listen(document, "pointerdown", onDocumentPointerDown, true);
    listen(document, "keydown", onDocumentKeyDown);
    listen(document, "input", onActivityPulse, true);
    listen(document, "change", onActivityPulse, true);
    listen(document, "scroll", onActivityPulse, { passive: true, capture: true });
    listen(document, "visibilitychange", onVisibilityChange);
    listen(window, "pointermove", onGlobalPointerMove, { passive: true });
    listen(window, "wheel", onActivityPulse, { passive: true });
    listen(window, "touchstart", function () { registerActivity("touch"); }, { passive: true });
    if (mediaReduced) {
      if (typeof mediaReduced.addEventListener === "function") {
        listen(mediaReduced, "change", onMotionPreferenceChange);
      } else if (typeof mediaReduced.addListener === "function") {
        mediaReduced.addListener(onMotionPreferenceChange);
        listeners.push(function () { mediaReduced.removeListener(onMotionPreferenceChange); });
      }
    }
  }

  function preloadAssets() {
    var priority = ["IDLE_ALT", "CONTACT", "TOUCH", "HOVER", "SLEEP", "WAKE", "WAVE"];
    var remainder = Object.keys(ASSETS).filter(function (state) {
      return state !== "IDLE" && priority.indexOf(state) === -1;
    });
    var queue = priority.concat(remainder);
    var index = 0;

    function loadNext(deadline) {
      if (destroyed || document.hidden || index >= queue.length) {
        return;
      }
      var state = queue[index++];
      ensureAsset(state).catch(function () { return null; }).finally(function () {
        if (index < queue.length) {
          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(loadNext, { timeout: 1600 });
          } else {
            setTimer(function () { loadNext(null); }, 110);
          }
        }
      });
      if (deadline && deadline.timeRemaining && deadline.timeRemaining() > 8 && index < queue.length) {
        // One asset per idle slice keeps bandwidth and decoding bursts gentle.
      }
    }

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(loadNext, { timeout: 1400 });
    } else {
      setTimer(function () { loadNext(null); }, 900);
    }
  }

  function runGreeting() {
    root.classList.add("nyxel-first-greeting");
    setTimer(function () { root.classList.remove("nyxel-first-greeting"); }, motionEnabled ? 3400 : 1300);
    if (!config.greeting || !motionEnabled) {
      setPose("IDLE").then(scheduleOrganic);
      return;
    }
    setPose("WAKE").then(function () {
      setTimer(function () {
        if (!panelOpen) {
          setState("WAVE", { hold: 1250, returnTo: "IDLE" });
        }
      }, 620);
    });
  }

  function setMotion(enabled) {
    config.animations = enabled !== false;
    motionEnabled = config.animations && !reducedMotion;
    root.classList.toggle("nyxel-motion-off", !motionEnabled);
    resetParallax();
    if (motionEnabled) {
      scheduleOrganic();
      scheduleSignature();
    } else {
      clearTimer(organicTimer);
      clearTimer(signatureTimer);
      signatureTimer = 0;
      if (signaturePlaying) {
        finishSignature({ restorePose: false });
      }
      setPose(panelOpen ? "CONTACT" : currentState === "SLEEP" ? "SLEEP" : "IDLE");
    }
    return motionEnabled;
  }

  function setPosition(position) {
    config.position = normalizePosition(position);
    root.dataset.position = config.position;
    return config.position;
  }

  function destroy() {
    if (destroyed) {
      return;
    }
    destroyed = true;
    timers.forEach(function (timer) { window.clearTimeout(timer); });
    timers.clear();
    if (pointerFrame) {
      window.cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
    }
    listeners.splice(0).forEach(function (remove) { remove(); });
    if (audioContext && typeof audioContext.close === "function") {
      audioContext.close().catch(function () { return null; });
    }
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
    if (window.NYXEL) {
      window.NYXEL.__mounted = false;
    }
  }

  function initialize() {
    if (destroyed || root || !document.body) {
      return;
    }
    createDom();
    loadedAssets.IDLE = false;
    ensureAsset("IDLE").then(function () {
      loadedAssets.IDLE = true;
    }).catch(function () { return null; });
    root.classList.toggle("nyxel-motion-off", !motionEnabled);
    bindEvents();
    runGreeting();
    scheduleSleep();
    scheduleSignature();
    preloadAssets();

    window.NYXEL = {
      __mounted: true,
      version: VERSION,
      states: Object.keys(ASSETS),
      open: openPanel,
      close: closePanel,
      wake: wake,
      destroy: destroy,
      setState: function (state, options) { return setState(state, options); },
      setPosition: setPosition,
      setMotion: setMotion,
      playSignature: function () { return playSignature({ force: true }); },
      getState: function () { return requestedState; },
      isOpen: function () { return panelOpen; },
      isSignaturePlaying: function () { return signaturePlaying; },
      getElement: function () { return root; }
    };

    announceEvent("nyxel:ready", {
      version: VERSION,
      state: requestedState,
      reducedMotion: reducedMotion
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
