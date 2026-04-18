import { useState } from "react";
import { useFormatNumber } from "../../utils/format";
import { usePrivacy } from "../../stores/privacy";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const { isPrivacyMode } = usePrivacy();
  const [peeking, setPeeking] = useState(false);

  const formattedValue = formatNumber(value, options);
  const realValue = formatNumber(value, { ...options, ignorePrivacy: true });

  if (isPrivacyMode) {
    return (
      <span
        className={`${className || ""} inline-flex items-center`}
        {...props}
      >
        <span aria-live="polite">{peeking ? realValue : formattedValue}</span>
        <button
          type="button"
          className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded opacity-40 hover:opacity-100 focus:opacity-100 transition-opacity"
          aria-label={peeking ? t("a11y.hide_value") : t("a11y.show_value")}
          onMouseDown={() => setPeeking(true)}
          onMouseUp={() => setPeeking(false)}
          onMouseLeave={() => setPeeking(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setPeeking((p) => !p);
            }
          }}
          onBlur={() => setPeeking(false)}
        >
          {peeking ? "🙈" : "👁"}
        </button>
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
