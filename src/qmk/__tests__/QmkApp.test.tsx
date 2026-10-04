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
  test("connects to the demo keyboard and shows the keymap page like the ZMK side", async () => {
    renderApp();
    expect(screen.getByText(/ClickBoard ErgoMini/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Try Demo Mode"));

    await waitFor(() =>
      expect(
        screen.getByText("ClickBoard ErgoMini (demo)"),
      ).toBeInTheDocument(),
    );
    // The same page chrome as the ZMK keymap page.
    expect(
      screen.getByText("Configure key bindings and layers"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "OS Layout:" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");

    // Three OS blocks, four layers in the open one.
    const blocks = screen.getByRole("group", { name: "OS blocks" });
    expect(within(blocks).getAllByRole("button")).toHaveLength(3);
    const layers = screen.getByRole("group", { name: "Keymap layers" });
    expect(within(layers).getAllByRole("button")).toHaveLength(4);
    expect(
      within(layers).getByRole("button", { name: "Base" }),
    ).toBeInTheDocument();

    // 50 keys drawn with the shared keycap, labelled through the bridge.
    const board = screen.getByRole("group", {
      name: "Keyboard layout for Base",
    });
    const keys = within(board).getAllByRole("button", {
      name: /Key position \d+:/,
    });
    expect(keys).toHaveLength(50);
    // Keys come in vial.json order: the first is 0,3 (E on the base layer).
    expect(keys[0]).toHaveAttribute("data-binding-label", "E");

    // The OS tab exists because the demo firmware has the module.
    expect(screen.getAllByRole("tab", { name: "OS" }).length).toBeGreaterThan(
      0,
    );

    // Clicking a key opens the shared picker dialog.
    fireEvent.click(keys[0]);
    expect(await screen.findByText("Select Key Binding")).toBeInTheDocument();
  });
});
