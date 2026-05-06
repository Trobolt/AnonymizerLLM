import { describe, it, expect, beforeEach } from "vitest";
import { getApiClient, resetApiClient } from "@/lib/api/factory";
import { HttpAdapter } from "@/lib/api/httpAdapter";

beforeEach(() => {
  resetApiClient();
});

describe("getApiClient factory", () => {
  it("returns an HttpAdapter by default", () => {
    const client = getApiClient();
    expect(client).toBeInstanceOf(HttpAdapter);
  });

  it("returns the same cached instance on repeated calls", () => {
    const first = getApiClient();
    const second = getApiClient();
    expect(first).toBe(second);
  });

  it("creates a fresh instance after resetApiClient", () => {
    const first = getApiClient();
    resetApiClient();
    const second = getApiClient();
    expect(first).not.toBe(second);
  });
});
