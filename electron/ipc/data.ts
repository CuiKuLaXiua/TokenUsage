import { ipcMain, BrowserWindow } from "electron";
import { readFileSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";
import { isValidMonth, isValidConfig, isValidUsageData } from "../ipc-validators";
import { configPath, usagePath, dataDir } from "../services/persistence";
import { IPC } from "../core/ipc-channels";

export interface DataIpcDeps {
  getRefresher: () => { restart: () => void };
}

let cachedConfig: Record<string, any> | null = null;
let configLoaded = false;

export function registerDataIpc(deps: DataIpcDeps) {
  ipcMain.handle(IPC.CONFIG.LOAD, () => {
    if (configLoaded) {
      return cachedConfig;
    }
    try {
      if (existsSync(configPath)) {
        cachedConfig = JSON.parse(readFileSync(configPath, "utf-8"));
      } else {
        cachedConfig = {};
      }
      configLoaded = true;
      return cachedConfig;
    } catch (error) {
      console.error("Error loading config:", error);
      cachedConfig = {};
      configLoaded = true;
      return cachedConfig;
    }
  });

  ipcMain.handle(IPC.CONFIG.SAVE, async (_, config) => {
    try {
      if (!isValidConfig(config)) {
        console.error("Invalid config structure");
        return false;
      }
      let fullConfig = config;
      try {
        if (existsSync(configPath)) {
          const existing = JSON.parse(readFileSync(configPath, "utf-8"));
          fullConfig = { ...existing, ...config };
        }
      } catch {
        /* ignore */
      }
      await writeFile(configPath, JSON.stringify(fullConfig, null, 2));

      // 清空缓存，使后续 load-config 读到最新数据
      cachedConfig = null;
      configLoaded = false;

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(IPC.CONFIG_UPDATED);
      });

      deps.getRefresher().restart();

      return true;
    } catch (error) {
      console.error("Error saving config:", error);
      return false;
    }
  });

  ipcMain.handle(IPC.USAGE.LOAD, (_, month) => {
    try {
      if (!isValidMonth(month)) {
        console.error("Invalid month format:", month);
        return [];
      }
      const filePath = join(usagePath, `${month}.json`);
      if (existsSync(filePath)) {
        return JSON.parse(readFileSync(filePath, "utf-8"));
      }
      return [];
    } catch (error) {
      console.error("Error loading usage:", error);
      return [];
    }
  });

  ipcMain.handle(IPC.USAGE.SAVE, async (_, month, data) => {
    try {
      if (!isValidMonth(month)) {
        console.error("Invalid month format:", month);
        return false;
      }
      if (!isValidUsageData(data)) {
        console.error("Invalid usage data");
        return false;
      }
      const filePath = join(usagePath, `${month}.json`);
      await writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error("Error saving usage:", error);
      return false;
    }
  });

  ipcMain.handle(IPC.DATA_PATH, () => {
    return dataDir;
  });
}
