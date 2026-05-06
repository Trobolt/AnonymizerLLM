import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatInterface from "@/components/ChatInterface";

vi.mock("@/lib/api", () => ({
  streamChatMessage: vi.fn(),
}));

import { streamChatMessage } from "@/lib/api";

const makeDoneReader = () => ({
  read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ChatInterface — rendering", () => {
  it("shows placeholder when there are no messages", () => {
    render(
      <ChatInterface messages={[]} onMessagesUpdate={vi.fn()} chatId={1} />
    );
    expect(screen.getByText("Frag Gemini etwas...")).toBeInTheDocument();
  });

  it("renders user and model messages", () => {
    const messages = [
      { role: "user" as const, content: "Hello" },
      { role: "model" as const, content: "Hi there" },
    ];
    render(
      <ChatInterface messages={messages} onMessagesUpdate={vi.fn()} chatId={1} />
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });
});

describe("ChatInterface — submit", () => {
  it("adds a user message on form submit", () => {
    vi.mocked(streamChatMessage).mockResolvedValue(makeDoneReader() as never);
    const onMessagesUpdate = vi.fn();

    render(
      <ChatInterface messages={[]} onMessagesUpdate={onMessagesUpdate} chatId={1} />
    );

    fireEvent.change(screen.getByPlaceholderText("Hier tippen..."), {
      target: { value: "test message" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Hier tippen...").closest("form")!);

    expect(onMessagesUpdate).toHaveBeenCalledWith([
      { role: "user", content: "test message" },
    ]);
  });

  it("does not submit when input is empty", () => {
    const onMessagesUpdate = vi.fn();
    render(
      <ChatInterface messages={[]} onMessagesUpdate={onMessagesUpdate} chatId={1} />
    );

    fireEvent.submit(screen.getByPlaceholderText("Hier tippen...").closest("form")!);
    expect(onMessagesUpdate).not.toHaveBeenCalled();
  });
});
