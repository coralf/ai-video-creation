module.exports = {
  parser: '@typescript-eslint/parser', // 使用 TypeScript 解析器
  parserOptions: {
    ecmaVersion: 2020, // 支持最新的 ECMAScript 版本
    sourceType: 'module', // 允许 import/export 语法
    project: './tsconfig.json', // 指定 tsconfig 文件路径，以便进行类型感知
  },
  ignorePatterns: ['!src/'], // 忽略所有不在 src 目录下的文件
};