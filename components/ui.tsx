"use client";
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Inbox,
  LoaderCircle,
  X,
} from "lucide-react";
import { statusLabels } from "@/lib/types";

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = (await response.json()) as T & {
    message?: string;
    details?: string[];
  };
  if (!response.ok)
    throw new Error([data.message, ...(data.details || [])].join("\n"));
  return data;
}
export function useResource<T>(path: string | null) {
  const [state, setState] = useState<{
      key: string;
      data: T | null;
      error: string;
    }>({ key: "", data: null, error: "" }),
    [version, setVersion] = useState(0);
  const key = `${path}:${version}`;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((data) => setState({ key, data, error: "" }))
      .catch((e) => {
        if (e.name !== "AbortError")
          setState({ key, data: null, error: e.message });
      });
    return () => controller.abort();
  }, [path, key]);
  return {
    data: path ? state.data : null,
    error: state.key === key ? state.error : "",
    loading: !!path && state.key !== key,
    reload,
  };
}
export function Badge({
  status,
  children,
}: {
  status?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`badge ${status || ""}`}>
      {children || statusLabels[status || ""] || status}
    </span>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="notice danger" role="alert">
      <AlertCircle size={20} />
      <span style={{ whiteSpace: "pre-line" }}>{message}</span>
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={25} />
      <span>กำลังเตรียมข้อมูล…</span>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="ปิดหน้าต่าง"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function ExternalLink({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}) {
  if (!href?.startsWith("https://")) return null;
  return (
    <a className="text-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}
export function date(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
export const number = (value: number | undefined) =>
  new Intl.NumberFormat("th-TH").format(value || 0);
