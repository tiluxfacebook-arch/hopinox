/* COD landing: tracking IDs (fbp/fbc/ttp/ttclid/external_id/UTM/IP), pixel loader,
 * form đặt hàng, validate SĐT VN, gửi đơn về Apps Script, bắt form bỏ dở.
 * Event browser (CompleteRegistration/Lead/SubmitForm) bắn ở cam-on.html để chỉ tính đơn đã lưu. */
(function () {
  'use strict';
  var C = window.COD_CONFIG || {};
  // localStorage/sessionStorage có thể bị chặn (chế độ riêng tư, iframe) → dùng bộ nhớ tạm, không làm hỏng trang
  function safeStore(name) {
    try { var s = window[name]; s.setItem('__t', '1'); s.removeItem('__t'); return s; } catch (e) {
      var m = {}; return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } };
    }
  }
  var LS = safeStore('localStorage'), SS = safeStore('sessionStorage');
  var isSet = function (v) { return v && String(v).indexOf('YOUR_') !== 0; };

  // ---------- Chặn IP (tab ChanIP trong Google Sheet) ----------
  // IP bị chặn → thay trang bằng màn "Trang đang bảo trì" (không hiện sản phẩm/giá), không tải pixel, không có form.
  // Khách thường không bị chậm: kiểm tra chạy nền, hết giờ/lỗi mạng → cho xem bình thường (fail-open).
  var BLK = 'cod_ipb';
  function blockedCached() {
    try { var v = JSON.parse(LS.getItem(BLK) || 'null'); return !!(v && v.b && Date.now() - v.t < 864e5); } catch (e) { return false; }
  }
  function showMaintenance() {
    window.__codPixels = true; // chặn tải pixel
    var go = function () {
      document.title = 'Trang đang bảo trì';
      document.body.innerHTML = '<main style="max-width:420px;margin:30vh auto 0;padding:0 24px;text-align:center;font:16px/1.6 system-ui,sans-serif;color:#444">' +
        '<h1 style="font-size:22px;margin:0 0 8px">Trang đang bảo trì</h1><p>Vui lòng quay lại sau. Xin cảm ơn!</p></main>';
    };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }
  var blocked = blockedCached();
  if (blocked) showMaintenance();

  // ---------- Cookies & IDs ----------
  function getCookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; }
  function setCookie(n, v, days) {
    var d = new Date(Date.now() + days * 864e5);
    document.cookie = n + '=' + encodeURIComponent(v) + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax';
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function externalId() {
    var id = LS.getItem('cod_xid');
    if (!id) { id = uuid(); LS.setItem('cod_xid', id); }
    return id;
  }

  var qs = new URLSearchParams(location.search);
  // fbp dự phòng (cod_fbp_fallback): nếu pixel bị chặn/chưa kịp tải thì tự tạo _fbp đúng định dạng Meta (fb.1.<ms>.<số ngẫu nhiên>)
  if (isSet(C.META_PIXEL_ID) && !getCookie('_fbp')) setCookie('_fbp', 'fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 1e10), 90);
  // fbc: fb.1.<ms lúc click>.<fbclid> — chỉ tạo mới khi fbclid đổi
  var fbclid = qs.get('fbclid');
  if (fbclid) {
    var curFbc = getCookie('_fbc');
    if (!curFbc || curFbc.split('.').slice(3).join('.') !== fbclid) setCookie('_fbc', 'fb.1.' + Date.now() + '.' + fbclid, 90);
  }
  if (qs.get('ttclid')) { setCookie('cod_ttclid', qs.get('ttclid'), 30); }
  // UTM: last non-empty touch, giữ 30 ngày
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  if (UTM.some(function (k) { return qs.get(k); })) {
    var u = { t: Date.now() }; UTM.forEach(function (k) { u[k] = qs.get(k) || ''; });
    LS.setItem('cod_utm', JSON.stringify(u));
  }
  function utm() {
    try { var u = JSON.parse(LS.getItem('cod_utm') || '{}'); return Date.now() - (u.t || 0) < 30 * 864e5 ? u : {}; } catch (e) { return {}; }
  }
  externalId();

  // ---------- IP (lazy, khi khách bắt đầu điền form) ----------
  var ipPromise = null;
  function getIp() {
    if (!C.IP_LOOKUP) return Promise.resolve('');
    if (ipPromise) return ipPromise;
    var cached = SS.getItem('cod_ip');
    if (cached) return (ipPromise = Promise.resolve(cached));
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { ctl && ctl.abort(); }, 2000);
    ipPromise = fetch(C.IP_LOOKUP, { signal: ctl && ctl.signal }).then(function (r) { return r.json(); })
      .then(function (j) { clearTimeout(t); SS.setItem('cod_ip', j.ip || ''); return j.ip || ''; })
      .catch(function () { return ''; });
    return ipPromise;
  }

  // ---------- Pixels (tải sau khi trang hiển thị để không hại LCP) ----------
  window.codLoadPixels = function (meta) {
    if (window.__codPixels || blocked) return; window.__codPixels = true;
    if (isSet(C.META_PIXEL_ID)) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      // Advanced matching: Meta tự hash các giá trị thô này trên trình duyệt
      // META_PIXEL_ID có thể là nhiều pixel cách nhau dấu phẩy → init từng pixel
      String(C.META_PIXEL_ID).split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (pid) {
        fbq('init', pid, Object.assign({ external_id: externalId(), country: 'vn' }, (meta && meta.fb) || {}));
      });
      fbq('track', 'PageView');
    }
    if (isSet(C.TIKTOK_PIXEL_ID)) {
      !function (w, d, t) { w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"], ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }; for (var i = 0; i < ttq.methods.length; i++)ttq.setAndDefer(ttq, ttq.methods[i]); ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++)ttq.setAndDefer(e, ttq.methods[n]); return e }, ttq.load = function (e, n) { var r = "https://analytics.tiktok.com/i18n/pixel/events.js"; ttq._i = ttq._i || {}, ttq._i[e] = [], ttq._i[e]._u = r, ttq._t = ttq._t || {}, ttq._t[e] = +new Date, ttq._o = ttq._o || {}, ttq._o[e] = n || {}; var o = document.createElement("script"); o.type = "text/javascript", o.async = !0, o.src = r + "?sdkid=" + e + "&lib=" + t; var a = document.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a) }; }(window, document, 'ttq');
      ttq.load(C.TIKTOK_PIXEL_ID);
      if (meta && meta.tt) ttq.identify(meta.tt);
      ttq.page();
    }
  };

  window.codSha256 = function (s) {
    if (!s || !window.crypto || !crypto.subtle) return Promise.resolve('');
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
      return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    });
  };
  window.codIds = function () {
    return { external_id: externalId(), fbp: getCookie('_fbp'), fbc: getCookie('_fbc'), ttp: getCookie('_ttp'), ttclid: getCookie('cod_ttclid') };
  };

  // Trang cảm ơn tự gọi codLoadPixels kèm dữ liệu khách; trang landing tải pixel khi rảnh
  if (!document.documentElement.hasAttribute('data-thankyou')) {
    var idle = window.requestIdleCallback || function (f) { setTimeout(f, 1500); };
    window.addEventListener('load', function () { idle(function () { window.codLoadPixels(); }); });
    setTimeout(function () { window.codLoadPixels(); }, 2500); // đảm bảo pixel chạy dù trang tải chậm
  }

  // Hỏi web app 1 lần/phiên: IP này có trong ChanIP không (chạy nền, timeout 4s, lỗi → cho xem)
  if (!blocked && isSet(C.ENDPOINT) && C.IP_BLOCK_CHECK !== false && C.IP_LOOKUP && !SS.getItem('cod_ipc') &&
      !document.documentElement.hasAttribute('data-thankyou')) {
    getIp().then(function (ip) {
      if (!ip) return;
      var ctl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { ctl && ctl.abort(); }, 4000);
      return fetch(C.ENDPOINT + '?check=1&ip=' + encodeURIComponent(ip), { signal: ctl && ctl.signal })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          clearTimeout(t);
          SS.setItem('cod_ipc', '1');
          if (j && j.b === true) { blocked = true; LS.setItem(BLK, JSON.stringify({ b: 1, t: Date.now() })); showMaintenance(); }
        });
    }).catch(function () { });
  }

  // ---------- Form đặt hàng ----------
  var form = document.getElementById('order-form');
  if (!form || blocked) return;

  function normPhone(raw) {
    var d = String(raw || '').replace(/[^\d+]/g, '');
    if (d.indexOf('+84') === 0) d = '0' + d.slice(3); else if (/^84\d{9}$/.test(d)) d = '0' + d.slice(2);
    d = d.replace(/\D/g, '');
    return /^0[35789]\d{8}$/.test(d) ? d : '';
  }
  function fmt(n) { return n.toLocaleString('vi-VN') + 'đ'; }
  function pkg() {
    var v = (form.querySelector('input[name=package]:checked') || {}).value;
    return (C.PACKAGES || []).filter(function (p) { return p.key === v; })[0] || C.PACKAGES[0];
  }
  function total() { var p = pkg(); return p.price + (p.ship || 0); }
  function refreshTotal() {
    var t = fmt(total());
    document.querySelectorAll('[data-total]').forEach(function (el) { el.textContent = t; });
  }
  form.addEventListener('change', function (e) { if (e.target.name === 'package') refreshTotal(); });
  refreshTotal();

  var rules = {
    name: function (v) { return v.trim().length >= 2 ? '' : 'Vui lòng nhập tên của bạn'; },
    phone: function (v) { return normPhone(v) ? '' : 'Số điện thoại chưa đúng (10 số, bắt đầu 03/05/07/08/09)'; },
    province: function (v) { return v ? '' : 'Vui lòng chọn Tỉnh/Thành phố'; },
    ward: function (v) { return v.trim().length >= 2 ? '' : 'Vui lòng nhập Phường/Xã'; },
    address: function (v) { return v.trim().length >= 5 ? '' : 'Vui lòng nhập số nhà, tên đường/thôn'; },
    // (đã bỏ ô tick đồng ý — dùng thông báo đồng ý ngay trên nút Đặt hàng)
  };
  function check(el) {
    var f = rules[el.name]; if (!f) return true;
    var msg = f(el.value, el);
    var box = form.querySelector('[data-err="' + el.name + '"]');
    if (box) box.textContent = msg;
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  var startedAt = 0;
  form.addEventListener('focusin', function () { if (!startedAt) { startedAt = Date.now(); getIp(); } });
  form.addEventListener('focusout', function (e) { if (e.target.value && e.target.type !== 'checkbox') check(e.target); });
  form.addEventListener('change', function (e) { if (e.target.name === 'consent_order') check(e.target); });

  function payload(type) {
    var p = pkg(), ids = window.codIds(), u = utm(), fd = new FormData(form);
    var o = {
      type: type, name: fd.get('name'), phone: normPhone(fd.get('phone')) || fd.get('phone'),
      province: fd.get('province'), ward: fd.get('ward'), address: fd.get('address'), note: fd.get('note') || '', color: fd.getAll('color').join(', '), fbclid: qs.get('fbclid') || '',
      website: fd.get('website'), // honeypot
      product_id: C.PRODUCT.id, product_name: C.PRODUCT.name, package: p.label, quantity: p.qty,
      unit_price: Math.round(p.price / p.qty), value: total(), currency: 'VND',
      page_url: location.href, referrer: document.referrer, ua: navigator.userAgent,
      fill_ms: startedAt ? Date.now() - startedAt : 0, consent: true /* đồng ý qua thông báo trên nút đặt hàng */, session_id: externalId(),
      pixel_id: isSet(C.META_PIXEL_ID) ? C.META_PIXEL_ID : '' // để sheet cảnh báo khi dataset khác pixel
    };
    Object.keys(ids).forEach(function (k) { o[k] = ids[k]; });
    UTM.forEach(function (k) { o[k] = u[k] || ''; });
    return o;
  }

  // Form bỏ dở (tắt mặc định): gửi 1 lần khi khách rời trang với SĐT hợp lệ
  var submitted = false, abandonSent = false;
  if (C.ABANDON_CAPTURE && isSet(C.ENDPOINT)) {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'hidden' || submitted || abandonSent) return;
      var o = payload('abandon');
      if (!normPhone(o.phone)) return;
      abandonSent = true;
      navigator.sendBeacon(C.ENDPOINT, new Blob([JSON.stringify(o)], { type: 'text/plain' }));
    });
  }

  function newOrderId() {
    var d = new Date(), pad = function (n) { return ('0' + n).slice(-2); };
    return 'OD' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
      Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (blocked) return;
    var ok = true;
    Object.keys(rules).forEach(function (n) { if (!check(form.elements[n])) ok = false; });
    if (!ok) { var bad = form.querySelector('[aria-invalid=true]'); if (bad) bad.focus(); return; }
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.textContent = 'Đang gửi đơn…';
    var errBox = document.getElementById('form-error'); errBox.hidden = true;

    getIp().then(function (ip) {
      var o = payload('order');
      o.ip = ip;
      o.order_id = SS.getItem('cod_pending_oid') || newOrderId(); // giữ nguyên mã khi bấm lại → không tạo đơn trùng
      o.event_id = o.order_id;
      SS.setItem('cod_pending_oid', o.order_id);
      if (!isSet(C.ENDPOINT)) return { ok: true, id: o.order_id, demo: true, o: o };
      var send = function () {
        return fetch(C.ENDPOINT, { method: 'POST', body: JSON.stringify(o) }) // text/plain → không preflight CORS
          .then(function (r) { return r.json(); });
      };
      return send().catch(function () { return send(); }).then(function (j) { j.o = o; return j; });
    }).then(function (j) {
      if (!j || !j.ok) throw new Error(j && j.error || 'save');
      submitted = true;
      SS.removeItem('cod_pending_oid');
      var o = j.o;
      SS.setItem('cod_last_order', JSON.stringify({
        order_id: o.order_id, event_id: o.event_id, value: o.value, qty: o.quantity, package: o.package,
        name: o.name, phone: o.phone, province: o.province, ward: o.ward, consent: o.consent && !j.nb /* IP bị chặn → trang cảm ơn không bắn event */, demo: !!j.demo
      }));
      location.href = C.THANKYOU_URL + '?oid=' + encodeURIComponent(o.order_id);
    }).catch(function (err) {
      btn.disabled = false; btn.innerHTML = btn.dataset.label;
      errBox.hidden = false;
      errBox.textContent = String(err.message) === 'phone'
        ? 'Số điện thoại chưa đúng, vui lòng kiểm tra lại.'
        : 'Chưa gửi được đơn (mạng yếu?). Vui lòng bấm lại hoặc gọi/nhắn Zalo ' + C.HOTLINE + ' để đặt nhanh.';
    });
  });
})();
