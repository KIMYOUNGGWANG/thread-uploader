/**
 * Threads Uploader Attribution Tracker SDK
 * Light-weight, dependency-free client tracker for Landing Pages & Checkout Flows.
 *
 * Automatically preserves `pid` / `utm_content` across:
 * - Threads In-App Browser sessions
 * - External Browser transitions (Safari / Chrome)
 * - Payment Gateway redirects (Stripe / Toss Payments)
 */
(function (window, document) {
  "use strict";

  var STORAGE_KEY = "tu_pid";
  var COOKIE_NAME = "tu_pid";
  var COOKIE_DAYS = 30;

  function setCookie(name, value, days) {
    try {
      var expires = "";
      if (days) {
        var date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = "; expires=" + date.toUTCString();
      }
      document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/; SameSite=Lax";
    } catch (e) {
      // Storage restricted
    }
  }

  function getCookie(name) {
    try {
      var nameEQ = name + "=";
      var ca = document.cookie.split(";");
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === " ") c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    } catch (e) {
      // Storage restricted
    }
    return null;
  }

  function getUrlParam(param) {
    try {
      var urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param);
    } catch (e) {
      return null;
    }
  }

  // 1. Extract Post ID from URL
  var currentPid = getUrlParam("pid") || getUrlParam("utm_content") || getUrlParam("postId");

  if (currentPid && currentPid !== "{{postId}}") {
    try {
      window.localStorage.setItem(STORAGE_KEY, currentPid);
    } catch (e) {}
    setCookie(COOKIE_NAME, currentPid, COOKIE_DAYS);
  }

  // 2. Expose Public Helper Methods
  window.ThreadsAttribution = {
    getPostId: function () {
      var fromUrl = getUrlParam("pid") || getUrlParam("utm_content") || getUrlParam("postId");
      if (fromUrl && fromUrl !== "{{postId}}") return fromUrl;
      try {
        var fromLocal = window.localStorage.getItem(STORAGE_KEY);
        if (fromLocal) return fromLocal;
      } catch (e) {}
      return getCookie(COOKIE_NAME);
    },

    reportConversion: function (options) {
      var opts = options || {};
      var postId = opts.postId || window.ThreadsAttribution.getPostId();
      if (!postId) {
        console.warn("[ThreadsAttribution] No postId found to attribute conversion.");
        return Promise.resolve({ success: false, reason: "missing_post_id" });
      }

      var endpoint = opts.endpoint || "/api/webhooks/conversion";
      var payload = {
        postId: postId,
        eventType: opts.eventType || "paid_conversion",
        amount: typeof opts.amount === "number" ? opts.amount : 0,
        sessionId: opts.sessionId || ("sess_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6)),
        secret: opts.secret,
      };

      return fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(function (res) {
        return res.json();
      });
    },
  };
})(window, document);
