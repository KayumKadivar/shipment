
export const formatPhoneNumber = (
  value: string | undefined,
  prevValue?: string
): string => {
  if (!value) return "";

  const isDeleting = Boolean(prevValue && value.length < prevValue.length);
  let digits = value.replace(/\D/g, "");

  if (isDeleting) {
    const prevDigits = (prevValue || "").replace(/\D/g, "");
    if (digits.length === prevDigits.length && digits.length > 0) {
      digits = digits.slice(0, -1);
    }
  }

  if (digits.length > 10 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 10);

  if (digits.length === 0) return "";
  if (digits.length < 3) return `(${digits}`;
  if (digits.length === 3) return isDeleting ? `(${digits}` : `(${digits}) `;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};
