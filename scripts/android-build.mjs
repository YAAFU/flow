import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const mode = process.argv[2] === "release" ? "release" : "debug";
const root = process.cwd();
const capBin = path.join(
  root,
  "node_modules",
  "@capacitor",
  "cli",
  "bin",
  "capacitor",
);

function assertSupportedJava() {
  const executable = process.env.JAVA_HOME
    ? path.join(
        process.env.JAVA_HOME,
        "bin",
        process.platform === "win32" ? "java.exe" : "java",
      )
    : "java";
  const result = spawnSync(executable, ["-version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const versionOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = versionOutput.match(/version "(?:1\.)?(\d+)/);
  const major = match ? Number(match[1]) : 0;
  if (result.status !== 0 || major < 17) {
    throw new Error(
      "Android build requires JDK 17 or newer. "
        + "Set JAVA_HOME to a supported JDK before running this command.",
    );
  }
}

function run(command, args, env = process.env, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? 1}`));
    });
  });
}

const buildEnvironment = {
  ...process.env,
  CAPACITOR_ANDROID_DEBUG: mode === "debug" ? "1" : "0",
  NEXT_PUBLIC_FLOW_DEBUG_STARTUP: mode === "debug" ? "1" : "0",
};

assertSupportedJava();

await run(process.execPath, [
  path.join(root, "scripts", "validate-android-icons.mjs"),
]);
await run(
  process.execPath,
  [path.join(root, "scripts", "native-export.mjs")],
  buildEnvironment,
);
await run(process.execPath, [
  path.join(root, "scripts", "validate-native-export.mjs"),
]);
await run(
  process.execPath,
  [capBin, "sync", "android"],
  buildEnvironment,
);

const gradle = path.join(
  root,
  "android",
  process.platform === "win32" ? "gradlew.bat" : "gradlew",
);
const gradleTask = mode === "debug" ? "assembleDebug" : "assembleRelease";
const gradleCommand =
  process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : gradle;
const gradleArguments =
  process.platform === "win32"
    ? ["/d", "/s", "/c", `gradlew.bat clean ${gradleTask}`]
    : ["clean", gradleTask];

await run(
  gradleCommand,
  gradleArguments,
  process.env,
  path.join(root, "android"),
);
