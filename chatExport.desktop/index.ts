/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import definePlugin, { PluginNative } from "@utils/types";
import { MessageFlags } from "@vencord/discord-types/enums";
import { MessageStore } from "@webpack/common";

const Native = VencordNative.pluginHelpers.LocalChatExport as PluginNative<typeof import("./native")>;
let exporting = false;

export default definePlugin({
    name: "LocalChatExport",
    description: "Export loaded messages in the current chat to a local JSON file with /export.",
    authors: [{ name: "Local user", id: 0n }],
    tags: ["Chat", "Commands"],
    dependencies: ["CommandsAPI"],
    commands: [{
        name: "export",
        description: "Сохранить загруженные сообщения открытого чата в JSON.",
        inputType: ApplicationCommandInputType.BUILT_IN,
        execute: async (_, ctx) => {
            const channelId = ctx.channel.id;
            const notify = (content: string) => sendBotMessage(channelId, {
                content,
                author: { username: "LocalChatExport" }
            });

            if (exporting) {
                notify("Экспорт уже выполняется. Заверши или отмени окно сохранения.");
                return;
            }

            exporting = true;
            try {
                const cache = MessageStore.getMessages(channelId);
                const messages = [...new Map((cache?._array ?? [])
                    .filter(m => m.channel_id === channelId && /^\d{17,20}$/.test(m.id)
                        && m.state === "SENT" && !m.deleted && !(m.flags & MessageFlags.EPHEMERAL))
                    .map(m => [m.id, m])).values()]
                    .sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1)
                    .map(m => ({
                        id: m.id,
                        author: { id: m.author.id, username: m.author.username },
                        timestamp: new Date(m.timestamp.valueOf()).toISOString(),
                        editedTimestamp: m.editedTimestamp ? new Date(m.editedTimestamp.valueOf()).toISOString() : null,
                        content: m.content,
                        type: m.type,
                        replyTo: m.messageReference?.message_id ?? null,
                        attachments: m.attachments.map(a => ({
                            id: a.id, filename: a.filename, size: a.size, url: a.url
                        }))
                    }));

                if (!messages.length) {
                    notify("Нет загруженных сообщений для экспорта. Открой чат и дождись загрузки истории.");
                    return;
                }

                const exportedAt = new Date().toISOString();
                const data = JSON.stringify({
                    schemaVersion: 1,
                    exportedAt,
                    channelId,
                    scope: "loaded-messages-only",
                    fullHistory: false,
                    messageCount: messages.length,
                    messages
                }, null, 2);
                const filename = `discord-chat-${channelId}-${exportedAt.replace(/[:.]/g, "-")}.json`;

                notify(`Подготовлено сообщений: ${messages.length}. Выбери, куда сохранить JSON. Это снимок загруженной части истории.`);
                const result = await Native.saveExport(filename, data);
                if (result.canceled) {
                    notify("Экспорт отменён. Файл не сохранён.");
                } else {
                    const displayPath = result.path.replace(/`/g, "ˋ");
                    notify(`Сохранено сообщений: ${messages.length}.\nПуть:\n\`\`\`text\n${displayPath}\n\`\`\``);
                }
            } catch (error) {
                console.error("[LocalChatExport] Export failed", error);
                notify("Не удалось сохранить экспорт. Проверь свободное место и права на выбранную папку. Подробности — в консоли Vencord.");
            } finally {
                exporting = false;
            }
        }
    }]
});
