import { useState } from "react";
import { useFormatNumber } from "../../utils/format";
import { usePrivacy } from "../../contexts/privacy";

interface MaskedNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | string | undefined;
  options?: Record<string, unknown>;
  className?: string;
}

export default function MaskedNumber({
  value,
  options = {},
  className,
  ...props
}: MaskedNumberProps) {
  const formatNumber = useFormatNumber();
  const { isPrivacyMode } = usePrivacy();
  const [isHovered, setIsHovered] = useState(false);

  const formattedValue = formatNumber(value, options);

  if (isPrivacyMode) {
    const unmaskedValue = formatNumber(value, {
      ...options,
      ignorePrivacy: true,
    });
    return (
      <span
        className={`cursor-help cursor-pointer ${className || ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {isHovered ? unmaskedValue : formattedValue}
      </span>
    );
  }

  if (className) {
    return (
      <span className={className} {...props}>
        {formattedValue}
      </span>
    );
  }

  return <>{formattedValue}</>;
}
