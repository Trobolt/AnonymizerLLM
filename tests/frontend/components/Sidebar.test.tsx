import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Sidebar from "@/components/Sidebar";

const defaultProps = {
  activeChatId: 1,
  onSelectChat: vi.fn(),
  onAddChat: vi.fn(),
  onDeleteChat: vi.fn(),
  onSettingsClick: vi.fn(),
  chatIds: [1, 2, 3],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Sidebar — chat list", () => {
  it("renders all chat entries", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("Chat 1")).toBeInTheDocument();
    expect(screen.getByText("Chat 2")).toBeInTheDocument();
    expect(screen.getByText("Chat 3")).toBeInTheDocument();
  });

  it("renders empty when no chatIds provided", () => {
    render(<Sidebar {...defaultProps} chatIds={[]} />);
    expect(screen.queryByText(/^Chat \d+$/)).toBeNull();
  });

  it("calls onSelectChat with the correct id", () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText("Chat 2"));
    expect(defaultProps.onSelectChat).toHaveBeenCalledWith(2);
  });
});

describe("Sidebar — actions", () => {
  it("calls onAddChat when new-chat button is clicked", () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText("Neuer Chat"));
    expect(defaultProps.onAddChat).toHaveBeenCalledOnce();
  });

  it("calls onSettingsClick when settings button is clicked", () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText("Einstellungen"));
    expect(defaultProps.onSettingsClick).toHaveBeenCalledOnce();
  });
});
