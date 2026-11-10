import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceSwitcher, useVoicePrefs } from "./voice-switcher";
import { getPersona } from "@/config/voicePersonas";
import { LANGUAGES } from "@/lib/language";

function renderSwitcher() {
  const onPersona = vi.fn();
  const onLock = vi.fn();
  const onPreview = vi.fn();
  render(
    <VoiceSwitcher
      persona={getPersona("lead")}
      onPersona={onPersona}
      lock={null}
      onLock={onLock}
      detected={{
        code: "fr",
        name: LANGUAGES.fr.name,
        script: "Latin",
        isCodeSwitched: false,
        confidence: 0.9,
      }}
      previewing={null}
      previewState="idle"
      onPreview={onPreview}
    />,
  );
  return { onPersona, onLock, onPreview };
}

function trigger() {
  return screen.getByRole("button", { name: /^Voice and language:/ });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

function VoicePrefsHarness() {
  const prefs = useVoicePrefs();
  return (
    <button type="button" onClick={() => prefs.setPersonaId("architect")}>
      Current: {prefs.persona.name}
    </button>
  );
}

describe("VoiceSwitcher", () => {
  it("retains in-memory preferences when storage reads and writes are denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    render(<VoicePrefsHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Current: Engineering Lead" }));
    expect(
      screen.getByRole("button", { name: "Current: Technical Architect" }),
    ).toBeInTheDocument();
  });

  it("selects and previews real personas and locks a language", () => {
    const spies = renderSwitcher();
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    const architect = screen.getByRole("button", { name: /Measured, precise/ });
    expect(architect).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(architect);
    expect(spies.onPersona).toHaveBeenCalledWith("architect");
    fireEvent.click(screen.getByRole("button", { name: "Preview Technical Architect" }));
    expect(spies.onPreview).toHaveBeenCalledWith(getPersona("architect"));

    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "fr" },
    });
    expect(spies.onLock).toHaveBeenCalledWith("fr");
  });

  it("dismisses outside and restores trigger focus on Escape", () => {
    renderSwitcher();
    const button = trigger();
    button.focus();
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Voice and language" })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Voice and language" })).not.toBeInTheDocument();

    fireEvent.click(button);
    screen.getByRole("button", { name: "Preview Technical Architect" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Voice and language" })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("keeps persona labels wrapping inside a viewport-bounded popover", () => {
    renderSwitcher();
    fireEvent.click(trigger());
    const dialog = screen.getByRole("dialog", { name: "Voice and language" });
    expect(dialog.className).toContain("w-[min(360px,calc(100vw-2rem))]");
    expect(screen.getByText("Conversational Peer").className).not.toContain("truncate");
    expect(screen.getByRole("button", { name: "Preview Technical Architect" }).className).toContain(
      "min-w-11",
    );
    expect(screen.getByRole("option", { name: "Lock: Portuguese" })).toBeInTheDocument();
  });
});
