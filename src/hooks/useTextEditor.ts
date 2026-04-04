import { useState, useCallback, useEffect } from "react";

export interface TextEditorStyles {
  fontFamily: string;
  fontSize: number;
  fill: string;
  textAlign: "left" | "center" | "right";
  backgroundColor: string;
}

export interface UseTextEditorReturn {
  isOpen: boolean;
  textValue: string;
  styles: TextEditorStyles;
  showColorPicker: boolean;
  showBgColorPicker: boolean;
  viewportHeight: number | null;
  openEditor: (options: {
    text: string;
    fontFamily?: string;
    fontSize?: number;
    fill?: string;
    textAlign?: "left" | "center" | "right";
    backgroundColor?: string;
    isPlaceholder?: boolean;
  }) => void;
  closeEditor: () => { text: string; styles: TextEditorStyles } | null;
  setTextValue: (value: string) => void;
  setStyles: (styles: Partial<TextEditorStyles>) => void;
  toggleColorPicker: () => void;
  toggleBgColorPicker: () => void;
  closeColorPickers: () => void;
  cycleTextAlign: () => void;
  cycleFont: (fonts: { value: string }[]) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useTextEditor(onClose?: () => void): UseTextEditorReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [styles, setStylesState] = useState<TextEditorStyles>({
    fontFamily: "Inter",
    fontSize: 32,
    fill: "#FFFFFF",
    textAlign: "center",
    backgroundColor: "transparent",
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handleResize = () => setViewportHeight(visualViewport.height);
    
    // Set initial height
    handleResize();
    visualViewport.addEventListener("resize", handleResize);
    visualViewport.addEventListener("scroll", handleResize);

    return () => {
      visualViewport.removeEventListener("resize", handleResize);
      visualViewport.removeEventListener("scroll", handleResize);
    };
  }, []);

  const openEditor = useCallback(
    ({
      text,
      fontFamily,
      fontSize,
      fill,
      textAlign,
      backgroundColor,
      isPlaceholder,
    }: {
      text: string;
      fontFamily?: string;
      fontSize?: number;
      fill?: string;
      textAlign?: "left" | "center" | "right";
      backgroundColor?: string;
      isPlaceholder?: boolean;
    }) => {
      setTextValue(isPlaceholder ? "" : text);
      setStylesState({
        fontFamily: fontFamily || "Inter",
        fontSize: fontSize || 32,
        fill: fill || "#FFFFFF",
        textAlign: textAlign || "center",
        backgroundColor: backgroundColor || "transparent",
      });
      setIsOpen(true);
      setShowColorPicker(false);
      setShowBgColorPicker(false);
    },
    []
  );

  const closeEditor = useCallback(() => {
    if (!isOpen) return null;

    const result = { text: textValue, styles: { ...styles } };
    setIsOpen(false);
    setShowColorPicker(false);
    setShowBgColorPicker(false);
    onClose?.();
    return result;
  }, [isOpen, textValue, styles, onClose]);

  const setStyles = useCallback((newStyles: Partial<TextEditorStyles>) => {
    setStylesState((prev) => ({ ...prev, ...newStyles }));
  }, []);

  const toggleColorPicker = useCallback(() => {
    setShowColorPicker((v) => !v);
    setShowBgColorPicker(false);
  }, []);

  const toggleBgColorPicker = useCallback(() => {
    setShowBgColorPicker((v) => !v);
    setShowColorPicker(false);
  }, []);

  const closeColorPickers = useCallback(() => {
    setShowColorPicker(false);
    setShowBgColorPicker(false);
  }, []);

  const cycleTextAlign = useCallback(() => {
    const aligns: ("left" | "center" | "right")[] = ["left", "center", "right"];
    const currentIdx = aligns.indexOf(styles.textAlign);
    const nextAlign = aligns[(currentIdx + 1) % 3];
    setStylesState((prev) => ({ ...prev, textAlign: nextAlign }));
  }, [styles.textAlign]);

  const cycleFont = useCallback(
    (fonts: { value: string }[]) => {
      const currentIdx = fonts.findIndex((f) => f.value === styles.fontFamily);
      const nextIdx = (currentIdx + 1) % fonts.length;
      setStylesState((prev) => ({ ...prev, fontFamily: fonts[nextIdx].value }));
    },
    [styles.fontFamily]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeEditor();
      }
    },
    [closeEditor]
  );

  return {
    isOpen,
    textValue,
    styles,
    showColorPicker,
    showBgColorPicker,
    viewportHeight,
    openEditor,
    closeEditor,
    setTextValue,
    setStyles,
    toggleColorPicker,
    toggleBgColorPicker,
    closeColorPickers,
    cycleTextAlign,
    cycleFont,
    handleKeyDown,
  };
}
