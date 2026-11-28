#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { normalizeApiUrl, defaultApiUrl, login, logout, authenticatedClient } from "./config.js";
import {
  addRemote,
  cloneRepository,
  createRepository,
  fetchRemote,
  forwardToGit,
  hasHakiRemote,
  isHakiUrl,
  listRepositories,
  matchesHakiRemote,
  pull,
  push,
  repositoryUrlPrefix,
  removeHakiRemote,
  showRemote,
  status,
} from "./workspace.js";

const args = process.argv.slice(2);
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

function help() {
  console.log(`haki ${packageJson.version}

HAKI remote commands:
  haki login [--server <url>]
  haki logout
  haki repos
  haki repo create <name> [description]
  haki clone haki://<repo-id-or-name> [directory]
  haki remote add <name> haki://<repo-id-or-name>
  haki remote remove <name>
  haki fetch [remote]
  haki pull [remote]
  haki push [-m "commit message"] [remote]
  haki status

Other commands such as add, commit, branch, merge, log, and GitHub clone/push
are passed to the installed Git executable.`);
}

async function main(): Promise<number> {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h" || command === "help") {
    help();
    return 0;
  }
  if (command === "--version" || command === "-v") {
    console.log(`haki ${packageJson.version}`);
    return 0;
  }
  if (command === "login") {
    const serverIndex = rest.indexOf("--server");
    const apiUrl = normalizeApiUrl(serverIndex < 0 ? defaultApiUrl : rest[serverIndex + 1] || "");
    await login(apiUrl);
    return 0;
  }
  if (command === "logout") {
    await logout();
    return 0;
  }

  if (command === "repos" || (command === "repo" && rest[0] === "list")) {
    const client = await authenticatedClient();
    await listRepositories(client);
    return 0;
  }
  if (command === "repo" && rest[0] === "create") {
    const client = await authenticatedClient();
    await createRepository(client, rest[1], rest.slice(2).join(" "));
    return 0;
  }
  if (command === "clone" && isHakiUrl(rest[0])) {
    const client = await authenticatedClient();
    await cloneRepository(client, rest[0], rest[1]);
    return 0;
  }
  if (command === "remote" && rest[0] === "add" && isHakiUrl(rest[2])) {
    const client = await authenticatedClient();
    await addRemote(client, rest[1], rest[2]);
    return 0;
  }
  if (command === "remote" && rest[0] === "remove" && rest[1] && await hasHakiRemote()) {
    await removeHakiRemote(rest[1]);
    return 0;
  }
  if (command === "remote" && hasHakiUrlArgument(rest)) {
    throw new Error("Use `haki remote add <name> haki://<repo-id>` to connect a HAKI remote.");
  }
  if (command === "remote" && rest[0] === "-v" && await hasHakiRemote()) {
    await showRemote();
    return 0;
  }

  if (command === "push" && await shouldUseHakiRemote(rest, true)) {
    const client = await authenticatedClient();
    const messageIndex = rest.findIndex((value) => value === "-m" || value === "--message");
    const message = messageIndex >= 0 ? rest[messageIndex + 1] : undefined;
    if (messageIndex >= 0 && !message) throw new Error("Provide a commit message after -m.");
    await push(client, message);
    return 0;
  }
  if (command === "fetch" && await shouldUseHakiRemote(rest)) {
    const client = await authenticatedClient();
    await fetchRemote(client);
    return 0;
  }
  if (command === "pull" && await shouldUseHakiRemote(rest)) {
    const client = await authenticatedClient();
    await pull(client);
    return 0;
  }
  if (command === "status" && rest.length === 0 && await hasHakiRemote()) {
    const client = await authenticatedClient();
    await status(client);
    return 0;
  }

  return forwardToGit(args);
}

function hasHakiUrlArgument(values: string[]) {
  return values.some(isHakiUrl);
}

async function shouldUseHakiRemote(values: string[], allowMessage = false): Promise<boolean> {
  if (!(await hasHakiRemote())) return false;
  const remaining = [...values];
  if (allowMessage) {
    for (let index = 0; index < remaining.length; index++) {
      if (remaining[index] === "-m" || remaining[index] === "--message") {
        if (!remaining[index + 1]) return false;
        remaining.splice(index, 2);
        index--;
      }
    }
  }
  if (remaining.some((value) => value.startsWith("-")) || remaining.length > 1) return false;
  return remaining.length === 0 || matchesHakiRemote(remaining[0]);
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "HAKI CLI command failed.");
  process.exitCode = 1;
}
