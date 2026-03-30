/**
 * Gantt Chart App for Nextcloud v2
 * Modern design with modals, categories, assignees, and polished UI
 */
(function() {
'use strict';

const baseUrl = OC.generateUrl('/apps/gantt');

var PALETTE = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7','#e11d48'];

const DAY_NAMES = ['\u65E5', '\u6708', '\u706B', '\u6C34', '\u6728', '\u91D1', '\u571F'];

let projects = [];
let currentProject = null;
let tasks = [];
let selectedTaskId = null;
let activeFilter = 'all';
let searchQuery = '';
let cellWidth = 44;
const rowHeight = 56;
let dragState = null;
let dragDateRange = null;
let scrollLeft = 0;
let deckBoards = [];
let currentDeckBoard = null;
let deckMode = false;
let deckEnabled = localStorage.getItem('gantt-deck-enabled') === 'true';

async function api(method, path, data) {
const url = baseUrl + path;
const opts = {
method: method,
headers: { 'Content-Type': 'application/json', 'requesttoken': OC.requestToken },
};
if (data && (method === 'POST' || method === 'PUT')) {
opts.body = JSON.stringify(data);
}
const resp = await fetch(url, opts);
if (!resp.ok) throw new Error(await resp.text());
return resp.json();
}

function fmtISO(d) {
const dt = d instanceof Date ? d : new Date(d);
return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

function todayDate() { const d = new Date(); d.setHours(0,0,0,0); return d; }

function daysBetween(a, b) {
const da = new Date(a); da.setHours(0,0,0,0);
const db = new Date(b); db.setHours(0,0,0,0);
return Math.round((db - da) / 86400000);
}

function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function getCategoryColor(name) {
if (!name) return '#94a3b8';
var hash = 0;
for (var i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
return PALETTE[Math.abs(hash) % PALETTE.length];
}

function getCategoryInfo(key) {
if (!key) return { key: '', label: '\u672A\u5206\u985E', color: '#94a3b8' };
return { key: key, label: key, color: getCategoryColor(key) };
}

function getUsedCategories() {
var cats = {};
tasks.forEach(function(t) { if (t.category) cats[t.category] = true; });
return Object.keys(cats);
}

function getInitials(name) {
if (!name) return '?';
return name.charAt(0);
}

function getFilteredTasks() {
var filtered = tasks;
if (activeFilter !== 'all') {
filtered = filtered.filter(function(t) { return t.category === activeFilter; });
}
if (searchQuery.trim()) {
var q = searchQuery.toLowerCase();
filtered = filtered.filter(function(t) {
return (t.title && t.title.toLowerCase().indexOf(q) !== -1) ||
(t.assignee && t.assignee.toLowerCase().indexOf(q) !== -1);
});
}
return filtered;
}

function getDateRange() {
if (dragState && dragDateRange) {
return dragDateRange;
}
var ft = getFilteredTasks();
var today = todayDate();
if (ft.length === 0) {
return { start: addDays(today, -3), end: addDays(today, 30) };
}
var minD = new Date(ft[0].startDate), maxD = new Date(ft[0].endDate);
ft.forEach(function(t) {
var s = new Date(t.startDate), e = new Date(t.endDate);
if (s < minD) minD = s;
if (e > maxD) maxD = e;
});
return { start: addDays(minD, -5), end: addDays(maxD, 10) };
}

function h(tag, attrs, children) {
var el = document.createElement(tag);
if (attrs) {
for (var k in attrs) {
if (!attrs.hasOwnProperty(k)) continue;
var v = attrs[k];
if (k === 'className') el.className = v;
else if (k === 'style' && typeof v === 'object') { for (var sk in v) { if (v.hasOwnProperty(sk)) el.style[sk] = v[sk]; } }
else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2).toLowerCase(), v);
else if (k === 'innerHTML') el.innerHTML = v;
else el.setAttribute(k, v);
}
}
if (children != null) {
if (typeof children === 'string') el.textContent = children;
else if (Array.isArray(children)) { for (var i = 0; i < children.length; i++) { if (children[i]) el.appendChild(children[i]); } }
else el.appendChild(children);
}
return el;
}

function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function deckApi(path) {
var url = OC.generateUrl('/apps/deck/api/v1.0' + path);
var resp = await fetch(url, {
headers: { 'Content-Type': 'application/json', 'requesttoken': OC.requestToken, 'OCS-APIRequest': 'true' },
});
if (!resp.ok) throw new Error('Deck API error: ' + resp.status);
return resp.json();
}

function mapDeckCardsToTasks(stacks) {
var allTasks = [];
var totalStacks = stacks.length;
stacks.forEach(function(stack, si) {
var cards = stack.cards || [];
cards.forEach(function(card) {
var endDate, startDate;
if (card.duedate) {
endDate = card.duedate.split('T')[0];
startDate = fmtISO(addDays(new Date(endDate), -7));
} else {
var created = card.createdAt ? new Date(card.createdAt * 1000) : new Date();
startDate = fmtISO(created);
endDate = fmtISO(addDays(created, 14));
}
var progress = totalStacks > 1 ? Math.round((si / (totalStacks - 1)) * 100) : 0;
var assignee = card.assignedUsers && card.assignedUsers.length > 0
? card.assignedUsers[0].participant.displayname : null;
var labelName = card.labels && card.labels.length > 0 ? card.labels[0].title : stack.title;
var labelColor = card.labels && card.labels.length > 0 ? '#' + card.labels[0].color : null;
allTasks.push({
id: 'deck-' + card.id,
title: card.title,
description: card.description || '',
startDate: startDate,
endDate: endDate,
progress: progress,
color: labelColor || getCategoryColor(stack.title),
category: stack.title,
assignee: assignee,
sortOrder: card.order || 0,
parentId: null,
dependencyId: null,
});
});
});
return allTasks;
}

async function loadDeckBoards() {
if (!deckEnabled) { deckBoards = []; return; }
try {
deckBoards = await deckApi('/boards');
renderSidebar();
} catch (e) {
deckBoards = [];
}
}

async function selectDeckBoard(board) {
deckMode = true;
currentDeckBoard = board;
currentProject = null;
selectedTaskId = null;
activeFilter = 'all';
searchQuery = '';
renderSidebar();
try {
var stacks = await deckApi('/boards/' + board.id + '/stacks');
tasks = mapDeckCardsToTasks(stacks);
} catch (e) {
console.error(e);
tasks = [];
notify('Deck\u30C7\u30FC\u30BF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F');
}
renderMain();
}

function renderSidebar() {
var nav = document.getElementById('gantt-nav');
if (!nav) return;
nav.innerHTML = '';

nav.appendChild(h('div', { className: 'nav-header' }, [
h('div', { className: 'nav-logo' }, [
h('span', { className: 'nav-logo-icon', innerHTML: '\uD83D\uDCCA' }),
h('span', { className: 'nav-logo-text' }, '\u30AC\u30F3\u30C8\u30C1\u30E3\u30FC\u30C8'),
]),
]));

var newBtn = h('button', { className: 'nav-new-btn', onClick: function() { showProjectModal(null); } }, [
h('span', { className: 'nav-new-icon' }, '+'),
h('span', null, '\u65B0\u3057\u3044\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8'),
]);
nav.appendChild(h('div', { className: 'nav-new-wrap' }, [newBtn]));

var list = h('div', { className: 'nav-list' });
projects.forEach(function(p) {
var active = currentProject && currentProject.id === p.id;
var item = h('div', {
className: 'nav-item' + (active ? ' active' : ''),
onClick: function() { selectProject(p); },
}, [
h('span', { className: 'nav-item-dot', style: { background: p.color || '#0082c9' } }),
h('span', { className: 'nav-item-name' }, p.title),
h('div', { className: 'nav-item-actions' }, [
h('button', { className: 'nav-act-btn', title: '\u7DE8\u96C6', onClick: function(e) { e.stopPropagation(); showProjectModal(p); } }, '\u270E'),
h('button', { className: 'nav-act-btn danger', title: '\u524A\u9664', onClick: function(e) { e.stopPropagation(); deleteProject(p); } }, '\u2715'),
]),
]);
list.appendChild(item);
});
nav.appendChild(list);

if (deckEnabled && deckBoards.length > 0) {
nav.appendChild(h('div', { className: 'nav-separator' }));
nav.appendChild(h('div', { className: 'nav-section-header' }, [
h('span', { className: 'nav-section-icon' }, '\uD83D\uDDC2\uFE0F'),
h('span', { className: 'nav-section-title' }, 'Deck\u9023\u643A'),
]));
var deckList = h('div', { className: 'nav-list' });
deckBoards.forEach(function(board) {
var active = deckMode && currentDeckBoard && currentDeckBoard.id === board.id;
var item = h('div', {
className: 'nav-item deck-item' + (active ? ' active' : ''),
onClick: function() { selectDeckBoard(board); },
}, [
h('span', { className: 'nav-item-dot', style: { background: '#' + (board.color || '0082c9') } }),
h('span', { className: 'nav-item-name' }, board.title),
]);
deckList.appendChild(item);
});
nav.appendChild(deckList);
}

// Settings button at bottom
var settingsArea = h('div', { className: 'nav-settings' });

var settingsBtn = h('button', {
className: 'nav-settings-btn',
onClick: function() { showSettingsModal(); },
}, [
h('span', { className: 'nav-settings-icon', innerHTML: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' }),
h('span', { className: 'nav-settings-text' }, '\u8A2D\u5B9A'),
]);
settingsArea.appendChild(settingsBtn);
nav.appendChild(settingsArea);
}

function showSettingsModal() {
removeModal();
var overlay = h('div', { className: 'modal-overlay', id: 'gantt-modal' });
overlay.addEventListener('click', function(e) { if (e.target === overlay) removeModal(); });

var dialog = h('div', { className: 'modal-dialog settings-modal' });

// Header
var header = h('div', { className: 'modal-header' }, [
h('h3', null, '\u30AC\u30F3\u30C8\u30C1\u30E3\u30FC\u30C8\u8A2D\u5B9A'),
h('button', { className: 'modal-close', onClick: removeModal }, '\u2715'),
]);
dialog.appendChild(header);

// Body
var body = h('div', { className: 'modal-body' });

// Section: 連携
var sectionTitle1 = h('h4', { className: 'settings-section-title' }, '\u9023\u643A');
body.appendChild(sectionTitle1);

// Deck連携 row
var deckRow = h('div', { className: 'settings-modal-row' });
var deckLabel = h('label', { className: 'settings-modal-label', for: 'sm-deck-toggle' }, 'Deck\u30A2\u30D7\u30EA\u3068\u9023\u643A\u3059\u308B');
deckRow.appendChild(deckLabel);
var deckToggle = h('label', { className: 'settings-toggle' });
var deckCheck = h('input', { type: 'checkbox', id: 'sm-deck-toggle' });
deckCheck.checked = deckEnabled;
deckCheck.addEventListener('change', function() {
deckEnabled = this.checked;
localStorage.setItem('gantt-deck-enabled', deckEnabled ? 'true' : 'false');
if (!deckEnabled) {
deckBoards = [];
if (deckMode) { deckMode = false; currentDeckBoard = null; tasks = []; renderMain(); }
}
renderSidebar();
if (deckEnabled) loadDeckBoards();
});
deckToggle.appendChild(deckCheck);
deckToggle.appendChild(h('span', { className: 'settings-toggle-slider' }));
deckRow.appendChild(deckToggle);
body.appendChild(deckRow);

dialog.appendChild(body);
overlay.appendChild(dialog);
document.body.appendChild(overlay);
}

function renderMain() {
var main = document.getElementById('gantt-content');
if (!main) return;
main.innerHTML = '';

if (!currentProject && !deckMode) {
main.innerHTML = '<div class="empty-state"><div class="empty-icon">\uD83D\uDCCA</div>'
+ '<h2>\u30AC\u30F3\u30C8\u30C1\u30E3\u30FC\u30C8</h2><p>\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u9078\u629E\u3059\u308B\u304B\u3001\u65B0\u3057\u304F\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002</p></div>';
return;
}

if (deckMode && currentDeckBoard) {
var deckHeader = h('div', { className: 'deck-mode-header' }, [
h('span', { className: 'deck-mode-icon' }, '\uD83D\uDDC2\uFE0F'),
h('span', { className: 'deck-mode-title' }, 'Deck: ' + currentDeckBoard.title),
h('span', { className: 'deck-mode-badge' }, '\u8AAD\u307F\u53D6\u308A\u5C02\u7528'),
]);
main.appendChild(deckHeader);
}

var toolbar = h('div', { className: 'toolbar' });
var filters = h('div', { className: 'filter-bar' }, [
makeFilterPill('all', '\u3059\u3079\u3066'),
]);
getUsedCategories().forEach(function(cat) {
filters.appendChild(makeFilterPill(cat, cat));
});
toolbar.appendChild(filters);

var right = h('div', { className: 'toolbar-right' });
var searchInput = h('input', {
className: 'search-input',
type: 'text',
placeholder: '\u30BF\u30B9\u30AF\u30FB\u62C5\u5F53\u8005\u3092\u691C\u7D22...',
});
searchInput.value = searchQuery;
searchInput.addEventListener('input', function(e) {
var cursorPos = e.target.selectionStart;
searchQuery = e.target.value;
renderMain();
var newInput = document.querySelector('.search-input');
if (newInput) {
newInput.focus();
newInput.setSelectionRange(cursorPos, cursorPos);
}
});
right.appendChild(searchInput);
if (!deckMode) {
right.appendChild(h('button', { className: 'btn-primary', onClick: function() { showTaskModal(null); } }, '\uFF0B \u30BF\u30B9\u30AF\u8FFD\u52A0'));
}
toolbar.appendChild(right);
main.appendChild(toolbar);

var ft = getFilteredTasks();

if (ft.length === 0) {
main.appendChild(h('div', { className: 'empty-tasks' }, '\u30BF\u30B9\u30AF\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u300C\u30BF\u30B9\u30AF\u8FFD\u52A0\u300D\u30DC\u30BF\u30F3\u3067\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002'));
return;
}

var range = getDateRange();
var totalDays = daysBetween(range.start, range.end) + 1;
var timelineWidth = totalDays * cellWidth;
var today = todayDate();
var todayOffset = daysBetween(range.start, today);

var gantt = h('div', { className: 'gantt-area' });

// Task list
var tl = h('div', { className: 'task-list' });
tl.appendChild(h('div', { className: 'tl-header' }, [
h('span', { className: 'tl-h-name' }, '\u30BF\u30B9\u30AF\u540D'),
h('span', { className: 'tl-h-cat' }, '\u30AB\u30C6\u30B4\u30EA'),
h('span', { className: 'tl-h-assignee' }, '\u62C5\u5F53'),
h('span', { className: 'tl-h-progress' }, '\u9032\u6357'),
]));

ft.forEach(function(task) {
var catInfo = getCategoryInfo(task.category);
var row = h('div', {
className: 'tl-row' + (selectedTaskId === task.id ? ' selected' : ''),
onClick: function() { selectedTaskId = selectedTaskId === task.id ? null : task.id; renderMain(); },
}, [
h('div', { className: 'tl-name-cell' }, [
h('div', { className: 'tl-task-title' }, task.title),
]),
h('div', { className: 'tl-cat-cell' }, [
h('span', { className: 'cat-badge', style: { background: catInfo.color + '22', color: catInfo.color, borderColor: catInfo.color } }, catInfo.label),
]),
h('div', { className: 'tl-assignee-cell' }, [
h('span', { className: 'avatar-circle', style: { background: catInfo.color } }, getInitials(task.assignee)),
]),
h('div', { className: 'tl-progress-cell' }, [
h('div', { className: 'progress-mini' }, [
h('div', { className: 'progress-mini-fill', style: { width: task.progress + '%', background: catInfo.color } }),
]),
h('span', { className: 'progress-pct' }, task.progress + '%'),
]),
]);

// Context: double click row to edit
row.addEventListener('dblclick', function(e) { e.stopPropagation(); if (!deckMode) showTaskModal(task); });
tl.appendChild(row);
});
gantt.appendChild(tl);

// Timeline
var timeline = h('div', { className: 'timeline', id: 'gantt-timeline' });

var tlHead = h('div', { className: 'tl-head', style: { width: timelineWidth + 'px' } });

// Month row
var monthRow = h('div', { className: 'tl-month-row' });
var curMonth = -1, monthStart = 0;
for (var i = 0; i < totalDays; i++) {
var d = addDays(range.start, i);
var m = d.getFullYear() * 100 + d.getMonth();
if (m !== curMonth) {
if (curMonth !== -1) {
monthRow.appendChild(h('div', {
className: 'tl-month-cell',
style: { left: monthStart * cellWidth + 'px', width: (i - monthStart) * cellWidth + 'px' },
}, addDays(range.start, monthStart).toLocaleString('ja', { year: 'numeric', month: 'long' })));
}
curMonth = m;
monthStart = i;
}
}
monthRow.appendChild(h('div', {
className: 'tl-month-cell',
style: { left: monthStart * cellWidth + 'px', width: (totalDays - monthStart) * cellWidth + 'px' },
}, addDays(range.start, monthStart).toLocaleString('ja', { year: 'numeric', month: 'long' })));
tlHead.appendChild(monthRow);

// Day row
var dayRow = h('div', { className: 'tl-day-row' });
for (var i2 = 0; i2 < totalDays; i2++) {
var d2 = addDays(range.start, i2);
var dow = d2.getDay();
var isWeekend = dow === 0 || dow === 6;
var isToday = d2.getTime() === today.getTime();
var cls = 'tl-day-cell';
if (isWeekend) cls += ' weekend';
if (isToday) cls += ' today';

var cell = h('div', { className: cls, style: { left: i2 * cellWidth + 'px', width: cellWidth + 'px' } });
cell.appendChild(h('span', { className: 'day-num' }, d2.getDate().toString()));
cell.appendChild(h('span', { className: 'day-name' + (isWeekend ? ' weekend' : '') }, DAY_NAMES[dow]));
dayRow.appendChild(cell);
}
tlHead.appendChild(dayRow);
timeline.appendChild(tlHead);

// Timeline body
var bodyHeight = ft.length * rowHeight;
var tlBody = h('div', { className: 'tl-body', style: { width: timelineWidth + 'px', height: bodyHeight + 'px' } });

// Grid columns
for (var i3 = 0; i3 < totalDays; i3++) {
var d3 = addDays(range.start, i3);
var dow3 = d3.getDay();
var cls3 = 'grid-col';
if (dow3 === 0 || dow3 === 6) cls3 += ' weekend';
tlBody.appendChild(h('div', { className: cls3, style: { left: i3 * cellWidth + 'px', width: cellWidth + 'px', height: bodyHeight + 'px' } }));
}

// Horizontal row lines
for (var r = 0; r <= ft.length; r++) {
tlBody.appendChild(h('div', { className: 'grid-hline', style: { top: r * rowHeight + 'px', width: timelineWidth + 'px' } }));
}

// Today line
if (todayOffset >= 0 && todayOffset < totalDays) {
tlBody.appendChild(h('div', { className: 'today-line', style: { left: (todayOffset * cellWidth + cellWidth / 2) + 'px', height: bodyHeight + 'px' } }));
}

// Task bars
ft.forEach(function(task, ri) {
var catInfo = getCategoryInfo(task.category);
var sOff = daysBetween(range.start, task.startDate);
var eOff = daysBetween(range.start, task.endDate);
var barLeft = sOff * cellWidth;
var barWidth = Math.max((eOff - sOff + 1) * cellWidth, cellWidth);
var barTop = ri * rowHeight + 12;
var barHeight = 32;

var bar = h('div', {
className: 'gantt-bar' + (selectedTaskId === task.id ? ' selected' : ''),
style: {
left: barLeft + 'px',
width: barWidth + 'px',
top: barTop + 'px',
height: barHeight + 'px',
background: catInfo.color,
},
title: task.title + ' (' + task.startDate + ' \u2192 ' + task.endDate + ')\n\u9032\u6357: ' + task.progress + '%',
});

bar.appendChild(h('div', { className: 'bar-progress', style: { width: task.progress + '%' } }));
bar.appendChild(h('span', { className: 'bar-label' }, task.title));
bar.appendChild(h('div', { className: 'rh rh-l' }));
bar.appendChild(h('div', { className: 'rh rh-r' }));

bar.addEventListener('mousedown', function(e) {
if (e.target.classList.contains('rh-l')) startDrag(e, task, 'resize-left');
else if (e.target.classList.contains('rh-r')) startDrag(e, task, 'resize-right');
else startDrag(e, task, 'move');
});

bar.addEventListener('dblclick', function(e) { e.stopPropagation(); if (!deckMode) showTaskModal(task); });
tlBody.appendChild(bar);
});

timeline.appendChild(tlBody);
gantt.appendChild(timeline);
main.appendChild(gantt);

var tlEl = document.getElementById('gantt-timeline');
if (tlEl) tlEl.scrollLeft = scrollLeft;
if (tlEl) tlEl.addEventListener('scroll', function() { scrollLeft = tlEl.scrollLeft; });
}

function makeFilterPill(key, label) {
var catColor = (key !== 'all') ? getCategoryColor(key) : null;
var style = {};
if (activeFilter === key) {
style = catColor ? { background: catColor, color: '#fff', borderColor: catColor }
: { background: '#1e293b', color: '#fff', borderColor: '#1e293b' };
}
return h('button', {
className: 'filter-pill' + (activeFilter === key ? ' active' : ''),
style: style,
onClick: function() { activeFilter = key; renderMain(); },
}, label);
}

function startDrag(e, task, mode) {
if (deckMode) return;
e.preventDefault();
dragDateRange = getDateRange();
dragState = { task: task, mode: mode, x0: e.clientX, origStart: task.startDate, origEnd: task.endDate };
document.body.style.cursor = mode === 'move' ? 'grabbing' : 'col-resize';
}

document.addEventListener('mousemove', function(e) {
if (!dragState) return;
e.preventDefault();
var dx = e.clientX - dragState.x0;
var daysDelta = Math.round(dx / cellWidth);
var t = dragState.task;
if (dragState.mode === 'move') {
t.startDate = fmtISO(addDays(dragState.origStart, daysDelta));
t.endDate = fmtISO(addDays(dragState.origEnd, daysDelta));
} else if (dragState.mode === 'resize-left') {
t.startDate = fmtISO(addDays(dragState.origStart, daysDelta));
} else {
t.endDate = fmtISO(addDays(dragState.origEnd, daysDelta));
}
renderMain();
});

document.addEventListener('mouseup', function() {
if (!dragState) return;
document.body.style.cursor = '';
var t = dragState.task;
var changed = t.startDate !== dragState.origStart || t.endDate !== dragState.origEnd;
dragState = null;
dragDateRange = null;
if (changed) {
saveTaskToServer(t);
renderMain();
}
});

function showProjectModal(project) {
var isEdit = !!project;
removeModal();
var overlay = h('div', { className: 'modal-overlay', id: 'gantt-modal' });
overlay.addEventListener('click', function(e) { if (e.target === overlay) removeModal(); });

var dialog = h('div', { className: 'modal-dialog' });
dialog.innerHTML = '<div class="modal-header">'
+ '<h3>' + (isEdit ? '\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u7DE8\u96C6' : '\u65B0\u3057\u3044\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8') + '</h3>'
+ '<button class="modal-close" id="modal-close-btn">\u2715</button>'
+ '</div>'
+ '<div class="modal-body">'
+ '<div class="field"><label>\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D</label>'
+ '<input type="text" id="pf-title" value="' + esc(isEdit ? project.title : '') + '" placeholder="\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D\u3092\u5165\u529B" /></div>'
+ '<div class="field"><label>\u8AAC\u660E</label>'
+ '<textarea id="pf-desc" rows="2" placeholder="\u8AAC\u660E\uFF08\u4EFB\u610F\uFF09">' + esc(isEdit ? (project.description || '') : '') + '</textarea></div>'
+ '<div class="field"><label>\u30AB\u30E9\u30FC</label>'
+ '<input type="color" id="pf-color" value="' + (isEdit ? (project.color || '#0082c9') : '#0082c9') + '" /></div>'
+ '</div>'
+ '<div class="modal-footer">'
+ '<button class="btn-cancel" id="pf-cancel">\u30AD\u30E3\u30F3\u30BB\u30EB</button>'
+ '<button class="btn-primary" id="pf-save">\u4FDD\u5B58</button>'
+ '</div>';
overlay.appendChild(dialog);
document.body.appendChild(overlay);

document.getElementById('modal-close-btn').onclick = removeModal;
document.getElementById('pf-cancel').onclick = removeModal;
document.getElementById('pf-save').onclick = async function() {
var title = document.getElementById('pf-title').value.trim();
if (!title) { notify('\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044'); return; }
var data = {
title: title,
description: document.getElementById('pf-desc').value,
color: document.getElementById('pf-color').value,
};
try {
if (isEdit) {
var up = await api('PUT', '/api/projects/' + project.id, data);
var idx = projects.findIndex(function(p) { return p.id === project.id; });
if (idx !== -1) projects[idx] = up;
if (currentProject && currentProject.id === project.id) currentProject = up;
} else {
var np = await api('POST', '/api/projects', data);
projects.unshift(np);
selectProject(np);
}
removeModal();
renderSidebar();
renderMain();
notify(isEdit ? '\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F' : '\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F');
} catch (e) { console.error(e); notify('\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F'); }
};
document.getElementById('pf-title').focus();
}

function showTaskModal(task) {
var isEdit = !!task;
removeModal();
var todayStr = fmtISO(new Date());
var nextW = fmtISO(addDays(new Date(), 7));

var overlay = h('div', { className: 'modal-overlay', id: 'gantt-modal' });
overlay.addEventListener('click', function(e) { if (e.target === overlay) removeModal(); });

var depOptions = tasks.filter(function(t) { return !isEdit || t.id !== task.id; }).map(function(t) {
return '<option value="' + t.id + '"' + (isEdit && task.dependencyId === t.id ? ' selected' : '') + '>' + esc(t.title) + '</option>';
}).join('');

var usedCats = getUsedCategories();
var catDatalist = usedCats.map(function(c) { return '<option value="' + esc(c) + '">'; }).join('');

var dialog = h('div', { className: 'modal-dialog modal-wide' });
dialog.innerHTML = '<div class="modal-header">'
+ '<h3>' + (isEdit ? '\u30BF\u30B9\u30AF\u7DE8\u96C6' : '\u65B0\u3057\u3044\u30BF\u30B9\u30AF') + '</h3>'
+ '<button class="modal-close" id="modal-close-btn">\u2715</button>'
+ '</div>'
+ '<div class="modal-body">'
+ '<div class="field"><label>\u30BF\u30B9\u30AF\u540D <span class="required">*</span></label>'
+ '<input type="text" id="tf-title" value="' + esc(isEdit ? task.title : '') + '" placeholder="\u30BF\u30B9\u30AF\u540D\u3092\u5165\u529B" /></div>'
+ '<div class="field"><label>\u8AAC\u660E</label>'
+ '<textarea id="tf-desc" rows="2" placeholder="\u8AAC\u660E\uFF08\u4EFB\u610F\uFF09">' + esc(isEdit ? (task.description || '') : '') + '</textarea></div>'
+ '<div class="field-row">'
+ '<div class="field"><label>\u958B\u59CB\u65E5 <span class="required">*</span></label>'
+ '<input type="date" id="tf-start" value="' + (isEdit ? task.startDate : todayStr) + '" /></div>'
+ '<div class="field"><label>\u7D42\u4E86\u65E5 <span class="required">*</span></label>'
+ '<input type="date" id="tf-end" value="' + (isEdit ? task.endDate : nextW) + '" /></div>'
+ '</div>'
+ '<div class="field-row">'
+ '<div class="field"><label>\u30AB\u30C6\u30B4\u30EA</label>'
+ '<input type="text" id="tf-cat" list="cat-datalist" value="' + esc(isEdit ? (task.category || '') : '') + '" placeholder="\u4F8B: \u958B\u767A, \u4F01\u753B, \u30C7\u30B6\u30A4\u30F3..." />'
+ '<datalist id="cat-datalist">' + catDatalist + '</datalist></div>'
+ '<div class="field"><label>\u62C5\u5F53\u8005</label>'
+ '<input type="text" id="tf-assignee" value="' + esc(isEdit ? (task.assignee || '') : '') + '" placeholder="\u62C5\u5F53\u8005\u540D" /></div>'
+ '</div>'
+ '<div class="field"><label>\u9032\u6357 <span class="progress-val" id="tf-pct-val">' + (isEdit ? task.progress : 0) + '%</span></label>'
+ '<input type="range" id="tf-progress" min="0" max="100" value="' + (isEdit ? task.progress : 0) + '" class="progress-slider" />'
+ '<div class="progress-bar-preview"><div class="progress-bar-fill" id="tf-pbar" style="width:' + (isEdit ? task.progress : 0) + '%"></div></div></div>'
+ '<div class="field-row">'
+ '<div class="field"><label>\u4F9D\u5B58\u30BF\u30B9\u30AF</label>'
+ '<select id="tf-dep"><option value="">\u306A\u3057</option>' + depOptions + '</select></div>'
+ '<div class="field"><label>\u30AB\u30E9\u30FC</label>'
+ '<input type="color" id="tf-color" value="' + (isEdit ? (task.color || '#6366f1') : '#6366f1') + '" /></div>'
+ '</div>'
+ '</div>'
+ '<div class="modal-footer">'
+ (isEdit ? '<button class="btn-danger" id="tf-delete">\u524A\u9664</button>' : '')
+ '<div class="modal-footer-right">'
+ '<button class="btn-cancel" id="tf-cancel">\u30AD\u30E3\u30F3\u30BB\u30EB</button>'
+ '<button class="btn-primary" id="tf-save">\u4FDD\u5B58</button>'
+ '</div></div>';
overlay.appendChild(dialog);
document.body.appendChild(overlay);

var slider = document.getElementById('tf-progress');
slider.oninput = function() {
document.getElementById('tf-pct-val').textContent = slider.value + '%';
document.getElementById('tf-pbar').style.width = slider.value + '%';
};

document.getElementById('tf-cat').addEventListener('input', function() {
var val = this.value.trim();
if (val) document.getElementById('tf-color').value = getCategoryColor(val);
});

document.getElementById('modal-close-btn').onclick = removeModal;
document.getElementById('tf-cancel').onclick = removeModal;
if (isEdit && document.getElementById('tf-delete')) {
document.getElementById('tf-delete').onclick = function() { removeModal(); deleteTask(task); };
}

document.getElementById('tf-save').onclick = async function() {
var title = document.getElementById('tf-title').value.trim();
if (!title) { notify('\u30BF\u30B9\u30AF\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044'); return; }
var catVal = document.getElementById('tf-cat').value.trim();
var catInfo = getCategoryInfo(catVal);

var data = {
title: title,
description: document.getElementById('tf-desc').value,
startDate: document.getElementById('tf-start').value,
endDate: document.getElementById('tf-end').value,
progress: parseInt(slider.value, 10),
color: document.getElementById('tf-color').value || catInfo.color,
sortOrder: isEdit ? task.sortOrder : tasks.length,
parentId: null,
dependencyId: document.getElementById('tf-dep').value ? parseInt(document.getElementById('tf-dep').value, 10) : null,
category: catVal || null,
assignee: document.getElementById('tf-assignee').value || null,
};

try {
if (isEdit) {
var up = await api('PUT', '/api/projects/' + currentProject.id + '/tasks/' + task.id, data);
var idx = tasks.findIndex(function(t) { return t.id === task.id; });
if (idx !== -1) tasks[idx] = up;
notify('\u30BF\u30B9\u30AF\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F');
} else {
var nw = await api('POST', '/api/projects/' + currentProject.id + '/tasks', data);
tasks.push(nw);
notify('\u30BF\u30B9\u30AF\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F');
}
removeModal();
renderMain();
} catch (e) { console.error(e); notify('\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F'); }
};
document.getElementById('tf-title').focus();
}

function removeModal() {
var m = document.getElementById('gantt-modal');
if (m) m.remove();
}

async function loadProjects() {
try { projects = await api('GET', '/api/projects'); renderSidebar(); }
catch (e) { console.error(e); notify('\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F'); }
}

async function selectProject(p) {
deckMode = false;
currentDeckBoard = null;
currentProject = p;
renderSidebar();
try { tasks = await api('GET', '/api/projects/' + p.id + '/tasks'); }
catch (e) { console.error(e); tasks = []; notify('\u30BF\u30B9\u30AF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F'); }
renderMain();
}

async function deleteProject(p) {
showConfirmModal(
'\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u524A\u9664',
'\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u300C' + p.title + '\u300D\u3068\u3059\u3079\u3066\u306E\u30BF\u30B9\u30AF\u3092\u524A\u9664\u3057\u307E\u3059\u3002\u3053\u306E\u64CD\u4F5C\u306F\u5143\u306B\u623B\u305B\u307E\u305B\u3093\u3002',
'\u524A\u9664',
async function() {
try {
await api('DELETE', '/api/projects/' + p.id);
projects = projects.filter(function(x) { return x.id !== p.id; });
if (currentProject && currentProject.id === p.id) { currentProject = null; tasks = []; }
renderSidebar(); renderMain();
notify('\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u524A\u9664\u3057\u307E\u3057\u305F');
} catch (e) { console.error(e); notify('\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F'); }
}
);
}

async function saveTaskToServer(task) {
try {
var data = {
title: task.title, description: task.description,
startDate: task.startDate, endDate: task.endDate,
progress: task.progress, color: task.color,
sortOrder: task.sortOrder, parentId: task.parentId,
dependencyId: task.dependencyId,
category: task.category, assignee: task.assignee,
};
var up = await api('PUT', '/api/projects/' + currentProject.id + '/tasks/' + task.id, data);
var idx = tasks.findIndex(function(t) { return t.id === task.id; });
if (idx !== -1) Object.assign(tasks[idx], up);
} catch (e) {
console.error(e);
notify('\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F');
tasks = await api('GET', '/api/projects/' + currentProject.id + '/tasks');
renderMain();
}
}

async function deleteTask(task) {
showConfirmModal(
'\u30BF\u30B9\u30AF\u306E\u524A\u9664',
'\u30BF\u30B9\u30AF\u300C' + task.title + '\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u3002\u3053\u306E\u64CD\u4F5C\u306F\u5143\u306B\u623B\u305B\u307E\u305B\u3093\u3002',
'\u524A\u9664',
async function() {
try {
await api('DELETE', '/api/projects/' + currentProject.id + '/tasks/' + task.id);
tasks = tasks.filter(function(t) { return t.id !== task.id; });
if (selectedTaskId === task.id) selectedTaskId = null;
renderMain();
notify('\u30BF\u30B9\u30AF\u3092\u524A\u9664\u3057\u307E\u3057\u305F');
} catch (e) { console.error(e); notify('\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F'); }
}
);
}

function notify(msg) {
if (typeof OC !== 'undefined' && OC.Notification) OC.Notification.showTemporary(msg);
}

function showConfirmModal(title, message, confirmLabel, onConfirm) {
removeModal();
var overlay = h('div', { className: 'modal-overlay', id: 'gantt-modal' });
overlay.addEventListener('click', function(e) { if (e.target === overlay) removeModal(); });

var dialog = h('div', { className: 'modal-dialog confirm-modal' });

var header = h('div', { className: 'modal-header' }, [
h('h3', null, title),
h('button', { className: 'modal-close', onClick: removeModal }, '\u2715'),
]);
dialog.appendChild(header);

var body = h('div', { className: 'modal-body' });
body.appendChild(h('p', { className: 'confirm-message' }, message));
dialog.appendChild(body);

var footer = h('div', { className: 'modal-footer' });
footer.appendChild(h('button', { className: 'btn-cancel', onClick: removeModal }, '\u30AD\u30E3\u30F3\u30BB\u30EB'));
footer.appendChild(h('button', { className: 'btn-danger', onClick: function() { removeModal(); onConfirm(); } }, confirmLabel));
dialog.appendChild(footer);

overlay.appendChild(dialog);
document.body.appendChild(overlay);
}

document.addEventListener('DOMContentLoaded', function() {
var app = document.getElementById('gantt-app');
if (!app) return;
app.innerHTML = '<div class="gantt-layout">'
+ '<nav id="gantt-nav" class="gantt-nav"></nav>'
+ '<main id="gantt-content" class="gantt-main"></main>'
+ '</div>';
loadProjects();
loadDeckBoards();
renderMain();
});
})();
