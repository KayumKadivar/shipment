// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Form } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ProductHazmatFields from "./ProductHazmatFields";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each(["hazmatUN", "hazmatClass"])("ProductHazmatFields_when%sExceeds50Characters_blocksSubmission", async (field) => {
  const onFinish = vi.fn();
  render(<Form onFinish={onFinish} initialValues={{ [field]: "X".repeat(51) }}>
    <ProductHazmatFields visible /><button type='submit'>Save</button>
  </Form>);
  fireEvent.click(screen.getByText("Save"));
  expect(await screen.findByText("Use 50 characters or fewer")).toBeTruthy();
  expect(onFinish).not.toHaveBeenCalled();
});

it.each(["hazmatUN", "hazmatClass"])("ProductHazmatFields_when%sHas50Characters_allowsSubmission", async (field) => {
  const onFinish = vi.fn();
  render(<Form onFinish={onFinish} initialValues={{ [field]: "X".repeat(50) }}>
    <ProductHazmatFields visible /><button type='submit'>Save</button>
  </Form>);
  fireEvent.click(screen.getByText("Save"));
  await waitFor(() => expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ [field]: "X".repeat(50) })));
});

it("ProductHazmatFields_whenAllValuesAreMissing_allowsSubmission", async () => {
  const onFinish = vi.fn();
  render(<Form onFinish={onFinish}><ProductHazmatFields visible /><button type='submit'>Save</button></Form>);
  fireEvent.click(screen.getByText("Save"));
  await waitFor(() => expect(onFinish).toHaveBeenCalled());
});
