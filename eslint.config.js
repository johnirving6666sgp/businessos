import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'

const unusedVars = ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]

export default [
  { ignores: ['dist/**', 'node_modules/**', '.wrangler/**', '.data/**', 'crawler/.state.json'] },

  js.configs.recommended,

  // 后端 / 爬虫 / 脚本：Node + Web 平台 API（CF Worker 同时具备两类全局）
  {
    files: ['worker/**/*.mjs', 'crawler/**/*.mjs', 'scripts/**/*.mjs', 'server.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': unusedVars,
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // 前端 React（JSX）
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'no-unused-vars': unusedVars,
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // React 17+ 新 JSX transform：不需要 import React，但要让 JSX 中用到的变量算作"已使用"
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
    },
  },

  // 测试文件
  {
    files: ['**/*.test.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: { 'no-unused-vars': unusedVars },
  },
]
