import { fireEvent, render, screen } from "@testing-library/react";
import { SplashScreen } from "../SplashScreen";

describe("SplashScreen", () => {
  test("offers USB and the demo, and does not offer Bluetooth", () => {
    // Bluetooth is deliberately absent — see connectionMethods.ts. It is
    // asserted rather than left unmentioned because the button is still in
    // the file behind a flag, and a flag that quietly flips back on would put
    // a connection route in front of people that the firmware cannot serve.
    const onConnect = jest.fn();

    render(
      <SplashScreen onConnect={onConnect} isConnecting={false} error={null} />,
    );

    expect(screen.getByLabelText("Connect via USB")).toBeInTheDocument();
    expect(screen.getByLabelText("Try Demo Mode")).toBeInTheDocument();
    expect(screen.queryByLabelText("Connect via Bluetooth")).toBeNull();
  });

  test("disables the connect buttons while isConnecting is true", () => {
    const onConnect = jest.fn();

    render(
      <SplashScreen onConnect={onConnect} isConnecting={true} error={null} />,
    );

    expect(screen.getByLabelText("Connect via USB")).toBeInTheDocument();
    expect(screen.getByLabelText("Connect via USB")).toBeDisabled();
    expect(screen.getByLabelText("Try Demo Mode")).toBeDisabled();
  });

  test("shows an error message when provided", () => {
    const onConnect = jest.fn();

    render(
      <SplashScreen
        onConnect={onConnect}
        isConnecting={false}
        error="Something went wrong"
      />,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  test("offers the Home tab's content without a keyboard", () => {
    // Someone deciding whether to buy a keyboard, or sent here by a link,
    // has nothing to connect. The About page is the Home tab (features,
    // supported keyboards, Q&A) reachable from the guide under the buttons.
    const onShowAbout = jest.fn();

    render(
      <SplashScreen
        onConnect={jest.fn()}
        isConnecting={false}
        error={null}
        onShowAbout={onShowAbout}
      />,
    );

    fireEvent.click(screen.getByText("Supported keyboards and Q&A"));
    expect(onShowAbout).toHaveBeenCalledTimes(1);
  });

  test("puts firmware downloads and the Discord link under the buttons", () => {
    // The guide is why the splash is more than two hexagons: the newest
    // firmware for every keyboard and the place to report problems are
    // reachable without connecting anything.
    render(
      <SplashScreen onConnect={jest.fn()} isConnecting={false} error={null} />,
    );

    const downloads = screen
      .getAllByRole("link")
      .filter((a) =>
        a.getAttribute("href")?.includes("/releases/latest/download/"),
      );
    expect(downloads.length).toBeGreaterThanOrEqual(3);
    expect(
      downloads.some((a) =>
        a.getAttribute("href")?.endsWith("clickboard_ergotrack_right.uf2"),
      ),
    ).toBe(true);
    // Recovery firmware is not offered here: it is not what a newcomer wants.
    expect(
      downloads.some((a) => a.getAttribute("href")?.includes("settings_reset")),
    ).toBe(false);

    const discord = screen.getByRole("link", { name: /Report it on Discord/i });
    expect(discord).toHaveAttribute("href", expect.stringContaining("discord"));
  });
});
