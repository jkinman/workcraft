const { defineConfig } = require('vitest/config');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.{js,jsx}']
  }
});
