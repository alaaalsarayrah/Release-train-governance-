import { useEffect, useState } from "react";
import ShellLayout from "../../components/ShellLayout";
import { fetchConfig, mutateConfig } from "../../lib/client-config";

const initialForm = {
  title: "",
  startDate: "",
  endDate: "",
  scope: "",
  active: true
};

export default function ProductionFreezeConfigPage() {
  const [freezes, setFreezes] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const config = await fetchConfig();
      setFreezes(config.productionFreezes || []);
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
        section: "productionFreezes",
        action: "add",
        item: {
          title: form.title,
          startDate: form.startDate,
          endDate: form.endDate,
          scope: form.scope,
          active: form.active
        }
      });

      setMessage("Production freeze added.");
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggle(freeze) {
    setError("");
    setMessage("");

    try {
      await mutateConfig({
        section: "productionFreezes",
        action: "update",
        id: freeze.id,
        item: { active: !freeze.active }
      });
      setMessage("Freeze status updated.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    setError("");
    setMessage("");

    try {
      await mutateConfig({ section: "productionFreezes", action: "remove", id });
      if (editingId === id) {
        setEditingId("");
        setEditForm(null);
      }
      setMessage("Production freeze removed.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(freeze) {
    setError("");
    setMessage("");
    setEditingId(freeze.id);
    setEditForm({
      title: freeze.title,
      startDate: freeze.startDate,
      endDate: freeze.endDate,
      scope: freeze.scope,
      active: Boolean(freeze.active)
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
        section: "productionFreezes",
        action: "update",
        id: editingId,
        item: {
          title: editForm.title,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          scope: editForm.scope,
          active: Boolean(editForm.active)
        }
      });

      setEditingId("");
      setEditForm(null);
      setMessage("Production freeze updated.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ShellLayout title="Production Freeze Configuration" subtitle="Create and manage freeze windows that impact production deployment.">
      <section className="form-card">
        <h2>Add Freeze Window</h2>
        <form className="data-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
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
            Scope
            <input
              required
              value={form.scope}
              onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value }))}
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
            Mark as Active
          </label>

          <button type="submit" className="primary-btn">Add Freeze Window</button>
        </form>
      </section>

      {message ? <p className="success-box">{message}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      <section className="table-card">
        <h2>Current Freeze Windows</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Start</th>
                <th>End</th>
                <th>Scope</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {freezes.map((freeze) => {
                const isEditing = editingId === freeze.id;

                return (
                  <tr key={freeze.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.title || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                        />
                      ) : (
                        freeze.title
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
                        freeze.startDate
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
                        freeze.endDate
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.scope || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, scope: event.target.value }))}
                        />
                      ) : (
                        freeze.scope
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <label className="table-checkbox">
                          <input
                            type="checkbox"
                            checked={Boolean(editForm?.active)}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, active: event.target.checked }))
                            }
                          />
                          Active
                        </label>
                      ) : freeze.active ? (
                        "Yes"
                      ) : (
                        "No"
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
                        <>
                          <button className="secondary-btn" onClick={() => startEdit(freeze)}>
                            Edit
                          </button>
                          <button className="secondary-btn" onClick={() => handleToggle(freeze)}>
                            Toggle Active
                          </button>
                        </>
                      )}
                      <button className="danger-btn" onClick={() => handleDelete(freeze.id)}>
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
