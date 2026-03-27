<template>
	<div class="gantt-chart" ref="ganttChart">
		<div v-if="tasks.length === 0" class="gantt-empty">
			<p>{{ t('gantt', 'No tasks yet. Add a task to get started.') }}</p>
		</div>
		<div v-else class="gantt-wrapper">
			<!-- View controls -->
			<div class="gantt-controls">
				<div class="view-buttons">
					<button
						v-for="view in views"
						:key="view.key"
						:class="['view-btn', { active: currentView === view.key }]"
						@click="currentView = view.key">
						{{ view.label }}
					</button>
				</div>
				<div class="zoom-controls">
					<button class="zoom-btn" @click="zoomIn">+</button>
					<button class="zoom-btn" @click="zoomOut">−</button>
					<button class="zoom-btn" @click="scrollToToday">{{ t('gantt', 'Today') }}</button>
				</div>
			</div>

			<div class="gantt-body" ref="ganttBody">
				<!-- Task list (left panel) -->
				<div class="gantt-task-list">
					<div class="gantt-task-list-header">
						<span class="task-name-col">{{ t('gantt', 'Task') }}</span>
						<span class="task-date-col">{{ t('gantt', 'Start') }}</span>
						<span class="task-date-col">{{ t('gantt', 'End') }}</span>
						<span class="task-progress-col">%</span>
						<span class="task-actions-col"></span>
					</div>
					<div
						v-for="task in tasks"
						:key="task.id"
						class="gantt-task-list-row"
						:class="{ 'is-selected': selectedTask && selectedTask.id === task.id }"
						@click="selectTask(task)">
						<span class="task-name-col" :title="task.title">
							<span class="task-color-indicator" :style="{ backgroundColor: task.color }" />
							{{ task.title }}
						</span>
						<span class="task-date-col">{{ formatDateShort(task.startDate) }}</span>
						<span class="task-date-col">{{ formatDateShort(task.endDate) }}</span>
						<span class="task-progress-col">{{ task.progress }}%</span>
						<span class="task-actions-col">
							<button class="icon-btn" @click.stop="$emit('edit-task', task)" :title="t('gantt', 'Edit')">✎</button>
							<button class="icon-btn delete-btn" @click.stop="$emit('delete-task', task)" :title="t('gantt', 'Delete')">✕</button>
						</span>
					</div>
				</div>

				<!-- Timeline (right panel) -->
				<div class="gantt-timeline" ref="timeline" @scroll="onTimelineScroll">
					<!-- Timeline header -->
					<div class="gantt-timeline-header" :style="{ width: timelineWidth + 'px' }">
						<div class="timeline-header-top">
							<div
								v-for="(period, index) in topHeaderPeriods"
								:key="'top-' + index"
								class="timeline-header-cell top-cell"
								:style="{ width: period.width + 'px', left: period.left + 'px' }">
								{{ period.label }}
							</div>
						</div>
						<div class="timeline-header-bottom">
							<div
								v-for="(unit, index) in timelineUnits"
								:key="'unit-' + index"
								class="timeline-header-cell bottom-cell"
								:class="{ weekend: unit.isWeekend, today: unit.isToday }"
								:style="{ width: cellWidth + 'px', left: index * cellWidth + 'px' }">
								{{ unit.label }}
							</div>
						</div>
					</div>

					<!-- Timeline body -->
					<div class="gantt-timeline-body" :style="{ width: timelineWidth + 'px' }">
						<!-- Grid lines -->
						<div class="gantt-grid">
							<div
								v-for="(unit, index) in timelineUnits"
								:key="'grid-' + index"
								class="grid-cell"
								:class="{ weekend: unit.isWeekend, today: unit.isToday }"
								:style="{ width: cellWidth + 'px', left: index * cellWidth + 'px', height: tasks.length * rowHeight + 'px' }" />
						</div>

						<!-- Today marker -->
						<div
							v-if="todayPosition >= 0"
							class="today-marker"
							:style="{ left: todayPosition + 'px', height: tasks.length * rowHeight + 'px' }" />

						<!-- Task bars -->
						<div
							v-for="(task, rowIndex) in tasks"
							:key="'bar-' + task.id"
							class="gantt-bar-row"
							:style="{ top: rowIndex * rowHeight + 'px', height: rowHeight + 'px' }">
							<!-- Dependency line -->
							<svg
								v-if="task.dependencyId && getDependencyLine(task)"
								class="dependency-line"
								:style="{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }">
								<path
									:d="getDependencyLine(task)"
									fill="none"
									stroke="var(--color-primary)"
									stroke-width="1.5"
									stroke-dasharray="4,2"
									marker-end="url(#arrowhead)" />
								<defs>
									<marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
										<polygon points="0 0, 8 3, 0 6" fill="var(--color-primary)" />
									</marker>
								</defs>
							</svg>

							<div
								class="gantt-bar"
								:class="{ 'is-selected': selectedTask && selectedTask.id === task.id }"
								:style="getBarStyle(task)"
								:title="getBarTooltip(task)"
								@mousedown="onBarMouseDown($event, task, 'move')"
								@click.stop="selectTask(task)">

								<!-- Progress fill -->
								<div class="gantt-bar-progress" :style="{ width: task.progress + '%' }" />

								<!-- Label -->
								<span class="gantt-bar-label">{{ task.title }}</span>

								<!-- Resize handles -->
								<div class="resize-handle resize-handle-left" @mousedown.stop="onBarMouseDown($event, task, 'resize-left')" />
								<div class="resize-handle resize-handle-right" @mousedown.stop="onBarMouseDown($event, task, 'resize-right')" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
export default {
	name: 'GanttChart',

	props: {
		tasks: {
			type: Array,
			required: true,
		},
	},

	data() {
		return {
			currentView: 'day',
			cellWidth: 40,
			rowHeight: 40,
			selectedTask: null,
			dragState: null,
			views: [
				{ key: 'day', label: this.t('gantt', 'Day') },
				{ key: 'week', label: this.t('gantt', 'Week') },
				{ key: 'month', label: this.t('gantt', 'Month') },
			],
		}
	},

	computed: {
		dateRange() {
			if (this.tasks.length === 0) {
				const today = new Date()
				const end = new Date()
				end.setDate(today.getDate() + 30)
				return { start: today, end }
			}

			let minDate = new Date(this.tasks[0].startDate)
			let maxDate = new Date(this.tasks[0].endDate)

			this.tasks.forEach(task => {
				const start = new Date(task.startDate)
				const end = new Date(task.endDate)
				if (start < minDate) minDate = start
				if (end > maxDate) maxDate = end
			})

			// Add padding
			const padding = this.currentView === 'month' ? 30 : (this.currentView === 'week' ? 14 : 7)
			const start = new Date(minDate)
			start.setDate(start.getDate() - padding)
			const end = new Date(maxDate)
			end.setDate(end.getDate() + padding)

			return { start, end }
		},

		timelineUnits() {
			const units = []
			const current = new Date(this.dateRange.start)
			const end = this.dateRange.end
			const today = new Date()
			today.setHours(0, 0, 0, 0)

			if (this.currentView === 'day') {
				while (current <= end) {
					const d = new Date(current)
					const dayOfWeek = d.getDay()
					units.push({
						date: d,
						label: d.getDate().toString(),
						isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
						isToday: d.getTime() === today.getTime(),
					})
					current.setDate(current.getDate() + 1)
				}
			} else if (this.currentView === 'week') {
				while (current <= end) {
					const d = new Date(current)
					const weekStart = new Date(d)
					weekStart.setDate(d.getDate() - d.getDay())
					units.push({
						date: d,
						label: 'W' + this.getWeekNumber(d),
						isWeekend: false,
						isToday: d.getTime() >= today.getTime() && d.getTime() < today.getTime() + 7 * 86400000,
					})
					current.setDate(current.getDate() + 7)
				}
			} else {
				while (current <= end) {
					const d = new Date(current)
					units.push({
						date: d,
						label: d.toLocaleString('default', { month: 'short' }),
						isWeekend: false,
						isToday: d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(),
					})
					current.setMonth(current.getMonth() + 1)
				}
			}

			return units
		},

		topHeaderPeriods() {
			const periods = []
			if (this.currentView === 'day') {
				let currentMonth = null
				let startIdx = 0
				this.timelineUnits.forEach((unit, idx) => {
					const month = unit.date.getMonth() + '-' + unit.date.getFullYear()
					if (month !== currentMonth) {
						if (currentMonth !== null) {
							periods.push({
								label: this.timelineUnits[startIdx].date.toLocaleString('default', { month: 'long', year: 'numeric' }),
								left: startIdx * this.cellWidth,
								width: (idx - startIdx) * this.cellWidth,
							})
						}
						currentMonth = month
						startIdx = idx
					}
				})
				if (currentMonth !== null) {
					periods.push({
						label: this.timelineUnits[startIdx].date.toLocaleString('default', { month: 'long', year: 'numeric' }),
						left: startIdx * this.cellWidth,
						width: (this.timelineUnits.length - startIdx) * this.cellWidth,
					})
				}
			} else if (this.currentView === 'week') {
				let currentYear = null
				let startIdx = 0
				this.timelineUnits.forEach((unit, idx) => {
					const year = unit.date.getFullYear().toString()
					if (year !== currentYear) {
						if (currentYear !== null) {
							periods.push({
								label: currentYear,
								left: startIdx * this.cellWidth,
								width: (idx - startIdx) * this.cellWidth,
							})
						}
						currentYear = year
						startIdx = idx
					}
				})
				if (currentYear !== null) {
					periods.push({
						label: currentYear,
						left: startIdx * this.cellWidth,
						width: (this.timelineUnits.length - startIdx) * this.cellWidth,
					})
				}
			} else {
				let currentYear = null
				let startIdx = 0
				this.timelineUnits.forEach((unit, idx) => {
					const year = unit.date.getFullYear().toString()
					if (year !== currentYear) {
						if (currentYear !== null) {
							periods.push({
								label: currentYear,
								left: startIdx * this.cellWidth,
								width: (idx - startIdx) * this.cellWidth,
							})
						}
						currentYear = year
						startIdx = idx
					}
				})
				if (currentYear !== null) {
					periods.push({
						label: currentYear,
						left: startIdx * this.cellWidth,
						width: (this.timelineUnits.length - startIdx) * this.cellWidth,
					})
				}
			}
			return periods
		},

		timelineWidth() {
			return this.timelineUnits.length * this.cellWidth
		},

		todayPosition() {
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			return this.dateToPosition(today)
		},
	},

	watch: {
		currentView() {
			this.updateCellWidth()
		},
	},

	mounted() {
		this.updateCellWidth()
		document.addEventListener('mousemove', this.onMouseMove)
		document.addEventListener('mouseup', this.onMouseUp)
	},

	beforeDestroy() {
		document.removeEventListener('mousemove', this.onMouseMove)
		document.removeEventListener('mouseup', this.onMouseUp)
	},

	methods: {
		t(app, text) {
			return window.t ? window.t(app, text) : text
		},

		updateCellWidth() {
			switch (this.currentView) {
			case 'day':
				this.cellWidth = 40
				break
			case 'week':
				this.cellWidth = 80
				break
			case 'month':
				this.cellWidth = 120
				break
			}
		},

		getWeekNumber(date) {
			const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
			const dayNum = d.getUTCDay() || 7
			d.setUTCDate(d.getUTCDate() + 4 - dayNum)
			const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
			return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
		},

		dateToPosition(date) {
			const d = new Date(date)
			d.setHours(0, 0, 0, 0)
			const start = new Date(this.dateRange.start)
			start.setHours(0, 0, 0, 0)

			if (this.currentView === 'day') {
				const diffDays = (d - start) / (1000 * 60 * 60 * 24)
				return diffDays * this.cellWidth
			} else if (this.currentView === 'week') {
				const diffDays = (d - start) / (1000 * 60 * 60 * 24)
				return (diffDays / 7) * this.cellWidth
			} else {
				const monthsDiff = (d.getFullYear() - start.getFullYear()) * 12
					+ (d.getMonth() - start.getMonth())
					+ (d.getDate() - 1) / 30
				return monthsDiff * this.cellWidth
			}
		},

		positionToDate(position) {
			const start = new Date(this.dateRange.start)
			start.setHours(0, 0, 0, 0)

			if (this.currentView === 'day') {
				const days = position / this.cellWidth
				const result = new Date(start)
				result.setDate(result.getDate() + Math.round(days))
				return result
			} else if (this.currentView === 'week') {
				const weeks = position / this.cellWidth
				const result = new Date(start)
				result.setDate(result.getDate() + Math.round(weeks * 7))
				return result
			} else {
				const months = position / this.cellWidth
				const result = new Date(start)
				result.setMonth(result.getMonth() + Math.round(months))
				return result
			}
		},

		getBarStyle(task) {
			const startPos = this.dateToPosition(task.startDate)
			const endPos = this.dateToPosition(task.endDate)
			const width = Math.max(endPos - startPos, this.cellWidth / 2)

			return {
				left: startPos + 'px',
				width: width + 'px',
				backgroundColor: task.color || '#0082c9',
			}
		},

		getBarTooltip(task) {
			return `${task.title}\n${task.startDate} → ${task.endDate}\n${this.t('gantt', 'Progress')}: ${task.progress}%`
		},

		formatDateShort(dateStr) {
			if (!dateStr) return ''
			const d = new Date(dateStr)
			return `${d.getMonth() + 1}/${d.getDate()}`
		},

		selectTask(task) {
			this.selectedTask = this.selectedTask && this.selectedTask.id === task.id ? null : task
		},

		getDependencyLine(task) {
			if (!task.dependencyId) return null
			const depIndex = this.tasks.findIndex(t => t.id === task.dependencyId)
			const taskIndex = this.tasks.findIndex(t => t.id === task.id)
			if (depIndex === -1) return null

			const depTask = this.tasks[depIndex]
			const depEndPos = this.dateToPosition(depTask.endDate)
			const taskStartPos = this.dateToPosition(task.startDate)

			const depY = depIndex * this.rowHeight + this.rowHeight / 2
			const taskY = taskIndex * this.rowHeight + this.rowHeight / 2
			const midX = (depEndPos + taskStartPos) / 2

			return `M ${depEndPos} ${depY} C ${midX} ${depY}, ${midX} ${taskY}, ${taskStartPos} ${taskY}`
		},

		zoomIn() {
			this.cellWidth = Math.min(this.cellWidth + 10, 200)
		},

		zoomOut() {
			this.cellWidth = Math.max(this.cellWidth - 10, 20)
		},

		scrollToToday() {
			const pos = this.todayPosition
			if (this.$refs.timeline && pos >= 0) {
				this.$refs.timeline.scrollLeft = pos - this.$refs.timeline.clientWidth / 2
			}
		},

		onTimelineScroll() {
			// Sync scroll if needed
		},

		onBarMouseDown(event, task, mode) {
			event.preventDefault()
			this.dragState = {
				task,
				mode,
				startX: event.clientX,
				originalStartDate: task.startDate,
				originalEndDate: task.endDate,
				startPos: this.dateToPosition(task.startDate),
				endPos: this.dateToPosition(task.endDate),
			}
		},

		onMouseMove(event) {
			if (!this.dragState) return
			event.preventDefault()

			const dx = event.clientX - this.dragState.startX
			const { task, mode, startPos, endPos } = this.dragState

			if (mode === 'move') {
				const newStartDate = this.positionToDate(startPos + dx)
				const newEndDate = this.positionToDate(endPos + dx)
				task.startDate = this.formatISODate(newStartDate)
				task.endDate = this.formatISODate(newEndDate)
			} else if (mode === 'resize-left') {
				const newStartDate = this.positionToDate(startPos + dx)
				task.startDate = this.formatISODate(newStartDate)
			} else if (mode === 'resize-right') {
				const newEndDate = this.positionToDate(endPos + dx)
				task.endDate = this.formatISODate(newEndDate)
			}
		},

		onMouseUp() {
			if (this.dragState) {
				const task = this.dragState.task
				if (task.startDate !== this.dragState.originalStartDate
					|| task.endDate !== this.dragState.originalEndDate) {
					this.$emit('update-task', { ...task })
				}
				this.dragState = null
			}
		},

		formatISODate(date) {
			const d = date instanceof Date ? date : new Date(date)
			const year = d.getFullYear()
			const month = String(d.getMonth() + 1).padStart(2, '0')
			const day = String(d.getDate()).padStart(2, '0')
			return `${year}-${month}-${day}`
		},
	},
}
</script>

<style scoped>
.gantt-chart {
	width: 100%;
	height: calc(100vh - 200px);
	display: flex;
	flex-direction: column;
}

.gantt-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 200px;
	color: var(--color-text-maxcontrast);
}

.gantt-wrapper {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.gantt-controls {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 0;
	margin-bottom: 8px;
}

.view-buttons {
	display: flex;
	gap: 4px;
}

.view-btn {
	padding: 6px 14px;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-pill);
	background: var(--color-main-background);
	color: var(--color-main-text);
	cursor: pointer;
	font-size: 13px;
}

.view-btn.active {
	background: var(--color-primary);
	color: var(--color-primary-text);
	border-color: var(--color-primary);
}

.view-btn:hover:not(.active) {
	background: var(--color-background-hover);
}

.zoom-controls {
	display: flex;
	gap: 4px;
}

.zoom-btn {
	padding: 6px 12px;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius);
	background: var(--color-main-background);
	color: var(--color-main-text);
	cursor: pointer;
	font-size: 13px;
}

.zoom-btn:hover {
	background: var(--color-background-hover);
}

.gantt-body {
	display: flex;
	flex: 1;
	overflow: hidden;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius);
}

/* Task list (left panel) */
.gantt-task-list {
	min-width: 360px;
	max-width: 360px;
	border-right: 2px solid var(--color-border);
	overflow-y: auto;
	background: var(--color-main-background);
}

.gantt-task-list-header {
	display: flex;
	align-items: center;
	height: 60px;
	padding: 0 8px;
	border-bottom: 1px solid var(--color-border);
	background: var(--color-background-dark);
	font-weight: bold;
	font-size: 12px;
	position: sticky;
	top: 0;
	z-index: 2;
}

.gantt-task-list-row {
	display: flex;
	align-items: center;
	height: 40px;
	padding: 0 8px;
	border-bottom: 1px solid var(--color-border-dark);
	cursor: pointer;
	font-size: 13px;
}

.gantt-task-list-row:hover {
	background: var(--color-background-hover);
}

.gantt-task-list-row.is-selected {
	background: var(--color-primary-element-light);
}

.task-name-col {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	display: flex;
	align-items: center;
	gap: 6px;
}

.task-color-indicator {
	display: inline-block;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}

.task-date-col {
	width: 50px;
	text-align: center;
	font-size: 11px;
	color: var(--color-text-maxcontrast);
}

.task-progress-col {
	width: 36px;
	text-align: center;
	font-size: 11px;
	color: var(--color-text-maxcontrast);
}

.task-actions-col {
	width: 50px;
	display: flex;
	gap: 2px;
	justify-content: flex-end;
}

.icon-btn {
	border: none;
	background: none;
	cursor: pointer;
	padding: 4px;
	border-radius: var(--border-radius);
	color: var(--color-text-maxcontrast);
	font-size: 14px;
	line-height: 1;
}

.icon-btn:hover {
	background: var(--color-background-hover);
	color: var(--color-main-text);
}

.delete-btn:hover {
	color: var(--color-error);
}

/* Timeline (right panel) */
.gantt-timeline {
	flex: 1;
	overflow: auto;
	position: relative;
}

.gantt-timeline-header {
	position: sticky;
	top: 0;
	z-index: 2;
	background: var(--color-background-dark);
	border-bottom: 1px solid var(--color-border);
	height: 60px;
}

.timeline-header-top {
	position: relative;
	height: 28px;
	border-bottom: 1px solid var(--color-border-dark);
}

.timeline-header-bottom {
	position: relative;
	height: 31px;
}

.timeline-header-cell {
	position: absolute;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	color: var(--color-text-maxcontrast);
	border-right: 1px solid var(--color-border-dark);
	user-select: none;
}

.top-cell {
	font-weight: bold;
	font-size: 12px;
	color: var(--color-main-text);
}

.bottom-cell.weekend {
	background: var(--color-background-dark);
}

.bottom-cell.today {
	background: var(--color-primary-element-light);
	font-weight: bold;
	color: var(--color-primary);
}

/* Timeline body */
.gantt-timeline-body {
	position: relative;
	min-height: 200px;
}

.gantt-grid {
	position: absolute;
	top: 0;
	left: 0;
}

.grid-cell {
	position: absolute;
	top: 0;
	border-right: 1px solid var(--color-border-dark);
}

.grid-cell.weekend {
	background: rgba(0, 0, 0, 0.02);
}

.grid-cell.today {
	background: rgba(0, 130, 201, 0.05);
}

.today-marker {
	position: absolute;
	top: 0;
	width: 2px;
	background: var(--color-error);
	z-index: 1;
	pointer-events: none;
}

/* Gantt bars */
.gantt-bar-row {
	position: absolute;
	left: 0;
	right: 0;
}

.gantt-bar {
	position: absolute;
	top: 8px;
	height: 24px;
	border-radius: 4px;
	cursor: grab;
	overflow: hidden;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	transition: box-shadow 0.15s ease;
	z-index: 1;
	display: flex;
	align-items: center;
}

.gantt-bar:hover {
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
	z-index: 2;
}

.gantt-bar.is-selected {
	box-shadow: 0 0 0 2px var(--color-primary), 0 2px 6px rgba(0, 0, 0, 0.25);
	z-index: 3;
}

.gantt-bar:active {
	cursor: grabbing;
}

.gantt-bar-progress {
	position: absolute;
	top: 0;
	left: 0;
	height: 100%;
	background: rgba(0, 0, 0, 0.15);
	border-radius: 4px 0 0 4px;
	pointer-events: none;
}

.gantt-bar-label {
	position: relative;
	z-index: 1;
	padding: 0 8px;
	font-size: 11px;
	color: white;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.resize-handle {
	position: absolute;
	top: 0;
	width: 6px;
	height: 100%;
	cursor: col-resize;
	z-index: 2;
}

.resize-handle-left {
	left: 0;
}

.resize-handle-right {
	right: 0;
}

.resize-handle:hover {
	background: rgba(255, 255, 255, 0.3);
}

.dependency-line {
	z-index: 0;
}
</style>
