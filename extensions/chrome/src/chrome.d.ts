// Minimal ambient typings for the chrome.* APIs this extension uses.
// Kept local to avoid pulling in @types/chrome for a handful of calls.

declare namespace chrome {
	namespace runtime {
		interface MessageSender {
			tab?: { id?: number };
			url?: string;
		}
		const lastError: { message?: string } | undefined;
		function getURL(path: string): string;
		function sendMessage<T = unknown>(message: unknown): Promise<T>;
		const onMessage: {
			addListener(
				cb: (message: any, sender: MessageSender, sendResponse: (response?: unknown) => void) => boolean | void
			): void;
		};
	}
	namespace offscreen {
		enum Reason {
			GEOLOCATION = 'GEOLOCATION'
		}
		function createDocument(params: { url: string; reasons: Reason[]; justification: string }): Promise<void>;
		function hasDocument(): Promise<boolean>;
	}
}
