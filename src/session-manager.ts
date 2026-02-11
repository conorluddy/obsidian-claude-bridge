import { App, TFile } from "obsidian";
import type { Logger } from "./logger";

const SESSION_KEY = "claude_session";

/**
 * Manages Claude session IDs per note via frontmatter.
 *
 * Each note can have at most one active session. The session ID is stored
 * in the note's YAML frontmatter as `claude_session`.
 *
 * Why frontmatter instead of an in-memory Map?
 * - Survives plugin reloads and Obsidian restarts
 * - Syncs across devices if the vault is in iCloud/Dropbox/git
 * - Visible to the user — no hidden state
 */
export class SessionManager {
	constructor(
		private app: App,
		private logger: Logger,
	) {}

	/** Read the session ID from a note's frontmatter, if any. */
	getSessionId(file: TFile): string | null {
		const cache = this.app.metadataCache.getFileCache(file);
		const value = cache?.frontmatter?.[SESSION_KEY];
		const sessionId = typeof value === "string" ? value : null;
		this.logger.debug("session", `getSessionId("${file.path}") → ${sessionId ?? "(none)"}`);
		return sessionId;
	}

	/** Write or update the session ID in a note's frontmatter. */
	async setSessionId(file: TFile, sessionId: string): Promise<void> {
		this.logger.debug("session", `setSessionId("${file.path}", "${sessionId}")`);
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm[SESSION_KEY] = sessionId;
		});
	}

	/** Remove the session ID from a note's frontmatter. */
	async clearSession(file: TFile): Promise<void> {
		this.logger.debug("session", `clearSession("${file.path}")`);
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			delete fm[SESSION_KEY];
		});
	}
}
