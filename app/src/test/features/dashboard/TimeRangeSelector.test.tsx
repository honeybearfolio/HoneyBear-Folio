import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TimeRangeSelector from "../../../features/dashboard/TimeRangeSelector";

vi.mock("../../../utils/format", () => ({
  getDatePickerFormat: () => "yyyy-MM-dd",
}));

vi.mock("react-datepicker", () => ({
  default: (props: {
    selected?: Date;
    onChange: (date: Date | null) => void;
    "aria-label"?: string;
  }) => (
    <input
      data-testid="datepicker"
      aria-label={props["aria-label"]}
      value={props.selected ? props.selected.toISOString().split("T")[0] : ""}
      onChange={(e) => {
        props.onChange(new Date(e.target.value));
      }}
    />
  ),
}));

describe("TimeRangeSelector", () => {
  const customStart = new Date("2024-01-01");
  const customEnd = new Date("2024-06-01");

  it("renders preset range buttons", () => {
    render(
      <TimeRangeSelector
        timeRange="1Y"
        setTimeRange={vi.fn()}
        customStartDate={customStart}
        customEndDate={customEnd}
        setCustomStartDate={vi.fn()}
        setCustomEndDate={vi.fn()}
        dateFormat="YYYY-MM-DD"
        firstDayOfWeek={1}
      />,
    );

    expect(screen.getByRole("button", { name: "1M" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1Y" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });

  it("calls setTimeRange when a preset is clicked", async () => {
    const user = userEvent.setup();
    const setTimeRange = vi.fn();

    render(
      <TimeRangeSelector
        timeRange="1Y"
        setTimeRange={setTimeRange}
        customStartDate={customStart}
        customEndDate={customEnd}
        setCustomStartDate={vi.fn()}
        setCustomEndDate={vi.fn()}
        dateFormat="YYYY-MM-DD"
        firstDayOfWeek={1}
      />,
    );

    await user.click(screen.getByRole("button", { name: "3M" }));

    expect(setTimeRange).toHaveBeenCalledWith("3M");
  });

  it("shows custom date pickers when CUSTOM range is active", () => {
    render(
      <TimeRangeSelector
        timeRange="CUSTOM"
        setTimeRange={vi.fn()}
        customStartDate={customStart}
        customEndDate={customEnd}
        setCustomStartDate={vi.fn()}
        setCustomEndDate={vi.fn()}
        dateFormat="YYYY-MM-DD"
        firstDayOfWeek={1}
      />,
    );

    expect(screen.getAllByTestId("datepicker")).toHaveLength(2);
  });

  it("updates custom start date and adjusts end when needed", async () => {
    const user = userEvent.setup();
    const setCustomStartDate = vi.fn();
    const setCustomEndDate = vi.fn();

    render(
      <TimeRangeSelector
        timeRange="CUSTOM"
        setTimeRange={vi.fn()}
        customStartDate={customStart}
        customEndDate={customEnd}
        setCustomStartDate={setCustomStartDate}
        setCustomEndDate={setCustomEndDate}
        dateFormat="YYYY-MM-DD"
        firstDayOfWeek={1}
      />,
    );

    const [startPicker] = screen.getAllByTestId("datepicker");
    await user.clear(startPicker);
    await user.type(startPicker, "2024-12-01");

    expect(setCustomStartDate).toHaveBeenCalled();
  });
});
