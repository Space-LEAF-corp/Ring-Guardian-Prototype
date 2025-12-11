// Scenario runner for Ring Guardian Prototype
const assert = require("assert");

// For simplicity, we run the same file via child_process to capture output.
const { spawn } = require("child_process");

function runPrototype() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["src/ring-guardian-prototype.js"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`Exited with code ${code}: ${stderr}`));
      resolve(stdout);
    });
  });
}

(async () => {
  const out = await runPrototype();

  // Basic assertions for key prompts
  assert(out.includes("Leaving detected. Would you like me to arm the home"), "Departure prompt missing");
  assert(out.includes("Front door is unlocked. Seal the sanctuary?"), "Lock prompt missing");
  assert(out.includes("Oven is still on"), "Appliance prompt missing");
  assert(out.includes("Child departed school. Estimated arrival"), "Child ETA prompt missing");
  assert(out.includes("plans a store detour. Approve?"), "Detour approval prompt missing");
  assert(out.includes("Detour approved"), "Detour approval feedback missing");
  assert(out.includes("arrival overdue beyond"), "Arrival overdue prompt missing");
  assert(out.includes("Quiet Cabin Mode enabled"), "Quiet Cabin Mode feedback missing");

  console.log("All scenario checks passed.");
})();
