import { createFileRoute } from "@tanstack/react-router";
import { ThreadView } from "@/components/thread-view";

export const Route = createFileRoute("/chat/$threadId")({
  staticData: { sitemap: false },
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recruiter Assistant — Mohd Daniyal" },
      {
        name: "description",
        content:
          "Ask Mohd Daniyal’s portfolio assistant about projects, engineering experience and technical skills.",
      },
      { property: "og:title", content: "Mohd Daniyal — Recruiter Assistant" },
      {
        property: "og:description",
        content: "Cited portfolio answers and multilingual voice conversations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  return <ThreadView key={threadId} threadId={threadId} />;
}
