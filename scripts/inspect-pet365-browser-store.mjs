const cdpUrl = process.env.PET365_QA_CDP_URL || "http://127.0.0.1:9222";
const targetUrl = process.env.PET365_QA_TARGET_URL || "http://127.0.0.1:3099/pet365care/profile";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpClient {
  constructor(socketUrl) {
    this.nextId = 1;
    this.callbacks = new Map();
    this.socket = new WebSocket(socketUrl);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.callbacks.has(message.id)) return;
      const { resolve, reject } = this.callbacks.get(message.id);
      this.callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result || {});
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.callbacks.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  close() {
    this.socket.close();
  }
}

const listResponse = await fetch(`${cdpUrl}/json/list`);
const targets = await listResponse.json();
const target = targets.find((item) => item.type === "page" && item.url.startsWith("http://127.0.0.1:3099/pet365care"))
  || targets.find((item) => item.type === "page" && item.url.startsWith("http://127.0.0.1:3099"))
  || await (async () => {
    const response = await fetch(`${cdpUrl}/json/new?${encodeURIComponent(targetUrl)}`, { method: "PUT" });
    return response.json();
  })();

const client = new CdpClient(target.webSocketDebuggerUrl);
await client.send("Runtime.enable");
if (!target.url.startsWith("http://127.0.0.1:3099")) {
  await client.send("Page.enable");
  await client.send("Page.navigate", { url: targetUrl });
  await sleep(800);
}

const { result } = await client.send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const raw = localStorage.getItem("pet365care_data") || "";
    let store = null;
    try { store = JSON.parse(raw || "{}"); } catch (error) { return { parseError: String(error), rawChars: raw.length }; }
    const pets = Array.isArray(store.pets) ? store.pets : [];
    return {
      url: location.href,
      rawChars: raw.length,
      topKeys: Object.keys(store || {}).sort(),
      pets: pets.length,
      petFieldKeys: pets.map((pet) => Object.keys(pet).sort()),
      petDetailPresence: pets.map((pet) => ({
        hasName: hasOwn(pet, "name"),
        hasSpecies: hasOwn(pet, "species"),
        hasBreed: hasOwn(pet, "breed"),
        breedType: typeof pet.breed,
        hasAge: hasOwn(pet, "age"),
        ageType: typeof pet.age,
        hasGender: hasOwn(pet, "gender"),
        genderType: typeof pet.gender,
        hasBirthday: hasOwn(pet, "birthday"),
        birthdayType: typeof pet.birthday,
        hasWeight: hasOwn(pet, "weight"),
        weightType: typeof pet.weight,
        hasNeutered: hasOwn(pet, "isNeutered"),
        neuteredType: typeof pet.isNeutered,
        hasAllergies: hasOwn(pet, "allergies"),
        allergiesType: typeof pet.allergies,
        hasMemo: hasOwn(pet, "memo"),
        memoType: typeof pet.memo,
        vaccinations: Array.isArray(pet.vaccinations) ? pet.vaccinations.length : null,
      })),
      careChecks: Array.isArray(store.careChecks) ? store.careChecks.length : null,
      activityLogs: Array.isArray(store.activityLogs) ? store.activityLogs.length : null,
      healthRecords: Array.isArray(store.healthRecords) ? store.healthRecords.length : null,
      settingsKeys: store.settings ? Object.keys(store.settings).length : null,
    };
  })()`,
});

client.close();
console.log(JSON.stringify(result.value, null, 2));
