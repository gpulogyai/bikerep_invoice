import { useState } from "react";
import type { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "onBlur"> & {
  value: number;
  onValueChange: (value: number) => void;
};

/** Keep an editable string (including empty) without putting strings or NaN into saved amounts. */
export default function NumberInput({ value, onValueChange, ...props }: Props) {
  const [draft, setDraft] = useState<{ text: string; number: number } | null>(null);
  return <input {...props} type="number"
    value={draft && draft.number === value ? draft.text : value}
    onChange={event => {
      const text = event.target.value;
      const number = Number(text);
      if (!Number.isFinite(number)) return;
      setDraft({ text, number });
      onValueChange(number);
    }}
    onBlur={() => setDraft(null)}
  />;
}
