// .github/scripts/bump-preview.mjs
//
// Pins every @medusajs/* dependency across all workspace manifests to the
// CONCRETE version currently published under each package's `preview` dist-tag,
// then prints whether anything changed.
//
// Why concrete versions (not the bare "preview" tag): Medusa Cloud's build
// pipeline runs semver on the @medusajs/medusa version in package.json before
// installing, and a bare "preview" is not a valid semver comparator
// ("Invalid comparator: preview"). Design-system packages (e.g. @medusajs/ui)
// are also on a separate version line from core, so each package is resolved to
// its OWN preview version rather than a single shared one.
//
// Uses only Node.js built-ins. The caller is responsible for updating the
// lockfile (pnpm install --lockfile-only) and committing.
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const TAG = "preview"
const SCOPE = "@medusajs/"
const DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
]

const cache = new Map()
function resolvePreviewVersion(name) {
  if (cache.has(name)) return cache.get(name)
  let lastErr
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const version = execFileSync("npm", ["view", `${name}@${TAG}`, "version"], {
        encoding: "utf8",
      }).trim()
      cache.set(name, version)
      return version
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(`bump-preview: could not resolve ${name}@${TAG} after 3 attempts: ${lastErr}`)
}

function findManifests(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...findManifests(full))
    else if (entry.name === "package.json") out.push(full)
  }
  return out
}

let changed = 0
for (const file of findManifests(process.cwd())) {
  const pkg = JSON.parse(readFileSync(file, "utf8"))
  let touched = false
  for (const field of DEP_FIELDS) {
    const deps = pkg[field]
    if (!deps) continue
    for (const name of Object.keys(deps)) {
      if (!name.startsWith(SCOPE)) continue
      const version = resolvePreviewVersion(name)
      if (version && deps[name] !== version) {
        deps[name] = version
        touched = true
      }
    }
  }
  if (touched) {
    writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n")
    changed++
    console.log(`bump-preview: pinned @medusajs/* in ${file}`)
  }
}

console.log(`bump-preview: updated ${changed} manifest(s) to the latest preview`)
