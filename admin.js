/* Admin: edits content.json and commits it to GitHub through the Contents API. */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
function setPath(o, path, v) {
  const ks = path.split('.'), last = ks.pop();
  ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v;
}
const slugify = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const LOGO = `<svg class="logo" viewBox="240 265 1430 1440" aria-hidden="true"><path d="M249 274H611V897L536 971V573H461V1028L539 1106L1371 274H1658L602 1330L804 1681H598L461 1358V1681H249Z"/><path fill-rule="evenodd" d="M662 1346L1530 479V1693H1296V1567H859L813 1612ZM1058 1369L1298 1130L1297 1369Z"/><path d="M1585 433L1658 362V1694H1585Z"/></svg>`;
$$('[data-logo]').forEach(el => el.innerHTML = LOGO);

/* ---------- settings (token stays in this browser only) ---------- */
const KEY = 'vk-admin';
const loadSettings = () => { try { return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } };
function saveSettings(s) {
  try {
    (s.remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s));
    (s.remember ? sessionStorage : localStorage).removeItem(KEY);
  } catch {}
}
let S = { owner: 'BanhKhuc04', repo: '', branch: 'main', token: '', remember: true, ...loadSettings() };
let data = null, sha = null, mode = null, dirty = false, tab = 'profile', sel = 0;

/* ---------- GitHub API ---------- */
const api = (path, opts = {}) => fetch(`https://api.github.com/repos/${encodeURIComponent(S.owner)}/${encodeURIComponent(S.repo)}/contents/${path}`, {
  ...opts,
  headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${S.token}`, 'X-GitHub-Api-Version': '2022-11-28' }
});
function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const fromB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
async function apiError(r) {
  const msg = (await r.json().catch(() => ({}))).message || r.statusText;
  if (r.status === 401) return 'Token sai hoặc đã hết hạn.';
  if (r.status === 403) return 'Token không có quyền ghi (Contents: Read and write) vào repo này.';
  if (r.status === 404) return 'Không tìm thấy repo/nhánh/file. Kiểm tra tên repo, nhánh, và đã push content.json chưa.';
  if (r.status === 409) return 'File trên GitHub đã thay đổi từ lúc bạn mở. Tải lại trang rồi sửa lại.';
  return `GitHub báo lỗi ${r.status}: ${msg}`;
}

async function connectGitHub() {
  const r = await api(`content.json?ref=${encodeURIComponent(S.branch)}`);
  if (!r.ok) throw new Error(await apiError(r));
  const j = await r.json();
  sha = j.sha;
  data = JSON.parse(fromB64(j.content));
  mode = 'github';
}
async function loadLocal() {
  const r = await fetch('content.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('Không đọc được content.json trên máy.');
  data = await r.json();
  mode = 'local';
}

function validate() {
  const errs = [], slugs = new Set();
  (data.projects || []).forEach((p, i) => {
    if (!p.title?.trim()) errs.push(`Dự án #${i + 1} chưa có tên.`);
    if (!/^[a-z0-9-]+$/.test(p.slug || '')) errs.push(`Dự án "${p.title || i + 1}": slug chỉ dùng a-z, 0-9, dấu gạch.`);
    if (slugs.has(p.slug)) errs.push(`Slug "${p.slug}" bị trùng.`);
    slugs.add(p.slug);
  });
  if (data.contact?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.contact.email)) errs.push('Email liên hệ không hợp lệ.');
  return errs;
}

async function save() {
  const errs = validate();
  if (errs.length) return toast(errs.join(' '), true);
  const btn = $('#btnSave');
  btn.disabled = true; btn.textContent = 'Đang lưu…';
  try {
    const body = {
      message: `content: cập nhật nội dung từ admin (${new Date().toLocaleString('vi-VN')})`,
      content: toB64(new TextEncoder().encode(JSON.stringify(data, null, 2) + '\n')),
      sha, branch: S.branch
    };
    const r = await api('content.json', { method: 'PUT', body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await apiError(r));
    sha = (await r.json()).content.sha;
    setDirty(false);
    toast('Đã lưu lên GitHub. Web sẽ cập nhật sau khi deploy xong (khoảng 1 phút).');
  } catch (e) { toast(e.message, true); }
  btn.disabled = false; btn.textContent = 'Lưu lên GitHub';
}

async function upload(file) {
  if (mode !== 'github') throw new Error('Cần kết nối GitHub để tải ảnh lên. Ở chế độ trên máy, hãy chép ảnh vào thư mục assets/ rồi gõ đường dẫn.');
  if (!file.type.startsWith('image/')) throw new Error('Chỉ nhận file ảnh.');
  if (file.size > 3 * 1024 * 1024) throw new Error('Ảnh lớn hơn 3MB, hãy nén lại trước.');
  const path = `assets/uploads/${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`;
  const r = await api(path, { method: 'PUT', body: JSON.stringify({ message: `upload: ${path}`, content: toB64(new Uint8Array(await file.arrayBuffer())), branch: S.branch }) });
  if (!r.ok) throw new Error(await apiError(r));
  return path;
}

/* ---------- UI helpers ---------- */
let toastT;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.classList.toggle('err', err); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), err ? 7000 : 4000);
}
function setDirty(v) {
  dirty = v;
  const m = $('#mode');
  m.textContent = (mode === 'github' ? `${S.owner}/${S.repo}@${S.branch}` : 'trên máy · chỉ tải JSON') + (v ? ' · chưa lưu' : '');
  m.classList.toggle('is-dirty', v);
}
addEventListener('beforeunload', e => { if (dirty) e.preventDefault(); });

const fmt = (v, type) => type === 'lines' ? (v || []).join('\n') : type === 'csv' ? (v || []).join(', ') : (v ?? '');
const parse = (el, type) => type === 'lines' ? el.value.split('\n').map(s => s.trim()).filter(Boolean)
  : type === 'csv' ? el.value.split(',').map(s => s.trim()).filter(Boolean)
  : type === 'number' ? +el.value : type === 'bool' ? el.checked : el.value;

const F = {
  text: (path, label, hint = '') => `<label class="f"><span>${label} ${hint ? `<small>${hint}</small>` : ''}</span><input data-path="${path}" value="${esc(get(data, path))}"></label>`,
  num: (path, label) => `<label class="f"><span>${label}</span><input type="number" data-path="${path}" data-type="number" value="${esc(get(data, path))}"></label>`,
  area: (path, label, rows = 4, type = '', hint = '') => `<label class="f"><span>${label} ${hint ? `<small>${hint}</small>` : ''}</span><textarea data-path="${path}" data-type="${type}" rows="${rows}">${esc(fmt(get(data, path), type))}</textarea></label>`,
  check: (path, label) => `<label class="f chk"><input type="checkbox" data-path="${path}" data-type="bool" ${get(data, path) ? 'checked' : ''}><span>${label}</span></label>`,
  select: (path, label, opts) => `<label class="f"><span>${label}</span><select data-path="${path}" data-type="${typeof opts[0][0] === 'number' ? 'number' : ''}">${opts.map(([v, t]) => `<option value="${v}" ${get(data, path) == v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
  color: (path, label) => `<label class="f"><span>${label}</span><input type="color" data-path="${path}" value="${/^#[0-9a-f]{6}$/i.test(get(data, path)) ? get(data, path) : '#2e3192'}"></label>`,
  image: (path, label) => `<div class="f"><span>${label}</span><div class="img-field"><img src="${esc(get(data, path))}" alt="" data-preview="${path}" onerror="this.style.visibility='hidden'" onload="this.style.visibility=''">
    <div><input data-path="${path}" value="${esc(get(data, path))}" placeholder="assets/... hoặc https://..."><label class="up">Tải ảnh lên<input type="file" accept="image/*" data-upload="${path}" hidden></label></div></div></div>`
};
const tools = (list, i, n) => `<div class="item__tools">
  <button class="ic" data-act="up" data-list="${list}" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Lên">↑</button>
  <button class="ic" data-act="down" data-list="${list}" data-i="${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Xuống">↓</button>
  <button class="ic ic--del" data-act="del" data-list="${list}" data-i="${i}" aria-label="Xoá">✕</button></div>`;
const listBlock = (list, itemFn, addLabel) => {
  const arr = get(data, list) || [];
  return arr.map((_, i) => `<div class="item">${tools(list, i, arr.length)}${itemFn(`${list}.${i}`)}</div>`).join('') +
    `<button class="add" data-act="add" data-list="${list}">+ ${addLabel}</button>`;
};
const NEW = {
  'about.stats': () => ({ value: 0, suffix: '', label: '' }),
  skills: () => ({ icon: 'web', title: '', text: '', tags: [] }),
  'contact.socials': () => ({ label: '', url: '' }),
  projects: () => ({ slug: '', title: 'Dự án mới', year: String(new Date().getFullYear()), category: 'Web app', status: 'Hoàn thành', summary: '', description: '', features: [], stack: [], live: '', repo: '', image: '', logo: '', icon: 'code', colors: ['#2E3192', '#5A5FE0'], featured: true, hub: false })
};
const ICON_OPTS = [['code', 'Code'], ['tree', 'Cây gia phả'], ['wave', 'Sóng âm'], ['home', 'Nhà thông minh'], ['shield', 'Khiên'], ['power', 'Nút nguồn'],
  ['tomato', 'Cà chua / hẹn giờ'], ['leaf', 'Lá'], ['scissors', 'Kéo cắt'], ['bowl', 'Bát ăn'], ['chip', 'Chip'], ['eye', 'Mắt / AI']];

/* ---------- views ---------- */
const TABS = [['profile', 'Hồ sơ & Hero'], ['about', 'Giới thiệu'], ['skills', 'Kỹ năng'], ['projects', 'Dự án'], ['contact', 'Liên hệ'], ['json', 'JSON']];

function viewTab() {
  switch (tab) {
    case 'profile': return `<h2 class="sec-h">Hồ sơ</h2>
      <div class="row">${F.text('profile.name', 'Họ tên')}${F.text('profile.handle', 'Tên ngắn')}</div>
      <div class="row">${F.text('profile.role', 'Vai trò')}${F.text('profile.github', 'GitHub')}</div>
      ${F.text('profile.status', 'Trạng thái', 'hiện ở góc trên trang chủ')}
      ${F.image('profile.avatar', 'Ảnh chân dung')}
      <h2 class="sec-h">Hero</h2>
      ${F.area('hero.lines', 'Tiêu đề lớn', 3, 'lines', 'mỗi dòng một hàng, bọc *chữ* để tô vàng')}
      ${F.area('hero.lead', 'Đoạn mô tả', 3)}`;
    case 'about': return `<h2 class="sec-h">Giới thiệu</h2>
      ${F.area('about.text', 'Đoạn giới thiệu', 5)}
      ${F.text('about.circle', 'Cụm từ được khoanh tròn', 'phải có y hệt trong đoạn trên')}
      ${F.area('stack', 'Công nghệ chạy ngang (marquee)', 2, 'csv', 'cách nhau bằng dấu phẩy')}
      <h2 class="sec-h">Số liệu</h2>
      ${listBlock('about.stats', p => `<div class="row">${F.num(p + '.value', 'Số')}${F.text(p + '.suffix', 'Hậu tố', '+, %…')}${F.text(p + '.label', 'Nhãn')}</div>`, 'Thêm số liệu')}`;
    case 'skills': return `<h2 class="sec-h">Kỹ năng</h2>
      ${listBlock('skills', p => `<div class="row">${F.text(p + '.title', 'Tên')}${F.select(p + '.icon', 'Biểu tượng', [['web', 'Web'], ['server', 'Server'], ['ai', 'AI / mắt'], ['iot', 'Chip IoT']])}</div>
        ${F.area(p + '.text', 'Mô tả', 2)}${F.area(p + '.tags', 'Thẻ', 1, 'csv', 'cách nhau bằng dấu phẩy')}`, 'Thêm kỹ năng')}`;
    case 'contact': return `<h2 class="sec-h">Liên hệ</h2>
      ${F.text('contact.email', 'Email')}
      <h2 class="sec-h">Mạng xã hội</h2>
      ${listBlock('contact.socials', p => `<div class="row">${F.text(p + '.label', 'Tên')}${F.text(p + '.url', 'Link')}</div>`, 'Thêm link')}`;
    case 'json': return `<h2 class="sec-h">Sửa trực tiếp JSON</h2>
      <label class="f"><textarea class="json" id="jsonBox" spellcheck="false">${esc(JSON.stringify(data, null, 2))}</textarea></label>
      <button class="btn btn--solid" data-act="json">Áp dụng JSON</button>`;
    case 'projects': return viewProjects();
  }
}

function viewProjects() {
  const ps = data.projects ||= [];
  sel = Math.min(sel, ps.length - 1);
  if (sel >= 0 && !Array.isArray(ps[sel].colors)) ps[sel].colors = ['#2E3192', '#5A5FE0']; // so colors.0/.1 stay an array
  const p = `projects.${sel}`;
  return `<div class="proj">
    <div class="plist-ad">
      ${ps.map((x, i) => `<button class="pi ${i === sel ? 'is-on' : ''}" data-sel="${i}"><span class="dot ${x.featured ? 'on' : ''}" title="Hiện ở trang chủ"></span><b>${esc(x.title || '(chưa đặt tên)')}</b>${x.hub && x.live ? '<i>hub</i>' : ''}</button>`).join('')}
      <button class="add" data-act="add" data-list="projects">+ Thêm dự án</button>
    </div>
    <div class="card-box">${sel < 0 ? '<p>Chưa có dự án.</p>' : `
      ${tools('projects', sel, ps.length)}
      <div class="row">${F.text(p + '.title', 'Tên dự án')}
        <label class="f"><span>Slug <small>dùng trong link</small></span><span style="display:flex;gap:6px"><input data-path="${p}.slug" value="${esc(ps[sel].slug)}"><button class="ic" data-act="slug" title="Tạo từ tên">↻</button></span></label></div>
      <div class="row">${F.text(p + '.year', 'Năm')}${F.text(p + '.category', 'Loại')}${F.text(p + '.status', 'Trạng thái')}</div>
      ${F.area(p + '.summary', 'Tóm tắt', 2, '', 'hiện trên thẻ và đầu trang chi tiết')}
      ${F.area(p + '.description', 'Mô tả chi tiết', 6, '', 'cách đoạn bằng một dòng trống')}
      ${F.area(p + '.features', 'Tính năng', 5, 'lines', 'mỗi dòng một tính năng')}
      ${F.area(p + '.stack', 'Công nghệ', 1, 'csv', 'cách nhau bằng dấu phẩy')}
      <div class="row">${F.text(p + '.live', 'Link web đang chạy')}${F.text(p + '.repo', 'Link GitHub', 'để trống nếu repo riêng tư')}</div>
      ${F.image(p + '.image', 'Ảnh đại diện (tỉ lệ dọc 4:5 đẹp nhất)')}
      ${F.image(p + '.logo', 'Logo dự án (vuông, hiện giữa bìa)')}
      <div class="row">${F.select(p + '.icon', 'Icon khi không có logo', ICON_OPTS)}${F.color(p + '.colors.0', 'Màu nền 1')}${F.color(p + '.colors.1', 'Màu nền 2')}</div>
      <div class="row">${F.check(p + '.featured', 'Hiện ở "Dự án chọn lọc" trang chủ')}${F.check(p + '.hub', 'Hiện ở "Web & tiện ích" (cần link web)')}</div>`}
    </div></div>`;
}

function render() {
  const app = $('#app');
  if (!data) return renderConnect();
  app.innerHTML = `<nav class="tabs">${TABS.map(([k, t]) => `<button class="${k === tab ? 'is-on' : ''}" data-tab="${k}">${t}</button>`).join('')}</nav>
    ${tab === 'projects' ? viewTab() : `<div class="card-box">${viewTab()}</div>`}`;
  ['#btnPreview', '#btnDownload'].forEach(s => $(s).disabled = false);
  $('#btnSave').disabled = mode !== 'github';
  setDirty(dirty);
}

function renderConnect() {
  $('#app').innerHTML = `<section class="connect card-box">
    <h2>Kết nối kho nội dung</h2>
    <p>Nội dung web nằm trong file <code>content.json</code> của repo GitHub. Admin dùng token của bạn để commit thẳng vào repo, sau đó Vercel / GitHub Pages tự deploy lại.</p>
    <form id="connectForm">
      <div class="row">
        <label class="f"><span>GitHub user</span><input name="owner" value="${esc(S.owner)}" required></label>
        <label class="f"><span>Repo chứa web</span><input name="repo" value="${esc(S.repo)}" placeholder="vd: vanhkhuc" required></label>
        <label class="f"><span>Nhánh</span><input name="branch" value="${esc(S.branch)}" required></label>
      </div>
      <label class="f"><span>Token GitHub <small>chỉ lưu trong trình duyệt này</small></span><input name="token" type="password" value="${esc(S.token)}" autocomplete="off" required></label>
      <label class="f chk"><input type="checkbox" name="remember" ${S.remember ? 'checked' : ''}><span>Ghi nhớ trên máy này</span></label>
      <div class="hero__cta" style="margin-top:8px">
        <button class="btn btn--solid" type="submit">Kết nối GitHub</button>
        <button class="btn btn--ghost" type="button" data-act="local">Sửa trên máy (không lưu lên GitHub)</button>
      </div>
    </form>
    <div class="help"><b>Tạo token (một lần):</b>
      <ol>
        <li>Mở <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained tokens → Generate new token</a>.</li>
        <li>Repository access: <b>Only select repositories</b> → chọn repo chứa web.</li>
        <li>Permissions → Repository → <b>Contents: Read and write</b>. Không cần quyền nào khác.</li>
        <li>Tạo, copy token rồi dán vào ô trên.</li>
      </ol>
    </div></section>`;
  ['#btnPreview', '#btnDownload', '#btnSave'].forEach(s => $(s).disabled = true);
}

/* ---------- events ---------- */
document.addEventListener('submit', async e => {
  if (e.target.id !== 'connectForm') return;
  e.preventDefault();
  const f = new FormData(e.target);
  S = { owner: f.get('owner').trim(), repo: f.get('repo').trim(), branch: f.get('branch').trim(), token: f.get('token').trim(), remember: f.has('remember') };
  const btn = e.submitter; btn.disabled = true; btn.textContent = 'Đang kết nối…';
  try {
    await connectGitHub();
    saveSettings(S);
    render();
    toast('Đã kết nối. Sửa xong bấm "Lưu lên GitHub".');
  } catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Kết nối GitHub'; }
});

document.addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset.path) return;
  setPath(data, el.dataset.path, parse(el, el.dataset.type));
  setDirty(true);
  if (el.dataset.path.endsWith('.image') || el.dataset.path === 'profile.avatar') {
    const img = $(`[data-preview="${el.dataset.path}"]`); if (img) img.src = el.value;
  }
  if (tab === 'projects' && /^projects\.\d+\.title$/.test(el.dataset.path)) {
    const b = $(`.pi[data-sel="${sel}"] b`); if (b) b.textContent = el.value || '(chưa đặt tên)';
  }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.path && (el.type === 'checkbox' || el.tagName === 'SELECT')) {
    setPath(data, el.dataset.path, parse(el, el.dataset.type)); setDirty(true);
    if (tab === 'projects') render();
  }
  if (el.dataset.upload && el.files[0]) {
    const label = el.parentElement; label.firstChild.textContent = 'Đang tải…';
    try {
      const path = await upload(el.files[0]);
      setPath(data, el.dataset.upload, path); setDirty(true);
      const input = $(`input[data-path="${el.dataset.upload}"]`); if (input) input.value = path;
      const img = $(`[data-preview="${el.dataset.upload}"]`); if (img) img.src = URL.createObjectURL(el.files[0]);
      toast('Đã tải ảnh lên repo. Nhớ bấm "Lưu lên GitHub".');
    } catch (err) { toast(err.message, true); }
    label.firstChild.textContent = 'Tải ảnh lên';
  }
});

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-tab],[data-sel],[data-act]');
  if (!t) return;
  if (t.dataset.tab) { tab = t.dataset.tab; return render(); }
  if (t.dataset.sel) { sel = +t.dataset.sel; return render(); }
  const { act, list } = t.dataset, i = +t.dataset.i;
  const arr = list && (get(data, list) || (setPath(data, list, []), get(data, list)));
  if (act === 'local') {
    try { await loadLocal(); render(); toast('Đang sửa trên máy. Sửa xong bấm "Tải JSON" và thay file content.json.'); } catch (err) { toast(err.message, true); }
    return;
  }
  if (act === 'add') { arr.push(NEW[list]()); if (list === 'projects') sel = arr.length - 1; }
  else if (act === 'del') {
    if (!confirm('Xoá mục này?')) return;
    arr.splice(i, 1);
  } else if (act === 'up' || act === 'down') {
    const j = act === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    if (list === 'projects') sel = j;
  } else if (act === 'slug') {
    const p = data.projects[sel]; p.slug = slugify(p.title);
  } else if (act === 'json') {
    try { data = JSON.parse($('#jsonBox').value); toast('Đã áp dụng JSON.'); } catch (err) { return toast('JSON lỗi: ' + err.message, true); }
  } else return;
  setDirty(true); render();
});

$('#btnSave').addEventListener('click', save);
$('#btnDownload').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }));
  a.download = 'content.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#btnPreview').addEventListener('click', () => {
  try { localStorage.setItem('vk-draft', JSON.stringify(data)); } catch { return toast('Trình duyệt chặn lưu tạm, không xem trước được.', true); }
  window.open('index.html?preview=1', '_blank');
});

/* auto-connect when a token is remembered */
(async () => {
  if (S.token && S.repo) {
    try { await connectGitHub(); } catch (err) { toast(err.message, true); }
  }
  render();
})();
