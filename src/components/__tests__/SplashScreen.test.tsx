import { render, screen } from "@testing-library/react";
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
});
