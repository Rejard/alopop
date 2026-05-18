const baseUrl = process.env.PET365_QA_BASE_URL || "http://127.0.0.1:3099";
const cdpUrl = process.env.PET365_QA_CDP_URL || "http://127.0.0.1:9222";
const routes = [
  "/pet365care",
  "/pet365care/care",
  "/pet365care/health",
  "/pet365care/hospitals",
  "/pet365care/profile",
  "/pet365care/social",
  "/pet365care/admin",
];

const createTarget = async () => {
  const response = await fetch(`${cdpUrl}/json/new?${encodeURIComponent(`${baseUrl}/pet365care`)}`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error(`CDP target create failed: ${response.status}`);
  return response.json();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  constructor(socketUrl) {
    this.nextId = 1;
    this.callbacks = new Map();
    this.events = [];
    this.socket = new WebSocket(socketUrl);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.callbacks.has(message.id)) {
        const { resolve, reject } = this.callbacks.get(message.id);
        this.callbacks.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
        return;
      }
      if (message.method) this.events.push(message);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    const result = new Promise((resolve, reject) => this.callbacks.set(id, { resolve, reject }));
    this.socket.send(payload);
    return result;
  }

  close() {
    this.socket.close();
  }
}

const target = await createTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
await client.send("Page.enable");
await client.send("Runtime.enable");
await client.send("Log.enable");
await client.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await client.send("Emulation.setUserAgentOverride", {
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

const failures = [];
const results = [];

for (const route of routes) {
  const firstEventIndex = client.events.length;
  await client.send("Page.navigate", { url: `${baseUrl}${route}` });
  await sleep(1_000);

  const { result } = await client.send("Runtime.evaluate", {
    returnByValue: true,
    awaitPromise: true,
    expression: `(() => {
      const root = document.documentElement;
      const text = document.body.innerText || "";
      const actions = [...document.querySelectorAll("button,a")]
        .map((element) => (element.textContent || "").replace(/\\s+/g, " ").trim())
        .filter(Boolean);
      return {
        route: ${JSON.stringify(route)},
        path: location.pathname,
        horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        textSample: text.slice(0, 240),
        hasPrivateAccent: [...document.querySelectorAll("*")].some((element) => {
          const style = getComputedStyle(element);
          return (
            style.color.includes("156, 72, 234") ||
            style.backgroundColor.includes("156, 72, 234") ||
            style.borderColor.includes("156, 72, 234")
          );
        }),
        hasCamera: actions.some((textValue) => textValue.includes("AI 카메라")),
        hasSync: actions.some((textValue) => textValue.includes("동기화")),
        hasBackup: actions.some((textValue) => textValue.includes("백업")),
        hasSocialWrite: actions.some((textValue) => textValue.includes("글쓰기")),
        hasManualCommand: text.includes("sync-hospitals.ts --clear"),
      };
    })()`,
  });

  const consoleErrors = client.events
    .slice(firstEventIndex)
    .filter((event) => {
      if (event.method === "Runtime.exceptionThrown") return true;
      if (event.method !== "Log.entryAdded") return false;
      return event.params?.entry?.level === "error";
    })
    .map((event) => {
      if (event.method === "Runtime.exceptionThrown") {
        return event.params?.exceptionDetails?.text || "runtime exception";
      }
      return event.params?.entry?.text || "log error";
    })
    .filter((message) => !message.includes("favicon") && !message.includes("404"));

  const info = { ...result.value, consoleErrors: consoleErrors.slice(0, 5) };
  results.push(info);

  if (info.horizontalOverflow) failures.push(`${route} has horizontal overflow`);
  if (consoleErrors.length > 0) failures.push(`${route} has console errors: ${consoleErrors[0]}`);
}

client.close();
await fetch(`${cdpUrl}/json/close/${target.id}`).catch(() => {});

console.log(JSON.stringify(results, null, 2));

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
