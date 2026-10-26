(function () {
  function webRoot() {
    var path = location.pathname.replace(/\\/g, "/");
    if (/\/editor\/v[^/]+/.test(path)) return "../../";
    if (path.indexOf("/editor/") !== -1) return "../";
    return "./";
  }

  var root = webRoot();
  document.querySelectorAll("[data-tail]").forEach(function (a) {
    a.href = root + a.getAttribute("data-tail");
  });
})();
