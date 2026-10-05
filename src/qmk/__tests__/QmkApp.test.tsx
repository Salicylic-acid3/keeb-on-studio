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
  act,
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

    // The tap dance tab sits where the ZMK side's does.
    expect(
      screen.getAllByRole("tab", { name: "Macro, Combo & Tap Dance" }).length,
    ).toBeGreaterThan(0);

    // My keymaps, as on the ZMK side: keep a named copy in this browser.
    fireEvent.click(screen.getByRole("button", { name: /My keymaps/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Save this keymap/ }));
    const menu = screen.getByRole("menu");
    fireEvent.change(within(menu).getByLabelText("Name"), {
      target: { value: "温泉" },
    });
    fireEvent.click(within(menu).getByRole("button", { name: "Save" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    fireEvent.click(screen.getByRole("button", { name: /My keymaps/ }));
    expect(await screen.findByText("温泉")).toBeInTheDocument();
    // Demo mode keeps keymaps but does not hand them out.
    expect(
      screen.queryByRole("button", { name: /Publish 温泉 to the gallery/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /My keymaps/ }));

    // Combos: "+" opens an editor in the right column, as on the ZMK side.
    const mcTab = screen.getAllByRole("tab", {
      name: "Macro, Combo & Tap Dance",
    })[0];
    fireEvent.mouseDown(mcTab, { button: 0 });
    fireEvent.click(mcTab);
    fireEvent.click(await screen.findByTitle("Create macro"));
    expect(
      await screen.findByText("No steps in this macro"),
    ).toBeInTheDocument();
    // Tap dances list only the slots in use; "+" takes a free one.
    expect(
      await screen.findByText("No tap dances configured"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("New tap dance"));
    expect(screen.queryByText("No tap dances configured")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByText("No tap dances configured"),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByTitle("New combo"));
    expect(await screen.findByText("Combo Editor")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Combo Global Settings"));
    expect(await screen.findByText("Combo timeout")).toBeInTheDocument();
    // Tap-hold settings are no longer on the tap dance list.
    expect(screen.queryByTitle("Tap-Hold Settings")).toBeNull();
    fireEvent.click(screen.getByTitle("New key override"));
    expect(await screen.findByText("Key Override Editor")).toBeInTheDocument();
    const kmTab = screen.getAllByRole("tab", { name: "Keymap" })[0];
    fireEvent.mouseDown(kmTab, { button: 0 });
    fireEvent.click(kmTab);

    // The OS tab exists because the demo firmware has the module.
    expect(screen.getAllByRole("tab", { name: "OS" }).length).toBeGreaterThan(
      0,
    );

    // Keyboard-wide settings on their own tab, as on the ZMK side: Vial's
    // Tap-Hold fields and mouse keys.
    const settingsTab = screen.getAllByRole("tab", { name: "Settings" })[0];
    fireEvent.mouseDown(settingsTab, { button: 0 });
    fireEvent.click(settingsTab);
    expect(
      await screen.findByText("Ignore Mod Tap Interrupt"),
    ).toBeInTheDocument();
    expect(screen.getByText("Tapping Force Hold")).toBeInTheDocument();
    expect(screen.getByText("Cursor: step size")).toBeInTheDocument();
    const kmTab2 = screen.getAllByRole("tab", { name: "Keymap" })[0];
    fireEvent.mouseDown(kmTab2, { button: 0 });
    fireEvent.click(kmTab2);
    await screen.findByRole("button", { name: /My keymaps/ });

    // Clicking a key opens the shared picker dialog.
    fireEvent.click(keys[0]);
    expect(await screen.findByText("Select Key Binding")).toBeInTheDocument();
  });
});
