import { useEffect, useMemo, useState } from "react";
import ShellLayout from "../components/ShellLayout";
import { fetchConfig } from "../lib/client-config";

export default function PanelTwoFlowchart() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch((err) => setError(err.message));
  }, []);

  const orderedEnvironments = useMemo(() => {
    return [...(config?.environments || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [config]);

  const productionEnvironment = useMemo(() => {
    return orderedEnvironments.find((env) => {
      const text = `${env.name || ""} ${env.track || ""}`.toLowerCase();
      return text.includes("production") || text.includes("prod");
    });
  }, [orderedEnvironments]);

  const activeFreezes = (config?.productionFreezes || []).filter((freeze) => freeze.active);

  const gateDetails = useMemo(() => {
    const map = new Map();
    (config?.gates || []).forEach((gate) => map.set(gate.name, gate.criteria));
    return map;
  }, [config]);

  const nonProductionEnvironments = orderedEnvironments.filter(
    (env) => !productionEnvironment || env.id !== productionEnvironment.id
  );

  const steps = [
    ...nonProductionEnvironments.map((env) => `${env.name} (${env.durationWeeks} week${env.durationWeeks === 1 ? "" : "s"})`),
    ...(config?.gates || []).map((gate) => gate.name),
    productionEnvironment ? productionEnvironment.name : "Production"
  ];

  return (
    <ShellLayout title="Panel 2 - Flowchart Style" subtitle="Release stage progression with gates and retrofit loops.">
      {error ? <p className="error-box">{error}</p> : null}

      <section className="flow-stack">
        {steps.map((step, index) => (
          <div key={step} className="flow-node">
            <span className="flow-index">{index + 1}</span>
            <div>
              <h3>{step}</h3>
              {gateDetails.get(step) ? <p>{gateDetails.get(step)}</p> : null}
              {step === (productionEnvironment ? productionEnvironment.name : "Production") ? (
                <p>Weekly releases with monitoring and rollback readiness.</p>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      <section className="freeze-box">
        <h3>Production Freeze Windows</h3>
        {activeFreezes.length === 0 ? <p>No active freeze windows.</p> : null}
        {activeFreezes.map((freeze) => (
          <article key={freeze.id}>
            <strong>{freeze.title}</strong>
            <p>
              {freeze.startDate} to {freeze.endDate}
            </p>
            <p>{freeze.scope}</p>
          </article>
        ))}
      </section>
    </ShellLayout>
  );
}
