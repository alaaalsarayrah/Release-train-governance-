import { useEffect, useMemo, useState } from "react";
import ShellLayout from "../components/ShellLayout";
import { fetchConfig } from "../lib/client-config";

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

const quarterOptions = [
  { value: "1", label: "Quarter 1 (Jan-Mar)" },
  { value: "2", label: "Quarter 2 (Apr-Jun)" },
  { value: "3", label: "Quarter 3 (Jul-Sep)" },
  { value: "4", label: "Quarter 4 (Oct-Dec)" }
];

function parseDateValue(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDateLabel(dateValue) {
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function dayDiff(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);
}

function addDays(dateValue, days) {
  const copy = new Date(dateValue);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getQuarterFromMonth(month) {
  return Math.floor((month - 1) / 3) + 1;
}

function getQuarterStartDate(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  return new Date(year, startMonth, 1);
}

function getQuarterEndDate(startDate) {
  return new Date(startDate.getFullYear(), startDate.getMonth() + 3, 0);
}

function getOverlap(startDate, endDate, rangeStart, rangeEnd) {
  const overlapStart = startDate > rangeStart ? startDate : rangeStart;
  const overlapEnd = endDate < rangeEnd ? endDate : rangeEnd;

  if (overlapStart > overlapEnd) {
    return null;
  }

  return { overlapStart, overlapEnd };
}

function getEnvironmentCategory(environment) {
  const text = `${environment?.name || ""} ${environment?.track || ""}`.toLowerCase();

  if (text.includes("replica")) return "replica";
  if (text.includes("production") || text.includes("prod")) return "production";
  if (text.includes("uat")) return "uat";
  return "other";
}

export default function PanelOneTimeline() {
  const today = new Date();
  const [config, setConfig] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1));
  const [selectedQuarter, setSelectedQuarter] = useState(String(getQuarterFromMonth(today.getMonth() + 1)));
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [viewMode, setViewMode] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [activePreset, setActivePreset] = useState("current");
  const [error, setError] = useState("");

  function clearCustomRange() {
    setCustomStartDate("");
    setCustomEndDate("");
  }

  function applyCurrentMonth() {
    setSelectedMonth(String(today.getMonth() + 1));
    setSelectedQuarter(String(getQuarterFromMonth(today.getMonth() + 1)));
    setSelectedYear(String(today.getFullYear()));
    setViewMode("month");
    clearCustomRange();
    setActivePreset("current");
  }

  function applyNextMonth() {
    const baseDate =
      viewMode === "quarter"
        ? getQuarterStartDate(Number(selectedYear), Number(selectedQuarter))
        : new Date(Number(selectedYear), Number(selectedMonth) - 1, 1);

    const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
    setSelectedMonth(String(nextMonth.getMonth() + 1));
    setSelectedQuarter(String(getQuarterFromMonth(nextMonth.getMonth() + 1)));
    setSelectedYear(String(nextMonth.getFullYear()));
    setViewMode("month");
    clearCustomRange();
    setActivePreset("next");
  }

  function applyThisQuarter() {
    const quarter = getQuarterFromMonth(Number(selectedMonth));
    const quarterStart = getQuarterStartDate(Number(selectedYear), quarter);
    setSelectedQuarter(String(quarter));
    setSelectedMonth(String(quarterStart.getMonth() + 1));
    setViewMode("quarter");
    clearCustomRange();
    setActivePreset("quarter");
  }

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch((err) => setError(err.message));
  }, []);

  const environments = useMemo(() => {
    return [...(config?.environments || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [config]);

  const releaseSizeMap = useMemo(() => {
    const map = new Map();
    (config?.releaseSizes || []).forEach((size) => map.set(size.id, size.name));
    return map;
  }, [config]);

  const activeFreezes = useMemo(() => {
    return (config?.productionFreezes || []).filter((freeze) => freeze.active);
  }, [config]);

  const yearOptions = useMemo(() => {
    const years = new Set([String(today.getFullYear()), selectedYear]);

    (config?.releaseTrains || []).forEach((train) => {
      const startDate = parseDateValue(train.startDate);
      const endDate = parseDateValue(train.endDate);
      if (!startDate || !endDate) return;

      for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year += 1) {
        years.add(String(year));
      }
    });

    return [...years].sort((a, b) => Number(a) - Number(b));
  }, [config, selectedYear, today]);

  const customRange = useMemo(() => {
    const startDate = parseDateValue(customStartDate);
    const endDate = parseDateValue(customEndDate);

    if (!startDate || !endDate) {
      return { valid: false, startDate: null, endDate: null, hasBoth: Boolean(customStartDate && customEndDate) };
    }

    if (endDate < startDate) {
      return { valid: false, startDate, endDate, hasBoth: true };
    }

    return { valid: true, startDate, endDate, hasBoth: true };
  }, [customStartDate, customEndDate]);

  const defaultRange = useMemo(() => {
    if (viewMode === "quarter") {
      const startDate = getQuarterStartDate(Number(selectedYear), Number(selectedQuarter));
      return { startDate, endDate: getQuarterEndDate(startDate) };
    }

    const month = Number(selectedMonth);
    const year = Number(selectedYear);
    return {
      startDate: new Date(year, month - 1, 1),
      endDate: new Date(year, month, 0)
    };
  }, [viewMode, selectedMonth, selectedQuarter, selectedYear]);

  const isCustomActive = customRange.valid;
  const rangeStart = isCustomActive ? customRange.startDate : defaultRange.startDate;
  const rangeEnd = isCustomActive ? customRange.endDate : defaultRange.endDate;
  const unitMode = !isCustomActive && viewMode === "quarter" ? "week" : "day";
  const totalDays = dayDiff(rangeStart, rangeEnd) + 1;
  const totalUnits = unitMode === "week" ? Math.max(1, Math.ceil(totalDays / 7)) : totalDays;
  const labelColumnWidth = "148px";

  const scaleHeaders = useMemo(() => {
    return Array.from({ length: totalUnits }, (_, index) => {
      if (unitMode === "week") {
        return { key: `wk-${index + 1}`, label: `Week ${index + 1}` };
      }

      const dateValue = addDays(rangeStart, index);
      const label = viewMode === "month" && !isCustomActive ? String(dateValue.getDate()) : formatDateLabel(dateValue);
      return {
        key: `${dateValue.getFullYear()}-${dateValue.getMonth() + 1}-${dateValue.getDate()}`,
        label
      };
    });
  }, [totalUnits, unitMode, rangeStart, viewMode, isCustomActive]);

  const trainsByEnvironment = useMemo(() => {
    const map = {};

    (config?.releaseTrains || []).forEach((train) => {
      if (!map[train.targetEnvironmentId]) {
        map[train.targetEnvironmentId] = [];
      }
      map[train.targetEnvironmentId].push(train);
    });

    return map;
  }, [config]);

  const trainMap = useMemo(() => {
    const map = new Map();
    (config?.releaseTrains || []).forEach((train) => map.set(train.id, train));
    return map;
  }, [config]);

  return (
    <ShellLayout title="Panel 1 - Timeline View" subtitle="Release train schedule and environment occupancy by day or week.">
      {error ? <p className="error-box">{error}</p> : null}

      <section className="preset-row">
        <button className={activePreset === "current" ? "preset-btn active" : "preset-btn"} onClick={applyCurrentMonth}>
          Current Month
        </button>
        <button className={activePreset === "next" ? "preset-btn active" : "preset-btn"} onClick={applyNextMonth}>
          Next Month
        </button>
        <button className={activePreset === "quarter" ? "preset-btn active" : "preset-btn"} onClick={applyThisQuarter}>
          This Quarter
        </button>
      </section>

      <section className="filter-row timeline-filter-row">
        {viewMode === "quarter" ? (
          <label className="filter-field">
            Quarter
            <select
              value={selectedQuarter}
              onChange={(event) => {
                const quarterValue = event.target.value;
                const quarterStart = getQuarterStartDate(Number(selectedYear), Number(quarterValue));
                setSelectedQuarter(quarterValue);
                setSelectedMonth(String(quarterStart.getMonth() + 1));
                setViewMode("quarter");
                setActivePreset("quarter");
              }}
            >
              {quarterOptions.map((quarter) => (
                <option key={quarter.value} value={quarter.value}>
                  {quarter.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="filter-field">
            Month
            <select
              value={selectedMonth}
              onChange={(event) => {
                const monthValue = event.target.value;
                setSelectedMonth(monthValue);
                setSelectedQuarter(String(getQuarterFromMonth(Number(monthValue))));
                setViewMode("month");
                setActivePreset("custom");
              }}
            >
              {monthOptions.map((monthOption) => (
                <option key={monthOption.value} value={monthOption.value}>
                  {monthOption.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="filter-field">
          Year
          <select
            value={selectedYear}
            onChange={(event) => {
              setSelectedYear(event.target.value);
              setActivePreset("custom");
            }}
          >
            {yearOptions.map((yearOption) => (
              <option key={yearOption} value={yearOption}>
                {yearOption}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          Start Date Filter
          <input
            type="date"
            value={customStartDate}
            onChange={(event) => {
              setCustomStartDate(event.target.value);
              setActivePreset("custom");
            }}
          />
        </label>

        <label className="filter-field">
          End Date Filter
          <input
            type="date"
            value={customEndDate}
            onChange={(event) => {
              setCustomEndDate(event.target.value);
              setActivePreset("custom");
            }}
          />
        </label>

        {(customStartDate || customEndDate) && (
          <button
            className="secondary-btn clear-range-btn"
            onClick={() => {
              clearCustomRange();
              setActivePreset(viewMode === "quarter" ? "quarter" : "custom");
            }}
          >
            Clear Date Filter
          </button>
        )}
      </section>

      {customRange.hasBoth && !customRange.valid ? (
        <p className="error-box">End date must be the same day or after start date.</p>
      ) : null}

      <section className="timeline-board">
        <p className="timeline-range-label">
          {unitMode === "week" ? "Week View" : "Day View"}: {rangeStart.toISOString().slice(0, 10)} to {rangeEnd.toISOString().slice(0, 10)}
        </p>

        <div className="timeline-scale-row" style={{ gridTemplateColumns: `${labelColumnWidth} minmax(0, 1fr)` }}>
          <div />
          <div
            className="timeline-day-header"
            style={{
              gridTemplateColumns: `repeat(${totalUnits}, minmax(0, 1fr))`
            }}
          >
            {scaleHeaders.map((header) => (
              <div key={header.key}>{header.label}</div>
            ))}
          </div>
        </div>

        {environments.map((environment) => (
          <div key={environment.id} className="timeline-row panel1-row" style={{ gridTemplateColumns: `${labelColumnWidth} minmax(0, 1fr)` }}>
            <aside className="panel1-lane-label" style={{ borderColor: environment.color }}>{environment.name}</aside>
            <div className="timeline-track panel1-track">
              {(getEnvironmentCategory(environment) === "replica" || getEnvironmentCategory(environment) === "production")
                ? activeFreezes.map((freeze) => {
                    const freezeStart = parseDateValue(freeze.startDate);
                    const freezeEnd = parseDateValue(freeze.endDate);
                    if (!freezeStart || !freezeEnd) return null;

                    const overlap = getOverlap(freezeStart, freezeEnd, rangeStart, rangeEnd);
                    if (!overlap) return null;

                    const startOffsetDays = dayDiff(rangeStart, overlap.overlapStart);
                    const endOffsetDays = dayDiff(rangeStart, overlap.overlapEnd);
                    const startUnit = unitMode === "week" ? Math.floor(startOffsetDays / 7) : startOffsetDays;
                    const endUnit = unitMode === "week" ? Math.floor(endOffsetDays / 7) : endOffsetDays;
                    const left = (startUnit / totalUnits) * 100;
                    const width = ((endUnit - startUnit + 1) / totalUnits) * 100;

                    return (
                      <div
                        key={`${environment.id}-${freeze.id}`}
                        className="panel1-freeze-block"
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, unitMode === "week" ? 8 : 4)}%`
                        }}
                      >
                        <small>Freeze</small>
                      </div>
                    );
                  })
                : null}

              {(trainsByEnvironment[environment.id] || []).map((train) => {
                const startDate = parseDateValue(train.startDate);
                const endDate = parseDateValue(train.endDate);
                if (!startDate || !endDate) return null;

                const overlap = getOverlap(startDate, endDate, rangeStart, rangeEnd);
                if (!overlap) return null;

                const startOffsetDays = dayDiff(rangeStart, overlap.overlapStart);
                const endOffsetDays = dayDiff(rangeStart, overlap.overlapEnd);

                const startUnit = unitMode === "week" ? Math.floor(startOffsetDays / 7) : startOffsetDays;
                const endUnit = unitMode === "week" ? Math.floor(endOffsetDays / 7) : endOffsetDays;
                const left = (startUnit / totalUnits) * 100;
                const width = ((endUnit - startUnit + 1) / totalUnits) * 100;
                const compact = width < (unitMode === "week" ? 15 : 17);
                const isRetrofit = String(train.lifecycleType || "").toLowerCase() === "retrofit";
                const retrofitSource = isRetrofit ? trainMap.get(train.retrofitSourceReleaseTrainId) : null;
                const isCrossUatRetrofit =
                  Boolean(retrofitSource) && retrofitSource.targetEnvironmentId !== train.targetEnvironmentId;
                const statusClass = isRetrofit
                  ? isCrossUatRetrofit
                    ? "train-status-tag retrofit-status-tag retrofit-cross-uat"
                    : "train-status-tag retrofit-status-tag"
                  : "train-status-tag";
                const statusText = isRetrofit
                  ? isCrossUatRetrofit
                    ? "Retrofit Other UAT"
                    : "Retrofit"
                  : train.status;

                const sizeLabels = (train.releaseSizeIds || [])
                  .map((sizeId) => releaseSizeMap.get(sizeId))
                  .filter(Boolean);

                const visibleSizeLabels = compact ? [] : sizeLabels.slice(0, 2);
                const hiddenSizeCount = compact ? 0 : Math.max(0, sizeLabels.length - visibleSizeLabels.length);

                return (
                  <article
                    key={train.id}
                    className={compact ? `train-chip panel1-chip compact${isRetrofit ? " retrofit" : ""}` : `train-chip panel1-chip${isRetrofit ? " retrofit" : ""}`}
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, unitMode === "week" ? 8 : 6)}%`,
                      minWidth: compact ? "132px" : "220px",
                      background: environment.color
                    }}
                  >
                    <div className="panel1-chip-top">
                      <strong className="panel1-chip-release">{train.targetRelease}</strong>
                      <small className={statusClass}>{statusText}</small>
                    </div>

                    <p className="panel1-chip-name">{train.name}</p>

                    <div className="panel1-chip-meta">
                      <span className="panel1-chip-dates">
                        {train.startDate} to {train.endDate}
                      </span>

                      <div className="train-chip-tags panel1-size-row">
                        {visibleSizeLabels.map((sizeName) => (
                          <small key={`${train.id}-${sizeName}`} className="train-chip-tag panel1-size-pill">
                            {sizeName}
                          </small>
                        ))}

                        {hiddenSizeCount > 0 ? (
                          <small className="train-chip-tag panel1-size-pill">+{hiddenSizeCount}</small>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </ShellLayout>
  );
}
