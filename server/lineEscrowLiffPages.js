const buildShell = ({ title, subtitle, description, bodyHtml, script }) => `<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${title}</title>
    <style>
      :root {
        --bg-top: #f3f8ff;
        --bg-bottom: #f4fff8;
        --card: #ffffff;
        --line: #dbe3ef;
        --text: #0f172a;
        --muted: #5b6474;
        --accent: #1d4ed8;
        --accent-2: #0f766e;
        --danger: #dc2626;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Noto Sans Thai", "Segoe UI", Tahoma, sans-serif;
        color: var(--text);
        background: linear-gradient(160deg, var(--bg-top), var(--bg-bottom));
      }
      .container {
        width: min(980px, 100%);
        margin: 0 auto;
        padding: 16px 14px 30px;
      }
      .hero {
        border: 1px solid #c8d7eb;
        border-radius: 16px;
        padding: 14px;
        background:
          radial-gradient(circle at 100% 0, rgba(29, 78, 216, 0.15), transparent 55%),
          radial-gradient(circle at 0 100%, rgba(15, 118, 110, 0.12), transparent 60%),
          #ffffff;
        box-shadow: 0 10px 24px rgba(2, 6, 23, 0.08);
      }
      h1 { margin: 0; font-size: 1.2rem; }
      .subtitle { margin-top: 6px; font-size: 0.9rem; color: #334155; }
      .description { margin-top: 8px; font-size: 0.82rem; color: var(--muted); }
      .card {
        margin-top: 14px;
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
      }
      .row { display: grid; gap: 10px; }
      .row.two { grid-template-columns: 1fr; }
      .row.three { grid-template-columns: 1fr; }
      @media (min-width: 760px) {
        .row.two { grid-template-columns: 1fr 1fr; }
        .row.three { grid-template-columns: 1fr 1fr 1fr; }
      }
      label { display: block; font-size: 0.8rem; margin-bottom: 5px; color: #334155; font-weight: 600; }
      input[type="text"],
      input[type="number"],
      select,
      textarea {
        width: 100%;
        border: 1px solid #cfd8e3;
        border-radius: 10px;
        padding: 9px 10px;
        font: inherit;
        color: inherit;
        background: #fff;
      }
      textarea { min-height: 90px; resize: vertical; }
      input:focus, select:focus, textarea:focus {
        outline: none;
        border-color: #60a5fa;
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
      }
      .btn {
        border: 0;
        border-radius: 10px;
        padding: 10px 13px;
        font: inherit;
        font-size: 0.88rem;
        font-weight: 700;
        cursor: pointer;
      }
      .btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .btn.primary { color: #fff; background: linear-gradient(120deg, var(--accent), #1e3a8a); }
      .btn.secondary { color: #fff; background: linear-gradient(120deg, var(--accent-2), #0f766e); }
      .btn.warn { color: #fff; background: linear-gradient(120deg, #d97706, #b45309); }
      .btn.danger { color: #fff; background: linear-gradient(120deg, #dc2626, #b91c1c); }
      .btn.ghost { color: #1f2937; background: #f3f4f6; border: 1px solid #d1d5db; }
      .btn.upload { color: #0f172a; border: 1px solid #bfdbfe; background: #eff6ff; }
      .tiny { margin-top: 6px; font-size: 0.74rem; color: var(--muted); }
      .hidden { display: none !important; }
      .status {
        margin-top: 10px;
        border-radius: 10px;
        padding: 9px 10px;
        font-size: 0.84rem;
        border: 1px solid #bfdbfe;
        background: #eff6ff;
        color: #1e3a8a;
      }
      .status.error { border-color: #fecaca; background: #fef2f2; color: #991b1b; }
      .status.success { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
      .result {
        margin-top: 12px;
        border: 1px solid #dbe4f0;
        border-radius: 12px;
        padding: 12px;
        background: #fff;
      }
      .result h3 { margin: 0; font-size: 0.95rem; }
      .kv { margin-top: 8px; display: grid; grid-template-columns: 140px 1fr; gap: 6px; font-size: 0.8rem; }
      .kv .k { color: #64748b; }
      .kv .v { color: #0f172a; word-break: break-word; }
      .preview {
        margin-top: 10px;
        border: 1px dashed #c4cfde;
        border-radius: 10px;
        min-height: 110px;
        display: grid;
        place-items: center;
        color: #64748b;
        padding: 8px;
        background: #f8fbff;
      }
      .preview img {
        max-width: 100%;
        max-height: 240px;
        border-radius: 8px;
      }
      .qr {
        margin-top: 10px;
        border: 1px solid #dbeafe;
        background: #eff6ff;
        border-radius: 12px;
        padding: 10px;
      }
      .qr img {
        width: min(280px, 100%);
        height: auto;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        background: #fff;
      }
      a { color: #0369a1; }
    </style>
  </head>
  <body>
    <main class="container">
      <section class="hero">
        <h1>${title}</h1>
        <p class="subtitle">${subtitle}</p>
        <p class="description">${description}</p>
      </section>
      ${bodyHtml}
    </main>
    <script>${script}</script>
  </body>
</html>`;

const commonUtilsScript = `
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      if (char === '&') return '&amp;';
      if (char === '<') return '&lt;';
      if (char === '>') return '&gt;';
      if (char === '"') return '&quot;';
      return '&#39;';
    });
  }
  function showStatus(el, message, type) {
    el.classList.remove('hidden', 'error', 'success');
    el.textContent = String(message || '');
    if (type === 'error') el.classList.add('error');
    if (type === 'success') el.classList.add('success');
  }
  function hideStatus(el) {
    el.classList.add('hidden');
    el.textContent = '';
  }
  function parseDealIdFromLocation() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return String(params.get('dealId') || '').trim();
    } catch (_e) {
      return '';
    }
  }
  function parseGroupIdFromLocation() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return String(params.get('groupId') || '').trim();
    } catch (_e) {
      return '';
    }
  }
`;

export const renderLineEscrowDealPage = ({ maxSlipImageBytes = 0 } = {}) =>
  buildShell({
    title: 'สร้างดีลตัวกลางซื้อขาย',
    subtitle: 'ผู้ซื้อสร้างดีลและชำระเงินเข้าระบบก่อน',
    description:
      'กรอก Group ID ก่อนทุกครั้ง จากนั้นระบบจะตรวจดีลที่รอชำระของกลุ่มนี้ ถ้ามีจะเปิด QR เดิมให้ทันที ถ้าไม่มีจะแสดงฟอร์มสร้างดีลใหม่',
    bodyHtml: `
      <section class="card">
        <form id="escrow-create-form" class="row">
          <div>
            <label for="deal-group-id">รหัสกลุ่ม (Group ID)</label>
            <input id="deal-group-id" type="text" placeholder="วาง Group ID ของกลุ่ม LINE ที่ใช้งานดีลนี้" required />
            <p class="tiny">ถ้าเปิดจากปุ่ม LIFF ในกลุ่ม ระบบมักจะใส่ค่า Group ID ให้อัตโนมัติ</p>
            <button id="deal-group-confirm-btn" class="btn secondary" type="button" style="margin-top:8px;">ยืนยัน Group ID</button>
          </div>

          <div id="deal-input-fields" class="hidden">
            <div class="row two">
              <div>
                <label for="deal-buyer-name">ชื่อผู้ซื้อ</label>
                <input id="deal-buyer-name" type="text" placeholder="เช่น คุณเอ" />
              </div>
              <div>
                <label for="deal-seller-name">ชื่อผู้ขาย</label>
                <input id="deal-seller-name" type="text" placeholder="เช่น ร้าน B" required />
              </div>
            </div>

            <div class="row two">
              <div>
                <label for="deal-item-name">สินค้า</label>
                <input id="deal-item-name" type="text" placeholder="ชื่อสินค้า" required />
              </div>
              <div>
                <label for="deal-amount">ยอดเงิน (THB)</label>
                <input id="deal-amount" type="number" min="1" step="0.01" placeholder="1000" required />
              </div>
            </div>

            <div class="row two">
              <div>
                <label for="seller-payout-method">ช่องทางรับเงินของผู้ขาย</label>
                <select id="seller-payout-method" required>
                  <option value="bank">โอนเข้าบัญชีธนาคาร</option>
                  <option value="promptpay">โอนผ่าน PromptPay</option>
                  <option value="seller_qr">ผู้ขายแนบ QR รับเงิน</option>
                </select>
              </div>
              <div>
                <label for="deal-seller-user-id">LINE User ID ของผู้ขาย (ไม่บังคับ)</label>
                <input id="deal-seller-user-id" type="text" placeholder="Uxxxxxxxx" />
              </div>
            </div>

            <div id="seller-bank-fields" class="row two">
              <div>
                <label for="seller-bank-brand">ธนาคารผู้ขาย</label>
                <select id="seller-bank-brand" required>
                  <option value="">เลือกธนาคาร</option>
                  <option value="bbl">ธนาคารกรุงเทพ (BBL)</option>
                  <option value="kbank">ธนาคารกสิกรไทย (KBANK)</option>
                  <option value="ktb">ธนาคารกรุงไทย (KTB)</option>
                  <option value="scb">ธนาคารไทยพาณิชย์ (SCB)</option>
                  <option value="bay">ธนาคารกรุงศรีอยุธยา (BAY)</option>
                  <option value="ttb">ธนาคารทหารไทยธนชาต (TTB)</option>
                  <option value="gsb">ธนาคารออมสิน (GSB)</option>
                  <option value="baac">ธ.ก.ส. (BAAC)</option>
                  <option value="cimb">ธนาคารซีไอเอ็มบีไทย (CIMB)</option>
                  <option value="uob">ธนาคารยูโอบี (UOB)</option>
                  <option value="lhb">ธนาคารแลนด์ แอนด์ เฮ้าส์ (LHB)</option>
                </select>
              </div>
              <div>
                <label for="seller-bank-account">เลขบัญชีผู้ขาย</label>
                <input id="seller-bank-account" type="text" placeholder="เลขบัญชี" required />
              </div>
            </div>

            <div id="seller-promptpay-fields" class="row hidden">
              <div>
                <label for="seller-promptpay-number">เลข PromptPay ผู้ขาย</label>
                <input id="seller-promptpay-number" type="text" placeholder="เบอร์มือถือ/เลขบัตรประชาชน/e-Wallet ID" />
              </div>
            </div>

            <div id="seller-qr-fields" class="row hidden">
              <div>
                <label>QR รับเงินของผู้ขาย</label>
                <input id="seller-payout-qr-file" type="file" accept="image/*" class="hidden" />
                <button id="seller-payout-qr-btn" class="btn upload" type="button">อัปโหลด QR รับเงิน</button>
                <p class="tiny">รองรับเฉพาะไฟล์ภาพ ขนาดสูงสุด ${Math.max(0, Number(maxSlipImageBytes || 0))} bytes</p>
                <div id="seller-payout-qr-preview" class="preview">ยังไม่ได้อัปโหลด QR</div>
              </div>
            </div>

            <div class="row two">
              <div>
                <label for="seller-bank-account-name">ชื่อผู้รับเงินผู้ขาย</label>
                <input id="seller-bank-account-name" type="text" placeholder="ชื่อผู้รับเงินจริง" required />
              </div>
              <div>
                <label for="deal-note">รายละเอียดเพิ่มเติม</label>
                <input id="deal-note" type="text" placeholder="หมายเหตุ/เงื่อนไขสินค้า" />
              </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button id="deal-create-btn" class="btn primary" type="submit">สร้างดีล + สร้าง QR ชำระเงิน</button>
            </div>
          </div>
        </form>

        <div id="deal-payment-actions" class="hidden" style="display:flex; gap:10px; flex-wrap:wrap;">
          <button id="deal-check-btn" class="btn ghost hidden" type="button">เช็คสถานะชำระเงิน</button>
          <button id="deal-manual-paid-btn" class="btn warn hidden" type="button">ติ๊กว่าชำระเงินแล้ว (โหมดทดสอบ)</button>
          <button id="deal-cancel-btn" class="btn danger hidden" type="button">ยกเลิกดีล</button>
        </div>

        <div id="deal-status" class="status hidden"></div>
        <div id="deal-result" class="result hidden"></div>
      </section>
    `,
    script: `
      ${commonUtilsScript}

      var maxQrImageBytes = Number(${Math.max(0, Number(maxSlipImageBytes || 0))}) || 0;

      var form = document.getElementById('escrow-create-form');
      var dealFieldsWrap = document.getElementById('deal-input-fields');
      var paymentActionsWrap = document.getElementById('deal-payment-actions');
      var createBtn = document.getElementById('deal-create-btn');
      var groupConfirmBtn = document.getElementById('deal-group-confirm-btn');
      var checkBtn = document.getElementById('deal-check-btn');
      var manualPaidBtn = document.getElementById('deal-manual-paid-btn');
      var cancelBtn = document.getElementById('deal-cancel-btn');
      var statusBox = document.getElementById('deal-status');
      var resultBox = document.getElementById('deal-result');

      var groupInput = document.getElementById('deal-group-id');
      var buyerNameInput = document.getElementById('deal-buyer-name');
      var sellerNameInput = document.getElementById('deal-seller-name');
      var sellerUserIdInput = document.getElementById('deal-seller-user-id');
      var itemInput = document.getElementById('deal-item-name');
      var amountInput = document.getElementById('deal-amount');
      var noteInput = document.getElementById('deal-note');
      var payoutMethodInput = document.getElementById('seller-payout-method');
      var bankBrandInput = document.getElementById('seller-bank-brand');
      var bankAccountInput = document.getElementById('seller-bank-account');
      var promptpayInput = document.getElementById('seller-promptpay-number');
      var bankFieldsWrap = document.getElementById('seller-bank-fields');
      var promptpayFieldsWrap = document.getElementById('seller-promptpay-fields');
      var qrFieldsWrap = document.getElementById('seller-qr-fields');
      var payoutQrFileInput = document.getElementById('seller-payout-qr-file');
      var payoutQrBtn = document.getElementById('seller-payout-qr-btn');
      var payoutQrPreview = document.getElementById('seller-payout-qr-preview');
      var bankAccountNameInput = document.getElementById('seller-bank-account-name');

      var dealId = parseDealIdFromLocation();
      var groupReady = false;
      var isBusy = false;
      var sellerPayoutQrImage = null;

      var groupFromQuery = parseGroupIdFromLocation();
      if (groupFromQuery) {
        groupInput.value = groupFromQuery;
      }

      function getSelectedBankName() {
        if (!bankBrandInput.options || bankBrandInput.selectedIndex < 0) return '';
        return String(bankBrandInput.options[bankBrandInput.selectedIndex].text || '').trim();
      }

      function getPayoutMethodLabel(methodInput) {
        var method = String(methodInput || '').trim().toLowerCase();
        if (method === 'promptpay') return 'PromptPay';
        if (method === 'seller_qr') return 'QR ผู้ขาย';
        return 'ธนาคาร';
      }

      function isDealAwaitingPayment(deal) {
        var d = deal && typeof deal === 'object' ? deal : {};
        var status = String(d.status || '').trim().toLowerCase();
        var paymentStatus = String(d.paymentStatus || '').trim().toLowerCase();
        return Boolean(d.id) && status === 'awaiting_payment' && paymentStatus !== 'paid' && paymentStatus !== 'cancelled';
      }

      function setCreateFormVisible(visible) {
        dealFieldsWrap.classList.toggle('hidden', !visible);
      }

      function updateGroupButtonText() {
        if (isBusy) {
          groupConfirmBtn.textContent = groupReady ? 'กำลังประมวลผล...' : 'กำลังตรวจสอบ Group ID...';
          return;
        }
        groupConfirmBtn.textContent = groupReady ? 'เปลี่ยน Group ID' : 'ยืนยัน Group ID';
      }

      function setGroupReady(isReady) {
        groupReady = Boolean(isReady);
        groupInput.readOnly = groupReady;
        groupInput.setAttribute('aria-readonly', groupReady ? 'true' : 'false');
        updateGroupButtonText();
      }

      function setBusy(nextBusy) {
        isBusy = Boolean(nextBusy);
        createBtn.disabled = isBusy;
        groupConfirmBtn.disabled = isBusy;
        checkBtn.disabled = isBusy;
        manualPaidBtn.disabled = isBusy;
        cancelBtn.disabled = isBusy;
        createBtn.textContent = isBusy ? 'กำลังสร้างดีล...' : 'สร้างดีล + สร้าง QR ชำระเงิน';
        updateGroupButtonText();
      }

      function resetPayoutQrPreview() {
        sellerPayoutQrImage = null;
        payoutQrPreview.textContent = 'ยังไม่ได้อัปโหลด QR';
      }

      function updatePayoutMethodFields() {
        var method = String(payoutMethodInput.value || 'bank').trim().toLowerCase();
        var isBank = method === 'bank';
        var isPromptpay = method === 'promptpay';
        var isSellerQr = method === 'seller_qr';

        bankFieldsWrap.classList.toggle('hidden', !isBank);
        promptpayFieldsWrap.classList.toggle('hidden', !isPromptpay);
        qrFieldsWrap.classList.toggle('hidden', !isSellerQr);

        bankBrandInput.required = isBank;
        bankAccountInput.required = isBank;
        promptpayInput.required = isPromptpay;
      }

      function syncBankBrandByDeal(deal) {
        var brand = String((deal && deal.sellerBankBrand) || '').trim().toLowerCase();
        if (!brand) return;
        for (var i = 0; i < bankBrandInput.options.length; i += 1) {
          if (String(bankBrandInput.options[i].value || '').trim().toLowerCase() === brand) {
            bankBrandInput.selectedIndex = i;
            break;
          }
        }
      }

      function showPayoutQrPreview(image) {
        if (!image || !image.dataUrl) {
          resetPayoutQrPreview();
          return;
        }
        sellerPayoutQrImage = image;
        payoutQrPreview.innerHTML =
          '<img alt="seller payout qr" src="' + escapeHtml(image.dataUrl) + '" />';
      }

      function updateDealActionButtons(deal) {
        var awaitingPayment = isDealAwaitingPayment(deal);
        paymentActionsWrap.classList.toggle('hidden', !awaitingPayment);
        checkBtn.classList.toggle('hidden', !awaitingPayment);
        manualPaidBtn.classList.toggle('hidden', !awaitingPayment);
        cancelBtn.classList.toggle('hidden', !awaitingPayment);
      }

      function renderDeal(deal) {
        var d = deal && typeof deal === 'object' ? deal : {};
        if (!d || !d.id) return;

        dealId = String(d.id || '').trim();
        if (String(d.groupId || '').trim()) {
          groupInput.value = String(d.groupId || '').trim();
        }
        setGroupReady(true);

        buyerNameInput.value = String(d.buyerName || '').trim();
        sellerNameInput.value = String(d.sellerName || '').trim();
        sellerUserIdInput.value = String(d.sellerLineUserId || '').trim();
        itemInput.value = String(d.itemName || '').trim();
        amountInput.value = Number(d.paymentAmountThb || 0) > 0 ? String(d.paymentAmountThb) : '';
        noteInput.value = String(d.note || '').trim();
        bankAccountNameInput.value = String(d.sellerBankAccountName || '').trim();

        var payoutMethod = String(d.sellerPayoutMethod || '').trim().toLowerCase() || 'bank';
        payoutMethodInput.value = payoutMethod;
        updatePayoutMethodFields();
        syncBankBrandByDeal(d);
        bankAccountInput.value = String(d.sellerBankAccount || '').trim();
        promptpayInput.value = String(d.sellerPromptpayNumber || '').trim();
        if (d.sellerPayoutQrImage && d.sellerPayoutQrImage.dataUrl) {
          showPayoutQrPreview(d.sellerPayoutQrImage);
        } else {
          resetPayoutQrPreview();
        }

        var qrHtml = d.paymentQrImageUrl
          ? '<div class="qr"><div style="font-size:0.78rem;color:#334155;">สแกน QR นี้เพื่อชำระเงินเข้าระบบ</div><img alt="payment qr" src="' + escapeHtml(d.paymentQrImageUrl) + '" /></div>'
          : '<p class="tiny">ยังไม่มี QR สำหรับดีลนี้</p>';

        var links = '';
        if (d.sellerLiffUrl) links += '<a href="' + escapeHtml(d.sellerLiffUrl) + '" target="_blank" rel="noreferrer">เปิดหน้า LIFF ผู้ขาย</a><br />';
        if (d.buyerLiffUrl) links += '<a href="' + escapeHtml(d.buyerLiffUrl) + '" target="_blank" rel="noreferrer">เปิดหน้า LIFF ผู้ซื้อ</a>';

        resultBox.innerHTML =
          '<h3>รายละเอียดดีล</h3>' +
          '<div class="kv">' +
            '<div class="k">รหัสดีล</div><div class="v">' + escapeHtml(d.id || '-') + '</div>' +
            '<div class="k">รหัสกลุ่ม</div><div class="v">' + escapeHtml(d.groupId || '-') + '</div>' +
            '<div class="k">สถานะดีล</div><div class="v">' + escapeHtml(d.status || '-') + '</div>' +
            '<div class="k">สถานะชำระเงิน</div><div class="v">' + escapeHtml(d.paymentStatus || '-') + '</div>' +
            '<div class="k">ยอดเงิน</div><div class="v">' + escapeHtml(Number(d.paymentAmountThb || 0).toLocaleString()) + ' THB</div>' +
            '<div class="k">สินค้า</div><div class="v">' + escapeHtml(d.itemName || '-') + '</div>' +
            '<div class="k">ช่องทางรับเงินผู้ขาย</div><div class="v">' + escapeHtml(getPayoutMethodLabel(payoutMethod)) + '</div>' +
          '</div>' +
          qrHtml +
          (links ? '<div style="margin-top:10px;font-size:0.82rem;">' + links + '</div>' : '');
        resultBox.classList.remove('hidden');

        var awaitingPayment = isDealAwaitingPayment(d);
        setCreateFormVisible(!awaitingPayment);
        updateDealActionButtons(d);
      }

      async function loadDealById(targetDealId, refreshPayment, silent) {
        var targetId = String(targetDealId || '').trim();
        if (!targetId) return null;

        var url = '/line/escrow/liff/api/deals/' + encodeURIComponent(targetId);
        if (refreshPayment) url += '?refreshPayment=1';
        var response = await fetch(url);
        var payload = await response.json().catch(function () { return null; });
        if (!response.ok) {
          throw new Error((payload && payload.message) || 'โหลดดีลไม่สำเร็จ');
        }
        if (payload && payload.deal) {
          renderDeal(payload.deal);
          return payload.deal;
        }
        if (!silent) showStatus(statusBox, 'ไม่พบข้อมูลดีล', 'error');
        return null;
      }

      async function loadActivePaymentDeal(groupIdValue) {
        var groupIdText = String(groupIdValue || '').trim();
        if (!groupIdText) {
          throw new Error('กรุณากรอก Group ID');
        }
        var url =
          '/line/escrow/liff/api/deals/active-payment?groupId=' +
          encodeURIComponent(groupIdText) +
          '&refreshPayment=1';
        var response = await fetch(url);
        var payload = await response.json().catch(function () { return null; });
        if (!response.ok) {
          throw new Error((payload && payload.message) || 'โหลดดีลที่รอชำระไม่สำเร็จ');
        }
        return {
          deal: payload && payload.deal ? payload.deal : null,
          message: String((payload && payload.message) || '').trim(),
        };
      }

      function normalizePromptpayNumber(valueInput) {
        return String(valueInput || '').replace(/[^0-9]/g, '').slice(0, 20);
      }

      function buildCreatePayload() {
        var groupIdValue = String(groupInput.value || '').trim();
        if (!groupReady || !groupIdValue) {
          throw new Error('กรุณายืนยัน Group ID ก่อนสร้างดีล');
        }
        var payoutMethod = String(payoutMethodInput.value || 'bank').trim().toLowerCase();
        if (['bank', 'promptpay', 'seller_qr'].indexOf(payoutMethod) < 0) payoutMethod = 'bank';

        var payload = {
          groupId: groupIdValue,
          buyerName: String(buyerNameInput.value || '').trim(),
          sellerName: String(sellerNameInput.value || '').trim(),
          sellerLineUserId: String(sellerUserIdInput.value || '').trim(),
          itemName: String(itemInput.value || '').trim(),
          amountThb: Number(amountInput.value || 0),
          note: String(noteInput.value || '').trim(),
          sellerPayoutMethod: payoutMethod,
          sellerBankAccountName: String(bankAccountNameInput.value || '').trim(),
        };

        if (!payload.sellerName || !payload.itemName || !Number.isFinite(payload.amountThb) || payload.amountThb <= 0) {
          throw new Error('กรุณากรอก ชื่อผู้ขาย, สินค้า และยอดเงิน ให้ครบถ้วน');
        }
        if (!payload.sellerBankAccountName) {
          throw new Error('กรุณากรอกชื่อผู้รับเงินผู้ขาย');
        }

        if (payoutMethod === 'bank') {
          var bankBrandValue = String(bankBrandInput.value || '').trim().toLowerCase();
          if (!bankBrandValue) {
            throw new Error('กรุณาเลือกธนาคารผู้ขาย');
          }
          payload.sellerBankBrand = bankBrandValue;
          payload.sellerBankName = getSelectedBankName();
          payload.sellerBankAccount = String(bankAccountInput.value || '').trim();
          if (!payload.sellerBankAccount) {
            throw new Error('กรุณากรอกเลขบัญชีผู้ขาย');
          }
        } else if (payoutMethod === 'promptpay') {
          payload.sellerPromptpayNumber = normalizePromptpayNumber(promptpayInput.value);
          if (!payload.sellerPromptpayNumber || !/^(?:\d{10}|\d{13}|\d{15})$/.test(payload.sellerPromptpayNumber)) {
            throw new Error('เลข PromptPay ต้องเป็นตัวเลข 10, 13 หรือ 15 หลัก');
          }
        } else if (payoutMethod === 'seller_qr') {
          if (!sellerPayoutQrImage || !sellerPayoutQrImage.dataUrl) {
            throw new Error('กรุณาอัปโหลด QR รับเงินของผู้ขาย');
          }
          payload.sellerPayoutQrImage = sellerPayoutQrImage;
        }

        return payload;
      }

      async function activateGroupAndLoadDeal() {
        var groupIdValue = String(groupInput.value || '').trim();
        if (!groupIdValue) {
          throw new Error('กรุณากรอก Group ID ก่อน');
        }

        hideStatus(statusBox);
        resultBox.classList.add('hidden');
        setBusy(true);
        try {
          setGroupReady(true);
          setCreateFormVisible(false);
          updateDealActionButtons(null);

          var active = await loadActivePaymentDeal(groupIdValue);
          if (active && active.deal) {
            renderDeal(active.deal);
            showStatus(statusBox, 'พบดีลที่รอชำระของกลุ่มนี้ ระบบเปิด QR เดิมให้แล้ว', 'success');
            return;
          }

          dealId = '';
          updateDealActionButtons(null);
          setCreateFormVisible(true);
          showStatus(
            statusBox,
            active && active.message ? active.message : 'ยังไม่มีดีลที่รอชำระในกลุ่มนี้ กรุณากรอกข้อมูลเพื่อสร้างดีลใหม่',
            'success'
          );
        } catch (error) {
          setGroupReady(false);
          setCreateFormVisible(false);
          updateDealActionButtons(null);
          throw error;
        } finally {
          setBusy(false);
        }
      }

      async function checkPayment() {
        if (!dealId) {
          showStatus(statusBox, 'ยังไม่มีรหัสดีลให้ตรวจสอบ', 'error');
          return;
        }
        hideStatus(statusBox);
        setBusy(true);
        try {
          var response = await fetch('/line/escrow/liff/api/deals/' + encodeURIComponent(dealId) + '/check-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) throw new Error((payload && payload.message) || 'ตรวจสอบการชำระเงินไม่สำเร็จ');
          if (payload && payload.deal) {
            renderDeal(payload.deal);
          }
          var isPaid =
            payload &&
            payload.deal &&
            String(payload.deal.paymentStatus || '').trim().toLowerCase() === 'paid';
          showStatus(
            statusBox,
            isPaid
              ? 'ชำระเงินสำเร็จ ระบบจะไปขั้นตอนถัดไปอัตโนมัติ'
              : 'ตรวจสอบสถานะชำระเงินสำเร็จ (ยังไม่พบการชำระ)',
            'success'
          );
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'ตรวจสอบการชำระเงินไม่สำเร็จ', 'error');
        } finally {
          setBusy(false);
        }
      }

      async function markManualPaidForTest() {
        if (!dealId) {
          showStatus(statusBox, 'ยังไม่มีรหัสดีลให้ยืนยันชำระเงิน', 'error');
          return;
        }
        if (!window.confirm('ยืนยันว่าดีลนี้ชำระเงินแล้วใช่หรือไม่?')) return;
        var second = window.prompt('พิมพ์คำว่า "ยืนยัน" เพื่อยืนยันการชำระเงิน');
        if (String(second || '').trim() !== 'ยืนยัน') {
          showStatus(statusBox, 'ยกเลิกการยืนยันชำระเงิน', 'error');
          return;
        }

        hideStatus(statusBox);
        setBusy(true);
        try {
          var response = await fetch('/line/escrow/liff/api/deals/' + encodeURIComponent(dealId) + '/manual-confirm-paid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId: String(groupInput.value || '').trim() })
          });
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) throw new Error((payload && payload.message) || 'ยืนยันชำระเงินไม่สำเร็จ');
          if (payload && payload.deal) {
            renderDeal(payload.deal);
          }
          showStatus(statusBox, (payload && payload.message) || 'ยืนยันชำระเงินแล้ว', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'ยืนยันชำระเงินไม่สำเร็จ', 'error');
        } finally {
          setBusy(false);
        }
      }

      async function cancelDeal() {
        if (!dealId) {
          showStatus(statusBox, 'ยังไม่มีรหัสดีลให้ยกเลิก', 'error');
          return;
        }
        if (!window.confirm('ต้องการยกเลิกดีลนี้ใช่หรือไม่?')) return;
        var second = window.prompt('พิมพ์คำว่า "ยกเลิกดีล" เพื่อยืนยัน');
        if (String(second || '').trim() !== 'ยกเลิกดีล') {
          showStatus(statusBox, 'ยกเลิกการดำเนินการยกเลิกดีล', 'error');
          return;
        }

        hideStatus(statusBox);
        setBusy(true);
        try {
          var response = await fetch('/line/escrow/liff/api/deals/' + encodeURIComponent(dealId) + '/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) throw new Error((payload && payload.message) || 'ยกเลิกดีลไม่สำเร็จ');
          if (payload && payload.deal) {
            renderDeal(payload.deal);
          }
          showStatus(statusBox, (payload && payload.message) || 'ยกเลิกดีลเรียบร้อยแล้ว', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'ยกเลิกดีลไม่สำเร็จ', 'error');
        } finally {
          setBusy(false);
        }
      }

      payoutMethodInput.addEventListener('change', updatePayoutMethodFields);

      payoutQrBtn.addEventListener('click', function () {
        payoutQrFileInput.click();
      });

      payoutQrFileInput.addEventListener('change', function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!String(file.type || '').toLowerCase().startsWith('image/')) {
          showStatus(statusBox, 'อัปโหลดได้เฉพาะไฟล์รูปภาพเท่านั้น', 'error');
          payoutQrFileInput.value = '';
          return;
        }
        if (maxQrImageBytes > 0 && Number(file.size || 0) > maxQrImageBytes) {
          showStatus(statusBox, 'ไฟล์ใหญ่เกินกำหนด (' + maxQrImageBytes + ' bytes)', 'error');
          payoutQrFileInput.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          showPayoutQrPreview({
            id: 'seller-qr-' + Date.now(),
            name: String(file.name || 'seller-qr').slice(0, 180),
            mimeType: String(file.type || 'image/*').toLowerCase(),
            size: Number(file.size || 0),
            dataUrl: String(reader.result || '')
          });
          hideStatus(statusBox);
        };
        reader.onerror = function () {
          showStatus(statusBox, 'อ่านไฟล์รูป QR ไม่สำเร็จ', 'error');
        };
        reader.readAsDataURL(file);
      });

      groupConfirmBtn.addEventListener('click', function () {
        if (groupReady) {
          setGroupReady(false);
          setCreateFormVisible(false);
          updateDealActionButtons(null);
          dealId = '';
          resultBox.classList.add('hidden');
          resetPayoutQrPreview();
          showStatus(statusBox, 'แก้ไข Group ID ได้แล้ว กรุณากด "ยืนยัน Group ID" อีกครั้ง', 'success');
          return;
        }
        void (async function () {
          try {
            await activateGroupAndLoadDeal();
          } catch (error) {
            showStatus(statusBox, (error && error.message) || 'ตรวจสอบ Group ID ไม่สำเร็จ', 'error');
          }
        })();
      });

      checkBtn.addEventListener('click', function () {
        void checkPayment();
      });
      manualPaidBtn.addEventListener('click', function () {
        void markManualPaidForTest();
      });
      cancelBtn.addEventListener('click', function () {
        void cancelDeal();
      });

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        void (async function () {
          hideStatus(statusBox);
          resultBox.classList.add('hidden');
          setBusy(true);
          try {
            var payloadData = buildCreatePayload();
            var response = await fetch('/line/escrow/liff/api/deals/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payloadData)
            });
            var payload = await response.json().catch(function () { return null; });
            if (!response.ok) throw new Error((payload && payload.message) || 'สร้างดีลไม่สำเร็จ');
            if (payload && payload.deal) {
              renderDeal(payload.deal);
            }
            showStatus(statusBox, (payload && payload.message) || 'สร้างดีลสำเร็จ', 'success');
          } catch (error) {
            showStatus(statusBox, (error && error.message) || 'สร้างดีลไม่สำเร็จ', 'error');
          } finally {
            setBusy(false);
          }
        })();
      });

      updatePayoutMethodFields();
      updateDealActionButtons(null);
      setCreateFormVisible(false);
      setGroupReady(false);
      resetPayoutQrPreview();

      (function bootstrapFromDealIdIfProvided() {
        if (!dealId) return;
        void (async function () {
          setBusy(true);
          try {
            var loaded = await loadDealById(dealId, true, true);
            if (loaded && loaded.groupId) {
              groupInput.value = String(loaded.groupId || '').trim();
              setGroupReady(true);
            }
          } catch (_error) {
            setGroupReady(false);
            setCreateFormVisible(false);
            updateDealActionButtons(null);
          } finally {
            setBusy(false);
          }
        })();
      })();
    `,
  });
export const renderLineEscrowSellerPage = ({ maxSlipImageBytes = 0 } = {}) =>
  buildShell({
    title: 'ผู้ขายส่งเลขพัสดุ',
    subtitle: 'ส่งเลขพัสดุ + รูปหลักฐานให้ระบบ',
    description:
      'ขั้นตอนที่ 2: ทำหลังผู้ซื้อชำระเงินแล้ว เมื่อส่งสำเร็จ ระบบจะแจ้งในกลุ่มและผู้ซื้อจะติดตามสถานะได้',
    bodyHtml: `
      <section class="card">
        <form id="seller-form" class="row">
          <div class="row two">
            <div>
              <label for="seller-deal-id">รหัสดีล</label>
              <input id="seller-deal-id" type="text" placeholder="escrow deal id" required />
            </div>
            <div>
              <label for="seller-tracking-no">เลขพัสดุ</label>
              <input id="seller-tracking-no" type="text" placeholder="เลขพัสดุ" required />
            </div>
          </div>
          <div>
            <label for="seller-courier-code">Courier Code (ไม่บังคับ)</label>
            <input id="seller-courier-code" type="text" placeholder="เช่น thailand-post, kerry, flash" />
          </div>
          <div>
            <label>รูปหลักฐานการส่ง</label>
            <label class="btn upload" style="display:inline-flex;align-items:center;justify-content:center;" for="seller-slip-input">
              อัปโหลดรูปหลักฐาน
            </label>
            <input id="seller-slip-input" type="file" accept="image/*" class="hidden" />
            <p class="tiny">รองรับเฉพาะไฟล์ภาพ ขนาดสูงสุด ${Math.max(0, Number(maxSlipImageBytes || 0))} bytes</p>
            <div id="seller-slip-preview" class="preview">ยังไม่ได้เลือกรูป</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="seller-submit-btn" class="btn secondary" type="submit">ยืนยันส่งเลขพัสดุและหลักฐาน</button>
          </div>
        </form>
        <div id="seller-status" class="status hidden"></div>
        <div id="seller-result" class="result hidden"></div>
      </section>
    `,
    script: `
      ${commonUtilsScript}
      var form = document.getElementById('seller-form');
      var submitBtn = document.getElementById('seller-submit-btn');
      var statusBox = document.getElementById('seller-status');
      var resultBox = document.getElementById('seller-result');
      var dealInput = document.getElementById('seller-deal-id');
      var trackingInput = document.getElementById('seller-tracking-no');
      var courierInput = document.getElementById('seller-courier-code');
      var fileInput = document.getElementById('seller-slip-input');
      var preview = document.getElementById('seller-slip-preview');
      var slipImage = null;
      var maxBytes = ${Math.max(0, Number(maxSlipImageBytes || 0))};

      var presetDealId = parseDealIdFromLocation();
      if (presetDealId) dealInput.value = presetDealId;

      function setBusy(isBusy) {
        submitBtn.disabled = Boolean(isBusy);
        submitBtn.textContent = isBusy ? 'กำลังบันทึก...' : 'ยืนยันส่งเลขพัสดุและหลักฐาน';
      }

      fileInput.addEventListener('change', function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!String(file.type || '').toLowerCase().startsWith('image/')) {
          showStatus(statusBox, 'อนุญาตเฉพาะไฟล์ภาพเท่านั้น', 'error');
          fileInput.value = '';
          return;
        }
        if (maxBytes > 0 && Number(file.size || 0) > maxBytes) {
          showStatus(statusBox, 'ไฟล์ใหญ่เกินกำหนด (' + maxBytes + ' bytes)', 'error');
          fileInput.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = String(reader.result || '');
          slipImage = {
            id: 'slip-' + Date.now(),
            name: String(file.name || 'shipping-slip').slice(0, 180),
            mimeType: String(file.type || 'image/*').toLowerCase(),
            size: Number(file.size || 0),
            dataUrl: dataUrl
          };
          preview.innerHTML = '<img alt="slip preview" src="' + dataUrl + '" />';
          hideStatus(statusBox);
        };
        reader.onerror = function () {
          showStatus(statusBox, 'อ่านไฟล์รูปไม่สำเร็จ', 'error');
        };
        reader.readAsDataURL(file);
      });

      function renderDeal(deal) {
        var d = deal && typeof deal === 'object' ? deal : {};
        resultBox.innerHTML =
          '<h3>บันทึกการจัดส่งสำเร็จ</h3>' +
          '<div class="kv">' +
            '<div class="k">รหัสดีล</div><div class="v">' + escapeHtml(d.id || '-') + '</div>' +
            '<div class="k">รหัสกลุ่ม</div><div class="v">' + escapeHtml(d.groupId || '-') + '</div>' +
            '<div class="k">สถานะดีล</div><div class="v">' + escapeHtml(d.status || '-') + '</div>' +
            '<div class="k">เลขพัสดุ</div><div class="v">' + escapeHtml(d.trackingNumber || '-') + '</div>' +
            '<div class="k">สถานะขนส่ง</div><div class="v">' + escapeHtml(d.trackingStatusText || d.trackingStatus || '-') + '</div>' +
          '</div>' +
          (d.buyerLiffUrl
            ? '<p class="tiny"><a href="' + escapeHtml(d.buyerLiffUrl) + '" target="_blank" rel="noreferrer">เปิดหน้า LIFF ผู้ซื้อเพื่อติดตาม/ยืนยันรับของ</a></p>'
            : '');
        resultBox.classList.remove('hidden');
      }

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        hideStatus(statusBox);
        resultBox.classList.add('hidden');
        if (!slipImage) {
          showStatus(statusBox, 'กรุณาอัปโหลดรูปหลักฐานก่อนส่ง', 'error');
          return;
        }
        setBusy(true);
        try {
          var response = await fetch('/line/escrow/liff/api/deals/submit-shipment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dealId: String(dealInput.value || '').trim(),
              trackingNumber: String(trackingInput.value || '').trim(),
              courierCode: String(courierInput.value || '').trim(),
              shippingSlipImage: slipImage
            })
          });
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) throw new Error((payload && payload.message) || 'ส่งข้อมูลพัสดุไม่สำเร็จ');
          renderDeal(payload && payload.deal);
          showStatus(statusBox, (payload && payload.message) || 'ส่งข้อมูลพัสดุสำเร็จ', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'ส่งข้อมูลพัสดุไม่สำเร็จ', 'error');
        } finally {
          setBusy(false);
        }
      });
    `,
  });

export const renderLineEscrowBuyerPage = () =>
  buildShell({
    title: 'ผู้ซื้อเช็กสถานะและยืนยันรับของ',
    subtitle: 'ดูสถานะชำระเงิน ขนส่ง แผนที่ และยืนยันรับสินค้า',
    description:
      'ขั้นตอนที่ 3: เมื่อสถานะขึ้นว่า delivered ผู้ซื้อกดยืนยันรับของเพื่อปล่อยเงินให้ผู้ขาย หรือรอครบเวลาอัตโนมัติ',
    bodyHtml: `
      <section class="card">
        <form id="buyer-form" class="row">
          <div>
            <label for="buyer-deal-id">รหัสดีล</label>
            <input id="buyer-deal-id" type="text" placeholder="escrow deal id" required />
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="buyer-load-btn" class="btn primary" type="button">โหลดสถานะดีล</button>
            <button id="buyer-refresh-track-btn" class="btn ghost" type="button">รีเฟรชสถานะขนส่ง</button>
            <button id="buyer-confirm-btn" class="btn secondary" type="button">ยืนยันรับสินค้า</button>
          </div>
        </form>
        <div id="buyer-status" class="status hidden"></div>
        <div id="buyer-result" class="result hidden"></div>
      </section>
    `,
    script: `
      ${commonUtilsScript}
      var loadBtn = document.getElementById('buyer-load-btn');
      var refreshBtn = document.getElementById('buyer-refresh-track-btn');
      var confirmBtn = document.getElementById('buyer-confirm-btn');
      var dealInput = document.getElementById('buyer-deal-id');
      var statusBox = document.getElementById('buyer-status');
      var resultBox = document.getElementById('buyer-result');

      var presetDealId = parseDealIdFromLocation();
      if (presetDealId) dealInput.value = presetDealId;

      function setBusy(isBusy) {
        loadBtn.disabled = Boolean(isBusy);
        refreshBtn.disabled = Boolean(isBusy);
        confirmBtn.disabled = Boolean(isBusy);
      }

      function renderDeal(deal) {
        var d = deal && typeof deal === 'object' ? deal : {};
        var links = '';
        if (d.trackingPublicUrl) links += '<a href="' + escapeHtml(d.trackingPublicUrl) + '" target="_blank" rel="noreferrer">ดูสถานะพัสดุแบบสาธารณะ</a><br />';
        if (d.trackingMapUrl) links += '<a href="' + escapeHtml(d.trackingMapUrl) + '" target="_blank" rel="noreferrer">ดูตำแหน่งล่าสุดบนแผนที่</a><br />';
        if (d.paymentQrImageUrl && d.paymentStatus !== 'paid') links += '<a href="' + escapeHtml(d.paymentQrImageUrl) + '" target="_blank" rel="noreferrer">เปิด QR ชำระเงิน</a>';
        resultBox.innerHTML =
          '<h3>สถานะดีล</h3>' +
          '<div class="kv">' +
            '<div class="k">รหัสดีล</div><div class="v">' + escapeHtml(d.id || '-') + '</div>' +
            '<div class="k">รหัสกลุ่ม</div><div class="v">' + escapeHtml(d.groupId || '-') + '</div>' +
            '<div class="k">สินค้า</div><div class="v">' + escapeHtml(d.itemName || '-') + '</div>' +
            '<div class="k">สถานะดีล</div><div class="v">' + escapeHtml(d.status || '-') + '</div>' +
            '<div class="k">สถานะชำระเงิน</div><div class="v">' + escapeHtml(d.paymentStatus || '-') + '</div>' +
            '<div class="k">สถานะขนส่ง</div><div class="v">' + escapeHtml(d.trackingStatusText || d.trackingStatus || '-') + '</div>' +
            '<div class="k">เลขพัสดุ</div><div class="v">' + escapeHtml(d.trackingNumber || '-') + '</div>' +
            '<div class="k">จุดล่าสุด</div><div class="v">' + escapeHtml(d.trackingLastEventLocation || '-') + '</div>' +
            '<div class="k">เวลาล่าสุด</div><div class="v">' + escapeHtml(d.trackingLastEventTime || '-') + '</div>' +
            '<div class="k">ยืนยันอัตโนมัติ</div><div class="v">' + escapeHtml(d.autoReleaseAt || '-') + '</div>' +
            '<div class="k">สถานะปล่อยเงิน</div><div class="v">' + escapeHtml(d.payoutStatus || '-') + '</div>' +
          '</div>' +
          (links ? '<p class="tiny" style="margin-top:10px;">' + links + '</p>' : '');
        resultBox.classList.remove('hidden');
      }

      async function loadDeal(refreshPayment) {
        var id = String(dealInput.value || '').trim();
        if (!id) {
          showStatus(statusBox, 'กรุณากรอกรหัสดีล', 'error');
          return;
        }
        hideStatus(statusBox);
        setBusy(true);
        try {
          var url = '/line/escrow/liff/api/deals/' + encodeURIComponent(id);
          if (refreshPayment) url += '?refreshPayment=1';
          var response = await fetch(url);
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) throw new Error((payload && payload.message) || 'โหลดสถานะดีลไม่สำเร็จ');
          renderDeal(payload && payload.deal);
          showStatus(statusBox, 'โหลดสถานะดีลสำเร็จ', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'โหลดสถานะดีลไม่สำเร็จ', 'error');
        } finally {
          setBusy(false);
        }
      }

      async function refreshTracking() {
        var id = String(dealInput.value || '').trim();
        if (!id) {
          showStatus(statusBox, 'กรุณากรอกรหัสดีล', 'error');
          return;
        }
        hideStatus(statusBox);
        setBusy(true);
        try {
          var response = await fetch('/line/escrow/liff/api/deals/' + encodeURIComponent(id) + '/refresh-tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) throw new Error((payload && payload.message) || 'รีเฟรชขนส่งไม่สำเร็จ');
          renderDeal(payload && payload.deal);
          showStatus(statusBox, 'รีเฟรชขนส่งสำเร็จ', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'รีเฟรชขนส่งไม่สำเร็จ', 'error');
        } finally {
          setBusy(false);
        }
      }

      async function confirmDelivery() {
        var id = String(dealInput.value || '').trim();
        if (!id) {
          showStatus(statusBox, 'กรุณากรอกรหัสดีล', 'error');
          return;
        }
        hideStatus(statusBox);
        setBusy(true);
        try {
          var response = await fetch('/line/escrow/liff/api/deals/' + encodeURIComponent(id) + '/confirm-delivery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) throw new Error((payload && payload.message) || 'ยืนยันรับสินค้าไม่สำเร็จ');
          renderDeal(payload && payload.deal);
          showStatus(statusBox, (payload && payload.message) || 'ยืนยันรับสินค้าเรียบร้อย', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'ยืนยันรับสินค้าไม่สำเร็จ', 'error');
        } finally {
          setBusy(false);
        }
      }

      loadBtn.addEventListener('click', function () { void loadDeal(true); });
      refreshBtn.addEventListener('click', function () { void refreshTracking(); });
      confirmBtn.addEventListener('click', function () { void confirmDelivery(); });

      if (presetDealId) void loadDeal(true);
    `,
  });