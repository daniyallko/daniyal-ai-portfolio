// Deterministic replies for greetings and small talk: no retrieval, no model call.
export type SmallTalkIntent = "greeting" | "how_are_you" | "thanks" | "bye" | "identity";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

const FILL = "(?:\\s+(?:there|all|everyone|bot|buddy|friend|daniyal|sir|team|ji|bhai|dear))*";
const RX: [SmallTalkIntent, RegExp][] = [
  ["greeting", new RegExp(`^(?:hi+|hey+|hello+|helo|hiya|yo|sup|howdy|greetings|namaste|namaskar|salaam|salam|assalamualaikum|asalam o alaikum|hola|good (?:morning|afternoon|evening|day)|gm|नमस्ते|नमस्कार|हैलो)${FILL}$`, "u")],
  ["how_are_you", /^(?:(?:hi|hey|hello)\s+)?(?:how are (?:you|u)(?: doing)?(?: today)?|how s it going|how r u|whats up|what s up|kaise ho|kaise hain aap|aap kaise ho|कैसे हो)$/u],
  ["thanks", new RegExp(`^(?:thanks?|thank (?:you|u)(?: so much| very much)?|thx|ty|tysm|shukriya|dhanyavad|great thanks|ok thanks|okay thanks|cool thanks|धन्यवाद|शुक्रिया)${FILL}$`, "u")],
  ["bye", new RegExp(`^(?:bye+|goodbye|good bye|see (?:you|ya)(?: later)?|good night|gn|take care|cya|alvida|अलविदा)${FILL}$`, "u")],
  ["identity", /^(?:who are (?:you|u)|what are (?:you|u)|what can (?:you|u) do|help|what do you do|tum kaun ho|aap kaun ho)$/u],
];

export function detectSmallTalk(message: string): SmallTalkIntent | null {
  const t = norm(message);
  if (!t || t.length > 40) return null;
  for (const [intent, rx] of RX) if (rx.test(t)) return intent;
  return null;
}

const TOPICS =
  "

Tap a question to ask:
- [What is Daniyal's tech stack?](#ask)
- [Tell me about AI BotKit](#ask)
- [What agentic AI and RAG projects has he built?](#ask)
- [What did he do at Edwiser?](#ask)

Or [download his resume](/api/public/resume).";
const TOPICS_HI =
  "

सवाल पर tap करें:
- [Daniyal का tech stack क्या है?](#ask)
- [AI BotKit के बारे में बताइए](#ask)
- [उन्होंने कौन से agentic AI और RAG projects बनाए हैं?](#ask)
- [Edwiser में उन्होंने क्या काम किया?](#ask)

या [resume download करें](/api/public/resume)।";

export function smallTalkReply(message: string, lang: string, firstTurn: boolean): string | null {
  const intent = detectSmallTalk(message);
  if (!intent) return null;
  const hi = lang === "hi";
  const t = norm(message);
  const timed = t.match(/good (morning|afternoon|evening)/)?.[1];
  switch (intent) {
    case "greeting": {
      const open = hi
        ? "नमस्ते! मैं Daniyal का AI portfolio assistant हूँ।"
        : `${timed ? `Good ${timed}!` : "Hi there!"} I'm Daniyal's AI portfolio assistant.`;
      return firstTurn ? open + (hi ? TOPICS_HI : TOPICS) : hi ? "नमस्ते! और क्या जानना चाहेंगे?" : `${timed ? `Good ${timed}!` : "Hi again!"} What else would you like to know about Daniyal?`;
    }
    case "how_are_you":
      return hi
        ? "मैं बढ़िया हूँ, पूछने के लिए धन्यवाद! Daniyal के बारे में क्या जानना चाहेंगे?" + (firstTurn ? TOPICS_HI : "")
        : "Doing great, thanks for asking! What would you like to know about Daniyal?" + (firstTurn ? TOPICS : "");
    case "thanks":
      return hi
        ? "आपका स्वागत है! कुछ और पूछना हो तो बताइए, या [Daniyal से contact करें](/?hl=contact)।"
        : "You're welcome! Ask me anything else, or [get in touch with Daniyal](/?hl=contact) directly.";
    case "bye":
      return hi
        ? "धन्यवाद! आपका दिन शुभ हो। [Resume download करें](/api/public/resume) या [contact करें](/?hl=contact)।"
        : "Thanks for stopping by! Feel free to [download the resume](/api/public/resume) or [contact Daniyal](/?hl=contact) anytime.";
    case "identity":
      return (hi
        ? "मैं Daniyal का AI assistant हूँ। मैं उनके portfolio से cited जवाब देता हूँ।"
        : "I'm Daniyal's AI portfolio assistant. I answer questions about his work with citations from his portfolio.") + (hi ? TOPICS_HI : TOPICS);
  }
}
