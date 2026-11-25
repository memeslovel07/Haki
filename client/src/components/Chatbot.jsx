import { useEffect, useRef, useState } from "react";

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

function Chatbot() {
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
    <div className="fixed bottom-5 right-5 z-50 font-sans sm:bottom-32 sm:right-7">
      {isOpen && (
        <section aria-label="Haki Assistant chat" className="mb-3 flex h-[min(620px,calc(100dvh-110px))] w-[min(410px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-[#DCD2DC] bg-[#FFF8F1] text-[#302D3B] shadow-2xl shadow-black/50">
          <header className="flex items-center justify-between gap-2 border-b border-[#E8D9DE] bg-white px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#BFC3DF]/10 text-xl" aria-hidden="true">✦</div>
              <div className="min-w-0"><h2 className="text-sm font-semibold">{ui.title}</h2><p className="text-xs text-[#718A7E]">{ui.subtitle}</p></div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label={ui.close} className="rounded-lg px-2 py-1 text-xl text-[#706B79] hover:bg-[#F0E8EC] hover:text-[#302D3B]">×</button>
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
        <button type="button" onClick={() => { setIsOpen((open) => !open); if (!isOpen) window.setTimeout(() => inputRef.current?.focus(), 50); }} aria-expanded={isOpen} aria-label={isOpen ? ui.close : ui.open} className="flex items-center gap-2 rounded-full border border-[#D9D8E8] bg-white px-5 py-3 text-sm font-semibold text-[#302D3B] shadow-lg shadow-[#A9B9D3]/30 transition hover:-translate-y-0.5 hover:bg-[#F0E8EC]">
          <span aria-hidden="true" className="text-lg text-[#8293B2]">✦</span>{isOpen ? ui.closeAssistant : ui.open}
        </button>
      </div>
    </div>
  );
}

export default Chatbot;
