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
  markContacted: (category: string, name: string, phone: string | null) =>
    ipcRenderer.invoke("mark-contacted", category, name, phone),
  sendSms: (target: { category: string; name: string; phone: string | null; message: string }) =>
    ipcRenderer.invoke("send-sms", target),
  runCommand: (instruction: string, agentId?: string) => ipcRenderer.invoke("run-command", instruction, agentId),
  getCommandHistory: (agentId: string) => ipcRenderer.invoke("get-command-history", agentId),
  getTeamRoles: () => ipcRenderer.invoke("get-team-roles"),
  getTaskProgress: () => ipcRenderer.invoke("get-task-progress"),
  toggleTaskProgress: (id: string) => ipcRenderer.invoke("toggle-task-progress", id),
  onTaskProgress: (cb: (state: unknown) => void) => ipcRenderer.on("task-progress", (_e, s) => cb(s)),
  onCommandState: (cb: (state: string) => void) => ipcRenderer.on("command-state", (_e, s) => cb(s)),
  onAgentState: (cb: (payload: { agent: string; state: string; bubble?: string }) => void) =>
    ipcRenderer.on("agent-state", (_e, p) => cb(p)),
  onRepo: (cb: (repo: unknown) => void) => ipcRenderer.on("repo", (_e, r) => cb(r)),
  getRepoReport: () => ipcRenderer.invoke("get-repo-report"),
  runRepoNow: () => ipcRenderer.invoke("run-repo-now"),
  runJournalNow: () => ipcRenderer.invoke("run-journal-now"),
});
