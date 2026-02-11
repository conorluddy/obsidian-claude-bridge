# Obsidian Claude Bridge

An Obsidian plugin that bridges your vault with the [Claude CLI](https://docs.anthropic.com/en/docs/claude-code). Select text, run a command, and Claude processes it — with structured output validation, per-note session continuity, and a base command pattern you can extend.

https://github.com/user-attachments/assets/50eb8bb9-82b3-48c2-8b15-d2121a6511ad

## Installation

1. Clone into your vault's plugin directory:
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

## Usage

1. Select text in any note
2. Open the command palette (`Cmd+P`)
3. Run **"Expand selection with Claude"**
4. The selection is replaced with Claude's response

Session IDs are stored in each note's frontmatter (`claude_session`), so follow-up calls maintain conversation context.

## Architecture

```
src/
├── main.ts              Plugin entry point — loads settings, resolves CLI, registers commands
├── types.ts             All interfaces and default settings
├── schemas.ts           Zod schemas + JSON Schema generation for structured output
├── logger.ts            Category-based logger ([claude-bridge:*] in DevTools console)
├── settings.ts          Settings tab UI (debug mode, CLI path, model, system prompt, token budget)
├── session-manager.ts   Per-note session persistence via frontmatter
├── claude-service.ts    Spawns Claude CLI, parses JSON response, extracts structured output
└── commands/
    ├── base-command.ts  Abstract command lifecycle (context → prompt → call → validate → render)
    └── expand.ts        Example command: expand/improve selected text
```

## Adding a new command

1. Create a file in `src/commands/` extending `BaseCommand`:
   ```typescript
   export class SummariseCommand extends BaseCommand<{ summary: string }> {
     readonly id = "claude-bridge-summarise";
     readonly name = "Summarise selection with Claude";

     getSchema() {
       return createCommandSchema(
         z.object({ summary: z.string().describe("A concise summary") })
       );
     }

     buildPrompt(context: CommandContext): string {
       return `Summarise this:\n\n${context.selection}`;
     }

     render(editor: Editor, result: CommandResult<{ summary: string }>) {
       editor.replaceSelection(result.output.summary);
     }
   }
   ```
2. Register it in `main.ts`:
   ```typescript
   this.registerCommands([
     new ExpandCommand(this.sessionManager, this.settings, this.logger),
     new SummariseCommand(this.sessionManager, this.settings, this.logger),
   ]);
   ```
3. Rebuild: `npm run build`

## Claude CLI quirks

Hard-won lessons from building this plugin:

| Issue | Detail |
|---|---|
| **PATH not inherited** | Obsidian's Electron env lacks your shell PATH. The plugin resolves the CLI path at startup by checking known locations and falling back to `zsh -lc "which claude"`. |
| **Output format** | Use `--output-format json` (not `stream-json`, which hangs when collecting stdout). Returns a single JSON array of message objects. |
| **Structured output** | `--json-schema` makes Claude call an internal `StructuredOutput` tool. The validated object is at `assistant.message.content[].input` where `block.name === "StructuredOutput"` — **not** in `result.result`. |
| **Max turns** | `--max-turns 1` is too few with `--json-schema` (tool call = turn 1, tool result = turn 2). Use `--max-turns 2` minimum. |
| **stdin must close** | When spawning with `stdio: ["pipe", "pipe", "pipe"]`, call `proc.stdin.end()` immediately or the CLI hangs waiting for input. |

## Settings

| Setting | Default | Description |
|---|---|---|
| Debug mode | `true` | Verbose logging to DevTools console (`Cmd+Option+I`) |
| CLI path | (auto-detected) | Absolute path to the `claude` binary |
| System prompt | "You are a helpful assistant..." | Sent with every call |
| Model | `sonnet` | Claude model alias |
| Max budget | `50000` | Token budget per call |

## License

MIT
