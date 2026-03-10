import { useEffect, useState } from "react";
import ShellLayout from "../../components/ShellLayout";
import { fetchConfig, mutateConfig } from "../../lib/client-config";

const initialForm = {
  name: "",
  track: "UAT",
  color: "#1f77b4",
  durationWeeks: "1",
  order: "1"
};

export default function EnvironmentConfigPage() {
  const [environments, setEnvironments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const config = await fetchConfig();
      setEnvironments(config.environments || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await mutateConfig({
        section: "environments",
        action: "add",
        item: {
          name: form.name,
          track: form.track,
          color: form.color,
          durationWeeks: Number(form.durationWeeks),
          order: Number(form.order)
        }
      });

      setMessage("Environment added.");
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    setError("");
    setMessage("");

    try {
      await mutateConfig({ section: "environments", action: "remove", id });
      if (editingId === id) {
        setEditingId("");
        setEditForm(null);
      }
      setMessage("Environment removed.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(environment) {
    setError("");
    setMessage("");
    setEditingId(environment.id);
    setEditForm({
      name: environment.name,
      track: environment.track,
      color: environment.color,
      durationWeeks: String(environment.durationWeeks),
      order: String(environment.order)
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

    try {
      await mutateConfig({
        section: "environments",
        action: "update",
        id: editingId,
        item: {
          name: editForm.name,
          track: editForm.track,
          color: editForm.color,
          durationWeeks: Number(editForm.durationWeeks),
          order: Number(editForm.order)
        }
      });

      setEditingId("");
      setEditForm(null);
      setMessage("Environment updated.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ShellLayout title="Environment Configuration" subtitle="Change or add new environments used by release governance panels.">
      <section className="form-card">
        <h2>Add Environment</h2>
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
            Track
            <input
              required
              value={form.track}
              onChange={(event) => setForm((prev) => ({ ...prev, track: event.target.value }))}
            />
          </label>

          <label>
            Color
            <input
              required
              type="color"
              value={form.color}
              onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
            />
          </label>

          <label>
            Duration Weeks
            <input
              required
              min="0"
              type="number"
              value={form.durationWeeks}
              onChange={(event) => setForm((prev) => ({ ...prev, durationWeeks: event.target.value }))}
            />
          </label>

          <label>
            Display Order
            <input
              required
              min="1"
              type="number"
              value={form.order}
              onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))}
            />
          </label>

          <button type="submit" className="primary-btn">Add Environment</button>
        </form>
      </section>

      {message ? <p className="success-box">{message}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      <section className="table-card">
        <h2>Current Environments</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Track</th>
                <th>Color</th>
                <th>Weeks</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {environments.map((environment) => {
                const isEditing = editingId === environment.id;

                return (
                  <tr key={environment.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.name || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      ) : (
                        environment.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.track || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, track: event.target.value }))}
                        />
                      ) : (
                        environment.track
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          type="color"
                          value={editForm?.color || "#000000"}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, color: event.target.value }))}
                        />
                      ) : (
                        <span>{environment.color}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          min="0"
                          type="number"
                          value={editForm?.durationWeeks || "0"}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, durationWeeks: event.target.value }))}
                        />
                      ) : (
                        environment.durationWeeks
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          min="1"
                          type="number"
                          value={editForm?.order || "1"}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, order: event.target.value }))}
                        />
                      ) : (
                        environment.order
                      )}
                    </td>
                    <td className="action-cell">
                      {isEditing ? (
                        <>
                          <button className="primary-btn" onClick={saveEdit}>
                            Save
                          </button>
                          <button className="secondary-btn" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button className="secondary-btn" onClick={() => startEdit(environment)}>
                          Edit
                        </button>
                      )}
                      <button className="danger-btn" onClick={() => handleDelete(environment.id)}>
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
