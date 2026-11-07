// Кабинет — тема, режим чтения и боковая панель (Вид / Мир / Пресет / Дни) для SillyTavern
// Всё через namespace-импорты: если в этой версии ST чего-то нет, расширение не падает целиком.
import * as ST from '../../../../script.js';
import * as EXT from '../../../extensions.js';
import * as WI from '../../../world-info.js';

const MOD = 'kabinet';
const DEFAULTS = {
    read: false,
    handle: false,
    sendButton: true,
    qrCompact: true,
    qrHidden: false,
    fontSize: 17,
    lineHeight: 1.75,
    width: 760,
    tab: 'view',
    newestFirst: true,
};

const state = { open: false, book: null, q: '' };

// ---------- helpers ----------
function ctx() {
    try { return globalThis.SillyTavern?.getContext?.() || EXT.getContext(); }
    catch { return EXT.getContext(); }
}

function settings() {
    const es = EXT.extension_settings || ctx().extensionSettings;
    if (!es[MOD]) es[MOD] = {};
    for (const [k, v] of Object.entries(DEFAULTS)) if (es[MOD][k] === undefined) es[MOD][k] = v;
    // 0.2.1: язычок перекрывал стрелки свайпов — по умолчанию прячем, кнопка теперь у поля ввода
    if (!es[MOD].v || es[MOD].v < 2) { es[MOD].handle = false; es[MOD].v = 2; }
    return es[MOD];
}

function save() {
    const fn = ST.saveSettingsDebounced || ctx().saveSettingsDebounced;
    try { fn?.(); } catch (e) { console.warn('[Кабинет] save failed', e); }
}

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function empty(text) { return `<div class="kab-empty">${esc(text)}</div>`; }

function toast(msg, type = 'info') { try { globalThis.toastr?.[type]?.(msg, 'Кабинет'); } catch { /* ignore */ } }

function stripExt(name) { return String(name || '').replace(/\.[^/.]+$/, ''); }

// ---------- themes ----------
// Цвета для свотчей: [фон панели, карточка, текст, реплики, курсив] — для тем, которые ставит установщик
const THEME_META = {
    "Кабинет · Бумага": [
        "rgba(250, 246, 238, 1)",
        "rgba(255, 253, 248, 1)",
        "rgba(58, 53, 44, 1)",
        "rgba(160, 101, 42, 1)",
        "rgba(111, 127, 92, 1)"
    ],
    "Кабинет · Ночь": [
        "rgba(41, 37, 31, 1)",
        "rgba(43, 39, 33, 1)",
        "rgba(236, 229, 213, 1)",
        "rgba(217, 178, 124, 1)",
        "rgba(169, 188, 149, 1)"
    ],
    "Clover Meadow": [
        "rgba(230, 242, 224, 0.82)",
        "rgba(247, 241, 224, 0.92)",
        "rgba(62, 46, 31, 1)",
        "rgba(58, 125, 68, 1)",
        "rgba(90, 70, 50, 1)"
    ],
    "Лимонная роща": [
        "rgba(251, 244, 226, 0.93)",
        "rgba(251, 244, 226, 0.94)",
        "rgba(59, 53, 36, 1)",
        "rgba(184, 105, 30, 1)",
        "rgba(107, 127, 58, 1)"
    ],
    "⊹ MOO · LIGHT ⊹ (edit/made by aceenvw)": [
        "rgba(243, 241, 234, 1)",
        "rgba(240, 238, 230, 1)",
        "rgba(44, 46, 40, 1)",
        "rgba(30, 104, 140, 1)",
        "rgba(46, 108, 50, 1)"
    ],
    "Neapolitan Dreams": [
        "rgba(245, 235, 220, 0.85)",
        "rgba(249, 232, 208, 0.92)",
        "rgba(74, 50, 32, 1)",
        "rgba(208, 107, 126, 1)",
        "rgba(168, 118, 84, 1)"
    ],
    "⊹ PASTEL LETTERS (LIGHT) ⊹ (aceenvw)": [
        "rgba(253, 244, 238, 1)",
        "rgba(253, 244, 238, 0.94)",
        "rgba(92, 65, 71, 1)",
        "rgba(217, 154, 63, 1)",
        "rgba(232, 104, 154, 1)"
    ],
    "-宣纸 v2 (aged)": [
        "rgba(72, 66, 54, 0.95)",
        "rgba(92, 56, 44, 1)",
        "rgba(245, 240, 225, 1)",
        "rgba(230, 180, 125, 1)",
        "rgba(178, 210, 168, 1)"
    ]
};
const THEME_LABELS = {
    '-宣纸 v2 (aged)': 'Рисовая бумага · ночь',
    '⊹ PASTEL LETTERS (LIGHT) ⊹ (aceenvw)': 'Пастельные письма',
    '⊹ MOO · LIGHT ⊹ (edit/made by aceenvw)': 'Мууу · светлая',
    'Neapolitan Dreams': 'Неаполитанские сны',
    'Clover Meadow': 'Клеверный луг',
};

function stThemes() {
    const sel = document.getElementById('themes');
    if (!sel) return { list: [], current: '' };
    return { list: [...sel.options].map(o => o.value).filter(Boolean), current: sel.value };
}

function setStTheme(name) {
    const sel = document.getElementById('themes');
    if (!sel) return false;
    $(sel).val(name).trigger('change');
    return true;
}

// Тема ST может дать полупрозрачный фон — панели нужен плотный, иначе сквозь неё читается чат
function opaque(color, fallback) {
    const m = String(color || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return color && color.trim() ? color.trim() : fallback;
    const [r, g, b] = m[1].split(',').map(x => parseFloat(x));
    return `rgb(${r}, ${g}, ${b})`;
}

function syncThemeColors() {
    const cs = getComputedStyle(document.documentElement);
    const bodyCs = getComputedStyle(document.body);
    const pick = name => bodyCs.getPropertyValue(name) || cs.getPropertyValue(name);
    const st = document.body.style;
    st.setProperty('--kab-bg-solid', opaque(pick('--SmartThemeBlurTintColor'), '#f3f5ec'));
    st.setProperty('--kab-card-solid', opaque(pick('--SmartThemeBotMesBlurTintColor'), '#fafbf6'));
}

// ---------- look ----------
function applyLook() {
    const s = settings();
    const b = document.body;
    b.classList.remove('kabinet-theme', 'kabinet-night'); // остатки 0.1.x: своя тема теперь живёт в темах ST
    b.classList.toggle('kabinet-read', !!s.read);
    b.classList.toggle('kab-qr-compact', !!s.qrCompact);
    b.classList.toggle('kab-qr-hidden', !!s.qrHidden);
    b.style.setProperty('--kab-fs', `${s.fontSize}px`);
    b.style.setProperty('--kab-lh', String(s.lineHeight));
    b.style.setProperty('--kab-w', `${s.width}px`);
    const h = document.getElementById('kab-handle');
    if (h) h.style.display = s.handle ? '' : 'none';
    const sb = document.getElementById('kab-send-btn');
    if (sb) sb.style.display = s.sendButton ? '' : 'none';
    const qb = document.getElementById('kab-qr-btn');
    if (qb) {
        qb.classList.toggle('fa-chevron-up', !!s.qrHidden);
        qb.classList.toggle('fa-chevron-down', !s.qrHidden);
        qb.title = s.qrHidden ? 'Показать кнопки над вводом' : 'Свернуть кнопки над вводом';
    }
    syncThemeColors();
}

// ---------- UI shell ----------
const TABS = [
    ['view', 'Вид'],
    ['world', 'Мир'],
    ['preset', 'Пресет'],
    ['days', 'Дни'],
];

function buildUI() {
    if (document.getElementById('kab-panel')) return;

    const handle = document.createElement('div');
    handle.id = 'kab-handle';
    handle.title = 'Кабинет';
    handle.innerHTML = '<i class="fa-solid fa-book-open"></i>';
    handle.addEventListener('click', () => togglePanel());

    const backdrop = document.createElement('div');
    backdrop.id = 'kab-backdrop';
    backdrop.addEventListener('click', () => togglePanel(false));

    const panel = document.createElement('div');
    panel.id = 'kab-panel';
    panel.innerHTML = `
        <div class="kab-head">
            <div class="kab-title">Кабинет<small>HER UNIVERSE</small></div>
            <button class="kab-x" type="button" title="Закрыть">✕</button>
        </div>
        <div class="kab-tabs">${TABS.map(([id, label]) => `<button type="button" data-tab="${id}">${label}</button>`).join('')}</div>
        <div class="kab-body" id="kab-body"></div>`;
    panel.querySelector('.kab-x').addEventListener('click', () => togglePanel(false));
    panel.querySelectorAll('.kab-tabs button').forEach(btn => btn.addEventListener('click', () => {
        settings().tab = btn.dataset.tab;
        save();
        renderTab();
    }));

    document.body.append(handle, backdrop, panel);
    addMenuItem();
    addSendButtons();
}

// Кнопки слева от поля ввода: открыть Кабинет и свернуть/развернуть кнопки Quick Reply и скриптов
function addSendButtons() {
    const left = document.getElementById('leftSendForm');
    if (!left || document.getElementById('kab-send-btn')) return;
    const book = document.createElement('div');
    book.id = 'kab-send-btn';
    book.className = 'fa-solid fa-book-open interactable';
    book.title = 'Кабинет';
    book.tabIndex = 0;
    book.addEventListener('click', () => togglePanel());
    const qr = document.createElement('div');
    qr.id = 'kab-qr-btn';
    qr.className = 'fa-solid fa-chevron-down interactable';
    qr.tabIndex = 0;
    qr.addEventListener('click', () => {
        const s = settings();
        s.qrHidden = !s.qrHidden;
        applyLook(); save();
    });
    left.append(book, qr);
    installSwipeGuard();
}

// Tavern Helper вешает на свои кнопки pointerdown.prevent — из-за этого iOS Safari засчитывает
// свайп по строке кнопок как тап. Ловим клик в фазе захвата: если палец перед этим сдвинулся — глушим.
function installSwipeGuard() {
    const form = document.getElementById('send_form');
    if (!form || form.dataset.kabGuard) return;
    form.dataset.kabGuard = '1';
    let sx = 0, sy = 0, moved = false, blockUntil = 0;
    const opt = { capture: true, passive: true };
    form.addEventListener('touchstart', e => {
        const t = e.touches[0]; if (!t) return;
        sx = t.clientX; sy = t.clientY; moved = false;
    }, opt);
    form.addEventListener('touchmove', e => {
        const t = e.touches[0]; if (!t) return;
        if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) moved = true;
    }, opt);
    form.addEventListener('touchend', () => { if (moved) blockUntil = Date.now() + 450; }, opt);
    form.addEventListener('click', e => {
        if (Date.now() < blockUntil && e.target instanceof Element && e.target.closest('#qr--bar')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            (window.__kabBlocked ||= []).push(Date.now());
        }
    }, true);
}

// Меню волшебной палочки ST рисует асинхронно — ждём его появления, а не надеемся, что оно уже есть
function addMenuItem(tries = 0) {
    if (document.getElementById('kab-menu-item')) return;
    const menu = document.getElementById('extensionsMenu');
    if (!menu) {
        if (tries < 40) setTimeout(() => addMenuItem(tries + 1), 500);
        return;
    }
    const item = document.createElement('div');
    item.id = 'kab-menu-item';
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.tabIndex = 0;
    item.innerHTML = '<i class="fa-solid fa-book-open extensionsMenuExtensionButton"></i><span>Кабинет</span>';
    item.addEventListener('click', () => togglePanel(true));
    menu.append(item);
}

function togglePanel(force) {
    state.open = force === undefined ? !state.open : !!force;
    document.body.classList.toggle('kab-open', state.open);
    if (state.open) renderTab();
}

async function renderTab() {
    const s = settings();
    const body = document.getElementById('kab-body');
    if (!body) return;
    document.querySelectorAll('#kab-panel .kab-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === s.tab));
    body.innerHTML = empty('Секунду…');
    try {
        if (s.tab === 'world') await renderWorld(body);
        else if (s.tab === 'preset') renderPreset(body);
        else if (s.tab === 'days') await renderDays(body);
        else renderView(body);
    } catch (e) {
        console.error('[Кабинет]', e);
        body.innerHTML = empty(`Ошибка: ${e?.message || e}`);
    }
}

// ---------- tab: Вид ----------
function sw(key, title, hint, checked) {
    return `<label class="kab-opt">
        <span class="kab-opt-text"><b>${esc(title)}</b><small>${esc(hint)}</small></span>
        <span class="kab-sw"><input type="checkbox" data-k="${key}" ${checked ? 'checked' : ''}><i></i></span>
    </label>`;
}

function range(key, title, min, max, step, unit, val) {
    return `<label class="kab-range">
        <span class="kab-range-head"><b>${esc(title)}</b><output data-out="${key}">${val}${unit}</output></span>
        <input type="range" data-k="${key}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${val}">
    </label>`;
}

function swatches(name) {
    const c = THEME_META[name];
    if (!c) return '<span class="kab-swatch kab-swatch-none"></span>';
    return `<span class="kab-swatches" style="background:${c[0]}">${c.slice(1).map(x => `<i style="background:${x}"></i>`).join('')}</span>`;
}

function themeCard(name, current) {
    const label = THEME_LABELS[name] || name;
    return `<button type="button" class="kab-theme ${name === current ? 'active' : ''}" data-theme="${esc(name)}">
        ${swatches(name)}<span class="kab-theme-name">${esc(label)}</span>${name === current ? '<em class="kab-badge">сейчас</em>' : ''}
    </button>`;
}

function renderView(el) {
    const s = settings();
    const { list, current } = stThemes();
    const mine = list.filter(n => n.startsWith('Кабинет'));
    const hers = list.filter(n => !mine.includes(n) && THEME_META[n]);
    const rest = list.filter(n => !mine.includes(n) && !hers.includes(n));
    const group = (title, names) => names.length ? `<div class="kab-group-title">${esc(title)}</div><div class="kab-themes">${names.map(n => themeCard(n, current)).join('')}</div>` : '';
    el.innerHTML = `
        <div class="kab-section kab-section-flat">
            ${list.length ? group('Кабинет', mine) + group('Твои', hers) + `<details class="kab-more"${rest.includes(current) ? ' open' : ''}><summary>Стандартные ST · ${rest.length}</summary><div class="kab-themes">${rest.map(n => themeCard(n, current)).join('')}</div></details>`
                          : empty('Не вижу список тем ST')}
        </div>
        <div class="kab-section">
            ${sw('read', 'Режим чтения', 'прячет аватары, кнопки, счётчики — остаётся текст', s.read)}
            ${sw('qrCompact', 'Кнопки над вводом в одну строку', 'Quick Reply и кнопки скриптов листаются вбок, а не стопкой', s.qrCompact)}
            ${sw('sendButton', 'Кнопка Кабинета у поля ввода', 'книжка рядом с ☰ и палочкой', s.sendButton)}
            ${sw('handle', 'Язычок справа', 'может перекрывать стрелки свайпов', s.handle)}
        </div>
        <div class="kab-section">
            <div class="kab-note kab-note-in">В режиме чтения:</div>
            ${range('fontSize', 'Размер текста', 14, 24, 1, 'px', s.fontSize)}
            ${range('lineHeight', 'Межстрочный', 1.3, 2.2, 0.05, '', s.lineHeight)}
            ${range('width', 'Ширина колонки (ПК)', 520, 1100, 20, 'px', s.width)}
        </div>`;

    el.querySelectorAll('.kab-theme').forEach(btn => btn.addEventListener('click', () => {
        if (!setStTheme(btn.dataset.theme)) return;
        setTimeout(() => { applyLook(); renderView(el); }, 350);
    }));
    el.querySelectorAll('input[type=checkbox][data-k]').forEach(inp => inp.addEventListener('change', () => {
        settings()[inp.dataset.k] = inp.checked;
        applyLook(); save();
    }));
    el.querySelectorAll('input[type=range][data-k]').forEach(inp => inp.addEventListener('input', () => {
        const k = inp.dataset.k;
        settings()[k] = Number(inp.value);
        const out = el.querySelector(`[data-out="${k}"]`);
        if (out) out.textContent = inp.value + inp.dataset.unit;
        applyLook(); save();
    }));
}

// ---------- lorebooks ----------
async function activeBooks() {
    const c = ctx();
    const set = new Set();
    (WI.selected_world_info || []).forEach(n => n && set.add(n));
    const chatLore = c.chatMetadata?.world_info;
    if (chatLore) set.add(chatLore);

    const chars = c.characters || [];
    let members = [];
    if (c.groupId) {
        const g = (c.groups || []).find(x => String(x.id) === String(c.groupId));
        members = (g?.members || []).map(a => chars.find(ch => ch.avatar === a)).filter(Boolean);
    } else if (c.characterId !== undefined && chars[c.characterId]) {
        members = [chars[c.characterId]];
    }
    const charLore = WI.world_info?.charLore || [];
    for (const ch of members) {
        const w = ch.data?.extensions?.world;
        if (w) set.add(w);
        const extra = charLore.find(e => e.name === ch.avatar || e.name === stripExt(ch.avatar))?.extraBooks || [];
        extra.forEach(n => n && set.add(n));
    }
    const names = WI.world_names || [];
    return [...set].filter(n => names.includes(n));
}

function isMemoryEntry(e) {
    return !!e?.stmemorybooks || /^\s*\d{1,4}\s*[-–—.:]\s*\S/.test(e?.comment || '');
}

// ---------- tab: Мир ----------
async function renderWorld(el) {
    if (typeof WI.loadWorldInfo !== 'function') { el.innerHTML = empty('Эта версия ST не отдаёт лорбуки расширениям'); return; }
    const all = [...(WI.world_names || [])];
    if (!all.length) { el.innerHTML = empty('Лорбуков не нашла'); return; }
    const active = await activeBooks();
    const rest = all.filter(n => !active.includes(n)).sort((a, b) => a.localeCompare(b));
    if (!state.book || !all.includes(state.book)) state.book = active[0] || all[0];

    el.innerHTML = `
        <select id="kab-book" class="kab-select">
            ${active.length ? `<optgroup label="Подключены к чату">${active.map(n => `<option value="${esc(n)}">● ${esc(n)}</option>`).join('')}</optgroup>` : ''}
            <optgroup label="Остальные">${rest.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>
        </select>
        <input id="kab-q" class="kab-input" type="search" placeholder="Поиск по названию и ключам" value="${esc(state.q)}">
        <div class="kab-note" id="kab-wi-note"></div>
        <div class="kab-list" id="kab-wi-list"></div>`;

    const sel = el.querySelector('#kab-book');
    sel.value = state.book;
    const list = el.querySelector('#kab-wi-list');
    const note = el.querySelector('#kab-wi-note');
    let data = null;

    const draw = () => {
        const entries = Object.values(data?.entries || {})
            .sort((a, b) => (a.displayIndex ?? a.uid) - (b.displayIndex ?? b.uid));
        const q = state.q.trim().toLowerCase();
        const shown = q ? entries.filter(e => `${e.comment} ${(e.key || []).join(' ')}`.toLowerCase().includes(q)) : entries;
        const on = entries.filter(e => !e.disable).length;
        note.textContent = `${entries.length} записей · включено ${on}`;
        if (!shown.length) { list.innerHTML = empty(q ? 'Ничего не нашлось' : 'Пустой лорбук'); return; }
        list.innerHTML = shown.map(e => {
            const badges = [
                e.constant ? '<em class="kab-badge">постоянная</em>' : '',
                e.vectorized ? '<em class="kab-badge">вектор</em>' : '',
                isMemoryEntry(e) ? '<em class="kab-badge mem">память</em>' : '',
            ].join('');
            return `<div class="kab-card ${e.disable ? 'off' : ''}" data-uid="${e.uid}">
                <div class="kab-card-main">
                    <div class="kab-card-title">${esc(e.comment || '(без названия)')}${badges}</div>
                    <div class="kab-card-sub">${esc((e.key || []).join(', ') || 'без ключей')}</div>
                    <div class="kab-card-content">${esc(e.content || '')}</div>
                </div>
                <span class="kab-sw"><input type="checkbox" data-uid="${e.uid}" ${e.disable ? '' : 'checked'}><i></i></span>
            </div>`;
        }).join('');

        list.querySelectorAll('.kab-card-main').forEach(m => m.addEventListener('click', () => m.parentElement.classList.toggle('open')));
        list.querySelectorAll('input[data-uid]').forEach(inp => inp.addEventListener('change', async () => {
            const entry = data.entries[inp.dataset.uid];
            if (!entry) return;
            entry.disable = !inp.checked;
            inp.closest('.kab-card').classList.toggle('off', entry.disable);
            try {
                await WI.saveWorldInfo(state.book, data, true);
                try { WI.reloadEditor?.(state.book); } catch { /* editor not open */ }
                note.textContent = `${Object.keys(data.entries).length} записей · включено ${Object.values(data.entries).filter(x => !x.disable).length}`;
            } catch (e) {
                entry.disable = !entry.disable;
                inp.checked = !entry.disable;
                toast(`Не сохранилось: ${e?.message || e}`, 'error');
            }
        }));
    };

    const load = async () => {
        list.innerHTML = empty('Загружаю…');
        data = await WI.loadWorldInfo(state.book);
        draw();
    };

    sel.addEventListener('change', () => { state.book = sel.value; load(); });
    el.querySelector('#kab-q').addEventListener('input', e => { state.q = e.target.value; draw(); });
    await load();
}

// ---------- tab: Пресет (зеркало промпт-менеджера ST) ----------
function cloneSelect(orig, id) {
    if (!orig) return '';
    const opts = [...orig.options].map(o => `<option value="${esc(o.value)}" ${o.selected ? 'selected' : ''}>${esc(o.textContent)}</option>`).join('');
    return `<select id="${id}" class="kab-select">${opts}</select>`;
}

function pmItems() {
    return [...document.querySelectorAll('#completion_prompt_manager_list li.completion_prompt_manager_prompt')]
        .map(li => {
            const toggle = li.querySelector('.prompt-manager-toggle-action');
            // имя берём из data-pm-name: в textContent ST подмешивает иконки и «@ 4» глубины инъекции
            const nameEl = li.querySelector('[data-pm-name]');
            const tokens = li.querySelector('[data-pm-tokens]')?.dataset.pmTokens || '';
            return {
                id: li.dataset.pmIdentifier,
                name: (nameEl?.dataset.pmName || nameEl?.textContent || li.dataset.pmIdentifier || '').trim(),
                on: toggle ? toggle.classList.contains('fa-toggle-on') : !li.classList.contains('completion_prompt_manager_prompt_disabled'),
                toggle,
                tokens,
            };
        })
        .filter(x => x.id);
}

function renderPreset(el) {
    const presetSel = document.getElementById('settings_preset_openai');
    const modelSel = document.getElementById('model_openrouter_select');
    const items = pmItems();

    el.innerHTML = `
        ${presetSel ? `<div class="kab-field"><span>Пресет</span>${cloneSelect(presetSel, 'kab-preset')}</div>` : ''}
        ${modelSel ? `<div class="kab-field"><span>Модель</span>${cloneSelect(modelSel, 'kab-model')}</div>` : ''}
        <input id="kab-pq" class="kab-input" type="search" placeholder="Поиск по блокам">
        <div class="kab-note">${items.length ? `Блоков: ${items.length} · включено ${items.filter(i => i.on).length}` : 'Список блоков пуст — открой разок панель пресета в ST и вернись сюда'}</div>
        <div class="kab-list" id="kab-pm-list"></div>`;

    const list = el.querySelector('#kab-pm-list');
    const draw = (q = '') => {
        const cur = pmItems().filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase()));
        list.innerHTML = cur.map(i => `
            <div class="kab-card slim ${i.on ? '' : 'off'}">
                <div class="kab-card-main"><div class="kab-card-title">${esc(i.name)}</div>${Number(i.tokens) > 0 ? `<div class="kab-card-sub">${esc(i.tokens)} ток.</div>` : ''}</div>
                ${i.toggle ? `<span class="kab-sw"><input type="checkbox" data-pm="${esc(i.id)}" ${i.on ? 'checked' : ''}><i></i></span>` : '<span class="kab-fixed">всегда</span>'}
            </div>`).join('');
        list.querySelectorAll('input[data-pm]').forEach(inp => inp.addEventListener('change', () => {
            const li = document.querySelector(`#completion_prompt_manager_list li[data-pm-identifier="${CSS.escape(inp.dataset.pm)}"]`);
            li?.querySelector('.prompt-manager-toggle-action')?.click();
            setTimeout(() => draw(el.querySelector('#kab-pq').value), 300);
        }));
    };
    draw();

    el.querySelector('#kab-pq').addEventListener('input', e => draw(e.target.value));
    el.querySelector('#kab-preset')?.addEventListener('change', e => {
        $(presetSel).val(e.target.value).trigger('change');
        setTimeout(() => renderTab(), 900);
    });
    el.querySelector('#kab-model')?.addEventListener('change', e => {
        $(modelSel).val(e.target.value).trigger('change');
        toast('Модель переключена', 'success');
    });
}

// ---------- tab: Дни (лента воспоминаний STMB) ----------
async function renderDays(el) {
    if (typeof WI.loadWorldInfo !== 'function') { el.innerHTML = empty('Эта версия ST не отдаёт лорбуки расширениям'); return; }
    const s = settings();
    const books = await activeBooks();
    const mem = [];
    for (const b of books) {
        const d = await WI.loadWorldInfo(b);
        for (const e of Object.values(d?.entries || {})) {
            if (!isMemoryEntry(e)) continue;
            const m = (e.comment || '').match(/^\s*(\d{1,4})\s*[-–—.:]\s*(.+)$/);
            mem.push({ n: m ? Number(m[1]) : 9999, num: m ? m[1] : '•', title: m ? m[2] : (e.comment || 'Воспоминание'), content: e.content || '', off: !!e.disable, book: b });
        }
    }
    mem.sort((a, b) => s.newestFirst ? b.n - a.n : a.n - b.n);

    if (!mem.length) {
        el.innerHTML = empty(books.length ? 'В подключённых лорбуках воспоминаний пока нет' : 'К этому чату не подключено ни одного лорбука');
        return;
    }

    el.innerHTML = `
        <div class="kab-days-head">
            <div><b>Лента памяти</b><small>${mem.length} отрезков · ${esc([...new Set(mem.map(m => m.book))].join(', '))}</small></div>
            <button type="button" class="kab-btn" id="kab-order">${s.newestFirst ? 'новые ↑' : 'старые ↑'}</button>
        </div>
        <div class="kab-timeline">${mem.map(m => `
            <div class="kab-seg ${m.off ? 'off' : ''}">
                <div class="kab-seg-num">${esc(m.num)}</div>
                <div class="kab-seg-card">
                    <div class="kab-seg-title">${esc(m.title)}${m.off ? '<em class="kab-badge">выкл</em>' : ''}</div>
                    <div class="kab-seg-text">${esc(m.content)}</div>
                </div>
            </div>`).join('')}
        </div>`;

    el.querySelectorAll('.kab-seg-card').forEach(c => c.addEventListener('click', () => c.classList.toggle('open')));
    el.querySelector('#kab-order').addEventListener('click', () => { s.newestFirst = !s.newestFirst; save(); renderDays(el); });
}

// ---------- init ----------
jQuery(async () => {
    try {
        settings();
        buildUI();
        applyLook();
        const { eventSource, event_types } = ctx();
        eventSource?.on?.(event_types.CHAT_CHANGED, () => { if (state.open) renderTab(); });
        eventSource?.on?.(event_types.SETTINGS_LOADED, () => applyLook());
        // тему могут сменить и из настроек ST — панель перекрашивается вслед
        $(document).on('change', '#themes', () => setTimeout(() => {
            applyLook();
            if (state.open && settings().tab === 'view') renderTab();
        }, 350));
        console.log('[Кабинет] загружен');
    } catch (e) {
        console.error('[Кабинет] init failed', e);
    }
});
