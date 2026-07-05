import { contextBridge, ipcRenderer, clipboard } from "electron";

contextBridge.exposeInMainWorld("jay", {
  runNow: () => ipcRenderer.invoke("run-now"),
  onState: (cb: (state: string) => void) => ipcRenderer.on("state", (_e, s) => cb(s)),
  onResult: (cb: (result: unknown) => void) => ipcRenderer.on("result", (_e, r) => cb(r)),
  onMina: (cb: (mina: unknown) => void) => ipcRenderer.on("mina", (_e, m) => cb(m)),
  onFunnel: (cb: (funnel: unknown) => void) => ipcRenderer.on("funnel", (_e, f) => cb(f)),
  onContent: (cb: (content: unknown) => void) => ipcRenderer.on("content", (_e, c) => cb(c)),
  onLog: (cb: (line: string) => void) => ipcRenderer.on("log", (_e, l) => cb(l)),
  copyText: (text: string) => clipboard.writeText(text),
});
