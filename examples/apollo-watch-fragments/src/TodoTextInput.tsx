import React, { useState, KeyboardEvent, SyntheticEvent } from "react";

interface Props {
  className: string;
  commitOnBlur?: boolean;
  initialValue?: string;
  onCancel?: () => void;
  onDelete?: () => void;
  onSave: (text: string) => void;
  placeholder?: string;
}

const ENTER_KEY_CODE = 13;
const ESC_KEY_CODE = 27;

export function TodoTextInput({
  className,
  commitOnBlur,
  initialValue,
  onCancel,
  onDelete,
  onSave,
  placeholder,
}: Props) {
  const [text, setText] = useState<string>(initialValue || "");

  const commitChanges = () => {
    const newText = text.trim();

    if (onDelete && newText === "") {
      onDelete();
    } else if (onCancel && newText === initialValue) {
      onCancel();
    } else if (newText !== "") {
      onSave(newText);
      setText("");
    }
  };

  const handleBlur = () => {
    if (commitOnBlur) {
      commitChanges();
    }
  };

  const handleChange = (e: SyntheticEvent<HTMLInputElement>) =>
    setText(e.currentTarget.value);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (onCancel && e.keyCode === ESC_KEY_CODE) {
      onCancel();
    } else if (e.keyCode === ENTER_KEY_CODE) {
      commitChanges();
    }
  };

  return (
    <input
      className={className}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      value={text}
    />
  );
}
