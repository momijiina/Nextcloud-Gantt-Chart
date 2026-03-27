const path = require('path')
const webpackConfig = require('@nextcloud/webpack-vue2')

module.exports = webpackConfig({
    main: path.join(__dirname, 'src', 'main.js'),
}, {
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'js'),
    },
})
