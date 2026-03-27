<template>
	<NcContent app-name="gantt">
		<NcAppNavigation>
			<template #list>
				<NcAppNavigationNewItem
					:title="t('gantt', 'New project')"
					@new-item="onNewProject">
					<template #icon>
						<PlusIcon :size="20" />
					</template>
				</NcAppNavigationNewItem>
				<NcAppNavigationItem
					v-for="project in projects"
					:key="project.id"
					:name="project.title"
					:class="{ active: currentProject && currentProject.id === project.id }"
					@click="selectProject(project)">
					<template #actions>
						<NcActionButton @click="editProject(project)">
							<template #icon>
								<PencilIcon :size="20" />
							</template>
							{{ t('gantt', 'Edit') }}
						</NcActionButton>
						<NcActionButton @click="deleteProject(project)">
							<template #icon>
								<DeleteIcon :size="20" />
							</template>
							{{ t('gantt', 'Delete') }}
						</NcActionButton>
					</template>
					<template #icon>
						<span class="project-color-dot" :style="{ backgroundColor: project.color }" />
					</template>
				</NcAppNavigationItem>
			</template>
		</NcAppNavigation>

		<NcAppContent>
			<div v-if="!currentProject" class="empty-content">
				<div class="empty-content__icon">
					<ChartGanttIcon :size="64" />
				</div>
				<h2>{{ t('gantt', 'Gantt Chart') }}</h2>
				<p>{{ t('gantt', 'Select a project or create a new one to get started.') }}</p>
			</div>

			<div v-else class="gantt-container">
				<div class="gantt-header">
					<h2>{{ currentProject.title }}</h2>
					<NcButton type="primary" @click="showAddTask = true">
						<template #icon>
							<PlusIcon :size="20" />
						</template>
						{{ t('gantt', 'Add Task') }}
					</NcButton>
				</div>
				<GanttChart
					:tasks="tasks"
					@update-task="onUpdateTask"
					@delete-task="onDeleteTask"
					@edit-task="onEditTask" />
			</div>

			<!-- Add/Edit Task Modal -->
			<NcModal v-if="showAddTask || editingTask" @close="closeTaskModal">
				<div class="modal-content">
					<h2>{{ editingTask ? t('gantt', 'Edit Task') : t('gantt', 'New Task') }}</h2>
					<div class="form-group">
						<label>{{ t('gantt', 'Title') }}</label>
						<NcTextField :value.sync="taskForm.title" :placeholder="t('gantt', 'Task title')" />
					</div>
					<div class="form-group">
						<label>{{ t('gantt', 'Description') }}</label>
						<textarea v-model="taskForm.description" class="form-textarea" rows="3" />
					</div>
					<div class="form-row">
						<div class="form-group">
							<label>{{ t('gantt', 'Start Date') }}</label>
							<NcDateTimePicker v-model="taskForm.startDate" type="date" />
						</div>
						<div class="form-group">
							<label>{{ t('gantt', 'End Date') }}</label>
							<NcDateTimePicker v-model="taskForm.endDate" type="date" />
						</div>
					</div>
					<div class="form-row">
						<div class="form-group">
							<label>{{ t('gantt', 'Progress') }} ({{ taskForm.progress }}%)</label>
							<input type="range" v-model.number="taskForm.progress" min="0" max="100" />
						</div>
						<div class="form-group">
							<label>{{ t('gantt', 'Color') }}</label>
							<NcColorPicker v-model="taskForm.color">
								<NcButton>
									<template #icon>
										<span class="color-preview" :style="{ backgroundColor: taskForm.color }" />
									</template>
								</NcButton>
							</NcColorPicker>
						</div>
					</div>
					<div class="form-group">
						<label>{{ t('gantt', 'Depends on') }}</label>
						<select v-model="taskForm.dependencyId" class="form-select">
							<option :value="null">{{ t('gantt', 'None') }}</option>
							<option v-for="task in availableDependencies" :key="task.id" :value="task.id">
								{{ task.title }}
							</option>
						</select>
					</div>
					<div class="modal-actions">
						<NcButton @click="closeTaskModal">{{ t('gantt', 'Cancel') }}</NcButton>
						<NcButton type="primary" @click="saveTask">{{ t('gantt', 'Save') }}</NcButton>
					</div>
				</div>
			</NcModal>

			<!-- Edit Project Modal -->
			<NcModal v-if="showEditProject" @close="showEditProject = false">
				<div class="modal-content">
					<h2>{{ t('gantt', 'Edit Project') }}</h2>
					<div class="form-group">
						<label>{{ t('gantt', 'Title') }}</label>
						<NcTextField :value.sync="projectForm.title" :placeholder="t('gantt', 'Project title')" />
					</div>
					<div class="form-group">
						<label>{{ t('gantt', 'Description') }}</label>
						<textarea v-model="projectForm.description" class="form-textarea" rows="3" />
					</div>
					<div class="form-group">
						<label>{{ t('gantt', 'Color') }}</label>
						<NcColorPicker v-model="projectForm.color">
							<NcButton>
								<template #icon>
									<span class="color-preview" :style="{ backgroundColor: projectForm.color }" />
								</template>
							</NcButton>
						</NcColorPicker>
					</div>
					<div class="modal-actions">
						<NcButton @click="showEditProject = false">{{ t('gantt', 'Cancel') }}</NcButton>
						<NcButton type="primary" @click="saveProject">{{ t('gantt', 'Save') }}</NcButton>
					</div>
				</div>
			</NcModal>
		</NcAppContent>
	</NcContent>
</template>

<script>
import NcContent from '@nextcloud/vue/dist/Components/NcContent.js'
import NcAppNavigation from '@nextcloud/vue/dist/Components/NcAppNavigation.js'
import NcAppNavigationItem from '@nextcloud/vue/dist/Components/NcAppNavigationItem.js'
import NcAppNavigationNewItem from '@nextcloud/vue/dist/Components/NcAppNavigationNewItem.js'
import NcAppContent from '@nextcloud/vue/dist/Components/NcAppContent.js'
import NcActionButton from '@nextcloud/vue/dist/Components/NcActionButton.js'
import NcButton from '@nextcloud/vue/dist/Components/NcButton.js'
import NcModal from '@nextcloud/vue/dist/Components/NcModal.js'
import NcTextField from '@nextcloud/vue/dist/Components/NcTextField.js'
import NcDateTimePicker from '@nextcloud/vue/dist/Components/NcDateTimePicker.js'
import NcColorPicker from '@nextcloud/vue/dist/Components/NcColorPicker.js'
import { showError, showSuccess } from '@nextcloud/dialogs'
import { generateUrl } from '@nextcloud/router'
import axios from '@nextcloud/axios'
import GanttChart from './components/GanttChart.vue'

import PlusIcon from 'vue-material-design-icons/Plus.vue'
import PencilIcon from 'vue-material-design-icons/Pencil.vue'
import DeleteIcon from 'vue-material-design-icons/Delete.vue'
import ChartGanttIcon from 'vue-material-design-icons/ChartGantt.vue'

export default {
	name: 'App',
	components: {
		NcContent,
		NcAppNavigation,
		NcAppNavigationItem,
		NcAppNavigationNewItem,
		NcAppContent,
		NcActionButton,
		NcButton,
		NcModal,
		NcTextField,
		NcDateTimePicker,
		NcColorPicker,
		GanttChart,
		PlusIcon,
		PencilIcon,
		DeleteIcon,
		ChartGanttIcon,
	},

	data() {
		return {
			projects: [],
			currentProject: null,
			tasks: [],
			showAddTask: false,
			editingTask: null,
			showEditProject: false,
			taskForm: this.getEmptyTaskForm(),
			projectForm: {
				title: '',
				description: '',
				color: '#0082c9',
			},
		}
	},

	computed: {
		availableDependencies() {
			if (this.editingTask) {
				return this.tasks.filter(t => t.id !== this.editingTask.id)
			}
			return this.tasks
		},
	},

	async mounted() {
		await this.loadProjects()
	},

	methods: {
		t(app, text) {
			return window.t ? window.t(app, text) : text
		},

		getEmptyTaskForm() {
			const today = new Date()
			const nextWeek = new Date()
			nextWeek.setDate(today.getDate() + 7)
			return {
				title: '',
				description: '',
				startDate: today,
				endDate: nextWeek,
				progress: 0,
				color: '#0082c9',
				sortOrder: 0,
				parentId: null,
				dependencyId: null,
			}
		},

		async loadProjects() {
			try {
				const url = generateUrl('/apps/gantt/api/projects')
				const response = await axios.get(url)
				this.projects = response.data
			} catch (e) {
				showError(this.t('gantt', 'Could not load projects'))
				console.error(e)
			}
		},

		async selectProject(project) {
			this.currentProject = project
			await this.loadTasks()
		},

		async loadTasks() {
			if (!this.currentProject) return
			try {
				const url = generateUrl(`/apps/gantt/api/projects/${this.currentProject.id}/tasks`)
				const response = await axios.get(url)
				this.tasks = response.data
			} catch (e) {
				showError(this.t('gantt', 'Could not load tasks'))
				console.error(e)
			}
		},

		async onNewProject(title) {
			try {
				const url = generateUrl('/apps/gantt/api/projects')
				const response = await axios.post(url, { title, color: '#0082c9' })
				this.projects.unshift(response.data)
				this.selectProject(response.data)
				showSuccess(this.t('gantt', 'Project created'))
			} catch (e) {
				showError(this.t('gantt', 'Could not create project'))
				console.error(e)
			}
		},

		editProject(project) {
			this.projectForm = {
				title: project.title,
				description: project.description || '',
				color: project.color || '#0082c9',
			}
			this.showEditProject = true
		},

		async saveProject() {
			try {
				const url = generateUrl(`/apps/gantt/api/projects/${this.currentProject.id}`)
				const response = await axios.put(url, this.projectForm)
				const idx = this.projects.findIndex(p => p.id === this.currentProject.id)
				if (idx !== -1) {
					this.$set(this.projects, idx, response.data)
				}
				this.currentProject = response.data
				this.showEditProject = false
				showSuccess(this.t('gantt', 'Project updated'))
			} catch (e) {
				showError(this.t('gantt', 'Could not update project'))
				console.error(e)
			}
		},

		async deleteProject(project) {
			if (!confirm(this.t('gantt', 'Are you sure you want to delete this project and all its tasks?'))) {
				return
			}
			try {
				const url = generateUrl(`/apps/gantt/api/projects/${project.id}`)
				await axios.delete(url)
				this.projects = this.projects.filter(p => p.id !== project.id)
				if (this.currentProject && this.currentProject.id === project.id) {
					this.currentProject = null
					this.tasks = []
				}
				showSuccess(this.t('gantt', 'Project deleted'))
			} catch (e) {
				showError(this.t('gantt', 'Could not delete project'))
				console.error(e)
			}
		},

		onEditTask(task) {
			this.editingTask = task
			this.taskForm = {
				title: task.title,
				description: task.description || '',
				startDate: new Date(task.startDate),
				endDate: new Date(task.endDate),
				progress: task.progress,
				color: task.color || '#0082c9',
				sortOrder: task.sortOrder,
				parentId: task.parentId,
				dependencyId: task.dependencyId,
			}
		},

		closeTaskModal() {
			this.showAddTask = false
			this.editingTask = null
			this.taskForm = this.getEmptyTaskForm()
		},

		formatDate(date) {
			if (!date) return ''
			const d = date instanceof Date ? date : new Date(date)
			return d.toISOString().split('T')[0]
		},

		async saveTask() {
			if (!this.taskForm.title.trim()) {
				showError(this.t('gantt', 'Title is required'))
				return
			}

			const data = {
				title: this.taskForm.title,
				description: this.taskForm.description,
				startDate: this.formatDate(this.taskForm.startDate),
				endDate: this.formatDate(this.taskForm.endDate),
				progress: this.taskForm.progress,
				color: this.taskForm.color,
				sortOrder: this.taskForm.sortOrder,
				parentId: this.taskForm.parentId,
				dependencyId: this.taskForm.dependencyId,
			}

			try {
				if (this.editingTask) {
					const url = generateUrl(`/apps/gantt/api/projects/${this.currentProject.id}/tasks/${this.editingTask.id}`)
					const response = await axios.put(url, data)
					const idx = this.tasks.findIndex(t => t.id === this.editingTask.id)
					if (idx !== -1) {
						this.$set(this.tasks, idx, response.data)
					}
					showSuccess(this.t('gantt', 'Task updated'))
				} else {
					const url = generateUrl(`/apps/gantt/api/projects/${this.currentProject.id}/tasks`)
					const response = await axios.post(url, data)
					this.tasks.push(response.data)
					showSuccess(this.t('gantt', 'Task created'))
				}
				this.closeTaskModal()
			} catch (e) {
				showError(this.t('gantt', 'Could not save task'))
				console.error(e)
			}
		},

		async onUpdateTask(task) {
			const data = {
				title: task.title,
				description: task.description,
				startDate: task.startDate,
				endDate: task.endDate,
				progress: task.progress,
				color: task.color,
				sortOrder: task.sortOrder,
				parentId: task.parentId,
				dependencyId: task.dependencyId,
			}
			try {
				const url = generateUrl(`/apps/gantt/api/projects/${this.currentProject.id}/tasks/${task.id}`)
				const response = await axios.put(url, data)
				const idx = this.tasks.findIndex(t => t.id === task.id)
				if (idx !== -1) {
					this.$set(this.tasks, idx, response.data)
				}
			} catch (e) {
				showError(this.t('gantt', 'Could not update task'))
				console.error(e)
				await this.loadTasks()
			}
		},

		async onDeleteTask(task) {
			if (!confirm(this.t('gantt', 'Are you sure you want to delete this task?'))) {
				return
			}
			try {
				const url = generateUrl(`/apps/gantt/api/projects/${this.currentProject.id}/tasks/${task.id}`)
				await axios.delete(url)
				this.tasks = this.tasks.filter(t => t.id !== task.id)
				showSuccess(this.t('gantt', 'Task deleted'))
			} catch (e) {
				showError(this.t('gantt', 'Could not delete task'))
				console.error(e)
			}
		},
	},
}
</script>

<style scoped>
.gantt-container {
	padding: 20px;
	height: 100%;
	overflow: auto;
}

.gantt-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 20px;
	padding-bottom: 10px;
	border-bottom: 1px solid var(--color-border);
}

.gantt-header h2 {
	margin: 0;
}

.empty-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	color: var(--color-text-maxcontrast);
}

.empty-content__icon {
	margin-bottom: 20px;
	opacity: 0.4;
}

.project-color-dot {
	display: inline-block;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	margin-right: 4px;
}

.modal-content {
	padding: 20px;
	min-width: 400px;
}

.modal-content h2 {
	margin-top: 0;
	margin-bottom: 20px;
}

.form-group {
	margin-bottom: 16px;
}

.form-group label {
	display: block;
	margin-bottom: 4px;
	font-weight: bold;
}

.form-row {
	display: flex;
	gap: 16px;
}

.form-row .form-group {
	flex: 1;
}

.form-textarea {
	width: 100%;
	padding: 8px;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius);
	background: var(--color-main-background);
	color: var(--color-main-text);
	resize: vertical;
}

.form-select {
	width: 100%;
	padding: 8px;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius);
	background: var(--color-main-background);
	color: var(--color-main-text);
}

.color-preview {
	display: inline-block;
	width: 24px;
	height: 24px;
	border-radius: 50%;
}

.modal-actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	margin-top: 20px;
}

input[type="range"] {
	width: 100%;
}
</style>
