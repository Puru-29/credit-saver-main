import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUnavailable } from "@/components/admin/AdminUnavailable";

describe("AdminPage", () => {
  it("does not display fabricated analytics when admin authorization is unavailable", () => {
    render(<AdminUnavailable />);

    expect(screen.getByRole("heading", { name: "Admin overview" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Admin access is not configured" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No platform statistics are shown/)).toBeInTheDocument();
    expect(screen.queryByText("Total cases")).not.toBeInTheDocument();
  });
});
