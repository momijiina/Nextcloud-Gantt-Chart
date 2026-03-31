/**
 * Gantt Chart App for Nextcloud v2
 * Modern design with modals, categories, assignees, and polished UI
 */
(function() {
'use strict';

const baseUrl = OC.generateUrl('/apps/gantt');

var PALETTE = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7','#e11d48'];

// i18n helper
var _locale = 'en';
try { if (typeof OC !== 'undefined' && OC.getLanguage) _locale = OC.getLanguage().replace('_', '-'); } catch(e) {}

function _t(key, vars) {
var text = (typeof t === 'function') ? t('gantt', key) : key;
if (vars) { for (var k in vars) { if (vars.hasOwnProperty(k)) text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); } }
return text;
}

var DAY_NAMES = (function() {
try {
var names = [];
for (var i = 0; i < 7; i++) { var d = new Date(2023, 0, 1 + i); names.push(d.toLocaleDateString(_locale, { weekday: 'short' })); }
return names;
} catch(e) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; }
})();

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
let dragFilteredTasks = null;
let scrollLeft = 0;
let deckBoards = [];
let currentDeckBoard = null;
let deckMode = false;
let deckEnabled = localStorage.getItem('gantt-deck-enabled') === 'true';
let taskSortOrder = localStorage.getItem('gantt-sort-order') || 'default';
let projectSortOrder = localStorage.getItem('gantt-project-sort') || 'default';
let projectSearchQuery = '';

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
if (!key) return { key: '', label: _t('Uncategorized'), color: '#94a3b8' };
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
if (taskSortOrder === 'start-asc') {
filtered = filtered.slice().sort(function(a,b) { return a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0; });
} else if (taskSortOrder === 'start-desc') {
filtered = filtered.slice().sort(function(a,b) { return a.startDate > b.startDate ? -1 : a.startDate < b.startDate ? 1 : 0; });
}
// Dependency-aware sort: parent tasks come before their dependents
filtered = sortByDependency(filtered);
return filtered;
}

function sortByDependency(list) {
var idSet = {};
list.forEach(function(t) { idSet[t.id] = true; });
// Build adjacency: parent -> children (tasks that depend on parent)
var children = {};
list.forEach(function(t) {
if (t.dependencyId && idSet[t.dependencyId]) {
if (!children[t.dependencyId]) children[t.dependencyId] = [];
children[t.dependencyId].push(t);
}
});
var visited = {};
var result = [];
function visit(task) {
if (visited[task.id]) return;
visited[task.id] = true;
result.push(task);
if (children[task.id]) {
children[task.id].forEach(function(child) { visit(child); });
}
}
// Start with root tasks (no dependency or dependency not in filtered list)
list.forEach(function(t) {
if (!t.dependencyId || !idSet[t.dependencyId]) {
visit(t);
}
});
// Add any remaining (circular dependency safety)
list.forEach(function(t) { visit(t); });
return result;
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

function simpleMd(text) {
    var s = esc(text);
    s = s.replace(/^#{1,3}\s+(.+)$/gm, '<strong class="md-heading">$1</strong>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
    s = s.replace(/((?:<li>[\s\S]*?<\/li>\s*)+)/g, '<ul>$1</ul>');
    s = s.replace(/\n\n+/g, '</p><p>');
    s = s.replace(/\n/g, '<br>');
    return '<p>' + s + '</p>';
}

async function deckApi(path, method, body) {
var url = OC.generateUrl('/apps/deck/api/v1.0' + path);
var opts = {
method: method || 'GET',
headers: { 'Content-Type': 'application/json', 'requesttoken': OC.requestToken, 'OCS-APIRequest': 'true' },
};
if (body) opts.body = JSON.stringify(body);
var resp = await fetch(url, opts);
if (!resp.ok) {
var errMsg = 'Deck API error: ' + resp.status;
try { var errBody = await resp.json(); errMsg += ' - ' + (errBody.message || JSON.stringify(errBody)); } catch(_) {}
throw new Error(errMsg);
}
return resp.json();
}

function mapDeckCardsToTasks(stacks) {
var allTasks = [];
var totalStacks = stacks.length;
stacks.forEach(function(stack, si) {
var cards = stack.cards || [];
cards.forEach(function(card) {
var endDate, startDate;
var created = card.createdAt ? new Date(card.createdAt * 1000) : new Date();
startDate = fmtISO(created);
if (card.duedate) {
endDate = card.duedate.split('T')[0];
if (new Date(endDate) < new Date(startDate)) startDate = endDate;
} else {
endDate = fmtISO(addDays(created, 14));
}
var progress = totalStacks > 1 ? Math.round((si / (totalStacks - 1)) * 100) : 0;
var assignee = card.assignedUsers && card.assignedUsers.length > 0
? card.assignedUsers[0].participant.displayname : null;
var labelName = card.labels && card.labels.length > 0 ? card.labels[0].title : stack.title;
var labelColor = card.labels && card.labels.length > 0 ? '#' + card.labels[0].color : null;
allTasks.push({
id: 'deck-' + card.id,
_stackId: stack.id,
_cardOrder: card.order || 0,
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
notify(_t('Failed to load Deck data'));
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
h('span', { className: 'nav-logo-text' }, _t('Gantt Chart')),
]),
]));

var newBtn = h('button', { className: 'nav-new-btn', onClick: function() { showProjectModal(null); } }, [
h('span', { className: 'nav-new-icon' }, '+'),
h('span', null, _t('New project')),
]);
nav.appendChild(h('div', { className: 'nav-new-wrap' }, [newBtn]));

// Project search
var searchWrap = h('div', { className: 'nav-search-wrap' });
var projSearchInput = h('input', {
className: 'nav-search-input',
type: 'text',
placeholder: _t('Search projects...'),
});
projSearchInput.value = projectSearchQuery;
var projIsComposing = false;
projSearchInput.addEventListener('compositionstart', function() { projIsComposing = true; });
projSearchInput.addEventListener('compositionend', function(e) {
projIsComposing = false;
projectSearchQuery = e.target.value;
renderSidebar();
var ni = document.querySelector('.nav-search-input');
if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
});
projSearchInput.addEventListener('input', function(e) {
if (projIsComposing) return;
projectSearchQuery = e.target.value;
renderSidebar();
var ni = document.querySelector('.nav-search-input');
if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
});
searchWrap.appendChild(projSearchInput);

// Project sort toggle
var sortIcons = { 'default': '⇅', 'name-asc': '↑A', 'name-desc': '↓Z', 'newest': '🕐' };
var sortBtn = h('button', {
className: 'nav-sort-btn',
title: _t('Sort'),
onClick: function() {
var order = ['default', 'name-asc', 'name-desc', 'newest'];
var idx = order.indexOf(projectSortOrder);
projectSortOrder = order[(idx + 1) % order.length];
localStorage.setItem('gantt-project-sort', projectSortOrder);
renderSidebar();
},
}, sortIcons[projectSortOrder] || '⇅');
searchWrap.appendChild(sortBtn);
nav.appendChild(searchWrap);

// Filtered and sorted projects
var displayProjects = projects.slice();
if (projectSearchQuery.trim()) {
var pq = projectSearchQuery.toLowerCase();
displayProjects = displayProjects.filter(function(p) {
return p.title && p.title.toLowerCase().indexOf(pq) !== -1;
});
}
if (projectSortOrder === 'name-asc') {
displayProjects.sort(function(a,b) { return (a.title || '').localeCompare(b.title || ''); });
} else if (projectSortOrder === 'name-desc') {
displayProjects.sort(function(a,b) { return (b.title || '').localeCompare(a.title || ''); });
} else if (projectSortOrder === 'newest') {
displayProjects.sort(function(a,b) { return (b.id || 0) - (a.id || 0); });
}

var list = h('div', { className: 'nav-list' });
displayProjects.forEach(function(p) {
var active = currentProject && currentProject.id === p.id;
var item = h('div', {
className: 'nav-item' + (active ? ' active' : ''),
onClick: function() { selectProject(p); },
}, [
h('span', { className: 'nav-item-dot', style: { background: p.color || '#0082c9' } }),
h('span', { className: 'nav-item-name' }, p.title),
h('div', { className: 'nav-item-actions' }, [
h('button', { className: 'nav-act-btn', title: _t('Edit'), onClick: function(e) { e.stopPropagation(); showProjectModal(p); } }, '\u270E'),
h('button', { className: 'nav-act-btn danger', title: _t('Delete'), onClick: function(e) { e.stopPropagation(); deleteProject(p); } }, '\u2715'),
]),
]);
list.appendChild(item);
});
nav.appendChild(list);

if (deckEnabled && deckBoards.length > 0) {
nav.appendChild(h('div', { className: 'nav-separator' }));
nav.appendChild(h('div', { className: 'nav-section-header' }, [
h('span', { className: 'nav-section-icon' }, '\uD83D\uDDC2\uFE0F'),
h('span', { className: 'nav-section-title' }, _t('Deck integration')),
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
h('span', { className: 'nav-settings-text' }, _t('Settings')),
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
h('h3', null, _t('Gantt Chart Settings')),
h('button', { className: 'modal-close', onClick: removeModal }, '\u2715'),
]);
dialog.appendChild(header);

// Body
var body = h('div', { className: 'modal-body' });

// Section: 連携
var sectionTitle1 = h('h4', { className: 'settings-section-title' }, _t('Integration'));
body.appendChild(sectionTitle1);

// Deck連携 row
var deckRow = h('div', { className: 'settings-modal-row' });
var deckLabel = h('label', { className: 'settings-modal-label', for: 'sm-deck-toggle' }, _t('Integrate with Deck app'));
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

// Section: 表示
var sectionTitle2 = h('h4', { className: 'settings-section-title' }, _t('Display'));
body.appendChild(sectionTitle2);

var sortRow = h('div', { className: 'settings-modal-row' });
var sortLabel = h('label', { className: 'settings-modal-label' }, _t('Task Sort Order'));
sortRow.appendChild(sortLabel);
var sortSelect = h('select', { className: 'settings-select', id: 'sm-sort-order' });
var sortOptions = [
{ value: 'default', label: _t('Default') },
{ value: 'start-asc', label: _t('Start Date') + ' (' + _t('Ascending') + ')' },
{ value: 'start-desc', label: _t('Start Date') + ' (' + _t('Descending') + ')' },
];
sortOptions.forEach(function(opt) {
var o = h('option', { value: opt.value }, opt.label);
if (opt.value === taskSortOrder) o.selected = true;
sortSelect.appendChild(o);
});
sortSelect.addEventListener('change', function() {
taskSortOrder = this.value;
localStorage.setItem('gantt-sort-order', taskSortOrder);
renderMain();
});
sortRow.appendChild(sortSelect);
body.appendChild(sortRow);

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
+ '<h2>' + _t('Gantt Chart') + '</h2><p>' + _t('Select a project or create a new one.') + '</p></div>';
return;
}

if (deckMode && currentDeckBoard) {
var deckHeader = h('div', { className: 'deck-mode-header' }, [
h('span', { className: 'deck-mode-icon' }, '\uD83D\uDDC2\uFE0F'),
h('span', { className: 'deck-mode-title' }, _t('Deck') + ': ' + currentDeckBoard.title),
]);
main.appendChild(deckHeader);
}

var toolbar = h('div', { className: 'toolbar' });
var filters = h('div', { className: 'filter-bar' }, [
makeFilterPill('all', _t('All')),
]);
getUsedCategories().forEach(function(cat) {
filters.appendChild(makeFilterPill(cat, cat));
});
toolbar.appendChild(filters);

var right = h('div', { className: 'toolbar-right' });
right.appendChild(h('button', { className: 'btn-today', onClick: function() { scrollToToday(); } }, _t('Today')));
var searchInput = h('input', {
className: 'search-input',
type: 'text',
placeholder: _t('Search tasks and assignees...'),
});
searchInput.value = searchQuery;
var isComposing = false;
searchInput.addEventListener('compositionstart', function() { isComposing = true; });
searchInput.addEventListener('compositionend', function(e) {
isComposing = false;
var cursorPos = e.target.selectionStart;
searchQuery = e.target.value;
renderMain();
var newInput = document.querySelector('.search-input');
if (newInput) {
newInput.focus();
newInput.setSelectionRange(cursorPos, cursorPos);
}
});
searchInput.addEventListener('input', function(e) {
if (isComposing) return;
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
right.appendChild(h('button', { className: 'btn-primary', onClick: function() { showTaskModal(null); } }, '\uFF0B ' + _t('Add Task')));
}
right.appendChild(h('button', { className: 'btn-fullscreen', onClick: toggleFullscreen, title: _t('Fullscreen') }, '\u26F6'));
toolbar.appendChild(right);
main.appendChild(toolbar);

var ft = dragState && dragFilteredTasks ? dragFilteredTasks : getFilteredTasks();

if (ft.length === 0) {
main.appendChild(h('div', { className: 'empty-tasks' }, _t('No tasks. Add a task to get started.')));
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
h('span', { className: 'tl-h-name' }, _t('Task')),
h('span', { className: 'tl-h-cat' }, _t('Category')),
h('span', { className: 'tl-h-assignee' }, _t('Assign')),
h('span', { className: 'tl-h-progress' }, _t('Progress')),
]));

ft.forEach(function(task) {
var catInfo = getCategoryInfo(task.category);
var row = h('div', {
className: 'tl-row' + (selectedTaskId === task.id ? ' selected' : ''),
onClick: function() {
  var wasSelected = selectedTaskId === task.id;
  selectedTaskId = wasSelected ? null : task.id;
  renderMain();
  if (!wasSelected) scrollToTask(task);
},
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
row.addEventListener('dblclick', function(e) { e.stopPropagation(); if (deckMode) showDeckDetailModal(task); else showTaskModal(task); });
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
}, addDays(range.start, monthStart).toLocaleDateString(_locale, { year: 'numeric', month: 'long' })));
}
curMonth = m;
monthStart = i;
}
}
monthRow.appendChild(h('div', {
className: 'tl-month-cell',
style: { left: monthStart * cellWidth + 'px', width: (totalDays - monthStart) * cellWidth + 'px' },
}, addDays(range.start, monthStart).toLocaleDateString(_locale, { year: 'numeric', month: 'long' })));
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
title: task.title + ' (' + task.startDate + ' \u2192 ' + task.endDate + ')\n' + _t('Progress') + ': ' + task.progress + '%',
});

bar.appendChild(h('div', { className: 'bar-progress', style: { width: task.progress + '%' } }));
bar.appendChild(h('span', { className: 'bar-label' }, task.title));
bar.appendChild(h('div', { className: 'rh rh-l' }));
bar.appendChild(h('div', { className: 'rh rh-r' }));

bar.addEventListener('mousedown', function(e) {
if (e.button !== 0) return;
if (deckMode) {
if (e.target.classList.contains('rh-r')) startDrag(e, task, 'resize-right');
return;
}
if (e.target.classList.contains('rh-l')) startDrag(e, task, 'resize-left');
else if (e.target.classList.contains('rh-r')) startDrag(e, task, 'resize-right');
else startDrag(e, task, 'move');
});

bar.addEventListener('dblclick', function(e) { e.stopPropagation(); if (deckMode) showDeckDetailModal(task); else showTaskModal(task); });
tlBody.appendChild(bar);
});

// Dependency arrows (SVG overlay)
var depSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
depSvg.setAttribute('class', 'dep-svg');
depSvg.setAttribute('width', timelineWidth);
depSvg.setAttribute('height', bodyHeight);
depSvg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';

var ftIndexMap = {};
ft.forEach(function(t, i) { ftIndexMap[t.id] = i; });

ft.forEach(function(task, ri) {
if (!task.dependencyId) return;
var pi = ftIndexMap[task.dependencyId];
if (pi === undefined) return;
var parentTask = ft[pi];

var parentEndOff = daysBetween(range.start, parentTask.endDate);
var childStartOff = daysBetween(range.start, task.startDate);

// Arrow from end of parent bar to start of child bar
var x1 = (parentEndOff + 1) * cellWidth;       // right edge of parent
var y1 = pi * rowHeight + 12 + 16;             // vertical center of parent bar
var x2 = childStartOff * cellWidth;             // left edge of child
var y2 = ri * rowHeight + 12 + 16;             // vertical center of child bar

var midX = x1 + 12;
if (x2 > x1 + 24) midX = (x1 + x2) / 2;

var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
var d;
if (x2 >= x1) {
  // Normal: parent ends before child starts
  d = 'M' + x1 + ',' + y1 + ' L' + midX + ',' + y1 + ' L' + midX + ',' + y2 + ' L' + x2 + ',' + y2;
} else {
  // Overlap: parent bar extends past child start
  var detourY = Math.min(y1, y2) - 20;
  if (pi > ri) detourY = Math.max(y1, y2) + 20;
  d = 'M' + x1 + ',' + y1 + ' L' + (x1 + 12) + ',' + y1 + ' L' + (x1 + 12) + ',' + detourY + ' L' + (x2 - 12) + ',' + detourY + ' L' + (x2 - 12) + ',' + y2 + ' L' + x2 + ',' + y2;
}
path.setAttribute('d', d);
path.setAttribute('class', 'dep-line');
depSvg.appendChild(path);

// Arrowhead
var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
arrow.setAttribute('points', (x2 - 6) + ',' + (y2 - 4) + ' ' + x2 + ',' + y2 + ' ' + (x2 - 6) + ',' + (y2 + 4));
arrow.setAttribute('class', 'dep-arrow');
depSvg.appendChild(arrow);
});

tlBody.appendChild(depSvg);

timeline.appendChild(tlBody);
gantt.appendChild(timeline);
main.appendChild(gantt);

var tlEl = document.getElementById('gantt-timeline');
if (tlEl) tlEl.scrollLeft = scrollLeft;
if (tlEl) tlEl.addEventListener('scroll', function() {
scrollLeft = tlEl.scrollLeft;
// Sync vertical scroll: timeline -> task list
var taskListEl = document.querySelector('.task-list');
if (taskListEl && taskListEl.scrollTop !== tlEl.scrollTop) {
taskListEl.scrollTop = tlEl.scrollTop;
}
});
// Sync vertical scroll: task list -> timeline
var taskListEl = document.querySelector('.task-list');
if (taskListEl) {
taskListEl.addEventListener('scroll', function() {
var tl2 = document.getElementById('gantt-timeline');
if (tl2 && tl2.scrollTop !== taskListEl.scrollTop) {
tl2.scrollTop = taskListEl.scrollTop;
}
});
}
if (pendingScrollTarget) {
  var target = pendingScrollTarget;
  pendingScrollTarget = null;
  requestAnimationFrame(function() { scrollTimelineTo(target); });
}
}

var pendingScrollTarget = null;

function scrollTimelineTo(dayOffset) {
var tlEl = document.getElementById('gantt-timeline');
if (!tlEl) return;
var targetX = dayOffset * cellWidth - tlEl.clientWidth / 3;
tlEl.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
}

function scrollToToday() {
var range = getDateRange();
var today = todayDate();
var offset = daysBetween(range.start, today);
scrollTimelineTo(offset);
}

function scrollToTask(task) {
var range = getDateRange();
var offset = daysBetween(range.start, task.startDate);
scrollTimelineTo(offset);
}

function toggleFullscreen() {
var el = document.getElementById('app-content-gantt') || document.getElementById('gantt-content');
if (!el) return;
if (document.fullscreenElement) {
document.exitFullscreen();
} else {
el.requestFullscreen().catch(function() {});
}
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
e.preventDefault();
dragDateRange = getDateRange();
dragFilteredTasks = getFilteredTasks();
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
dragFilteredTasks = null;
if (changed) {
if (deckMode) { saveDeckCardDuedate(t); } else { saveTaskToServer(t); }
renderMain();
}
});

async function saveDeckCardDuedate(task) {
try {
var cardId = String(task.id).replace('deck-', '');
var duedate = task.endDate + 'T00:00:00+00:00';
await deckApi('/boards/' + currentDeckBoard.id + '/stacks/' + task._stackId + '/cards/' + cardId, 'PUT', {
title: task.title, description: task.description || '', type: 'plain', order: parseInt(task._cardOrder, 10) || 0, duedate: duedate, owner: OC.currentUser
});
} catch (e) { console.error(e); notify(_t('Failed to save')); }
}

function showProjectModal(project) {
var isEdit = !!project;
removeModal();
var overlay = h('div', { className: 'modal-overlay', id: 'gantt-modal' });
overlay.addEventListener('click', function(e) { if (e.target === overlay) removeModal(); });

var dialog = h('div', { className: 'modal-dialog' });
dialog.innerHTML = '<div class="modal-header">'
+ '<h3>' + (isEdit ? _t('Edit Project') : _t('New Project')) + '</h3>'
+ '<button class="modal-close" id="modal-close-btn">\u2715</button>'
+ '</div>'
+ '<div class="modal-body">'
+ '<div class="field"><label>' + _t('Project Name') + '</label>'
+ '<input type="text" id="pf-title" value="' + esc(isEdit ? project.title : '') + '" placeholder="' + _t('Enter project name') + '" /></div>'
+ '<div class="field"><label>' + _t('Description') + '</label>'
+ '<textarea id="pf-desc" rows="2" placeholder="' + _t('Description (optional)') + '">' + esc(isEdit ? (project.description || '') : '') + '</textarea></div>'
+ '<div class="field"><label>' + _t('Color') + '</label>'
+ '<input type="color" id="pf-color" value="' + (isEdit ? (project.color || '#0082c9') : '#0082c9') + '" /></div>'
+ '</div>'
+ '<div class="modal-footer">'
+ '<button class="btn-cancel" id="pf-cancel">' + _t('Cancel') + '</button>'
+ '<button class="btn-primary" id="pf-save">' + _t('Save') + '</button>'
+ '</div>';
overlay.appendChild(dialog);
document.body.appendChild(overlay);

document.getElementById('modal-close-btn').onclick = removeModal;
document.getElementById('pf-cancel').onclick = removeModal;
document.getElementById('pf-save').onclick = async function() {
var title = document.getElementById('pf-title').value.trim();
if (!title) { notify(_t('Please enter a project name')); return; }
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
notify(isEdit ? _t('Project updated') : _t('Project created'));
} catch (e) { console.error(e); notify(_t('Failed to save')); }
};
document.getElementById('pf-title').focus();
}

function showDeckDetailModal(task, editMode) {
removeModal();
var cardId = String(task.id).replace('deck-', '');
var catInfo = getCategoryInfo(task.category);
var isEditing = !!editMode;

var overlay = h('div', { className: 'modal-overlay', id: 'gantt-modal' });
overlay.addEventListener('click', function(e) { if (e.target === overlay) removeModal(); });

var dialog = h('div', { className: 'modal-dialog modal-wide' });

if (!isEditing) {
// Preview mode
dialog.innerHTML = '<div class="modal-header">'
+ '<h3>' + _t('Task Details') + '</h3>'
+ '<button class="modal-close" id="modal-close-btn">\u2715</button>'
+ '</div>'
+ '<div class="modal-body">'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Task Name') + '</span><span class="deck-detail-value">' + esc(task.title) + '</span></div>'
+ (task.description ? '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Description') + '</span><div class="deck-detail-value deck-detail-desc">' + simpleMd(task.description) + '</div></div>' : '')
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Category') + '</span><span class="deck-detail-value"><span class="cat-badge" style="background:' + catInfo.color + '22;color:' + catInfo.color + ';border-color:' + catInfo.color + '">' + esc(catInfo.label) + '</span></span></div>'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Assignee') + '</span><span class="deck-detail-value">' + esc(task.assignee || _t('None')) + '</span></div>'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Start Date') + '</span><span class="deck-detail-value">' + task.startDate + '</span></div>'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Due Date') + '</span><span class="deck-detail-value">' + task.endDate + '</span></div>'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Progress') + '</span><span class="deck-detail-value">' + task.progress + '%</span></div>'
+ '</div>'
+ '<div class="modal-footer">'
+ '<a class="btn-secondary" id="deck-open-btn" href="' + OC.generateUrl('/apps/deck') + '/#/board/' + (currentDeckBoard ? currentDeckBoard.id : '') + '/card/' + cardId + '" target="_blank">' + _t('Open in Deck') + '</a>'
+ '<div class="modal-footer-right">'
+ '<button class="btn-cancel" id="deck-close-btn">' + _t('Close') + '</button>'
+ '<button class="btn-primary" id="deck-edit-btn">' + _t('Edit') + '</button>'
+ '</div></div>';
overlay.appendChild(dialog);
document.body.appendChild(overlay);
document.getElementById('modal-close-btn').onclick = removeModal;
document.getElementById('deck-close-btn').onclick = removeModal;
document.getElementById('deck-edit-btn').onclick = function() { showDeckDetailModal(task, true); };
} else {
// Edit mode
dialog.innerHTML = '<div class="modal-header">'
+ '<h3>' + _t('Edit Task') + '</h3>'
+ '<button class="modal-close" id="modal-close-btn">\u2715</button>'
+ '</div>'
+ '<div class="modal-body">'
+ '<div class="field"><label>' + _t('Task Name') + ' <span class="required">*</span></label>'
+ '<input type="text" id="dk-title" value="' + esc(task.title) + '" /></div>'
+ '<div class="field"><label>' + _t('Description') + '</label>'
+ '<textarea id="dk-desc" rows="4">' + esc(task.description || '') + '</textarea></div>'
+ '<div class="field-row">'
+ '<div class="field"><label>' + _t('Due Date') + '</label>'
+ '<input type="date" id="dk-due" value="' + task.endDate + '" /></div>'
+ '<div class="field"><label>' + _t('Category') + '</label>'
+ '<span class="cat-badge" style="background:' + catInfo.color + '22;color:' + catInfo.color + ';border-color:' + catInfo.color + '">' + esc(catInfo.label) + '</span></div>'
+ '</div>'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Assignee') + '</span><span class="deck-detail-value">' + esc(task.assignee || _t('None')) + '</span></div>'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Progress') + '</span><span class="deck-detail-value">' + task.progress + '%</span></div>'
+ '</div>'
+ '<div class="modal-footer">'
+ '<a class="btn-secondary" id="deck-open-btn" href="' + OC.generateUrl('/apps/deck') + '/#/board/' + (currentDeckBoard ? currentDeckBoard.id : '') + '/card/' + cardId + '" target="_blank">' + _t('Open in Deck') + '</a>'
+ '<div class="modal-footer-right">'
+ '<button class="btn-cancel" id="deck-close-btn">' + _t('Cancel') + '</button>'
+ '<button class="btn-primary" id="deck-save-btn">' + _t('Save') + '</button>'
+ '</div></div>';
overlay.appendChild(dialog);
document.body.appendChild(overlay);
document.getElementById('modal-close-btn').onclick = removeModal;
document.getElementById('deck-close-btn').onclick = removeModal;
document.getElementById('deck-save-btn').onclick = async function() {
var title = document.getElementById('dk-title').value.trim();
if (!title) { notify(_t('Please enter a task name')); return; }
var desc = document.getElementById('dk-desc').value;
var dueVal = document.getElementById('dk-due').value;
var duedate = dueVal ? dueVal + 'T00:00:00+00:00' : null;
try {
await deckApi('/boards/' + currentDeckBoard.id + '/stacks/' + task._stackId + '/cards/' + cardId, 'PUT', {
title: title, description: desc || '', type: 'plain', order: parseInt(task._cardOrder, 10) || 0, duedate: duedate, owner: OC.currentUser
});
task.title = title;
task.description = desc;
if (dueVal) task.endDate = dueVal;
removeModal();
renderMain();
notify(_t('Task updated'));
} catch (e) { console.error(e); notify(_t('Failed to save')); }
};
document.getElementById('dk-title').focus();
}
}

function showTaskModal(task, editMode) {
var isEdit = !!task;
var isEditing = !isEdit || !!editMode;
removeModal();

if (isEdit && !isEditing) {
// Preview mode for existing tasks
var catInfo = getCategoryInfo(task.category);
var depTask = task.dependencyId ? tasks.find(function(t) { return t.id === task.dependencyId; }) : null;

var overlay = h('div', { className: 'modal-overlay', id: 'gantt-modal' });
overlay.addEventListener('click', function(e) { if (e.target === overlay) removeModal(); });
var dialog = h('div', { className: 'modal-dialog modal-wide' });
dialog.innerHTML = '<div class="modal-header">'
+ '<h3>' + _t('Task Details') + '</h3>'
+ '<button class="modal-close" id="modal-close-btn">\u2715</button>'
+ '</div>'
+ '<div class="modal-body">'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Task Name') + '</span><span class="deck-detail-value">' + esc(task.title) + '</span></div>'
+ (task.description ? '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Description') + '</span><div class="deck-detail-value deck-detail-desc">' + simpleMd(task.description) + '</div></div>' : '')
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Category') + '</span><span class="deck-detail-value"><span class="cat-badge" style="background:' + catInfo.color + '22;color:' + catInfo.color + ';border-color:' + catInfo.color + '">' + esc(catInfo.label) + '</span></span></div>'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Assignee') + '</span><span class="deck-detail-value">' + esc(task.assignee || _t('None')) + '</span></div>'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Start Date') + '</span><span class="deck-detail-value">' + task.startDate + '</span></div>'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('End Date') + '</span><span class="deck-detail-value">' + task.endDate + '</span></div>'
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Progress') + '</span><span class="deck-detail-value">'
+ '<div class="progress-mini" style="width:120px;display:inline-block;vertical-align:middle;margin-right:8px"><div class="progress-mini-fill" style="width:' + task.progress + '%;background:' + catInfo.color + '"></div></div>'
+ task.progress + '%</span></div>'
+ (depTask ? '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Dependency') + '</span><span class="deck-detail-value">' + esc(depTask.title) + '</span></div>' : '')
+ '<div class="deck-detail-row"><span class="deck-detail-label">' + _t('Color') + '</span><span class="deck-detail-value"><span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:' + (task.color || catInfo.color) + ';vertical-align:middle"></span></span></div>'
+ '</div>'
+ '<div class="modal-footer">'
+ '<button class="btn-danger" id="tf-delete">' + _t('Delete') + '</button>'
+ '<div class="modal-footer-right">'
+ '<button class="btn-cancel" id="tf-close">' + _t('Close') + '</button>'
+ '<button class="btn-primary" id="tf-edit-btn">' + _t('Edit') + '</button>'
+ '</div></div>';
overlay.appendChild(dialog);
document.body.appendChild(overlay);
document.getElementById('modal-close-btn').onclick = removeModal;
document.getElementById('tf-close').onclick = removeModal;
document.getElementById('tf-edit-btn').onclick = function() { showTaskModal(task, true); };
document.getElementById('tf-delete').onclick = function() { removeModal(); deleteTask(task); };
return;
}

// Edit mode (new task or editing existing)
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
+ '<h3>' + (isEdit ? _t('Edit Task') : _t('New Task')) + '</h3>'
+ '<button class="modal-close" id="modal-close-btn">\u2715</button>'
+ '</div>'
+ '<div class="modal-body">'
+ '<div class="field"><label>' + _t('Task Name') + ' <span class="required">*</span></label>'
+ '<input type="text" id="tf-title" value="' + esc(isEdit ? task.title : '') + '" placeholder="' + _t('Enter task name') + '" /></div>'
+ '<div class="field"><label>' + _t('Description') + '</label>'
+ '<textarea id="tf-desc" rows="2" placeholder="' + _t('Description (optional)') + '">' + esc(isEdit ? (task.description || '') : '') + '</textarea></div>'
+ '<div class="field-row">'
+ '<div class="field"><label>' + _t('Start Date') + ' <span class="required">*</span></label>'
+ '<input type="date" id="tf-start" value="' + (isEdit ? task.startDate : todayStr) + '" /></div>'
+ '<div class="field"><label>' + _t('End Date') + ' <span class="required">*</span></label>'
+ '<input type="date" id="tf-end" value="' + (isEdit ? task.endDate : nextW) + '" /></div>'
+ '</div>'
+ '<div class="field-row">'
+ '<div class="field"><label>' + _t('Category') + '</label>'
+ '<input type="text" id="tf-cat" list="cat-datalist" value="' + esc(isEdit ? (task.category || '') : '') + '" placeholder="' + _t('e.g. Development, Planning, Design...') + '" />'
+ '<datalist id="cat-datalist">' + catDatalist + '</datalist></div>'
+ '<div class="field"><label>' + _t('Assignee') + '</label>'
+ '<input type="text" id="tf-assignee" value="' + esc(isEdit ? (task.assignee || '') : '') + '" placeholder="' + _t('Assignee name') + '" /></div>'
+ '</div>'
+ '<div class="field"><label>' + _t('Progress') + ' <span class="progress-val" id="tf-pct-val">' + (isEdit ? task.progress : 0) + '%</span></label>'
+ '<input type="range" id="tf-progress" min="0" max="100" value="' + (isEdit ? task.progress : 0) + '" class="progress-slider" />'
+ '<div class="progress-bar-preview"><div class="progress-bar-fill" id="tf-pbar" style="width:' + (isEdit ? task.progress : 0) + '%"></div></div></div>'
+ '<div class="field-row">'
+ '<div class="field"><label>' + _t('Dependency') + '</label>'
+ '<select id="tf-dep"><option value="">' + _t('None') + '</option>' + depOptions + '</select></div>'
+ '<div class="field"><label>' + _t('Color') + '</label>'
+ '<input type="color" id="tf-color" value="' + (isEdit ? (task.color || '#6366f1') : '#6366f1') + '" /></div>'
+ '</div>'
+ '</div>'
+ '<div class="modal-footer">'
+ (isEdit ? '<button class="btn-danger" id="tf-delete">' + _t('Delete') + '</button>' : '')
+ '<div class="modal-footer-right">'
+ '<button class="btn-cancel" id="tf-cancel">' + _t('Cancel') + '</button>'
+ '<button class="btn-primary" id="tf-save">' + _t('Save') + '</button>'
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
if (!title) { notify(_t('Please enter a task name')); return; }
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
notify(_t('Task updated'));
} else {
var nw = await api('POST', '/api/projects/' + currentProject.id + '/tasks', data);
tasks.push(nw);
notify(_t('Task created'));
}
removeModal();
renderMain();
} catch (e) { console.error(e); notify(_t('Failed to save')); }
};
document.getElementById('tf-title').focus();
}

function removeModal() {
var m = document.getElementById('gantt-modal');
if (m) m.remove();
}

async function loadProjects() {
try { projects = await api('GET', '/api/projects'); renderSidebar(); }
catch (e) { console.error(e); notify(_t('Failed to load')); }
}

async function selectProject(p) {
deckMode = false;
currentDeckBoard = null;
currentProject = p;
renderSidebar();
try { tasks = await api('GET', '/api/projects/' + p.id + '/tasks'); }
catch (e) { console.error(e); tasks = []; notify(_t('Failed to load tasks')); }
renderMain();
}

async function deleteProject(p) {
showConfirmModal(
_t('Delete Project'),
_t('Delete project "{title}" and all tasks? This cannot be undone.', { title: p.title }),
_t('Delete'),
async function() {
try {
await api('DELETE', '/api/projects/' + p.id);
projects = projects.filter(function(x) { return x.id !== p.id; });
if (currentProject && currentProject.id === p.id) { currentProject = null; tasks = []; }
renderSidebar(); renderMain();
notify(_t('Project deleted'));
} catch (e) { console.error(e); notify(_t('Failed to delete')); }
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
notify(_t('Failed to save'));
tasks = await api('GET', '/api/projects/' + currentProject.id + '/tasks');
renderMain();
}
}

async function deleteTask(task) {
showConfirmModal(
_t('Delete Task'),
_t('Delete task "{title}"? This cannot be undone.', { title: task.title }),
_t('Delete'),
async function() {
try {
await api('DELETE', '/api/projects/' + currentProject.id + '/tasks/' + task.id);
tasks = tasks.filter(function(t) { return t.id !== task.id; });
if (selectedTaskId === task.id) selectedTaskId = null;
renderMain();
notify(_t('Task deleted'));
} catch (e) { console.error(e); notify(_t('Failed to delete')); }
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
footer.appendChild(h('button', { className: 'btn-cancel', onClick: removeModal }, _t('Cancel')));
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
