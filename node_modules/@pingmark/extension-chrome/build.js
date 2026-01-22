import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
	entryPoints: ['src/content.ts'],
	bundle: true,
	outfile: 'dist/content.js',
	format: 'iife',
	target: ['chrome100'],
	minify: !isWatch,
	sourcemap: isWatch ? 'inline' : false,
};

if (isWatch) {
	const ctx = await esbuild.context(buildOptions);
	await ctx.watch();
	console.log('Watching for changes...');
} else {
	await esbuild.build(buildOptions);
	console.log('Build complete: dist/content.js');
}
