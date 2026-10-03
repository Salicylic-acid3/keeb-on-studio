import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { TextDecoder as NodeTextDecoder } from "node:util";
Object.assign(globalThis, {
  ReadableStream: globalThis.ReadableStream ?? NodeReadableStream,
  TextDecoder: globalThis.TextDecoder ?? NodeTextDecoder,
});

import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { ThemeProvider } from "../../contexts/ThemeContext";
import { KeyboardLayoutProvider } from "../../contexts/KeyboardLayoutProvider";
import { QmkApp } from "../QmkApp";

jest.mock("../../lib/analytics", () => ({ trackPageView: jest.fn() }));

function renderApp() {
  window.history.replaceState(null, "", "/qmk");
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <KeyboardLayoutProvider>
          <QmkApp
            onFirmwareChange={jest.fn()}
            onShowReleaseNotes={jest.fn()}
            onShowAbout={jest.fn()}
            onShowDownloads={jest.fn()}
          />
        </KeyboardLayoutProvider>
      </LanguageProvider>
    </ThemeProvider>,
  );
}

describe("QmkApp demo mode", () => {
  test("connects to the demo keyboard, shows OS blocks and edits a key", async () => {
    renderApp();
    expect(screen.getByText(/ClickBoard ErgoMini/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Try Demo Mode"));

    await waitFor(() =>
      expect(
        screen.getByText("ClickBoard ErgoMini (demo)"),
      ).toBeInTheDocument(),
    );
    // Three OS blocks, one of them active.
    const blocks = screen.getByRole("tablist", { name: "OS blocks" });
    expect(within(blocks).getAllByRole("tab")).toHaveLength(3);
    expect(within(blocks).getByText("Active")).toBeInTheDocument();
    // 50 keys drawn.
    const board = screen.getByRole("group", { name: /Keymap of layer/ });
    expect(within(board).getAllByRole("button")).toHaveLength(50);

    // Pick the Tab key and make it Escape through the picker's key picture.
    const tabKey = within(board).getByRole("button", {
      name: /Key position 0:/,
    });
    fireEvent.click(tabKey);
    fireEvent.click(screen.getByRole("button", { name: "Esc" }));
    await waitFor(() =>
      expect(tabKey).toHaveAttribute("data-binding-label", "Escape"),
    );
    expect(screen.getByText("KC_ESC")).toBeInTheDocument();

    // The OS tab exists because the demo firmware has the module.
    expect(screen.getAllByRole("tab", { name: "OS" }).length).toBeGreaterThan(
      0,
    );
  });
});
