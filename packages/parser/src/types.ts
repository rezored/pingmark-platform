export type ParsedPingmark = {
	raw: string;
	lat: number;
	lon: number;
	timestamp?: number;
	url: string;
};