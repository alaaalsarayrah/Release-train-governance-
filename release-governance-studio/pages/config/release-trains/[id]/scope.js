import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import ShellLayout from "../../../../components/ShellLayout";
import { fetchConfig, mutateConfig } from "../../../../lib/client-config";

const emptyScopeRecord = {
  adoId: "",
  title: "",
  scope: "",
  description: "",
  squadOrPlatformName: "",
  platformOwnerOrScrumMasterName: "",
  epicIdOrKiplotProjectId: "",
  readyForReplica: false
};

function createScopeId() {
  return `scope-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function ReleaseTrainScopePage() {
  const router = useRouter();
  const trainId = typeof router.query.id === "string" ? router.query.id : "";

  const [loading, setLoading] = useState(true);
  const [releaseTrain, setReleaseTrain] = useState(null);
  const [scopeCatalog, setScopeCatalog] = useState([]);
  const [records, setRecords] = useState([]);
  const [newRecord, setNewRecord] = useState(emptyScopeRecord);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!trainId) return;

    setLoading(true);
    setError("");

    try {
      const config = await fetchConfig();
      const train = (config.releaseTrains || []).find((item) => item.id === trainId);

      if (!train) {
        setReleaseTrain(null);
        setRecords([]);
      } else {
        setReleaseTrain(train);
        setRecords(Array.isArray(train.scopeRecords) ? train.scopeRecords : []);
      }

      setScopeCatalog(config.releaseScopeCatalog || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [trainId]);

  const readinessSummary = useMemo(() => {
    const total = records.length;
    const ready = records.filter((record) => record.readyForReplica).length;
    const pending = total - ready;

    return { total, ready, pending };
  }, [records]);

  function resetNewRecord() {
    setNewRecord(emptyScopeRecord);
  }

  function startEdit(record) {
    setEditingId(record.id);
    setEditForm({ ...record });
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingId("");
    setEditForm(null);
  }

  async function persistRecords(nextRecords, successMessage) {
    if (!releaseTrain?.id) return false;

    setError("");
    setMessage("");

    try {
      await mutateConfig({
        section: "releaseTrains",
        action: "update",
        id: releaseTrain.id,
        item: {
          scopeRecords: nextRecords
        }
      });

      setMessage(successMessage);
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function addRecord(event) {
    event.preventDefault();

    const payload = {
      ...newRecord,
      id: createScopeId(),
      readyForReplica: Boolean(newRecord.readyForReplica)
    };

    const ok = await persistRecords([...records, payload], "Scope record added.");
    if (ok) {
      resetNewRecord();
    }
  }

  async function saveEdit() {
    if (!editingId || !editForm) return;

    const nextRecords = records.map((record) =>
      record.id === editingId ? { ...editForm, id: record.id, readyForReplica: Boolean(editForm.readyForReplica) } : record
    );

    const ok = await persistRecords(nextRecords, "Scope record updated.");
    if (ok) {
      cancelEdit();
    }
  }

  async function removeRecord(recordId) {
    const nextRecords = records.filter((record) => record.id !== recordId);
    await persistRecords(nextRecords, "Scope record removed.");

    if (editingId === recordId) {
      cancelEdit();
    }
  }

  if (loading) {
    return (
      <ShellLayout title="Release Train Scope" subtitle="Loading release train scope details.">
        <section className="form-card">
          <p>Loading...</p>
        </section>
      </ShellLayout>
    );
  }

  if (!releaseTrain) {
    return (
      <ShellLayout title="Release Train Scope" subtitle="Release train was not found.">
        <section className="form-card">
          <p className="error-box">Unable to find the selected release train.</p>
          <Link href="/config/release-trains" className="secondary-btn inline-link-btn">
            Back to Release Trains
          </Link>
        </section>
      </ShellLayout>
    );
  }

  return (
    <ShellLayout
      title={`Scope - ${releaseTrain.name}`}
      subtitle="Maintain ADO-linked scope records and readiness gates before replica handoff."
    >
      <section className="form-card">
        <div className="section-head">
          <h2>Train Details</h2>
          <Link href="/config/release-trains" className="secondary-btn inline-link-btn">
            Back to Release Trains
          </Link>
        </div>

        <div className="tag-list">
          <span className="mini-tag">Release: {releaseTrain.targetRelease}</span>
          <span className="mini-tag">Status: {releaseTrain.status}</span>
          <span className="mini-tag">Range: {releaseTrain.startDate} to {releaseTrain.endDate}</span>
          <span className="mini-tag">Ready: {readinessSummary.ready}/{readinessSummary.total}</span>
          <span className="mini-tag">Pending: {readinessSummary.pending}</span>
        </div>
      </section>

      <section className="form-card">
        <h2>Add Scope Record</h2>
        <form className="data-form" onSubmit={addRecord}>
          <label>
            ADO ID
            <input
              value={newRecord.adoId}
              onChange={(event) => setNewRecord((prev) => ({ ...prev, adoId: event.target.value }))}
              placeholder="US-12345"
            />
          </label>

          <label>
            Title
            <input
              required
              value={newRecord.title}
              onChange={(event) => setNewRecord((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>

          <label>
            Scope
            <input
              list="scope-catalog-options"
              value={newRecord.scope}
              onChange={(event) => setNewRecord((prev) => ({ ...prev, scope: event.target.value }))}
              placeholder="UI changes"
            />
            <datalist id="scope-catalog-options">
              {scopeCatalog.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>

          <label>
            Description
            <input
              value={newRecord.description}
              onChange={(event) => setNewRecord((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>

          <label>
            Squad / Platform
            <input
              value={newRecord.squadOrPlatformName}
              onChange={(event) => setNewRecord((prev) => ({ ...prev, squadOrPlatformName: event.target.value }))}
            />
          </label>

          <label>
            Platform Owner / Scrum Master
            <input
              value={newRecord.platformOwnerOrScrumMasterName}
              onChange={(event) => setNewRecord((prev) => ({ ...prev, platformOwnerOrScrumMasterName: event.target.value }))}
            />
          </label>

          <label>
            Epic ID / Kiplot Project ID
            <input
              value={newRecord.epicIdOrKiplotProjectId}
              onChange={(event) => setNewRecord((prev) => ({ ...prev, epicIdOrKiplotProjectId: event.target.value }))}
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={newRecord.readyForReplica}
              onChange={(event) => setNewRecord((prev) => ({ ...prev, readyForReplica: event.target.checked }))}
            />
            Ready for Replica
          </label>

          <button type="submit" className="primary-btn">Add Scope Record</button>
        </form>
      </section>

      {message ? <p className="success-box">{message}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      <section className="table-card">
        <h2>Scope Records</h2>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ADO ID</th>
                <th>Title</th>
                <th>Scope</th>
                <th>Description</th>
                <th>Squad / Platform</th>
                <th>Owner / Scrum Master</th>
                <th>Epic / Kiplot</th>
                <th>Ready</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const isEditing = editingId === record.id;

                return (
                  <tr key={record.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.adoId || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, adoId: event.target.value }))}
                        />
                      ) : (
                        record.adoId || "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.title || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                        />
                      ) : (
                        record.title
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          list="scope-catalog-options"
                          value={editForm?.scope || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, scope: event.target.value }))}
                        />
                      ) : (
                        record.scope || "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.description || ""}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                        />
                      ) : (
                        record.description || "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.squadOrPlatformName || ""}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, squadOrPlatformName: event.target.value }))
                          }
                        />
                      ) : (
                        record.squadOrPlatformName || "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.platformOwnerOrScrumMasterName || ""}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, platformOwnerOrScrumMasterName: event.target.value }))
                          }
                        />
                      ) : (
                        record.platformOwnerOrScrumMasterName || "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="table-input"
                          value={editForm?.epicIdOrKiplotProjectId || ""}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, epicIdOrKiplotProjectId: event.target.value }))
                          }
                        />
                      ) : (
                        record.epicIdOrKiplotProjectId || "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <label className="table-checkbox">
                          <input
                            type="checkbox"
                            checked={Boolean(editForm?.readyForReplica)}
                            onChange={(event) =>
                              setEditForm((prev) => ({ ...prev, readyForReplica: event.target.checked }))
                            }
                          />
                          Ready
                        </label>
                      ) : record.readyForReplica ? (
                        <span className="mini-tag">Yes</span>
                      ) : (
                        <span className="mini-tag">No</span>
                      )}
                    </td>
                    <td className="action-cell">
                      {isEditing ? (
                        <>
                          <button className="primary-btn" onClick={saveEdit}>Save</button>
                          <button className="secondary-btn" onClick={cancelEdit}>Cancel</button>
                        </>
                      ) : (
                        <button className="secondary-btn" onClick={() => startEdit(record)}>Edit</button>
                      )}
                      <button className="danger-btn" onClick={() => removeRecord(record.id)}>Remove</button>
                    </td>
                  </tr>
                );
              })}

              {!records.length ? (
                <tr>
                  <td colSpan={9}>No scope records yet. Add one to start readiness tracking.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </ShellLayout>
  );
}
