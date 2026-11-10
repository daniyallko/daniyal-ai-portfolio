import { describe, expect, it } from "vitest";
import { linkifyContacts } from "./chat-message";

describe("linkifyContacts", () => {
  it("makes the email a mailto link", () => {
    expect(linkifyContacts("Email daniyallko@gmail.com")).toBe(
      "Email [daniyallko@gmail.com](mailto:daniyallko@gmail.com)",
    );
  });
  it("makes the phone a tel link to +917007644677", () => {
    expect(linkifyContacts("Call +91 7007644677.")).toBe("Call [+91 7007644677](tel:+917007644677).");
  });
  it("leaves existing markdown links alone", () => {
    const s = "[+91 7007644677](tel:+917007644677)";
    expect(linkifyContacts(s)).toBe(s);
  });
});
