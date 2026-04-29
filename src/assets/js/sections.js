// cs-navigation
(function(__rd, __sw) {
  var __sid = "tpl-uicompass-com-cs-navigation";
  var __eid = "cs-navigation";

  function __rw(s) {
    var escaped = __sid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('#' + escaped + '(?=[\\s.:\\[,>+~]|$)', 'g');
    return s.replace(re, '#' + __eid);
  }
  var __bodyProxy = null;
  var __bodyClassListProxy = null;
  function __isBodySelector(s) {
    return typeof s === 'string' && s.trim().toLowerCase() === 'body';
  }
  function __getSectionRoot() {
    return __rd.getElementById(__eid);
  }
  function __mirrorScrollClass(enabled) {
    var root = __getSectionRoot();
    if (!root || !root.classList) return;
    root.classList.toggle('scroll', !!enabled);
  }
  function __argsIncludeScroll(args) {
    for (var i = 0; i < args.length; i++) {
      if (args[i] === 'scroll') return true;
    }
    return false;
  }
  function __getBodyProxy(body) {
    if (!body) return body;
    if (__bodyProxy) return __bodyProxy;
    __bodyProxy = new Proxy(body, {
      get: function(bt, bp) {
        if (bp === 'classList') {
          if (__bodyClassListProxy) return __bodyClassListProxy;
          __bodyClassListProxy = new Proxy(bt.classList, {
            get: function(cl, cp) {
              if (cp === 'add') return function() {
                var result = cl.add.apply(cl, arguments);
                if (__argsIncludeScroll(arguments)) __mirrorScrollClass(true);
                return result;
              };
              if (cp === 'remove') return function() {
                var result = cl.remove.apply(cl, arguments);
                if (__argsIncludeScroll(arguments)) __mirrorScrollClass(false);
                return result;
              };
              if (cp === 'toggle') return function(token, force) {
                var result = cl.toggle.apply(cl, arguments);
                if (token === 'scroll') __mirrorScrollClass(arguments.length > 1 ? !!force : result);
                return result;
              };
              if (cp === 'replace') return function(oldToken, newToken) {
                var result = cl.replace.apply(cl, arguments);
                if (oldToken === 'scroll') __mirrorScrollClass(false);
                if (newToken === 'scroll' && result) __mirrorScrollClass(true);
                return result;
              };
              var cv = cl[cp]; return typeof cv === 'function' ? cv.bind(cl) : cv;
            }
          });
          return __bodyClassListProxy;
        }
        var bv = bt[bp]; return typeof bv === 'function' ? bv.bind(bt) : bv;
      }
    });
    return __bodyProxy;
  }

  var document = new Proxy(__rd, {
    get: function(t, p) {
      if (p === 'body') return __getBodyProxy(t.body);
      if (p === 'querySelector') return function(s) { return __isBodySelector(s) ? __getBodyProxy(t.body) : t.querySelector(__rw(s)); };
      if (p === 'querySelectorAll') return function(s) { return t.querySelectorAll(__rw(s)); };
      if (p === 'getElementById') return function(id) { return id === __sid ? t.getElementById(__eid) : t.getElementById(id); };
      var v = t[p]; return typeof v === 'function' ? v.bind(t) : v;
    }
  });

  var window = new Proxy(__sw, {
    get: function(t, p) {
      if (p === 'document') return document;
      var v = t[p]; return typeof v === 'function' ? v.bind(t) : v;
    }
  });

  try {
    // Scroll handler for nav background
document.addEventListener('scroll', function () {
  var scroll = document.documentElement.scrollTop;
  if (scroll >= 100) {
    document.body.classList.add('scroll');
  } else {
    document.body.classList.remove('scroll');
  }
});
  } catch(e) {
    console.error('[Section JS error in ' + __eid + ']:', e);
  }
})(document, self);

// faq-1261
(function(__rd, __sw) {
  var __sid = "tpl-bluffcitywebdesigns-com-faq-1261";
  var __eid = "faq-1261";

  function __rw(s) {
    var escaped = __sid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('#' + escaped + '(?=[\\s.:\\[,>+~]|$)', 'g');
    return s.replace(re, '#' + __eid);
  }
  var __bodyProxy = null;
  var __bodyClassListProxy = null;
  function __isBodySelector(s) {
    return typeof s === 'string' && s.trim().toLowerCase() === 'body';
  }
  function __getSectionRoot() {
    return __rd.getElementById(__eid);
  }
  function __mirrorScrollClass(enabled) {
    var root = __getSectionRoot();
    if (!root || !root.classList) return;
    root.classList.toggle('scroll', !!enabled);
  }
  function __argsIncludeScroll(args) {
    for (var i = 0; i < args.length; i++) {
      if (args[i] === 'scroll') return true;
    }
    return false;
  }
  function __getBodyProxy(body) {
    if (!body) return body;
    if (__bodyProxy) return __bodyProxy;
    __bodyProxy = new Proxy(body, {
      get: function(bt, bp) {
        if (bp === 'classList') {
          if (__bodyClassListProxy) return __bodyClassListProxy;
          __bodyClassListProxy = new Proxy(bt.classList, {
            get: function(cl, cp) {
              if (cp === 'add') return function() {
                var result = cl.add.apply(cl, arguments);
                if (__argsIncludeScroll(arguments)) __mirrorScrollClass(true);
                return result;
              };
              if (cp === 'remove') return function() {
                var result = cl.remove.apply(cl, arguments);
                if (__argsIncludeScroll(arguments)) __mirrorScrollClass(false);
                return result;
              };
              if (cp === 'toggle') return function(token, force) {
                var result = cl.toggle.apply(cl, arguments);
                if (token === 'scroll') __mirrorScrollClass(arguments.length > 1 ? !!force : result);
                return result;
              };
              if (cp === 'replace') return function(oldToken, newToken) {
                var result = cl.replace.apply(cl, arguments);
                if (oldToken === 'scroll') __mirrorScrollClass(false);
                if (newToken === 'scroll' && result) __mirrorScrollClass(true);
                return result;
              };
              var cv = cl[cp]; return typeof cv === 'function' ? cv.bind(cl) : cv;
            }
          });
          return __bodyClassListProxy;
        }
        var bv = bt[bp]; return typeof bv === 'function' ? bv.bind(bt) : bv;
      }
    });
    return __bodyProxy;
  }

  var document = new Proxy(__rd, {
    get: function(t, p) {
      if (p === 'body') return __getBodyProxy(t.body);
      if (p === 'querySelector') return function(s) { return __isBodySelector(s) ? __getBodyProxy(t.body) : t.querySelector(__rw(s)); };
      if (p === 'querySelectorAll') return function(s) { return t.querySelectorAll(__rw(s)); };
      if (p === 'getElementById') return function(id) { return id === __sid ? t.getElementById(__eid) : t.getElementById(id); };
      var v = t[p]; return typeof v === 'function' ? v.bind(t) : v;
    }
  });

  var window = new Proxy(__sw, {
    get: function(t, p) {
      if (p === 'document') return document;
      var v = t[p]; return typeof v === 'function' ? v.bind(t) : v;
    }
  });

  try {
    
const faqItems = Array.from(document.querySelectorAll('.cs-faq-item'));
        for (const item of faqItems) {
            const onClick = () => {
            item.classList.toggle('active')
        }
        item.addEventListener('click', onClick)
        }

  } catch(e) {
    console.error('[Section JS error in ' + __eid + ']:', e);
  }
})(document, self);