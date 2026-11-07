import { z } from 'zod';

/**
 * Body of POST /automation/discord-notify, the relay that headless jobs use to
 * post to the owner's Discord channel. Embeds are limited to text parts —
 * title, description, color, fields and footer — so a caller can lay out a
 * report but cannot make Discord fetch remote images or links on its behalf.
 * Limits are Discord's own.
 */

export const DISCORD_NOTIFY_MAX_CONTENT = 1900; // Discord allows 2000
const EMBED_TOTAL_LIMIT = 6000;

const DiscordEmbedFieldSchema = z.object({
  name: z.string().min(1).max(256),
  value: z.string().min(1).max(1024),
  inline: z.boolean().optional(),
}).strict();

const DiscordEmbedSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  description: z.string().min(1).max(4096).optional(),
  color: z.number().int().min(0).max(0xffffff).optional(),
  fields: z.array(DiscordEmbedFieldSchema).max(25).optional(),
  footer: z.object({ text: z.string().min(1).max(2048) }).strict().optional(),
}).strict();

type DiscordEmbed = z.infer<typeof DiscordEmbedSchema>;

const embedLength = (e: DiscordEmbed) =>
  (e.title?.length ?? 0) + (e.description?.length ?? 0) + (e.footer?.text.length ?? 0)
  + (e.fields ?? []).reduce((s, f) => s + f.name.length + f.value.length, 0);

export const DiscordNotifySchema = z.object({
  content: z.string().min(1).max(DISCORD_NOTIFY_MAX_CONTENT).optional(),
  embeds: z.array(DiscordEmbedSchema).min(1).max(10).optional(),
  fileName: z.string().max(100).optional(),
  fileContent: z.string().optional(),
})
  .refine((b) => b.content || b.embeds, { message: 'content or embeds is required' })
  .refine((b) => (b.embeds ?? []).reduce((s, e) => s + embedLength(e), 0) <= EMBED_TOTAL_LIMIT, {
    message: `embeds must total ${EMBED_TOTAL_LIMIT} characters or fewer`,
  });

export type DiscordNotify = z.infer<typeof DiscordNotifySchema>;
