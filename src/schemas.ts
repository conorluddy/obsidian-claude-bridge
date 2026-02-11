import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { CommandSchema } from "./types";

/**
 * Schema for a content block inside an API message.
 * Covers both text blocks and tool_use blocks (e.g. StructuredOutput).
 */
export const ContentBlockSchema = z
	.object({
		type: z.string(),
		text: z.string().optional(),
		id: z.string().optional(),
		name: z.string().optional(),
		input: z.record(z.unknown()).optional(),
	})
	.passthrough();

/**
 * Schema for the nested API message object on assistant/user messages.
 */
export const ApiMessageSchema = z
	.object({
		role: z.string(),
		content: z.array(ContentBlockSchema),
		model: z.string().optional(),
		usage: z.record(z.unknown()).optional(),
	})
	.passthrough();

/**
 * Schema for a single message in Claude CLI's --output-format json array.
 */
export const ClaudeMessageSchema = z
	.object({
		type: z.enum(["system", "assistant", "user", "result"]),
		subtype: z.string().optional(),
		session_id: z.string().optional(),
		message: ApiMessageSchema.optional(),
		result: z.string().optional(),
		total_cost_usd: z.number().optional(),
		duration_ms: z.number().optional(),
		num_turns: z.number().optional(),
	})
	.passthrough();

/**
 * The full response is an array of messages.
 */
export const ClaudeResponseArraySchema = z.array(ClaudeMessageSchema);

/**
 * Helper: create a CommandSchema from a Zod schema.
 * Converts the Zod schema to JSON Schema for the --json-schema CLI flag,
 * and keeps the Zod schema for runtime validation.
 */
export function createCommandSchema<T>(
	zodSchema: z.ZodType<T>,
): CommandSchema<T> {
	return {
		zodSchema,
		jsonSchema: zodToJsonSchema(zodSchema, { target: "draft-07" }),
	};
}

/**
 * Simple text response schema — used by the expand command.
 */
export const TextResponseSchema = createCommandSchema(
	z.object({
		text: z.string().describe("The expanded or improved text"),
	}),
);
