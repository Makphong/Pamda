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
        --accent-3: #7c3aed;
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
      input:focus, textarea:focus {
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

export const renderLineEscrowDealPage = () =>
  buildShell({
    title: 'à¸ªà¸£à¹‰à¸²à¸‡à¸”à¸µà¸¥à¸•à¸±à¸§à¸à¸¥à¸²à¸‡à¸‹à¸·à¹‰à¸­à¸‚à¸²à¸¢',
    subtitle: 'à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­à¸ªà¸£à¹‰à¸²à¸‡à¸”à¸µà¸¥à¹à¸¥à¸°à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¹€à¸‚à¹‰à¸²à¸šà¸­à¸—',
    description:
      'à¸£à¸°à¸šà¸šà¸ˆà¸°à¸ªà¸£à¹‰à¸²à¸‡à¸”à¸µà¸¥ + QR PromptPay à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­à¹‚à¸­à¸™à¹€à¸‡à¸´à¸™à¹€à¸‚à¹‰à¸²à¸šà¸­à¸—à¸à¹ˆà¸­à¸™ à¸ˆà¸²à¸à¸™à¸±à¹‰à¸™à¸œà¸¹à¹‰à¸‚à¸²à¸¢à¸ªà¹ˆà¸‡à¸žà¸±à¸ªà¸”à¸¸à¹à¸¥à¸°à¹€à¸¥à¸‚à¸•à¸´à¸”à¸•à¸²à¸¡à¹ƒà¸™à¸‚à¸±à¹‰à¸™à¸•à¸­à¸™à¸–à¸±à¸”à¹„à¸›',
    bodyHtml: `
      <section class="card">
        <form id="escrow-create-form" class="row">
          <div class="row two">
            <div>
              <label for="deal-group-id">Group ID (Auto from LINE group)</label>
              <input id="deal-group-id" type="text" placeholder="Auto-filled from LINE group context" required />
              <p class="tiny">If opened from group menu, users do not need to type Group ID manually.</p>
            </div>
            <div>
              <label for="deal-buyer-name">à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­</label>
              <input id="deal-buyer-name" type="text" placeholder="à¹€à¸Šà¹ˆà¸™ à¸„à¸¸à¸“à¹€à¸­" />
            </div>
          </div>
          <div class="row two">
            <div>
              <label for="deal-seller-name">à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¸‚à¸²à¸¢</label>
              <input id="deal-seller-name" type="text" placeholder="à¹€à¸Šà¹ˆà¸™ à¸£à¹‰à¸²à¸™ B" required />
            </div>
            <div>
              <label for="deal-item-name">à¸ªà¸´à¸™à¸„à¹‰à¸²</label>
              <input id="deal-item-name" type="text" placeholder="à¸Šà¸·à¹ˆà¸­à¸ªà¸´à¸™à¸„à¹‰à¸²" required />
            </div>
          </div>
          <div class="row three">
            <div>
              <label for="deal-amount">à¸¢à¸­à¸”à¹€à¸‡à¸´à¸™ (THB)</label>
              <input id="deal-amount" type="number" min="1" step="0.01" placeholder="1000" required />
            </div>
            <div>
              <label for="seller-bank-name">à¸˜à¸™à¸²à¸„à¸²à¸£à¸œà¸¹à¹‰à¸‚à¸²à¸¢</label>
              <input id="seller-bank-name" type="text" placeholder="à¹€à¸Šà¹ˆà¸™ à¸à¸£à¸¸à¸‡à¹„à¸—à¸¢ à¸«à¸£à¸·à¸­ KTB" required />
            </div>
            <div>
              <label for="seller-bank-account">à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µà¸œà¸¹à¹‰à¸‚à¸²à¸¢</label>
              <input id="seller-bank-account" type="text" placeholder="à¹€à¸¥à¸‚à¸šà¸±à¸à¸Šà¸µ" required />
            </div>
          </div>
          <div class="row two">
            <div>
              <label for="seller-bank-account-name">à¸Šà¸·à¹ˆà¸­à¸šà¸±à¸à¸Šà¸µà¸œà¸¹à¹‰à¸‚à¸²à¸¢</label>
              <input id="seller-bank-account-name" type="text" placeholder="à¸Šà¸·à¹ˆà¸­à¸•à¸£à¸‡à¸à¸±à¸šà¸šà¸±à¸à¸Šà¸µà¸˜à¸™à¸²à¸„à¸²à¸£" required />
            </div>
            <div>
              <label for="deal-seller-user-id">LINE User ID à¸œà¸¹à¹‰à¸‚à¸²à¸¢ (à¹„à¸¡à¹ˆà¸šà¸±à¸‡à¸„à¸±à¸š)</label>
              <input id="deal-seller-user-id" type="text" placeholder="Uxxxxxxxx" />
            </div>
          </div>
          <div>
            <label for="deal-note">à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡</label>
            <textarea id="deal-note" placeholder="à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚à¸ªà¸´à¸™à¸„à¹‰à¸²/à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸"></textarea>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="deal-create-btn" class="btn primary" type="submit">à¸ªà¸£à¹‰à¸²à¸‡à¸”à¸µà¸¥ + à¸ªà¸£à¹‰à¸²à¸‡ QR à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™</button>
            <button id="deal-check-btn" class="btn ghost" type="button">à¹€à¸Šà¹‡à¸à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™</button>
          </div>
        </form>
        <div id="deal-status" class="status hidden"></div>
        <div id="deal-result" class="result hidden"></div>
      </section>
    `,
    script: `
      ${commonUtilsScript}
      var form = document.getElementById('escrow-create-form');
      var createBtn = document.getElementById('deal-create-btn');
      var checkBtn = document.getElementById('deal-check-btn');
      var statusBox = document.getElementById('deal-status');
      var resultBox = document.getElementById('deal-result');
      var dealId = parseDealIdFromLocation();

      var groupInput = document.getElementById('deal-group-id');
      var buyerNameInput = document.getElementById('deal-buyer-name');
      var sellerNameInput = document.getElementById('deal-seller-name');
      var sellerUserIdInput = document.getElementById('deal-seller-user-id');
      var itemInput = document.getElementById('deal-item-name');
      var amountInput = document.getElementById('deal-amount');
      var noteInput = document.getElementById('deal-note');
      var bankNameInput = document.getElementById('seller-bank-name');
      var bankAccountInput = document.getElementById('seller-bank-account');
      var bankAccountNameInput = document.getElementById('seller-bank-account-name');

      var groupFromQuery = parseGroupIdFromLocation();
      if (groupFromQuery) {
        groupInput.value = groupFromQuery;
        groupInput.readOnly = true;
        groupInput.setAttribute('aria-readonly', 'true');
      }

      function setBusy(isBusy) {
        createBtn.disabled = Boolean(isBusy);
        checkBtn.disabled = Boolean(isBusy);
        createBtn.textContent = isBusy ? 'à¸à¸³à¸¥à¸±à¸‡à¸ªà¸£à¹‰à¸²à¸‡à¸”à¸µà¸¥...' : 'à¸ªà¸£à¹‰à¸²à¸‡à¸”à¸µà¸¥ + à¸ªà¸£à¹‰à¸²à¸‡ QR à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™';
      }

      function renderDeal(deal) {
        var d = deal && typeof deal === 'object' ? deal : {};
        if (d.id) {
          dealId = String(d.id);
        }
        var qrHtml = d.paymentQrImageUrl
          ? '<div class="qr"><div style="font-size:0.78rem;color:#334155;">à¸ªà¹à¸à¸™ QR à¸™à¸µà¹‰à¹€à¸žà¸·à¹ˆà¸­à¹‚à¸­à¸™à¹€à¸‡à¸´à¸™à¹€à¸‚à¹‰à¸²à¸šà¸­à¸—</div><img alt="PromptPay QR" src="' + escapeHtml(d.paymentQrImageUrl) + '" /></div>'
          : '<p class="tiny">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µ QR (à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸à¸²à¸£à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸² Payment Provider)</p>';
        var links = '';
        if (d.sellerLiffUrl) {
          links += '<a href="' + escapeHtml(d.sellerLiffUrl) + '" target="_blank" rel="noreferrer">à¹€à¸›à¸´à¸”à¸«à¸™à¹‰à¸² LIFF à¸œà¸¹à¹‰à¸‚à¸²à¸¢</a><br />';
        }
        if (d.buyerLiffUrl) {
          links += '<a href="' + escapeHtml(d.buyerLiffUrl) + '" target="_blank" rel="noreferrer">à¹€à¸›à¸´à¸”à¸«à¸™à¹‰à¸² LIFF à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­</a>';
        }
        resultBox.innerHTML =
          '<h3>à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸”à¸µà¸¥</h3>' +
          '<div class="kv">' +
            '<div class="k">Deal ID</div><div class="v">' + escapeHtml(d.id || '-') + '</div>' +
            '<div class="k">Group ID</div><div class="v">' + escapeHtml(d.groupId || '-') + '</div>' +
            '<div class="k">à¸ªà¸–à¸²à¸™à¸°à¸”à¸µà¸¥</div><div class="v">' + escapeHtml(d.status || '-') + '</div>' +
            '<div class="k">à¸ªà¸–à¸²à¸™à¸°à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™</div><div class="v">' + escapeHtml(d.paymentStatus || '-') + '</div>' +
            '<div class="k">à¸¢à¸­à¸”à¹€à¸‡à¸´à¸™</div><div class="v">' + escapeHtml((Number(d.paymentAmountThb || 0)).toLocaleString()) + ' THB</div>' +
            '<div class="k">à¸ªà¸´à¸™à¸„à¹‰à¸²</div><div class="v">' + escapeHtml(d.itemName || '-') + '</div>' +
          '</div>' +
          qrHtml +
          (links ? '<div style="margin-top:10px;font-size:0.82rem;">' + links + '</div>' : '');
        resultBox.classList.remove('hidden');
      }

      async function checkPayment() {
        if (!dealId) {
          showStatus(statusBox, 'à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µ dealId à¹ƒà¸«à¹‰à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š', 'error');
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
          if (!response.ok) throw new Error((payload && payload.message) || 'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸à¸²à¸£à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
          renderDeal(payload && payload.deal);
          showStatus(statusBox, 'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸ªà¸–à¸²à¸™à¸°à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸à¸²à¸£à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'error');
        } finally {
          setBusy(false);
        }
      }

      checkBtn.addEventListener('click', function () {
        void checkPayment();
      });

      if (dealId) {
        void (async function () {
          try {
            var response = await fetch('/line/escrow/liff/api/deals/' + encodeURIComponent(dealId) + '?refreshPayment=1');
            var payload = await response.json().catch(function () { return null; });
            if (response.ok && payload && payload.deal) {
              renderDeal(payload.deal);
            }
          } catch (_error) {}
        })();
      }

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        hideStatus(statusBox);
        resultBox.classList.add('hidden');
        setBusy(true);
        try {
          var groupIdValue = String(groupInput.value || '').trim();
          if (!groupIdValue) {
            throw new Error('ไม่พบ Group ID กรุณาเปิดหน้านี้จากปุ่มในแชทกลุ่ม LINE เพื่อให้ระบบใส่ Group ID อัตโนมัติ');
          }
          var response = await fetch('/line/escrow/liff/api/deals/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              groupId: groupIdValue,
              buyerName: String(buyerNameInput.value || '').trim(),
              sellerName: String(sellerNameInput.value || '').trim(),
              sellerLineUserId: String(sellerUserIdInput.value || '').trim(),
              itemName: String(itemInput.value || '').trim(),
              amountThb: Number(amountInput.value || 0),
              note: String(noteInput.value || '').trim(),
              sellerBankName: String(bankNameInput.value || '').trim(),
              sellerBankAccount: String(bankAccountInput.value || '').trim(),
              sellerBankAccountName: String(bankAccountNameInput.value || '').trim()
            })
          });
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) throw new Error((payload && payload.message) || 'à¸ªà¸£à¹‰à¸²à¸‡à¸”à¸µà¸¥à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
          renderDeal(payload && payload.deal);
          showStatus(statusBox, (payload && payload.message) || 'à¸ªà¸£à¹‰à¸²à¸‡à¸”à¸µà¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'à¸ªà¸£à¹‰à¸²à¸‡à¸”à¸µà¸¥à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'error');
        } finally {
          setBusy(false);
        }
      });
    `,
  });

export const renderLineEscrowSellerPage = ({ maxSlipImageBytes = 0 } = {}) =>
  buildShell({
    title: 'à¸œà¸¹à¹‰à¸‚à¸²à¸¢à¸ªà¹ˆà¸‡à¹€à¸¥à¸‚à¸žà¸±à¸ªà¸”à¸¸',
    subtitle: 'à¸ªà¹ˆà¸‡à¹€à¸¥à¸‚à¸žà¸±à¸ªà¸”à¸¸ + à¸£à¸¹à¸›à¸ªà¸¥à¸´à¸›à¹ƒà¸«à¹‰à¸šà¸­à¸—à¹€à¸à¹‡à¸šà¸«à¸¥à¸±à¸à¸à¸²à¸™',
    description:
      'à¸‚à¸±à¹‰à¸™à¸•à¸­à¸™à¸™à¸µà¹‰à¸—à¸³à¸«à¸¥à¸±à¸‡à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¹à¸¥à¹‰à¸§à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ à¹€à¸¡à¸·à¹ˆà¸­à¸ªà¹ˆà¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸£à¸°à¸šà¸šà¸ˆà¸°à¹à¸ˆà¹‰à¸‡à¹ƒà¸™à¸à¸¥à¸¸à¹ˆà¸¡à¹à¸¥à¸°à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­à¸ªà¸²à¸¡à¸²à¸£à¸–à¸•à¸´à¸”à¸•à¸²à¸¡à¸ªà¸–à¸²à¸™à¸°/à¹à¸œà¸™à¸—à¸µà¹ˆà¹„à¸”à¹‰',
    bodyHtml: `
      <section class="card">
        <form id="seller-form" class="row">
          <div class="row two">
            <div>
              <label for="seller-deal-id">Deal ID</label>
              <input id="seller-deal-id" type="text" placeholder="escrow deal id" required />
            </div>
            <div>
              <label for="seller-tracking-no">à¹€à¸¥à¸‚à¸žà¸±à¸ªà¸”à¸¸</label>
              <input id="seller-tracking-no" type="text" placeholder="Tracking Number" required />
            </div>
          </div>
          <div>
            <label for="seller-courier-code">Courier Code (à¹„à¸¡à¹ˆà¸šà¸±à¸‡à¸„à¸±à¸š)</label>
            <input id="seller-courier-code" type="text" placeholder="à¹€à¸Šà¹ˆà¸™ thailand-post, kerry, flash" />
          </div>
          <div>
            <label>à¸£à¸¹à¸›à¸ªà¸¥à¸´à¸›à¸ªà¹ˆà¸‡à¸‚à¸­à¸‡</label>
            <label class="btn upload" style="display:inline-flex;align-items:center;justify-content:center;" for="seller-slip-input">
              à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¸£à¸¹à¸›à¸ªà¸¥à¸´à¸›
            </label>
            <input id="seller-slip-input" type="file" accept="image/*" class="hidden" />
            <p class="tiny">à¸£à¸­à¸‡à¸£à¸±à¸šà¹€à¸‰à¸žà¸²à¸°à¸ à¸²à¸ž à¸‚à¸™à¸²à¸”à¸ªà¸¹à¸‡à¸ªà¸¸à¸” ${Math.max(0, Number(maxSlipImageBytes || 0))} bytes</p>
            <div id="seller-slip-preview" class="preview">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸¥à¸·à¸­à¸à¸£à¸¹à¸›</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="seller-submit-btn" class="btn secondary" type="submit">à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ªà¹ˆà¸‡à¹€à¸¥à¸‚à¸žà¸±à¸ªà¸”à¸¸à¹à¸¥à¸°à¸ªà¸¥à¸´à¸›</button>
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

      var presetDealId = parseDealIdFromLocation();
      if (presetDealId) dealInput.value = presetDealId;

      function setBusy(isBusy) {
        submitBtn.disabled = Boolean(isBusy);
        submitBtn.textContent = isBusy ? 'à¸à¸³à¸¥à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸...' : 'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ªà¹ˆà¸‡à¹€à¸¥à¸‚à¸žà¸±à¸ªà¸”à¸¸à¹à¸¥à¸°à¸ªà¸¥à¸´à¸›';
      }

      fileInput.addEventListener('change', function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!String(file.type || '').toLowerCase().startsWith('image/')) {
          showStatus(statusBox, 'à¸­à¸™à¸¸à¸à¸²à¸•à¹€à¸‰à¸žà¸²à¸°à¹„à¸Ÿà¸¥à¹Œà¸ à¸²à¸žà¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™', 'error');
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
          showStatus(statusBox, 'à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¸£à¸¹à¸›à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'error');
        };
        reader.readAsDataURL(file);
      });

      function renderDeal(deal) {
        var d = deal && typeof deal === 'object' ? deal : {};
        resultBox.innerHTML =
          '<h3>à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¹ˆà¸‡à¸‚à¸­à¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆ</h3>' +
          '<div class="kv">' +
            '<div class="k">Deal ID</div><div class="v">' + escapeHtml(d.id || '-') + '</div>' +
            '<div class="k">Group ID</div><div class="v">' + escapeHtml(d.groupId || '-') + '</div>' +
            '<div class="k">à¸ªà¸–à¸²à¸™à¸°à¸”à¸µà¸¥</div><div class="v">' + escapeHtml(d.status || '-') + '</div>' +
            '<div class="k">à¹€à¸¥à¸‚à¸žà¸±à¸ªà¸”à¸¸</div><div class="v">' + escapeHtml(d.trackingNumber || '-') + '</div>' +
            '<div class="k">à¸ªà¸–à¸²à¸™à¸°à¸‚à¸™à¸ªà¹ˆà¸‡</div><div class="v">' + escapeHtml(d.trackingStatusText || d.trackingStatus || '-') + '</div>' +
          '</div>' +
          (d.buyerLiffUrl
            ? '<p class="tiny"><a href="' + escapeHtml(d.buyerLiffUrl) + '" target="_blank" rel="noreferrer">à¹€à¸›à¸´à¸”à¸«à¸™à¹‰à¸² LIFF à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­à¹€à¸žà¸·à¹ˆà¸­à¸•à¸´à¸”à¸•à¸²à¸¡/à¸¢à¸·à¸™à¸¢à¸±à¸™</a></p>'
            : '');
        resultBox.classList.remove('hidden');
      }

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        hideStatus(statusBox);
        resultBox.classList.add('hidden');
        if (!slipImage) {
          showStatus(statusBox, 'à¸à¸£à¸¸à¸“à¸²à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¸£à¸¹à¸›à¸ªà¸¥à¸´à¸›à¸à¹ˆà¸­à¸™à¸ªà¹ˆà¸‡', 'error');
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
          if (!response.ok) throw new Error((payload && payload.message) || 'à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸žà¸±à¸ªà¸”à¸¸à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
          renderDeal(payload && payload.deal);
          showStatus(statusBox, (payload && payload.message) || 'à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸žà¸±à¸ªà¸”à¸¸à¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸žà¸±à¸ªà¸”à¸¸à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'error');
        } finally {
          setBusy(false);
        }
      });
    `,
  });

export const renderLineEscrowBuyerPage = () =>
  buildShell({
    title: 'à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­à¹€à¸Šà¹‡à¸à¸ªà¸–à¸²à¸™à¸°à¹à¸¥à¸°à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸±à¸šà¸‚à¸­à¸‡',
    subtitle: 'à¸”à¸¹à¸ªà¸–à¸²à¸™à¸°à¸à¸²à¸£à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™ à¸‚à¸™à¸ªà¹ˆà¸‡ à¹à¸œà¸™à¸—à¸µà¹ˆ à¹à¸¥à¸°à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²',
    description:
      'à¸–à¹‰à¸²à¸ªà¸–à¸²à¸™à¸°à¸‚à¸¶à¹‰à¸™ delivered à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­à¸à¸”à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸±à¸šà¸‚à¸­à¸‡à¹€à¸žà¸·à¹ˆà¸­à¸›à¸¥à¹ˆà¸­à¸¢à¹€à¸‡à¸´à¸™à¹ƒà¸«à¹‰à¸œà¸¹à¹‰à¸‚à¸²à¸¢ à¸«à¸£à¸·à¸­à¸£à¸­à¸„à¸£à¸šà¹€à¸§à¸¥à¸²à¸£à¸°à¸šà¸šà¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´',
    bodyHtml: `
      <section class="card">
        <form id="buyer-form" class="row">
          <div>
            <label for="buyer-deal-id">Deal ID</label>
            <input id="buyer-deal-id" type="text" placeholder="escrow deal id" required />
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="buyer-load-btn" class="btn primary" type="button">à¹‚à¸«à¸¥à¸”à¸ªà¸–à¸²à¸™à¸°à¸”à¸µà¸¥</button>
            <button id="buyer-refresh-track-btn" class="btn ghost" type="button">à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¸ªà¸–à¸²à¸™à¸°à¸‚à¸™à¸ªà¹ˆà¸‡</button>
            <button id="buyer-confirm-btn" class="btn secondary" type="button">à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²</button>
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
        if (d.trackingPublicUrl) {
          links += '<a href="' + escapeHtml(d.trackingPublicUrl) + '" target="_blank" rel="noreferrer">à¸”à¸¹ Tracking Public</a><br />';
        }
        if (d.trackingMapUrl) {
          links += '<a href="' + escapeHtml(d.trackingMapUrl) + '" target="_blank" rel="noreferrer">à¸”à¸¹à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸šà¸™à¹à¸œà¸™à¸—à¸µà¹ˆ</a><br />';
        }
        if (d.paymentQrImageUrl && d.paymentStatus !== 'paid') {
          links += '<a href="' + escapeHtml(d.paymentQrImageUrl) + '" target="_blank" rel="noreferrer">à¹€à¸›à¸´à¸” QR à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™</a>';
        }
        resultBox.innerHTML =
          '<h3>à¸ªà¸–à¸²à¸™à¸°à¸”à¸µà¸¥</h3>' +
          '<div class="kv">' +
            '<div class="k">Deal ID</div><div class="v">' + escapeHtml(d.id || '-') + '</div>' +
            '<div class="k">Group ID</div><div class="v">' + escapeHtml(d.groupId || '-') + '</div>' +
            '<div class="k">à¸ªà¸´à¸™à¸„à¹‰à¸²</div><div class="v">' + escapeHtml(d.itemName || '-') + '</div>' +
            '<div class="k">à¸ªà¸–à¸²à¸™à¸°à¸”à¸µà¸¥</div><div class="v">' + escapeHtml(d.status || '-') + '</div>' +
            '<div class="k">à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™</div><div class="v">' + escapeHtml(d.paymentStatus || '-') + '</div>' +
            '<div class="k">à¸ªà¸–à¸²à¸™à¸°à¸‚à¸™à¸ªà¹ˆà¸‡</div><div class="v">' + escapeHtml(d.trackingStatusText || d.trackingStatus || '-') + '</div>' +
            '<div class="k">à¹€à¸¥à¸‚à¸žà¸±à¸ªà¸”à¸¸</div><div class="v">' + escapeHtml(d.trackingNumber || '-') + '</div>' +
            '<div class="k">à¸ˆà¸¸à¸”à¸¥à¹ˆà¸²à¸ªà¸¸à¸”</div><div class="v">' + escapeHtml(d.trackingLastEventLocation || '-') + '</div>' +
            '<div class="k">à¹€à¸§à¸¥à¸²à¸¥à¹ˆà¸²à¸ªà¸¸à¸”</div><div class="v">' + escapeHtml(d.trackingLastEventTime || '-') + '</div>' +
            '<div class="k">à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</div><div class="v">' + escapeHtml(d.autoReleaseAt || '-') + '</div>' +
            '<div class="k">à¸ªà¸–à¸²à¸™à¸°à¸›à¸¥à¹ˆà¸­à¸¢à¹€à¸‡à¸´à¸™</div><div class="v">' + escapeHtml(d.payoutStatus || '-') + '</div>' +
          '</div>' +
          (links ? '<p class="tiny" style="margin-top:10px;">' + links + '</p>' : '');
        resultBox.classList.remove('hidden');
      }

      async function loadDeal(refreshPayment) {
        var id = String(dealInput.value || '').trim();
        if (!id) {
          showStatus(statusBox, 'à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸ dealId', 'error');
          return;
        }
        hideStatus(statusBox);
        setBusy(true);
        try {
          var url = '/line/escrow/liff/api/deals/' + encodeURIComponent(id);
          if (refreshPayment) url += '?refreshPayment=1';
          var response = await fetch(url);
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) throw new Error((payload && payload.message) || 'à¹‚à¸«à¸¥à¸”à¸ªà¸–à¸²à¸™à¸°à¸”à¸µà¸¥à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
          renderDeal(payload && payload.deal);
          showStatus(statusBox, 'à¹‚à¸«à¸¥à¸”à¸ªà¸–à¸²à¸™à¸°à¸”à¸µà¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'à¹‚à¸«à¸¥à¸”à¸ªà¸–à¸²à¸™à¸°à¸”à¸µà¸¥à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'error');
        } finally {
          setBusy(false);
        }
      }

      async function refreshTracking() {
        var id = String(dealInput.value || '').trim();
        if (!id) {
          showStatus(statusBox, 'à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸ dealId', 'error');
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
          if (!response.ok) throw new Error((payload && payload.message) || 'à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¸‚à¸™à¸ªà¹ˆà¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
          renderDeal(payload && payload.deal);
          showStatus(statusBox, 'à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¸‚à¸™à¸ªà¹ˆà¸‡à¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'à¸£à¸µà¹€à¸Ÿà¸£à¸Šà¸‚à¸™à¸ªà¹ˆà¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'error');
        } finally {
          setBusy(false);
        }
      }

      async function confirmDelivery() {
        var id = String(dealInput.value || '').trim();
        if (!id) {
          showStatus(statusBox, 'à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸ dealId', 'error');
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
          if (!response.ok) throw new Error((payload && payload.message) || 'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
          renderDeal(payload && payload.deal);
          showStatus(statusBox, (payload && payload.message) || 'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢', 'success');
        } catch (error) {
          showStatus(statusBox, (error && error.message) || 'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ', 'error');
        } finally {
          setBusy(false);
        }
      }

      loadBtn.addEventListener('click', function () { void loadDeal(true); });
      refreshBtn.addEventListener('click', function () { void refreshTracking(); });
      confirmBtn.addEventListener('click', function () { void confirmDelivery(); });

      if (presetDealId) {
        void loadDeal(true);
      }
    `,
  });




