# Obsidian + Claude CLI Plugin Template

Fork this, add commands, ship an AI-powered Obsidian plugin.

https://github.com/user-attachments/assets/50eb8bb9-82b3-48c2-8b15-d2121a6511ad

A batteries-included template for building Obsidian plugins that talk to the [Claude CLI](https://docs.anthropic.com/en/docs/claude-code). Comes with structured output validation (Zod + JSON Schema), per-note session continuity, and a base command pattern you can extend in minutes.

## What you get

- **CLI integration** — Spawns `claude -p` with `--output-format json`, handles stdout/stderr, and parses the response array
- **Structured output** — Define a Zod schema, get validated typed data back (via `--json-schema`)
- **Session continuity** — Session IDs stored in frontmatter, so follow-up calls resume the conversation
- **Base command pattern** — Abstract `BaseCommand` class handles the lifecycle; you just provide schema + prompt + render
- **Debug logging** — Category-based logger (`[claude-bridge:service]`, `[claude-bridge:command]`, ...) in DevTools console
- **Settings UI** — Model, system prompt, CLI path, token budget, debug toggle

## Quick start

1. Clone/fork into your vault's plugin directory:
   ```bash
   cd /path/to/vault/.obsidian/plugins/
   git clone https://github.com/conorluddy/obsidian-claude-bridge.git claude-bridge
   ```
2. Install and build:
   ```bash
   cd claude-bridge
   npm install && npm run build
   ```
3. In Obsidian, go to **Settings > Community plugins** and enable **Claude Bridge**.

**Prerequisite:** The [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) must be installed and authenticated. The plugin auto-detects common install paths (`~/.local/bin/claude`, `/usr/local/bin/claude`, `/opt/homebrew/bin/claude`) or you can set the path manually in settings.

## Adding your own command

1. **Define a schema** (optional — omit for raw text responses):

   ```typescript
   // src/schemas.ts
   export const SummaryResponseSchema = createCommandSchema(
   	z.object({
   		summary: z.string().describe("A concise summary"),
   	}),
   );
   ```

2. **Create a command file** in `src/commands/`:

   ```typescript
   // src/commands/summarise.ts
   export class SummariseCommand extends BaseCommand<{ summary: string }> {
   	readonly id = "claude-bridge-summarise";
   	readonly name = "Summarise selection with Claude";

   	getSchema(): CommandSchema<{ summary: string }> {
   		return SummaryResponseSchema;
   	}

   	buildPrompt(context: CommandContext): string {
   		return `Summarise this:\n\n${context.selection}`;
   	}

   	render(editor: Editor, result: CommandResult<{ summary: string }>): void {
   		editor.replaceSelection(result.output.summary);
   	}
   }
   ```

3. **Register it** in `main.ts`:

   ```typescript
   this.registerCommands([
   	new ExpandCommand(this.sessionManager, this.settings, this.logger),
   	new SummariseCommand(this.sessionManager, this.settings, this.logger),
   ]);
   ```

4. **Build and reload:** `npm run build`, then restart Obsidian or run "Reload app without saving" from the command palette.

## Architecture

```
src/
├── main.ts              Plugin entry point — loads settings, resolves CLI, registers commands
├── types.ts             All interfaces and default settings (start reading here)
├── schemas.ts           Zod schemas + JSON Schema generation for structured output
├── logger.ts            Category-based logger ([claude-bridge:*] in DevTools console)
├── settings.ts          Settings tab UI
├── session-manager.ts   Per-note session persistence via frontmatter
├── claude-service.ts    Spawns Claude CLI, parses JSON response, extracts structured output
└── commands/
    ├── base-command.ts  Abstract command lifecycle (context → prompt → call → validate → render)
    └── expand.ts        Example command — reference implementation of all three extension points
```

### Data flow

```
User selects text → Command palette → BaseCommand.execute()
  │
  ├─ gatherContext()          Read selection, full note, file path, cursor
  ├─ buildPrompt(context)     Subclass builds the prompt string
  ├─ callClaude(options)      Spawns CLI, collects stdout, parses JSON array
  │    ├─ extractStructuredOutput()   Look for StructuredOutput tool_use block
  │    ├─ result.result               Fall back to plain text result
  │    └─ extractTextFromContent()    Last resort: assistant content blocks
  ├─ schema.zodSchema.parse() Validate structured output (if schema provided)
  ├─ render(editor, result)   Subclass writes result into the editor
  └─ sessionManager.set()     Persist session ID in frontmatter
```

## Claude CLI quirks

Hard-won lessons from building this plugin:

| Issue                  | Detail                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PATH not inherited** | Obsidian's Electron env lacks your shell PATH. The plugin resolves the CLI path at startup by checking known locations and falling back to `zsh -lc "which claude"`.                                          |
| **Output format**      | Use `--output-format json` (not `stream-json`, which hangs when collecting stdout). Returns a single JSON array of message objects.                                                                           |
| **Structured output**  | `--json-schema` makes Claude call an internal `StructuredOutput` tool. The validated object is at `assistant.message.content[].input` where `block.name === "StructuredOutput"` — **not** in `result.result`. |
| **Max turns**          | `--max-turns 1` is too few with `--json-schema` (tool call = turn 1, tool result = turn 2). Use `--max-turns 2` minimum.                                                                                      |
| **stdin must close**   | When spawning with `stdio: ["pipe", "pipe", "pipe"]`, call `proc.stdin.end()` immediately or the CLI hangs waiting for input.                                                                                 |

## Scripts

| Script                 | Description                           |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | Watch mode — rebuilds on file changes |
| `npm run build`        | Production build → `main.js`          |
| `npm run lint`         | Run ESLint on `src/`                  |
| `npm run lint:fix`     | Run ESLint with auto-fix              |
| `npm run format`       | Format all files with Prettier        |
| `npm run format:check` | Check formatting without writing      |
| `npm run type-check`   | Run TypeScript compiler (no emit)     |
| `npm run check`        | Run all three checks in sequence      |

## Settings

| Setting       | Default                          | Description                                          |
| ------------- | -------------------------------- | ---------------------------------------------------- |
| Debug mode    | `true`                           | Verbose logging to DevTools console (`Cmd+Option+I`) |
| CLI path      | (auto-detected)                  | Absolute path to the `claude` binary                 |
| System prompt | "You are a helpful assistant..." | Sent with every call                                 |
| Model         | `sonnet`                         | Claude model alias                                   |
| Max budget    | `50000`                          | Token budget per call                                |

## Making it your own

If you're forking this as a starting point for your own plugin:

- [ ] Update `manifest.json` — change `id`, `name`, `author`, `authorUrl`, `description`
- [ ] Update `package.json` — change `name` and `description`
- [ ] Delete `src/commands/expand.ts` and add your own commands
- [ ] Update the `registerCommands()` call in `main.ts`
- [ ] Tweak the default system prompt in `src/types.ts`
- [ ] Update this README

## License

MIT
