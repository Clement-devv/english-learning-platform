export const currencyFactor = currency => 10 ** new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
export const studioMoney = (value, currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value / currencyFactor(currency));
