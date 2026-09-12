import React, { useState } from "react";
import { X, FolderOpen, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { ConnectionConfig } from "../types";
import { loadDatabaseFromFile } from "../services/db";
interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: ConnectionConfig) => Promise<void>;
  onTestConnection: (config: ConnectionConfig) => Promise<boolean>;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onTestConnection,
}) => {
  const [driver, setDriver] = useState<"sqlite" | "postgres" | "mysql">("sqlite");
  const [name, setName] = useState("Local SQLite Store");
  const [filepath, setFilepath] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(5432);
  const [database, setDatabase] = useState("postgres");
  const [username, setUsername] = useState("postgres");
  const [password, setPassword] = useState("");
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleBrowseFile = () => {
    fileInputRef.current?.click();
  };

  const handleBrowserFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilepath(file.name);
    setName(file.name);
    try {
      const config = await loadDatabaseFromFile(file);
      await onConnect(config);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const buildConfig = (): ConnectionConfig => {
    const id = `conn_${Date.now()}`;
    return {
      id,
      name: name.trim() || `${driver.toUpperCase()} Connection`,
      driver,
      filepath: driver === "sqlite" ? filepath.trim() || ":memory:" : undefined,
      host: driver !== "sqlite" ? host : undefined,
      port: driver !== "sqlite" ? Number(port) : undefined,
      database: driver !== "sqlite" ? database : undefined,
      username: driver !== "sqlite" ? username : undefined,
      password: driver !== "sqlite" ? password : undefined,
    };
  };

  const handleTest = async () => {
    setTesting(true);
    setTestStatus("idle");
    setErrorMessage("");
    try {
      const config = buildConfig();
      const ok = await onTestConnection(config);
      if (ok) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
        setErrorMessage("Connection test failed.");
      }
    } catch (err: unknown) {
      setTestStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndConnect = async () => {
    setConnecting(true);
    setErrorMessage("");
    try {
      const config = buildConfig();
      await onConnect(config);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-canvas border border-hairline rounded-xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-surface-card px-6 py-4 border-b border-hairline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <h3 className="font-editorial-serif text-xl font-medium text-ink">
              New Database Connection
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Driver Selector Tabs */}
        <div className="flex bg-surface-soft border-b border-hairline p-1">
          <button
            onClick={() => {
              setDriver("sqlite");
              setName("Local SQLite Store");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              driver === "sqlite"
                ? "bg-surface-card text-ink shadow-xs border border-hairline"
                : "text-muted hover:text-ink"
            }`}
          >
            SQLite / Local File
          </button>
          <button
            onClick={() => {
              setDriver("postgres");
              setPort(5432);
              setName("PostgreSQL Server");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              driver === "postgres"
                ? "bg-surface-card text-ink shadow-xs border border-hairline"
                : "text-muted hover:text-ink"
            }`}
          >
            PostgreSQL
          </button>
          <button
            onClick={() => {
              setDriver("mysql");
              setPort(3306);
              setName("MySQL Server");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              driver === "mysql"
                ? "bg-surface-card text-ink shadow-xs border border-hairline"
                : "text-muted hover:text-ink"
            }`}
          >
            MySQL
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-ink mb-1">
              Connection Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-ink focus:border-primary outline-none"
              placeholder="e.g. Production Analytics"
            />
          </div>

          {driver === "sqlite" ? (
            <div>
              <label className="block font-semibold text-ink mb-1">
                SQLite File Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filepath}
                  onChange={(e) => setFilepath(e.target.value)}
                  placeholder="Select a .db / .sqlite file or leave blank for :memory:"
                  className="flex-1 bg-canvas border border-hairline rounded-md px-3 py-2 text-ink font-mono text-[11px] focus:border-primary outline-none"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".db,.sqlite,.sqlite3,.db3,.sql"
                  onChange={handleBrowserFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleBrowseFile}
                  className="flex items-center gap-1.5 bg-surface-card hover:bg-surface-cream text-ink font-medium px-3 py-2 rounded-md border border-hairline transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-primary" />
                  Browse
                </button>
              </div>
              <p className="text-[11px] text-muted-soft mt-1">
                Supports SQLite databases (`.db`, `.sqlite`, `.sqlite3`).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block font-semibold text-ink mb-1">Host</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-ink focus:border-primary outline-none"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block font-semibold text-ink mb-1">Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-ink focus:border-primary outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-ink mb-1">
                  Database Name
                </label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-ink focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-ink focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-canvas border border-hairline rounded-md px-3 py-2 text-ink focus:border-primary outline-none"
                />
              </div>
            </div>
          )}

          {/* Status Message */}
          {testStatus === "success" && (
            <div className="flex items-center gap-2 text-success bg-[#f0fdf4] border border-[#bbf7d0] p-2.5 rounded-md text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Connection test succeeded! Ready to connect.</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 text-error bg-[#fdf2f2] border border-[#f5c6c6] p-2.5 rounded-md text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-surface-soft px-6 py-3.5 border-t border-hairline flex items-center justify-between">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || connecting}
            className="text-xs font-semibold text-ink bg-surface-card hover:bg-surface-cream border border-hairline px-3.5 py-2 rounded-md transition-colors"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-muted hover:text-ink px-3 py-2 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndConnect}
              disabled={connecting}
              className="text-xs font-semibold bg-primary hover:bg-primary-active text-on-primary px-4 py-2 rounded-md transition-colors shadow-sm"
            >
              {connecting ? "Connecting..." : "Connect & Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
