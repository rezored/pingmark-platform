import { parse, toURL } from '@pingmark/sdk';

const content = {
	en: {
		demo_title: "Try Pingmark™",
		demo_sofia: "View Sofia, Bulgaria",
		demo_location: "Use my location",
		demo_protocol: "Test the protocol:",
		demo_placeholder: "Paste text with !@ 42.6977,23.3219",
		demo_resolve: "Resolve",
		demo_status: "Click 'Use my location' to see your current position",
		header_subtitle: "A Universal Textual Protocol for Spatial Mentions (PPS v0.2)",
		explanation_p1:
			'Pingmark™ defines a minimal protocol (<strong>PPS v0.2</strong>) that transforms location from a complex "feature" into a <strong>simple textual element</strong>. Similar to <code class="font-mono">@</code> for usernames and <code class="font-mono">#</code> for hashtags, <strong>!@</strong> is the universal token for physical space.',
		explanation_key:
			'<strong>Crucially:</strong> <strong>!@</strong> never contains coordinates. They are generated <strong>locally</strong> by your client application (e.g., keyboard or browser extension) and embedded into a standardized, open URL.',
		structure_title: "Protocol Structure (PPS v0.2)",
		flow_h3_1: "1. The Text Trigger",
		flow_p1:
			'User types the trigger: <code class="font-mono font-semibold">"I am at <strong>!@</strong>"</code> in any app or text field.',
		flow_h3_2: "2. Local Coordinate Generation",
		flow_p2:
			"The client (L1 Parser) uses the device's GPS to silently grab <code class='font-mono font-semibold'>/Lat/Lon</code>.",
		flow_h3_3: "3. The Resolver Link",
		flow_p3:
			"The final, shareable, and open URL is generated: <code class='font-mono text-xs font-semibold'>pingmark.me/Lat/Lon/...</code>",
		syntax_li_1:
			'<code class="font-mono">latitude/longitude</code>: Generated locally by the device\'s GPS.',
		syntax_li_2:
			'<code class="font-mono">[timestamp]</code>: Optional (ISO 8601), indicating the ephemerality of the location.',
		open_title: "Openness and Privacy",
		open_p1: 'Pingmark™ is designed as an <strong>Open Standard</strong>.',
		open_no_tracking: '<strong>No Tracking:</strong> Coordinates are not stored centrally.',
		open_source_text:
			'<strong>Open Source:</strong> The reference code will be publicly available on GitHub.',
		github_link_button: "View Code on GitHub",
		footer_text:
			'&copy; 2026 Pingmark™ Protocol. Developed by Kalin Dimitrov, Veliko Tarnovo University. All rights reserved.',
		// PPS v0.2 new sections
		abnf_title: "Protocol Syntax (ABNF)",
		abnf_description: "Formal syntax definition for the Pingmark protocol:",
		processing_title: "Processing Rules",
		processing_step_1: "<strong>1. Detect</strong> the token <code class='font-mono'>!@</code> in text",
		processing_step_2: "<strong>2. Retrieve</strong> device coordinates locally",
		processing_step_3: "<strong>3. Generate</strong> resolver link",
		processing_step_4: "<strong>4. Optionally</strong> append timestamp",
		processing_step_5: "<strong>5. Replace</strong> token with link or preview",
		example_title: "Example Transformation",
		example_input: "Input:",
		example_output: "Output:",
		example_input_text: '"Arrived safely !@"',
		example_output_text: '"Arrived safely https://pingmark.me/43.0842/25.6550/2025-10-14T12:10Z"',
		comparison_title: "How Pingmark Compares",
		criterion_human_readable: "Human readability",
		criterion_open_standard: "Open standard",
		criterion_realtime: "Real-time capability",
		criterion_requires_app: "Requires app",
		security_title: "Security & Privacy",
		risk_spoofing: "Coordinate spoofing",
		mitigation_spoofing: "Use trusted device geolocation API",
		risk_persistence: "Data persistence",
		mitigation_persistence: "Resolver cache limited to 24 hours",
		risk_leakage: "Link leakage",
		mitigation_leakage: "Optional resolver key signing",
		risk_tracking: "Tracking risk",
		mitigation_tracking: "No user identifiers or analytics stored",
		references_title: "References",
		reference_arxiv: 'K. Dimitrov, "Pingmark: A Textual Protocol for Universal Spatial Mentions," arXiv:2510.09672, DOI: 10.48550/arXiv.2510.09672, 2025.',
		dark_mode_toggle: "Toggle dark mode",
	},
	bg: {
		demo_title: "Опитайте Pingmark™",
		demo_sofia: "Вижте София, България",
		demo_location: "Използвайте моята локация",
		demo_protocol: "Тествайте протокола:",
		demo_placeholder: "Поставете текст с !@ 42.6977,23.3219",
		demo_resolve: "Реши",
		demo_status: "Кликнете 'Използвайте моята локация' за да видите текущата си позиция",
		header_subtitle:
			"Универсален Текстов Протокол за Пространствени Споменавания (PPS v0.2)",
		explanation_p1:
			'Pingmark™ дефинира минимален протокол (<strong>PPS v0.2</strong>), който превръща локацията от сложна "функция" в <strong>прост текстов елемент</strong>. Подобно на <code class="font-mono">@</code> за потребителски имена и <code class="font-mono">#</code> за хаштагове, <strong>!@</strong> е универсалният токен за физическо пространство.',
		explanation_key:
			'<strong>Ключово:</strong> <strong>!@</strong> никога не съдържа координати. Те се генерират <strong>локално</strong> от Вашето клиентско приложение (напр. клавиатура или браузър) и се вграждат в стандартен, отворен URL.',
		structure_title: "Структура на Протокола (PPS v0.2)",
		flow_h3_1: "1. Текстов Тригер",
		flow_p1:
			'Потребителят въвежда тригера: <code class="font-mono font-semibold">"Аз съм на <strong>!@</strong>"</code> във всяко приложение или текстово поле.',
		flow_h3_2: "2. Локално Генериране на Координати",
		flow_p2:
			"Клиентът (L1 Parser) използва GPS на устройството, за да вземе тихо <code class='font-mono font-semibold'>/Lat/Lon</code>.",
		flow_h3_3: "3. Resolver Link",
		flow_p3:
			"Генерира се крайният, споделяем и отворен URL: <code class='font-mono text-xs font-semibold'>pingmark.me/Lat/Lon/...</code>",
		syntax_li_1:
			'<code class="font-mono">latitude/longitude</code>: Генерирани локално от GPS на устройството.',
		syntax_li_2:
			'<code class="font-mono">[timestamp]</code>: Незадължителен (ISO 8601), указващ ефемерността на локацията.',
		open_title: "Отвореност и Поверителност",
		open_p1: "Pingmark™ е проектиран като <strong>Отворен Стандарт</strong>.",
		open_no_tracking: "<strong>Без Проследяване:</strong> Координатите не се съхраняват централно.",
		open_source_text: "<strong>Отворен Код:</strong> Референтният код ще бъде публичен в GitHub.",
		github_link_button: "Вижте Кода в GitHub",
		footer_text:
			"&copy; 2026 Pingmark™ Protocol. Разработен от Kalin Dimitrov, Великотърновски университет. Всички права запазени.",
		// PPS v0.2 new sections
		abnf_title: "Синтаксис на Протокола (ABNF)",
		abnf_description: "Формална дефиниция на синтаксиса за Pingmark протокола:",
		processing_title: "Правила за Обработка",
		processing_step_1: "<strong>1. Открий</strong> токена <code class='font-mono'>!@</code> в текста",
		processing_step_2: "<strong>2. Вземи</strong> координатите на устройството локално",
		processing_step_3: "<strong>3. Генерирай</strong> resolver линк",
		processing_step_4: "<strong>4. По избор</strong> добави времева марка",
		processing_step_5: "<strong>5. Замени</strong> токена с линк или визуализация",
		example_title: "Пример за Трансформация",
		example_input: "Вход:",
		example_output: "Изход:",
		example_input_text: '"Пристигнах благополучно !@"',
		example_output_text: '"Пристигнах благополучно https://pingmark.me/43.0842/25.6550/2025-10-14T12:10Z"',
		comparison_title: "Сравнение на Pingmark",
		criterion_human_readable: "Четимост за хора",
		criterion_open_standard: "Отворен стандарт",
		criterion_realtime: "Реално време",
		criterion_requires_app: "Изисква приложение",
		security_title: "Сигурност и Поверителност",
		risk_spoofing: "Подправяне на координати",
		mitigation_spoofing: "Използване на доверен geolocation API",
		risk_persistence: "Съхранение на данни",
		mitigation_persistence: "Кеш на resolver ограничен до 24 часа",
		risk_leakage: "Изтичане на линкове",
		mitigation_leakage: "Опционално подписване с ключ",
		risk_tracking: "Риск от проследяване",
		mitigation_tracking: "Без идентификатори или аналитика",
		references_title: "Референции",
		reference_arxiv: 'K. Dimitrov, "Pingmark: A Textual Protocol for Universal Spatial Mentions," arXiv:2510.09672, DOI: 10.48550/arXiv.2510.09672, 2025.',
		dark_mode_toggle: "Превключи тъмен режим",
	},
};

let currentLang = "en";
let demoMap = null;
let demoMarker = null;
let accuracyCircle = null;
let bestPosition = null; // {lat, lon, accuracy, timestamp}
let sampleBuffer = [];    // Buffer for statistical refinement
let watchId = null;
let isManuallyPlaced = false;

const PRECISION_THRESHOLD = 30; // Meters for a "Hardware Lock"
const BUFFER_SIZE = 5;         // Number of samples to average

// Leaflet marker icon
const pingIcon = L.icon({
	iconUrl: "/images/pingmark_logo_icon.png",
	iconSize: [36, 44],
	iconAnchor: [18, 44],
	popupAnchor: [0, -44],
});

function switchLanguage(lang) {
	currentLang = lang;
	const data = content[lang];

	// Text content
	document.getElementById("header-subtitle").textContent = data.header_subtitle;
	document.getElementById("demo-title").innerHTML =
		`<img src="images/pingmark_logo_icon.png" alt="pingmark.me logo" class="w-8 h-8 mr-3"/>${data.demo_title}`;

	document.getElementById("btn-demo").textContent = data.demo_sofia;
	document.getElementById("btn-use-location").textContent = data.demo_location;
	document.getElementById("pm-text").placeholder = data.demo_placeholder;
	document.getElementById("btn-resolve").textContent = data.demo_resolve;
	document.getElementById("status").textContent = data.demo_status;
	document.getElementById("status-hint").textContent = data.demo_status;

	document.getElementById("explanation-p1").innerHTML = data.explanation_p1;
	document.getElementById("explanation-key").innerHTML = data.explanation_key;
	document.getElementById("structure-title").textContent = data.structure_title;

	document.getElementById("flow-h3-1").textContent = data.flow_h3_1;
	document.getElementById("flow-p1").innerHTML = data.flow_p1;
	document.getElementById("flow-h3-2").textContent = data.flow_h3_2;
	document.getElementById("flow-p2").innerHTML = data.flow_p2;
	document.getElementById("flow-h3-3").textContent = data.flow_h3_3;
	document.getElementById("flow-p3").innerHTML = data.flow_p3;

	document.getElementById("syntax-li-1").innerHTML = data.syntax_li_1;
	document.getElementById("syntax-li-2").innerHTML = data.syntax_li_2;

	document.getElementById("open-title").textContent = data.open_title;
	document.getElementById("open-p1").innerHTML = data.open_p1;
	document.getElementById("open-no-tracking").innerHTML = data.open_no_tracking;
	document.getElementById("open-source-text").innerHTML = data.open_source_text;
	document.getElementById("github-link-button").textContent = data.github_link_button;
	document.getElementById("footer-text").innerHTML = data.footer_text;

	// PPS v0.2 new sections
	updateElementText("abnf-title", data.abnf_title);
	updateElementText("abnf-description", data.abnf_description);
	updateElementText("processing-title", data.processing_title);
	updateElementText("processing-step-1", data.processing_step_1);
	updateElementText("processing-step-2", data.processing_step_2);
	updateElementText("processing-step-3", data.processing_step_3);
	updateElementText("processing-step-4", data.processing_step_4);
	updateElementText("processing-step-5", data.processing_step_5);
	updateElementText("example-title", data.example_title);
	updateElementText("example-input", data.example_input);
	updateElementText("example-output", data.example_output);
	updateElementText("example-input-text", data.example_input_text);
	updateElementText("example-output-text", data.example_output_text);
	updateElementText("comparison-title", data.comparison_title);
	updateElementText("criterion-human-readable", data.criterion_human_readable);
	updateElementText("criterion-open-standard", data.criterion_open_standard);
	updateElementText("criterion-realtime", data.criterion_realtime);
	updateElementText("criterion-requires-app", data.criterion_requires_app);
	updateElementText("security-title", data.security_title);
	updateElementText("risk-spoofing", data.risk_spoofing);
	updateElementText("mitigation-spoofing", data.mitigation_spoofing);
	updateElementText("risk-persistence", data.risk_persistence);
	updateElementText("mitigation-persistence", data.mitigation_persistence);
	updateElementText("risk-leakage", data.risk_leakage);
	updateElementText("mitigation-leakage", data.mitigation_leakage);
	updateElementText("risk-tracking", data.risk_tracking);
	updateElementText("mitigation-tracking", data.mitigation_tracking);
	updateElementText("references-title", data.references_title);
	updateElementText("reference-arxiv", data.reference_arxiv);

	// Button styles
	const enBtn = document.getElementById("lang-en");
	const bgBtn = document.getElementById("lang-bg");

	enBtn.classList.toggle("bg-red-500", lang === "en");
	enBtn.classList.toggle("text-white", lang === "en");
	enBtn.classList.toggle("border-gray-300", lang === "bg");
	enBtn.classList.toggle("text-gray-600", lang === "bg");
	enBtn.classList.toggle("border-red-500", lang === "en");

	bgBtn.classList.toggle("bg-red-500", lang === "bg");
	bgBtn.classList.toggle("text-white", lang === "bg");
	bgBtn.classList.toggle("border-gray-300", lang === "en");
	bgBtn.classList.toggle("text-gray-600", lang === "en");
	bgBtn.classList.toggle("border-red-500", lang === "bg");
}

function initDemoMap() {
	if (demoMap) return;

	const initialLat = 43.0768;
	const initialLon = 25.6315;

	demoMap = L.map("demo-map").setView([initialLat, initialLon], 10);
	L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		maxZoom: 19,
	}).addTo(demoMap);

	// Initial marker at Veliko Tarnovo with draggable enabled
	demoMarker = L.marker([initialLat, initialLon], {
		icon: pingIcon,
		draggable: true
	}).addTo(demoMap);

	const data = content[currentLang];
	demoMarker.bindPopup(
		`<b>Pingmark Demo</b><br>Veliko Tarnovo, Bulgaria<br><small>${data.demo_status}</small>`
	);

	// Event listeners for manual refinement
	demoMarker.on('dragend', (e) => {
		isManuallyPlaced = true;
		const { lat, lng } = e.target.getLatLng();
		updateLocationFromManual(lat, lng);
	});

	demoMap.on('click', (e) => {
		isManuallyPlaced = true;
		const { lat, lng } = e.latlng;
		demoMarker.setLatLng([lat, lng]);
		updateLocationFromManual(lat, lng);
	});

	// Start the precision engine
	startPrecisionEngine();
}

function updateLocationFromManual(lat, lng) {
	// Stop auto-tracking if user manually placed
	if (accuracyCircle) {
		demoMap.removeLayer(accuracyCircle);
		accuracyCircle = null;
	}

	bestPosition = {
		lat: +lat.toFixed(6),
		lon: +lng.toFixed(6),
		accuracy: 0,
		timestamp: Math.floor(Date.now() / 1000)
	};

	const url = toURL(
		{ lat: bestPosition.lat, lon: bestPosition.lon, ts: String(bestPosition.timestamp) },
		"https://map.pingmark.me"
	);
	const status = document.getElementById("status");
	status.innerHTML = `Manual position set! <a href="${url}" target="_blank" class="text-blue-600 underline dark:text-blue-400">View on full map</a>`;

	demoMarker.bindPopup(
		`<b>Manual Position</b><br>${bestPosition.lat}, ${bestPosition.lon}`
	).openPopup();
}

function startPrecisionEngine() {
	if (!navigator.geolocation) return;

	watchId = navigator.geolocation.watchPosition(
		(position) => {
			const { latitude, longitude, accuracy } = position.coords;
			const timestamp = Math.floor(position.timestamp / 1000);

			// Add to buffer
			sampleBuffer.push({ lat: latitude, lon: longitude, acc: accuracy });
			if (sampleBuffer.length > BUFFER_SIZE) sampleBuffer.shift();

			// Statistical Cleaning
			const refined = getRefinedCoordinates(latitude, longitude, accuracy);

			if (!bestPosition || refined.accuracy <= bestPosition.accuracy) {
				bestPosition = {
					lat: +refined.lat.toFixed(6),
					lon: +refined.lon.toFixed(6),
					accuracy: refined.accuracy,
					timestamp: timestamp
				};

				if (!isManuallyPlaced) {
					updateDemoMap(bestPosition.lat, bestPosition.lon, bestPosition.accuracy);
					updateStatusWithBest();
				}
			}
		},
		(error) => {
			console.warn('Geolocation error:', error);
			const status = document.getElementById("status");
			status.textContent = "GPS Status: Signal lost or permission denied.";
		},
		{
			enableHighAccuracy: true,
			maximumAge: 0,
			timeout: 30000
		}
	);
}

function getRefinedCoordinates(lat, lon, acc) {
	if (sampleBuffer.length < 3) return { lat, lon, accuracy: acc };

	// Filter outliers: remove samples with accuracy > 2 * median accuracy
	const sortedByAcc = [...sampleBuffer].sort((a, b) => a.acc - b.acc);
	const medianAcc = sortedByAcc[Math.floor(sortedByAcc.length / 2)].acc;
	const filtered = sampleBuffer.filter(s => s.acc <= medianAcc * 2);

	if (filtered.length === 0) return { lat, lon, accuracy: acc };

	const avgLat = filtered.reduce((sum, s) => sum + s.lat, 0) / filtered.length;
	const avgLon = filtered.reduce((sum, s) => sum + s.lon, 0) / filtered.length;
	const avgAcc = filtered.reduce((sum, s) => sum + s.acc, 0) / filtered.length;

	return { lat: avgLat, lon: avgLon, accuracy: avgAcc };
}

function updateDemoMap(lat, lon, accuracy) {
	if (!demoMap || !demoMarker) return;

	const targetZoom = accuracy < PRECISION_THRESHOLD ? 18 : 15;
	demoMap.setView([lat, lon], demoMap.getZoom() > targetZoom ? demoMap.getZoom() : targetZoom);

	demoMarker.setLatLng([lat, lon]);

	const lockStatus = accuracy < PRECISION_THRESHOLD
		? "<span class='text-green-500 font-bold'>✓ GPS Hardware Lock</span>"
		: "<span class='text-orange-500 italic'>⟳ Refining... (Wait for lock)</span>";

	demoMarker.bindPopup(
		`<b>Pingmark Precision Guard</b><br>${lat.toFixed(6)}, ${lon.toFixed(6)}<br><small>Accuracy: ±${Math.round(accuracy)}m</small><br>${lockStatus}`
	);

	// Accuracy Circle
	if (accuracyCircle) {
		accuracyCircle.setLatLng([lat, lon]);
		accuracyCircle.setRadius(accuracy);
		accuracyCircle.setStyle({
			color: accuracy < PRECISION_THRESHOLD ? '#10b981' : '#dc2626',
			fillColor: accuracy < PRECISION_THRESHOLD ? '#10b981' : '#dc2626'
		});
	} else {
		accuracyCircle = L.circle([lat, lon], {
			radius: accuracy,
			color: '#dc2626',
			fillColor: '#dc2626',
			fillOpacity: 0.15,
			weight: 1
		}).addTo(demoMap);
	}
}

function updateStatusWithBest(forcePopulate = false) {
	if (!bestPosition) return;
	const status = document.getElementById("status");
	const pmInput = document.getElementById("pm-text");
	const url = toURL(
		{ lat: bestPosition.lat, lon: bestPosition.lon, ts: String(bestPosition.timestamp) },
		"https://map.pingmark.me"
	);

	const isLocked = bestPosition.accuracy < PRECISION_THRESHOLD;
	const statusMsg = isLocked
		? `<span class="text-green-600 dark:text-green-400 font-bold">✓ Precision Locked!</span>`
		: `<span class="text-orange-600 dark:text-orange-400 italic">Finding GPS lock... (±${Math.round(bestPosition.accuracy)}m)</span>`;

	status.innerHTML = `${statusMsg} <a href="${url}" target="_blank" class="text-blue-600 underline dark:text-blue-400 ml-2">Open Map</a>`;

	// Auto-populate the protocol string in the demo box
	// We populate if it's locked OR if the user explicitly clicked the button (forcePopulate)
	if (pmInput && (isLocked || forcePopulate)) {
		if (!pmInput.value || pmInput.value.includes("!@") || pmInput.value === "") {
			pmInput.value = `!@ ${bestPosition.lat},${bestPosition.lon}`;
		}
	}
}

async function useMyLocation(isAuto = false) {
	if (bestPosition && !isAuto) {
		// If we already have a refined position, show it and FORCE populate the input
		updateDemoMap(bestPosition.lat, bestPosition.lon, bestPosition.accuracy);
		updateStatusWithBest(true); // forcePopulate = true
		demoMarker.openPopup();
		return;
	}

	const status = document.getElementById("status");
	const pmInput = document.getElementById("pm-text");

	if (!isAuto) {
		status.textContent = "Seeking precision lock...";
		if (pmInput) pmInput.value = "Waiting for GPS...";
	}
}

function viewSofia() {
	const url = "https://map.pingmark.me/42.6977/23.3219";
	window.open(url, "_blank");
}

function resolveText() {
	const input = document.getElementById("pm-text");
	const status = document.getElementById("status");
	const text = input.value.trim();

	if (!text) {
		status.textContent = "Please enter text with a pingmark first.";
		return;
	}

	// Check if already resolved
	if (text.startsWith("https://map.pingmark.me") || text.startsWith("https://pingmark.me") || text.includes("pingmark.me/")) {
		const url = text.match(/https?:\/\/(?:map\.)?pingmark\.me\/[^\s]*/)?.[0] || text;
		const mapIcon = `<svg class="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>`;
		status.innerHTML = `This pingmark is already resolved! ${mapIcon} <a href="${url}" target="_blank" class="text-blue-600 underline dark:text-blue-400">Open</a>`;
		return;
	}

	// SDK вместо локалния regex
	const p = parse(text);
	if (!p) {
		status.textContent = "No valid pingmark found. Use format: !@ lat,lon[/timestamp]";
		return;
	}

	const url = toURL(p, "https://map.pingmark.me");
	const mapIcon = `<svg class="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>`;
	status.innerHTML = `Resolved! ${mapIcon} <a href="${url}" target="_blank" class="text-blue-600 underline dark:text-blue-400">Open</a>`;
}

// Helper function to safely update element text
function updateElementText(id, content) {
	const el = document.getElementById(id);
	if (el) el.innerHTML = content;
}

// Dark mode functionality
function initDarkMode() {
	const toggle = document.getElementById('dark-mode-toggle');
	if (!toggle) return;

	// Check for saved theme or system preference
	const savedTheme = localStorage.getItem('theme');
	const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

	if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
		document.documentElement.setAttribute('data-theme', 'dark');
		document.documentElement.classList.add('dark');
		toggle.setAttribute('aria-pressed', 'true');
	}

	toggle.addEventListener('click', () => {
		const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
		if (isDark) {
			document.documentElement.removeAttribute('data-theme');
			document.documentElement.classList.remove('dark');
			localStorage.setItem('theme', 'light');
			toggle.setAttribute('aria-pressed', 'false');
		} else {
			document.documentElement.setAttribute('data-theme', 'dark');
			document.documentElement.classList.add('dark');
			localStorage.setItem('theme', 'dark');
			toggle.setAttribute('aria-pressed', 'true');
		}
	});

	// Listen for system preference changes
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
		if (!localStorage.getItem('theme')) {
			if (e.matches) {
				document.documentElement.setAttribute('data-theme', 'dark');
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.removeAttribute('data-theme');
				document.documentElement.classList.remove('dark');
			}
		}
	});
}

document.addEventListener("DOMContentLoaded", () => {
	// Language switching
	document.getElementById("lang-en").addEventListener("click", () => switchLanguage("en"));
	document.getElementById("lang-bg").addEventListener("click", () => switchLanguage("bg"));

	// Demo controls
	document.getElementById("btn-use-location").addEventListener("click", useMyLocation);
	document.getElementById("btn-demo").addEventListener("click", viewSofia);
	document.getElementById("btn-resolve").addEventListener("click", resolveText);
	document.getElementById("pm-text").addEventListener("keydown", (e) => {
		if (e.key === "Enter") resolveText();
	});

	// Dark mode
	initDarkMode();

	initDemoMap();

	const browserLang = (navigator.language || "en").split("-")[0];
	switchLanguage(browserLang === "bg" || browserLang === "en" ? browserLang : "en");
});
