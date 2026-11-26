import { useEffect, useRef, useState } from "react";
import {Bot} from "lucide-react"
const ui = {
  greeting: "Hi! I’m Haki Assistant. Ask me anything about using HAKI.",
  title: "Haki Assistant",
  subtitle: "Gemini AI · workspace help",
  close: "Close chat",
  thinking: "Thinking…",
  placeholder: "Ask about HAKI…",
  label: "Message Haki Assistant",
  footer: "Powered by Gemini. Don’t share passwords or API keys.",
  open: "AI Chatbot",
  closeAssistant: "Close assistant",
  error: "Could not get a reply. Please try again.",
  suggestionsTitle: "Try asking",
  suggestions: [
    "How do I create a repository?",
    "What is the difference between public and private?",
    "How do I upload a file or folder?",
    "How do I commit my changes?",
    "How do I import a ZIP file?",
    "How do I change my profile or theme?",
    "Where is my project data stored?",
    "How do I sign in or reset my password?",
    "How can I publish this project on GitHub?",
    "How do I connect the Gemini API?",
  ],
};

function Chatbot({ theme = "dark" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const conversation = messages.length ? messages : [{ role: "assistant", content: ui.greeting }];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  async function sendQuestion(question) {
    const content = question.trim();
    if (!content || isSending) return;

    const history = messages.length ? messages : [{ role: "assistant", content: ui.greeting }];
    setMessages([...history, { role: "user", content }]);
    setDraft("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history: history.slice(-12) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || ui.error);
      setMessages((current) => [...current, { role: "assistant", content: result.reply }]);
    } catch (requestError) {
      setError(requestError.message || ui.error);
      inputRef.current?.focus();
    } finally {
      setIsSending(false);
    }
  }

  function sendMessage(event) {
    event.preventDefault();
    sendQuestion(draft);
  }

  return (
    <div className="chatbot-shell fixed bottom-5 right-5 z-50 font-sans sm:bottom-24 sm:right-7" data-theme={theme}>
      {isOpen && (
        <section aria-label="Haki Assistant chat" className="mb-3 flex h-[min(620px,calc(100dvh-110px))] w-[min(410px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101829] text-[#E9ECF5] shadow-xl shadow-black/30">
          <header className="flex items-center justify-between gap-2 border-b border-white/[0.07] bg-[#151F31] px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#687386]/15 text-xl text-[#B0BAC7]" aria-hidden="true">✦</div>
              <div className="min-w-0"><h2 className="text-sm font-semibold">{ui.title}</h2><p className="text-xs text-[#8994AA]">{ui.subtitle}</p></div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label={ui.close} className="rounded-lg px-2 py-1 text-xl text-[#9AA5B8] hover:bg-white/[0.06] hover:text-white">×</button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {conversation.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-[#438C89] text-white" : "rounded-bl-md bg-[#F1F2F0] text-[#30332F]"}`}>{message.role === "assistant" && index === 0 ? ui.greeting : message.content}</p>
              </div>
            ))}
            {messages.length === 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8994AA]">{ui.suggestionsTitle}</p>
                <div className="flex flex-wrap gap-2">
                  {ui.suggestions.map((question) => <button key={question} type="button" onClick={() => sendQuestion(question)} className="rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-1.5 text-left text-xs text-[#B8C1D1] hover:border-[#8A95A3]/40 hover:bg-white/[0.07]">{question}</button>)}
                </div>
              </div>
            )}
            {isSending && <p className="w-fit rounded-2xl rounded-bl-md bg-[#1B2639] px-3.5 py-2.5 text-sm text-[#AAB4C5]">{ui.thinking}</p>}
            {error && <p role="alert" className="rounded-xl border border-[#E8B6A8] bg-[#FFF1EC] px-3 py-2 text-xs leading-5 text-[#713D32]">{error}</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={sendMessage} className="border-t border-[#E5E7EC] bg-white p-3">
            <label className="sr-only" htmlFor="haki-chat-message">{ui.label}</label>
            <div className="flex items-end gap-2 rounded-xl border border-[#D9DEDA] bg-[#F8F9F7] p-2 focus-within:border-[#438C89] focus-within:ring-2 focus-within:ring-[#438C89]/15">
              <textarea ref={inputRef} id="haki-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form.requestSubmit();
                }
              }} maxLength={2000} rows={1} placeholder={ui.placeholder} className="max-h-28 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-[#30332F] outline-none placeholder:text-[#777B72]" />
              <button type="submit" disabled={!draft.trim() || isSending} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#438C89] text-lg font-bold text-white transition hover:bg-[#326D69] disabled:cursor-not-allowed disabled:opacity-40">↑</button>
            </div>
            <p className="mt-2 text-center text-[10px] text-[#8994AA]">{ui.footer}</p>
          </form>
        </section>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => { setIsOpen((open) => !open); if (!isOpen) window.setTimeout(() => inputRef.current?.focus(), 50); }} aria-expanded={isOpen} aria-label={isOpen ? ui.close : ui.open} className="flex items-center gap-2 rounded-full border border-[#438C89] bg-[#438C89] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-[#326D69] hover:bg-[#326D69]">
          <span aria-hidden="true" className="text-lg text-white"><Bot /></span>{isOpen ? ui.closeAssistant : ui.open}
        </button>
      </div>
    </div>
  );
}

export default Chatbot;
