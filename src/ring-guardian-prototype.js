/* 
  Ring Guardian Prototype — Single File
  Node 18+ (no external deps for demo)
*/

class GuardianEvent {
  constructor(type, payload) {
    this.type = type;
    this.payload = payload;
    this.timestamp = new Date();
  }
}

const Context = {
  household: { name: "Heroes Cabin Sanctuary", location: "Ocala, Florida" },
  members: [
    { id: "parent-1", name: "Leif", role: "parent" },
    { id: "child-1", name: "JD", role: "child" },
  ],
  devices: {
    locks: [{ id: "front-lock", name: "Front Door", locked: true }],
    appliances: [
      { id: "oven", name: "Oven", on: false },
      { id: "stove", name: "Stove", on: false },
      { id: "iron", name: "Iron", on: false },
    ],
    cameras: [{ id: "front-cam", name: "Front Door Camera" }],
  },
  preferences: {
    ceremonialTone: true,
    nudgesEnabled: true,
    autoArmOnDeparture: false,
    consentRequiredForChildDetours: true,
    arrivalDelayThresholdMinutes: 15,
  },
};

class EventBus {
  constructor() { this.listeners = []; }
  subscribe(handler) { this.listeners.push(handler); }
  emit(event) { for (const h of this.listeners) h(event); }
}
const bus = new EventBus();

class LearningEngine {
  constructor() {
    this.state = {
      lastDepartures: [],
      usualDepartureHour: null,
      childRoutes: {},
      missedLockCount: 0,
      missedApplianceOffCount: 0,
    };
  }
  recordDeparture(ts) {
    this.state.lastDepartures.push(ts);
    const hours = this.state.lastDepartures.map((d) => d.getHours());
    const avg = hours.reduce((a, b) => a + b, 0) / Math.max(1, hours.length);
    this.state.usualDepartureHour = Math.round(avg);
  }
  recordDoorUnlockedDeparture() { this.state.missedLockCount++; }
  recordApplianceLeftOn() { this.state.missedApplianceOffCount++; }
  learnChildRoute(childId, routeSummary) { this.state.childRoutes[childId] = routeSummary; }
  getInsights() {
    return {
      usualDepartureHour: this.state.usualDepartureHour,
      lockRisk: this.state.missedLockCount > 2 ? "elevated" : "normal",
      applianceRisk: this.state.missedApplianceOffCount > 2 ? "elevated" : "normal",
      childRoutes: this.state.childRoutes,
    };
  }
}
const learning = new LearningEngine();

class GuardianAI {
  constructor(context, learning) { this.context = context; this.learning = learning; }
  interpret(event) {
    switch (event.type) {
      case "ring_motion":
      case "ring_doorbell": return this.handleRing(event);
      case "door_lock": return this.handleLock(event);
      case "appliance": return this.handleAppliance(event);
      case "calendar": return this.handleCalendar(event);
      case "gps": return this.handleGPS(event);
      case "manual": return this.handleManual(event);
      default: return null;
    }
  }
  ceremonial(message) { return this.context.preferences.ceremonialTone ? `Ceremonial Steward Alert: ${message}` : message; }

  handleRing(event) {
    const cam = this.context.devices.cameras.find((c) => c.id === event.payload.cameraId);
    if (event.type === "ring_motion" && cam?.id === "front-cam") {
      const msg = "Leaving detected. Would you like me to arm the home and check locks?";
      return this.prompt("parent-1", this.ceremonial(msg), {
        actions: ["Arm", "Skip", "AskLater"], context: { kind: "departure_check" },
      });
    }
    if (event.type === "ring_doorbell") {
      const msg = "Doorbell rang. Shall I enable Quiet Cabin Mode (soft chime, warm lights)?";
      return this.prompt("parent-1", this.ceremonial(msg), {
        actions: ["Enable", "Skip"], context: { kind: "quiet_cabin" },
      });
    }
    return null;
  }

  handleLock(event) {
    const lock = this.context.devices.locks.find((l) => l.id === event.payload.lockId);
    if (!lock) return null;
    lock.locked = !!event.payload.locked;

    if (!lock.locked && event.payload.reason === "departure") {
      this.learning.recordDoorUnlockedDeparture();
      const msg = "Front door is unlocked. Seal the sanctuary?";
      return this.prompt("parent-1", this.ceremonial(msg), {
        actions: ["Lock", "Skip"], context: { kind: "lock_reminder", lockId: lock.id },
      });
    }
    return null;
  }

  handleAppliance(event) {
    const app = this.context.devices.appliances.find((a) => a.id === event.payload.id);
    if (!app) return null;
    app.on = !!event.payload.on;

    if (app.on && event.payload.reason === "departure") {
      this.learning.recordApplianceLeftOn();
      const msg = `${app.name} is still on. Would you like a timed reminder or remote shutoff?`;
      return this.prompt("parent-1", this.ceremonial(msg), {
        actions: ["RemindIn10", "RemindIn30", "ShutOff", "Skip"],
        context: { kind: "appliance_departure", applianceId: app.id },
      });
    }
    if (app.on && event.payload.safety === "overdue") {
      const msg = `${app.name} has been on longer than usual. Stewardship check recommended.`;
      return this.prompt("parent-1", this.ceremonial(msg), {
        actions: ["ShutOff", "KeepOn", "AskLater"],
        context: { kind: "appliance_overdue", applianceId: app.id },
      });
    }
    return null;
  }

  handleCalendar(event) {
    if (event.payload.kind === "school_dismissal") {
      const childId = event.payload.childId;
      const eta = this.calculateETA(event.payload.dismissalTime, event.payload.route);
      this.learning.learnChildRoute(childId, { route: event.payload.route, eta });

      const msg = `Child departed school. Estimated arrival ${eta}. Prepare home?`;
      return this.prompt("parent-1", this.ceremonial(msg), {
        actions: ["PrepLights", "UnlockDoor", "NoChange"],
        context: { kind: "child_eta", childId, eta },
      });
    }
    return null;
  }

  handleGPS(event) {
    const { subjectId, routeStatus } = event.payload;

    if (routeStatus === "store_detour" && this.context.preferences.consentRequiredForChildDetours) {
      const child = this.context.members.find((m) => m.id === subjectId);
      const childMsg = "You’re stopping at the store. Notify parents for quick approval?";
      const parentMsg = `${child?.name || "Child"} plans a store detour. Approve?`;

      return [
        this.prompt(subjectId, this.ceremonial(childMsg), {
          actions: ["NotifyParents", "Skip"], context: { kind: "child_detour_request" },
        }),
        this.prompt("parent-1", this.ceremonial(parentMsg), {
          actions: ["Yes", "No"], context: { kind: "parent_detour_approval", childId: subjectId },
        }),
      ];
    }

    if (routeStatus === "arrival_overdue") {
      const threshold = this.context.preferences.arrivalDelayThresholdMinutes;
      const msg = `Child arrival overdue beyond ${threshold} minutes. Stewardship check recommended.`;
      return this.prompt("parent-1", this.ceremonial(msg), {
        actions: ["RequestLocation", "Call", "AskLater"],
        context: { kind: "arrival_delay" },
      });
    }

    if (routeStatus === "arrived_home") {
      const msg = "Future Captain has docked — welcome home.";
      return this.prompt("parent-1", this.ceremonial(msg), {
        actions: ["Acknowledge"], context: { kind: "child_arrived" },
      });
    }
    return null;
  }

  handleManual(event) {
    const { action, context } = event.payload;
    switch (context?.kind) {
      case "departure_check":
        if (action === "Arm") return this.feedback("parent-1", "Home armed. I’ll also check locks and appliances.");
        if (action === "AskLater") return this.feedback("parent-1", "Okay — I’ll remind you in a few minutes.");
        break;
      case "lock_reminder":
        if (action === "Lock") return this.feedback("parent-1", "Front door locked. Sanctuary sealed.");
        break;
      case "appliance_departure":
        if (action === "ShutOff") return this.feedback("parent-1", "Appliance shut off. Cabin remains safe.");
        if (action?.startsWith("RemindIn")) {
          const mins = parseInt(action.replace("RemindIn", ""), 10);
          return this.feedback("parent-1", `I’ll remind you in ${mins} minutes.`);
        }
        break;
      case "appliance_overdue":
        if (action === "ShutOff") return this.feedback("parent-1", "Appliance shut off.");
        break;
      case "child_detour_request":
        if (action === "NotifyParents") return this.feedback("child-1", "Parents notified. Awaiting quick approval.");
        break;
      case "parent_detour_approval":
        if (action === "Yes") return [
          this.feedback("parent-1", "Detour approved."),
          this.feedback("child-1", "Detour approved. Enjoy and stay safe."),
        ];
        if (action === "No") return [
          this.feedback("parent-1", "Detour declined."),
          this.feedback("child-1", "Please come straight home. We’ll revisit later."),
        ];
        break;
      case "child_eta":
        if (action === "PrepLights") return this.feedback("parent-1", "Lights warmed. Sanctuary ready for arrival.");
        if (action === "UnlockDoor") return this.feedback("parent-1", "Door unlocked for quick entry.");
        break;
      case "quiet_cabin":
        if (action === "Enable") return this.feedback("parent-1", "Quiet Cabin Mode enabled: soft chime, warm lights.");
        break;
    }
    return null;
  }

  calculateETA(dismissalTime, route) {
    const dt = new Date(dismissalTime);
    dt.setMinutes(dt.getMinutes() + 45);
    return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  prompt(recipientId, message, meta) { return { kind: "prompt", to: recipientId, message, meta }; }
  feedback(recipientId, message) { return { kind: "feedback", to: recipientId, message }; }
}

class RingAdapter {
  constructor(bus) { this.bus = bus; }
  simulateMotion(cameraId = "front-cam") { this.bus.emit(new GuardianEvent("ring_motion", { cameraId })); }
  simulateDoorbell(cameraId = "front-cam") { this.bus.emit(new GuardianEvent("ring_doorbell", { cameraId })); }
}
class LockAdapter {
  constructor(bus) { this.bus = bus; }
  simulateUnlocked(reason = "departure") { this.bus.emit(new GuardianEvent("door_lock", { lockId: "front-lock", locked: false, reason })); }
  simulateLocked() { this.bus.emit(new GuardianEvent("door_lock", { lockId: "front-lock", locked: true })); }
}
class ApplianceAdapter {
  constructor(bus) { this.bus = bus; }
  simulateOn(id = "oven", reason = "departure") { this.bus.emit(new GuardianEvent("appliance", { id, on: true, reason })); }
  simulateOverdue(id = "stove") { this.bus.emit(new GuardianEvent("appliance", { id, on: true, safety: "overdue" })); }
}
class FamilyAdapter {
  constructor(bus) { this.bus = bus; }
  simulateSchoolDismissal(childId = "child-1") {
    const dismissalTime = new Date();
    this.bus.emit(new GuardianEvent("calendar", { kind: "school_dismissal", childId, dismissalTime, route: "school->home" }));
  }
  simulateChildDetour(childId = "child-1") { this.bus.emit(new GuardianEvent("gps", { subjectId: childId, routeStatus: "store_detour" })); }
  simulateArrivalOverdue(childId = "child-1") { this.bus.emit(new GuardianEvent("gps", { subjectId: childId, routeStatus: "arrival_overdue" })); }
  simulateArrivedHome(childId = "child-1") { this.bus.emit(new GuardianEvent("gps", { subjectId: childId, routeStatus: "arrived_home" })); }
}
class ManualAdapter {
  constructor(bus) { this.bus = bus; }
  respond(action, context) { this.bus.emit(new GuardianEvent("manual", { action, context })); }
}

class PromptDispatcher {
  static deliver(msg) {
    if (Array.isArray(msg)) { msg.forEach((m) => PromptDispatcher.print(m)); }
    else { PromptDispatcher.print(msg); }
  }
  static print(msg) {
    const who = Context.members.find((m) => m.id === msg.to)?.name || msg.to;
    console.log(`[To ${who}] ${msg.message}`);
    if (msg.kind === "prompt") console.log(`  Actions: ${(msg.meta?.actions || []).join(", ")}`);
  }
}

function main() {
  const ai = new GuardianAI(Context, learning);
  bus.subscribe((event) => {
    if (event.type === "ring_motion") learning.recordDeparture(event.timestamp);
    const out = ai.interpret(event);
    if (!out) return;
    PromptDispatcher.deliver(out);
  });

  const ring = new RingAdapter(bus);
  const locks = new LockAdapter(bus);
  const apps = new ApplianceAdapter(bus);
  const fam = new FamilyAdapter(bus);
  const manual = new ManualAdapter(bus);

  ring.simulateMotion();
  locks.simulateUnlocked("departure");
  apps.simulateOn("oven", "departure");
  fam.simulateSchoolDismissal("child-1");
  fam.simulateChildDetour("child-1");
  manual.respond("Yes", { kind: "parent_detour_approval", childId: "child-1" });
  fam.simulateArrivalOverdue("child-1");
  fam.simulateArrivedHome("child-1");
  ring.simulateDoorbell();
}

main();
