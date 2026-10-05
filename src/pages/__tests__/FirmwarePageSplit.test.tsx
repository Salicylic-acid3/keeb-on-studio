import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { FirmwarePage } from "../FirmwarePage";

function renderPage(firmware: "zmk" | "qmk", onFirmwareChange = jest.fn()) {
  render(
    <LanguageProvider>
      <FirmwarePage firmware={firmware} onFirmwareChange={onFirmwareChange} />
    </LanguageProvider>,
  );
  return onFirmwareChange;
}

describe("Firmware page, one firmware at a time", () => {
  it("ZMK shows only the ZMK keyboards", () => {
    renderPage("zmk");
    expect(screen.getByText("ClickBoard ErgoTrack")).toBeInTheDocument();
    expect(screen.queryByText("GoForty JP")).toBeNull();
  });

  it("QMK shows only the QMK keyboards, and the toggle switches", () => {
    const onChange = renderPage("qmk");
    expect(screen.getByText("GoForty JP")).toBeInTheDocument();
    // Every QMK board takes a .uf2; STM32G0 boards still without the
    // bootloader get it (once) and their old .bin.
    expect(screen.getByText("clickboard_tenkey.uf2")).toBeInTheDocument();
    expect(screen.getByText("clickboard_tenkey-dfu.bin")).toBeInTheDocument();
    expect(screen.getByText("tinyuf2-stm32g0b1.bin")).toBeInTheDocument();
    expect(screen.queryByText("ClickBoard ErgoTrack")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^zmk$/i }));
    expect(onChange).toHaveBeenCalledWith("zmk");
  });
});
