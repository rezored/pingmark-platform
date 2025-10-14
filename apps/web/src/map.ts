import "./styles.css";
import L from "leaflet";

export function renderMap(el: HTMLElement, lat: number, lon: number) {
	const map = L.map(el).setView([lat, lon], 15);
	L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
	L.marker([lat, lon]).addTo(map);
}