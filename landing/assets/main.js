import {parse, toURL} from '@pingmark/sdk';

const content = {
	en: {
		demo_title: "Try Pingmark™",
		demo_sofia: "View Sofia, Bulgaria",
		demo_location: "Use my location",
		demo_protocol: "Test the protocol:",
		demo_placeholder: "Paste text with !@ 42.6977,23.3219",
		demo_resolve: "Resolve",
		demo_status: "Click 'Use my location' to see your current position",
		header_subtitle: "A Universal Textual Protocol for Spatial Mentions (PPS v0.1)",
		explanation_p1:
			'Pingmark™ defines a minimal protocol (<strong>PPS v0.1</strong>) that transforms location from a complex "feature" into a <strong>simple textual element</strong>. Similar to <code class="font-mono">@</code> for usernames and <code class="font-mono">#</code> for hashtags, <strong>!@</strong> is the universal token for physical space.',
		explanation_key:
			'<strong>Crucially:</strong> <strong>!@</strong> never contains coordinates. They are generated <strong>locally</strong> by your client application (e.g., keyboard or browser extension) and embedded into a standardized, open URL.',
		structure_title: "Protocol Structure (PPS v0.1)",
		flow_h3_1: "1. The Text Trigger",
		flow_p1:
			'User types the trigger: <code class="font-mono font-semibold">"I am at <strong>!@</strong>"</code> in any app or text field.',
		flow_h3_2: "2. Local Coordinate Generation",
		flow_p2:
			"The client (L1 Parser) uses the device's GPS to silently grab <code class='font-mono font-semibold'>/Lat/Lon</code>.",
		flow_h3_3: "3. The Resolver Link",
		flow_p3:
			"The final, shareable, and open URL is generated: <code class='font-mono text-xs font-semibold'>map.pingmark.me/Lat/Lon/...</code>",
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
			'&copy; 2025 Pingmark™ Protocol. Developed by Kalin Dimitrov. All rights reserved.',
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
			"Универсален Текстов Протокол за Пространствени Споменавания (PPS v0.1)",
		explanation_p1:
			'Pingmark™ дефинира минимален протокол (<strong>PPS v0.1</strong>), който превръща локацията от сложна "функция" в <strong>прост текстов елемент</strong>. Подобно на <code class="font-mono">@</code> за потребителски имена и <code class="font-mono">#</code> за хаштагове, <strong>!@</strong> е универсалният токен за физическо пространство.',
		explanation_key:
			'<strong>Ключово:</strong> <strong>!@</strong> никога не съдържа координати. Те се генерират <strong>локално</strong> от Вашето клиентско приложение (напр. клавиатура или браузър) и се вграждат в стандартен, отворен URL.',
		structure_title: "Структура на Протокола (PPS v0.1)",
		flow_h3_1: "1. Текстов Тригер",
		flow_p1:
			'Потребителят въвежда тригера: <code class="font-mono font-semibold">"Аз съм на <strong>!@</strong>"</code> във всяко приложение или текстово поле.',
		flow_h3_2: "2. Локално Генериране на Координати",
		flow_p2:
			"Клиентът (L1 Parser) използва GPS на устройството, за да вземе тихо <code class='font-mono font-semibold'>/Lat/Lon</code>.",
		flow_h3_3: "3. Resolver Link",
		flow_p3:
			"Генерира се крайният, споделяем и отворен URL: <code class='font-mono text-xs font-semibold'>map.pingmark.me/Lat/Lon/...</code>",
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
			"&copy; 2025 Pingmark™ Protocol. Разработен от Kalin Dimitrov. Всички права запазени.",
	},
};

let currentLang = "en";
let demoMap = null;
let demoMarker = null;

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

	demoMap = L.map("demo-map").setView([43.0768, 25.6315], 10);
	L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		maxZoom: 19,
	}).addTo(demoMap);

	// Sofia marker (по подразбиране)
	demoMarker = L.marker([42.6977, 23.3219], {icon: pingIcon}).addTo(demoMap);
	demoMarker.bindPopup(
		'<b>Pingmark Demo</b><br>Sofia, Bulgaria<br><small>Click "View Sofia" to see full map</small>'
	);
}

async function useMyLocation() {
	const status = document.getElementById("status");
	status.textContent = "Requesting location...";

	try {
		const position = await new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: true,
				timeout: 10000,
			});
		});

		const {latitude, longitude} = position.coords;
		const timestamp = Math.floor(Date.now() / 1000);

		// Update demo map
		if (demoMap && demoMarker) {
			demoMap.setView([latitude, longitude], 15);
			demoMarker.setLatLng([latitude, longitude]);
			demoMarker.bindPopup(
				`<b>Your Location</b><br>${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
			);
		}

		// Generate link to map viewer (референтният резолвър е статичен)
		const url = toURL(
			{lat: +latitude.toFixed(6), lon: +longitude.toFixed(6), ts: String(timestamp)},
			"https://map.pingmark.me"
		);
		status.innerHTML = `Location found! <a href="${url}" target="_blank" class="text-blue-600 underline">View on full map</a>`;
	} catch (error) {
		status.textContent = "Location permission denied or unavailable.";
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

	// SDK вместо локалния regex
	const p = parse(text);
	if (!p) {
		status.textContent = "No valid pingmark found. Use format: !@ lat,lon[/timestamp]";
		return;
	}

	const url = toURL(p, "https://map.pingmark.me");
	status.innerHTML = `Resolved! <a href="${url}" target="_blank" class="text-blue-600 underline">Open</a>`;
}

document.addEventListener("DOMContentLoaded", () => {
	document.getElementById("btn-use-location").addEventListener("click", useMyLocation);
	document.getElementById("btn-demo").addEventListener("click", viewSofia);
	document.getElementById("btn-resolve").addEventListener("click", resolveText);
	document.getElementById("pm-text").addEventListener("keydown", (e) => {
		if (e.key === "Enter") resolveText();
	});

	initDemoMap();

	const browserLang = (navigator.language || "en").split("-")[0];
	switchLanguage(browserLang === "bg" || browserLang === "en" ? browserLang : "en");
});
