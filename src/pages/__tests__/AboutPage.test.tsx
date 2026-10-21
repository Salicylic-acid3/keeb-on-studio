import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { qmkSeries } from "../../lib/firmwareDownloads";
import { AboutPage } from "../AboutPage";

function renderPage(firmware: "zmk" | "qmk") {
  const onFirmwareChange = jest.fn();
  const onShowDownloads = jest.fn();
  render(
    <LanguageProvider>
      <AboutPage
        firmware={firmware}
        onBack={jest.fn()}
        onFirmwareChange={onFirmwareChange}
        onShowDownloads={onShowDownloads}
      />
    </LanguageProvider>,
  );
  return { onFirmwareChange, onShowDownloads };
}

describe("About page, one per firmware", () => {
  it("ZMK keeps the ZMK keyboards and offers the switch to QMK", () => {
    const { onFirmwareChange } = renderPage("zmk");
    expect(screen.getByText("ClickBoard ErgoTrack")).toBeInTheDocument();
    expect(screen.queryByText("BeThirty")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^qmk$/i }));
    expect(onFirmwareChange).toHaveBeenCalledWith("qmk");
  });

  it("QMK lists every QMK keyboard series, says Vial firmware, and links the downloads", () => {
    const { onFirmwareChange, onShowDownloads } = renderPage("qmk");
    for (const { series } of qmkSeries()) {
      expect(screen.getAllByText(series).length).toBeGreaterThan(0);
    }
    expect(
      screen.getByText("GoForty JP / GoForty Ortho / GoForty RS / GoForty US"),
    ).toBeInTheDocument();
    // Nothing about ZMK Studio or Bluetooth on the QMK page.
    expect(screen.queryByText(/BLE/)).toBeNull();
    expect(screen.getAllByText(/Vial/).length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getAllByRole("button", { name: /download page/ })[0],
    );
    expect(onShowDownloads).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^zmk$/i }));
    expect(onFirmwareChange).toHaveBeenCalledWith("zmk");
  });
});
