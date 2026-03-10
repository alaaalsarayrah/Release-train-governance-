import Link from "next/link";
import ShellLayout from "../../components/ShellLayout";

export default function ConfigHome() {
  return (
    <ShellLayout title="Configuration Center" subtitle="Control all release governance inputs from dedicated admin pages.">
      <section className="card-grid">
        <Link href="/config/environments" className="card panel-one">
          <h2>Environments</h2>
          <p>Add or update UAT, Replica, and Production environments.</p>
        </Link>

        <Link href="/config/release-trains" className="card panel-two">
          <h2>Release Trains</h2>
          <p>Plan schedule, duration, and environment assignment for each train.</p>
        </Link>

        <Link href="/config/production-freezes" className="card panel-three">
          <h2>Production Freezes</h2>
          <p>Define freeze windows and mark them active or inactive.</p>
        </Link>

        <Link href="/config/release-sizes" className="card panel-one">
          <h2>Release Sizes</h2>
          <p>Define Small, Medium, Large, and Very Large scope checklists.</p>
        </Link>
      </section>
    </ShellLayout>
  );
}
