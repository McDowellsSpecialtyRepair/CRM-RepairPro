import { useEffect, useState, forwardRef } from "react";
import { Input } from "@/components/ui/input";

// A number box that never shows a stray leading zero ("0600"). An empty box means 0. Typing replaces the
// placeholder; decimals such as "0.5" and "12.75" can be typed normally.
type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onValueChange: (n: number) => void;
  decimals?: boolean;
};
const show = (n: number | null | undefined) => (n === null || n === undefined || n === 0 ? "" : String(n));

export const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput({ value, onValueChange, decimals = true, placeholder = "0", ...props }, ref) {
  const [text, setText] = useState(show(value));
  // Follow changes made elsewhere (for example a matrix price filled in), but not while the box already shows that number.
  useEffect(() => { if ((text === "" ? 0 : Number(text)) !== (value ?? 0)) setText(show(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Input ref={ref} {...props} type="text" inputMode={decimals ? "decimal" : "numeric"} placeholder={placeholder} value={text}
    onChange={e => {
      let t = e.target.value.replace(/[^\d.]/g, "");
      if (!decimals) t = t.replace(/\./g, "");
      const dot = t.indexOf(".");
      if (dot >= 0) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, "");
      t = t.replace(/^0+(?=\d)/, "");
      setText(t);
      onValueChange(t === "" || t === "." ? 0 : Number(t));
    }} />;
});
