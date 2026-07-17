import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";
import { cashFlowService } from "./cashflow";

vi.mock("./api", () => ({
  api: {
    get: vi.fn()
  }
}));

describe("cashFlowService public sharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads a shared cashflow without an administrative request", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], net_total: "0.00" } });

    await expect(cashFlowService.getPublicShare("public-token")).resolves.toEqual({
      items: [],
      net_total: "0.00"
    });
    expect(api.get).toHaveBeenCalledWith("/cashflow/shared/public-token");
  });

  it("loads only the links for the selected cashflow scope", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [] } });

    await cashFlowService.listShareLinks("cashflow52");

    expect(api.get).toHaveBeenCalledWith("/cashflow/share-links", {
      params: { scope: "cashflow52" }
    });
  });
});
