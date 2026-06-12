/**
 * Міст для адмінки: API + сесія (React реєструє apiFetch через BosoAuth у useAdminUiBridge).
 */
(function () {
  var API_URL = "/api/core";
  window.BOSO_API_URL = API_URL;

  function getAuth() {
    try {
      return {
        adminEmail: sessionStorage.getItem("adminEmail") || "",
        sessionToken: sessionStorage.getItem("adminSessionToken") || "",
      };
    } catch (e) {
      return { adminEmail: "", sessionToken: "" };
    }
  }

  window.BosoAuth = window.BosoAuth || {
    logout: function () {
      try {
        sessionStorage.removeItem("adminSessionToken");
        sessionStorage.removeItem("adminEmail");
      } catch (e) {}
      var login = document.getElementById("auth-login-screen");
      var app = document.getElementById("admin-app");
      if (login) login.style.display = "flex";
      if (app) app.style.display = "none";
    },
    isAuthenticated: function () {
      return !!getAuth().sessionToken;
    },
    bootstrap: function (callback) {
      if (typeof callback === "function") callback();
    },
    apiFetch: function (url, init) {
      var auth = getAuth();
      var tenant =
        window.__ADMIN_TENANT_ID__ ||
        (typeof URLSearchParams !== "undefined"
          ? new URLSearchParams(window.location.search).get("tenant")
          : "") ||
        "";

      var headers = new Headers((init && init.headers) || {});
      if (tenant) headers.set("x-tenant-id", tenant);

      var finalUrl = url;
      if (!init || init.method !== "POST") {
        var u = new URL(url, window.location.origin);
        if (auth.adminEmail) u.searchParams.set("adminEmail", auth.adminEmail);
        if (auth.sessionToken) u.searchParams.set("sessionToken", auth.sessionToken);
        finalUrl = u.pathname + u.search;
      }

      var body = init && init.body;
      if (init && init.method === "POST" && typeof body === "string") {
        try {
          var parsed = JSON.parse(body);
          if (tenant) parsed.tenant_id = parsed.tenant_id || tenant;
          parsed.adminEmail = parsed.adminEmail || auth.adminEmail;
          parsed.sessionToken = parsed.sessionToken || auth.sessionToken;
          body = JSON.stringify(parsed);
        } catch (e) {}
      }

      return fetch(finalUrl, Object.assign({}, init, { headers: headers, body: body })).then(
        function (res) {
          if (res.status === 401) {
            var err = new Error("UNAUTHORIZED");
            return Promise.reject(err);
          }
          return res;
        }
      );
    },
    parseApiJson: function (res) {
      return res.json();
    },
    handleApiAuthError: function (data) {
      return data && data.error === "UNAUTHORIZED";
    },
  };
})();
