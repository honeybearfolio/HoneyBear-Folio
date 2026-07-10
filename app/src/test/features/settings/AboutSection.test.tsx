import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AboutSection from "../../../features/settings/AboutSection";
import THIRD_PARTY_LICENSES from "../../../config/licenses";
import { EXTERNAL_URLS } from "../../../constants/app";

describe("AboutSection", () => {
  const openExternal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders app name and section headings", () => {
    render(<AboutSection openExternal={openExternal} />);

    expect(screen.getByText("HoneyBear Folio")).toBeInTheDocument();
    expect(screen.getByText("Copyright")).toBeInTheDocument();
    expect(screen.getByText("License")).toBeInTheDocument();
    expect(screen.getByText("Third-Party Software")).toBeInTheDocument();
    expect(screen.getByText("Contributors")).toBeInTheDocument();
  });

  it("calls openExternal when external links are clicked", async () => {
    const user = userEvent.setup();
    render(<AboutSection openExternal={openExternal} />);

    await user.click(screen.getByRole("link", { name: /Official Website/i }));
    expect(openExternal).toHaveBeenCalledWith(EXTERNAL_URLS.WEBSITE);

    await user.click(screen.getByRole("link", { name: /GitHub Repository/i }));
    expect(openExternal).toHaveBeenCalledWith(EXTERNAL_URLS.GITHUB_REPO);

    await user.click(screen.getByRole("link", { name: /View full license/i }));
    expect(openExternal).toHaveBeenCalledWith(EXTERNAL_URLS.LICENSE);

    await user.click(screen.getByRole("link", { name: /Documentation/i }));
    expect(openExternal).toHaveBeenCalledWith(EXTERNAL_URLS.DOCS);
  });

  it("calls openExternal when contributor profile is clicked", async () => {
    const user = userEvent.setup();
    render(<AboutSection openExternal={openExternal} />);

    await user.click(screen.getByRole("link", { name: /BernatBC/i }));
    expect(openExternal).toHaveBeenCalledWith("https://github.com/BernatBC");
  });

  it("toggles third-party license list visibility", async () => {
    const user = userEvent.setup();
    render(<AboutSection openExternal={openExternal} />);

    const showButton = screen.getByRole("button", {
      name: new RegExp(`Show all \\(${String(THIRD_PARTY_LICENSES.length)}\\)`),
    });
    expect(
      screen.queryByText(THIRD_PARTY_LICENSES[0]!.name),
    ).not.toBeInTheDocument();

    await user.click(showButton);
    expect(screen.getByText(THIRD_PARTY_LICENSES[0]!.name)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Hide/i }));
    expect(
      screen.queryByText(THIRD_PARTY_LICENSES[0]!.name),
    ).not.toBeInTheDocument();
  });

  it("calls openExternal when a license link is clicked", async () => {
    const user = userEvent.setup();
    render(<AboutSection openExternal={openExternal} />);

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(
          `Show all \\(${String(THIRD_PARTY_LICENSES.length)}\\)`,
        ),
      }),
    );

    const firstLicense = THIRD_PARTY_LICENSES[0]!;
    await user.click(screen.getByRole("link", { name: firstLicense.name }));
    expect(openExternal).toHaveBeenCalledWith(firstLicense.url);
  });

  it("calls openExternal for feature request, issue report, and coffee links", async () => {
    const user = userEvent.setup();
    const githubRepoUrl = EXTERNAL_URLS.GITHUB_REPO ?? "";
    render(<AboutSection openExternal={openExternal} />);

    await user.click(screen.getByRole("link", { name: /Request a Feature/i }));
    expect(openExternal).toHaveBeenCalledWith(
      `${githubRepoUrl}/issues/new?template=feature_request.md`,
    );

    await user.click(screen.getByRole("link", { name: /Report an Issue/i }));
    expect(openExternal).toHaveBeenCalledWith(
      `${githubRepoUrl}/issues/new?template=bug_report.md`,
    );

    await user.click(screen.getByRole("link", { name: /Buy Me a Coffee/i }));
    expect(openExternal).toHaveBeenCalledWith(EXTERNAL_URLS.BUY_ME_A_COFFEE);
  });
});
