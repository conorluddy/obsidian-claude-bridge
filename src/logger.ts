export type LogCategory =
	| "plugin"
	| "command"
	| "service"
	| "session"
	| "schema";

const PREFIX = "claude-bridge";

/**
 * Category-based logger that outputs to the DevTools console.
 *
 * Each line is prefixed with `[claude-bridge:<category>]` so you can
 * filter by typing "claude-bridge" in the Console filter bar.
 *
 * All levels except `error` respect the `debugMode` setting —
 * errors always log because they should never be silently swallowed.
 */
export class Logger {
	constructor(private getDebugMode: () => boolean) {}

	debug(category: LogCategory, message: string, ...args: unknown[]): void {
		if (!this.getDebugMode()) return;
		console.debug(`[${PREFIX}:${category}]`, message, ...args);
	}

	info(category: LogCategory, message: string, ...args: unknown[]): void {
		if (!this.getDebugMode()) return;
		console.log(`[${PREFIX}:${category}]`, message, ...args);
	}

	warn(category: LogCategory, message: string, ...args: unknown[]): void {
		if (!this.getDebugMode()) return;
		console.warn(`[${PREFIX}:${category}]`, message, ...args);
	}

	error(category: LogCategory, message: string, ...args: unknown[]): void {
		console.error(`[${PREFIX}:${category}]`, message, ...args);
	}
}
