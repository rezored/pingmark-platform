module.exports = {
	root: true,
	parserOptions: { ecmaVersion: "latest", sourceType: "module" },
	env: { node: true, es2022: true },
	extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
	plugins: ["@typescript-eslint"],
	ignorePatterns: ["dist", "node_modules"]
};