import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "config.json");

const DEFAULT_SCOPE_ITEMS = [
  "Production incident",
  "UI changes",
  "Standard changes",
  "Updating existing feature",
  "New feature",
  "New platform"
];

const DEFAULT_RELEASE_SIZES = [
  {
    id: "size-small",
    name: "Small",
    scopeItems: ["Production incident", "Standard changes"]
  },
  {
    id: "size-medium",
    name: "Medium",
    scopeItems: ["UI changes", "Updating existing feature", "Standard changes"]
  },
  {
    id: "size-large",
    name: "Large",
    scopeItems: ["UI changes", "Updating existing feature", "New feature"]
  },
  {
    id: "size-very-large",
    name: "Very Large",
    scopeItems: ["New platform", "New feature", "UI changes"]
  }
];

const WORKFLOW_STATUSES = ["Planning", "Scope Freeze", "Test Deployed", "Signed Off"];

function formatDate(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function addDays(dateValue, days) {
  const copy = new Date(dateValue);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function diffDaysInclusive(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);
  return diff + 1;
}

function getStartWeekForDate(startDate) {
  const startOfYear = new Date(startDate.getFullYear(), 0, 1);
  const days = Math.floor((startDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(days / 7) + 1;
}

function overlaps(startA, endA, startB, endB) {
  return startA <= endB && endA >= startB;
}

function normalizeStatus(value) {
  const text = String(value || "").trim().toLowerCase();

  if (text === "planning" || text === "planned") return "Planning";
  if (text === "scope freeze") return "Scope Freeze";
  if (text === "test deployed" || text === "in progress") return "Test Deployed";
  if (text === "signed off" || text === "ready" || text === "completed") return "Signed Off";

  return "Planning";
}

function normalizeReleaseSizeIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((id) => typeof id === "string" && id.trim()))];
}

function normalizeScopeRecords(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((record, index) => ({
    id: record?.id || `scope-${index + 1}`,
    adoId: record?.adoId || "",
    title: record?.title || "",
    scope: record?.scope || "",
    description: record?.description || "",
    squadOrPlatformName: record?.squadOrPlatformName || "",
    platformOwnerOrScrumMasterName: record?.platformOwnerOrScrumMasterName || "",
    epicIdOrKiplotProjectId: record?.epicIdOrKiplotProjectId || "",
    readyForReplica: Boolean(record?.readyForReplica)
  }));
}

function getEnvironmentCategory(environment) {
  const text = `${environment?.name || ""} ${environment?.track || ""}`.toLowerCase();

  if (text.includes("replica")) return "replica";
  if (text.includes("production") || text.includes("prod")) return "production";
  if (text.includes("uat")) return "uat";
  return "other";
}

function deriveDatesFromLegacyWeeks(train) {
  const weekNumber = Number(train.startWeek);
  const weeks = Number(train.durationWeeks);
  if (!Number.isFinite(weekNumber) || weekNumber < 1) {
    return null;
  }

  const baseYear = new Date().getFullYear();
  const startOfYear = new Date(baseYear, 0, 1);
  const startDate = addDays(startOfYear, (weekNumber - 1) * 7);
  const totalDays = Math.max(1, (Number.isFinite(weeks) && weeks > 0 ? weeks : 1) * 7);
  const endDate = addDays(startDate, totalDays - 1);
  return { startDate, endDate };
}

function normalizeReleaseTrain(train) {
  let startDate = parseDate(train.startDate);
  let endDate = parseDate(train.endDate);

  if (!startDate && !endDate) {
    const legacyDates = deriveDatesFromLegacyWeeks(train);
    if (legacyDates) {
      startDate = legacyDates.startDate;
      endDate = legacyDates.endDate;
    }
  }

  if (startDate && !endDate) {
    const weeks = Number(train.durationWeeks);
    const totalDays = Math.max(1, (Number.isFinite(weeks) && weeks > 0 ? weeks : 1) * 7);
    endDate = addDays(startDate, totalDays - 1);
  }

  if (!startDate && endDate) {
    startDate = new Date(endDate);
  }

  if (!startDate && !endDate) {
    startDate = new Date();
    endDate = new Date();
  }

  if (endDate < startDate) {
    endDate = new Date(startDate);
  }

  const durationDays = diffDaysInclusive(startDate, endDate);

  return {
    ...train,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    startWeek: Number.isFinite(Number(train.startWeek)) ? Number(train.startWeek) : getStartWeekForDate(startDate),
    durationWeeks:
      Number.isFinite(Number(train.durationWeeks)) && Number(train.durationWeeks) > 0
        ? Number(train.durationWeeks)
        : Math.max(1, Math.ceil(durationDays / 7)),
    status: normalizeStatus(train.status),
    releaseSizeIds: normalizeReleaseSizeIds(train.releaseSizeIds),
    scopeRecords: normalizeScopeRecords(train.scopeRecords)
  };
}

function normalizeReleaseSize(size) {
  return {
    ...size,
    scopeItems: Array.isArray(size.scopeItems) ? size.scopeItems : []
  };
}

function ensureReleaseTrainHasSize(train) {
  if (!Array.isArray(train.releaseSizeIds) || train.releaseSizeIds.length === 0) {
    throw new Error("Release train must include at least one release size.");
  }
}

function validateWorkflowStatus(train) {
  if (!WORKFLOW_STATUSES.includes(train.status)) {
    throw new Error("Release train status must be one of: Planning, Scope Freeze, Test Deployed, Signed Off.");
  }
}

function hasSizeByName(train, releaseSizeMap, targetName) {
  return (train.releaseSizeIds || []).some((sizeId) => {
    const size = releaseSizeMap.get(sizeId);
    return size?.name?.toLowerCase() === targetName.toLowerCase();
  });
}

function validateUatDurationRules(train, releaseSizeMap, category) {
  if (category !== "uat") return;

  const start = parseDate(train.startDate);
  const end = parseDate(train.endDate);
  if (!start || !end) return;

  const durationDays = diffDaysInclusive(start, end);

  if (hasSizeByName(train, releaseSizeMap, "Very Large")) {
    return;
  }

  if (hasSizeByName(train, releaseSizeMap, "Large") && durationDays !== 21) {
    throw new Error("Large release size in UAT must be exactly 3 weeks (21 days).");
  }

  if (!hasSizeByName(train, releaseSizeMap, "Large") && hasSizeByName(train, releaseSizeMap, "Medium") && durationDays !== 14) {
    throw new Error("Medium release size in UAT must be exactly 2 weeks (14 days).");
  }
}

function ensureSignedOffUatScopeReadyForReplica(train, category) {
  if (category !== "uat") return;
  if (train.status !== "Signed Off") return;

  const hasUnready = (train.scopeRecords || []).some((record) => !record.readyForReplica);
  if (hasUnready) {
    throw new Error("All scope records must be ready before UAT release train can be Signed Off.");
  }
}

function validateReplicaWeeklyWindow(train, category) {
  if (category !== "replica") return;

  const start = parseDate(train.startDate);
  const end = parseDate(train.endDate);
  if (!start || !end) {
    throw new Error("Replica release train requires valid start and end dates.");
  }

  const startDay = start.getDay();
  const endDay = end.getDay();
  const durationDays = diffDaysInclusive(start, end);

  if (startDay !== 1 || endDay !== 4 || durationDays !== 4) {
    throw new Error("Replica release train must run weekly from Monday to Thursday.");
  }
}

function validateNoUatOverlap(train, allTrains, envCategoryMap) {
  const category = envCategoryMap.get(train.targetEnvironmentId) || "other";
  if (category !== "uat") return;

  const start = parseDate(train.startDate);
  const end = parseDate(train.endDate);
  if (!start || !end) return;

  const collision = allTrains.some((other) => {
    if (other.id === train.id) return false;
    if (other.targetEnvironmentId !== train.targetEnvironmentId) return false;

    const otherStart = parseDate(other.startDate);
    const otherEnd = parseDate(other.endDate);
    if (!otherStart || !otherEnd) return false;

    return overlaps(start, end, otherStart, otherEnd);
  });

  if (collision) {
    throw new Error("Only one release train can run at a time in the same UAT environment.");
  }
}

function validateFreezeBlock(train, freezes, category) {
  if (category !== "replica" && category !== "production") return;

  const start = parseDate(train.startDate);
  const end = parseDate(train.endDate);
  if (!start || !end) return;

  const blocked = (freezes || []).some((freeze) => {
    if (!freeze.active) return false;
    const freezeStart = parseDate(freeze.startDate);
    const freezeEnd = parseDate(freeze.endDate);
    if (!freezeStart || !freezeEnd) return false;
    return overlaps(start, end, freezeStart, freezeEnd);
  });

  if (blocked) {
    throw new Error("Production freeze blocks releases to Replica or Production for those dates.");
  }
}

function validateReplicaSource(train, allTrains, envCategoryMap) {
  if (!train.sourceReleaseTrainId) return;

  const source = allTrains.find((item) => item.id === train.sourceReleaseTrainId);
  if (!source) {
    throw new Error("Replica release train source is missing.");
  }

  const sourceCategory = envCategoryMap.get(source.targetEnvironmentId) || "other";
  if (sourceCategory !== "uat") {
    throw new Error("Replica release train source must be from UAT.");
  }

  if (source.status !== "Signed Off") {
    throw new Error("Replica release train source must be Signed Off.");
  }
}

function validateReleaseTrainCollection(releaseTrains, { environments, releaseSizes, productionFreezes }) {
  const releaseSizeMap = new Map((releaseSizes || []).map((size) => [size.id, size]));
  const envCategoryMap = new Map((environments || []).map((env) => [env.id, getEnvironmentCategory(env)]));

  releaseTrains.forEach((train) => {
    ensureReleaseTrainHasSize(train);
    validateWorkflowStatus(train);

    const category = envCategoryMap.get(train.targetEnvironmentId) || "other";

    ensureSignedOffUatScopeReadyForReplica(train, category);
    validateUatDurationRules(train, releaseSizeMap, category);
    validateReplicaWeeklyWindow(train, category);
    validateNoUatOverlap(train, releaseTrains, envCategoryMap);
    validateFreezeBlock(train, productionFreezes || [], category);
    validateReplicaSource(train, releaseTrains, envCategoryMap);
  });
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function readConfig() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw);

  return {
    environments: parsed.environments || [],
    releaseTrains: (parsed.releaseTrains || []).map(normalizeReleaseTrain),
    productionFreezes: parsed.productionFreezes || [],
    gates: parsed.gates || [],
    releaseSizes: (parsed.releaseSizes || DEFAULT_RELEASE_SIZES).map(normalizeReleaseSize),
    releaseScopeCatalog: parsed.releaseScopeCatalog || DEFAULT_SCOPE_ITEMS
  };
}

export async function writeConfig(config) {
  const normalized = {
    environments: config.environments || [],
    releaseTrains: (config.releaseTrains || []).map(normalizeReleaseTrain),
    productionFreezes: config.productionFreezes || [],
    gates: config.gates || [],
    releaseSizes: (config.releaseSizes || DEFAULT_RELEASE_SIZES).map(normalizeReleaseSize),
    releaseScopeCatalog: config.releaseScopeCatalog || DEFAULT_SCOPE_ITEMS
  };

  validateReleaseTrainCollection(normalized.releaseTrains, {
    environments: normalized.environments,
    releaseSizes: normalized.releaseSizes,
    productionFreezes: normalized.productionFreezes
  });

  await fs.writeFile(DATA_FILE, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export async function mutateConfig({ section, action, id, item }) {
  const current = await readConfig();

  if (!section || !Array.isArray(current[section])) {
    throw new Error("Invalid section supplied");
  }

  if (action === "add") {
    const nextItem = {
      ...item,
      id: item?.id || createId(section.slice(0, 3))
    };
    current[section].push(nextItem);
  } else if (action === "update") {
    current[section] = current[section].map((entry) =>
      entry.id === id ? { ...entry, ...item, id: entry.id } : entry
    );
  } else if (action === "remove") {
    current[section] = current[section].filter((entry) => entry.id !== id);
  } else {
    throw new Error("Unsupported action");
  }

  return writeConfig(current);
}
