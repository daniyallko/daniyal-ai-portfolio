import { createFileRoute } from "@tanstack/react-router";
import { ChatLayout } from "@/components/chat-layout";

export const Route = createFileRoute("/chat")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ask Daniyal's AI — Recruiter Assistant" },
      {
        name: "description",
        content:
          "Chat with an AI assistant that answers questions about Mohd Daniyal's experience, with cited sources.",
      },
      { property: "og:title", content: "Ask Daniyal's AI — Recruiter Assistant" },
      {
        property: "og:description",
        content: "RAG assistant over Mohd Daniyal's portfolio, with inline citations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatLayout,
});
