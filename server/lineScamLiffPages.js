const buildShell = ({ title = '', subtitle = '', description = '', bodyHtml = '', script = '' }) => `<!doctype html>
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
        ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
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
      let selectedFiles = [];
      let previewUrls = [];

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
            reject(new Error('อ่านไฟล์รูปไม่สำเร็จ กรุณาลองเลือกรูปใหม่หรือเลือกรูปที่ขนาดเล็กลง'));
          };
          reader.readAsDataURL(file);
        });
      }

      function clearPreviewUrls() {
        previewUrls.forEach(function (url) {
          try {
            URL.revokeObjectURL(url);
          } catch (_error) {}
        });
        previewUrls = [];
      }

      function setSelectedFiles(files) {
        clearPreviewUrls();
        selectedFiles = Array.isArray(files) ? files.slice(0, maxImages) : [];
        previewUrls = selectedFiles.map(function (file) {
          return URL.createObjectURL(file);
        });
        renderImagePreviewList(previewUrls);
      }

      async function convertFilesToDataUrls(files) {
        const output = [];
        const list = Array.isArray(files) ? files : [];
        for (let index = 0; index < list.length; index += 1) {
          output.push(await readFileAsDataUrl(list[index]));
        }
        return output.filter(Boolean);
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
          setSelectedFiles([]);
          return;
        }
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          if (!String(file.type || '').toLowerCase().startsWith('image/')) {
            showStatus('อนุญาตเฉพาะไฟล์ภาพ', 'error');
            fileInput.value = '';
            setSelectedFiles([]);
            return;
          }
          if (maxBytes > 0 && Number(file.size || 0) > maxBytes) {
            showStatus('ไฟล์รูปมีขนาดใหญ่เกินกำหนด', 'error');
            fileInput.value = '';
            setSelectedFiles([]);
            return;
          }
        }
        setSelectedFiles(files);
        hideStatus();
      });

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const text = String(textInput.value || '').trim();
        if (!text && selectedFiles.length === 0) {
          showStatus('กรุณาใส่ข้อความข่าวหรืออัปโหลดรูปอย่างน้อย 1 อย่าง', 'error');
          return;
        }
        hideStatus();
        resultBox.classList.add('hidden');
        setBusy(true);
        try {
          const imageDataUrls = await convertFilesToDataUrls(selectedFiles);
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

      window.addEventListener('beforeunload', function () {
        clearPreviewUrls();
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
      let selectedFiles = [];
      let previewUrls = [];

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
            reject(new Error('อ่านไฟล์รูปไม่สำเร็จ กรุณาลองเลือกรูปใหม่หรือเลือกรูปที่ขนาดเล็กลง'));
          };
          reader.readAsDataURL(file);
        });
      }

      function clearPreviewUrls() {
        previewUrls.forEach(function (url) {
          try {
            URL.revokeObjectURL(url);
          } catch (_error) {}
        });
        previewUrls = [];
      }

      function setSelectedFiles(files) {
        clearPreviewUrls();
        selectedFiles = Array.isArray(files) ? files.slice(0, maxImages) : [];
        previewUrls = selectedFiles.map(function (file) {
          return URL.createObjectURL(file);
        });
        renderImagePreviewList(previewUrls);
      }

      async function convertFilesToDataUrls(files) {
        const output = [];
        const list = Array.isArray(files) ? files : [];
        for (let index = 0; index < list.length; index += 1) {
          output.push(await readFileAsDataUrl(list[index]));
        }
        return output.filter(Boolean);
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
          setSelectedFiles([]);
          return;
        }
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          if (!String(file.type || '').toLowerCase().startsWith('image/')) {
            showStatus('อนุญาตเฉพาะไฟล์ภาพ', 'error');
            fileInput.value = '';
            setSelectedFiles([]);
            return;
          }
          if (maxBytes > 0 && Number(file.size || 0) > maxBytes) {
            showStatus('ไฟล์รูปมีขนาดใหญ่เกินกำหนด', 'error');
            fileInput.value = '';
            setSelectedFiles([]);
            return;
          }
        }
        setSelectedFiles(files);
        hideStatus();
      });

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (selectedFiles.length === 0) {
          showStatus('กรุณาอัปโหลดรูปแชทก่อนประเมิน', 'error');
          return;
        }
        hideStatus();
        resultBox.classList.add('hidden');
        setBusy(true);
        try {
          const imageDataUrls = await convertFilesToDataUrls(selectedFiles);
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

      window.addEventListener('beforeunload', function () {
        clearPreviewUrls();
      });
    `,
  });

export const renderLineScamPoliceStationsPage = () =>
  buildShell({
    title: 'แจ้งความที่สถานีตำรวจ',
    description:
      'ค้นหาสถานีตำรวจทั่วไทยจากชื่อ/จังหวัด/ที่อยู่ และกดใช้ GPS เพื่อเรียงสถานีที่อยู่ใกล้คุณที่สุด พร้อมปุ่มโทรและเปิดแผนที่',
    bodyHtml: `
      <section class="card">
        <form id="police-search-form" class="row">
          <div>
            <label for="police-query">ค้นหาสถานีตำรวจ</label>
            <input
              id="police-query"
              type="text"
              maxlength="120"
              placeholder="เช่น เมืองเชียงใหม่, บางรัก, พัทยา"
            />
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="police-search-submit" class="btn primary" type="submit">ค้นหา</button>
            <button id="police-search-nearest" class="btn upload" type="button">ใช้ GPS หาใกล้สุด</button>
          </div>
        </form>
        <div id="police-status" class="status hidden"></div>
        <div id="police-summary" class="tiny" style="margin-top:10px;"></div>
        <div id="police-results" class="row" style="margin-top:10px;"></div>
        <div id="police-pagination" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;">
          <button id="police-page-first" class="btn upload" type="button" title="หน้าแรก" aria-label="หน้าแรก">&lt;&lt;</button>
          <button id="police-page-prev" class="btn upload" type="button" title="ย้อนกลับ" aria-label="ย้อนกลับ">&lt;</button>
          <button id="police-page-next" class="btn upload" type="button" title="ถัดไป" aria-label="ถัดไป">&gt;</button>
          <span id="police-page-info" class="tiny" style="margin-top:0;">หน้า 1 / 1</span>
        </div>
      </section>
    `,
    script: `
      const form = document.getElementById('police-search-form');
      const queryInput = document.getElementById('police-query');
      const submitBtn = document.getElementById('police-search-submit');
      const nearestBtn = document.getElementById('police-search-nearest');
      const statusBox = document.getElementById('police-status');
      const summaryBox = document.getElementById('police-summary');
      const resultsBox = document.getElementById('police-results');
      const pagerFirstBtn = document.getElementById('police-page-first');
      const pagerPrevBtn = document.getElementById('police-page-prev');
      const pagerNextBtn = document.getElementById('police-page-next');
      const pagerInfo = document.getElementById('police-page-info');

      let selectedLat = null;
      let selectedLng = null;
      let currentPage = 1;
      let totalPages = 1;

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

      function setBusy(isBusy, source) {
        submitBtn.disabled = Boolean(isBusy);
        nearestBtn.disabled = Boolean(isBusy);
        pagerFirstBtn.disabled = Boolean(isBusy);
        pagerPrevBtn.disabled = Boolean(isBusy);
        pagerNextBtn.disabled = Boolean(isBusy);
        if (!isBusy) {
          submitBtn.textContent = 'ค้นหา';
          nearestBtn.textContent = 'ใช้ GPS หาใกล้สุด';
          return;
        }
        if (source === 'gps') {
          nearestBtn.textContent = 'กำลังใช้ GPS...';
          submitBtn.textContent = 'ค้นหา';
          return;
        }
        submitBtn.textContent = 'กำลังค้นหา...';
        nearestBtn.textContent = 'ใช้ GPS หาใกล้สุด';
      }

      function updatePager() {
        if (!pagerInfo) return;
        const safeTotalPages = Math.max(1, Number(totalPages || 1));
        const safeCurrentPage = Math.min(safeTotalPages, Math.max(1, Number(currentPage || 1)));
        currentPage = safeCurrentPage;
        totalPages = safeTotalPages;
        pagerInfo.textContent = 'หน้า ' + safeCurrentPage + ' / ' + safeTotalPages;
        pagerFirstBtn.disabled = safeCurrentPage <= 1;
        pagerPrevBtn.disabled = safeCurrentPage <= 1;
        pagerNextBtn.disabled = safeCurrentPage >= safeTotalPages;
      }

      function toTelUri(phoneInput) {
        const raw = String(phoneInput || '').trim();
        if (!raw) return '';
        const compact = raw.replace(/[^0-9+#*]/g, '');
        if (!compact) return '';
        return 'tel:' + compact;
      }

      function renderResults(payload) {
        const stations = Array.isArray(payload && payload.stations) ? payload.stations : [];
        const total = Number(payload && payload.total || 0);
        const payloadPage = Number(payload && payload.page || 1);
        const payloadTotalPages = Number(payload && payload.totalPages || 1);
        currentPage = Number.isFinite(payloadPage) ? payloadPage : 1;
        totalPages = Number.isFinite(payloadTotalPages) ? payloadTotalPages : 1;
        updatePager();

        summaryBox.textContent = 'พบทั้งหมด ' + Number(total || stations.length).toLocaleString() + ' สถานี';

        if (!stations.length) {
          resultsBox.innerHTML = '<div class="card" style="margin-top:0;"><p class="tiny">ไม่พบสถานีที่ตรงคำค้นหา ลองค้นหาด้วยชื่อจังหวัดหรืออำเภอ</p></div>';
          return;
        }

        resultsBox.innerHTML = stations
          .map(function (station, index) {
            const name = escapeHtml(station && station.name ? station.name : 'สถานีตำรวจ');
            const address = escapeHtml(station && station.address ? station.address : '-');
            const phone = escapeHtml(station && station.phone ? station.phone : '-');
            const distanceKm = Number(station && station.distanceKm);
            const distanceText = Number.isFinite(distanceKm) && distanceKm >= 0
              ? distanceKm.toFixed(2) + ' กม.'
              : '-';
            const mapUrl = escapeHtml(station && station.mapUrl ? station.mapUrl : '#');
            const telUrl = toTelUri(station && station.phone ? station.phone : '');
            const stationLatitude = Number(station && station.latitude);
            const stationLongitude = Number(station && station.longitude);
            const hasValidStationCoords =
              Number.isFinite(stationLatitude) &&
              Number.isFinite(stationLongitude) &&
              !(Math.abs(stationLatitude) < 0.0000001 && Math.abs(stationLongitude) < 0.0000001);
            const destinationFallback = String(
              [station && station.name ? station.name : '', station && station.address ? station.address : '']
                .filter(Boolean)
                .join(' ')
            ).trim();
            const directionUrl =
              selectedLat === null || selectedLng === null
                ? ''
                : hasValidStationCoords
                  ? 'https://www.google.com/maps/dir/?api=1&origin=' +
                    encodeURIComponent(String(selectedLat) + ',' + String(selectedLng)) +
                    '&destination=' +
                    encodeURIComponent(String(stationLatitude) + ',' + String(stationLongitude)) +
                    '&travelmode=driving'
                  : destinationFallback
                    ? 'https://www.google.com/maps/dir/?api=1&origin=' +
                      encodeURIComponent(String(selectedLat) + ',' + String(selectedLng)) +
                      '&destination=' +
                      encodeURIComponent(destinationFallback) +
                      '&travelmode=driving'
                    : '';
            return (
              '<article class="card" style="margin-top:0;">' +
                '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
                  '<h3 style="margin:0;">' + escapeHtml(String(index + 1)) + '. ' + name + '</h3>' +
                  '<span class="badge ok">ระยะทาง: ' + escapeHtml(distanceText) + '</span>' +
                '</div>' +
                '<p class="tiny" style="margin-top:8px;">ที่อยู่: ' + address + '</p>' +
                '<p class="tiny">เบอร์ติดต่อ: ' + phone + '</p>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">' +
                  (telUrl
                    ? '<a class="btn upload" href="' + escapeHtml(telUrl) + '" style="text-decoration:none;">โทรสถานี</a>'
                    : '') +
                  '<a class="btn upload" href="' + mapUrl + '" target="_blank" rel="noreferrer" style="text-decoration:none;">เปิดแผนที่</a>' +
                  (directionUrl
                    ? '<a class="btn upload" href="' + escapeHtml(directionUrl) + '" target="_blank" rel="noreferrer" style="text-decoration:none;">นำทางจากตำแหน่งฉัน</a>'
                    : '') +
                '</div>' +
              '</article>'
            );
          })
          .join('');
      }

      async function loadStations(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const query = String(opts.query || '').trim();
        const lat = Number.isFinite(Number(opts.lat)) ? Number(opts.lat) : null;
        const lng = Number.isFinite(Number(opts.lng)) ? Number(opts.lng) : null;
        const source = String(opts.source || '');
        const pageRaw = Number.parseInt(String(opts.page || currentPage || 1), 10);
        const page = Number.isInteger(pageRaw) ? Math.max(1, pageRaw) : 1;
        const params = new URLSearchParams();
        if (query) params.set('query', query);
        if (lat !== null && lng !== null) {
          params.set('lat', String(lat));
          params.set('lng', String(lng));
        }
        params.set('page', String(page));
        params.set('pageSize', '20');
        params.set('refresh', '1');

        hideStatus();
        setBusy(true, source === 'gps' ? 'gps' : 'search');
        try {
          const response = await fetch('/line/scam/liff/api/police-stations?' + params.toString(), {
            method: 'GET'
          });
          const payload = await response.json().catch(function () { return null; });
          if (!response.ok) {
            throw new Error((payload && payload.message) || 'ไม่สามารถโหลดข้อมูลสถานีตำรวจได้');
          }
          renderResults(payload || {});
          hideStatus();
        } catch (error) {
          resultsBox.innerHTML = '';
          summaryBox.textContent = '';
          showStatus(error && error.message ? error.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลสถานีตำรวจ', 'error');
        } finally {
          setBusy(false);
        }
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        const query = String(queryInput.value || '').trim();
        currentPage = 1;
        updatePager();
        loadStations({
          query: query,
          lat: selectedLat,
          lng: selectedLng,
          page: 1,
          source: 'search'
        });
      });

      nearestBtn.addEventListener('click', function () {
        if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== 'function') {
          showStatus('อุปกรณ์ไม่รองรับ GPS location', 'error');
          return;
        }
        hideStatus();
        setBusy(true, 'gps');
        navigator.geolocation.getCurrentPosition(
          function (position) {
            selectedLat = Number(position && position.coords && position.coords.latitude);
            selectedLng = Number(position && position.coords && position.coords.longitude);
            if (!Number.isFinite(selectedLat) || !Number.isFinite(selectedLng)) {
              setBusy(false);
              showStatus('ไม่สามารถอ่านพิกัดจาก GPS ได้', 'error');
              return;
            }
            loadStations({
              query: String(queryInput.value || '').trim(),
              lat: selectedLat,
              lng: selectedLng,
              page: 1,
              source: 'gps'
            });
          },
          function (error) {
            setBusy(false);
            const code = Number(error && error.code || 0);
            if (code === 1) {
              showStatus('ต้องอนุญาตการเข้าถึงตำแหน่งก่อน จึงจะเรียงสถานีใกล้สุดได้', 'error');
              return;
            }
            if (code === 3) {
              showStatus('ขอพิกัดนานเกินไป กรุณาลองใหม่ในจุดที่สัญญาณดีขึ้น', 'error');
              return;
            }
            showStatus('ไม่สามารถอ่านตำแหน่งปัจจุบันได้', 'error');
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 30000
          }
        );
      });

      pagerFirstBtn.addEventListener('click', function () {
        if (currentPage <= 1) return;
        loadStations({
          query: String(queryInput.value || '').trim(),
          lat: selectedLat,
          lng: selectedLng,
          page: 1,
          source: 'search'
        });
      });

      pagerPrevBtn.addEventListener('click', function () {
        if (currentPage <= 1) return;
        loadStations({
          query: String(queryInput.value || '').trim(),
          lat: selectedLat,
          lng: selectedLng,
          page: currentPage - 1,
          source: 'search'
        });
      });

      pagerNextBtn.addEventListener('click', function () {
        if (currentPage >= totalPages) return;
        loadStations({
          query: String(queryInput.value || '').trim(),
          lat: selectedLat,
          lng: selectedLng,
          page: currentPage + 1,
          source: 'search'
        });
      });

      updatePager();
      loadStations({ query: '', page: 1 });
    `,
  });

export const renderLineScamFraudReportPage = ({
  maxImageBytes = 0,
  authTtlMs = 60 * 60 * 1000,
  googleClientId = '',
} = {}) =>
  buildShell({
    title: 'รายงานคนโกง',
    subtitle: 'ลงทะเบียนยืนยันตัวตนก่อนใช้งาน',
    description: 'เมื่อเข้าสู่ระบบแล้วสามารถส่งรายงานและดูประวัติรายงานของตนเองได้',
    bodyHtml: `
      <section class="card">
        <div id="auth-status" class="status hidden"></div>
        <div id="auth-summary" class="tiny">ยังไม่ได้เข้าสู่ระบบ</div>
        <div id="auth-gate" style="margin-top:10px;">
          <div style="display:flex;gap:8px;">
            <button id="tab-login" type="button" class="btn upload">เข้าสู่ระบบ</button>
            <button id="tab-register" type="button" class="btn upload">ลงทะเบียน</button>
          </div>
          <form id="login-form" style="margin-top:10px;" class="row">
            <div><label for="login-identifier">ชื่อผู้ใช้หรืออีเมล</label><input id="login-identifier" type="text" required /></div>
            <div><label for="login-password">รหัสผ่าน</label><input id="login-password" type="password" required /></div>
            <div><button id="login-submit" class="btn primary" type="submit">เข้าสู่ระบบ</button></div>
          </form>
          <form id="register-form" style="margin-top:10px;" class="row hidden">
            <div class="row two">
              <div><label for="reg-first-name">ชื่อจริง</label><input id="reg-first-name" type="text" required /></div>
              <div><label for="reg-last-name">นามสกุล</label><input id="reg-last-name" type="text" required /></div>
            </div>
            <div><label for="reg-address">ที่อยู่</label><textarea id="reg-address"></textarea></div>
            <div class="row two">
              <div><label for="reg-citizen-id">บัตรประชาชน</label><input id="reg-citizen-id" type="text" required /></div>
              <div><label for="reg-phone">เบอร์โทร</label><input id="reg-phone" type="text" required /></div>
            </div>
            <div class="row two">
              <div><label for="reg-username">ชื่อผู้ใช้</label><input id="reg-username" type="text" required /></div>
              <div><label for="reg-email">อีเมล</label><input id="reg-email" type="text" required /></div>
            </div>
            <div><label for="reg-password">รหัสผ่าน</label><input id="reg-password" type="password" required /></div>
            <div><button id="register-submit" class="btn primary" type="submit">ลงทะเบียน</button></div>
          </form>
          <div style="margin-top:10px;border-top:1px dashed #dbe4f0;padding-top:10px;">
            <p class="tiny">หรือเข้าสู่ระบบด้วย Google</p>
            <div id="google-signin-box"></div>
            <button id="google-prompt-btn" type="button" class="btn upload hidden" style="margin-top:8px;">Google Sign-In</button>
            <p id="google-hint" class="tiny hidden"></p>
          </div>
        </div>
        <div id="auth-ready" class="hidden" style="margin-top:10px;">
          <div class="status success">เข้าสู่ระบบแล้ว <span id="session-expire-text" class="tiny"></span></div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button id="refresh-profile-btn" type="button" class="btn upload">รีเฟรช</button>
            <button id="logout-btn" type="button" class="btn upload">ออกจากระบบ</button>
          </div>
        </div>
      </section>

      <section id="verify-card" class="card hidden">
        <h3 style="margin:0;">ยืนยันตัวตนเพิ่มเติม</h3>
        <p class="tiny">กรอกข้อมูลให้ครบก่อนส่งรายงาน</p>
        <form id="verify-form" class="row" style="margin-top:10px;">
          <div class="row two">
            <div><label for="verify-first-name">ชื่อจริง</label><input id="verify-first-name" type="text" required /></div>
            <div><label for="verify-last-name">นามสกุล</label><input id="verify-last-name" type="text" required /></div>
          </div>
          <div><label for="verify-address">ที่อยู่</label><textarea id="verify-address"></textarea></div>
          <div class="row two">
            <div><label for="verify-citizen-id">บัตรประชาชน</label><input id="verify-citizen-id" type="text" required /></div>
            <div><label for="verify-phone">เบอร์โทร</label><input id="verify-phone" type="text" required /></div>
          </div>
          <div class="row two">
            <div><label for="verify-username">ชื่อผู้ใช้</label><input id="verify-username" type="text" required /></div>
            <div><label for="verify-email">อีเมล</label><input id="verify-email" type="text" disabled /></div>
          </div>
          <div><button id="verify-submit" class="btn primary" type="submit">บันทึกข้อมูล</button></div>
        </form>
        <div id="verify-status" class="status hidden"></div>
      </section>

      <section id="report-card" class="card hidden">
        <h3 style="margin:0;">แบบฟอร์มรายงานคนโกง</h3>
        <form id="report-form" class="row" style="margin-top:10px;">
          <div><label for="report-seller-alias">ชื่อร้าน/ชื่อบัญชี</label><input id="report-seller-alias" type="text" required /></div>
          <div class="row two">
            <div><label for="report-first-name">ชื่อจริงคนโกง</label><input id="report-first-name" type="text" required /></div>
            <div><label for="report-last-name">นามสกุลคนโกง</label><input id="report-last-name" type="text" required /></div>
          </div>
          <div class="row two">
            <div><label for="report-citizen-id">บัตรประชาชน (ถ้ามี)</label><input id="report-citizen-id" type="text" /></div>
            <div><label for="report-phone">เบอร์โทร (ถ้ามี)</label><input id="report-phone" type="text" /></div>
          </div>
          <div class="row two">
            <div><label for="report-bank-account">เลขบัญชี</label><input id="report-bank-account" type="text" required /></div>
            <div><label for="report-bank-name">ธนาคาร</label><input id="report-bank-name" type="text" required /></div>
          </div>
          <div><label for="report-product">สินค้า/บริการ</label><input id="report-product" type="text" required /></div>
          <div class="row two">
            <div><label for="report-amount">ยอดเงินโอน (บาท)</label><input id="report-amount" type="text" required /></div>
            <div><label for="report-transfer-date">วันที่โอน</label><input id="report-transfer-date" type="date" required /></div>
          </div>
          <div class="row two">
            <div><label for="report-page-url">ลิงก์เพจ/โพสต์</label><input id="report-page-url" type="text" /></div>
            <div><label for="report-province">จังหวัด</label><input id="report-province" type="text" /></div>
          </div>
          <div>
            <label>หลักฐานรูปภาพ (ไม่บังคับ)</label>
            <label for="report-evidence-input" class="btn upload" style="display:inline-flex;align-items:center;justify-content:center;">อัปโหลดรูป</label>
            <input id="report-evidence-input" type="file" accept="image/*" class="hidden" />
            <div id="report-evidence-preview" class="preview">ยังไม่ได้เลือกรูป</div>
            <p class="tiny">สูงสุด ${Math.max(0, Number(maxImageBytes || 0)).toLocaleString()} bytes</p>
          </div>
          <div><button id="report-submit" class="btn primary" type="submit">ส่งรายงาน</button></div>
        </form>
        <div id="report-status" class="status hidden"></div>
      </section>

      <section id="history-card" class="card hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <h3 style="margin:0;">ประวัติการรายงานของฉัน</h3>
          <button id="history-refresh-btn" class="btn upload" type="button">รีเฟรช</button>
        </div>
        <p id="history-summary" class="tiny">ยังไม่มีรายการ</p>
        <div id="history-status" class="status hidden"></div>
        <div id="history-list" style="display:grid;gap:8px;margin-top:8px;"></div>
      </section>
    `,
    script: `
      const AUTH_TOKEN_KEY = 'line_scam_reporter_auth_token';
      const AUTH_EXPIRES_KEY = 'line_scam_reporter_auth_expires_at';
      const maxImageBytes = ${Math.max(0, Number(maxImageBytes || 0))};
      const fallbackTtl = ${Math.max(60 * 1000, Number(authTtlMs || 60 * 60 * 1000))};
      const googleClientId = ${JSON.stringify(String(googleClientId || ''))};

      const authStatus = document.getElementById('auth-status');
      const authSummary = document.getElementById('auth-summary');
      const authGate = document.getElementById('auth-gate');
      const authReady = document.getElementById('auth-ready');
      const sessionExpireText = document.getElementById('session-expire-text');
      const tabLogin = document.getElementById('tab-login');
      const tabRegister = document.getElementById('tab-register');
      const loginForm = document.getElementById('login-form');
      const registerForm = document.getElementById('register-form');
      const loginSubmit = document.getElementById('login-submit');
      const registerSubmit = document.getElementById('register-submit');
      const refreshProfileBtn = document.getElementById('refresh-profile-btn');
      const logoutBtn = document.getElementById('logout-btn');

      const verifyCard = document.getElementById('verify-card');
      const verifyForm = document.getElementById('verify-form');
      const verifySubmit = document.getElementById('verify-submit');
      const verifyStatus = document.getElementById('verify-status');

      const reportCard = document.getElementById('report-card');
      const reportForm = document.getElementById('report-form');
      const reportSubmit = document.getElementById('report-submit');
      const reportStatus = document.getElementById('report-status');
      const reportEvidenceInput = document.getElementById('report-evidence-input');
      const reportEvidencePreview = document.getElementById('report-evidence-preview');

      const historyCard = document.getElementById('history-card');
      const historySummary = document.getElementById('history-summary');
      const historyStatus = document.getElementById('history-status');
      const historyList = document.getElementById('history-list');
      const historyRefreshBtn = document.getElementById('history-refresh-btn');

      const googleSigninBox = document.getElementById('google-signin-box');
      const googlePromptBtn = document.getElementById('google-prompt-btn');
      const googleHint = document.getElementById('google-hint');

      let authToken = '';
      let expiresAt = 0;
      let timer = null;
      let profile = null;
      let evidenceImage = null;

      function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
          if (char === '&') return '&amp;';
          if (char === '<') return '&lt;';
          if (char === '>') return '&gt;';
          if (char === '"') return '&quot;';
          return '&#39;';
        });
      }
      function showBox(box, message, type) {
        if (!box) return;
        box.classList.remove('hidden', 'error', 'success');
        box.textContent = message || '';
        if (type === 'error') box.classList.add('error');
        if (type === 'success') box.classList.add('success');
      }
      function hideBox(box) {
        if (!box) return;
        box.classList.add('hidden');
        box.textContent = '';
        box.classList.remove('error', 'success');
      }
      function setBusy(btn, busy, busyText, idleText) {
        if (!btn) return;
        btn.disabled = Boolean(busy);
        btn.textContent = busy ? busyText : idleText;
      }
      function getProfileComplete(p) {
        const x = p && typeof p === 'object' ? p : {};
        return Boolean(
          String(x.firstName || '').trim() &&
          String(x.lastName || '').trim() &&
          String(x.address || '').trim() &&
          String(x.citizenId || '').trim().length === 13 &&
          String(x.phone || '').trim() &&
          String(x.username || '').trim() &&
          String(x.email || '').trim()
        );
      }
      function authHeaders() {
        return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + String(authToken || '') };
      }
      async function parseJson(response) {
        const payload = await response.json().catch(function () { return null; });
        if (!response.ok) throw new Error((payload && payload.message) || 'Request failed');
        return payload || {};
      }
      function saveAuth(token, exp) {
        authToken = String(token || '').trim();
        expiresAt = Number(exp || 0);
        if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken); else localStorage.removeItem(AUTH_TOKEN_KEY);
        if (expiresAt > 0) localStorage.setItem(AUTH_EXPIRES_KEY, String(expiresAt)); else localStorage.removeItem(AUTH_EXPIRES_KEY);
        scheduleAutoLogout();
      }
      function clearAuth() {
        saveAuth('', 0);
        profile = null;
      }
      function scheduleAutoLogout() {
        if (timer) { clearTimeout(timer); timer = null; }
        if (!authToken || !expiresAt || expiresAt <= Date.now()) {
          if (sessionExpireText) sessionExpireText.textContent = '';
          return;
        }
        const leftMs = Math.max(1000, expiresAt - Date.now());
        const leftMin = Math.ceil(leftMs / 60000);
        sessionExpireText.textContent = 'หมดเวลาใน ' + leftMin + ' นาที';
        timer = setTimeout(function () {
          clearAuth();
          updateUi();
          showBox(authStatus, 'หมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่', 'error');
        }, leftMs);
      }
      function switchTab(name) {
        const isLogin = name === 'login';
        loginForm.classList.toggle('hidden', !isLogin);
        registerForm.classList.toggle('hidden', isLogin);
      }
      function fillVerifyForm(p) {
        const x = p && typeof p === 'object' ? p : {};
        document.getElementById('verify-first-name').value = String(x.firstName || '');
        document.getElementById('verify-last-name').value = String(x.lastName || '');
        document.getElementById('verify-address').value = String(x.address || '');
        document.getElementById('verify-citizen-id').value = String(x.citizenId || '');
        document.getElementById('verify-phone').value = String(x.phone || '');
        document.getElementById('verify-username').value = String(x.username || '');
        document.getElementById('verify-email').value = String(x.email || '');
      }
      function updateUi() {
        const loggedIn = Boolean(authToken && profile);
        authGate.classList.toggle('hidden', loggedIn);
        authReady.classList.toggle('hidden', !loggedIn);
        if (!loggedIn) {
          verifyCard.classList.add('hidden');
          reportCard.classList.add('hidden');
          historyCard.classList.add('hidden');
          authSummary.textContent = 'ยังไม่ได้เข้าสู่ระบบ';
          return;
        }
        authSummary.textContent = 'ผู้ใช้: ' + String(profile.username || '-') + ' (' + String(profile.email || '-') + ')';
        const complete = getProfileComplete(profile);
        verifyCard.classList.toggle('hidden', complete);
        reportCard.classList.toggle('hidden', !complete);
        historyCard.classList.remove('hidden');
        fillVerifyForm(profile);
      }
      async function loadMe() {
        if (!authToken) return;
        const response = await fetch('/line/scam/liff/api/reporter/me', { method: 'GET', headers: authHeaders() });
        const payload = await parseJson(response);
        profile = payload.profile || null;
        saveAuth(authToken, Number(payload.expiresAt || (Date.now() + fallbackTtl)));
      }
      function renderHistory(reports) {
        const rows = Array.isArray(reports) ? reports : [];
        historySummary.textContent = 'ทั้งหมด ' + rows.length + ' รายการ';
        if (!rows.length) {
          historyList.innerHTML = '<div class="tiny">ยังไม่มีประวัติ</div>';
          return;
        }
        historyList.innerHTML = rows.map(function (row, idx) {
          const title = String(row && row.sellerAlias || '-');
          const amount = Number(row && row.amount || 0).toLocaleString();
          const date = String(row && row.createdAt || '-');
          return '<article style="border:1px solid #dbe4f0;border-radius:10px;padding:10px;background:#f8fbff;">'
            + '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;"><strong>' + escapeHtml(String(idx + 1) + '. ' + title) + '</strong><span class="tiny">' + escapeHtml(date) + '</span></div>'
            + '<div class="tiny">สินค้า: ' + escapeHtml(String(row && row.product || '-')) + '</div>'
            + '<div class="tiny">ยอดโอน: ' + escapeHtml(amount) + ' บาท</div>'
            + '</article>';
        }).join('');
      }
      async function loadHistory() {
        if (!authToken) return;
        hideBox(historyStatus);
        historyRefreshBtn.disabled = true;
        try {
          const response = await fetch('/line/scam/liff/api/reporter/reports?limit=300', { method: 'GET', headers: authHeaders() });
          const payload = await parseJson(response);
          renderHistory(payload.reports || []);
        } catch (error) {
          renderHistory([]);
          showBox(historyStatus, error && error.message ? error.message : 'โหลดประวัติไม่สำเร็จ', 'error');
        } finally {
          historyRefreshBtn.disabled = false;
        }
      }
      async function refreshAll(showSuccess) {
        hideBox(authStatus);
        try {
          if (!authToken) { profile = null; updateUi(); return; }
          await loadMe();
          updateUi();
          await loadHistory();
          if (showSuccess) showBox(authStatus, 'เข้าสู่ระบบสำเร็จ', 'success');
          if (profile && !getProfileComplete(profile)) showBox(authStatus, 'กรุณากรอกข้อมูลยืนยันตัวตนให้ครบ', 'error');
        } catch (error) {
          clearAuth();
          updateUi();
          showBox(authStatus, error && error.message ? error.message : 'กรุณาเข้าสู่ระบบใหม่', 'error');
        }
      }
      async function readFileAsDataUrl(file) {
        return await new Promise(function (resolve, reject) {
          const reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result || '')); };
          reader.onerror = function () { reject(new Error('ไม่สามารถอ่านไฟล์รูปได้')); };
          reader.readAsDataURL(file);
        });
      }

      loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        hideBox(authStatus);
        const identifier = String(document.getElementById('login-identifier').value || '').trim();
        const password = String(document.getElementById('login-password').value || '');
        if (!identifier || !password) return showBox(authStatus, 'กรอกข้อมูลเข้าสู่ระบบให้ครบ', 'error');
        setBusy(loginSubmit, true, 'กำลังเข้าสู่ระบบ...', 'เข้าสู่ระบบ');
        try {
          const response = await fetch('/line/scam/liff/api/reporter/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: identifier, password: password }),
          });
          const payload = await parseJson(response);
          saveAuth(String(payload.token || ''), Number(payload.expiresAt || (Date.now() + fallbackTtl)));
          await refreshAll(true);
        } catch (error) {
          showBox(authStatus, error && error.message ? error.message : 'เข้าสู่ระบบไม่สำเร็จ', 'error');
        } finally {
          setBusy(loginSubmit, false, 'กำลังเข้าสู่ระบบ...', 'เข้าสู่ระบบ');
        }
      });

      registerForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        hideBox(authStatus);
        const body = {
          firstName: String(document.getElementById('reg-first-name').value || '').trim(),
          lastName: String(document.getElementById('reg-last-name').value || '').trim(),
          address: String(document.getElementById('reg-address').value || '').trim(),
          citizenId: String(document.getElementById('reg-citizen-id').value || '').trim(),
          phone: String(document.getElementById('reg-phone').value || '').trim(),
          username: String(document.getElementById('reg-username').value || '').trim(),
          email: String(document.getElementById('reg-email').value || '').trim(),
          password: String(document.getElementById('reg-password').value || ''),
        };
        setBusy(registerSubmit, true, 'กำลังลงทะเบียน...', 'ลงทะเบียน');
        try {
          const response = await fetch('/line/scam/liff/api/reporter/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const payload = await parseJson(response);
          saveAuth(String(payload.token || ''), Number(payload.expiresAt || (Date.now() + fallbackTtl)));
          await refreshAll(true);
        } catch (error) {
          showBox(authStatus, error && error.message ? error.message : 'ลงทะเบียนไม่สำเร็จ', 'error');
        } finally {
          setBusy(registerSubmit, false, 'กำลังลงทะเบียน...', 'ลงทะเบียน');
        }
      });

      verifyForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        hideBox(verifyStatus);
        setBusy(verifySubmit, true, 'กำลังบันทึก...', 'บันทึกข้อมูล');
        try {
          const response = await fetch('/line/scam/liff/api/reporter/profile', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({
              firstName: String(document.getElementById('verify-first-name').value || '').trim(),
              lastName: String(document.getElementById('verify-last-name').value || '').trim(),
              address: String(document.getElementById('verify-address').value || '').trim(),
              citizenId: String(document.getElementById('verify-citizen-id').value || '').trim(),
              phone: String(document.getElementById('verify-phone').value || '').trim(),
              username: String(document.getElementById('verify-username').value || '').trim(),
            }),
          });
          const payload = await parseJson(response);
          profile = payload.profile || profile;
          updateUi();
          showBox(verifyStatus, payload.message || 'บันทึกข้อมูลสำเร็จ', 'success');
          hideBox(authStatus);
        } catch (error) {
          showBox(verifyStatus, error && error.message ? error.message : 'บันทึกข้อมูลไม่สำเร็จ', 'error');
        } finally {
          setBusy(verifySubmit, false, 'กำลังบันทึก...', 'บันทึกข้อมูล');
        }
      });

      reportForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        hideBox(reportStatus);
        setBusy(reportSubmit, true, 'กำลังส่งรายงาน...', 'ส่งรายงาน');
        try {
          const amount = Number(String(document.getElementById('report-amount').value || '0').replace(/,/g, ''));
          const response = await fetch('/line/scam/liff/api/reporter/reports', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              sellerAlias: String(document.getElementById('report-seller-alias').value || '').trim(),
              firstName: String(document.getElementById('report-first-name').value || '').trim(),
              lastName: String(document.getElementById('report-last-name').value || '').trim(),
              citizenId: String(document.getElementById('report-citizen-id').value || '').trim(),
              phone: String(document.getElementById('report-phone').value || '').trim(),
              bankAccount: String(document.getElementById('report-bank-account').value || '').trim(),
              bankName: String(document.getElementById('report-bank-name').value || '').trim(),
              product: String(document.getElementById('report-product').value || '').trim(),
              amount: Number.isFinite(amount) ? amount : 0,
              transferDate: String(document.getElementById('report-transfer-date').value || '').trim(),
              pageUrl: String(document.getElementById('report-page-url').value || '').trim(),
              province: String(document.getElementById('report-province').value || '').trim(),
              evidenceImage: evidenceImage,
            }),
          });
          const payload = await parseJson(response);
          reportForm.reset();
          evidenceImage = null;
          reportEvidencePreview.textContent = 'ยังไม่ได้เลือกรูป';
          showBox(reportStatus, payload.message || 'ส่งรายงานสำเร็จ', 'success');
          await loadHistory();
        } catch (error) {
          showBox(reportStatus, error && error.message ? error.message : 'ส่งรายงานไม่สำเร็จ', 'error');
        } finally {
          setBusy(reportSubmit, false, 'กำลังส่งรายงาน...', 'ส่งรายงาน');
        }
      });

      reportEvidenceInput.addEventListener('change', async function (event) {
        hideBox(reportStatus);
        const file = event.target && event.target.files ? event.target.files[0] : null;
        if (!file) return;
        try {
          if (!String(file.type || '').toLowerCase().startsWith('image/')) throw new Error('รองรับเฉพาะไฟล์รูปภาพ');
          if (maxImageBytes > 0 && Number(file.size || 0) > maxImageBytes) throw new Error('ขนาดรูปเกินกำหนด');
          const dataUrl = await readFileAsDataUrl(file);
          evidenceImage = {
            id: 'evidence-' + Date.now(),
            name: String(file.name || 'evidence-image').slice(0, 180),
            mimeType: String(file.type || 'image/*').toLowerCase(),
            size: Number(file.size || 0),
            dataUrl: dataUrl,
          };
          reportEvidencePreview.innerHTML = '<img alt="evidence" src="' + escapeHtml(dataUrl) + '" />';
        } catch (error) {
          evidenceImage = null;
          reportEvidencePreview.textContent = 'ยังไม่ได้เลือกรูป';
          showBox(reportStatus, error && error.message ? error.message : 'อัปโหลดรูปไม่สำเร็จ', 'error');
        } finally {
          if (event.target) event.target.value = '';
        }
      });

      historyRefreshBtn.addEventListener('click', function () { loadHistory(); });
      refreshProfileBtn.addEventListener('click', function () { refreshAll(false); });
      logoutBtn.addEventListener('click', async function () {
        clearAuth();
        updateUi();
        hideBox(verifyStatus);
        hideBox(reportStatus);
        await fetch('/line/scam/liff/api/reporter/logout', { method: 'POST' }).catch(function () {});
      });
      tabLogin.addEventListener('click', function () { switchTab('login'); });
      tabRegister.addEventListener('click', function () { switchTab('register'); });

      function initGoogleSignIn() {
        if (!googleClientId) {
          googleHint.classList.remove('hidden');
          googleHint.textContent = 'Google Sign-In ยังไม่ถูกตั้งค่าที่เซิร์ฟเวอร์';
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = function () {
          if (!window.google || !window.google.accounts || !window.google.accounts.id) {
            googleHint.classList.remove('hidden');
            googleHint.textContent = 'โหลด Google Sign-In ไม่สำเร็จ';
            return;
          }
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async function (response) {
              try {
                const credential = String(response && response.credential || '').trim();
                if (!credential) throw new Error('ไม่พบ credential จาก Google');
                const authResponse = await fetch('/line/scam/liff/api/reporter/google', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken: credential }),
                });
                const payload = await parseJson(authResponse);
                saveAuth(String(payload.token || ''), Number(payload.expiresAt || (Date.now() + fallbackTtl)));
                await refreshAll(true);
              } catch (error) {
                showBox(authStatus, error && error.message ? error.message : 'Google sign-in ไม่สำเร็จ', 'error');
              }
            },
          });
          window.google.accounts.id.renderButton(googleSigninBox, {
            type: 'standard',
            theme: 'outline',
            text: 'signin_with',
            shape: 'pill',
            size: 'large',
            width: 260,
          });
          googlePromptBtn.classList.remove('hidden');
          googlePromptBtn.addEventListener('click', function () {
            window.google.accounts.id.prompt();
          });
        };
        script.onerror = function () {
          googleHint.classList.remove('hidden');
          googleHint.textContent = 'ไม่สามารถโหลด Google script ได้';
        };
        document.head.appendChild(script);
      }

      switchTab('login');
      initGoogleSignIn();
      authToken = String(localStorage.getItem(AUTH_TOKEN_KEY) || '').trim();
      expiresAt = Number(localStorage.getItem(AUTH_EXPIRES_KEY) || 0);
      if (!authToken || (expiresAt > 0 && expiresAt <= Date.now())) clearAuth();
      refreshAll(false);
    `,
  });
