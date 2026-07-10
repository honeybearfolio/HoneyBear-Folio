import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FileDropZone from "../../../components/shared/FileDropZone";
import { createRef } from "react";

function renderDropZone(overrides: Record<string, unknown> = {}) {
  const dropZoneRef = createRef<HTMLDivElement>();
  const fileInputRef = createRef<HTMLInputElement>();
  const handleDragEnter = vi.fn();
  const handleDragOver = vi.fn();
  const handleDragLeave = vi.fn();
  const handleDrop = vi.fn();
  const handleFileChange = vi.fn();

  const props = {
    file: null as File | null,
    isDragging: false,
    dropZoneRef,
    fileInputRef,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    ...overrides,
  };

  return {
    props,
    fileInputRef,
    handleDrop,
    handleFileChange,
    ...render(<FileDropZone {...props} />),
  };
}

describe("FileDropZone", () => {
  it("renders drag-and-drop prompt by default", () => {
    renderDropZone();

    expect(
      screen.getByText("Drag and drop or click to select file"),
    ).toBeInTheDocument();
    expect(screen.getByText("Supports .csv, .xlsx, .xls, .json")).toBeInTheDocument();
  });

  it("shows drop-active state when dragging", () => {
    renderDropZone({ isDragging: true });

    expect(screen.getByText("Drop file here")).toBeInTheDocument();
  });

  it("forwards drag events to handlers", () => {
    const { props } = renderDropZone();
    const zone = screen.getByText("Drag and drop or click to select file").closest("div")!;

    fireEvent.dragEnter(zone);
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone);

    expect(props.handleDragEnter).toHaveBeenCalled();
    expect(props.handleDragOver).toHaveBeenCalled();
    expect(props.handleDragLeave).toHaveBeenCalled();
    expect(props.handleDrop).toHaveBeenCalled();
  });

  it("triggers file input click when zone is clicked", () => {
    const { fileInputRef } = renderDropZone();
    const clickSpy = vi.spyOn(fileInputRef.current ?? { click: () => {} }, "click");

    if (fileInputRef.current) {
      fileInputRef.current.click = clickSpy;
    }

    fireEvent.click(
      screen.getByText("Drag and drop or click to select file").closest("div")!,
    );

    expect(clickSpy).toHaveBeenCalled();
  });

  it("calls handleFileChange when a file is selected", () => {
    const { handleFileChange } = renderDropZone();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["a"], "test.csv")] } });

    expect(handleFileChange).toHaveBeenCalled();
  });
});
