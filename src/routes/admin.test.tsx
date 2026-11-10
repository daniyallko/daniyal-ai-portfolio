import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "./_authenticated/admin";

const mocks = vi.hoisted(() => ({
  amIAdmin: vi.fn(),
  adminListVisitors: vi.fn(),
  adminGetThread: vi.fn(),
  signOut: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/admin.functions", () => ({
  amIAdmin: mocks.amIAdmin,
  adminListVisitors: mocks.adminListVisitors,
  adminGetThread: mocks.adminGetThread,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: mocks.signOut } },
}));
vi.mock("@/components/admin-kb", () => ({
  AdminKb: () => <section aria-label="Knowledge base editor">Knowledge base editor</section>,
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

const AdminPage = Route.options.component!;
const visitor = {
  id: "abcd1234-visitor",
  first_seen: "2026-11-08T10:00:00Z",
  last_seen: "2026-11-09T10:00:00Z",
  visits: 4,
  ip: "192.0.2.1",
  country: "India",
  city: "Lucknow",
  user_agent: "Fixture browser with a deliberately long user agent string",
  referrer: "https://example.com/a/really/long/referrer/path/that/must/not/overflow",
  language: "en-IN",
  landing_path: "/",
  threads: [
    {
      id: "thread-first",
      title: "Production RAG architecture",
      updated_at: "2026-11-09T09:00:00Z",
    },
    { id: "thread-second", title: "Voice systems", updated_at: "2026-11-09T08:00:00Z" },
  ],
};

function renderAdmin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({});
  mocks.adminGetThread.mockImplementation(({ data }: { data: { threadId: string } }) =>
    Promise.resolve([
      {
        id: `message-${data.threadId}`,
        role: "assistant",
        content: `Answer from ${data.threadId}`,
        created_at: "2026-11-09T09:30:00Z",
        voice: false,
      },
    ]),
  );
});

describe("AdminPage", () => {
  it("announces access loading inside a main landmark", () => {
    mocks.amIAdmin.mockReturnValue(new Promise(() => {}));
    renderAdmin();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/checking access/i);
  });

  it("presents access denial with sign-out recovery", async () => {
    mocks.amIAdmin.mockResolvedValue({ admin: false });
    renderAdmin();
    expect(await screen.findByRole("alert")).toHaveTextContent(/not the admin/i);
    expect(screen.getByRole("main")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/auth", replace: true });
  });

  it("keeps sessions/KB tabs and selects the visitor's first thread", async () => {
    mocks.amIAdmin.mockResolvedValue({ admin: true });
    mocks.adminListVisitors.mockResolvedValue([visitor]);
    renderAdmin();

    const sessions = await screen.findByRole("tab", { name: /Sessions \(1\)/ });
    expect(sessions).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Knowledge base" }));
    expect(screen.getByRole("region", { name: "Knowledge base editor" })).toBeInTheDocument();
    fireEvent.click(sessions);

    fireEvent.click(await screen.findByRole("button", { name: /Visitor abcd1234/ }));
    await waitFor(() =>
      expect(mocks.adminGetThread).toHaveBeenCalledWith({ data: { threadId: "thread-first" } }),
    );
    expect(await screen.findByText("Answer from thread-first")).toBeInTheDocument();
    expect(screen.getByText(/Fixture browser with a deliberately long/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voice systems" }));
    await waitFor(() =>
      expect(mocks.adminGetThread).toHaveBeenCalledWith({ data: { threadId: "thread-second" } }),
    );
    expect(await screen.findByText("Answer from thread-second")).toBeInTheDocument();
  });

  it("offers a useful empty sessions state", async () => {
    mocks.amIAdmin.mockResolvedValue({ admin: true });
    mocks.adminListVisitors.mockResolvedValue([]);
    renderAdmin();
    expect(await screen.findByText("No visitor sessions yet")).toBeInTheDocument();
    expect(screen.getByText(/new visits and conversations will appear here/i)).toBeInTheDocument();
  });
});
