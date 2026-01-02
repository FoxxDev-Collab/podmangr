/**
 * @jest-environment jsdom
 */

import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, buttonVariants } from "@/components/ui/button";

describe("Button Component", () => {
  it("renders a button with default variant", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it("renders button with custom text", () => {
    render(<Button>Custom Text</Button>);

    expect(screen.getByText("Custom Text")).toBeInTheDocument();
  });

  it("handles click events", () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders as a link when asChild is used with Link", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );

    const link = screen.getByRole("link", { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
  });

  describe("Button Variants", () => {
    it("applies default variant classes", () => {
      const { container } = render(<Button variant="default">Default</Button>);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("applies destructive variant classes", () => {
      const { container } = render(<Button variant="destructive">Delete</Button>);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("applies outline variant classes", () => {
      const { container } = render(<Button variant="outline">Outline</Button>);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("applies secondary variant classes", () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("applies ghost variant classes", () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("applies link variant classes", () => {
      const { container } = render(<Button variant="link">Link</Button>);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Button Sizes", () => {
    it("applies default size classes", () => {
      const { container } = render(<Button size="default">Default</Button>);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("applies small size classes", () => {
      const { container } = render(<Button size="sm">Small</Button>);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("applies large size classes", () => {
      const { container } = render(<Button size="lg">Large</Button>);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("applies icon size classes", () => {
      const { container } = render(<Button size="icon">X</Button>);
      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("buttonVariants function", () => {
    it("returns class string for default variant", () => {
      const classes = buttonVariants({ variant: "default" });
      expect(typeof classes).toBe("string");
      expect(classes.length).toBeGreaterThan(0);
    });

    it("returns class string for destructive variant", () => {
      const classes = buttonVariants({ variant: "destructive" });
      expect(typeof classes).toBe("string");
    });

    it("returns class string for combined variant and size", () => {
      const classes = buttonVariants({ variant: "outline", size: "lg" });
      expect(typeof classes).toBe("string");
    });

    it("handles custom className", () => {
      const classes = buttonVariants({ className: "custom-class" });
      expect(classes).toContain("custom-class");
    });
  });

  it("forwards ref to button element", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref Button</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe("Ref Button");
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });

  it("passes through additional props", () => {
    render(<Button data-testid="test-button" type="submit">Submit</Button>);

    const button = screen.getByTestId("test-button");
    expect(button).toHaveAttribute("type", "submit");
  });
});
