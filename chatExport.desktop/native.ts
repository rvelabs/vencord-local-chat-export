/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { app, BrowserWindow, dialog, IpcMainInvokeEvent } from "electron";

let saving = false;

export async function saveExport(event: IpcMainInvokeEvent, filename: string, data: string): Promise<
    { canceled: true; } | { canceled: false; path: string; }
> {
    if (saving) throw new Error("A save dialog is already open");
    if (typeof filename !== "string" || !/^discord-chat-\d{17,20}-[\dTZ-]+\.json$/.test(filename))
        throw new Error("Invalid export filename");
    if (typeof data !== "string" || Buffer.byteLength(data, "utf8") > 32 * 1024 * 1024)
        throw new Error("Export exceeds the 32 MiB limit");
    const parsed = JSON.parse(data);
    if (parsed?.schemaVersion !== 1 || parsed.scope !== "loaded-messages-only" || !Array.isArray(parsed.messages))
        throw new Error("Invalid export document");

    saving = true;
    try {
        const options: Electron.SaveDialogOptions = {
            title: "Сохранить экспорт чата Discord",
            defaultPath: join(app.getPath("downloads"), filename),
            filters: [{ name: "JSON", extensions: ["json"] }],
            properties: ["createDirectory", "showOverwriteConfirmation"]
        };
        const parent = BrowserWindow.fromWebContents(event.sender);
        const result = parent
            ? await dialog.showSaveDialog(parent, options)
            : await dialog.showSaveDialog(options);
        if (result.canceled || !result.filePath) return { canceled: true };

        await writeFile(result.filePath, data, "utf8");
        return { canceled: false, path: result.filePath };
    } finally {
        saving = false;
    }
}
