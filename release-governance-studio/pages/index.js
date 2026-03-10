import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ShellLayout from "../components/ShellLayout";
import { fetchConfig } from "../lib/client-config";

export default function DashboardPage() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch((err) => setError(err.message));
  }, []);

  const activeFreezes = useMemo(() => {
    if (!config) return 0;
    return config.productionFreezes.filter((item) => item.active).length;
  }, [config]);

  return (
    <ShellLayout
      title="Release Train Governance Process"
      subtitle="Split-panel experience with configurable environments, release trains, and production freeze windows."
    >
      {error ? <p className="error-box">{error}</p> : null}

      <section className="card-grid">
        <Link href="/panel-1-timeline" className="card panel-one">
          <h2>Panel 1</h2>
          <p>Timeline view for schedule and environment occupancy.</p>
        </Link>

        <Link href="/panel-2-flowchart" className="card panel-two">
          <h2>Panel 2</h2>
          <p>Flowchart progression with gates and retrofit loops.</p>
        </Link>

        <Link href="/panel-3-parallel-track" className="card panel-three">
          <h2>Panel 3</h2>
          <p>Parallel release journeys and cross-track movement.</p>
        </Link>
      </section>

      <section className="stats-strip">
        <article>
          <h3>Environments</h3>
          <p>{config?.environments?.length ?? "-"}</p>
        </article>
        <article>
          <h3>Release Trains</h3>
          <p>{config?.releaseTrains?.length ?? "-"}</p>
        </article>
        <article>
          <h3>Active Freezes</h3>
          <p>{activeFreezes}</p>
        </article>
      </section>

      <section className="config-cta">
        <h2>Configuration Center</h2>
        <p>Manage environments, release trains, and production freeze windows from dedicated pages.</p>
        <Link href="/config" className="primary-btn">
          Open Configuration
        </Link>
      </section>
    </ShellLayout>
  );
}
