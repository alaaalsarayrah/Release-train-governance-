import { useEffect, useState } from "react";
import ShellLayout from "../../components/ShellLayout";
import { fetchConfig, mutateConfig } from "../../lib/client-config";

const fallbackScopeItems = [
  "Production incident",
  "UI changes",
  "Standard changes",
  "Updating existing feature",
  "New feature",
  "New platform"
];

const initialForm = {
  name: "",
  scopeItems: []
};

export default function ReleaseSizesConfigPage() {
  const [releaseSizes, setReleaseSizes] = useState([]);
  const [scopeCatalog, setScopeCatalog] = useState(fallbackScopeItems);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const config = await fetchConfig();
      setReleaseSizes(config.releaseSizes || []);
      setScopeCatalog(config.releaseScopeCatalog || fallbackScopeItems);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleListValue(values, value) {
    if (values.includes(value)) {
      return values.filter((item) => item !== value);
    }
    return [...values, value];
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await mutateConfig({
        section: "releaseSizes",
        action: "add",
        item: {
          name: form.name,
          scopeItems: form.scopeItems
        }
      });

      setMessage("Release size added.");
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(size) {
    setError("");
    setMessage("");
    setEditingId(size.id);
    setEditForm({
      name: size.name,
      scopeItems: Array.isArray(size.scopeItems) ? size.scopeItems : []
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
        section: "releaseSizes",
        action: "update",
        id: editingId,
        item: {
          name: editForm.name,
          scopeItems: editForm.scopeItems
        }
      });

      setEditingId("");
      setEditForm(null);
      setMessage("Release size updated.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    setError("");
    setMessage("");

    try {
      await mutateConfig({ section: "releaseSizes", action: "remove", id });
      if (editingId === id) {
        setEditingId("");
        setEditForm(null);
      }
      setMessage("Release size removed.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ShellLayout
      title="Release Size Configuration"
      subtitle="Define release-size categories and checklist scope items used by release trains."
    >
      <section className="form-card">
        <h2>Add Release Size</h2>
        <form className="data-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>

          <div className="checklist-block">
            <p>Scope Checklist</p>
            <div className="checklist-grid">
              {scopeCatalog.map((item) => (
                <label key={item} className="table-checkbox">
                  <input
                    type="checkbox"
                    checked={form.scopeItems.includes(item)}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        scopeItems: toggleListValue(prev.scopeItems, item)
                      }))
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="primary-btn">Add Release Size</button>
        </form>
      </section>

      {message ? <p className="success-box">{message}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      <section className="table-card">
        <h2>Current Release Sizes</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Scope Checklist</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {releaseSizes.map((size) => {
                const isEditing = editingId === size.id;

                return (
                  <tr key={size.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.name || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      ) : (
                        size.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="checklist-grid">
                          {scopeCatalog.map((item) => (
                            <label key={`${size.id}-${item}`} className="table-checkbox">
                              <input
                                type="checkbox"
                                checked={Boolean(editForm?.scopeItems?.includes(item))}
                                onChange={() =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    scopeItems: toggleListValue(prev.scopeItems || [], item)
                                  }))
                                }
                              />
                              {item}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="tag-list">
                          {(size.scopeItems || []).map((item) => (
                            <span key={`${size.id}-${item}`} className="mini-tag">
                              {item}
                            </span>
                          ))}
                        </div>
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
                        <button className="secondary-btn" onClick={() => startEdit(size)}>
                          Edit
                        </button>
                      )}
                      <button className="danger-btn" onClick={() => handleDelete(size.id)}>
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
