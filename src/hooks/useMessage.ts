import { useState, useCallback, useEffect } from "react";

export type NoticeTone = "info" | "success" | "error";

function inferNoticeTone(text: string): NoticeTone {
  const normalized = text.toLowerCase();
  if (
    normalized.includes("nao foi possivel") ||
    normalized.includes("preencha") ||
    normalized.includes("informe") ||
    normalized.includes("precisa") ||
    normalized.includes("nao confere") ||
    normalized.includes("ja foi") ||
    normalized.includes("pausada") ||
    normalized.includes("ainda nao")
  ) {
    return "error";
  }
  return "success";
}

export function useMessage(timeout = 6500) {
  const [message, setRawMessage] = useState("");
  const [messageTone, setMessageTone] = useState<NoticeTone>("info");
  const [visible, setVisible] = useState(false);

  const setMessage = useCallback(
    (text: string, tone?: NoticeTone) => {
      setRawMessage(text);
      setMessageTone(text ? tone ?? inferNoticeTone(text) : "info");
      setVisible(Boolean(text));
    },
    [],
  );

  const clearMessage = useCallback(() => {
    setVisible(false);
    setTimeout(() => setRawMessage(""), 300);
  }, []);

  useEffect(() => {
    if (!message || !visible) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
      setTimeout(() => setRawMessage(""), 300);
    }, timeout);
    return () => window.clearTimeout(timer);
  }, [message, visible, timeout]);

  return { message, messageTone, visible, setMessage, clearMessage };
}
