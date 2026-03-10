import { useEffect, useMemo, useState } from "react";
import ShellLayout from "../components/ShellLayout";
import { fetchConfig } from "../lib/client-config";

export default function PanelThreeParallelTrack() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch((err) => setError(err.message));
  }, []);

  const trains = useMemo(() => {
    return [...(config?.releaseTrains || [])].sort((a, b) => {
      if (a.targetRelease < b.targetRelease) return 1;
      if (a.targetRelease > b.targetRelease) return -1;
      return 0;
    });
  }, [config]);

  const releaseSizeMap = useMemo(() => {
    const map = new Map();
    (config?.releaseSizes || []).forEach((size) => map.set(size.id, size.name));
    return map;
  }, [config]);

  const orderedEnvironments = useMemo(() => {
    return [...(config?.environments || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [config]);

  const productionEnvironment = useMemo(() => {
    return orderedEnvironments.find((env) => {
      const text = `${env.name || ""} ${env.track || ""}`.toLowerCase();
      return text.includes("production") || text.includes("prod");
    });
  }, [orderedEnvironments]);

  const stageEnvironments = orderedEnvironments.filter(
    (env) => !productionEnvironment || env.id !== productionEnvironment.id
  );

  return (
    <ShellLayout title="Panel 3 - Parallel Track Representation" subtitle="Simultaneous release journeys across environments.">
      {error ? <p className="error-box">{error}</p> : null}

      <section className="journey-list">
        {trains.map((train) => (
          <article key={train.id} className="journey-card">
            <h3>{train.name}</h3>
            <div className="journey-steps">
              {stageEnvironments.map((environment) => (
                <span key={`${train.id}-${environment.id}`} className="badge" style={{ background: environment.color }}>
                  {environment.name}
                </span>
              ))}
              {stageEnvironments.length > 0 ? <span className="journey-arrow">-&gt;</span> : null}
              <span className="badge stage-gate">Gate</span>
              <span className="journey-arrow">-&gt;</span>
              <span className="badge stage-prod">{productionEnvironment ? productionEnvironment.name : "Production"}</span>
            </div>
            <p>
              Start {train.startDate || "-"}, end {train.endDate || "-"}, status {train.status}.
            </p>
            <p>
              Release sizes: {(train.releaseSizeIds || []).map((id) => releaseSizeMap.get(id)).filter(Boolean).join(", ") || "Not Set"}
            </p>
          </article>
        ))}
      </section>
    </ShellLayout>
  );
}
