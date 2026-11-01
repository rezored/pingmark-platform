import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
	entryPoints: {
		content: 'src/content.ts',
		background: 'src/background.ts',
		offscreen: 'src/offscreen.ts'
	},
	bundle: true,
	outdir: 'dist',
	format: 'iife',
	target: ['chrome116'],
	minify: !isWatch,
	sourcemap: isWatch ? 'inline' : false,
};

if (isWatch) {
	const ctx = await esbuild.context(buildOptions);
	await ctx.watch();
	console.log('Watching for changes...');
} else {
	await esbuild.build(buildOptions);
	console.log('Build complete: dist/content.js, dist/background.js, dist/offscreen.js');
}
