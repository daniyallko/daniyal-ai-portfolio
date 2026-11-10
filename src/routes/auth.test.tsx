import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "./auth";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => mocks.navigate,
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword: mocks.signInWithPassword, signUp: mocks.signUp } },
}));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => <button type="button">Theme</button> }));

const AuthPage = Route.options.component!;

function fillForm() {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "owner@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse" } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthPage", () => {
  it("labels credentials and preserves sign-in navigation and Supabase payload", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthPage />);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "owner@example.com", password: "correct-horse" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/admin" });
    expect(screen.getByRole("link", { name: /back to portfolio/i })).toHaveAttribute("href", "/");
  });

  it("announces failures without navigating", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<AuthPage />);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("exposes a disabled busy action while sign-in is pending", async () => {
    let resolve!: (value: { error: null }) => void;
    mocks.signInWithPassword.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<AuthPage />);

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const busy = screen.getByRole("button", { name: /signing in/i });
    expect(busy).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/signing in/i);

    resolve({ error: null });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
  });

  it("keeps owner sign-up payload and confirmation behavior", async () => {
    mocks.signUp.mockResolvedValue({ error: null });
    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: /create the owner account/i }));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "correct-horse",
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    }));
    expect(screen.getByRole("status")).toHaveTextContent(/check your email/i);
  });
});
