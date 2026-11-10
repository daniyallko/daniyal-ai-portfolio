import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminKb } from "./admin-kb";

const mocks = vi.hoisted(() => ({
  adminDeleteKbDoc: vi.fn(),
  adminListKb: vi.fn(),
  adminReindexKb: vi.fn(),
  adminSaveKbDoc: vi.fn(),
  getDocumentProxy: vi.fn(),
  extractText: vi.fn(),
}));

vi.mock("@/lib/admin.functions", () => ({
  adminDeleteKbDoc: mocks.adminDeleteKbDoc,
  adminListKb: mocks.adminListKb,
  adminReindexKb: mocks.adminReindexKb,
  adminSaveKbDoc: mocks.adminSaveKbDoc,
}));
vi.mock("unpdf", () => ({ getDocumentProxy: mocks.getDocumentProxy, extractText: mocks.extractText }));

const doc = { id: "doc-1", title: "Owner handbook", section: "Documents", content: "A sufficiently long source document for the recruiter knowledge base.", source_type: "text", chunks: 2 };
const base = [{ id: "base-1", section: "Projects", title: "AI BotKit", text: "Built-in project evidence." }];

function renderKb() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><AdminKb /></QueryClientProvider>);
}

function fillValidDraft() {
  fireEvent.change(screen.getByLabelText("Source title"), { target: { value: "New certification" } });
  fireEvent.change(screen.getByLabelText("Section"), { target: { value: "Certifications" } });
  fireEvent.change(screen.getByLabelText("Source content"), { target: { value: "Detailed certification evidence with enough characters to save." } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminListKb.mockResolvedValue({ docs: [doc], base });
  mocks.adminSaveKbDoc.mockResolvedValue({ chunks: 42, ms: 120 });
  mocks.adminDeleteKbDoc.mockResolvedValue({ chunks: 40, ms: 100 });
  mocks.adminReindexKb.mockResolvedValue({ chunks: 42, ms: 90 });
  mocks.getDocumentProxy.mockResolvedValue({ fixture: true });
});
afterEach(() => vi.restoreAllMocks());

describe("AdminKb", () => {
  it("labels editor fields and enforces save readiness without changing draft shape", async () => {
    renderKb();
    const save = screen.getByRole("button", { name: "Add + reindex" });
    expect(save).toBeDisabled();
    expect(screen.getByLabelText("Upload PDF")).toHaveAttribute("accept", "application/pdf");

    fireEvent.change(screen.getByLabelText("Source title"), { target: { value: "Short" } });
    fireEvent.change(screen.getByLabelText("Source content"), { target: { value: "too short" } });
    expect(save).toBeDisabled();
    fillValidDraft();
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(mocks.adminSaveKbDoc).toHaveBeenCalledWith({ data: { title: "New certification", section: "Certifications", content: "Detailed certification evidence with enough characters to save.", source_type: "text" } }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Add ok — corpus 42 chunks, embedded \+ cache warmed in 120ms/);
  });

  it("extracts PDF text for review and preserves PDF draft type", async () => {
    mocks.extractText.mockResolvedValue({ text: ["First extracted page with useful evidence.", "Second extracted page with more detail."] });
    renderKb();
    const file = new File(["pdf"], "research-notes.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockResolvedValue(new Uint8Array([1, 2]).buffer) });

    fireEvent.change(screen.getByLabelText("Upload PDF"), { target: { files: [file] } });
    expect(await screen.findByRole("status")).toHaveTextContent(/Extracted .* characters — review, then save/);
    expect(screen.getByLabelText("Source title")).toHaveValue("research-notes");
    expect(screen.getByLabelText("Source content")).toHaveValue("First extracted page with useful evidence.\n\nSecond extracted page with more detail.");

    fireEvent.click(screen.getByRole("button", { name: "Add + reindex" }));
    await waitFor(() => expect(mocks.adminSaveKbDoc).toHaveBeenCalledWith({ data: expect.objectContaining({ source_type: "pdf", title: "research-notes" }) }));
  });

  it("announces PDF extraction failures", async () => {
    mocks.extractText.mockRejectedValue(new Error("Malformed PDF"));
    renderKb();
    const file = new File(["pdf"], "broken.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn().mockResolvedValue(new Uint8Array([1]).buffer) });

    fireEvent.change(screen.getByLabelText("Upload PDF"), { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("PDF failed: Malformed PDF");
  });

  it("confirms deletion and reports reindex completion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderKb();
    fireEvent.click(await screen.findByRole("button", { name: 'Delete "Owner handbook"' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete "Owner handbook"?');
    await waitFor(() => expect(mocks.adminDeleteKbDoc).toHaveBeenCalledWith({ data: { id: "doc-1" } }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Delete ok — corpus 40 chunks/);

    fireEvent.click(screen.getByRole("button", { name: "Reindex + warm cache" }));
    await waitFor(() => expect(mocks.adminReindexKb).toHaveBeenCalled());
    expect(await screen.findByRole("status")).toHaveTextContent(/Reindex ok — corpus 42 chunks/);
  });

  it("keeps built-in sources inspectable and empty guidance useful", async () => {
    mocks.adminListKb.mockResolvedValue({ docs: [], base });
    renderKb();
    expect(await screen.findByText("No added sources yet")).toBeInTheDocument();
    expect(screen.getByText(/upload a pdf or paste a reviewed source/i)).toBeInTheDocument();
    const disclosure = screen.getByText(/Built-in portfolio chunks \(1\)/i);
    fireEvent.click(disclosure);
    expect(screen.getByText("Built-in project evidence.")).toBeVisible();
  });
});
