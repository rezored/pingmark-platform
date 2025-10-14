const LAT = "-?\\d{1,2}(?:\\.\\d+)?";
const LON = "-?\\d{1,3}(?:\\.\\d+)?";
const TS = "(?:\\d{10}(?:\\d{3})?|\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z?)";
const RE = new RegExp(`(?:^|\\b)!@\\s*(${LAT})\\s*,\\s*(${LON})(?:\\s*[;|,]\\s*(${TS}))?(?=\\b|$)`, "g");

function canonical(lat, lon, ts){
	const L = Number(parseFloat(lat).toFixed(6));
	const G = Number(parseFloat(lon).toFixed(6));
	return `https://pingmark.me/${L}/${G}${ts?`/${ts}`:''}`;
}

function linkify(node){
	if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue) return;
	const text = node.nodeValue;
	if (!RE.test(text)) return;
	const span = document.createElement('span');
	let last = 0; RE.lastIndex = 0; let m;
	while ((m = RE.exec(text))){
		const [raw, lat, lon, ts] = m;
		span.append(text.slice(last, m.index));
		const a = document.createElement('a');
		a.href = canonical(lat, lon, ts);
		a.textContent = raw;
		a.target = '_blank';
		span.append(a);
		last = RE.lastIndex;
	}
	span.append(text.slice(last));
	node.replaceWith(span);
}

(function walk(n){
	const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
	const nodes = [];
	let cur; while (cur = w.nextNode()) nodes.push(cur);
	nodes.forEach(linkify);
})(document.body);