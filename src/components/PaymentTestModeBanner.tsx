import { getPaddleEnvironment } from "@/lib/paddle";
import { useI18n } from "@/lib/i18n";

export function PaymentTestModeBanner() {
  const { t } = useI18n();
  if (getPaddleEnvironment() !== "sandbox") return null;

  return (
    <div className="w-full border-b border-orange-300 bg-orange-100 px-4 py-2 text-center text-sm text-orange-800">
      {t("ms.payment.testMode")}{" "}
      <a
        href="https://developer.paddle.com/build/transactions/testing"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline"
      >
        {t("ms.payment.learnMore")}
      </a>
    </div>
  );
}
