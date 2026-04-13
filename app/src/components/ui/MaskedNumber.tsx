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

  const formattedValue = formatNumber(value, options);

  if (isPrivacyMode) {
    return (
      <span className={`${className || ""}`} {...props}>
        {formattedValue}
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
