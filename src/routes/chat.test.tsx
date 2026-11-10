import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ChatLayout } from "@/components/chat-layout";

const mocks = vi.hoisted(() => ({
  listThreads: vi.fn(),
  createThread: vi.fn(),
  deleteThread: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  Link: ({ children, to, params, onClick, ...props }: { children: ReactNode; to: string; params?: { threadId: string }; onClick?: () => void }) => <a href={to.replace("$threadId", params?.threadId ?? "")} onClick={onClick} {...props}>{children}</a>,
  Outlet: () => <div>Current conversation</div>,
  useNavigate: () => mocks.navigate,
  useParams: () => ({ threadId: "thread-1" }),
}));
vi.mock("@/lib/chat.functions", () => ({
  listThreads: mocks.listThreads,
  createThread: mocks.createThread,
  deleteThread: mocks.deleteThread,
}));
vi.mock("@/lib/visitor", () => ({ getVisitorId: () => "visitor-test" }));

function renderLayout() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ChatLayout /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listThreads.mockResolvedValue([{ id: "thread-1", title: "RAG architecture" }]);
  mocks.createThread.mockResolvedValue({ id: "thread-new" });
});

describe("ChatLayout mobile navigation", () => {
  it("opens an accessible conversation chooser and restores focus on Escape", async () => {
    renderLayout();
    const open = screen.getByRole("button", { name: "Open conversations" });
    fireEvent.click(open);
    const dialog = await screen.findByRole("dialog", { name: "Conversations" });
    expect(await within(dialog).findByRole("link", { name: "RAG architecture" })).toHaveAttribute("href", "/chat/thread-1");
    expect(within(dialog).getByRole("button", { name: "New chat" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Conversations" })).not.toBeInTheDocument();
    expect(open).toHaveFocus();
  });

  it("creates and opens a new chat from the mobile chooser", async () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: "Open conversations" }));
    const dialog = await screen.findByRole("dialog", { name: "Conversations" });
    fireEvent.click(within(dialog).getByRole("button", { name: "New chat" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/chat/$threadId", params: { threadId: "thread-new" } }));
    expect(mocks.createThread).toHaveBeenCalledWith({ data: { visitorId: "visitor-test" } });
  });
});
