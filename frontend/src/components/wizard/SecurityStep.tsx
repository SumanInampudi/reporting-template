import { useEffect, useRef, useState } from "react";
import { Shield, Info, X } from "lucide-react";
import { fetchConfig } from "@/lib/api";

interface Props {
  secretScope: string;
  secretKey: string;
  onScopeChange: (v: string) => void;
  onKeyChange: (v: string) => void;
}

function InfoPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="sec-info-wrap" ref={ref}>
      <button
        type="button"
        className="sec-info-btn"
        aria-label="How authentication works"
        onClick={() => setOpen((v) => !v)}
      >
        <Info size={16} />
      </button>

      {open && (
        <div className="sec-info-popover">
          <div className="sec-info-header">
            <span className="sec-info-title">How authentication works</span>
            <button type="button" className="sec-info-close" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <ol className="sec-info-list">
            <li>
              <strong>User authorization first</strong> — when deployed to
              Databricks Apps, each request carries the logged-in user's token.
              All queries run with <em>their</em> permissions.
            </li>
            <li>
              <strong>Service-principal fallback</strong> — if the user token is
              unavailable (e.g. service-to-service calls, or the user lacks
              direct SQL warehouse access), the app retrieves a service-principal
              PAT from Databricks Secrets and uses that instead.
            </li>
            <li>
              <strong>When to configure</strong> — provide a secret scope &amp;
              key if your team's users may not have direct <code>CAN USE</code>{" "}
              permission on the SQL warehouse. If all users already have access,
              you can skip this step.
            </li>
          </ol>
          <p className="sec-info-footer">
            Ask your platform team for the correct secret scope if you're unsure.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SecurityStep({ secretScope, secretKey, onScopeChange, onKeyChange }: Props) {
  const [envDefaults, setEnvDefaults] = useState<{ scope: string; key: string } | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    fetchConfig()
      .then((c) => {
        const sec = (c as Record<string, any>).security;
        if (sec) {
          const defaults = {
            scope: sec.default_secret_scope ?? "",
            key: sec.default_secret_key ?? "sp-token",
          };
          setEnvDefaults(defaults);
          if (!prefilled.current && !secretScope && defaults.scope) {
            onScopeChange(defaults.scope);
            onKeyChange(defaults.key);
            prefilled.current = true;
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const useDefault = () => {
    if (envDefaults) {
      onScopeChange(envDefaults.scope);
      onKeyChange(envDefaults.key);
    }
  };

  return (
    <div className="wizard-section">
      <div className="sec-title-row">
        <h2 className="wizard-title">
          <Shield size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
          Security &amp; Credentials
        </h2>
        <InfoPopover />
      </div>
      <p className="wizard-desc">
        Configure which Databricks Secret scope and key the app should use for
        service-principal fallback authentication. This ensures users without
        direct warehouse access can still query data.
      </p>

      {envDefaults?.scope && (
        <div className="sec-env-default">
          <span className="sec-env-label">Environment default:</span>
          <code className="sec-env-value">{envDefaults.scope}</code>
          {secretScope !== envDefaults.scope && (
            <button type="button" className="sec-env-use-btn" onClick={useDefault}>
              Use default
            </button>
          )}
        </div>
      )}

      <div className="wizard-field">
        <label className="wizard-label">Secret Scope</label>
        <input
          className="wizard-input"
          type="text"
          value={secretScope}
          onChange={(e) => onScopeChange(e.target.value)}
          placeholder="e.g. obcd-app-secrets-non-prod"
        />
        <span className="wizard-hint">
          The Databricks secret scope that holds the service-principal token.
        </span>
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Secret Key</label>
        <input
          className="wizard-input"
          type="text"
          value={secretKey}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder="sp-token"
        />
        <span className="wizard-hint">
          The key within the scope that stores the token. Defaults to <code>sp-token</code>.
        </span>
      </div>
    </div>
  );
}
