import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ShellLayout from "../../components/ShellLayout";
import { fetchConfig, mutateConfig } from "../../lib/client-config";

const monthOptions = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
];

const workflowStatuses = ["Planning", "Scope Freeze", "Test Deployed", "Signed Off"];

const initialForm = {
  name: "",
  targetRelease: "",
  startDate: "",
  endDate: "",
  targetEnvironmentId: "",
  status: "Planning",
  releaseSizeIds: []
};

function parseDateValue(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function addDays(dateValue, days) {
  const copy = new Date(dateValue);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function diffDaysInclusive(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
}

function getStartWeekForDate(startDate) {
  const startOfYear = new Date(startDate.getFullYear(), 0, 1);
  const days = Math.floor((startDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(days / 7) + 1;
}

function getWeekOfMonth(dateValue) {
  return Math.floor((dateValue.getDate() - 1) / 7) + 1;
}

function buildReleaseVersionFromDate(dateValue) {
  const yearPart = dateValue.getFullYear() % 100;
  const monthPart = dateValue.getMonth() + 1;
  const weekPart = getWeekOfMonth(dateValue);
  return `${yearPart}.${monthPart}.${weekPart}`;
}

function parseReleaseVersion(value) {
  const match = /^([0-9]{2})\.([0-9]{1,2})\.([0-9]{1,2})$/.exec(String(value || "").trim());
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    week: Number(match[3])
  };
}

function overlapsRange(startDate, endDate, rangeStart, rangeEnd) {
  return startDate <= rangeEnd && endDate >= rangeStart;
}

function includesMonth(startDate, endDate, monthNumber) {
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const limit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor <= limit) {
    if (cursor.getMonth() + 1 === monthNumber) {
      return true;
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return false;
}

function getEnvironmentCategory(environment) {
  const text = `${environment?.name || ""} ${environment?.track || ""}`.toLowerCase();

  if (text.includes("replica")) return "replica";
  if (text.includes("production") || text.includes("prod")) return "production";
  if (text.includes("uat")) return "uat";
  return "other";
}

function nextStatus(status) {
  const index = workflowStatuses.indexOf(status);
  if (index < 0 || index === workflowStatuses.length - 1) {
    return null;
  }
  return workflowStatuses[index + 1];
}

function getNextMonday(baseDate) {
  const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const day = date.getDay();
  const diff = (8 - day) % 7;
  date.setDate(date.getDate() + diff);
  return date;
}

function hasEnvironmentOverlap(startDate, endDate, trains, environmentId, ignoreTrainIds = []) {
  return trains.some((train) => {
    if (!train?.id || ignoreTrainIds.includes(train.id)) return false;
    if (train.targetEnvironmentId !== environmentId) return false;

    const trainStart = parseDateValue(train.startDate);
    const trainEnd = parseDateValue(train.endDate);
    if (!trainStart || !trainEnd) return false;

    return overlapsRange(startDate, endDate, trainStart, trainEnd);
  });
}

function findRetrofitWindow(baseDate, trains, targetEnvironmentId, ignoreTrainIds = []) {
  let startDate = addDays(baseDate, 0);

  for (let i = 0; i < 90; i += 1) {
    const candidateStart = addDays(startDate, i);
    const candidateEnd = addDays(candidateStart, 6);

    const collides = hasEnvironmentOverlap(candidateStart, candidateEnd, trains, targetEnvironmentId, ignoreTrainIds);

    if (!collides) {
      return { startDate: candidateStart, endDate: candidateEnd };
    }
  }

  return null;
}

function countUatEndingOnDate(dateValue, trains, environments) {
  const dateText = dateValue.toISOString().slice(0, 10);

  return trains.filter((train) => {
    const env = environments.find((item) => item.id === train.targetEnvironmentId);
    if (getEnvironmentCategory(env) !== "uat") return false;
    if (String(train.lifecycleType || "").toLowerCase() === "retrofit") return false;
    return String(train.endDate || "") === dateText;
  }).length;
}

export default function ReleaseTrainsConfigPage() {
  const [releaseTrains, setReleaseTrains] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [releaseSizes, setReleaseSizes] = useState([]);
  const [productionFreezes, setProductionFreezes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggleSelection(values, value) {
    if (values.includes(value)) {
      return values.filter((item) => item !== value);
    }
    return [...values, value];
  }

  function getSizeNames(sizeIds) {
    return (sizeIds || [])
      .map((id) => releaseSizes.find((size) => size.id === id)?.name)
      .filter(Boolean);
  }

  function hasAtLeastOneSize(sizeIds) {
    return Array.isArray(sizeIds) && sizeIds.length > 0;
  }

  function validateTargetReleaseForUat(targetRelease, startDateText, targetEnvironmentId, currentId = "") {
    const environment = environmentMap.get(targetEnvironmentId);
    if (getEnvironmentCategory(environment) !== "uat") {
      return { valid: true };
    }

    const startDate = parseDateValue(startDateText);
    if (!startDate) {
      return { valid: false, message: "Start date is required to validate release version." };
    }

    const parsed = parseReleaseVersion(targetRelease);
    if (!parsed) {
      return { valid: false, message: "Release version format must be YY.M.W (example: 26.3.1)." };
    }

    const expected = buildReleaseVersionFromDate(startDate);
    const normalized = `${parsed.year}.${parsed.month}.${parsed.week}`;
    if (normalized !== expected) {
      return {
        valid: false,
        message: `Release version should match start date. Expected ${expected} (YY.M.W).`
      };
    }

    const duplicateInSameUatEnv = releaseTrains.some((train) => {
      if (train.id === currentId) return false;
      if (String(train.targetRelease || "") !== normalized) return false;

      const trainEnv = environmentMap.get(train.targetEnvironmentId);
      if (getEnvironmentCategory(trainEnv) !== "uat") return false;
      if (String(train.lifecycleType || "").toLowerCase() === "retrofit") return false;

      return train.targetEnvironmentId === targetEnvironmentId;
    });

    if (duplicateInSameUatEnv) {
      return {
        valid: false,
        message: `Release version ${normalized} already exists in this UAT environment.`
      };
    }

    return { valid: true, normalizedVersion: normalized };
  }

  function validateRange(startDateText, endDateText) {
    const startDate = parseDateValue(startDateText);
    const endDate = parseDateValue(endDateText);

    if (!startDate || !endDate) {
      return { valid: false, message: "Start date and end date are required." };
    }

    if (endDate < startDate) {
      return { valid: false, message: "End date must be the same day or after start date." };
    }

    return { valid: true, startDate, endDate };
  }

  async function load() {
    try {
      const config = await fetchConfig();
      setReleaseTrains(config.releaseTrains || []);
      setEnvironments(config.environments || []);
      setReleaseSizes(config.releaseSizes || []);
      setProductionFreezes(config.productionFreezes || []);

      if (!form.targetEnvironmentId && config.environments?.[0]?.id) {
        setForm((prev) => ({ ...prev, targetEnvironmentId: config.environments[0].id }));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const yearOptions = useMemo(() => {
    const years = new Set([String(new Date().getFullYear())]);

    releaseTrains.forEach((train) => {
      const startDate = parseDateValue(train.startDate);
      const endDate = parseDateValue(train.endDate);
      if (!startDate || !endDate) return;

      for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year += 1) {
        years.add(String(year));
      }
    });

    return [...years].sort((a, b) => Number(a) - Number(b));
  }, [releaseTrains]);

  const environmentMap = useMemo(() => {
    const map = new Map();
    environments.forEach((env) => map.set(env.id, env));
    return map;
  }, [environments]);

  const filteredTrains = useMemo(() => {
    return releaseTrains.filter((train) => {
      const startDate = parseDateValue(train.startDate);
      const endDate = parseDateValue(train.endDate);
      if (!startDate || !endDate) return false;

      if (filterYear !== "all" && filterMonth !== "all") {
        const year = Number(filterYear);
        const monthIndex = Number(filterMonth) - 1;
        const rangeStart = new Date(year, monthIndex, 1);
        const rangeEnd = new Date(year, monthIndex + 1, 0);
        return overlapsRange(startDate, endDate, rangeStart, rangeEnd);
      }

      if (filterYear !== "all") {
        const year = Number(filterYear);
        const rangeStart = new Date(year, 0, 1);
        const rangeEnd = new Date(year, 11, 31);
        return overlapsRange(startDate, endDate, rangeStart, rangeEnd);
      }

      if (filterMonth !== "all") {
        return includesMonth(startDate, endDate, Number(filterMonth));
      }

      return true;
    });
  }, [releaseTrains, filterMonth, filterYear]);

  const versionTip = useMemo(() => {
    const dateValue = parseDateValue(form.startDate) || new Date();
    return buildReleaseVersionFromDate(dateValue);
  }, [form.startDate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const range = validateRange(form.startDate, form.endDate);
    if (!range.valid) {
      setError(range.message);
      return;
    }

    if (!hasAtLeastOneSize(form.releaseSizeIds)) {
      setError("Select at least one release size for the release train.");
      return;
    }

    const releaseValidation = validateTargetReleaseForUat(
      form.targetRelease,
      form.startDate,
      form.targetEnvironmentId
    );
    if (!releaseValidation.valid) {
      setError(releaseValidation.message);
      return;
    }

    if (isFreezeBlockedEnvironment(form.targetEnvironmentId) && hasFreezeOverlap(range.startDate, range.endDate)) {
      setError("Release trains in Replica or Production cannot be planned during active production freeze periods.");
      return;
    }

    const durationDays = diffDaysInclusive(range.startDate, range.endDate);

    try {
      await mutateConfig({
        section: "releaseTrains",
        action: "add",
        item: {
          name: form.name,
          targetRelease: releaseValidation.normalizedVersion || form.targetRelease,
          startDate: form.startDate,
          endDate: form.endDate,
          startWeek: getStartWeekForDate(range.startDate),
          durationWeeks: Math.max(1, Math.ceil(durationDays / 7)),
          targetEnvironmentId: form.targetEnvironmentId,
          status: form.status,
          releaseSizeIds: form.releaseSizeIds,
          scopeRecords: []
        }
      });

      setMessage("Release train added.");
      setForm((prev) => ({
        ...initialForm,
        targetEnvironmentId: prev.targetEnvironmentId || "",
        releaseSizeIds: []
      }));
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    setError("");
    setMessage("");

    try {
      await mutateConfig({ section: "releaseTrains", action: "remove", id });
      if (editingId === id) {
        setEditingId("");
        setEditForm(null);
      }
      setMessage("Release train removed.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(train) {
    setError("");
    setMessage("");
    setEditingId(train.id);
    setEditForm({
      name: train.name,
      targetRelease: train.targetRelease,
      startDate: train.startDate || "",
      endDate: train.endDate || "",
      targetEnvironmentId: train.targetEnvironmentId,
      status: train.status,
      releaseSizeIds: Array.isArray(train.releaseSizeIds) ? train.releaseSizeIds : []
    });
  }

  function cancelEdit() {
    setEditingId("");
    setEditForm(null);
  }

  async function saveEdit() {
    if (!editingId || !editForm) return;

    setError("");
    setMessage("");

    const range = validateRange(editForm.startDate, editForm.endDate);
    if (!range.valid) {
      setError(range.message);
      return;
    }

    if (!hasAtLeastOneSize(editForm.releaseSizeIds)) {
      setError("Select at least one release size for the release train.");
      return;
    }

    const releaseValidation = validateTargetReleaseForUat(
      editForm.targetRelease,
      editForm.startDate,
      editForm.targetEnvironmentId,
      editingId
    );
    if (!releaseValidation.valid) {
      setError(releaseValidation.message);
      return;
    }

    if (
      isFreezeBlockedEnvironment(editForm.targetEnvironmentId) &&
      hasFreezeOverlap(range.startDate, range.endDate)
    ) {
      setError("Release trains in Replica or Production cannot be planned during active production freeze periods.");
      return;
    }

    const durationDays = diffDaysInclusive(range.startDate, range.endDate);

    try {
      await mutateConfig({
        section: "releaseTrains",
        action: "update",
        id: editingId,
        item: {
          name: editForm.name,
          targetRelease: releaseValidation.normalizedVersion || editForm.targetRelease,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          startWeek: getStartWeekForDate(range.startDate),
          durationWeeks: Math.max(1, Math.ceil(durationDays / 7)),
          targetEnvironmentId: editForm.targetEnvironmentId,
          status: editForm.status,
          releaseSizeIds: editForm.releaseSizeIds
        }
      });

      setEditingId("");
      setEditForm(null);
      setMessage("Release train updated.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAdvanceStatus(train) {
    const next = nextStatus(train.status);
    if (!next) {
      setMessage("Release train already at final status.");
      return;
    }

    const sourceEnv = environmentMap.get(train.targetEnvironmentId);
    const sourceCategory = getEnvironmentCategory(sourceEnv);
    if (sourceCategory === "uat" && next === "Signed Off" && hasUnreadyScope(train)) {
      setError("All scope records must be marked ready before moving UAT train to Signed Off.");
      setMessage("");
      return;
    }

    setError("");
    setMessage("");

    try {
      await mutateConfig({
        section: "releaseTrains",
        action: "update",
        id: train.id,
        item: { status: next }
      });
      setMessage(`Status advanced to ${next}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function hasUnreadyScope(train) {
    const records = Array.isArray(train.scopeRecords) ? train.scopeRecords : [];
    return records.some((record) => !record.readyForReplica);
  }

  function hasFreezeOverlap(startDate, endDate) {
    return productionFreezes.some((freeze) => {
      if (!freeze.active) return false;
      const freezeStart = parseDateValue(freeze.startDate);
      const freezeEnd = parseDateValue(freeze.endDate);
      if (!freezeStart || !freezeEnd) return false;
      return overlapsRange(startDate, endDate, freezeStart, freezeEnd);
    });
  }

  function isFreezeBlockedEnvironment(environmentId) {
    const environment = environmentMap.get(environmentId);
    const category = getEnvironmentCategory(environment);
    return category === "replica" || category === "production";
  }

  function hasReplicaOverlap(startDate, endDate, trains) {
    return trains.some((train) => {
      const env = environmentMap.get(train.targetEnvironmentId);
      if (getEnvironmentCategory(env) !== "replica") return false;

      const trainStart = parseDateValue(train.startDate);
      const trainEnd = parseDateValue(train.endDate);
      if (!trainStart || !trainEnd) return false;

      return overlapsRange(startDate, endDate, trainStart, trainEnd);
    });
  }

  function hasProductionOverlap(startDate, endDate, trains) {
    return trains.some((train) => {
      const env = environmentMap.get(train.targetEnvironmentId);
      if (getEnvironmentCategory(env) !== "production") return false;

      const trainStart = parseDateValue(train.startDate);
      const trainEnd = parseDateValue(train.endDate);
      if (!trainStart || !trainEnd) return false;

      return overlapsRange(startDate, endDate, trainStart, trainEnd);
    });
  }

  function findReplicaWindow(baseDate, trains) {
    let startDate = getNextMonday(baseDate);

    for (let i = 0; i < 52; i += 1) {
      const endDate = addDays(startDate, 3);
      const blockedByFreeze = hasFreezeOverlap(startDate, endDate);
      const blockedByReplicaTrain = hasReplicaOverlap(startDate, endDate, trains);
      const uatEndCollisionCount = countUatEndingOnDate(startDate, trains, environments);
      const blockedBySequenceCollision = uatEndCollisionCount > 1;

      if (!blockedByFreeze && !blockedByReplicaTrain && !blockedBySequenceCollision) {
        return { startDate, endDate };
      }

      startDate = addDays(startDate, 7);
    }

    return null;
  }

  function findProductionWindow(baseDate, trains) {
    let startDate = addDays(baseDate, 0);

    for (let i = 0; i < 120; i += 1) {
      const candidateDate = addDays(startDate, i);
      const blockedByFreeze = hasFreezeOverlap(candidateDate, candidateDate);
      const blockedByProductionTrain = hasProductionOverlap(candidateDate, candidateDate, trains);

      if (!blockedByFreeze && !blockedByProductionTrain) {
        return { startDate: candidateDate, endDate: candidateDate };
      }
    }

    return null;
  }

  function findOtherUatRetrofitPlacement(baseDate, trains, sourceTrain) {
    const sourceEnvironmentId = sourceTrain.targetEnvironmentId;
    const candidateUatEnvironments = environments.filter((env) => {
      return getEnvironmentCategory(env) === "uat" && env.id !== sourceEnvironmentId;
    });

    let bestPlacement = null;

    candidateUatEnvironments.forEach((environment) => {
      const window = findRetrofitWindow(baseDate, trains, environment.id, [sourceTrain.id]);
      if (!window) return;

      if (!bestPlacement || window.startDate < bestPlacement.window.startDate) {
        bestPlacement = { environment, window };
      }
    });

    return bestPlacement;
  }

  function getRelatedUatSourcesForRetrofit(sourceTrain, trains) {
    return trains
      .filter((train) => {
        const env = environmentMap.get(train.targetEnvironmentId);
        const isUat = getEnvironmentCategory(env) === "uat";
        const isRetrofit = String(train.lifecycleType || "").toLowerCase() === "retrofit";
        return isUat && !isRetrofit && String(train.targetRelease || "") === String(sourceTrain.targetRelease || "");
      })
      .sort((a, b) => {
        const aStart = parseDateValue(a.startDate)?.getTime() || 0;
        const bStart = parseDateValue(b.startDate)?.getTime() || 0;
        return aStart - bStart;
      });
  }

  async function handleCreateReplica(train) {
    setError("");
    setMessage("");

    const sourceEnv = environmentMap.get(train.targetEnvironmentId);
    if (getEnvironmentCategory(sourceEnv) !== "uat") {
      setError("Replica can only be created from UAT release trains.");
      return;
    }

    if (train.status !== "Signed Off") {
      setError("Release train must be Signed Off before creating replica release train.");
      return;
    }

    if (train.replicaReleaseTrainId) {
      setError("Replica release train already exists for this source release train.");
      return;
    }

    if (hasUnreadyScope(train)) {
      setError("All scope records must be ready before moving a UAT release train to replica.");
      return;
    }

    const replicaEnvironment = environments.find((env) => getEnvironmentCategory(env) === "replica");
    if (!replicaEnvironment) {
      setError("Replica environment is not configured.");
      return;
    }

    const productionEnvironment = environments.find((env) => getEnvironmentCategory(env) === "production");
    if (!productionEnvironment) {
      setError("Production environment is not configured.");
      return;
    }

    try {
      const latest = await fetchConfig();
      const latestSource = (latest.releaseTrains || []).find((item) => item.id === train.id);
      if (!latestSource) {
        throw new Error("Source release train not found.");
      }

      const sourceEndDate = parseDateValue(latestSource.endDate) || new Date();
      const baseDate = addDays(sourceEndDate, 1);
      const window = findReplicaWindow(baseDate, latest.releaseTrains || []);

      if (!window) {
        throw new Error("Unable to find an available Monday-Thursday replica slot in the next 12 months.");
      }

      const productionBaseDate = addDays(window.endDate, 1);
      const productionWindow = findProductionWindow(productionBaseDate, latest.releaseTrains || []);
      if (!productionWindow) {
        throw new Error("Unable to find an available production window after replica completion.");
      }

      const replicaTrainId = `rep-${Date.now()}`;
      const productionTrainId = `prd-${Date.now()}`;
      const newReplicaTrain = {
        id: replicaTrainId,
        name: `${latestSource.name} - Replica`,
        targetRelease: latestSource.targetRelease,
        startDate: `${window.startDate.toISOString().slice(0, 10)}`,
        endDate: `${window.endDate.toISOString().slice(0, 10)}`,
        targetEnvironmentId: replicaEnvironment.id,
        status: "Planning",
        releaseSizeIds: latestSource.releaseSizeIds || [],
        scopeRecords: latestSource.scopeRecords || [],
        sourceReleaseTrainId: latestSource.id
      };

      const newProductionTrain = {
        id: productionTrainId,
        name: `${latestSource.name} - Production`,
        targetRelease: latestSource.targetRelease,
        startDate: `${productionWindow.startDate.toISOString().slice(0, 10)}`,
        endDate: `${productionWindow.endDate.toISOString().slice(0, 10)}`,
        targetEnvironmentId: productionEnvironment.id,
        status: "Planning",
        releaseSizeIds: latestSource.releaseSizeIds || [],
        scopeRecords: latestSource.scopeRecords || [],
        sourceReplicaReleaseTrainId: replicaTrainId,
        sourceReleaseTrainId: latestSource.id
      };

      const workingTrains = [...(latest.releaseTrains || []), newReplicaTrain, newProductionTrain];
      const relatedUatSources = getRelatedUatSourcesForRetrofit(latestSource, latest.releaseTrains || []);
      const retrofitAssignments = [];
      const newRetrofitTrains = [];

      relatedUatSources.forEach((sourceTrain, index) => {
        if (sourceTrain.retrofitReleaseTrainId) {
          return;
        }

        const sourceEndDate = parseDateValue(sourceTrain.endDate) || new Date();
        let retrofitBaseDate = addDays(sourceEndDate, 1);

        if (sourceTrain.id === latestSource.id) {
          const afterReplica = addDays(window.endDate, 1);
          if (retrofitBaseDate < afterReplica) {
            retrofitBaseDate = afterReplica;
          }
        }

        const retrofitPlacement = findOtherUatRetrofitPlacement(retrofitBaseDate, workingTrains, sourceTrain);
        if (!retrofitPlacement) {
          throw new Error(`Unable to find a 1-week retrofit slot in another UAT environment for ${sourceTrain.name}.`);
        }

        const retrofitTrainId = `ret-${Date.now()}-${index + 1}`;
        const retrofitTrain = {
          id: retrofitTrainId,
          name: `${sourceTrain.name} - Retrofit (${retrofitPlacement.environment.name})`,
          targetRelease: `retrofit-${sourceTrain.targetRelease}`,
          startDate: `${retrofitPlacement.window.startDate.toISOString().slice(0, 10)}`,
          endDate: `${retrofitPlacement.window.endDate.toISOString().slice(0, 10)}`,
          targetEnvironmentId: retrofitPlacement.environment.id,
          status: "Planning",
          releaseSizeIds: sourceTrain.releaseSizeIds || [],
          scopeRecords: sourceTrain.scopeRecords || [],
          lifecycleType: "retrofit",
          sourceReleaseTrainId: sourceTrain.id,
          retrofitSourceReleaseTrainId: sourceTrain.id,
          sourceReplicaReleaseTrainId: sourceTrain.id === latestSource.id ? replicaTrainId : ""
        };

        workingTrains.push(retrofitTrain);
        newRetrofitTrains.push(retrofitTrain);
        retrofitAssignments.push({ sourceId: sourceTrain.id, retrofitId: retrofitTrainId });
      });

      const nextConfig = {
        ...latest,
        releaseTrains: [
          ...(latest.releaseTrains || []).map((item) =>
            retrofitAssignments.some((assignment) => assignment.sourceId === item.id) || item.id === latestSource.id
              ? {
                  ...item,
                  replicaReleaseTrainId:
                    item.id === latestSource.id ? replicaTrainId : item.replicaReleaseTrainId,
                  productionReleaseTrainId:
                    item.id === latestSource.id ? productionTrainId : item.productionReleaseTrainId,
                  retrofitReleaseTrainId:
                    retrofitAssignments.find((assignment) => assignment.sourceId === item.id)?.retrofitId ||
                    item.retrofitReleaseTrainId
                }
              : item
          ),
          newReplicaTrain,
          newProductionTrain,
          ...newRetrofitTrains
        ]
      };

      await mutateConfig({ mode: "replace", config: nextConfig });
      setMessage(
        `Replica and Production created; ${newRetrofitTrains.length} retrofit release train(s) planned for UAT1/UAT2/UAT3.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ShellLayout
      title="Release Train Configuration"
      subtitle="Workflow-driven release trains with UAT-to-Replica governance and strict scheduling rules."
    >
      <section className="form-card">
        <h2>Add Release Train</h2>
        <form className="data-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>

          <label>
            Target Release
            <input
              required
              placeholder="26.3.1"
              value={form.targetRelease}
              onChange={(event) => setForm((prev) => ({ ...prev, targetRelease: event.target.value }))}
            />
            <small className="hint-text">
              Tip: Use <strong>YY.M.W</strong> format. Example <strong>{versionTip}</strong> means year 26, month 3,
              week 1 of that month.
            </small>
          </label>

          <label>
            Start Date
            <input
              required
              type="date"
              value={form.startDate}
              onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </label>

          <label>
            End Date
            <input
              required
              type="date"
              value={form.endDate}
              onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </label>

          <label>
            Target Environment
            <select
              required
              value={form.targetEnvironmentId}
              onChange={(event) => setForm((prev) => ({ ...prev, targetEnvironmentId: event.target.value }))}
            >
              {environments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Workflow Status
            <select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              {workflowStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>

          <div className="checklist-block">
            <p>Release Size Combination (at least one required)</p>
            <div className="checklist-grid">
              {releaseSizes.map((size) => (
                <label key={size.id} className="table-checkbox">
                  <input
                    type="checkbox"
                    checked={form.releaseSizeIds.includes(size.id)}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        releaseSizeIds: toggleSelection(prev.releaseSizeIds, size.id)
                      }))
                    }
                  />
                  {size.name}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="primary-btn">Add Release Train</button>
        </form>
      </section>

      {message ? <p className="success-box">{message}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      <section className="table-card">
        <div className="section-head">
          <h2>Current Release Trains</h2>
          <div className="filter-row">
            <label className="filter-field">
              Month
              <select value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)}>
                <option value="all">All Months</option>
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              Year
              <select value={filterYear} onChange={(event) => setFilterYear(event.target.value)}>
                <option value="all">All Years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Release</th>
                <th>Environment</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Release Sizes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrains.map((train) => {
                const isEditing = editingId === train.id;
                const environment = environmentMap.get(train.targetEnvironmentId);
                const environmentName = environment?.name || "-";
                const sizeNames = getSizeNames(train.releaseSizeIds);
                const canAdvance = Boolean(nextStatus(train.status));
                const isUat = getEnvironmentCategory(environment) === "uat";
                const canCreateReplica =
                  isUat &&
                  train.status === "Signed Off" &&
                  !train.replicaReleaseTrainId &&
                  !train.productionReleaseTrainId;

                return (
                  <tr key={train.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.name || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      ) : (
                        train.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.targetRelease || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, targetRelease: event.target.value }))}
                        />
                      ) : (
                        train.targetRelease
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="table-input"
                          value={editForm?.targetEnvironmentId || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, targetEnvironmentId: event.target.value }))}
                        >
                          {environments.map((env) => (
                            <option key={env.id} value={env.id}>
                              {env.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        environmentName
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          type="date"
                          value={editForm?.startDate || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, startDate: event.target.value }))}
                        />
                      ) : (
                        train.startDate || "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          type="date"
                          value={editForm?.endDate || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, endDate: event.target.value }))}
                        />
                      ) : (
                        train.endDate || "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="checklist-grid">
                          {releaseSizes.map((size) => (
                            <label key={`${train.id}-${size.id}`} className="table-checkbox">
                              <input
                                type="checkbox"
                                checked={Boolean(editForm?.releaseSizeIds?.includes(size.id))}
                                onChange={() =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    releaseSizeIds: toggleSelection(prev.releaseSizeIds || [], size.id)
                                  }))
                                }
                              />
                              {size.name}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="tag-list">
                          {sizeNames.map((name) => (
                            <span key={`${train.id}-${name}`} className="mini-tag">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="table-input"
                          value={editForm?.status || "Planning"}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
                        >
                          {workflowStatuses.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="mini-tag workflow-tag">{train.status}</span>
                      )}
                    </td>
                    <td className="action-cell">
                      {isEditing ? (
                        <>
                          <button className="primary-btn" onClick={saveEdit}>Save</button>
                          <button className="secondary-btn" onClick={cancelEdit}>Cancel</button>
                        </>
                      ) : (
                        <button className="secondary-btn" onClick={() => startEdit(train)}>Edit</button>
                      )}

                      <Link href={`/config/release-trains/${train.id}/scope`} className="secondary-btn inline-link-btn">
                        Scope Page
                      </Link>

                      {!isEditing && canAdvance ? (
                        <button className="secondary-btn" onClick={() => handleAdvanceStatus(train)}>
                          Advance
                        </button>
                      ) : null}

                      {!isEditing && canCreateReplica ? (
                        <button className="primary-btn" onClick={() => handleCreateReplica(train)}>
                          Move to Replica + Production
                        </button>
                      ) : null}

                      <button className="danger-btn" onClick={() => handleDelete(train.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </ShellLayout>
  );
}
