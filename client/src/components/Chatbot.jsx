import { useEffect, useRef, useState } from "react";
import { sendChatMessage } from "../services/api";
import HakiLogo from "./HakiLogo.jsx";

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
    "How do I sign in or change my password?",
    "How can I publish this project on GitHub?",
    "How do I connect the Gemini API?",
  ],
};

function Chatbot({ theme = "dark" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [fileContext, setFileContext] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const hoverCloseTimer = useRef(null);
  const conversation = messages.length ? messages : [{ role: "assistant", content: ui.greeting }];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  useEffect(() => {
    function receiveFileContext(event) {
      setFileContext(event.detail);
      setDraft("Please explain this file and point out anything I should review.");
      setIsPinned(true);
      setIsOpen(true);
    }
    window.addEventListener("haki:chat-context", receiveFileContext);
    return () => window.removeEventListener("haki:chat-context", receiveFileContext);
  }, []);

  async function sendQuestion(question) {
    const content = question.trim();
    if (!content || isSending) return;

    const history = messages.length ? messages : [{ role: "assistant", content: ui.greeting }];
    setMessages([...history, { role: "user", content }]);
    setDraft("");
    setError("");
    setIsSending(true);

    try {
      const result = await sendChatMessage({ message: content, history: history.slice(-12), context: fileContext });
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

  function cancelHoverClose() {
    window.clearTimeout(hoverCloseTimer.current);
  }

  return (
    <div
      className="chatbot-shell fixed right-0 top-1/2 z-50 -translate-y-1/2 font-sans"
      data-theme={theme}
      onMouseEnter={() => { cancelHoverClose(); if (!isPinned) setIsOpen(true); }}
      onMouseLeave={() => { if (!isPinned) hoverCloseTimer.current = window.setTimeout(() => setIsOpen(false), 180); }}
    >
      {isOpen && (
        <section aria-label="Haki Assistant chat" onMouseEnter={cancelHoverClose} className="fixed right-12 top-1/2 flex h-[min(520px,calc(100dvh-32px))] w-[min(350px,calc(100vw-64px))] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/30 bg-[#FFF8F1]/90 text-[#302D3B] shadow-2xl shadow-black/35 backdrop-blur-xl">
          <header className="flex items-center justify-between gap-2 border-b border-[#E8D9DE] bg-white px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#BFC3DF]/10 text-xl" aria-hidden="true">✦</div>
            <div className="min-w-0"><h2 className="text-sm font-semibold">{ui.title}</h2><p className="text-xs text-[#718A7E]">{fileContext ? `Context: ${fileContext.filePath}` : ui.subtitle}</p></div>
            </div>
            {fileContext && <button type="button" onClick={() => setFileContext(null)} className="rounded-lg border border-[#DCD2DC] px-2 py-1 text-xs">Clear context</button>}
            <button type="button" onClick={() => { setIsPinned(false); setIsOpen(false); }} aria-label={ui.close} className="rounded-lg px-2 py-1 text-xl text-[#706B79] hover:bg-[#F0E8EC] hover:text-[#302D3B]">×</button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {conversation.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-[#B9BFDD] text-[#302D3B]" : "rounded-bl-md bg-[#F0E8EC] text-[#484451]"}`}>{message.role === "assistant" && index === 0 ? ui.greeting : message.content}</p>
              </div>
            ))}
            {messages.length === 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#827C89]">{ui.suggestionsTitle}</p>
                <div className="flex flex-wrap gap-2">
                  {ui.suggestions.map((question) => <button key={question} type="button" onClick={() => sendQuestion(question)} className="rounded-full border border-[#DCD2DC] bg-white px-3 py-1.5 text-left text-xs text-[#514D5A] hover:border-[#A9B9D3] hover:bg-[#F6F4FA]">{question}</button>)}
                </div>
              </div>
            )}
            {isSending && <p className="w-fit rounded-2xl rounded-bl-md bg-[#F0E8EC] px-3.5 py-2.5 text-sm text-[#706B79]">{ui.thinking}</p>}
            {error && <p role="alert" className="rounded-xl border border-amber-600/20 bg-amber-100 px-3 py-2 text-xs leading-5 text-amber-900">{error}</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={sendMessage} className="border-t border-[#E8D9DE] p-3">
            <label className="sr-only" htmlFor="haki-chat-message">{ui.label}</label>
            <div className="flex items-end gap-2 rounded-xl border border-[#DCD2DC] bg-white p-2 focus-within:border-[#A9B9D3]">
              <textarea ref={inputRef} id="haki-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form.requestSubmit();
                }
              }} maxLength={2000} rows={1} placeholder={ui.placeholder} className="max-h-28 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-[#302D3B] outline-none placeholder:text-[#827C89]" />
              <button type="submit" disabled={!draft.trim() || isSending} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#A9B9D3] text-lg font-bold text-[#302D3B] transition hover:bg-[#BFC3DF] disabled:cursor-not-allowed disabled:opacity-40">↑</button>
            </div>
            <p className="mt-2 text-center text-[10px] text-[#827C89]">{ui.footer}</p>
          </form>
        </section>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => {
          if (isPinned) {
            cancelHoverClose();
            setIsPinned(false);
            setIsOpen(false);
          } else {
            setIsPinned(true);
            setIsOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 50);
          }
        }} aria-expanded={isOpen} aria-label={isOpen ? ui.close : ui.open} title={ui.open} className="flex h-12 w-12 items-center justify-center rounded-full border-0 bg-transparent shadow-none transition hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8293B2]">
          <HakiLogo className="h-9 w-9 opacity-90 transition-transform hover:scale-110 hover:opacity-100" />
        </button>
      </div>
    </div>
  );
}

export default Chatbot;
