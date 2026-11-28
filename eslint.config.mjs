import tsParser from '@typescript-eslint/parser';

// Deliberately small, enforced correctness baseline. TypeScript's strict production
// typecheck remains a separate mandatory gate; formatting is not a correctness test.
const rules={
 'no-debugger':'error','no-unreachable':'error','no-dupe-keys':'error',
 'no-sparse-arrays':'error','no-irregular-whitespace':'error','no-unsafe-finally':'error'
};
export default [
 {ignores:['**/node_modules/**','**/dist-probe/**','**/dist/**','**/out/**','**/.vite/**','**/.local-evidence/**','**/coverage/**']},
 {files:['**/*.{js,mjs,cjs}'],languageOptions:{ecmaVersion:'latest'},rules},
 {files:['**/*.{ts,tsx}'],languageOptions:{parser:tsParser,parserOptions:{ecmaFeatures:{jsx:true},sourceType:'module'}},rules}
];
