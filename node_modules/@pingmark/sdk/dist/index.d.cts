type Pingmark = {
    lat: number;
    lon: number;
    ts?: string;
};

declare function parse(text: string): Pingmark | null;
declare function parseFromPath(segments: string[]): Pingmark;

declare function format(p: Pingmark): string;
declare function toURL(p: Pingmark, base?: string): string;
declare function toGeoURI(p: Pingmark): string;

export { type Pingmark, format, parse, parseFromPath, toGeoURI, toURL };
