import { ipcMain, BrowserWindow } from "electron";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { isValidMonth, isValidConfig, isValidUsageData } from "../ipc-validators";
import { configPath, usagePath, dataDir } from "../services/persistence";

export interface DataIpcDeps {
  getRefresher: () => { restart: () => void };
}

export function registerDataIpc(deps: DataIpcDeps) {
  ipcMain.handle("load-config", () => {
    try {
      if (existsSync(configPath)) {
        return JSON.parse(readFileSync(configPath, "utf-8"));
      }
      return {};
    } catch (error) {
      console.error("Error loading config:", error);
      return {};
    }
  });

  ipcMain.handle("save-config", (_, config) => {
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
      writeFileSync(configPath, JSON.stringify(fullConfig, null, 2));

      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("config-updated");
      });

      deps.getRefresher().restart();

      return true;
    } catch (error) {
      console.error("Error saving config:", error);
      return false;
    }
  });

  ipcMain.handle("load-usage", (_, month) => {
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

  ipcMain.handle("save-usage", (_, month, data) => {
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
      writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error("Error saving usage:", error);
      return false;
    }
  });

  ipcMain.handle("get-data-path", () => {
    return dataDir;
  });
}
