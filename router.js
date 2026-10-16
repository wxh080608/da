/* ===========================================================
 * router.js —— Hash 路由（支持 /path/:id 与 query）
 * 为什么用 hash 路由：静态托管无需服务端 rewrite，file:// 也能跑
 * =========================================================== */
(function (window) {
  'use strict';
  var U = window.U;

  var ROUTES = [
    { path: '/', page: 'home' },
    { path: '/doctors', page: 'doctors' },
    { path: '/doctor/:id', page: 'doctor' },
    { path: '/consult/:id', page: 'consult' },
    { path: '/appointment', page: 'appointment' },
    { path: '/orders', page: 'orders' },
    { path: '/articles', page: 'articles' },
    { path: '/article/:id', page: 'article' }
  ];

  /** 解析 hash → {path, params, query} */
  function parse(hash) {
    var raw = String(hash || '').replace(/^#/, '');
    if (!raw || raw === '/') raw = '/';
    var qIndex = raw.indexOf('?');
    var query = {};
    var path = raw;
    if (qIndex !== -1) {
      path = raw.slice(0, qIndex);
      raw.slice(qIndex + 1).split('&').forEach(function (pair) {
        if (!pair) return;
        var kv = pair.split('=');
        query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    path = path.replace(/\/+$/, '') || '/';
    return { path: path, query: query };
  }

  /** 匹配路由表，返回 {page, params} */
  function match(path) {
    var segs = path.split('/').filter(Boolean);
    for (var i = 0; i < ROUTES.length; i++) {
      var r = ROUTES[i];
      var rSegs = r.path.split('/').filter(Boolean);
      if (rSegs.length !== segs.length) continue;
      var params = {}, ok = true;
      for (var j = 0; j < rSegs.length; j++) {
        if (rSegs[j].charAt(0) === ':') params[rSegs[j].slice(1)] = decodeURIComponent(segs[j]);
        else if (rSegs[j] !== segs[j]) { ok = false; break; }
      }
      if (ok) return { page: r.page, params: params };
    }
    return null;
  }

  var Router = {
    start: function () {
      window.addEventListener('hashchange', Router.render);
      Router.render();
    },

    /**
     * 用「空壳克隆 + 替换」的方式重置视图容器：
     * innerHTML 只会清空子节点，挂在容器上的事件监听器会残留并跨页面互相干扰，
     * 每次渲染替换成全新节点才能彻底解绑（等价于框架的 unmount 清理）。
     */
    resetView: function () {
      var old = document.getElementById('view');
      var fresh = old.cloneNode(false);
      fresh.innerHTML = '';
      old.parentNode.replaceChild(fresh, old);
      return fresh;
    },

    render: function () {
      var ctx = parse(window.location.hash);
      var hit = match(ctx.path);
      var view = Router.resetView();

      var page = hit ? window.Pages[hit.page] : null;

      // 404
      if (!page) {
        view.className = 'app-main';
        view.innerHTML = '<div class="container" style="padding-top:40px;text-align:center">' +
          '<div style="font-size:52px" aria-hidden="true">🩺</div>' +
          '<h2 style="margin:8px 0">页面走丢了</h2>' +
          '<p class="text-3">地址 <code>' + U.esc(ctx.path) + '</code> 不存在</p>' +
          '<a class="btn mt-16" href="#/">回到首页</a></div>';
        renderChrome();
        return;
      }

      // 渲染视图
      view.className = 'app-main' + (page.flush ? ' flush' : '');
      try {
        view.innerHTML = page.render({ params: hit.params, query: ctx.query });
      } catch (err) {
        view.innerHTML = '<div class="container" style="padding:24px">页面渲染出错：' + U.esc(err.message) + '</div>';
        if (window.console) console.error(err);
      }
      document.title = page.title || document.title;

      // 外壳（导航高亮、页脚、底部栏）
      renderChrome(page);

      // 页面级脚本
      if (typeof page.mount === 'function') {
        try { page.mount(view, { params: hit.params, query: ctx.query }); }
        catch (err) { if (window.console) console.error(err); }
      }

      window.scrollTo(0, 0);
    }
  };

  function renderChrome(page) {
    var headerEl = U.$('#siteHeader');
    var footerEl = U.$('#siteFooter');
    var tabbarEl = U.$('#tabBar');

    headerEl.innerHTML = window.UI.header();
    bindGlobalSearch(headerEl);

    footerEl.classList.toggle('hide', !!(page && page.hideFooter));
    if (!page || !page.hideFooter) footerEl.innerHTML = window.UI.footer();

    tabbarEl.classList.toggle('hide', !!(page && page.hideTabbar));
    if (!page || !page.hideTabbar) tabbarEl.innerHTML = window.UI.tabbar();
  }

  /** 顶部搜索框：回车跳转找医生页 */
  function bindGlobalSearch(scope) {
    var input = U.$('#globalSearch', scope);
    if (!input) return;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var kw = input.value.trim();
        U.go(kw ? '/doctors?q=' + encodeURIComponent(kw) : '/doctors');
      }
    });
  }

  window.Router = Router;
})(window);
