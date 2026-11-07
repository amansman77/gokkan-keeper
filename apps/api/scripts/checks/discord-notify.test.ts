import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiscordNotifySchema } from '@gokkan-keeper/shared';

void test('discord-notify accepts text, text embeds, or both, and nothing that makes Discord fetch on our behalf', () => {
  assert.ok(DiscordNotifySchema.safeParse({ content: 'weekly report' }).success);
  const card = { title: '🟡 이번 주', description: '주의 1', color: 0xf1c40f, fields: [{ name: 'CP-CD', value: '🟢 0.53%p', inline: true }], footer: { text: '기준 11/6' } };
  assert.ok(DiscordNotifySchema.safeParse({ embeds: [card], fileName: 'r.txt', fileContent: 'table' }).success);
  assert.ok(DiscordNotifySchema.safeParse({ content: 'x', embeds: [card] }).success);

  assert.equal(DiscordNotifySchema.safeParse({}).success, false);
  assert.equal(DiscordNotifySchema.safeParse({ content: 'x'.repeat(1901) }).success, false);
  // remote images, links and authors are not part of the contract
  assert.equal(DiscordNotifySchema.safeParse({ embeds: [{ ...card, image: { url: 'https://example.com/a.png' } }] }).success, false);
  assert.equal(DiscordNotifySchema.safeParse({ embeds: [{ ...card, url: 'https://example.com' }] }).success, false);
  assert.equal(DiscordNotifySchema.safeParse({ embeds: [{ ...card, color: 0x1000000 }] }).success, false);
  assert.equal(DiscordNotifySchema.safeParse({ embeds: Array.from({ length: 11 }, () => card) }).success, false);
  // Discord rejects a message whose embeds total more than 6000 characters
  const long = { description: 'x'.repeat(4000) };
  assert.equal(DiscordNotifySchema.safeParse({ embeds: [long, long] }).success, false);
});
