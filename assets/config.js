/* Cấu hình landing. Pixel ID + URL Apps Script là PUBLIC (ai mở trang cũng thấy) nên được để ở đây.
 * ACCESS TOKEN Meta/TikTok thì KHÔNG BAO GIỜ đặt ở đây — token chỉ nằm trong Script Properties của Apps Script (admin giữ).
 * ===== MẶC ĐỊNH CỦA CHỦ SHOP TILUX (xem tilux-defaults.md) — ĐƠN SẼ VỀ GOOGLE SHEET CỦA CHỦ SHOP =====
 * Muốn đổi sang sheet/pixel khác: chỉ sửa 3 dòng ENDPOINT / META_PIXEL_ID / TIKTOK_PIXEL_ID.
 * Giá trị bắt đầu bằng 'YOUR_' = tắt (chế độ demo: không gửi đơn, không tải pixel). */
window.COD_CONFIG = {
  ENDPOINT: 'https://script.google.com/macros/s/AKfycby6jK1gnEE28BiJyTs2iUNcfMEBVx4boBUd43VE4T993auEmfAJ5tGr8NaXbfi4EAZr/exec',
  META_PIXEL_ID: '4483197801948572,29525607110372842', // nhiều pixel: cách nhau dấu phẩy
  TIKTOK_PIXEL_ID: 'YOUR_TIKTOK_PIXEL_CODE', // chưa dùng; admin điền khi có
  // id = mã SKU ngắn, KHÔNG dấu (vd 'KPCT-MEO-01'); name = tên sản phẩm hiện trong Sheet
  PRODUCT: { id: 'HINOX-1500', name: 'Hộp inox 304 nắp kín 1500ml', currency: 'VND' },
  // Giá: price = tiền hàng của gói; ship = phí ship khách trả (0 = freeship). compare = giá gạch, CHỈ điền khi đã thật sự bán giá đó trước đây, không thì null.
  // Gói '1' được chọn sẵn (mặc định chủ shop). Gói '2' gắn nhãn "Phổ biến nhất" trong HTML.
  // Mỗi lần đổi giá ở đây phải đổi luôn chữ giá trong index.html (hero, bảng giá, form, FAQ, JSON-LD) — check_landing.py sẽ báo nếu lệch.
  PACKAGES: [
    { key: '1', label: 'Set 3 hộp', qty: 3, price: 149000, compare: null, note: 'Phí ship 20.000đ', ship: 20000 },
    { key: '2', label: 'Set 5 hộp', qty: 5, price: 229000, compare: null, note: 'Freeship', ship: 0, popular: true },
    { key: '3', label: 'Set 10 hộp', qty: 10, price: 399000, compare: null, note: 'Freeship', ship: 0 }
  ],
  UPSELL: null, // ví dụ { id: 'SKU-UP', name: 'Thêm 1 cái tặng người thân', price: 149000 } — luôn là lựa chọn khách tự tick
  HOTLINE: '0395018127',
  ZALO: 'https://zalo.me/0395018127',
  EMAIL: 'info.tilux@gmail.com',
  IP_LOOKUP: 'https://api64.ipify.org?format=json', // '' để tắt (IP giúp tăng điểm so khớp)
  ABANDON_CAPTURE: false,
  THANKYOU_URL: 'cam-on.html'
};
