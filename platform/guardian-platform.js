/*
  Guardian Security Platform — Core Module
  Purpose: Extend Ring Guardian Prototype with verifiable protocol manifests,
           secure action registry, and audit logs for authorship + integration.

  Usage: Import into your Ring Guardian runtime and register platform actions.
*/

const crypto = require("crypto");

class GuardianPlatform {
  constructor({ productName = "Ring Guardian Prototype", manifest, store }) {
    this.productName = productName;
    this.manifest = manifest || {};
    this.store = store || new InMemoryStore();
    this.registry = new ActionRegistry();
    this.auditor = new Auditor(this.store, this.manifest);
  }

  // Register actions from adapters or guardians (locks, plugs, notifications, etc.)
  registerAction(actionDef) {
    this.registry.register(actionDef);
    return this.auditor.record("action_register", {
      actionId: actionDef.id,
      name: actionDef.name,
      provider: actionDef.provider,
      scope: actionDef.scope, // "home", "device", "family", "enterprise"
    });
  }

  // Execute an action with audit logging
  async execute(actionId, payload) {
    const action = this.registry.get(actionId);
    if (!action) throw new Error(`Unknown action: ${actionId}`);

    // Pre‑flight consent and safety checks
    if (action.requiresConsent && !payload?.consentGranted) {
      this.auditor.record("action_denied", { actionId, reason: "consent_missing" });
      return { ok: false, reason: "consent_missing" };
    }
    if (action.safetyCheck && !(await action.safetyCheck(payload))) {
      this.auditor.record("action_denied", { actionId, reason: "safety_check_failed" });
      return { ok: false, reason: "safety_check_failed" };
    }

    // Execute provider function
    const result = await action.run(payload);

    // Audit the result with signed entry
    this.auditor.record("action_execute", {
      actionId,
      payloadSummary: summarize(payload),
      resultSummary: summarize(result),
    });

    return { ok: true, result };
  }

  // Produce a signed platform report for authorship and governance
  generateSignedReport() {
    return this.auditor.signReport({
      productName: this.productName,
      manifest: this.manifest,
      entries: this.store.getAll(),
      generatedAt: new Date().toISOString(),
    });
  }
}

class ActionRegistry {
  constructor() {
    this.actions = new Map();
  }
  register(def) {
    if (!def?.id || !def?.name || typeof def.run !== "function") {
      throw new Error("Invalid action definition");
    }
    this.actions.set(def.id, def);
  }
  get(id) { return this.actions.get(id); }
  list() { return Array.from(this.actions.values()); }
}

class Auditor {
  constructor(store, manifest) {
    this.store = store;
    this.manifest = manifest;
    this.reportKeyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  }

  record(kind, data) {
    const entry = {
      id: crypto.randomUUID(),
      kind,
      ts: new Date().toISOString(),
      data,
      manifestHash: hash(JSON.stringify(this.manifest)),
    };
    this.store.add(entry);
    return entry;
  }

  signReport(report) {
    const json = JSON.stringify(report);
    const signature = crypto.sign("sha256", Buffer.from(json), this.reportKeyPair.privateKey)
      .toString("base64");
    const publicKeyPem = this.reportKeyPair.publicKey.export({ type: "pkcs1", format: "pem" });
    return { report, signature, publicKeyPem };
  }
}

class InMemoryStore {
  constructor() { this.entries = []; }
  add(e) { this.entries.push(e); }
  getAll() { return this.entries.slice(); }
}

function summarize(obj) {
  if (obj == null) return "null";
  const s = JSON.stringify(obj);
  return s.length > 260 ? s.slice(0, 257) + "..." : s;
}

function hash(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/* ---------- Example actions to register ---------- */

// Lock front door
const lockFrontDoorAction = {
  id: "lock.frontDoor",
  name: "Lock Front Door",
  provider: "SmartLockVendor",
  scope: "home",
  requiresConsent: false,
  safetyCheck: async (payload) => true,
  run: async (payload) => {
    // Replace with vendor SDK call
    return { message: "Front door locked", lockId: payload?.lockId || "front-lock" };
  },
};

// Shut off appliance
const shutOffApplianceAction = {
  id: "appliance.shutOff",
  name: "Shut Off Appliance",
  provider: "SmartPlugVendor",
  scope: "home",
  requiresConsent: true,
  safetyCheck: async (payload) => !!payload?.applianceId,
  run: async (payload) => {
    // Replace with vendor SDK call
    return { message: "Appliance shut off", applianceId: payload.applianceId };
  },
};

// Send prompt notification
const notifyPromptAction = {
  id: "notify.prompt",
  name: "Notify Prompt",
  provider: "GuardianMessaging",
  scope: "family",
  requiresConsent: false,
  safetyCheck: async () => true,
  run: async ({ to, message, actions }) => {
    // Replace with push/SMS provider
    return { deliveredTo: to, message, actions };
  },
};

/* ---------- Bootstrapping ---------- */
function createPlatform({ manifest, store } = {}) {
  const platform = new GuardianPlatform({ manifest, store });
  platform.registerAction(lockFrontDoorAction);
  platform.registerAction(shutOffApplianceAction);
  platform.registerAction(notifyPromptAction);
  return platform;
}

module.exports = {
  GuardianPlatform,
  createPlatform,
};
