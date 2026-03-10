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

    const durationDays = diffDaysInclusive(range.startDate, range.endDate);

    try {
      await mutateConfig({
        section: "releaseTrains",
        action: "add",
        item: {
          name: form.name,
          targetRelease: form.targetRelease,
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

    const durationDays = diffDaysInclusive(range.startDate, range.endDate);

    try {
      await mutateConfig({
        section: "releaseTrains",
        action: "update",
        id: editingId,
        item: {
          name: editForm.name,
          targetRelease: editForm.targetRelease,
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

  function findReplicaWindow(baseDate, trains) {
    let startDate = getNextMonday(baseDate);

    for (let i = 0; i < 52; i += 1) {
      const endDate = addDays(startDate, 3);
      const blockedByFreeze = hasFreezeOverlap(startDate, endDate);
      const blockedByReplicaTrain = hasReplicaOverlap(startDate, endDate, trains);

      if (!blockedByFreeze && !blockedByReplicaTrain) {
        return { startDate, endDate };
      }

      startDate = addDays(startDate, 7);
    }

    return null;
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

    if (hasUnreadyScope(train)) {
      setError("All scope records must be ready before moving a UAT release train to replica.");
      return;
    }

    const replicaEnvironment = environments.find((env) => getEnvironmentCategory(env) === "replica");
    if (!replicaEnvironment) {
      setError("Replica environment is not configured.");
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

      const replicaTrainId = `rep-${Date.now()}`;
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

      const nextConfig = {
        ...latest,
        releaseTrains: [
          ...(latest.releaseTrains || []).map((item) =>
            item.id === latestSource.id ? { ...item, replicaReleaseTrainId: replicaTrainId } : item
          ),
          newReplicaTrain
        ]
      };

      await mutateConfig({ mode: "replace", config: nextConfig });
      setMessage("Replica release train created successfully (Monday to Thursday)." );
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
              placeholder="26.3.4"
              value={form.targetRelease}
              onChange={(event) => setForm((prev) => ({ ...prev, targetRelease: event.target.value }))}
            />
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
                const canCreateReplica = isUat && train.status === "Signed Off";

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
                          Create Replica
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
