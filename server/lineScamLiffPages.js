const buildShell = ({ title, subtitle, description, bodyHtml, script }) => `<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${title}</title>
    <style>
      :root {
        --bg-top: #f5f9ff;
        --bg-bottom: #eef8f3;
        --card: #ffffff;
        --line: #dbe4f0;
        --text: #0f172a;
        --muted: #5b6474;
        --accent: #0ea5e9;
        --accent-2: #15803d;
        --danger: #dc2626;
        --warn: #d97706;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Noto Sans Thai", "Segoe UI", Tahoma, sans-serif;
        color: var(--text);
        background: linear-gradient(150deg, var(--bg-top), var(--bg-bottom));
      }
      .container {
        width: min(960px, 100%);
        margin: 0 auto;
        padding: 18px 14px 30px;
      }
      .hero {
        border: 1px solid #c9d8eb;
        border-radius: 16px;
        padding: 16px;
        background:
          radial-gradient(circle at 100% 0, rgba(14, 165, 233, 0.18), transparent 58%),
          radial-gradient(circle at 0 100%, rgba(21, 128, 61, 0.16), transparent 54%),
          #ffffff;
        box-shadow: 0 10px 24px rgba(2, 6, 23, 0.08);
      }
      h1 {
        margin: 0;
        font-size: 1.2rem;
        letter-spacing: 0.01em;
      }
      .subtitle {
        margin-top: 6px;
        font-size: 0.88rem;
        color: #334155;
      }
      .description {
        margin-top: 10px;
        font-size: 0.83rem;
        color: var(--muted);
      }
      .card {
        margin-top: 14px;
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
      }
      label {
        display: block;
        font-size: 0.82rem;
        color: #334155;
        margin-bottom: 6px;
        font-weight: 600;
      }
      input[type="text"],
      textarea {
        width: 100%;
        border: 1px solid #cfd8e3;
        border-radius: 10px;
        padding: 10px 11px;
        font: inherit;
        color: inherit;
        background: #ffffff;
      }
      input[type="text"]:focus,
      textarea:focus {
        outline: none;
        border-color: #60a5fa;
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
      }
      textarea {
        min-height: 120px;
        resize: vertical;
      }
      .row {
        display: grid;
        gap: 10px;
      }
      @media (min-width: 760px) {
        .row.two {
          grid-template-columns: 1fr 1fr;
        }
      }
      .btn {
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        font: inherit;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.14s ease, opacity 0.14s ease;
      }
      .btn:active {
        transform: scale(0.98);
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn.primary {
        color: #ffffff;
        background: linear-gradient(120deg, #0ea5e9, #0369a1);
      }
      .btn.upload {
        color: #0f172a;
        border: 1px solid #bfdbfe;
        background: #eff6ff;
      }
      .tiny {
        margin-top: 6px;
        font-size: 0.75rem;
        color: var(--muted);
      }
      .hidden {
        display: none !important;
      }
      .preview {
        margin-top: 10px;
        border: 1px dashed #c4cfde;
        border-radius: 10px;
        min-height: 120px;
        display: grid;
        place-items: center;
        color: #64748b;
        padding: 8px;
        background: #f8fbff;
      }
      .preview img {
        max-width: 100%;
        max-height: 250px;
        border-radius: 8px;
      }
      .preview-grid {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
        gap: 8px;
      }
      .preview-grid img {
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        border-radius: 8px;
        border: 1px solid #dbe4f0;
        background: #ffffff;
      }
      .status {
        margin-top: 10px;
        border: 1px solid #bfdbfe;
        border-radius: 10px;
        background: #eff6ff;
        color: #1e3a8a;
        font-size: 0.84rem;
        padding: 10px 11px;
      }
      .status.error {
        border-color: #fecaca;
        background: #fef2f2;
        color: #991b1b;
      }
      .status.success {
        border-color: #bbf7d0;
        background: #f0fdf4;
        color: #166534;
      }
      .result {
        margin-top: 14px;
        border: 1px solid #dbe4f0;
        border-radius: 12px;
        padding: 12px;
        background: #ffffff;
      }
      .result h3 {
        margin: 0;
        font-size: 0.95rem;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 0.74rem;
        font-weight: 700;
      }
      .badge.ok {
        color: #166534;
        background: #dcfce7;
      }
      .badge.warn {
        color: #9a3412;
        background: #ffedd5;
      }
      .badge.danger {
        color: #991b1b;
        background: #fee2e2;
      }
      .meter {
        margin-top: 8px;
        width: 100%;
        height: 10px;
        border-radius: 999px;
        background: #e2e8f0;
        overflow: hidden;
      }
      .meter > span {
        display: block;
        height: 100%;
        border-radius: 999px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        font-size: 0.78rem;
      }
      th,
      td {
        border-bottom: 1px solid #edf2f7;
        text-align: left;
        padding: 7px 6px;
        vertical-align: top;
      }
      th {
        color: #475569;
        font-weight: 700;
      }
      ul {
        margin: 8px 0 0;
        padding-left: 18px;
      }
      li {
        margin: 4px 0;
      }
      a {
        color: #0369a1;
      }
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
    <script>
      ${script}
    </script>
  </body>
</html>`;

export const renderLineScamScammerCheckPage = () =>
  buildShell({
    title: 'ตรวจสอบมิจฉาชีพ',
    // subtitle: 'ค้นหาข้อมูลผู้ขายจากฐานข้อมูลเคสโกง',
    description:
      'กรอกชื่อ, นามสกุล, เบอร์โทร, เลขบัญชีธนาคาร หรือข้อมูลที่สงสัย แล้วระบบจะสรุปว่าพบประวัติการโกงหรือไม่',
    bodyHtml: `
      <section class="card">
        <form id="lookup-form">
          <label for="lookup-input">ข้อความค้นหา</label>
          <input id="lookup-input" type="text" placeholder="เช่น 0812345678 หรือ 123-4-56789-0" maxlength="120" required />
          <div style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="lookup-submit" class="btn primary" type="submit">ค้นหาข้อมูล</button>
          </div>
        </form>
        <div id="lookup-status" class="status hidden"></div>
        <div id="lookup-result" class="result hidden"></div>
      </section>
    `,
    script: `
      const form = document.getElementById('lookup-form');
      const input = document.getElementById('lookup-input');
      const submitBtn = document.getElementById('lookup-submit');
      const statusBox = document.getElementById('lookup-status');
      const resultBox = document.getElementById('lookup-result');

      function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
          if (char === '&') return '&amp;';
          if (char === '<') return '&lt;';
          if (char === '>') return '&gt;';
          if (char === '"') return '&quot;';
          return '&#39;';
        });
      }

      function showStatus(message, type) {
        statusBox.classList.remove('hidden', 'error', 'success');
        statusBox.textContent = message || '';
        if (type === 'error') statusBox.classList.add('error');
        if (type === 'success') statusBox.classList.add('success');
      }

      function hideStatus() {
        statusBox.classList.add('hidden');
        statusBox.textContent = '';
      }

      function setBusy(isBusy) {
        submitBtn.disabled = Boolean(isBusy);
        submitBtn.textContent = isBusy ? 'กำลังค้นหา...' : 'ค้นหาข้อมูล';
      }

      function renderResult(payload) {
        const matches = Array.isArray(payload && payload.matches) ? payload.matches : [];
        const isScammer = Boolean(payload && payload.isScammer);
        const totalDamage = Number(payload && payload.totalDamageAmount || 0);
        const badgeClass = isScammer ? 'danger' : 'ok';
        const badgeText = isScammer ? 'พบประวัติเสี่ยงโกง' : 'ยังไม่พบประวัติในฐานข้อมูล';

        let rowsHtml = '';
        if (matches.length > 0) {
          for (const row of matches.slice(0, 20)) {
            const fullName = [row.firstName, row.lastName].filter(Boolean).join(' ');
            rowsHtml += '<tr>' +
              '<td>' + escapeHtml(fullName || '-') + '</td>' +
              '<td>' + escapeHtml(row.bankAccount || '-') + '</td>' +
              '<td>' + escapeHtml(row.phone || '-') + '</td>' +
              '<td>' + escapeHtml(row.product || '-') + '</td>' +
              '<td>' + escapeHtml(Number(row.amount || 0).toLocaleString()) + '</td>' +
              '</tr>';
          }
        }

        resultBox.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
            '<h3>ผลการตรวจสอบ</h3>' +
            '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' +
          '</div>' +
          '<p class="tiny">รายการที่พบ: ' + escapeHtml(matches.length) + ' | มูลค่าความเสียหายรวม: ' + escapeHtml(totalDamage.toLocaleString()) + ' บาท</p>' +
          (matches.length > 0
            ? '<div style="overflow-x:auto;"><table><thead><tr><th>ชื่อ</th><th>บัญชี</th><th>โทร</th><th>สินค้า</th><th>มูลค่า</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>'
            : '<p class="tiny">ไม่พบข้อมูลที่ตรงกับคำค้นหาในฐานข้อมูลล่าสุด</p>');
        resultBox.classList.remove('hidden');
      }

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const query = String(input.value || '').trim();
        if (!query) {
          showStatus('กรุณากรอกคำค้นหา', 'error');
          return;
        }

        hideStatus();
        resultBox.classList.add('hidden');
        setBusy(true);
        try {
          const response = await fetch('/line/scam/liff/api/scammer-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
          });
          const payload = await response.json().catch(function () { return null; });
          if (!response.ok) {
            throw new Error((payload && payload.message) || 'ไม่สามารถค้นหาข้อมูลได้');
          }
          renderResult(payload);
          showStatus('โหลดข้อมูลสำเร็จ', 'success');
        } catch (error) {
          showStatus(error && error.message ? error.message : 'เกิดข้อผิดพลาดในการค้นหา', 'error');
        } finally {
          setBusy(false);
        }
      });
    `,
  });

export const renderLineScamFakeNewsPage = ({ maxImageBytes = 0, maxImageCount = 10 } = {}) =>
  buildShell({
    title: 'ตรวจสอบข่าวปลอม',
    // subtitle: 'วิเคราะห์ข้อความข่าวหรือรูปข่าวด้วย Gemini',
    description:
      'ใส่ข้อความข่าว หรืออัปโหลดภาพข่าว ระบบจะวิเคราะห์ความน่าเชื่อถือ พร้อมเปอร์เซ็นต์ข่าวปลอม แหล่งอ้างอิง และช่องทางข่าวจริงที่ควรติดตาม',
    bodyHtml: `
      <section class="card">
        <form id="fake-news-form" class="row">
          <div>
            <label for="news-text">ข้อความข่าว (ถ้ามี)</label>
            <textarea id="news-text" placeholder="วางข้อความข่าวที่ต้องการตรวจสอบ"></textarea>
          </div>
          <div>
            <label>รูปข่าว (ถ้ามี)</label>
            <label class="btn upload" style="display:inline-flex;align-items:center;justify-content:center;" for="news-image">
              อัปโหลดรูปภาพข่าว
            </label>
            <input id="news-image" type="file" accept="image/*" class="hidden" multiple />
            <div id="news-preview" class="preview">ยังไม่ได้เลือกไฟล์ภาพ</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="fake-news-submit" class="btn primary" type="submit">วิเคราะห์ข่าว</button>
          </div>
        </form>
        <div id="fake-news-status" class="status hidden"></div>
        <div id="fake-news-result" class="result hidden"></div>
      </section>
    `,
    script: `
      const form = document.getElementById('fake-news-form');
      const textInput = document.getElementById('news-text');
      const fileInput = document.getElementById('news-image');
      const preview = document.getElementById('news-preview');
      const submitBtn = document.getElementById('fake-news-submit');
      const statusBox = document.getElementById('fake-news-status');
      const resultBox = document.getElementById('fake-news-result');
      const maxBytes = ${Math.max(0, Number(maxImageBytes || 0))};
      const maxImages = ${Math.max(1, Math.min(10, Number(maxImageCount || 10)))};
      let imageDataUrls = [];

      function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
          if (char === '&') return '&amp;';
          if (char === '<') return '&lt;';
          if (char === '>') return '&gt;';
          if (char === '"') return '&quot;';
          return '&#39;';
        });
      }

      function showStatus(message, type) {
        statusBox.classList.remove('hidden', 'error', 'success');
        statusBox.textContent = message || '';
        if (type === 'error') statusBox.classList.add('error');
        if (type === 'success') statusBox.classList.add('success');
      }

      function hideStatus() {
        statusBox.classList.add('hidden');
        statusBox.textContent = '';
      }

      function setBusy(isBusy) {
        submitBtn.disabled = Boolean(isBusy);
        submitBtn.textContent = isBusy ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ข่าว';
      }

      function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
          const reader = new FileReader();
          reader.onload = function () {
            resolve(String(reader.result || ''));
          };
          reader.onerror = function () {
            reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
          };
          reader.readAsDataURL(file);
        });
      }

      function renderImagePreviewList(images) {
        if (!Array.isArray(images) || images.length === 0) {
          preview.textContent = 'ยังไม่ได้เลือกไฟล์ภาพ';
          return;
        }
        preview.innerHTML =
          '<div class="preview-grid">' +
          images
            .map(function (src) {
              return '<img alt="preview" src="' + src + '" />';
            })
            .join('') +
          '</div>';
      }

      function toBadgeClass(percent) {
        if (percent >= 70) return 'danger';
        if (percent >= 40) return 'warn';
        return 'ok';
      }

      function toMeterColor(percent) {
        if (percent >= 70) return '#dc2626';
        if (percent >= 40) return '#d97706';
        return '#15803d';
      }

      function renderResult(payload) {
        const fakePercent = Math.max(0, Math.min(100, Number(payload && payload.fakePercent || 0)));
        const confidencePercent = Math.max(0, Math.min(100, Number(payload && payload.confidencePercent || 0)));
        const verdict = String(payload && payload.verdict || '-');
        const summary = String(payload && payload.summary || '-');
        const reasons = Array.isArray(payload && payload.reasons) ? payload.reasons : [];
        const references = Array.isArray(payload && payload.references) ? payload.references : [];
        const trustedChannels = Array.isArray(payload && payload.trustedChannels) ? payload.trustedChannels : [];
        const meterColor = toMeterColor(fakePercent);

        const reasonsHtml = reasons.length
          ? '<ul>' + reasons.slice(0, 6).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
          : '<p class="tiny">ยังไม่มีเหตุผลประกอบ</p>';

        const refsHtml = references.length
          ? '<ul>' + references.slice(0, 6).map(function (item) {
              const title = escapeHtml(item && item.title ? item.title : item && item.url ? item.url : 'แหล่งข้อมูล');
              const url = escapeHtml(item && item.url ? item.url : '#');
              return '<li><a href="' + url + '" target="_blank" rel="noreferrer">' + title + '</a></li>';
            }).join('') + '</ul>'
          : '<p class="tiny">โมเดลไม่พบแหล่งอ้างอิงที่แน่ชัด</p>';

        const trustedHtml = trustedChannels.length
          ? '<ul>' + trustedChannels.slice(0, 8).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
          : '<p class="tiny">โมเดลยังไม่ได้แนะนำช่องทางเพิ่มเติม</p>';

        resultBox.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
            '<h3>ผลการวิเคราะห์ข่าว</h3>' +
            '<span class="badge ' + toBadgeClass(fakePercent) + '">ข่าวปลอมประมาณ ' + fakePercent.toFixed(0) + '%</span>' +
          '</div>' +
          '<p class="tiny">คำตัดสิน: ' + escapeHtml(verdict) + ' | ความมั่นใจโมเดล: ' + confidencePercent.toFixed(0) + '%</p>' +
          '<div class="meter"><span style="width:' + fakePercent + '%;background:' + meterColor + ';"></span></div>' +
          '<p style="margin-top:10px;">' + escapeHtml(summary) + '</p>' +
          '<h3 style="margin-top:12px;">เหตุผลประกอบ</h3>' +
          reasonsHtml +
          '<h3 style="margin-top:12px;">แหล่งอ้างอิงที่โมเดลแนะนำ</h3>' +
          refsHtml +
          '<h3 style="margin-top:12px;">ช่องทางข่าวจริงที่น่าเชื่อถือ</h3>' +
          trustedHtml;
        resultBox.classList.remove('hidden');
      }

      fileInput.addEventListener('change', function (event) {
        const files = Array.from((event.target && event.target.files) || []);
        if (files.length === 0) return;
        if (files.length > maxImages) {
          showStatus('อัปโหลดได้สูงสุด ' + maxImages + ' รูปต่อครั้ง', 'error');
          fileInput.value = '';
          return;
        }
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          if (!String(file.type || '').toLowerCase().startsWith('image/')) {
            showStatus('อนุญาตเฉพาะไฟล์ภาพ', 'error');
            fileInput.value = '';
            return;
          }
          if (maxBytes > 0 && Number(file.size || 0) > maxBytes) {
            showStatus('ไฟล์รูปมีขนาดใหญ่เกินกำหนด', 'error');
            fileInput.value = '';
            return;
          }
        }
        Promise.all(files.map(function (file) { return readFileAsDataUrl(file); }))
          .then(function (images) {
            imageDataUrls = images.filter(Boolean).slice(0, maxImages);
            renderImagePreviewList(imageDataUrls);
            hideStatus();
          })
          .catch(function (error) {
            showStatus((error && error.message) || 'อ่านไฟล์รูปไม่สำเร็จ', 'error');
            fileInput.value = '';
          });
      });

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const text = String(textInput.value || '').trim();
        if (!text && imageDataUrls.length === 0) {
          showStatus('กรุณาใส่ข้อความข่าวหรืออัปโหลดรูปอย่างน้อย 1 อย่าง', 'error');
          return;
        }
        hideStatus();
        resultBox.classList.add('hidden');
        setBusy(true);
        try {
          const response = await fetch('/line/scam/liff/api/fake-news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: text,
              imageDataUrls: imageDataUrls,
              imageDataUrl: imageDataUrls[0] || ''
            })
          });
          const payload = await response.json().catch(function () { return null; });
          if (!response.ok) {
            throw new Error((payload && payload.message) || 'ไม่สามารถวิเคราะห์ข่าวได้');
          }
          renderResult(payload);
          showStatus('วิเคราะห์สำเร็จ', 'success');
        } catch (error) {
          showStatus(error && error.message ? error.message : 'เกิดข้อผิดพลาดในการวิเคราะห์', 'error');
        } finally {
          setBusy(false);
        }
      });
    `,
  });

export const renderLineScamRiskAssessPage = ({ maxImageBytes = 0, maxImageCount = 10 } = {}) =>
  buildShell({
    title: 'ประเมินความเสี่ยงการโดนโกง',
    // subtitle: 'วิเคราะห์รูปแชทหรือหลักฐานสนทนาด้วย Gemini',
    description:
      'อัปโหลดภาพแชทที่สงสัย พร้อมข้อมูลเสริม (ถ้ามี) ระบบจะประเมินเปอร์เซ็นต์ความเสี่ยงและแนะนำขั้นตอนป้องกัน',
    bodyHtml: `
      <section class="card">
        <form id="risk-form" class="row">
          <div>
            <label>รูปแชทที่ต้องการประเมิน</label>
            <label class="btn upload" style="display:inline-flex;align-items:center;justify-content:center;" for="risk-image">
              อัปโหลดรูปแชท
            </label>
            <input id="risk-image" type="file" accept="image/*" class="hidden" multiple />
            <div id="risk-preview" class="preview">ยังไม่ได้เลือกไฟล์ภาพ</div>
          </div>
          <div>
            <label for="risk-context">ข้อมูลเสริม (ไม่บังคับ)</label>
            <textarea id="risk-context" placeholder="เช่น สินค้าที่คุยกัน ราคา หรือพฤติกรรมที่สงสัย"></textarea>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="risk-submit" class="btn primary" type="submit">ประเมินความเสี่ยง</button>
          </div>
        </form>
        <div id="risk-status" class="status hidden"></div>
        <div id="risk-result" class="result hidden"></div>
      </section>
    `,
    script: `
      const form = document.getElementById('risk-form');
      const fileInput = document.getElementById('risk-image');
      const preview = document.getElementById('risk-preview');
      const contextInput = document.getElementById('risk-context');
      const submitBtn = document.getElementById('risk-submit');
      const statusBox = document.getElementById('risk-status');
      const resultBox = document.getElementById('risk-result');
      const maxBytes = ${Math.max(0, Number(maxImageBytes || 0))};
      const maxImages = ${Math.max(1, Math.min(10, Number(maxImageCount || 10)))};
      let imageDataUrls = [];

      function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
          if (char === '&') return '&amp;';
          if (char === '<') return '&lt;';
          if (char === '>') return '&gt;';
          if (char === '"') return '&quot;';
          return '&#39;';
        });
      }

      function showStatus(message, type) {
        statusBox.classList.remove('hidden', 'error', 'success');
        statusBox.textContent = message || '';
        if (type === 'error') statusBox.classList.add('error');
        if (type === 'success') statusBox.classList.add('success');
      }

      function hideStatus() {
        statusBox.classList.add('hidden');
        statusBox.textContent = '';
      }

      function setBusy(isBusy) {
        submitBtn.disabled = Boolean(isBusy);
        submitBtn.textContent = isBusy ? 'กำลังประเมิน...' : 'ประเมินความเสี่ยง';
      }

      function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
          const reader = new FileReader();
          reader.onload = function () {
            resolve(String(reader.result || ''));
          };
          reader.onerror = function () {
            reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
          };
          reader.readAsDataURL(file);
        });
      }

      function renderImagePreviewList(images) {
        if (!Array.isArray(images) || images.length === 0) {
          preview.textContent = 'ยังไม่ได้เลือกไฟล์ภาพ';
          return;
        }
        preview.innerHTML =
          '<div class="preview-grid">' +
          images
            .map(function (src) {
              return '<img alt="preview" src="' + src + '" />';
            })
            .join('') +
          '</div>';
      }

      function resolveBadgeClass(percent) {
        if (percent >= 70) return 'danger';
        if (percent >= 40) return 'warn';
        return 'ok';
      }

      function resolveMeterColor(percent) {
        if (percent >= 70) return '#dc2626';
        if (percent >= 40) return '#d97706';
        return '#15803d';
      }

      function renderResult(payload) {
        const riskPercent = Math.max(0, Math.min(100, Number(payload && payload.riskPercent || 0)));
        const riskLevel = String(payload && payload.riskLevel || '-');
        const summary = String(payload && payload.summary || '-');
        const signals = Array.isArray(payload && payload.signals) ? payload.signals : [];
        const recommendations = Array.isArray(payload && payload.recommendations) ? payload.recommendations : [];
        const shouldReport = payload && payload.shouldReport === true;

        const signalsHtml = signals.length
          ? '<ul>' + signals.slice(0, 8).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
          : '<p class="tiny">โมเดลยังไม่พบสัญญาณความเสี่ยงชัดเจน</p>';

        const recsHtml = recommendations.length
          ? '<ul>' + recommendations.slice(0, 10).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
          : '<p class="tiny">โมเดลยังไม่มีคำแนะนำเพิ่มเติม</p>';

        resultBox.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
            '<h3>ผลประเมินความเสี่ยง</h3>' +
            '<span class="badge ' + resolveBadgeClass(riskPercent) + '">ความเสี่ยงประมาณ ' + riskPercent.toFixed(0) + '%</span>' +
          '</div>' +
          '<p class="tiny">ระดับความเสี่ยง: ' + escapeHtml(riskLevel) + (shouldReport ? ' | แนะนำให้เก็บหลักฐานและแจ้งความ' : '') + '</p>' +
          '<div class="meter"><span style="width:' + riskPercent + '%;background:' + resolveMeterColor(riskPercent) + ';"></span></div>' +
          '<p style="margin-top:10px;">' + escapeHtml(summary) + '</p>' +
          '<h3 style="margin-top:12px;">สัญญาณที่ตรวจพบ</h3>' +
          signalsHtml +
          '<h3 style="margin-top:12px;">คำแนะนำที่ควรทำต่อ</h3>' +
          recsHtml;
        resultBox.classList.remove('hidden');
      }

      fileInput.addEventListener('change', function (event) {
        const files = Array.from((event.target && event.target.files) || []);
        if (files.length === 0) return;
        if (files.length > maxImages) {
          showStatus('อัปโหลดได้สูงสุด ' + maxImages + ' รูปต่อครั้ง', 'error');
          fileInput.value = '';
          return;
        }
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          if (!String(file.type || '').toLowerCase().startsWith('image/')) {
            showStatus('อนุญาตเฉพาะไฟล์ภาพ', 'error');
            fileInput.value = '';
            return;
          }
          if (maxBytes > 0 && Number(file.size || 0) > maxBytes) {
            showStatus('ไฟล์รูปมีขนาดใหญ่เกินกำหนด', 'error');
            fileInput.value = '';
            return;
          }
        }
        Promise.all(files.map(function (file) { return readFileAsDataUrl(file); }))
          .then(function (images) {
            imageDataUrls = images.filter(Boolean).slice(0, maxImages);
            renderImagePreviewList(imageDataUrls);
            hideStatus();
          })
          .catch(function (error) {
            showStatus((error && error.message) || 'อ่านไฟล์รูปไม่สำเร็จ', 'error');
            fileInput.value = '';
          });
      });

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (imageDataUrls.length === 0) {
          showStatus('กรุณาอัปโหลดรูปแชทก่อนประเมิน', 'error');
          return;
        }
        hideStatus();
        resultBox.classList.add('hidden');
        setBusy(true);
        try {
          const response = await fetch('/line/scam/liff/api/risk-assess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageDataUrls: imageDataUrls,
              imageDataUrl: imageDataUrls[0] || '',
              contextText: String(contextInput.value || '').trim()
            })
          });
          const payload = await response.json().catch(function () { return null; });
          if (!response.ok) {
            throw new Error((payload && payload.message) || 'ไม่สามารถประเมินความเสี่ยงได้');
          }
          renderResult(payload);
          showStatus('ประเมินสำเร็จ', 'success');
        } catch (error) {
          showStatus(error && error.message ? error.message : 'เกิดข้อผิดพลาดในการประเมิน', 'error');
        } finally {
          setBusy(false);
        }
      });
    `,
  });
