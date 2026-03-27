import Vue from 'vue'
import App from './App.vue'

const appElement = document.getElementById('gantt-app')

if (appElement) {
    new Vue({
        el: '#gantt-app',
        render: h => h(App),
    })
}
