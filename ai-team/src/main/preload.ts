import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("jay", {
  runNow: () => ipcRenderer.invoke("run-now"),
  onState: (cb: (state: string) => void) => ipcRenderer.on("state", (_e, s) => cb(s)),
  onResult: (cb: (result: unknown) => void) => ipcRenderer.on("result", (_e, r) => cb(r)),
  onLog: (cb: (line: string) => void) => ipcRenderer.on("log", (_e, l) => cb(l)),
});
