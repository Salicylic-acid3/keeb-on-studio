/**
 * Tests for mouse movement/scroll encoding/decoding
 */
import {
  encodeMouseMove,
  decodeMouseMove,
  MOUSE_MOVEMENTS,
  MOUSE_SCROLLS,
  ZMK_POINTING_DEFAULT_MOVE_VAL,
  ZMK_POINTING_DEFAULT_SCRL_VAL,
} from "../keycodes";

describe("Mouse Movement Encoding/Decoding", () => {
  describe("encode and decodeMouseMove", () => {
    test("decodes positive X and Y", () => {
      const encoded = encodeMouseMove(600, 10);
      const result = decodeMouseMove(encoded);
      expect(result.x).toBe(600);
      expect(result.y).toBe(10);
    });

    test("decodes negative X and positive Y", () => {
      const encoded = encodeMouseMove(-600, 10);
      const result = decodeMouseMove(encoded);
      expect(result.x).toBe(-600);
      expect(result.y).toBe(10);
    });

    test("decodes positive X and negative Y", () => {
      const encoded = encodeMouseMove(600, -10);
      const result = decodeMouseMove(encoded);
      expect(result.x).toBe(600);
      expect(result.y).toBe(-10);
    });

    test("decodes negative X and Y", () => {
      const encoded = encodeMouseMove(-600, -10);
      const result = decodeMouseMove(encoded);
      expect(result.x).toBe(-600);
      expect(result.y).toBe(-10);
    });

    test("decodes zero X and Y", () => {
      const result = decodeMouseMove(0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe("Round-trip encoding/decoding", () => {
    test("round-trip with default movement value", () => {
      const encoded = encodeMouseMove(
        ZMK_POINTING_DEFAULT_MOVE_VAL,
        -ZMK_POINTING_DEFAULT_MOVE_VAL,
      );
      const decoded = decodeMouseMove(encoded);
      expect(decoded.x).toBe(ZMK_POINTING_DEFAULT_MOVE_VAL);
      expect(decoded.y).toBe(-ZMK_POINTING_DEFAULT_MOVE_VAL);
    });

    test("round-trip with default scroll value", () => {
      const encoded = encodeMouseMove(
        -ZMK_POINTING_DEFAULT_SCRL_VAL,
        ZMK_POINTING_DEFAULT_SCRL_VAL,
      );
      const decoded = decodeMouseMove(encoded);
      expect(decoded.x).toBe(-ZMK_POINTING_DEFAULT_SCRL_VAL);
      expect(decoded.y).toBe(ZMK_POINTING_DEFAULT_SCRL_VAL);
    });

    test("round-trip with various values", () => {
      const testCases = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: -1, y: -1 },
        { x: 1000, y: -1000 },
        { x: -5000, y: 5000 },
        { x: 32767, y: -32768 },
      ];

      testCases.forEach(({ x, y }) => {
        const encoded = encodeMouseMove(x, y);
        const decoded = decodeMouseMove(encoded);
        expect(decoded.x).toBe(x);
        expect(decoded.y).toBe(y);
      });
    });
  });

  describe("MOUSE_MOVEMENTS presets", () => {
    test("Move Up has correct encoding", () => {
      const moveUp = MOUSE_MOVEMENTS[0];
      expect(moveUp.label).toBe("Move Up");
      const decoded = decodeMouseMove(moveUp.value);
      expect(decoded.x).toBe(0);
      expect(decoded.y).toBe(-ZMK_POINTING_DEFAULT_MOVE_VAL);
    });

    test("Move Down has correct encoding", () => {
      const moveDown = MOUSE_MOVEMENTS[1];
      expect(moveDown.label).toBe("Move Down");
      const decoded = decodeMouseMove(moveDown.value);
      expect(decoded.x).toBe(0);
      expect(decoded.y).toBe(ZMK_POINTING_DEFAULT_MOVE_VAL);
    });

    test("Move Left has correct encoding", () => {
      const moveLeft = MOUSE_MOVEMENTS[2];
      expect(moveLeft.label).toBe("Move Left");
      const decoded = decodeMouseMove(moveLeft.value);
      expect(decoded.x).toBe(-ZMK_POINTING_DEFAULT_MOVE_VAL);
      expect(decoded.y).toBe(0);
    });

    test("Move Right has correct encoding", () => {
      const moveRight = MOUSE_MOVEMENTS[3];
      expect(moveRight.label).toBe("Move Right");
      const decoded = decodeMouseMove(moveRight.value);
      expect(decoded.x).toBe(ZMK_POINTING_DEFAULT_MOVE_VAL);
      expect(decoded.y).toBe(0);
    });
  });

  describe("MOUSE_SCROLLS presets", () => {
    test("Scroll Up has correct encoding", () => {
      const scrollUp = MOUSE_SCROLLS[0];
      expect(scrollUp.label).toBe("Scroll Up");
      const decoded = decodeMouseMove(scrollUp.value);
      expect(decoded.x).toBe(0);
      expect(decoded.y).toBe(ZMK_POINTING_DEFAULT_SCRL_VAL);
    });

    test("Scroll Down has correct encoding", () => {
      const scrollDown = MOUSE_SCROLLS[1];
      expect(scrollDown.label).toBe("Scroll Down");
      const decoded = decodeMouseMove(scrollDown.value);
      expect(decoded.x).toBe(0);
      expect(decoded.y).toBe(-ZMK_POINTING_DEFAULT_SCRL_VAL);
    });

    test("Scroll Left has correct encoding", () => {
      const scrollLeft = MOUSE_SCROLLS[2];
      expect(scrollLeft.label).toBe("Scroll Left");
      const decoded = decodeMouseMove(scrollLeft.value);
      expect(decoded.x).toBe(-ZMK_POINTING_DEFAULT_SCRL_VAL);
      expect(decoded.y).toBe(0);
    });

    test("Scroll Right has correct encoding", () => {
      const scrollRight = MOUSE_SCROLLS[3];
      expect(scrollRight.label).toBe("Scroll Right");
      const decoded = decodeMouseMove(scrollRight.value);
      expect(decoded.x).toBe(ZMK_POINTING_DEFAULT_SCRL_VAL);
      expect(decoded.y).toBe(0);
    });
  });
});
