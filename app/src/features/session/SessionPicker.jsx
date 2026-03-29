import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { rust } from "../../api/tauri-client";
import { save, open } from "@tauri-apps/plugin-dialog";
import {
  Plus,
  FolderOpen,
  Trash2,
  Pencil,
  Check,
  X,
  Database,
  AlertTriangle,
} from "lucide-react";
import { t } from "../../i18n/i18n";

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SessionPicker({ onSessionReady }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPath, setEditingPath] = useState(null);
  const [editName, setEditName] = useState("");
  const renameInputRef = useRef(null);

  async function loadSessions() {
    try {
      setLoading(true);
      const recent = await rust.get_recent_sessions();
      setSessions(recent);
    } catch (e) {
      console.error("Failed to load sessions:", e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (editingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingPath]);

  async function handleOpenSession(path) {
    try {
      setError(null);
      const session = await rust.open_session({ path });
      onSessionReady(session);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleCreateNew() {
    try {
      setError(null);
      const path = await save({
        filters: [{ name: "SQLite", extensions: ["db", "sqlite"] }],
        defaultPath: "honeybear.db",
      });
      if (path) {
        const session = await rust.create_session({ path });
        onSessionReady(session);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleOpenExisting() {
    try {
      setError(null);
      const path = await open({
        filters: [{ name: "SQLite", extensions: ["db", "sqlite"] }],
        multiple: false,
      });
      if (path) {
        const session = await rust.open_session({ path });
        onSessionReady(session);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleRemove(e, path) {
    e.stopPropagation();
    try {
      await rust.remove_recent_session({ path });
      setSessions((prev) => prev.filter((s) => s.path !== path));
    } catch (err) {
      console.error("Failed to remove session:", err);
    }
  }

  function startRename(e, session) {
    e.stopPropagation();
    setEditingPath(session.path);
    setEditName(session.name);
  }

  async function commitRename(e) {
    if (e) e.stopPropagation();
    if (!editingPath) return;
    try {
      await rust.rename_session({ path: editingPath, newName: editName });
      setSessions((prev) =>
        prev.map((s) =>
          s.path === editingPath ? { ...s, name: editName } : s,
        ),
      );
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
    setEditingPath(null);
  }

  function cancelRename(e) {
    if (e) e.stopPropagation();
    setEditingPath(null);
  }

  function handleRenameKeyDown(e) {
    if (e.key === "Enter") commitRename(e);
    if (e.key === "Escape") cancelRename(e);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-100 dark:bg-brand-900/30 mb-4">
            <Database className="w-8 h-8 text-brand-600 dark:text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {t("session.title")}
          </h1>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Recent sessions list */}
        {sessions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-1">
              {t("session.recent_sessions")}
            </h2>
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.path}
                  onClick={() =>
                    session.file_exists ? handleOpenSession(session.path) : null
                  }
                  role="button"
                  tabIndex={session.file_exists ? 0 : -1}
                  className={`w-full text-left p-3 rounded-xl border transition-colors group ${
                    session.file_exists
                      ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-600 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 cursor-pointer"
                      : "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 p-1.5 rounded-lg ${session.file_exists ? "bg-brand-100 dark:bg-brand-900/30" : "bg-slate-200 dark:bg-slate-700"}`}
                    >
                      <Database
                        className={`w-4 h-4 ${session.file_exists ? "text-brand-600 dark:text-brand-400" : "text-slate-400"}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {editingPath === session.path ? (
                          <div
                            className="flex items-center gap-1 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={handleRenameKeyDown}
                              className="flex-1 px-2 py-0.5 text-sm font-medium rounded border border-brand-300 dark:border-brand-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                            <button
                              onClick={commitRename}
                              className="p-0.5 text-emerald-600 hover:text-emerald-700"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelRename}
                              className="p-0.5 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">
                              {session.name || t("session.unnamed")}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                              {formatRelativeTime(session.last_opened)}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          {session.path}
                        </span>
                        {session.file_exists && session.file_size > 0 && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                            {formatFileSize(session.file_size)}
                          </span>
                        )}
                        {!session.file_exists && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            {t("session.file_not_found")}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Action buttons (visible on hover) */}
                    {editingPath !== session.path && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {session.file_exists && (
                          <button
                            onClick={(e) => startRename(e, session)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Rename"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleRemove(e, session.path)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                          title="Remove from list"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && sessions.length === 0 && (
          <div className="text-center py-8 mb-6">
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              {t("session.recent_sessions")}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCreateNew}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t("session.create_new")}
          </button>
          <button
            onClick={handleOpenExisting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-600 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            {t("session.open_existing")}
          </button>
        </div>
      </div>
    </div>
  );
}

SessionPicker.propTypes = {
  onSessionReady: PropTypes.func.isRequired,
};
