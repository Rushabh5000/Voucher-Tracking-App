import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cvvUsageApi, type CvvUsageLog } from "@/api/client";
import { fmtDateTime } from "@/utils/formatters";

interface CvvUsageLogModalProps {
  open: boolean;
  onClose: () => void;
}

// The only place to see and correct the brand/booking ID noted against a
// past CVV copy — the CvvUsageModal popover that creates these entries only
// ever shows one at a time, right after copying, with no way to look back.
export function CvvUsageLogModal({ open, onClose }: CvvUsageLogModalProps) {
  const [logs, setLogs]         = useState<CvvUsageLog[]>([]);
  const [loading, setLoading]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBrand, setEditBrand] = useState("");
  const [editBookingId, setEditBookingId] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    cvvUsageApi.list()
      .then(setLogs)
      .catch(() => toast.error("Couldn't load the CVV usage log"))
      .finally(() => setLoading(false));
  }, [open]);

  function startEdit(log: CvvUsageLog) {
    setEditingId(log.id);
    setEditBrand(log.brand);
    setEditBookingId(log.bookingId);
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError("");
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await cvvUsageApi.remove(deleteId);
      setLogs((ls) => ls.filter((l) => l.id !== deleteId));
      toast.success("Deleted");
      setDeleteId(null);
    } catch {
      toast.error("Couldn't delete the entry");
    } finally {
      setDeleting(false);
    }
  }

  async function saveEdit(id: string) {
    setEditError("");
    setSaving(true);
    try {
      const updated = await cvvUsageApi.update(id, { brand: editBrand.trim(), bookingId: editBookingId.trim() });
      setLogs((ls) => ls.map((l) => (l.id === id ? updated : l)));
      setEditingId(null);
      toast.success("Updated");
    } catch (err: any) {
      const msg = err.response?.data?.error || "Couldn't save the change";
      setEditError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="CVV usage log"
      size="2xl"
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Every time you've copied a CVV from Card Vault, with whatever brand/booking ID you noted for it.
        Click a row to correct a mistake. Never shows the CVV or card number itself.
      </p>

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-8">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-8">No CVV copies logged yet.</div>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-2 font-medium">Card</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Booking ID</th>
                <th className="px-3 py-2 font-medium">Logged</th>
                <th className="px-6 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const editing = editingId === l.id;
                return (
                  <tr key={l.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 align-top">
                    <td className="px-6 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">{l.cardLabel}</td>
                    <td className="px-3 py-2.5">
                      {editing ? (
                        <input
                          className="input py-1 text-sm"
                          value={editBrand}
                          onChange={(e) => setEditBrand(e.target.value)}
                          placeholder="e.g. Amazon"
                        />
                      ) : (
                        l.brand || <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {editing ? (
                        <input
                          className="input py-1 text-sm font-mono"
                          value={editBookingId}
                          onChange={(e) => { setEditBookingId(e.target.value); setEditError(""); }}
                          placeholder="e.g. order/booking reference"
                        />
                      ) : (
                        <span className="font-mono">{l.bookingId || <span className="text-gray-300 dark:text-gray-600 font-sans">—</span>}</span>
                      )}
                      {editing && editError && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">{editError}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                    <td className="px-6 py-2.5 text-right whitespace-nowrap">
                      {editing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={cancelEdit} disabled={saving}>
                            Cancel
                          </button>
                          <button className="text-xs text-accent-600 dark:text-accent-400 font-medium hover:underline" onClick={() => saveEdit(l.id)} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button className="text-xs text-accent-600 dark:text-accent-400 hover:underline" onClick={() => startEdit(l)}>
                            Edit
                          </button>
                          <button className="text-xs text-gray-400 hover:text-red-500" onClick={() => setDeleteId(l.id)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete this log entry?"
        message="This removes the brand/booking ID record for this CVV copy. It doesn't affect the card itself or anything in Card Vault."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Modal>
  );
}
